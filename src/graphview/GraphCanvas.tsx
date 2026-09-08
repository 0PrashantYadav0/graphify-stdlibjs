import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { prefersReducedMotion } from './motion';
import './graphview.css';

export interface Point {
  x: number;
  y: number;
}

interface Props {
  focusPoint: Point | null;
  label: string;
  className?: string;
  children: ReactNode;
}

const FALLBACK = { width: 1200, height: 800 };
const SCALE_EXTENT: [number, number] = [0.4, 2];
const PAN_MS = 240;

function size(svg: SVGSVGElement | null) {
  if (!svg) return FALLBACK;
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  return w > 0 && h > 0 ? { width: w, height: h } : FALLBACK;
}

export function GraphCanvas({ focusPoint, label, className, children }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(() => zoomIdentity);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .filter((e: Event) => !(e as MouseEvent).ctrlKey || e.type === 'wheel')
      .on('zoom', (e) => setTransform(e.transform));
    select(svg).call(z);
    zoomRef.current = z;
    return () => {
      select(svg).on('.zoom', null);
      zoomRef.current = null;
    };
  }, []);

  const panTo = useCallback((point: Point, scale: number, animate: boolean) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const { width, height } = size(svg);
    const target = zoomIdentity.translate(width / 3 - point.x * scale, height / 2 - point.y * scale).scale(scale);
    try {
      if (animate && !prefersReducedMotion()) {
        select(svg).transition().duration(PAN_MS).call(z.transform, target);
      } else {
        select(svg).call(z.transform, target);
      }
    } catch (err) {
      // jsdom's SVGSVGElement has no width/height baseVal, which d3-zoom's default extent reads
      if (!(err instanceof TypeError && /baseVal/.test(err.message))) throw err;
      select(svg).property('__zoom', target);
      setTransform(target);
    }
  }, []);

  useEffect(() => {
    if (focusPoint) panTo(focusPoint, transform.k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-pan only when the focus point changes
  }, [focusPoint?.x, focusPoint?.y, panTo]);

  const reset = () => panTo(focusPoint ?? { x: 0, y: 0 }, 1, true);

  return (
    <div className={`graph-canvas${className ? ` ${className}` : ''}`}>
      <svg ref={svgRef} className="graph-svg" role="application" aria-label={label}>
        <g className="canvas-pan" transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>{children}</g>
      </svg>
      <button type="button" className="canvas-reset" onClick={reset}>Reset view</button>
    </div>
  );
}
