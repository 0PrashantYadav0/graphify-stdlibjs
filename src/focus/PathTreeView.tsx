import { useMemo, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { buildPathTree, type PathNode } from '../graph/pathTree';
import { formatRoute } from '../app/router';
import { TagPills } from '../ui/TagPills';

interface Props {
  graph: Graph;
  title: string;
  indexes: number[];
}

const COLLAPSE_ABOVE = 40;

export function PathTreeView({ graph, title, indexes }: Props) {
  const tree = useMemo(() => buildPathTree(indexes.map((i) => graph.ids[i]), (id) => graph.indexOf(id)), [graph, indexes]);
  const [closed, setClosed] = useState<Set<string>>(() => {
    // start with deep folders collapsed when the side is large
    const out = new Set<string>();
    if (tree.leafCount > COLLAPSE_ABOVE) {
      const walk = (n: PathNode, depth: number) => {
        if (depth >= 2 && n.children.length > 0) out.add(n.path);
        n.children.forEach((c) => walk(c, depth + 1));
      };
      tree.children.forEach((c) => walk(c, 1));
    }
    return out;
  });

  const toggle = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <section className="side">
      <h2 className="side-title">
        {title} · {indexes.length}
      </h2>
      {indexes.length === 0 ? (
        <p className="muted side-empty">None.</p>
      ) : (
        <ul className="tree">
          {tree.children.map((n) => (
            <TreeRow key={n.path} graph={graph} node={n} closed={closed} toggle={toggle} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RowProps {
  graph: Graph;
  node: PathNode;
  closed: Set<string>;
  toggle: (path: string) => void;
}

function TreeRow({ graph, node, closed, toggle }: RowProps) {
  const isFolder = node.children.length > 0;
  const isOpen = !closed.has(node.path);
  return (
    <li className="tree-row">
      <div className="tree-line">
        {isFolder && (
          <button type="button" className="tree-caret" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.label}`} onClick={() => toggle(node.path)}>
            {isOpen ? '▾' : '▸'}
          </button>
        )}
        {node.index >= 0 ? (
          <a className="tree-leaf" href={formatRoute({ kind: 'module', id: node.path, edges: ['runtime'] })}>
            <span className="mono">{graph.name(node.index)}</span>
            <TagPills mask={graph.tags[node.index]} />
          </a>
        ) : (
          <a className="tree-folder mono" href={formatRoute({ kind: 'explore', path: node.path, group: null })}>
            {node.label}
          </a>
        )}
        {isFolder && <span className="tree-count mono">{node.leafCount}</span>}
      </div>
      {isFolder && isOpen && (
        <ul className="tree">
          {node.children.map((c) => (
            <TreeRow key={c.path} graph={graph} node={c} closed={closed} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
