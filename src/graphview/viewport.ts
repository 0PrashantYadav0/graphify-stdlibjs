import { createContext, useContext } from 'react';

export interface Point {
  x: number;
  y: number;
}

/**
 * What a graph layer may ask of the canvas it is drawn on. Keyboard focus has to
 * bring the focused node into view, but the layer knows only graph coordinates --
 * the canvas owns the pan/zoom transform and its own pixel size, so it is the only
 * thing that can decide whether a point is currently visible.
 */
export interface CanvasViewport {
  /** Pan the smallest distance that brings the node box at `point` fully into view. No-op if it already is. */
  ensureVisible: (point: Point) => void;
}

const CanvasViewportContext = createContext<CanvasViewport | null>(null);

export const CanvasViewportProvider = CanvasViewportContext.Provider;

/** Null when the layer is rendered outside a GraphCanvas (bare `<svg>` in tests). */
export function useCanvasViewport(): CanvasViewport | null {
  return useContext(CanvasViewportContext);
}
