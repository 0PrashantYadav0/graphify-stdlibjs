import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash, routes, type Route } from './router';

const mod = (id: string, edges = ['runtime'], view = 'direct', dir = 'out') => ({ kind: 'module', id, edges, view, dir });

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
  it('still reads old module URLs the same way', () => {
    expect(parseHash('#/module/math/base/special/logf')).toEqual(mod('math/base/special/logf'));
    expect(parseHash('#/module/x?edges=runtime,native')).toEqual(mod('x', ['runtime', 'native']));
    expect(parseHash('#/module/x?edges=bogus')).toEqual(mod('x'));
  });
  it('normalises edge kinds: de-duplicated, in EDGE_KINDS order, none meaning runtime', () => {
    expect(parseHash('#/module/x?edges=native,dev,native')).toEqual(mod('x', ['dev', 'native']));
    expect(parseHash('#/module/x?edges=')).toEqual(mod('x'));
  });
  it('reads view and dir, falling back to the defaults', () => {
    expect(parseHash('#/module/ndarray/ctor?view=webbed&dir=in&edges=runtime,native')).toEqual(mod('ndarray/ctor', ['runtime', 'native'], 'webbed', 'in'));
    expect(parseHash('#/module/x?view=nope&dir=sideways')).toEqual(mod('x'));
  });
  it('treats a bare /module as home', () => {
    expect(parseHash('#/module')).toEqual({ kind: 'home' });
  });
});

describe('routes', () => {
  it('applies the defaults the router owns', () => {
    expect(routes.module('x')).toEqual(mod('x'));
    expect(routes.module('x', { edges: ['native', 'runtime'] }).edges).toEqual(['runtime', 'native']);
    expect(routes.explore()).toEqual({ kind: 'explore', path: '' });
  });
});

describe('formatRoute', () => {
  it('leaves defaults out of the URL', () => {
    expect(formatRoute(routes.module('a/b'))).toBe('#/module/a/b');
    expect(formatRoute(routes.module('a/b', { view: 'webbed', dir: 'in', edges: ['native', 'runtime'] }))).toBe('#/module/a/b?view=webbed&dir=in&edges=runtime,native');
  });

  it('round-trips: parse(format(r)) equals r for every normalised route', () => {
    const ids = ['math/base/special/logf', 'a b/c', 'odd?id/with#hash', '100%/x&y=z', 'ünï/cödé'];
    const table: Route[] = [routes.home(), routes.explore(), ...ids.map((id) => routes.explore(id))];
    for (const id of ids)
      for (const edges of [['runtime'], ['dev'], ['runtime', 'dev', 'native']])
        for (const view of ['direct', 'webbed'] as const)
          for (const dir of ['out', 'in'] as const) table.push(routes.module(id, { edges, view, dir }));
    for (const r of table) expect(parseHash(formatRoute(r))).toEqual(r);
  });
});
