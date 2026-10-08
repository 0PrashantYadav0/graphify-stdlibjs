import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EdgeQuery, Graph } from '../graph/Graph';
import { formatRoute, navigate, routes, type ModuleRoute } from '../app/router';
import { TagPills } from '../ui/TagPills';
import { webColumns, webLinks } from './webModel';
import './webbed.css';

const PAGE = 200;
const fmt = new Intl.NumberFormat('en-US');
const steps = (d: number) => (d === 1 ? '1 step' : `${d} steps`);

/** Every package in the web, once, in columns by distance. Keyboard model: ADR-0004. */
export function Webbed({ graph, index, route }: { graph: Graph; index: number; route: ModuleRoute }) {
  const { edges, dir } = route;
  const q = useMemo<EdgeQuery>(() => ({ kinds: edges, dir: dir === 'out' ? 'requires' : 'requiredBy' }), [edges, dir]);
  const web = useMemo(() => graph.web(index, q), [graph, index, q]);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, number>>({});
  const strata = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);

  // A new centre, direction or set of edge kinds is a new web: start over.
  useEffect(() => {
    setSel(null);
    setPages({});
  }, [web]);

  const needle = filter.trim().toLowerCase();
  const cols = useMemo(() => webColumns(web, index, needle ? (j) => graph.ids[j].includes(needle) : undefined), [web, index, needle, graph]);
  const links = useMemo(() => (sel === null ? null : webLinks(graph, web, q, sel)), [graph, web, q, sel]);
  const chain = useMemo(() => (sel === null ? [] : sel === index ? [index] : web.chain(sel)), [web, sel, index]);
  const onChain = useMemo(() => new Set(chain), [chain]);
  const linkedIn = (rows: number[]) => (links ? rows.filter((j) => links.up.has(j) || links.down.has(j)) : []);

  const tabStop = sel !== null && cols[web.depth[sel]]?.rows.includes(sel) ? sel : index;
  const word = dir === 'out' ? 'out' : 'in';

  // Keyboard moves focus to the newly selected row; a click already put it there.
  useLayoutEffect(() => {
    if (!keyboard.current || sel === null) return;
    keyboard.current = false;
    strata.current?.querySelector<HTMLElement>(`[data-index="${sel}"]`)?.focus();
  }, [sel]);

  // Bring each column's first linked row into view (no animation: ADR-0004).
  useLayoutEffect(() => {
    if (!links || !strata.current) return;
    for (const list of strata.current.querySelectorAll<HTMLElement>('.web-rows')) {
      const row = list.querySelector<HTMLElement>('.is-up, .is-down');
      if (!row) continue;
      const top = row.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, top - 24);
    }
  }, [links]);

  const select = (j: number, viaKeyboard = false) => {
    keyboard.current = viaKeyboard;
    setSel(j);
  };

  const onKey = (e: KeyboardEvent, c: number, pos: number) => {
    const rows = cols[c].rows;
    const j = rows[pos];
    let next: number | undefined;
    if (e.key === 'ArrowDown') next = rows[Math.min(pos + 1, rows.length - 1)];
    else if (e.key === 'ArrowUp') next = rows[Math.max(pos - 1, 0)];
    else if (e.key === 'Home') next = rows[0];
    else if (e.key === 'End') next = rows[rows.length - 1];
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const step = e.key === 'ArrowRight' ? 1 : -1;
      let t = c + step;
      while (cols[t] && cols[t].rows.length === 0) t += step;
      if (!cols[t]) return;
      const near = webLinks(graph, web, q, j)[step > 0 ? 'down' : 'up'];
      next = cols[t].rows.find((r) => near.has(r)) ?? cols[t].rows[Math.min(pos, cols[t].rows.length - 1)];
    } else if (e.key === 'Enter') {
      navigate(e.shiftKey ? routes.module(graph.ids[j], { edges }) : routes.module(graph.ids[j], { edges, dir, view: 'webbed' }));
    } else return;
    e.preventDefault();
    if (next !== undefined) select(next, true);
  };

  const selId = sel === null ? null : graph.ids[sel];

  return (
    <div className="web">
      <div className="web-bar">
        <div className="edge-toggle" role="group" aria-label="direction">
          {(['out', 'in'] as const).map((d) => (
            <button key={d} type="button" aria-pressed={dir === d} className={dir === d ? 'is-on' : ''} onClick={() => navigate(routes.module(graph.ids[index], { ...route, dir: d }))}>
              {d === 'out' ? 'What it requires' : 'What requires it'}
            </button>
          ))}
        </div>
        <p className="web-summary">
          {web.size === 0
            ? dir === 'out'
              ? 'Requires nothing through these edge kinds.'
              : 'Nothing requires it through these edge kinds.'
            : `${fmt.format(web.size)} ${web.size === 1 ? 'package' : 'packages'}, ${steps(web.maxDepth)} deep`}
        </p>
        <input className="web-filter mono" type="search" placeholder="Filter…" aria-label="Filter the web by id" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div className="web-strata" ref={strata}>
        {cols.map((col, c) => {
          const linked = linkedIn(col.rows).length;
          const label = c === 0 ? 'this package' : `${fmt.format(col.total)} ${col.total === 1 ? 'package' : 'packages'}, ${steps(c)} ${word}`;
          const selPos = sel === null ? -1 : col.rows.indexOf(sel);
          const firstLinked = links ? col.rows.findIndex((j) => links.up.has(j) || links.down.has(j)) : -1;
          const shown = Math.max((pages[c] ?? 1) * PAGE, selPos + 1, firstLinked + 1);
          return (
            <section key={c} className={`web-col${c === 0 ? ' is-centre' : ''}`}>
              <h2 className="web-head" id={`web-col-${c}`}>
                {c === 0 ? (
                  'this package'
                ) : (
                  <>
                    <b className="mono">{needle ? `${fmt.format(col.rows.length)} of ${fmt.format(col.total)}` : fmt.format(col.total)}</b>
                    {c === 1 ? 'direct' : `${steps(c)} ${word}`}
                    {linked > 0 && <span className="web-linked">{linked} linked</span>}
                  </>
                )}
              </h2>
              <ul className="web-rows" role="listbox" aria-label={label}>
                {col.rows.slice(0, shown).map((j, pos) => {
                  const id = graph.ids[j];
                  const cut = id.lastIndexOf('/');
                  const own = c === 0 ? web.size : graph.webSize(j, q);
                  const state =
                    sel === null
                      ? ''
                      : j === sel
                        ? ' is-sel'
                        : links?.down.has(j)
                          ? ' is-down'
                          : links?.up.has(j)
                            ? ' is-up'
                            : onChain.has(j)
                              ? ' is-chain'
                              : ' is-dim';
                  return (
                    <li
                      key={j}
                      role="option"
                      aria-selected={j === sel}
                      aria-label={`${id}, ${fmt.format(own)} in its own web`}
                      tabIndex={j === tabStop ? 0 : -1}
                      data-index={j}
                      className={`web-row${state}`}
                      onClick={() => select(j)}
                      onKeyDown={(e) => onKey(e, c, pos)}
                    >
                      <span className="web-name mono">{id.slice(cut + 1)}</span>
                      {own > 0 && <span className="web-own mono">+{fmt.format(own)}</span>}
                      <TagPills mask={graph.tags[j]} />
                      {cut > 0 && <span className="web-ns mono">{id.slice(0, cut)}</span>}
                    </li>
                  );
                })}
              </ul>
              {col.rows.length > shown && (
                <button type="button" className="web-more" onClick={() => setPages((p) => ({ ...p, [c]: (p[c] ?? 1) + 1 }))}>
                  Show {fmt.format(Math.min(PAGE, col.rows.length - shown))} more ({fmt.format(col.rows.length - shown)} left)
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="web-why">
        <span className="web-why-label">Why it's here</span>
        <ol className="web-chain mono" aria-live="polite" aria-label="shortest chain">
          {selId === null ? (
            <li className="web-hint">Select a package to see the chain that brings it into the web.</li>
          ) : (
            chain.map((j) => <li key={j}>{graph.ids[j]}</li>)
          )}
        </ol>
        {selId !== null && sel !== index && (
          <p className="web-actions">
            <a href={formatRoute(routes.module(selId, { edges }))}>Focus on {graph.name(sel!)}</a>
            <a href={formatRoute(routes.module(selId, { edges, dir, view: 'webbed' }))}>Show its web</a>
          </p>
        )}
      </div>
    </div>
  );
}
