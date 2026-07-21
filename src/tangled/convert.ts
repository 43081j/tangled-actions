import type {
  NixeryWorkflow,
  Pipeline,
  Workflow,
  WorkflowBase,
  WorkflowConstraint,
  WorkflowEvent,
  WorkflowStep,
} from './types.js';
import type {
  HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow,
  Event as GitHubEvent,
  NormalJob,
  Permissions,
  Step as GitHubStep,
} from '../github/types.js';
import { convertAction } from './actions/index.js';

/**
 * Workflow-level keys with a tangled representation.
 */
const WORKFLOW_KEYS = new Set<keyof GitHubWorkflow>([
  'name',
  'on',
  'env',
  'jobs',
  'permissions',
  'concurrency',
]);

/**
 * GitHub job keys with a tangled representation.
 */
const JOB_KEYS = new Set<keyof NormalJob>([
  'name',
  'runs-on',
  'steps',
  'permissions',
  'concurrency',
  'timeout-minutes',
]);

/**
 * GitHub step keys with a tangled representation.
 */
const STEP_KEYS = new Set<keyof GitHubStep>([
  'run',
  'name',
  'env',
  'timeout-minutes',
]);

/**
 * Throw if `value` has any key not listed in `known`. `context` labels the
 * offending location in the error message.
 */
function assertKnownKeys<T extends object>(
  value: T,
  known: Set<keyof T>,
  context: string,
): void {
  for (const key of Object.keys(value)) {
    if (!known.has(key as keyof T)) {
      throw new Error(`Unsupported ${context} key: ${key}`);
    }
  }
}

/**
 * Permission scopes whose `write` grant a workflow relies on and tangled cannot
 * provide, since it has no token to push to the repository or publish packages.
 */
const WRITE_DEPENDENT_SCOPES = ['contents', 'id-token'] as const;

/**
 * Throw if `permissions` grants write access tangled cannot honour. Any other
 * permission configuration has no tangled representation and is dropped.
 */
function assertPermissions(
  permissions: Permissions | undefined,
  context: string,
): void {
  if (permissions === 'write-all') {
    throw new Error(
      `Unsupported ${context} permissions: write access has no tangled equivalent`,
    );
  }

  if (permissions && typeof permissions === 'object') {
    for (const scope of WRITE_DEPENDENT_SCOPES) {
      if (permissions[scope] === 'write') {
        throw new Error(
          `Unsupported ${context} permissions: "${scope}: write" has no tangled equivalent`,
        );
      }
    }
  }
}

/**
 * GitHub event names that have a tangled equivalent, mapped to it. Events
 * without an entry here have no representation in a tangled workflow.
 */
const EVENT_MAP: Partial<Record<GitHubEvent, WorkflowEvent>> = {
  push: 'push',
  pull_request: 'pull_request',
  workflow_dispatch: 'manual',
};

/**
 * Filter keys on a GitHub event config, mapped to the tangled constraint field
 * they populate.
 */
const FILTER_MAP = {
  branches: 'branch',
  tags: 'tag',
  paths: 'paths',
} as const;
/**
 * Translate a GitHub `on` trigger into a list of tangled `when` constraints.
 * Events tangled does not understand are dropped.
 */
function toWhen(on: GitHubWorkflow['on']): WorkflowConstraint[] {
  if (typeof on === 'string') {
    const event = EVENT_MAP[on];
    return event ? [{ event }] : [];
  }

  if (Array.isArray(on)) {
    return on.flatMap((name) => {
      const event = EVENT_MAP[name];
      return event ? [{ event }] : [];
    });
  }

  const constraints: WorkflowConstraint[] = [];

  for (const [name, config] of Object.entries(on)) {
    const event = EVENT_MAP[name as GitHubEvent];
    if (!event) {
      continue;
    }

    const constraint: WorkflowConstraint = { event };

    if (config && typeof config === 'object') {
      const filters = config as Record<string, unknown>;
      for (const [ghKey, tangledKey] of Object.entries(FILTER_MAP)) {
        const value = filters[ghKey];
        if (Array.isArray(value) && value.length > 0) {
          constraint[tangledKey] = value as string[];
        }
      }
    }

    constraints.push(constraint);
  }

  return constraints;
}

