import { useEffect, useState } from 'react';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';

export type Route =
  | { kind: 'home' }
  | { kind: 'explore'; path: string }
  | { kind: 'module'; id: string; edges: EdgeKind[] };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  if (segs.length === 0) return { kind: 'home' };
  if (segs[0] === 'module' && segs.length > 1) {
    const edges = (params.get('edges') ?? 'runtime')
      .split(',')
      .filter((k): k is EdgeKind => (EDGE_KINDS as string[]).includes(k));
    return { kind: 'module', id: segs.slice(1).join('/'), edges: edges.length ? edges : ['runtime'] };
  }
  if (segs[0] === 'explore') return { kind: 'explore', path: segs.slice(1).join('/') };
  return { kind: 'home' };
}

export function formatRoute(r: Route): string {
  if (r.kind === 'home') return '#/';
  if (r.kind === 'module') {
    const onlyRuntime = r.edges.length === 1 && r.edges[0] === 'runtime';
    return `#/module/${r.id}${onlyRuntime ? '' : `?edges=${r.edges.join(',')}`}`;
  }
  return r.path ? `#/explore/${r.path}` : '#/explore';
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
