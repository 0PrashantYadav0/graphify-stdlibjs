import { useEffect, useRef } from 'react';
import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import { formatRoute } from '../app/router';
import { TagPills } from '../ui/TagPills';
import type { ColumnItem, ColumnModel } from './columns';

interface Props {
  graph: Graph;
  column: ColumnModel;
  /** True when a box in the previous column is selected and leads here. */
  connected: boolean;
  onSelect: (item: ColumnItem) => void;
}

const fmt = new Intl.NumberFormat('en-US');

export function Column({ graph, column, connected, onSelect }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (typeof selectedRef.current?.scrollIntoView === 'function') {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [column.key]);

  const isPackage = column.parentIndex >= 0 && !hasTag(graph.tags[column.parentIndex], 'FOLDER') && !column.key.includes('/~');

  return (
    <section className={`column${connected ? ' is-connected' : ''}`} aria-label={column.title}>
      <header className="column-head">
        <span className="column-title">{column.title}</span>
        <span className="column-meta">
          {isPackage && (
            <a className="column-open" href={formatRoute({ kind: 'module', id: column.parentId, edges: ['runtime'] })}>
              open
            </a>
          )}
          <span className="column-total">{fmt.format(column.total)}</span>
        </span>
      </header>
      <div className="column-list" role="listbox" aria-label={`${column.title} contents`}>
        {column.items.map((item) => {
          const isGroup = item.kind === 'group';
          const mask = isGroup ? 0 : graph.tags[item.index];
          const childCount = !isGroup && hasTag(mask, 'NAMESPACE') ? graph.children(item.index).length : 0;
          return (
            <button
              key={item.label}
              ref={item.selected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={item.selected}
              className={`box${item.selected ? ' is-selected' : ''}${isGroup ? ' is-group' : ''}`}
              onClick={() => onSelect(item)}
            >
              <span className="box-name">{item.label}</span>
              {isGroup ? (
                <span className="box-count">{item.members.length}</span>
              ) : (
                <>
                  <TagPills mask={mask} />
                  {childCount > 0 && <span className="box-count">{childCount} ›</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
