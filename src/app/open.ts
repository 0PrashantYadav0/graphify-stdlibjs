import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import type { EdgeKind } from '../graph/types';
import { routes, type Route } from './router';

/**
 * Where opening a package goes, the same from search, the explorer and the focus view: a
 * bookkeeping folder has no module view of its own, so it opens in the explorer.
 */
export function routeForPackage(graph: Graph, index: number, edges?: readonly EdgeKind[]): Route {
  const id = graph.ids[index];
  return hasTag(graph.tags[index], 'FOLDER') ? routes.explore(id) : routes.module(id, { edges });
}
