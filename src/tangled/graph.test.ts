import { describe, it, expect } from 'vitest';
import { groupJobsByNeeds } from './graph.js';
import type { NormalJob } from '../github/types.js';

const baseJob: NormalJob = { 'runs-on': 'ubuntu-latest' };

describe('groupJobsByNeeds', () => {
  it('puts independent jobs in their own groups', () => {
    expect(groupJobsByNeeds({ lint: baseJob, test: baseJob })).toEqual([
      { ids: ['lint'] },
      { ids: ['test'] },
    ]);
  });

  it('merges a linear chain into one group in dependency order', () => {
    expect(
      groupJobsByNeeds({
        deploy: { ...baseJob, needs: 'build' },
        build: { ...baseJob, needs: 'lint' },
        lint: baseJob,
      }),
    ).toEqual([{ ids: ['lint', 'build', 'deploy'] }]);
  });

  it('normalises a string[] needs', () => {
    expect(
      groupJobsByNeeds({
        a: baseJob,
        b: baseJob,
        c: { ...baseJob, needs: ['a', 'b'] },
      }),
    ).toEqual([{ ids: ['a', 'b', 'c'] }]);
  });

  it('topologically sorts a diamond, breaking ties by declaration order', () => {
    expect(
      groupJobsByNeeds({
        a: baseJob,
        b: { ...baseJob, needs: 'a' },
        c: { ...baseJob, needs: 'a' },
        d: { ...baseJob, needs: ['b', 'c'] },
      }),
    ).toEqual([{ ids: ['a', 'b', 'c', 'd'] }]);
  });

  it('keeps disconnected components separate', () => {
    expect(
      groupJobsByNeeds({
        a: baseJob,
        b: { ...baseJob, needs: 'a' },
        x: baseJob,
        y: { ...baseJob, needs: 'x' },
      }),
    ).toEqual([{ ids: ['a', 'b'] }, { ids: ['x', 'y'] }]);
  });

  it('orders groups by their earliest declared job', () => {
    expect(
      groupJobsByNeeds({
        standalone: baseJob,
        first: baseJob,
        second: { ...baseJob, needs: 'first' },
      }),
    ).toEqual([{ ids: ['standalone'] }, { ids: ['first', 'second'] }]);
  });

  it('throws when needs references an unknown job', () => {
    expect(() =>
      groupJobsByNeeds({ a: { ...baseJob, needs: 'ghost' } }),
    ).toThrow('Job "a" needs unknown job "ghost"');
  });

  it('throws on a needs cycle', () => {
    expect(() =>
      groupJobsByNeeds({
        a: { ...baseJob, needs: 'b' },
        b: { ...baseJob, needs: 'a' },
      }),
    ).toThrow('Jobs form a `needs` cycle: a, b');
  });
});
