// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { GraphExplorer } from './GraphExplorer';

const g = graphFromIds(['blas/ext/base/sum', 'blas/ext/base/dsum', 'blas/ext/base/dsumkbn', 'blas/ext/base/index-of', 'math/base/special/lnf']);

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('GraphExplorer', () => {
  it('shows stdlib expanded to its namespaces at the root', () => {
    render(<GraphExplorer graph={g} path="" />);
    expect(screen.getByRole('button', { name: /^stdlib/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^blas/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^math/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^ext/ })).toBeNull();
  });

  it('expands a namespace on click and updates the url', () => {
    render(<GraphExplorer graph={g} path="" />);
    fireEvent.click(screen.getByRole('button', { name: /^blas/ }));
    expect(screen.getByRole('button', { name: /^ext/ })).toBeTruthy();
    expect(window.location.hash).toBe('#/explore/blas');
  });

  it('expands through operation and variant nodes for a deep link and selects the target', () => {
    render(<GraphExplorer graph={g} path="blas/ext/base/dsumkbn" />);
    expect(screen.getByRole('button', { name: /^sum, 3 packages/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^float64 \(d\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^dsumkbn/ }).classList.contains('is-selected')).toBe(true);
    expect(screen.getByRole('navigation', { name: 'path' }).textContent).toContain('dsumkbn');
  });

  it('opens a leaf package in the focus view', () => {
    render(<GraphExplorer graph={g} path="math/base/special" />);
    fireEvent.click(screen.getByRole('button', { name: /^lnf/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });
});
