import { describe, it, expect } from 'vitest';
import { toTangled } from './convert.js';
import type { HttpsJsonSchemastoreOrgGithubWorkflowJson as GitHubWorkflow } from '../github/types.js';

function workflow(overrides: Record<string, unknown> = {}): GitHubWorkflow {
  return { on: {}, jobs: {}, ...overrides } as GitHubWorkflow;
}

describe('toTangled', () => {
  it('produces a nixery workflow with no base fields by default', () => {
    expect(toTangled(workflow())).toEqual({ engine: 'nixery' });
  });

  describe('when', () => {
    it('maps a string trigger to a single constraint', () => {
      const result = toTangled(workflow({ on: 'push' }));

      expect(result.when).toEqual([{ event: 'push' }]);
    });

    it('maps workflow_dispatch to manual', () => {
      const result = toTangled(workflow({ on: 'workflow_dispatch' }));

      expect(result.when).toEqual([{ event: 'manual' }]);
    });

    it('drops a string trigger tangled does not understand', () => {
      const result = toTangled(workflow({ on: 'schedule' }));

      expect(result.when).toBeUndefined();
    });

    it('maps an array of triggers, dropping unknown ones', () => {
      const result = toTangled(
        workflow({ on: ['push', 'schedule', 'workflow_dispatch'] }),
      );

      expect(result.when).toEqual([{ event: 'push' }, { event: 'manual' }]);
    });

    it('maps an object trigger with no config to bare constraints', () => {
      const result = toTangled(
        workflow({ on: { push: null, pull_request: null } }),
      );

      expect(result.when).toEqual([
        { event: 'push' },
        { event: 'pull_request' },
      ]);
    });

    it('drops object-trigger events tangled does not understand', () => {
      const result = toTangled(
        workflow({ on: { push: null, schedule: [{ cron: '0 0 * * *' }] } }),
      );

      expect(result.when).toEqual([{ event: 'push' }]);
    });

    it('maps branches, tags and paths filters to tangled fields', () => {
      const result = toTangled(
        workflow({
          on: {
            push: {
              branches: ['main'],
              tags: ['v1'],
              paths: ['src/**'],
            },
          },
        }),
      );

      expect(result.when).toEqual([
        {
          event: 'push',
          branch: ['main'],
          tag: ['v1'],
          paths: ['src/**'],
        },
      ]);
    });

    it('ignores empty filter arrays', () => {
      const result = toTangled(workflow({ on: { push: { branches: [] } } }));

      expect(result.when).toEqual([{ event: 'push' }]);
    });
  });

  describe('environment', () => {
    it('omits environment when env is absent', () => {
      expect(toTangled(workflow())).not.toHaveProperty('environment');
    });

    it('maps env to environment', () => {
      const result = toTangled(workflow({ env: { FOO: 'bar', BAZ: 'qux' } }));

      expect(result.environment).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('stringifies non-string env values', () => {
      const result = toTangled(
        workflow({ env: { COUNT: 3, FLAG: true } as GitHubWorkflow['env'] }),
      );

      expect(result.environment).toEqual({ COUNT: '3', FLAG: 'true' });
    });

    it('drops a string env expression that cannot be represented as a map', () => {
      const result = toTangled(workflow({ env: '${{ fromJSON(env.VARS) }}' }));

      expect(result.environment).toBeUndefined();
    });
  });
});
