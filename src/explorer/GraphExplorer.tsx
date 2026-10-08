import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import { formatRoute, navigate, routes } from '../app/router';
import { GraphCanvas, type Point } from '../graphview/GraphCanvas';
import { TreeLayer } from '../graphview/TreeLayer';
import type { LayoutResult } from '../graphview/layout';
import { describePackage } from '../graphview/describe';
import { Breadcrumb } from './Breadcrumb';
import { ROOT, TreeModel, type TreeNode } from './treeModel';
import './graph-explorer.css';

interface Props {
  graph: Graph;
  path: string;
}

export function GraphExplorer({ graph, path }: Props) {
  const model = useMemo(() => new TreeModel(graph), [graph]);
  const route = useMemo(() => model.expandPathFor(path), [model, path]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(route.expanded));
  const [selected, setSelected] = useState<string | null>(route.selected);
  const [focusKey, setFocusKey] = useState<string | null>(route.selected ?? route.expanded[route.expanded.length - 1]);
  const [focusMode, setFocusMode] = useState<'fit' | 'point'>('fit');
  const [positions, setPositions] = useState<Map<string, Point>>(new Map());
  const rootNode = useMemo<TreeNode>(() => ({ ...ROOT, count: graph.n }), [graph]);
  // the path GraphExplorer itself just pushed via navigate(); a hashchange for it is our own
  // navigation catching up, not an external route change, and must not re-expand a node the
  // user has since collapsed.
  const lastNavigated = useRef<string | null>(null);

  // a route change from outside (breadcrumb, search, back button) merges into the local expansion
  useEffect(() => {
    if (lastNavigated.current === path) {
      lastNavigated.current = null;
      return;
    }
    setExpanded((prev) => new Set([...prev, ...route.expanded]));
    setSelected(route.selected);
    setFocusKey(route.selected ?? route.expanded[route.expanded.length - 1]);
    setFocusMode('fit');
  }, [route, path]);

  const childrenOf = useCallback((n: TreeNode) => model.children(n), [model]);
  const onLayout = useCallback((r: LayoutResult<TreeNode>) => {
    setPositions(new Map(r.nodes.map((n) => [n.data.key, { x: n.x, y: n.y }])));
  }, []);

  const pathKeys = useMemo(() => new Set(route.expanded.concat(route.selected ? [route.selected] : [])), [route]);

  const onToggle = (n: TreeNode) => {
    const opening = !expanded.has(n.key);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (opening) next.add(n.key);
      else next.delete(n.key);
      return next;
    });
    if (opening) {
      setFocusKey(n.key);
      setFocusMode('point');
    }
    if (n.kind === 'package') {
      setSelected(n.key);
      // Expanding and collapsing adjust the view, so they rewrite the current history entry
      // rather than add one: Back leaves the explorer instead of replaying every click.
      const id = graph.ids[n.index];
      const next = opening ? id : path.startsWith(`${id}/`) ? id : null;
      if (next !== null && next !== path) {
        lastNavigated.current = next;
        navigate(routes.explore(next), { replace: true });
      }
    }
  };

  const onOpen = (n: TreeNode) => {
    if (n.index >= 0) navigate(routes.module(graph.ids[n.index]));
  };

  const selectedNode = selected && selected.startsWith('p:') ? graph.indexOf(selected.slice(2)) : -1;
  const focusKeyPoint = focusKey ? positions.get(focusKey) ?? null : null;
  const focusPoint = focusMode === 'point' ? focusKeyPoint : null;
  const fitRange = focusMode === 'fit' && focusKeyPoint ? { x0: 0, x1: focusKeyPoint.x, y: focusKeyPoint.y } : null;

  return (
    <section className="graph-explorer">
      <div className="graph-explorer-head">
        <Breadcrumb path={route.found} />
        {route.found !== path && (
          <p className="graph-missing" role="status">
            No package at <span className="mono">{path}</span>; showing {route.found ? <>the closest match <span className="mono">{route.found}</span></> : 'the top'}.
          </p>
        )}
        {selectedNode >= 0 && !hasTag(graph.tags[selectedNode], 'FOLDER') && (
          <a className="graph-open" href={formatRoute(routes.module(graph.ids[selectedNode]))}>
            Open {graph.name(selectedNode)}
          </a>
        )}
      </div>
      <GraphCanvas focusPoint={focusPoint} fitRange={fitRange} label="package graph">
        <TreeLayer
          root={rootNode}
          childrenOf={childrenOf}
          expanded={expanded}
          direction="right"
          selectedKey={selected}
          pathKeys={pathKeys}
          onToggle={onToggle}
          onOpen={onOpen}
          getTagMask={(n) => graph.tags[n.index]}
          label="package tree"
          onLayout={onLayout}
          describe={(n) => describePackage(graph, n.index, n.label)}
        />
      </GraphCanvas>
    </section>
  );
}
