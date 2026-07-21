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

  let parse: typeof import('yaml').parse;
  try {
    ({ parse } = await import('yaml'));
  } catch {
    throw new Error(
      'The "yaml" package is required to parse workflow files. Install it with `npm install yaml`.',
    );
  }

  const workflow = parse(source) as GitHubWorkflow;
  return convertWorkflow(workflow);
}
