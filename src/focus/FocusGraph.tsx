import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { formatRoute, navigate, routes } from '../app/router';
import type { EdgeKind } from '../graph/types';
import { GraphCanvas } from '../graphview/GraphCanvas';
import type { LayoutResult } from '../graphview/layout';
import { TreeLayer, type GraphNodeLike } from '../graphview/TreeLayer';
import { useExpansion } from '../graphview/useExpansion';
import { routeForPackage } from '../app/open';
import { buildSide, CENTRE_KEY, centreNode, focusChildren, type FocusNode } from './focusModel';

interface Props {
  graph: Graph;
  index: number;
  /** Kept on every hop, so a neighbour opens with the same edge kinds switched on. */
  edges: EdgeKind[];
  requires: number[];
  requiredBy: number[];
}

// Node labels are 13px; at this scale they render at 11px, the smallest the first view may show.
const MIN_READABLE_K = 11 / 13;
const fmt = new Intl.NumberFormat('en-US');

export function FocusGraph({ graph, index, edges, requires, requiredBy }: Props) {
  const left = useMemo(() => buildSide(graph, 'requires', requires), [graph, requires]);
  const right = useMemo(() => buildSide(graph, 'requiredBy', requiredBy), [graph, requiredBy]);
  const centre = useMemo(() => centreNode(graph, index), [graph, index]);
  const { expanded, toggle, reset } = useExpansion([...left.defaultExpanded, ...right.defaultExpanded]);
  useEffect(() => {
    reset([...left.defaultExpanded, ...right.defaultExpanded]);
  }, [left, right, reset]);

  const onToggle = (n: GraphNodeLike) => void toggle(n.key);
  const open = (n: GraphNodeLike) => {
    if (n.index >= 0) navigate(routeForPackage(graph, n.index, edges));
  };
  const leftRoot = useMemo<FocusNode>(() => ({ ...centre, hasChildren: left.root.children.length > 0, count: left.root.count, children: left.root.children }), [centre, left]);
  const rightRoot = useMemo<FocusNode>(() => ({ ...centre, hasChildren: right.root.children.length > 0, count: right.root.count, children: right.root.children }), [centre, right]);
  const expandedWithCentre = useMemo(() => new Set([...expanded, CENTRE_KEY]), [expanded]);

  const [leftBounds, setLeftBounds] = useState<{ minX: number; minY: number; maxY: number } | null>(null);
  const [rightBounds, setRightBounds] = useState<{ maxX: number; minY: number; maxY: number } | null>(null);
  const onLeftLayout = useCallback((r: LayoutResult<FocusNode>) => setLeftBounds({ minX: r.minX, minY: r.minY, maxY: r.maxY }), []);
  const onRightLayout = useCallback((r: LayoutResult<FocusNode>) => setRightBounds({ maxX: r.maxX, minY: r.minY, maxY: r.maxY }), []);
  const fitRange = leftBounds && rightBounds
    ? {
        x0: leftBounds.minX,
        x1: rightBounds.maxX,
        x: 0,
        y: 0,
        y0: Math.min(leftBounds.minY, rightBounds.minY),
        y1: Math.max(leftBounds.maxY, rightBounds.maxY),
      }
    : null;

  // One line over each side: how much is there, and the way to all of it.
  const summary = (side: 'requires' | 'requiredBy', list: number[]) => {
    if (list.length === 0) return null;
    const namespaces = new Set(list.map((i) => graph.ids[i].split('/')[0])).size;
    const all = graph.webSize(index, { kinds: edges, dir: side });
    return (
      <p className={`focus-summary is-${side === 'requires' ? 'left' : 'right'}`}>
        {fmt.format(list.length)} {list.length === 1 ? 'package' : 'packages'} in {namespaces} {namespaces === 1 ? 'namespace' : 'namespaces'} ·{' '}
        <a href={formatRoute(routes.module(graph.ids[index], { edges, view: 'webbed', dir: side === 'requires' ? 'out' : 'in' }))}>Webbed shows all {fmt.format(all)}</a>
      </p>
    );
  };

  return (
    <div className="focus-stage">
      <div className="focus-summaries">
        {summary('requires', requires) ?? <span />}
        {summary('requiredBy', requiredBy)}
      </div>
      <GraphCanvas focusPoint={null} fitRange={fitRange} minFitScale={MIN_READABLE_K} label="dependency graph" className="focus-canvas">
        <TreeLayer root={leftRoot} childrenOf={focusChildren} expanded={expandedWithCentre} direction="left" selectedKey={null} onToggle={onToggle} onOpen={open} label="requires" hideRoot onLayout={onLeftLayout} />
        <TreeLayer root={rightRoot} childrenOf={focusChildren} expanded={expandedWithCentre} direction="right" selectedKey={CENTRE_KEY} onToggle={onToggle} onOpen={open} label="required by" onLayout={onRightLayout} />
      </GraphCanvas>
    </div>
  );
}
