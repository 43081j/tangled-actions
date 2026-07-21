import { readFile } from 'node:fs/promises';
import { convertWorkflow } from './tangled/convert.js';
import type { HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow } from './github/types.js';
import type { Pipeline } from './tangled/types.js';

export { convertWorkflow as convertWorkflowToTangled } from './tangled/convert.js';
export { convertWorkflow as convertWorkflowToGitHub } from './github/convert.js';

/**
 * Read a GitHub Actions workflow YAML file from disk and convert it into a
 * tangled pipeline. Requires the optional `yaml` peer dependency.
 */
export async function convertWorkflowFile(path: string): Promise<Pipeline> {
  const source = await readFile(path, 'utf8');
  const { parse } = await import('yaml');

  const workflow = parse(source) as GitHubWorkflow;
  return convertWorkflow(workflow);
}
