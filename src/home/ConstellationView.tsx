import { useMemo } from 'react';
import type { Graph } from '../graph/Graph';
import { constellationLayout } from './constellation';

const SIZE = { width: 800, height: 520 };
const LABELLED = 12;

export function Constellation({ graph }: { graph: Graph }) {
  const layout = useMemo(() => constellationLayout(graph, SIZE), [graph]);
  const labelled = new Set([...layout.ring].sort((a, b) => b.size - a.size).slice(0, LABELLED).map((n) => n.label));
  return (
    <svg className="constellation" viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g className="const-links">
        {layout.links.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} pathLength={1} />
        ))}
      </g>
      {layout.outer.map((n) => (
        <circle key={n.label} className="const-outer" cx={n.x} cy={n.y} r={2.5} />
      ))}
      {layout.ring.map((n) => (
        <g key={n.label} transform={`translate(${n.x}, ${n.y})`}>
          <circle className="const-ring" r={4} />
          {labelled.has(n.label) && (
            <text className="const-label" x={n.x >= layout.centre.x ? 8 : -8} y={4} textAnchor={n.x >= layout.centre.x ? 'start' : 'end'}>{n.label}</text>
          )}
        </g>
      ))}
      <g transform={`translate(${layout.centre.x}, ${layout.centre.y})`}>
        <circle className="const-centre" r={7} />
        <text className="const-label const-centre-label" y={-12} textAnchor="middle">stdlib</text>
      </g>
    </svg>
  );
}
