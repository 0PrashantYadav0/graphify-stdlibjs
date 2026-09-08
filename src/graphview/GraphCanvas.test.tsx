// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';
import { NODE_W } from './layout';

afterEach(cleanup);

describe('GraphCanvas', () => {
  it('renders an svg application with the children inside the pan group and a reset button', () => {
    render(
      <GraphCanvas focusPoint={{ x: 100, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('application', { name: 'package graph' });
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
    const svg = screen.getByRole('application', { name: 'package graph' });
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

  it('fits a fitRange into view, scaling to show the whole span', () => {
    render(
      <GraphCanvas focusPoint={null} fitRange={{ x0: 0, x1: 1920, y: 0 }} label="package graph">
        <circle data-testid="dot" r={2} />
      </GraphCanvas>,
    );
    const svg = screen.getByRole('application', { name: 'package graph' });
    const transform = svg.querySelector('g.canvas-pan')!.getAttribute('transform')!;
    const scale = parseFloat(transform.match(/scale\(([^)]+)\)/)![1]);
    expect(scale).toBeCloseTo((1200 - 80) / (1920 + NODE_W));
  });
});
