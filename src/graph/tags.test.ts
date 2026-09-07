import { describe, expect, it } from 'vitest';
import { Tag, decodeTags, hasTag } from './tags';

describe('tags', () => {
  it('decodes a bitmask into names in display order', () => {
    expect(decodeTags(Tag.JS | Tag.C | Tag.NATIVE)).toEqual(['JS', 'C', 'NATIVE']);
    expect(decodeTags(0)).toEqual([]);
  });

  it('checks a single tag', () => {
    expect(hasTag(Tag.JS | Tag.CLI, 'CLI')).toBe(true);
    expect(hasTag(Tag.JS, 'C')).toBe(false);
  });

  it('bits are distinct powers of two', () => {
    const bits = Object.values(Tag);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(b & (b - 1)).toBe(0);
  });
});
