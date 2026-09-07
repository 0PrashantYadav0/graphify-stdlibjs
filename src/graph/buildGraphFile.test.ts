import { describe, expect, it } from 'vitest';
import { buildGraphFile } from './buildGraphFile';
import { Tag } from './tags';

const pkgs = [
  { id: 'math', desc: 'math', tags: Tag.JS, runtime: [], dev: [], native: [] },
  { id: 'math/base/special/logf', desc: 'logf', tags: Tag.JS | Tag.C, runtime: ['math/base/special/lnf'], dev: ['assert/is-nan'], native: ['math/base/napi/binary', 'math/base/special/lnf'] },
  { id: 'math/base/special/lnf', desc: 'lnf', tags: Tag.JS, runtime: [], dev: [], native: [] },
  { id: 'math/base/napi/binary', desc: 'binary', tags: Tag.C, runtime: [], dev: [], native: [] },
  { id: 'assert/is-nan', desc: 'isnan', tags: Tag.JS, runtime: [], dev: [], native: [] },
];

describe('buildGraphFile', () => {
  const file = buildGraphFile(pkgs, 'abc123');
  const at = (id: string) => file.ids.indexOf(id);

  it('sorts ids and synthesises missing folder nodes', () => {
    expect(file.ids).toEqual([
      'assert', 'assert/is-nan', 'math', 'math/base', 'math/base/napi', 'math/base/napi/binary',
      'math/base/special', 'math/base/special/lnf', 'math/base/special/logf',
    ]);
    expect(file.tags[at('assert')]).toBe(Tag.FOLDER | Tag.NAMESPACE);
    expect(file.desc[at('assert')]).toBe('');
  });

  it('marks packages that have children as namespaces', () => {
    expect(file.tags[at('math')]).toBe(Tag.JS | Tag.NAMESPACE);
    expect(file.tags[at('math/base/special/logf')]).toBe(Tag.JS | Tag.C);
  });

  it('builds CSR rows with sorted targets', () => {
    const i = at('math/base/special/logf');
    expect(file.runtime.offsets).toHaveLength(file.ids.length + 1);
    expect(file.runtime.targets.slice(file.runtime.offsets[i], file.runtime.offsets[i + 1])).toEqual([at('math/base/special/lnf')]);
    expect(file.dev.targets.slice(file.dev.offsets[i], file.dev.offsets[i + 1])).toEqual([at('assert/is-nan')]);
    expect(file.native.targets.slice(file.native.offsets[i], file.native.offsets[i + 1])).toEqual([at('math/base/napi/binary'), at('math/base/special/lnf')]);
    expect(file.native.targets).toHaveLength(2);
  });

  it('records the source and version', () => {
    expect(file.version).toBe(1);
    expect(file.source).toBe('abc123');
  });
});
