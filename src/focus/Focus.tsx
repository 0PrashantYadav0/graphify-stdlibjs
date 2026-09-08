import { useMemo } from 'react';
import type { Graph } from '../graph/Graph';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';
import { formatRoute, navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import { neighbourhood } from './neighbourhood';
import { FocusGraph } from './FocusGraph';
import './focus.css';

interface Props {
  graph: Graph;
  id: string;
  edges: EdgeKind[];
}

const KIND_LABEL: Record<EdgeKind, string> = { runtime: 'runtime', dev: 'dev', native: 'C' };
const FULL_SHA = /^[0-9a-f]{40}$/;

export function Focus({ graph, id, edges }: Props) {
  const index = graph.indexOf(id);
  const n = useMemo(() => (index >= 0 ? neighbourhood(graph, index, edges) : null), [graph, index, edges]);
  const ref = FULL_SHA.test(graph.source) ? graph.source : 'develop';
  const github = `https://github.com/stdlib-js/stdlib/tree/${ref}/lib/node_modules/@stdlib/`;

  if (index < 0 || !n) {
    return (
      <section className="focus-missing">
        <p>
          No package named <span className="mono">{id}</span>. <a href="#/explore">Browse from the top</a> or search with ⌘K.
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
      <header className="module-card">
        <div className="module-main">
          <a className="focus-back mono" href={formatRoute({ kind: 'explore', path: parent })}>‹ explore {parent || 'stdlib'}</a>
          <h1 className="module-id mono">{id}</h1>
          {graph.desc[index] && <p className="module-desc">{graph.desc[index]}</p>}
          <TagPills mask={graph.tags[index]} />
        </div>
        <div className="module-side">
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
            <a href={github + id} target="_blank" rel="noreferrer">Open on GitHub</a>
            <a href={formatRoute({ kind: 'explore', path: id })}>Browse inside</a>
          </p>
        </div>
      </header>
      <FocusGraph graph={graph} index={index} requires={n.requires} requiredBy={n.requiredBy} />
    </section>
  );
}
