import type {
  Workflow,
  WorkflowConstraint,
  WorkflowEvent,
} from '../tangled/types.js';
import type {
  HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow,
  Event as GitHubEvent,
} from './types.js';

/**
 * Tangled event names mapped to their GitHub equivalent.
 */
const EVENT_MAP: Record<WorkflowEvent, GitHubEvent> = {
  push: 'push',
  pull_request: 'pull_request',
  manual: 'workflow_dispatch',
};

/**
 * Tangled constraint filter fields, mapped to the GitHub event-config key they
 * populate.
 */
const FILTER_MAP = {
  branch: 'branches',
  tag: 'tags',
  paths: 'paths',
} as const;

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Translate tangled `when` constraints into a GitHub `on` trigger map.
 * Constraints without an event are dropped, as are branch/tag/paths filters on
 * events that don't accept them (e.g. `workflow_dispatch`). Filters from
 * multiple constraints targeting the same event are merged.
 */
function toOn(when: WorkflowConstraint[] | undefined): GitHubWorkflow['on'] {
  const on: GitHubWorkflow['on'] = {};

  for (const constraint of when ?? []) {
    for (const event of toArray(constraint.event)) {
      const ghEvent = EVENT_MAP[event];
      const config = (on[ghEvent] ??= {});

      if (ghEvent !== 'push' && ghEvent !== 'pull_request') {
        continue;
      }

      for (const [tangledKey, ghKey] of Object.entries(FILTER_MAP)) {
        const values = toArray(
          constraint[tangledKey as keyof typeof FILTER_MAP],
        );
        if (values.length > 0) {
          config[ghKey] = [
            ...new Set([...(config[ghKey] ?? []), ...values]),
          ] as [string, ...string[]];
        }
      }
    }
  }

  return on;
}

/**
 * Translate tangled `environment` into GitHub workflow-level `env`.
 */
function toEnv(
  environment: Record<string, string> | undefined,
): GitHubWorkflow['env'] {
  if (!environment) {
    return undefined;
  }
  return { ...environment };
}

/**
 * Convert the engine-agnostic fields of a tangled workflow into a GitHub
 * workflow base. Steps and jobs are handled elsewhere.
 */
function toGitHubBase(
  workflow: Workflow,
): Pick<GitHubWorkflow, 'on'> & Partial<Pick<GitHubWorkflow, 'env'>> {
  const base: Pick<GitHubWorkflow, 'on'> &
    Partial<Pick<GitHubWorkflow, 'env'>> = {
    on: toOn(workflow.when),
  };

  const env = toEnv(workflow.environment);
  if (env) {
    base.env = env;
  }

  return base;
}

/**
 * Convert a tangled workflow into an equivalent GitHub Actions workflow
 */
export function toGitHub(workflow: Workflow): GitHubWorkflow {
  return {
    jobs: {},
    ...toGitHubBase(workflow),
  };
}
