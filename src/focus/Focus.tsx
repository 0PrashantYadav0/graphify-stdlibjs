import { useMemo } from 'react';
import type { Graph } from '../graph/Graph';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';
import { formatRoute, navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import { neighbourhood } from './neighbourhood';
import { PathTreeView } from './PathTreeView';
import './focus.css';

interface Props {
  graph: Graph;
  id: string;
  edges: EdgeKind[];
}

const KIND_LABEL: Record<EdgeKind, string> = { runtime: 'runtime', dev: 'dev', native: 'C' };
const GITHUB = 'https://github.com/stdlib-js/stdlib/tree/develop/lib/node_modules/@stdlib/';

export function Focus({ graph, id, edges }: Props) {
  const index = graph.indexOf(id);
  const n = useMemo(() => (index >= 0 ? neighbourhood(graph, index, edges) : null), [graph, index, edges]);

  if (index < 0 || !n) {
    return (
      <section className="focus-missing">
        <p>
          No package named <span className="mono">{id}</span>. <a href="#/">Browse from the top</a> or search with ⌘K.
        </p>
      </section>
    );
  }

  const parent = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
  const toggleKind = (kind: EdgeKind) => {
    const next = edges.includes(kind) ? edges.filter((k) => k !== kind) : EDGE_KINDS.filter((k) => k === kind || edges.includes(k));
    navigate({ kind: 'module', id, edges: next.length ? next : ['runtime'] });
  };

  return (
    <section className="focus">
      <a className="focus-back mono" href={formatRoute({ kind: 'explore', path: parent, group: null })}>
        ‹ explore {parent || 'stdlib'}
      </a>
      <div className="focus-grid">
        <PathTreeView key={`requires-${edges.join(',')}`} graph={graph} title="Requires" indexes={n.requires} />
        <article className="module-card">
          <h1 className="module-id mono">{id}</h1>
          {graph.desc[index] && <p className="module-desc">{graph.desc[index]}</p>}
          <TagPills mask={graph.tags[index]} />
          <ul className="module-facts">
            <li>Requires {n.requires.length}</li>
            <li>Required by {n.requiredBy.length}</li>
            <li>Connected {n.connected}</li>
          </ul>
          <div className="edge-toggle" role="group" aria-label="edge kinds">
            {EDGE_KINDS.map((kind) => (
              <button key={kind} type="button" aria-pressed={edges.includes(kind)} className={edges.includes(kind) ? 'is-on' : ''} onClick={() => toggleKind(kind)}>
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <p className="module-links">
            <a href={GITHUB + id} target="_blank" rel="noreferrer">Open on GitHub</a>
            <a href={formatRoute({ kind: 'explore', path: id, group: null })}>Browse inside</a>
          </p>
        </article>
        <PathTreeView key={`required-by-${edges.join(',')}`} graph={graph} title="Required by" indexes={n.requiredBy} />
      </div>
    </section>
  );
}
