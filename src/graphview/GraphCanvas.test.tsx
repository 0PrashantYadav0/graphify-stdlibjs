// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';
import { NODE_W } from './layout';
import { useCanvasViewport, type Point } from './viewport';

afterEach(cleanup);

describe('GraphCanvas', () => {
  it('renders a labelled svg group with the children inside the pan group and a reset button', () => {
    render(
      <GraphCanvas focusPoint={{ x: 100, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    expect(svg.querySelector('g.canvas-pan [data-testid="dot"]')).not.toBeNull();
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).toMatch(/^translate\(/);
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).toMatch(/^translate\(/);
  });

  it('re-pans when focusPoint changes, landing the point at 1/3 width, centred vertically', () => {
    const { rerender } = render(
      <GraphCanvas focusPoint={{ x: 0, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const before = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    rerender(
      <GraphCanvas focusPoint={{ x: 500, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const after = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    expect(after).not.toBe(before);
    expect(after).toBe(`translate(${1200 / 3 - 500}, 400) scale(1)`);
  });

  it('pans to a custom anchor fraction of the width when anchor is set', () => {
    render(
      <GraphCanvas focusPoint={{ x: 0, y: 0 }} anchor={0.5} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const transform = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    expect(transform).toBe('translate(600, 400) scale(1)');
  });

  it('fits a fitRange into view, scaling to show the whole span', () => {
    render(
      <GraphCanvas focusPoint={null} fitRange={{ x0: 0, x1: 1920, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const transform = svg.querySelector('g.canvas-pan')!.getAttribute('transform')!;
    const scale = parseFloat(transform.match(/scale\(([^)]+)\)/)![1]);
    expect(scale).toBeCloseTo((1200 - 80) / (1920 + NODE_W));
  });

  it('fits a fitRange with a vertical span too, clamping scale and centring the range', () => {
    render(
      <GraphCanvas focusPoint={null} fitRange={{ x0: 0, x1: 0, y: 0, y0: -4000, y1: 4000 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const transform = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    expect(transform).toBe('translate(600, 400) scale(0.4)');
  });

  it('does not claim the arrow keys with role="application"', () => {
    render(
      <GraphCanvas focusPoint={null} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    expect(screen.queryByRole('application')).toBeNull();
    expect(screen.getByRole('group', { name: 'package graph' }).getAttribute('role')).toBe('group');
  });

  it('reset view re-applies the last fitted transform instead of returning to the origin', () => {
    render(
      <GraphCanvas focusPoint={null} fitRange={{ x0: 0, x1: 1920, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const fitted = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    const afterReset = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    expect(afterReset).toBe(fitted);
    expect(afterReset).not.toBe('translate(0, 0) scale(1)');
  });

  it('leaves the view alone when ensureVisible is given a point already on screen', () => {
    render(
      <GraphCanvas focusPoint={null} label="package graph">
        <Prober point={{ x: 600, y: 400 }} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    fireEvent.click(screen.getByRole('button', { name: 'nudge' }));
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).toBe('translate(0, 0) scale(1)');
  });

  it('pans the smallest distance that brings an off-screen node fully into view', () => {
    render(
      <GraphCanvas focusPoint={null} label="package graph">
        <Prober point={{ x: 2000, y: 400 }} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    fireEvent.click(screen.getByRole('button', { name: 'nudge' }));
    // the node's right edge lands on the 24px margin: 1200 - 24 - (2000 + NODE_W / 2)
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).toBe(`translate(${1200 - 24 - (2000 + NODE_W / 2)}, 0) scale(1)`);
  });

  it('keeps a focus nudge out of the reset target, so Reset view still returns to the fit', () => {
    render(
      <GraphCanvas focusPoint={null} fitRange={{ x0: 0, x1: 0, y: 0 }} label="package graph">
        <Prober point={{ x: 4000, y: 4000 }} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('group', { name: 'package graph' });
    const fitted = svg.querySelector('g.canvas-pan')!.getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: 'nudge' }));
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).not.toBe(fitted);
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(svg.querySelector('g.canvas-pan')!.getAttribute('transform')).toBe(fitted);
  });
});

/** Renders a control that asks the surrounding canvas to bring `point` into view. */
function Prober({ point }: { point: Point }) {
  const viewport = useCanvasViewport();
  return (
    <foreignObject>
      <button type="button" onClick={() => viewport!.ensureVisible(point)}>nudge</button>
    </foreignObject>
  );
}
