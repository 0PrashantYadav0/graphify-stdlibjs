import { describe, expect, it } from 'vitest';
import { LEVEL_DX, NODE_W, ROW_DY, layoutTree, linkPath } from './layout';

interface N { key: string; kids: N[] }
const leaf = (key: string): N => ({ key, kids: [] });
const tree: N = { key: 'root', kids: [{ key: 'a', kids: [leaf('a1'), leaf('a2')] }, leaf('b')] };
const childrenOf = (n: N) => n.kids;

describe('layoutTree', () => {
  it('places the root at the origin and children one level to the right, rows apart', () => {
    const r = layoutTree(tree, childrenOf, () => true, 'right');
    const at = (k: string) => r.nodes.find((n) => n.data.key === k)!;
    expect(at('root')).toMatchObject({ x: 0, y: 0, depth: 0, parentKey: null });
    expect(at('a').x).toBe(LEVEL_DX);
    expect(at('a1').x).toBe(2 * LEVEL_DX);
    expect(at('a2').y - at('a1').y).toBe(ROW_DY);
    expect(r.nodes).toHaveLength(5);
    expect(r.links).toHaveLength(4);
  });

  it('only descends into expanded nodes', () => {
    const r = layoutTree(tree, childrenOf, (n) => n.key === 'root', 'right');
    expect(r.nodes.map((n) => n.data.key).sort()).toEqual(['a', 'b', 'root']);
  });

  it('mirrors x for the left direction and swaps link edges', () => {
    const r = layoutTree(tree, childrenOf, () => true, 'left');
    const a = r.nodes.find((n) => n.data.key === 'a')!;
    expect(a.x).toBe(-LEVEL_DX);
    const link = r.links.find((l) => l.target === 'a')!;
    expect(link.sx).toBe(-NODE_W / 2);
    expect(link.tx).toBe(-LEVEL_DX + NODE_W / 2);
  });

  it('reports bounds', () => {
    const r = layoutTree(tree, childrenOf, () => true, 'right');
    expect(r.minX).toBe(0);
    expect(r.maxX).toBe(2 * LEVEL_DX);
    expect(r.maxY - r.minY).toBeGreaterThan(0);
  });

  it('builds an svg path for a link', () => {
    expect(linkPath({ source: 'r', target: 'a', sx: 0, sy: 0, tx: 100, ty: 50 })).toMatch(/^M0,0C/);
  });
});
