import { useEffect, useState } from 'react';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';

/** What the module route shows: direct neighbours, or the whole web. */
export type View = 'direct' | 'webbed';
/** Which way the web runs: what the package requires (out) or what requires it (in). */
export type WebDir = 'out' | 'in';

export type ModuleRoute = { kind: 'module'; id: string; edges: EdgeKind[]; view: View; dir: WebDir };
export type Route = { kind: 'home' } | { kind: 'explore'; path: string } | ModuleRoute;

/**
 * The only way to build a route. Callers pass what they mean; defaults and canonical form
 * live here: edge kinds de-duplicated in EDGE_KINDS order, none at all meaning runtime.
 */
export const routes = {
  home: (): Route => ({ kind: 'home' }),
  explore: (path = ''): Route => ({ kind: 'explore', path }),
  module: (id: string, opts: { edges?: readonly string[]; view?: View; dir?: WebDir } = {}): ModuleRoute => {
    const edges = EDGE_KINDS.filter((k) => opts.edges?.includes(k));
    return { kind: 'module', id, edges: edges.length ? edges : ['runtime'], view: opts.view ?? 'direct', dir: opts.dir ?? 'out' };
  },
};

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  if (segs.length === 0) return routes.home();
  if (segs[0] === 'module' && segs.length > 1) {
    return routes.module(segs.slice(1).join('/'), {
      edges: params.get('edges')?.split(','),
      view: params.get('view') === 'webbed' ? 'webbed' : 'direct',
      dir: params.get('dir') === 'in' ? 'in' : 'out',
    });
  }
  if (segs[0] === 'explore') return routes.explore(segs.slice(1).join('/'));
  return routes.home();
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Defaults are left out of the URL, so `#/module/<id>` stays the plain link. */
export function formatRoute(r: Route): string {
  if (r.kind === 'home') return '#/';
  if (r.kind === 'explore') return r.path ? `#/explore/${encodePath(r.path)}` : '#/explore';
  const query = [
    r.view !== 'direct' && `view=${r.view}`,
    r.dir !== 'out' && `dir=${r.dir}`,
    (r.edges.length !== 1 || r.edges[0] !== 'runtime') && `edges=${r.edges.join(',')}`,
  ].filter(Boolean);
  return `#/module/${encodePath(r.id)}${query.length ? `?${query.join('&')}` : ''}`;
}

export function navigate(r: Route): void {
  window.location.hash = formatRoute(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
