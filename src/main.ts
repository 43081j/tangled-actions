import type { Workflow } from './types.js';
import type { HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow } from './github-types.js';

/**
 * Convert a tangled workflow into an equivalent GitHub Actions workflow
 */
export function toGitHub(_workflow: Workflow): GitHubWorkflow {
  throw new Error('Not implemented');
}

/**
 * Convert a GitHub Actions workflow into an equivalent tangled workflow
 */
export function toTangled(_workflow: GitHubWorkflow): Workflow {
  throw new Error('Not implemented');
}
