// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';

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
});
