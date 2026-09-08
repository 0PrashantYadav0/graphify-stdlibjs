import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { neighbourhood } from './neighbourhood';

const g = graphFromIds(['a', 'b', 'c', 'd'], {
  runtime: [['a', 'b'], ['c', 'a']],
  dev: [['a', 'c'], ['d', 'a']],
  native: [['a', 'b']],
});
const at = (id: string) => g.indexOf(id);

describe('neighbourhood', () => {
  it('collects runtime neighbours only by default', () => {
    expect(neighbourhood(g, at('a'), ['runtime'])).toEqual({ requires: [at('b')], requiredBy: [at('c')], connected: 2 });
  });
  it('unions across edge kinds without double counting', () => {
    const n = neighbourhood(g, at('a'), ['runtime', 'dev', 'native']);
    expect(n.requires).toEqual([at('b'), at('c')]);
    expect(n.requiredBy).toEqual([at('c'), at('d')]);
    expect(n.connected).toBe(3);
  });
});
