import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../graph/Graph';
import type { Range } from '../graph/search';
import { routeForPackage } from '../app/open';
import { navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import './search.css';

interface Props {
  graph: Graph;
  onClose: () => void;
}

const LIMIT = 12;
const fmt = new Intl.NumberFormat('en-US');

/** Marks the ranges search scored on, so what is highlighted is exactly what matched. */
function Marked({ text, ranges }: { text: string; ranges: Range[] }) {
  const out = [];
  let at = 0;
  for (const [a, b] of ranges) {
    out.push(text.slice(at, a), <mark key={a}>{text.slice(a, b)}</mark>);
    at = b;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

export function SearchPalette({ graph, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { hits, total } = useMemo(() => graph.search(query, LIMIT), [graph, query]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, []);
  useEffect(() => {
    setActive(0);
  }, [query]);

  const open = (index: number) => {
    navigate(routeForPackage(graph, index));
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hits.length) setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      open(hits[active].index);
    }
  };

  // aria-modal promises nothing behind the sheet is reachable; the input is its only stop, so Tab stays on it.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    inputRef.current?.focus();
  };

  const trimmed = query.trim();

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the scrim closes on a pointer press; keyboard users close with Esc
    <div className="palette-backdrop" onMouseDown={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stops scrim presses from closing the sheet, and traps Tab inside the aria-modal dialog */}
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search packages" onMouseDown={(e) => e.stopPropagation()} onKeyDown={trapTab}>
        <input
          ref={inputRef}
          className="palette-input mono"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={hits.length ? 'palette-results' : undefined}
          aria-activedescendant={hits[active] ? `hit-${hits[active].index}` : undefined}
          aria-autocomplete="list"
          placeholder="Package name, path or description, e.g. logf or blas/base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {trimmed && hits.length === 0 && <p className="palette-empty muted">No package matches “{trimmed}”.</p>}
        {hits.length > 0 && (
          <ul id="palette-results" className="palette-results" role="listbox">
            {hits.map((h, i) => {
              const id = graph.ids[h.index];
              const desc = graph.desc[h.index];
              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- options are chosen from the combobox's keys (aria-activedescendant); click is the pointer path
                <li
                  key={h.index}
                  id={`hit-${h.index}`}
                  role="option"
                  aria-selected={i === active}
                  aria-label={desc ? `${id}, ${desc}` : id}
                  className={`palette-hit${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(h.index)}
                >
                  <span className="palette-text">
                    <span className="palette-id mono">{h.field === 'id' ? <Marked text={id} ranges={h.ranges} /> : id}</span>
                    {desc && <span className="palette-desc">{h.field === 'desc' ? <Marked text={desc} ranges={h.ranges} /> : desc}</span>}
                  </span>
                  <TagPills mask={graph.tags[h.index]} />
                </li>
              );
            })}
          </ul>
        )}
        <p className="palette-hint muted">
          {hits.length > 0 && <span className="palette-count">{fmt.format(hits.length)} of {fmt.format(total)} · </span>}
          ↑↓ to move · Enter to open · Esc to close · / also opens search
        </p>
      </div>
    </div>
  );
}
