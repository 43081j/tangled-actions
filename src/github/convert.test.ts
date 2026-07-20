import { describe, it, expect } from 'vitest';
import { toGitHub } from './convert.js';
import type { Workflow } from '../tangled/types.js';

function nixery(overrides: Partial<Workflow> = {}): Workflow {
  return { engine: 'nixery', ...overrides } as Workflow;
}

describe('toGitHub', () => {
  it('produces an empty jobs map and no triggers by default', () => {
    expect(toGitHub(nixery())).toEqual({ jobs: {}, on: {} });
  });

  describe('on', () => {
    it('maps tangled events to their GitHub equivalents', () => {
      const result = toGitHub(
        nixery({
          when: [
            { event: 'push' },
            { event: 'pull_request' },
            { event: 'manual' },
          ],
        }),
      );

      expect(result.on).toEqual({
        push: {},
        pull_request: {},
        workflow_dispatch: {},
      });
    });

    it('expands an array of events on a single constraint', () => {
      const result = toGitHub(
        nixery({ when: [{ event: ['push', 'pull_request'] }] }),
      );

      expect(result.on).toEqual({ push: {}, pull_request: {} });
    });

    it('drops constraints without an event', () => {
      const result = toGitHub(nixery({ when: [{ branch: 'main' }] }));

      expect(result.on).toEqual({});
    });

    it('maps branch, tag and paths filters to their GitHub keys', () => {
      const result = toGitHub(
        nixery({
          when: [
            {
              event: 'push',
              branch: 'main',
              tag: 'v1',
              paths: 'src/**',
            },
          ],
        }),
      );

      expect(result.on).toEqual({
        push: {
          branches: ['main'],
          tags: ['v1'],
          paths: ['src/**'],
        },
      });
    });

    it('preserves array filter values', () => {
      const result = toGitHub(
        nixery({
          when: [{ event: 'push', branch: ['main', 'dev'] }],
        }),
      );

      expect(result.on).toEqual({ push: { branches: ['main', 'dev'] } });
    });

    it('drops filters on events that do not accept them', () => {
      const result = toGitHub(
        nixery({
          when: [{ event: 'manual', branch: 'main', paths: 'src/**' }],
        }),
      );

      expect(result.on).toEqual({ workflow_dispatch: {} });
    });

    it('merges filters from multiple constraints targeting the same event', () => {
      const result = toGitHub(
        nixery({
          when: [
            { event: 'push', branch: 'main' },
            { event: 'push', branch: 'dev', tag: 'v1' },
          ],
        }),
      );

      expect(result.on).toEqual({
        push: {
          branches: ['main', 'dev'],
          tags: ['v1'],
        },
      });
    });

    it('deduplicates merged filter values', () => {
      const result = toGitHub(
        nixery({
          when: [
            { event: 'push', branch: ['main', 'dev'] },
            { event: 'push', branch: ['dev', 'release'] },
          ],
        }),
      );

      expect(result.on).toEqual({
        push: { branches: ['main', 'dev', 'release'] },
      });
    });
  });

  describe('env', () => {
    it('omits env when there is no environment', () => {
      expect(toGitHub(nixery())).not.toHaveProperty('env');
    });

    it('maps environment to workflow-level env', () => {
      const result = toGitHub(
        nixery({ environment: { FOO: 'bar', BAZ: 'qux' } }),
      );

      expect(result.env).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('copies the environment rather than referencing it', () => {
      const environment = { FOO: 'bar' };
      const result = toGitHub(nixery({ environment }));

      expect(result.env).not.toBe(environment);
    });
  });
});
