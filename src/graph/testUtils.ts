import { buildGraphFile } from './buildGraphFile';
import { Graph } from './Graph';
import { Tag } from './tags';
import type { EdgeKind } from './types';

export type EdgeList = Partial<Record<EdgeKind, Array<[string, string]>>>;

/** Build a Graph from package ids (all tagged JS) and optional [from, to] edge pairs per kind. */
export function graphFromIds(ids: string[], edges: EdgeList = {}): Graph {
  const pick = (kind: EdgeKind, id: string): string[] =>
    (edges[kind] ?? []).filter(([a]) => a === id).map(([, b]) => b);
  return new Graph(
    buildGraphFile(
      ids.map((id) => ({ id, desc: `${id} description`, tags: Tag.JS, runtime: pick('runtime', id), dev: pick('dev', id), native: pick('native', id) })),
      'test',
    ),
  );
}
