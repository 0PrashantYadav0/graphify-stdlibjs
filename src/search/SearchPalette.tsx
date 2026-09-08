import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { createSearch, highlightRange } from '../graph/search';
import { hasTag } from '../graph/tags';
import { navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import './search.css';

interface Props {
  graph: Graph;
  onClose: () => void;
}

function Highlighted({ id, query }: { id: string; query: string }) {
  const range = highlightRange(id, query);
  if (!range) return <>{id}</>;
  const [a, b] = range;
  return (
    <>
      {id.slice(0, a)}
      <mark>{id.slice(a, b)}</mark>
      {id.slice(b)}
    </>
  );
}

export function SearchPalette({ graph, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useMemo(() => createSearch(graph.ids), [graph]);
  const hits = useMemo(() => search(query, 12), [search, query]);

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
    const id = graph.ids[index];
    if (hasTag(graph.tags[index], 'FOLDER')) navigate({ kind: 'explore', path: id });
    else navigate({ kind: 'module', id, edges: ['runtime'] });
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      open(hits[active].index);
    }
  };

  const trimmed = query.trim();

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search packages" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input mono"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={hits.length ? 'palette-results' : undefined}
          aria-activedescendant={hits[active] ? `hit-${hits[active].index}` : undefined}
          aria-autocomplete="list"
          placeholder="Package name or path, e.g. logf or blas/base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {trimmed && hits.length === 0 && <p className="palette-empty muted">No package matches “{trimmed}”.</p>}
        {hits.length > 0 && (
          <ul id="palette-results" className="palette-results" role="listbox">
            {hits.map((h, i) => (
              <li
                key={h.index}
                id={`hit-${h.index}`}
                role="option"
                aria-selected={i === active}
                aria-label={graph.ids[h.index]}
                className={`palette-hit${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(h.index)}
              >
                <span className="palette-id mono">
                  <Highlighted id={graph.ids[h.index]} query={query} />
                </span>
                <TagPills mask={graph.tags[h.index]} />
              </li>
            ))}
          </ul>
        )}
        <p className="palette-hint muted">↑ ↓ to move, Enter to open, Esc to close</p>
      </div>
    </div>
  );
}
