import { useEffect, useMemo, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';
import { formatRoute, navigate, routes, type ModuleRoute } from '../app/router';
import { hasTag } from '../graph/tags';
import { MOD_KEY } from '../search/useShortcut';
import { TagPills } from '../ui/TagPills';
import { Webbed } from '../webbed/Webbed';
import { impactSet } from '../webbed/impact';
import { didYouMean, requireSnippet } from './card';
import { FocusGraph } from './FocusGraph';
import './focus.css';

interface Props {
  graph: Graph;
  route: ModuleRoute;
}

// Same meaning as CONTEXT.md, "Edge kind".
const KIND_TITLE: Record<EdgeKind, string> = {
  runtime: 'runtime: needed to run',
  dev: 'dev: needed only by tests, benchmarks or examples',
  native: 'native: needed to build the C/Fortran add-on',
};
const fmt = new Intl.NumberFormat('en-US');

export function Focus({ graph, route }: Props) {
  const { id, edges } = route;
  const index = graph.indexOf(id);
  const n = useMemo(() => {
    if (index < 0) return null;
    const requires = graph.neighbours(index, { kinds: edges, dir: 'requires' });
    const requiredBy = graph.neighbours(index, { kinds: edges, dir: 'requiredBy' });
    const webOut = graph.webSize(index, { kinds: edges, dir: 'requires' });
    const webIn = graph.webSize(index, { kinds: edges, dir: 'requiredBy' });
    const impact = impactSet(graph, index);
    return { requires, requiredBy, webOut, webIn, impact };
  }, [graph, index, edges]);
  const ref = graph.provenance.commit ?? 'develop';
  const github = `https://github.com/stdlib-js/stdlib/tree/${ref}/lib/node_modules/@stdlib/`;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (index < 0 || !n) {
    const guesses = didYouMean(graph, id);
    return (
      <section className="focus-missing app-note">
        <p>
          No package named <span className="mono">{id}</span>.
          {guesses.length > 0 && (
            <>
              {' '}Did you mean{' '}
              {guesses.map((j, k) => (
                <span key={j}>
                  {k > 0 && (k === guesses.length - 1 ? ' or ' : ', ')}
                  <a className="mono" href={formatRoute(routes.module(graph.ids[j]))}>{graph.ids[j]}</a>
                </span>
              ))}
              ?
            </>
          )}
        </p>
        <p>
          <a href="#/explore">Browse from the top</a> or search with {MOD_KEY} K.
        </p>
      </section>
    );
  }

  const parent = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
  const folder = hasTag(graph.tags[index], 'FOLDER');
  const copy = () => navigator.clipboard?.writeText(requireSnippet(id)).then(() => setCopied(true), () => {});
  const toggleKind = (kind: EdgeKind) => {
    navigate(routes.module(id, { ...route, edges: edges.includes(kind) ? edges.filter((k) => k !== kind) : [...edges, kind] }));
  };

  // Esc from a tree or the Webbed columns leaves them for the module card (#41).
  const onEscape = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !(e.target as Element).closest('[role="tree"], [role="listbox"]')) return;
    e.preventDefault();
    e.currentTarget.querySelector<HTMLElement>('.focus-back')?.focus();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- only catches Escape bubbling up from the tree or listbox inside; the section itself takes no input
    <section className="focus" onKeyDown={onEscape}>
      <header className="module-card">
        <div className="module-main">
          <a className="focus-back mono" href={formatRoute(routes.explore(parent))}>‹ explore {parent || 'stdlib'}</a>
          <h1 className="module-id mono">{id}</h1>
          {graph.desc[index] && <p className="module-desc">{graph.desc[index]}</p>}
          <TagPills mask={graph.tags[index]} />
        </div>
        <div className="module-side">
          <ul className="module-facts">
            <li>
              Requires <b>{fmt.format(n.requires.length)}</b> <span className="module-web">/ {fmt.format(n.webOut)} in web</span>
            </li>
            <li>
              Required by <b>{fmt.format(n.requiredBy.length)}</b> <span className="module-web">/ {fmt.format(n.webIn)} in web</span>
            </li>
          </ul>
          <div className="module-controls">
            <div className="edge-toggle" role="group" aria-label="view">
              {(['direct', 'webbed'] as const).map((view) => (
                <button key={view} type="button" aria-pressed={route.view === view} className={route.view === view ? 'is-on' : ''} onClick={() => navigate(routes.module(id, { ...route, view }))}>
                  {view === 'direct' ? 'Direct' : 'Webbed'}
                </button>
              ))}
            </div>
            <div className="edge-toggle" role="group" aria-label="edge kinds">
              {EDGE_KINDS.map((kind) => (
                <button key={kind} type="button" title={KIND_TITLE[kind]} aria-pressed={edges.includes(kind)} className={edges.includes(kind) ? 'is-on' : ''} onClick={() => toggleKind(kind)}>
                  {kind}
                </button>
              ))}
            </div>
          </div>
          <p className="module-links">
            {!folder && (
              <>
                <button type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy require'}</button>
                <a href={`https://stdlib.io/docs/api/latest/@stdlib/${id}`} target="_blank" rel="noreferrer">Docs</a>
              </>
            )}
            <a href={github + id} target="_blank" rel="noreferrer">Open on GitHub</a>
            {!folder && (
              <a
                href={formatRoute(routes.module(id, { view: 'webbed', dir: 'in', edges: EDGE_KINDS }))}
                title={`If it changes: ${fmt.format(n.impact.runtime.length)} runtime · ${fmt.format(n.impact.rebuild.length)} rebuild · ${fmt.format(n.impact.tests.length)} tests`}
              >
                Impact <span className="module-web">{fmt.format(n.impact.runtime.length + n.impact.rebuild.length + n.impact.tests.length)}</span>
              </a>
            )}
            {hasTag(graph.tags[index], 'NAMESPACE') && <a href={formatRoute(routes.explore(id))}>Browse inside</a>}
          </p>
          <span className="sr-only" role="status">{copied ? 'Copied the require statement' : ''}</span>
        </div>
      </header>
      {route.view === 'webbed' ? (
        <Webbed key={index} graph={graph} index={index} route={route} />
      ) : (
        <FocusGraph graph={graph} index={index} edges={edges} requires={n.requires} requiredBy={n.requiredBy} />
      )}
    </section>
  );
}
