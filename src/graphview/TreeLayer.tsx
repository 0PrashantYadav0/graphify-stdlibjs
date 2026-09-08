import { useEffect, useMemo } from 'react';
import { layoutTree, linkPath, NODE_H, NODE_W, type Direction, type LayoutResult } from './layout';
import { pillsWidth, SvgPills } from './SvgPills';

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
  hideRoot?: boolean;
  onLayout?: (result: LayoutResult<T>) => void;
}

const CHAR_W = 7.8;
const PAD_X = 10;

function truncate(text: string, maxPx: number): string {
  const max = Math.max(3, Math.floor(maxPx / CHAR_W));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function ariaLabelFor(n: GraphNodeLike): string {
  return n.hasChildren ? `${n.label}, ${n.count} package${n.count === 1 ? '' : 's'}` : n.label;
}

export function TreeLayer<T extends GraphNodeLike>({ root, childrenOf, expanded, direction, selectedKey, pathKeys, onToggle, onOpen, getTagMask, hideRoot = false, onLayout }: Props<T>) {
  const layout = useMemo(() => layoutTree(root, childrenOf, (n) => expanded.has(n.key), direction), [root, childrenOf, expanded, direction]);

  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  const activate = (n: T) => (n.hasChildren ? onToggle(n) : onOpen(n));
  const chevron = direction === 'right' ? '›' : '‹';

  return (
    <g className="tree-layer">
      {layout.links.map((l) => (
        <path key={`${l.source}>${l.target}`} className={`glink${pathKeys.has(l.source) && pathKeys.has(l.target) ? ' on-path' : ''}`} d={linkPath(l)} />
      ))}
      {layout.nodes.map((ln) => {
        const n = ln.data;
        if (hideRoot && n.key === root.key) return null;
        const mask = n.index >= 0 ? getTagMask(n) : 0;
        const rightText = n.hasChildren ? `${n.count} ${chevron}` : '';
        const reserved = n.hasChildren ? rightText.length * CHAR_W + PAD_X : pillsWidth(mask) + (mask ? PAD_X : 0);
        const labelMax = NODE_W - PAD_X * 2 - reserved;
        const cls = ['gnode', `gnode-${n.kind}`, n.key === selectedKey ? 'is-selected' : '', pathKeys.has(n.key) ? 'on-path' : '', expanded.has(n.key) ? 'is-expanded' : ''].filter(Boolean).join(' ');
        return (
          <g
            key={n.key}
            className={cls}
            transform={`translate(${ln.x - NODE_W / 2}, ${ln.y - NODE_H / 2})`}
            role="button"
            tabIndex={0}
            aria-label={ariaLabelFor(n)}
            aria-expanded={n.hasChildren ? expanded.has(n.key) : undefined}
            onClick={() => activate(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(n);
              }
            }}
          >
            <rect className="gnode-box" width={NODE_W} height={NODE_H} rx={4} />
            <text className="gnode-label" x={PAD_X} y={NODE_H / 2 + 4.5}>
              {truncate(n.label, n.sublabel ? labelMax * 0.55 : labelMax)}
              {n.sublabel && <tspan className="gnode-sub"> {truncate(n.sublabel, labelMax * 0.45)}</tspan>}
            </text>
            {n.hasChildren ? (
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
