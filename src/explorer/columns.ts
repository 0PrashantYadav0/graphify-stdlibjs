import type { Graph } from '../graph/Graph';
import { clusterSiblings, type SiblingItem } from '../graph/clusterSiblings';

export interface ColumnItem {
  kind: 'package' | 'group';
  label: string;
  /** Graph index for packages; -1 for groups. */
  index: number;
  /** Group prefix; '' for packages. */
  prefix: string;
  /** Group member indexes; [] for packages. */
  members: number[];
  selected: boolean;
}

export interface ColumnModel {
  key: string;
  title: string;
  parentIndex: number;
  parentId: string;
  total: number;
  items: ColumnItem[];
}

function toItem(c: SiblingItem, byName: Map<string, number>, nextSeg: string | null): ColumnItem {
  if (c.kind === 'single') {
    return { kind: 'package', label: c.name, index: byName.get(c.name)!, prefix: '', members: [], selected: c.name === nextSeg };
  }
  return {
    kind: 'group',
    label: `${c.prefix}…`,
    index: -1,
    prefix: c.prefix,
    members: c.members.map((m) => byName.get(m)!),
    selected: nextSeg !== null && c.members.includes(nextSeg),
  };
}

export function columnsForRoute(graph: Graph, path: string, group: string | null): ColumnModel[] {
  const segs = path ? path.split('/') : [];
  const columns: ColumnModel[] = [];
  let parentIndex = -1;
  let parentId = '';
  for (let depth = 0; depth <= segs.length; depth++) {
    const nextSeg = segs[depth] ?? null;
    const byName = new Map(graph.children(parentIndex).map((i) => [graph.name(i), i]));
    const items = clusterSiblings([...byName.keys()]).map((c) => toItem(c, byName, nextSeg));
    columns.push({
      key: parentId || '~root',
      title: parentIndex < 0 ? 'stdlib' : graph.name(parentIndex),
      parentIndex,
      parentId,
      total: graph.descendantCount(parentIndex),
      items,
    });
    const openGroup = items.find(
      (it) => it.kind === 'group' && (it.selected || (nextSeg === null && group !== null && it.prefix === group)),
    );
    if (openGroup) {
      openGroup.selected = true;
      columns.push({
        key: `${parentId}/~${openGroup.prefix}`,
        title: `${openGroup.prefix}…`,
        parentIndex,
        parentId,
        total: openGroup.members.length,
        items: openGroup.members.map((i) => ({
          kind: 'package',
          label: graph.name(i),
          index: i,
          prefix: '',
          members: [],
          selected: graph.name(i) === nextSeg,
        })),
      });
    }
    if (nextSeg === null) break;
    const nextIndex = byName.get(nextSeg);
    if (nextIndex === undefined) break;
    parentIndex = nextIndex;
    parentId = parentId ? `${parentId}/${nextSeg}` : nextSeg;
  }
  return columns;
}
