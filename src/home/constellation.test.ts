import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { constellationLayout } from './constellation';

const g = graphFromIds(['array/base/a', 'array/base/b', 'array/x', 'math/base/special/lnf', 'stats/base/a', 'stats/strided/b', 'stats/strided/c']);

describe('constellationLayout', () => {
  const layout = constellationLayout(g, { width: 800, height: 520 }, 2);

  it('puts every root namespace on a ring around the centre', () => {
    expect(layout.centre).toEqual({ x: 400, y: 260 });
    expect(layout.ring.map((n) => n.label)).toEqual(['array', 'math', 'stats']);
    for (const n of layout.ring) {
      const r = Math.hypot(n.x - 400, n.y - 260);
      expect(r).toBeCloseTo(layout.ringRadius, 5);
    }
  });

  it('places the biggest sub-namespaces on an outer ring near their parent', () => {
    expect(layout.outer.map((n) => n.label)).toEqual(['array/base', 'math/base']);
    const parent = layout.ring.find((n) => n.label === 'array')!;
    const child = layout.outer[0];
    expect(Math.hypot(child.x - 400, child.y - 260)).toBeGreaterThan(layout.ringRadius);
    expect(Math.abs(Math.atan2(child.y - 260, child.x - 400) - Math.atan2(parent.y - 260, parent.x - 400))).toBeLessThan(0.3);
  });

  it('links centre→ring and parent→outer', () => {
    expect(layout.links).toHaveLength(3 + 2);
  });

  it('accepts an explicit centre, off from the geometric middle', () => {
    const offset = constellationLayout(g, { width: 800, height: 520 }, 2, { x: 560, y: 260 });
    expect(offset.centre).toEqual({ x: 560, y: 260 });
    for (const n of offset.ring) {
      const r = Math.hypot(n.x - 560, n.y - 260);
      expect(r).toBeCloseTo(offset.ringRadius, 5);
    }
  });
});
