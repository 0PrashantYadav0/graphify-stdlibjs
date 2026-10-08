import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { didYouMean, requireSnippet } from './card';

describe('requireSnippet', () => {
  it('names the binding after the last segment, camel-cased', () => {
    expect(requireSnippet('ndarray/ctor')).toBe("const ctor = require( '@stdlib/ndarray/ctor' );");
    expect(requireSnippet('assert/is-nan')).toBe("const isNan = require( '@stdlib/assert/is-nan' );");
  });
  it('keeps the binding a valid identifier', () => {
    expect(requireSnippet('utils/while')).toBe("const whileFn = require( '@stdlib/utils/while' );");
    expect(requireSnippet('math/2d')).toBe("const _2d = require( '@stdlib/math/2d' );");
  });
});

describe('didYouMean', () => {
  const g = graphFromIds(['ndarray/ctor', 'ndarray/base/ctor', 'bigint/ctor', 'array/base/vector', 'string/format', 'blas/ext/base/ndarray/ctril']);
  it('suggests from a typo in the last segment, nearest id first', () => {
    // a substring match on blas/ext/base/ndarray/ctril must not beat the one-letter fix
    expect(didYouMean(g, 'ndarray/ctr').map((i) => g.ids[i])).toEqual(['ndarray/ctor', 'ndarray/base/ctor', 'bigint/ctor']);
  });
  it('uses the whole id when it matches', () => {
    expect(didYouMean(g, 'format').map((i) => g.ids[i])[0]).toBe('string/format');
  });
});
