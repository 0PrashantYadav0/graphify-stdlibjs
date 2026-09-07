import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Tag } from '../../src/graph/tags';
import { detectTags, extractRequires, findPackageDirs, idFromDir, readNativeDeps, resolveSpec, scanAll } from './scan';

const ROOT = fileURLToPath(new URL('./__fixtures__/mini/@stdlib', import.meta.url));

describe('findPackageDirs', () => {
  it('finds every dir with a package.json, sorted, skipping lib/src/test dirs', () => {
    const ids = findPackageDirs(ROOT).map((d) => idFromDir(ROOT, d));
    expect(ids).toEqual([
      'assert',
      'assert/is-nan',
      'math',
      'math/base',
      'math/base/napi/binary',
      'math/base/special',
      'math/base/special/lnf',
      'math/base/special/logf',
    ]);
  });
});

describe('extractRequires', () => {
  it('collects @stdlib specs without the prefix, deduplicated', () => {
    const src = `var a = require( '@stdlib/x/y' );\nvar b = require("@stdlib/z");\nrequire('@stdlib/x/y');\nrequire('./local');`;
    expect(extractRequires(src)).toEqual(['x/y', 'z']);
  });
});

describe('resolveSpec', () => {
  const ids = new Set(['math/base/special/logf', 'assert/is-nan']);
  it('walks up to the longest known package prefix', () => {
    expect(resolveSpec('math/base/special/logf/lib/main.js', ids)).toBe('math/base/special/logf');
    expect(resolveSpec('@stdlib/assert/is-nan', ids)).toBe('assert/is-nan');
  });
  it('returns null for unknown packages', () => {
    expect(resolveSpec('utils/try-require', ids)).toBeNull();
  });
});

describe('detectTags / readNativeDeps', () => {
  it('reads tags from the filesystem layout', () => {
    expect(detectTags(`${ROOT}/math/base/special/logf`, {})).toBe(Tag.JS | Tag.C | Tag.NATIVE);
    expect(detectTags(`${ROOT}/math/base/special/lnf`, { __stdlib__: { wasm: {} } })).toBe(Tag.JS | Tag.C | Tag.NATIVE | Tag.WASM);
    expect(detectTags(`${ROOT}/assert/is-nan`, {})).toBe(Tag.JS | Tag.CLI);
    expect(detectTags(`${ROOT}/math/base/napi/binary`, {})).toBe(Tag.C);
  });
  it('reads only build-task dependencies from manifest.json', () => {
    expect(readNativeDeps(`${ROOT}/math/base/special/logf`)).toEqual(['math/base/napi/binary', 'math/base/special/lnf']);
    expect(readNativeDeps(`${ROOT}/assert/is-nan`)).toEqual([]);
  });
  it('includes confs with no task field (applies to all tasks)', () => {
    expect(readNativeDeps(`${ROOT}/math/base/napi/binary`)).toEqual(['math/base/special/lnf']);
  });
});

describe('scanAll', () => {
  const byId = new Map(scanAll(ROOT).map((p) => [p.id, p]));
  it('separates runtime, dev and native edges and drops unresolved/self requires', () => {
    const logf = byId.get('math/base/special/logf')!;
    expect([...logf.runtime]).toEqual(['math/base/special/lnf']);
    expect([...logf.dev]).toEqual(['assert/is-nan']);
    expect([...logf.native].sort()).toEqual(['math/base/napi/binary', 'math/base/special/lnf']);
    expect(logf.desc).toBe('Base b logarithm (float32).');
  });
  it('drops native deps that are not packages', () => {
    expect([...byId.get('math/base/special/lnf')!.native]).toEqual([]);
  });
  it('includes native deps from confs with no task field', () => {
    expect([...byId.get('math/base/napi/binary')!.native]).toEqual(['math/base/special/lnf']);
  });
});
