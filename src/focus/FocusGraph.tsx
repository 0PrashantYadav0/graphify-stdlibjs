import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { navigate } from '../app/router';
import { GraphCanvas } from '../graphview/GraphCanvas';
import { TreeLayer, type GraphNodeLike } from '../graphview/TreeLayer';
import { buildSide, focusChildren, type FocusNode } from './focusModel';

interface Props {
  graph: Graph;
  index: number;
  requires: number[];
  requiredBy: number[];
}

export function FocusGraph({ graph, index, requires, requiredBy }: Props) {
  const left = useMemo(() => buildSide(graph, 'requires', requires), [graph, requires]);
  const right = useMemo(() => buildSide(graph, 'requiredBy', requiredBy), [graph, requiredBy]);
  const centre = useMemo<FocusNode>(
    () => ({ key: 'centre', label: graph.name(index), path: graph.ids[index], index, kind: 'centre', hasChildren: false, count: 0, children: [] }),
    [graph, index],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([...left.defaultExpanded, ...right.defaultExpanded]));
  useEffect(() => {
    setExpanded(new Set([...left.defaultExpanded, ...right.defaultExpanded]));
  }, [left, right]);

  const toggle = (n: GraphNodeLike) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.key)) next.delete(n.key);
      else next.add(n.key);
      return next;
    });
  const open = (n: GraphNodeLike) => {
    if (n.index >= 0) navigate({ kind: 'module', id: graph.ids[n.index], edges: ['runtime'] });
  };
  const mask = useCallback((n: GraphNodeLike) => (n.index >= 0 ? graph.tags[n.index] : 0), [graph]);
  const leftRoot = useMemo<FocusNode>(() => ({ ...centre, hasChildren: left.root.children.length > 0, count: left.root.count, children: left.root.children }), [centre, left]);
  const rightRoot = useMemo<FocusNode>(() => ({ ...centre, hasChildren: right.root.children.length > 0, count: right.root.count, children: right.root.children }), [centre, right]);
  const expandedWithCentre = useMemo(() => new Set([...expanded, 'centre']), [expanded]);

  return (
    <GraphCanvas focusPoint={{ x: 0, y: 0 }} anchor={0.5} label="dependency graph" className="focus-canvas">
      <TreeLayer root={leftRoot} childrenOf={focusChildren} expanded={expandedWithCentre} direction="left" selectedKey={null} pathKeys={new Set()} onToggle={toggle} onOpen={open} getTagMask={mask} hideRoot />
      <TreeLayer root={rightRoot} childrenOf={focusChildren} expanded={expandedWithCentre} direction="right" selectedKey="centre" pathKeys={new Set()} onToggle={toggle} onOpen={open} getTagMask={mask} />
    </GraphCanvas>
  );
}
