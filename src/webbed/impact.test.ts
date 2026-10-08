import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { impactList, impactSet } from './impact';

// x is the package being changed.
//   runtime: a → x, b → a        (a, b runtime-affected)
//   native:  n → x               (n rebuild-affected)
//   native:  a → x as well       (a is already runtime-affected; counted once, as runtime)
//   dev:     t → a, u → n, v → x  (t, u, v test-affected: direct dev-dependents)
//   dev:     w → t               (w is NOT affected: dev edges don't propagate)
const g = graphFromIds(['p/a', 'p/b', 'p/n', 'p/t', 'p/u', 'p/v', 'p/w', 'p/x', 'p/y'], {
  runtime: [['p/a', 'p/x'], ['p/b', 'p/a']],
  native: [['p/n', 'p/x'], ['p/a', 'p/x']],
  dev: [['p/t', 'p/a'], ['p/u', 'p/n'], ['p/v', 'p/x'], ['p/w', 'p/t'], ['p/b', 'p/a']],
});
const ids = (xs: number[]) => xs.map((i) => g.ids[i]);

describe('impactSet', () => {
  const set = impactSet(g, g.indexOf('p/x'));

  it('splits what a change can break into three disjoint buckets', () => {
    expect(ids(set.runtime)).toEqual(['p/a', 'p/b']);
    expect(ids(set.rebuild)).toEqual(['p/n']);
    expect(ids(set.tests)).toEqual(['p/t', 'p/u', 'p/v']);
  });

  it('does not let a dev edge propagate', () => {
    expect([...set.runtime, ...set.rebuild, ...set.tests].map((i) => g.ids[i])).not.toContain('p/w');
  });

  it('is empty for a package nothing depends on', () => {
    expect(impactSet(g, g.indexOf('p/y'))).toEqual({ runtime: [], rebuild: [], tests: [] });
  });
});

describe('impactList', () => {
  it('lists ids one per line, grouped by bucket', () => {
    expect(impactList(g, impactSet(g, g.indexOf('p/x')))).toBe(
      ['# runtime (2)', 'p/a', 'p/b', '', '# rebuild (1)', 'p/n', '', '# tests (3)', 'p/t', 'p/u', 'p/v', ''].join('\n'),
    );
  });
});
