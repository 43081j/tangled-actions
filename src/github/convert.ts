import type { Workflow } from '../tangled/types.js';
import type { HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow } from './types.js';

/**
 * Convert a tangled workflow into an equivalent GitHub Actions workflow
 */
export function toGitHub(_workflow: Workflow): GitHubWorkflow {
  throw new Error('Not implemented');
}
