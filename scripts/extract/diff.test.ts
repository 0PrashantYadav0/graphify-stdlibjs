import { describe, expect, it } from 'vitest';
import { buildGraphFile } from '../../src/graph/buildGraphFile';
import { Tag } from '../../src/graph/tags';
import { diffGraphFiles } from './diff';

const pkg = (id: string, runtime: string[] = []) => ({ id, desc: '', tags: Tag.JS, runtime, dev: [], native: [] });
const OLD = 'fd5bfb49cac0b48b994a163effb4c3a1cc14d81d';
const NEW = '455f0d5aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('diffGraphFiles', () => {
  it('ignores generatedAt, so a re-run against the same commit is no change', () => {
    const a = buildGraphFile([pkg('a/x')], OLD);
    expect(diffGraphFiles(a, { ...a, generatedAt: 'later' })).toEqual({ changed: false, markdown: '' });
  });

  it('tabulates counts and lists added and removed ids', () => {
    const before = buildGraphFile([pkg('a/x', ['a/y']), pkg('a/y'), pkg('a/gone')], OLD);
    const after = buildGraphFile([pkg('a/x', ['a/y', 'a/new']), pkg('a/y'), pkg('a/new')], NEW);
    const { changed, markdown } = diffGraphFiles(before, after);
    expect(changed).toBe(true);
    expect(markdown).toContain('Source: [`fd5bfb4`](https://github.com/stdlib-js/stdlib/commit/fd5bfb49cac0b48b994a163effb4c3a1cc14d81d) → [`455f0d5`]');
    expect(markdown).toContain('| packages | 4 | 4 | 0 |');
    expect(markdown).toContain('| runtime edges | 1 | 2 | +1 |');
    expect(markdown).toContain('**Added (1)**: `a/new`');
    expect(markdown).toContain('**Removed (1)**: `a/gone`');
  });

  it('caps each list at 50 ids', () => {
    const many = Array.from({ length: 60 }, (_, i) => pkg(`n/p${String(i).padStart(2, '0')}`));
    const { markdown } = diffGraphFiles(buildGraphFile([pkg('a/x')], OLD), buildGraphFile([pkg('a/x'), ...many], NEW));
    expect(markdown).toContain('**Added (61)**, first 50: ');
    expect(markdown.match(/`n[^`]*`/g)).toHaveLength(50); // the n folder plus n/p00 … n/p48
  });
});
