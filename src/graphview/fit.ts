import { NODE_H, NODE_W } from './layout';

export interface FitRange {
  x0: number;
  x1: number;
  /** The point that matters most vertically (the focus view's centre node). */
  y: number;
  /** The same, horizontally; defaults to the middle of x0..x1. */
  x?: number;
  /** When set together with y1, fits this vertical span too, centring the whole range. */
  y0?: number;
  y1?: number;
}

export interface Fit {
  x: number;
  y: number;
  k: number;
}

const PAD = 80;

/**
 * The transform that shows `range` in a `width` × `height` viewport, never zoomed past 1.
 * It never zooms out below `minK` either: if the range only fits below that, it stays at
 * `minK` and centres on (range.x, range.y) instead, leaving the rest to panning.
 */
export function fitTransform(range: FitRange, { width, height }: { width: number; height: number }, { minK = 0.4 } = {}): Fit {
  const { x0, x1, y, y0, y1 } = range;
  const dx = x1 - x0 + NODE_W;
  if (y0 === undefined || y1 === undefined) {
    const k = Math.min(1, Math.max(minK, (width - PAD) / dx));
    return { x: PAD / 2 - (x0 - NODE_W / 2) * k, y: height / 2 - y * k, k };
  }
  const dy = y1 - y0 + NODE_H;
  const fit = Math.min(1, (width - PAD) / dx, (height - PAD) / dy);
  const k = Math.max(minK, fit);
  const mid = (x0 + x1) / 2;
  // Too big to show whole at a readable size: keep the anchor point in the middle and let the user pan.
  const cx = fit >= minK || dx * k <= width - PAD ? mid : (range.x ?? mid);
  const cy = fit >= minK ? (y0 + y1) / 2 : y;
  return { x: width / 2 - cx * k, y: height / 2 - cy * k, k };
}
