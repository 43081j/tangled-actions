import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { convertWorkflowFile } from './main.js';

const fixturesDir = fileURLToPath(new URL('../test/fixtures', import.meta.url));

const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe('convertWorkflowFile', () => {
  it.each(fixtures)('handles the %s fixture', async (name) => {
    let result: unknown;
    try {
      result = await convertWorkflowFile(`${fixturesDir}/${name}/input.yml`);
    } catch (error) {
      result = { error: (error as Error).message };
    }

    expect(result).toMatchSnapshot();
  });

  it('rejects when the file does not exist', async () => {
    await expect(
      convertWorkflowFile(`${fixturesDir}/does-not-exist/input.yml`),
    ).rejects.toThrow();
  });
});
