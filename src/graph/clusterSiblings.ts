export type SiblingItem =
  | { kind: 'single'; name: string }
  | { kind: 'group'; prefix: string; members: string[] };

export interface ClusterOptions {
  /** Lists with this many names or fewer are never clustered. */
  threshold?: number;
  /** Minimum members for a group. */
  minGroup?: number;
  /** Minimum shared-prefix length for a group. */
  minPrefix?: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
  leaves: number;
}

function newNode(): TrieNode {
  return { children: new Map(), end: false, leaves: 0 };
}

function buildTrie(names: string[]): TrieNode {
  const root = newNode();
  for (const name of names) {
    let node = root;
    node.leaves++;
    for (const ch of name) {
      let next = node.children.get(ch);
      if (!next) {
        next = newNode();
        node.children.set(ch, next);
      }
      node = next;
      node.leaves++;
    }
    node.end = true;
  }
  return root;
}

function leavesOf(node: TrieNode, prefix: string, out: string[]): string[] {
  if (node.end) out.push(prefix);
  for (const [ch, child] of node.children) leavesOf(child, prefix + ch, out);
  return out;
}

function collect(node: TrieNode, prefix: string, out: SiblingItem[], minGroup: number, minPrefix: number, threshold: number): void {
  if (node.end) out.push({ kind: 'single', name: prefix });
  for (const [ch, child] of node.children) {
    if (child.leaves < minGroup) {
      for (const name of leavesOf(child, prefix + ch, [])) out.push({ kind: 'single', name });
      continue;
    }
    // follow the single-child chain so the prefix is as long as it can be
    let n = child;
    let p = prefix + ch;
    while (n.children.size === 1 && !n.end) {
      const [c, next] = [...n.children][0];
      p += c;
      n = next;
    }
    if (p.length >= minPrefix && n.leaves <= threshold) {
      out.push({ kind: 'group', prefix: p, members: leavesOf(n, p, []) });
    } else {
      collect(n, p, out, minGroup, minPrefix, threshold);
    }
  }
}

const label = (i: SiblingItem): string => (i.kind === 'single' ? i.name : i.prefix);

export function clusterSiblings(names: string[], opts: ClusterOptions = {}): SiblingItem[] {
  const { threshold = 24, minGroup = 3, minPrefix = 3 } = opts;
  const sorted = [...names].sort();
  if (sorted.length <= threshold) return sorted.map((name) => ({ kind: 'single', name }));
  const out: SiblingItem[] = [];
  collect(buildTrie(sorted), '', out, minGroup, minPrefix, threshold);
  return out.sort((a, b) => (label(a) < label(b) ? -1 : label(a) > label(b) ? 1 : 0));
}
