import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash } from './router';

describe('parseHash', () => {
  it('parses the home route', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#')).toEqual({ kind: 'home' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
  });
  it('parses explore routes', () => {
    expect(parseHash('#/explore')).toEqual({ kind: 'explore', path: '' });
    expect(parseHash('#/explore/math/base')).toEqual({ kind: 'explore', path: 'math/base' });
  });
  it('parses module routes with edge kinds, defaulting to runtime', () => {
    expect(parseHash('#/module/math/base/special/logf')).toEqual({ kind: 'module', id: 'math/base/special/logf', edges: ['runtime'] });
    expect(parseHash('#/module/x?edges=runtime,native')).toEqual({ kind: 'module', id: 'x', edges: ['runtime', 'native'] });
    expect(parseHash('#/module/x?edges=bogus')).toEqual({ kind: 'module', id: 'x', edges: ['runtime'] });
  });
  it('treats a bare /module as home', () => {
    expect(parseHash('#/module')).toEqual({ kind: 'home' });
  });
});

describe('formatRoute', () => {
  it('round-trips every route shape', () => {
    for (const h of [
      '#/',
      '#/explore',
      '#/explore/math/base',
      '#/module/math/base/special/logf',
      '#/module/x?edges=runtime,dev',
    ]) {
      expect(formatRoute(parseHash(h))).toBe(h);
    }
  });
});
