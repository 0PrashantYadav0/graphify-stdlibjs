export interface PathNode {
  /** Display label; may contain slashes when a chain was collapsed ("blas/base"). */
  label: string;
  /** Full package path of this node. */
  path: string;
  /** Node index in the Graph, or -1 when this is only a folder in the tree. */
  index: number;
  leafCount: number;
  children: PathNode[];
}

interface Raw {
  seg: string;
  path: string;
  index: number;
  children: Map<string, Raw>;
}

function finish(raw: Raw, isRoot: boolean): PathNode {
  let label = raw.seg;
  let node = raw;
  while (!isRoot && node.index < 0 && node.children.size === 1) {
    const only = [...node.children.values()][0];
    label = `${label}/${only.seg}`;
    node = only;
  }
  const children = [...node.children.values()].map((c) => finish(c, false));
  children.sort((a, b) => {
    const folderDiff = Number(b.children.length > 0) - Number(a.children.length > 0);
    return folderDiff !== 0 ? folderDiff : a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
  const leafCount = (node.index >= 0 ? 1 : 0) + children.reduce((s, c) => s + c.leafCount, 0);
  return { label, path: node.path, index: node.index, leafCount, children };
}

export function buildPathTree(ids: string[], indexOf: (id: string) => number): PathNode {
  const root: Raw = { seg: '', path: '', index: -1, children: new Map() };
  for (const id of ids) {
    let node = root;
    let acc = '';
    for (const seg of id.split('/')) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = node.children.get(seg);
      if (!next) {
        next = { seg, path: acc, index: -1, children: new Map() };
        node.children.set(seg, next);
      }
      node = next;
    }
    node.index = indexOf(id);
  }
  return finish(root, true);
}
