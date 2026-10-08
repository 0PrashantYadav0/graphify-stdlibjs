import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { prefersReducedMotion } from './motion';
import { fitTransform, type FitRange } from './fit';
import { NODE_H, NODE_W } from './layout';
import { CanvasViewportProvider, type CanvasViewport, type Point } from './viewport';
import './graphview.css';

export type { Point, FitRange };

interface Props {
  focusPoint: Point | null;
  /** When set, fits this horizontal span (plus the vertical point) into view instead of panning to a single point. */
  fitRange?: FitRange | null;
  /** Fraction of the canvas width where focusPoint lands. Defaults to 1/3. */
  anchor?: number;
  /** The smallest scale a fit may choose (the user can still zoom further out). Defaults to the zoom floor. */
  minFitScale?: number;
  label: string;
  className?: string;
  children: ReactNode;
}

const FALLBACK = { width: 1200, height: 800 };
const SCALE_EXTENT: [number, number] = [0.4, 2];
const PAN_MS = 240;
/** Pixels of breathing room kept between a node brought into view and the canvas edge. */
const EDGE_MARGIN = 24;

function size(svg: SVGSVGElement | null) {
  if (!svg) return FALLBACK;
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  return w > 0 && h > 0 ? { width: w, height: h } : FALLBACK;
}

export function GraphCanvas({ focusPoint, fitRange, anchor = 1 / 3, minFitScale = SCALE_EXTENT[0], label, className, children }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastTarget = useRef<ZoomTransform | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(() => zoomIdentity);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .filter((e: MouseEvent) => (!e.ctrlKey || e.type === 'wheel') && !e.button)
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => setTransform(e.transform));
    select(svg).call(z);
    zoomRef.current = z;
    return () => {
      select(svg).on('.zoom', null);
      zoomRef.current = null;
    };
  }, []);

  // `remember` records the target as the one "Reset view" returns to. Programmatic fits and
  // focus pans are the view the user asked for; nudges that merely keep a keyboard-focused
  // node on screen are not, so they leave the reset target alone.
  const apply = useCallback((target: ZoomTransform, animate: boolean, remember = true) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    if (remember) lastTarget.current = target;
    try {
      if (animate && !prefersReducedMotion()) {
        select(svg).transition().duration(PAN_MS).call((t) => z.transform(t, target));
      } else {
        select(svg).call((s) => z.transform(s, target));
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

  const ensureVisible = useCallback((point: Point) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = size(svg);
    // read from d3 rather than React state: a burst of arrow keys can move focus several
    // times before a state update lands, and each nudge must build on the last one.
    const t = zoomTransform(svg);
    const halfW = (NODE_W / 2) * t.k;
    const halfH = (NODE_H / 2) * t.k;
    const cx = t.x + point.x * t.k;
    const cy = t.y + point.y * t.k;
    let dx = 0;
    let dy = 0;
    if (cx - halfW < EDGE_MARGIN) dx = EDGE_MARGIN - (cx - halfW);
    else if (cx + halfW > width - EDGE_MARGIN) dx = width - EDGE_MARGIN - (cx + halfW);
    if (cy - halfH < EDGE_MARGIN) dy = EDGE_MARGIN - (cy - halfH);
    else if (cy + halfH > height - EDGE_MARGIN) dy = height - EDGE_MARGIN - (cy + halfH);
    if (dx === 0 && dy === 0) return;
    apply(zoomIdentity.translate(t.x + dx, t.y + dy).scale(t.k), true, false);
  }, [apply]);

  const viewport = useMemo<CanvasViewport>(() => ({ ensureVisible }), [ensureVisible]);

  useEffect(() => {
    if (fitRange) return; // fitRange takes precedence over a single focus point
    if (focusPoint) panTo(focusPoint, transform.k, true);
    // Intentionally re-pan only when the focus point (or fitRange) changes, not on
    // every transform update -- otherwise a zoom/pan gesture would fight this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on the point's coordinates, not on transform (see above)
  }, [focusPoint?.x, focusPoint?.y, panTo, fitRange]);

  useEffect(() => {
    if (!fitRange) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y, k } = fitTransform(fitRange, size(svg), { minK: minFitScale });
    apply(zoomIdentity.translate(x, y).scale(k), true);
    // Intentionally re-fit only when the range itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the range's numbers; a new object with the same numbers must not re-fit
  }, [fitRange?.x0, fitRange?.x1, fitRange?.x, fitRange?.y, fitRange?.y0, fitRange?.y1, minFitScale, apply]);

  const reset = () => {
    if (lastTarget.current) apply(lastTarget.current, true);
    else panTo(focusPoint ?? { x: 0, y: 0 }, 1, true);
  };

  return (
    <div className={`graph-canvas${className ? ` ${className}` : ''}`}>
      <button type="button" className="canvas-reset" onClick={reset}>Reset view</button>
      {/* role="group", not "application": the canvas is a labelled container around one or more
          tree widgets, and it is those trees -- not the canvas -- that own the arrow keys. */}
      <svg ref={svgRef} className="graph-svg" role="group" aria-label={label}>
        <g className="canvas-pan" transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          <CanvasViewportProvider value={viewport}>{children}</CanvasViewportProvider>
        </g>
      </svg>
    </div>
  );
}
