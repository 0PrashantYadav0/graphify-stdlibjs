import { useEffect, useState } from 'react';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';

export type Route =
  | { kind: 'explore'; path: string; group: string | null }
  | { kind: 'module'; id: string; edges: EdgeKind[] };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  if (segs[0] === 'module' && segs.length > 1) {
    const edges = (params.get('edges') ?? 'runtime')
      .split(',')
      .filter((k): k is EdgeKind => (EDGE_KINDS as string[]).includes(k));
    return { kind: 'module', id: segs.slice(1).join('/'), edges: edges.length ? edges : ['runtime'] };
  }
  const path = segs[0] === 'explore' ? segs.slice(1).join('/') : '';
  return { kind: 'explore', path, group: params.get('g') };
}

export function formatRoute(r: Route): string {
  if (r.kind === 'module') {
    const onlyRuntime = r.edges.length === 1 && r.edges[0] === 'runtime';
    return `#/module/${r.id}${onlyRuntime ? '' : `?edges=${r.edges.join(',')}`}`;
  }
  const base = r.path ? `#/explore/${r.path}` : '#/';
  return r.group ? `${base}?g=${encodeURIComponent(r.group)}` : base;
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
