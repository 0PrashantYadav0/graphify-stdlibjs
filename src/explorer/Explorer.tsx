import { useEffect, useMemo, useRef } from 'react';
import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import { navigate } from '../app/router';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { columnsForRoute, type ColumnItem, type ColumnModel } from './columns';
import './explorer.css';

interface Props {
  graph: Graph;
  path: string;
  group: string | null;
}

export function Explorer({ graph, path, group }: Props) {
  const columns = useMemo(() => columnsForRoute(graph, path, group), [graph, path, group]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ left: el.scrollWidth });
  }, [columns.length]);

  const onSelect = (column: ColumnModel, item: ColumnItem) => {
    if (item.kind === 'group') {
      navigate({ kind: 'explore', path: column.parentId, group: item.prefix });
      return;
    }
    const id = graph.ids[item.index];
    if (hasTag(graph.tags[item.index], 'NAMESPACE')) navigate({ kind: 'explore', path: id, group: null });
    else navigate({ kind: 'module', id, edges: ['runtime'] });
  };

  return (
    <section className="explorer">
      <Breadcrumb path={path} group={group} />
      <div className="columns" ref={scroller}>
        {columns.map((column, i) => (
          <Column
            key={column.key}
            graph={graph}
            column={column}
            connected={i > 0 && columns[i - 1].items.some((it) => it.selected)}
            onSelect={(item) => onSelect(column, item)}
          />
        ))}
      </div>
    </section>
  );
}
