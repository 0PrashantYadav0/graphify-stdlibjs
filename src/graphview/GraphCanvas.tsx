import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { prefersReducedMotion } from './motion';
import { NODE_H, NODE_W } from './layout';
import './graphview.css';

export interface Point {
  x: number;
  y: number;
}

export interface FitRange {
  x0: number;
  x1: number;
  y: number;
  /** When set together with y1, fits this vertical span too, centring the whole range. */
  y0?: number;
  y1?: number;
}

interface Props {
  focusPoint: Point | null;
  /** When set, fits this horizontal span (plus the vertical point) into view instead of panning to a single point. */
  fitRange?: FitRange | null;
  /** Fraction of the canvas width where focusPoint lands. Defaults to 1/3. */
  anchor?: number;
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

export function GraphCanvas({ focusPoint, fitRange, anchor = 1 / 3, label, className, children }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastTarget = useRef<ZoomTransform | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(() => zoomIdentity);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .filter((e) => (!(e as MouseEvent).ctrlKey || e.type === 'wheel') && !(e as MouseEvent).button)
      .on('zoom', (e) => setTransform(e.transform));
    select(svg).call(z);
    zoomRef.current = z;
    return () => {
      select(svg).on('.zoom', null);
      zoomRef.current = null;
    };
  }, []);

  const apply = useCallback((target: ZoomTransform, animate: boolean) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    lastTarget.current = target;
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

  const panTo = useCallback((point: Point, scale: number, animate: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = size(svg);
    const target = zoomIdentity.translate(width * anchor - point.x * scale, height / 2 - point.y * scale).scale(scale);
    apply(target, animate);
  }, [apply, anchor]);

  useEffect(() => {
    if (fitRange) return; // fitRange takes precedence over a single focus point
    if (focusPoint) panTo(focusPoint, transform.k, true);
    // Intentionally re-pan only when the focus point (or fitRange) changes, not on
    // every transform update -- otherwise a zoom/pan gesture would fight this effect.
  }, [focusPoint?.x, focusPoint?.y, panTo, fitRange]);

  useEffect(() => {
    if (!fitRange) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = size(svg);
    const { x0, x1, y, y0, y1 } = fitRange;
    let target: ZoomTransform;
    if (y0 !== undefined && y1 !== undefined) {
      const dx = x1 - x0 + NODE_W;
      const dy = y1 - y0 + NODE_H;
      const k = Math.min(1, Math.max(0.4, Math.min((width - 80) / dx, (height - 80) / dy)));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      target = zoomIdentity.translate(width / 2 - cx * k, height / 2 - cy * k).scale(k);
    } else {
      const k = Math.min(1, Math.max(0.4, (width - 80) / (x1 - x0 + NODE_W)));
      target = zoomIdentity.translate(40 - (x0 - NODE_W / 2) * k, height / 2 - y * k).scale(k);
    }
    apply(target, true);
    // Intentionally re-fit only when the range itself changes, not on every render.
  }, [fitRange?.x0, fitRange?.x1, fitRange?.y, fitRange?.y0, fitRange?.y1, apply]);

  const reset = () => {
    if (lastTarget.current) apply(lastTarget.current, true);
    else panTo(focusPoint ?? { x: 0, y: 0 }, 1, true);
  };

  return (
    <div className={`graph-canvas${className ? ` ${className}` : ''}`}>
      <button type="button" className="canvas-reset" onClick={reset}>Reset view</button>
      <svg ref={svgRef} className="graph-svg" role="application" aria-label={label}>
        <g className="canvas-pan" transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>{children}</g>
      </svg>
    </div>
  );
}