/**
 * Translate a GitHub `env` map into tangled `environment`.
 */
function toEnvironment(
  env: GitHubWorkflow['env'],
): Record<string, string> | undefined {
  if (!env || typeof env !== 'object') {
    return undefined;
  }

  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    environment[key] = String(value);
  }
  return environment;
}

/**
 * Translate a single GitHub step into a tangled step.
 */
function toStep(step: GitHubStep): WorkflowStep {
  assertKnownKeys(step, STEP_KEYS, 'step');

  if (typeof step.run !== 'string') {
    throw new Error('Unsupported step: a `run` command is required');
  }

  const result: WorkflowStep = { command: step.run };

  if (step.name !== undefined) {
    result.name = step.name;
  }

  const environment = toEnvironment(step.env);
  if (environment) {
    result.environment = environment;
  }

  return result;
}

/**
 * Merge `extra` nixery dependencies into `target`, appending packages per
 * registry without introducing duplicates.
 */
function mergeDependencies(
  target: Record<string, string[]>,
  extra: Record<string, string[]> | undefined,
): void {
  if (!extra) {
    return;
  }
  for (const [registry, packages] of Object.entries(extra)) {
    const existing = (target[registry] ??= []);
    for (const pkg of packages) {
      if (!existing.includes(pkg)) {
        existing.push(pkg);
      }
    }
  }
}

type ToStepsResult = Required<Pick<NixeryWorkflow, 'steps' | 'dependencies'>> &
  Pick<NixeryWorkflow, 'clone'>;

/**
 * Translate a job's `steps` into tangled steps and the workflow configuration
 * implied by its `uses` steps.
 */
function toSteps(steps: readonly GitHubStep[]): ToStepsResult {
  const result: ToStepsResult = { steps: [], dependencies: {} };

  for (const step of steps) {
    if (typeof step.uses === 'string') {
      const conversion = convertAction(step.uses, step);
      if (!conversion) {
        throw new Error(`Unsupported action: ${step.uses}`);
      }
      mergeDependencies(result.dependencies, conversion.dependencies);
      if (conversion.clone) {
        result.clone = conversion.clone;
      }
      continue;
    }

    result.steps.push(toStep(step));
  }

  return result;
}

/**
 * Translate a single GitHub job into a tangled workflow, carrying the
 * workflow-level `shared` configuration onto it. Each job runs on its own
 * runner in GitHub, so it becomes an independent workflow in the pipeline.
 */
function toWorkflow(
  id: string,
  job: NormalJob,
  shared: WorkflowBase,
): Workflow {
  if ('uses' in job) {
    throw new Error(
      `Unsupported job "${id}": reusable workflow calls have no tangled equivalent`,
    );
  }

  assertKnownKeys(job, JOB_KEYS, `job "${id}"`);
  assertPermissions(job.permissions, `job "${id}"`);

  const { steps, dependencies, clone } = toSteps(job.steps ?? []);

  const workflow: NixeryWorkflow = { engine: 'nixery' };

  if (shared.when) {
    workflow.when = shared.when;
  }
  if (clone) {
    workflow.clone = clone;
  }
  if (steps.length > 0) {
    workflow.steps = steps;
  }
  if (shared.environment) {
    workflow.environment = shared.environment;
  }
  if (Object.keys(dependencies).length > 0) {
    workflow.dependencies = dependencies;
  }

  return workflow;
}

/**
 * Convert a GitHub Actions workflow into an equivalent tangled pipeline, one
 * workflow per GitHub job. Throws on any workflow, job, or step configuration
 * that has no tangled representation, rather than silently dropping it.
 */
export function toTangled(workflow: GitHubWorkflow): Pipeline {
  assertKnownKeys(workflow, WORKFLOW_KEYS, 'workflow');
  assertPermissions(workflow.permissions, 'workflow');

  const shared: WorkflowBase = {};

  const when = toWhen(workflow.on);
  if (when.length > 0) {
    shared.when = when;
  }

  const environment = toEnvironment(workflow.env);
  if (environment) {
    shared.environment = environment;
  }

  return Object.entries(workflow.jobs).map(([id, job]) =>
    toWorkflow(id, job as NormalJob, shared),
  );
}
