import type {
  Workflow,
  WorkflowBase,
  WorkflowConstraint,
  WorkflowEvent,
} from './types.js';
import type {
  HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow,
  Event as GitHubEvent,
} from '../github/types.js';

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
 * Translate GitHub workflow-level `env` into tangled `environment`. A string
 * expression (`${{ ... }}`) cannot be represented as a static map and is
 * dropped.
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
 * Convert the engine-agnostic fields of a GitHub Actions workflow into a
 * tangled workflow base. Steps and engine-specific configuration are handled
 * elsewhere.
 */
function toTangledBase(workflow: GitHubWorkflow): Omit<WorkflowBase, 'steps'> {
  const base: Omit<WorkflowBase, 'steps'> = {};

  const when = toWhen(workflow.on);
  if (when.length > 0) {
    base.when = when;
  }

  const environment = toEnvironment(workflow.env);
  if (environment) {
    base.environment = environment;
  }

  return base;
}

/**
 * Convert a GitHub Actions workflow into an equivalent tangled workflow
 */
export function toTangled(workflow: GitHubWorkflow): Workflow {
  const base = toTangledBase(workflow);

  return {
    engine: 'nixery',
    ...base,
  };
}
