import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutTree, linkPath, NODE_H, NODE_W, type Direction, type LayoutResult } from './layout';
import { pillsWidth, SvgPills } from './SvgPills';
import { useCanvasViewport } from './viewport';

export interface GraphNodeLike {
  key: string;
  label: string;
  sublabel?: string;
  hasChildren: boolean;
  count: number;
  index: number;
  kind: string;
}

interface Props<T extends GraphNodeLike> {
  root: T;
  childrenOf: (n: T) => T[];
  expanded: Set<string>;
  direction: Direction;
  selectedKey: string | null;
  pathKeys: Set<string>;
  onToggle: (n: T) => void;
  onOpen: (n: T) => void;
  getTagMask: (n: T) => number;
  /** Accessible name of the tree widget this layer renders. */
  label: string;
  hideRoot?: boolean;
  onLayout?: (result: LayoutResult<T>) => void;
}

const CHAR_W = 7.8;
const PAD_X = 10;

/** One rendered node, in the order Up/Down walks it: depth-first through what is visible. */
interface Row<T> {
  node: T;
  x: number;
  y: number;
  /** 1-based depth, per aria-level. */
  level: number;
  posinset: number;
  setsize: number;
  /** Key of the parent *row*; null for a top-level row (the hidden root's children count as top-level). */
  parentKey: string | null;
}

