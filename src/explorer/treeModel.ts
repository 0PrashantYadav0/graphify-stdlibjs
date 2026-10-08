import type { Graph } from '../graph/Graph';
import { describePackage } from '../graphview/describe';
import { clusterSiblings } from '../graph/clusterSiblings';
import { groupVariants } from '../graph/variants';

export type NodeKind = 'root' | 'package' | 'operation' | 'variant' | 'cluster';

export interface TreeNode {
  key: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  /** Graph index for package nodes; -1 otherwise. */
  index: number;
  /** Packages reachable below this node (0 for a leaf package). */
  count: number;
  hasChildren: boolean;
  /** Tag bitmask (package nodes). */
  mask?: number;
  /** Full id and description, for the tooltip (package nodes). */
  title?: string;
}

export const ROOT: TreeNode = { key: 'root', kind: 'root', label: 'stdlib', index: -1, count: 0, hasChildren: true };

const CLUSTER_THRESHOLD = 24;

interface Member {
  index: number;
  sublabel: string;
}

/** The tree key of the package node for `id`. Group nodes (operation, variant, cluster) have their own. */
export const packageKey = (id: string): string => `p:${id}`;

/** The package a tree key names, or -1 for the root or a group node. */
export function indexOfKey(graph: Graph, key: string | null): number {
  return key?.startsWith('p:') ? graph.indexOf(key.slice(2)) : -1;
}

export function packageNode(graph: Graph, index: number, sublabel = ''): TreeNode {
  const count = graph.descendantCount(index);
  const node: TreeNode = {
    key: packageKey(graph.ids[index]),
    kind: 'package',
    label: graph.name(index),
    index,
    count,
    hasChildren: count > 0,
    mask: graph.tags[index],
    title: describePackage(graph, index, graph.ids[index]),
  };
  if (sublabel) node.sublabel = sublabel;
  return node;
}

export class TreeModel {
  private readonly cache = new Map<string, TreeNode[]>();
  private readonly members = new Map<string, Member[]>();

  constructor(private readonly graph: Graph) {}

  /** Children of a node. Operation/variant/cluster nodes must be reached through their parent first. */
  children(node: TreeNode): TreeNode[] {
    const hit = this.cache.get(node.key);
    if (hit) return hit;
    const out = node.kind === 'root' || node.kind === 'package' ? this.namespaceChildren(node) : this.memberChildren(node);
    this.cache.set(node.key, out);
    return out;
  }

  private namespaceChildren(node: TreeNode): TreeNode[] {
    const g = this.graph;
    const parentId = node.kind === 'root' ? '' : g.ids[node.index];
    const byName = new Map(g.children(node.index).map((i) => [g.name(i), i]));
    const { groups, singles } = groupVariants([...byName.keys()]);

    const operations: TreeNode[] = groups.map((grp) => {
      const key = `op:${parentId}:${grp.stem}`;
      const variants: TreeNode[] = grp.variants.map((v) => {
        const vkey = `v:${parentId}:${grp.stem}:${v.prefix}`;
        this.members.set(vkey, v.members.map((m) => ({ index: byName.get(m.name)!, sublabel: m.sublabel })));
        return { key: vkey, kind: 'variant', label: v.label, index: -1, count: v.members.length, hasChildren: true };
      });
      this.cache.set(key, variants);
      return { key, kind: 'operation', label: grp.stem, index: -1, count: grp.size, hasChildren: true };
    });

    const clusterable = node.kind !== 'root' && singles.length > CLUSTER_THRESHOLD;
    const items = clusterable ? clusterSiblings(singles) : singles.map((name) => ({ kind: 'single' as const, name }));
    const clusters: TreeNode[] = [];
    const packages: TreeNode[] = [];
    for (const item of items) {
      if (item.kind === 'single') {
        packages.push(packageNode(g, byName.get(item.name)!));
      } else {
        const ckey = `c:${parentId}:${item.prefix}`;
        this.members.set(ckey, item.members.map((m) => ({ index: byName.get(m)!, sublabel: '' })));
        clusters.push({ key: ckey, kind: 'cluster', label: `${item.prefix}…`, index: -1, count: item.members.length, hasChildren: true });
      }
    }
    return [...operations, ...clusters, ...packages];
  }

  private memberChildren(node: TreeNode): TreeNode[] {
    return (this.members.get(node.key) ?? []).map((m) => packageNode(this.graph, m.index, m.sublabel));
  }

  /**
   * Keys to expand so the package at `path` is visible, plus the key to select. `found` is
   * the longest prefix of `path` that exists; for a path that runs off the tree, that is
   * the closest match, and it is what gets selected.
   */
  expandPathFor(path: string): { expanded: string[]; selected: string | null; found: string } {
    const expanded = [ROOT.key];
    if (!path) return { expanded, selected: null, found: '' };
    let current = ROOT;
    const segs = path.split('/');
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const found = this.locate(current, seg);
      if (!found) {
        // expanded ends with the deepest package reached; select it, unless that is the root
        const last = current === ROOT ? null : current.key;
        return { expanded, selected: last, found: segs.slice(0, i).join('/') };
      }
      for (const via of found.via) expanded.push(via.key);
      if (i === segs.length - 1) {
        if (found.node.hasChildren) expanded.push(found.node.key);
        return { expanded, selected: found.node.key, found: path };
      }
      expanded.push(found.node.key);
      current = found.node;
    }
    return { expanded, selected: null, found: '' };
  }

  /** Find the package child named `name` under `parent`, recording the group nodes passed through. */
  private locate(parent: TreeNode, name: string): { node: TreeNode; via: TreeNode[] } | null {
    const wanted = packageKey(`${parent.kind === 'root' ? '' : `${this.graph.ids[parent.index]}/`}${name}`);
    for (const child of this.children(parent)) {
      if (child.kind === 'package') {
        if (child.key === wanted) return { node: child, via: [] };
        continue;
      }
      if (child.kind === 'operation') {
        for (const variant of this.children(child)) {
          const hit = this.children(variant).find((p) => p.key === wanted);
          if (hit) return { node: hit, via: [child, variant] };
        }
        continue;
      }
      const hit = this.children(child).find((p) => p.key === wanted);
      if (hit) return { node: hit, via: [child] };
    }
    return null;
  }
}
