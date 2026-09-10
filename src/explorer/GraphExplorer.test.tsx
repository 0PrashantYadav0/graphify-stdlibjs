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
  it('shows stdlib expanded to its namespaces at the root, as one named tree', () => {
    render(<GraphExplorer graph={g} path="" />);
    expect(screen.getByRole('tree', { name: 'package tree' })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^stdlib/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^blas/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^math/ })).toBeTruthy();
    expect(screen.queryByRole('treeitem', { name: /^ext/ })).toBeNull();
  });

  it('expands a namespace on click and updates the url', () => {
    render(<GraphExplorer graph={g} path="" />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas/ }));
    expect(screen.getByRole('treeitem', { name: /^ext/ })).toBeTruthy();
    expect(window.location.hash).toBe('#/explore/blas');
  });

  it('expands through operation and variant nodes for a deep link and selects the target', () => {
    render(<GraphExplorer graph={g} path="blas/ext/base/dsumkbn" />);
    expect(screen.getByRole('treeitem', { name: /^sum, 3 packages/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^float64 \(d\)/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^dsumkbn/ }).classList.contains('is-selected')).toBe(true);
    expect(screen.getByRole('navigation', { name: 'path' }).textContent).toContain('dsumkbn');
  });

  it('opens a leaf package in the focus view', () => {
    render(<GraphExplorer graph={g} path="math/base/special" />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^lnf/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('expands a namespace with the Right arrow and descends into it with a second Right', () => {
    render(<GraphExplorer graph={g} path="" />);
    const blas = screen.getByRole('treeitem', { name: /^blas/ });
    blas.focus();
    fireEvent.keyDown(blas, { key: 'ArrowRight' });
    expect(screen.getByRole('treeitem', { name: /^ext/ })).toBeTruthy();
    expect(window.location.hash).toBe('#/explore/blas');
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^blas/ }), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^ext/ }));
  });

  it('walks the visible rows with Down and collapses back up with Left', () => {
    render(<GraphExplorer graph={g} path="blas/ext/base" />);
    const stdlib = screen.getByRole('treeitem', { name: /^stdlib/ });
    fireEvent.keyDown(stdlib, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^blas/ }));
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^blas/ }), { key: 'ArrowLeft' });
    expect(screen.queryByRole('treeitem', { name: /^ext/ })).toBeNull();
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^blas/ }), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^stdlib/ }));
  });

  it('opens a leaf package with Enter', () => {
    render(<GraphExplorer graph={g} path="math/base/special" />);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^lnf/ }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('keeps exactly one tab stop, on the deep-linked selection', () => {
    render(<GraphExplorer graph={g} path="blas/ext/base/dsumkbn" />);
    const stops = screen.getAllByRole('treeitem').filter((el) => el.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('aria-label')).toMatch(/^dsumkbn/);
  });

  it('ignores a stale hashchange for a node the user already collapsed', () => {
    const { rerender } = render(<GraphExplorer graph={g} path="" />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas/ })); // opens + navigates
    expect(screen.getByRole('treeitem', { name: /^ext/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas/ })); // collapses again
    expect(screen.queryByRole('treeitem', { name: /^ext/ })).toBeNull();
    // the hashchange this navigate() triggered arrives late, after the user already collapsed the node
    rerender(<GraphExplorer graph={g} path="blas" />);
    expect(screen.queryByRole('treeitem', { name: /^ext/ })).toBeNull();
  });
});