function truncate(text: string, maxPx: number): string {
  const max = Math.max(3, Math.floor(maxPx / CHAR_W));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function ariaLabelFor(n: GraphNodeLike): string {
  return n.hasChildren ? `${n.label}, ${n.count} package${n.count === 1 ? '' : 's'}` : n.label;
}

/**
 * Flattens the laid-out tree into visible display order.
 *
 * `layoutTree` walks breadth-first, which is the wrong order for a tree widget: Up/Down
 * step through the visible nodes depth-first, and aria-posinset counts siblings. Deriving
 * both from the layout (rather than re-walking `childrenOf`) keeps the keyboard order and
 * the ARIA numbers in lockstep with what is actually on screen.
 */
function toRows<T extends GraphNodeLike>(layout: LayoutResult<T>, rootKey: string, hideRoot: boolean): Row<T>[] {
  const byKey = new Map(layout.nodes.map((ln) => [ln.data.key, ln]));
  const childKeys = new Map<string, string[]>();
  for (const ln of layout.nodes) {
    if (ln.parentKey === null) continue;
    const siblings = childKeys.get(ln.parentKey);
    if (siblings) siblings.push(ln.data.key);
    else childKeys.set(ln.parentKey, [ln.data.key]);
  }
  const rows: Row<T>[] = [];
  const walk = (key: string, level: number, posinset: number, setsize: number, parentKey: string | null) => {
    const ln = byKey.get(key);
    if (!ln) return;
    rows.push({ node: ln.data, x: ln.x, y: ln.y, level, posinset, setsize, parentKey });
    const kids = childKeys.get(key) ?? [];
    kids.forEach((k, i) => walk(k, level + 1, i + 1, kids.length, key));
  };
  if (hideRoot) {
    const top = childKeys.get(rootKey) ?? [];
    top.forEach((k, i) => walk(k, 1, i + 1, top.length, null));
  } else {
    walk(rootKey, 1, 1, 1, null);
  }
  return rows;
}

export function TreeLayer<T extends GraphNodeLike>({ root, childrenOf, expanded, direction, selectedKey, pathKeys, onToggle, onOpen, getTagMask, label, hideRoot = false, onLayout }: Props<T>) {
  const layout = useMemo(() => layoutTree(root, childrenOf, (n) => expanded.has(n.key), direction), [root, childrenOf, expanded, direction]);
  const rows = useMemo(() => toRows(layout, root.key, hideRoot), [layout, root.key, hideRoot]);
  const treeRef = useRef<SVGGElement>(null);
  const viewport = useCanvasViewport();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // Roving tabindex: the tree is one tab stop. The remembered node holds it while it is
  // still on screen; otherwise the selected node does, and failing that the first row.
  const tabKey = useMemo(() => {
    const has = (key: string | null) => key !== null && rows.some((r) => r.node.key === key);
    if (has(focusedKey)) return focusedKey;
    if (has(selectedKey)) return selectedKey;
    return rows.length > 0 ? rows[0].node.key : null;
  }, [rows, focusedKey, selectedKey]);

  const focusRow = useCallback((row: Row<T> | undefined) => {
    if (!row) return;
    // scanned rather than selector-matched: keys hold `/` and `:`, and jsdom has no CSS.escape
    const el = [...(treeRef.current?.querySelectorAll<SVGGElement>('[data-tree-key]') ?? [])].find(
      (candidate) => candidate.dataset.treeKey === row.node.key,
    );
    // onFocus does the rest (remembering the key, panning it into view), so that focus
    // arriving by Tab or by click takes exactly the same path as focus arriving by arrow.
    el?.focus();
  }, []);

  const isStatic = (n: T) => n.kind === 'centre';
  const activate = (n: T) => {
    if (isStatic(n)) return;
    if (n.hasChildren) onToggle(n);
    else onOpen(n);
  };
  const chevron = direction === 'right' ? '›' : '‹';
  // A left-growing tree is a mirror image, so the key that walks *into* the tree is the one
  // pointing away from its root -- the same flip the APG makes for right-to-left trees.
  const intoKey = direction === 'right' ? 'ArrowRight' : 'ArrowLeft';
  const outOfKey = direction === 'right' ? 'ArrowLeft' : 'ArrowRight';

  const onKeyDown = (e: React.KeyboardEvent<SVGGElement>, i: number) => {
    const row = rows[i];
    const n = row.node;
    const isOpen = n.hasChildren && expanded.has(n.key);
    switch (e.key) {
      case 'ArrowDown':
        focusRow(rows[i + 1]);
        break;
      case 'ArrowUp':
        focusRow(rows[i - 1]);
        break;
      case 'Home':
        focusRow(rows[0]);
        break;
      case 'End':
        focusRow(rows[rows.length - 1]);
        break;
      case intoKey:
        if (n.hasChildren && !isOpen) onToggle(n);
        else if (isOpen) focusRow(rows[i + 1]); // depth-first order: the next row is the first child
        break;
      case outOfKey:
        if (isOpen) onToggle(n);
        else if (row.parentKey) focusRow(rows.find((r) => r.node.key === row.parentKey));
        break;
      case 'Enter':
      case ' ':
        activate(n);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <g className="tree-layer" ref={treeRef} role="tree" aria-label={label}>
      {/* Links carry no information a screen reader can use; the tree structure is in the
          treeitems' aria-level/setsize/posinset. */}
      <g className="tree-links" aria-hidden="true">
        {layout.links.map((l) => (
          <path key={`${l.source}>${l.target}`} className={`glink${pathKeys.has(l.source) && pathKeys.has(l.target) ? ' on-path' : ''}`} d={linkPath(l)} />
        ))}
      </g>
      {rows.map((row, i) => {
        const n = row.node;
        const mask = n.index >= 0 ? getTagMask(n) : 0;
        const showCount = n.hasChildren && !isStatic(n);
        const rightText = showCount ? `${n.count} ${chevron}` : '';
        const reserved = showCount ? rightText.length * CHAR_W + PAD_X : pillsWidth(mask) + (mask ? PAD_X : 0);
        const labelMax = NODE_W - PAD_X * 2 - reserved;
        const cls = ['gnode', `gnode-${n.kind}`, n.key === selectedKey ? 'is-selected' : '', pathKeys.has(n.key) ? 'on-path' : '', expanded.has(n.key) ? 'is-expanded' : ''].filter(Boolean).join(' ');
        return (
          <g
            key={n.key}
            data-tree-key={n.key}
            className={cls}
            transform={`translate(${row.x - NODE_W / 2}, ${row.y - NODE_H / 2})`}
            role="treeitem"
            tabIndex={n.key === tabKey ? 0 : -1}
            aria-label={ariaLabelFor(n)}
            aria-level={row.level}
            aria-posinset={row.posinset}
            aria-setsize={row.setsize}
            aria-expanded={n.hasChildren ? expanded.has(n.key) : undefined}
            aria-selected={n.key === selectedKey ? true : undefined}
            onClick={isStatic(n) ? undefined : () => activate(n)}
            onFocus={() => {
              setFocusedKey(n.key);
              viewport?.ensureVisible({ x: row.x, y: row.y });
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <rect className="gnode-box" width={NODE_W} height={NODE_H} rx={4} />
            <text className="gnode-label" x={PAD_X} y={n.sublabel ? 17 : NODE_H / 2 + 4.5}>
              {truncate(n.label, labelMax)}
            </text>
            {n.sublabel && (
              <text className="gnode-sub" x={PAD_X} y={32}>
                {truncate(n.sublabel, labelMax)}
              </text>
            )}
            {showCount ? (
              <text className="gnode-count" x={NODE_W - PAD_X} y={NODE_H / 2 + 4} textAnchor="end">{rightText}</text>
            ) : (
              <SvgPills mask={mask} x={NODE_W - PAD_X} y={NODE_H / 2} align="end" />
            )}
          </g>
        );
      })}
    </g>
  );
}
