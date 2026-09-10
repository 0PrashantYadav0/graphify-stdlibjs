import { useMemo } from 'react';
import type { Graph } from '../graph/Graph';
import { constellationLayout } from './constellation';

/* The viewBox is square and the constellation is centred in it, so the whole
   drawing — ring, outer dots and the rotated labels around the rim — sits well
   inside the box at every viewport. Combined with `meet` below, that is what
   stops labels being sliced off: the art scales down to fit its column instead
   of being cropped to cover it. The ring's own radius is 0.3 * 520 = 156 and
   the outermost dots reach 1.55 * that = 242, leaving 18px of margin. */
const SIZE = { width: 520, height: 520 };
const LABELLED = 12;

export function Constellation({ graph }: { graph: Graph }) {
  const layout = useMemo(() => constellationLayout(graph, SIZE, 12), [graph]);
  const labelled = new Set([...layout.ring].sort((a, b) => b.size - a.size).slice(0, LABELLED).map((n) => n.label));
  return (
    <svg className="constellation" viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g className="const-links">
        {layout.links.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} pathLength={1} />
        ))}
      </g>
      {layout.outer.map((n) => (
        <circle key={n.label} className="const-outer" cx={n.x} cy={n.y} r={2.5} />
      ))}
      {layout.ring.map((n) => {
        const a = Math.atan2(n.y - layout.centre.y, n.x - layout.centre.x);
        const deg = (a * 180) / Math.PI;
        const left = Math.cos(a) < 0;
        return (
          <g key={n.label} transform={`translate(${n.x}, ${n.y})`}>
            <circle className="const-ring" r={4} />
            {labelled.has(n.label) && (
              <text
                className="const-label"
                transform={`rotate(${left ? deg + 180 : deg})`}
                x={left ? -12 : 12}
                y={0}
                textAnchor={left ? 'end' : 'start'}
                dominantBaseline="middle"
              >
                {n.label}
              </text>
            )}
          </g>
        );
      })}
      <g transform={`translate(${layout.centre.x}, ${layout.centre.y})`}>
        <circle className="const-centre" r={7} />
        <text className="const-label const-centre-label" y={-12} textAnchor="middle">stdlib</text>
      </g>
    </svg>
  );
}
