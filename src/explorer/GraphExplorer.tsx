import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { formatRoute, navigate, routes } from '../app/router';
import { GraphCanvas, type Point } from '../graphview/GraphCanvas';
import { TreeLayer } from '../graphview/TreeLayer';
import type { LayoutResult } from '../graphview/layout';
import { useExpansion } from '../graphview/useExpansion';
import { routeForPackage } from '../app/open';
import { Breadcrumb } from './Breadcrumb';
import { indexOfKey, ROOT, TreeModel, type TreeNode } from './treeModel';
import './graph-explorer.css';

interface Props {
  graph: Graph;
  path: string;
}

export function GraphExplorer({ graph, path }: Props) {
  const model = useMemo(() => new TreeModel(graph), [graph]);
  const route = useMemo(() => model.expandPathFor(path), [model, path]);
  const { expanded, toggle, merge } = useExpansion(route.expanded);
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
    merge(route.expanded);
    setSelected(route.selected);
    setFocusKey(route.selected ?? route.expanded[route.expanded.length - 1]);
    setFocusMode('fit');
  }, [route, path, merge]);

  const childrenOf = useCallback((n: TreeNode) => model.children(n), [model]);
  const onLayout = useCallback((r: LayoutResult<TreeNode>) => {
    setPositions(new Map(r.nodes.map((n) => [n.data.key, { x: n.x, y: n.y }])));
  }, []);

  const pathKeys = useMemo(() => new Set(route.expanded.concat(route.selected ? [route.selected] : [])), [route]);

  const onToggle = (n: TreeNode) => {
    const opening = toggle(n.key);
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
    if (n.index >= 0) navigate(routeForPackage(graph, n.index));
  };

  // Esc from the tree leaves it for the breadcrumb's last link (#41).
  const onEscape = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !(e.target as Element).closest('[role="tree"]')) return;
    e.preventDefault();
    const crumbs = e.currentTarget.querySelectorAll<HTMLElement>('.breadcrumb a');
    crumbs[crumbs.length - 1]?.focus();
  };

  const selectedNode = indexOfKey(graph, selected);
  const openSelected = selectedNode >= 0 ? routeForPackage(graph, selectedNode) : null;
  const focusKeyPoint = focusKey ? positions.get(focusKey) ?? null : null;
  const focusPoint = focusMode === 'point' ? focusKeyPoint : null;
  const fitRange = focusMode === 'fit' && focusKeyPoint ? { x0: 0, x1: focusKeyPoint.x, y: focusKeyPoint.y } : null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- only catches Escape bubbling up from the tree inside; the section itself takes no input
    <section className="graph-explorer" onKeyDown={onEscape}>
      <div className="graph-explorer-head">
        <Breadcrumb path={route.found} />
        {route.found !== path && (
          <p className="graph-missing" role="status">
            No package at <span className="mono">{path}</span>; showing {route.found ? <>the closest match <span className="mono">{route.found}</span></> : 'the top'}.
          </p>
        )}
        {/* the explorer already shows a folder, so "Open" is only offered for a module view */}
        {openSelected?.kind === 'module' && (
          <a className="graph-open" href={formatRoute(openSelected)}>
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
          label="package tree"
          onLayout={onLayout}
        />
      </GraphCanvas>
    </section>
  );
}
