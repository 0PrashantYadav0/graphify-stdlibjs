// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { Focus } from './Focus';

const g = graphFromIds(
  ['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf', 'math/base/special/log10f', 'blas/base/dasum'],
  {
    runtime: [['math/base/special/logf', 'math/base/special/lnf'], ['math/base/special/log10f', 'math/base/special/logf']],
    dev: [['math/base/special/logf', 'assert/is-nan']],
    native: [['blas/base/dasum', 'math/base/special/logf']],
  },
);

afterEach(cleanup);

describe('Focus', () => {
  it('shows the module card, counts, and both sides as graph nodes', () => {
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('math/base/special/logf');
    expect(screen.getByText('Requires 1')).toBeTruthy();
    expect(screen.getByText('Required by 1')).toBeTruthy();
    expect(screen.getByText('Connected 2')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^math\/base\/special\/log10f$/ })).toBeTruthy();
    // the centre is a treeitem like any other node -- role="img" would have been an
    // invalid child of role="tree" -- but it stays static: no count, and nothing to open.
    const centre = screen.getByRole('treeitem', { name: /^logf/ });
    expect(centre.getAttribute('aria-level')).toBe('1');
    expect(centre.getAttribute('aria-expanded')).toBe('true');
    expect(centre.querySelector('.gnode-count')).toBeNull();
  });

  it('splits the neighbourhood into two named trees, each with its own single tab stop', () => {
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    const requires = screen.getByRole('tree', { name: 'requires' });
    const requiredBy = screen.getByRole('tree', { name: 'required by' });
    const stops = (tree: HTMLElement) => [...tree.querySelectorAll('[role="treeitem"]')].filter((el) => el.getAttribute('tabindex') === '0');
    expect(stops(requires)).toHaveLength(1);
    expect(stops(requiredBy)).toHaveLength(1);
    // the requires side hides the shared centre, so its neighbours are the top level
    expect(within(requires).getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }).getAttribute('aria-level')).toBe('1');
    expect(within(requiredBy).getByRole('treeitem', { name: /^math\/base\/special\/log10f$/ }).getAttribute('aria-level')).toBe('2');
  });

  it('walks the required-by tree from its centre with the Down arrow', () => {
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    const centre = screen.getByRole('treeitem', { name: /^logf/ });
    fireEvent.keyDown(centre, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^math\/base\/special\/log10f$/ }));
  });

  it('opens a neighbour on click', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('opens a neighbour with Enter', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('includes dev and native edges when toggled on', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    fireEvent.click(screen.getByRole('button', { name: /dev/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/logf?edges=runtime,dev');
    cleanup();
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime', 'dev', 'native']} />);
    expect(screen.getByText('Requires 2')).toBeTruthy();
    expect(screen.getByText('Required by 2')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^assert\/is-nan$/ })).toBeTruthy();
  });

  it('toggles a requires folder open and closed', () => {
    const g2 = graphFromIds(
      ['math/base/special/logf', 'blas/base/dasum', 'blas/base/daxpy'],
      { runtime: [['math/base/special/logf', 'blas/base/dasum'], ['math/base/special/logf', 'blas/base/daxpy']] },
    );
    render(<Focus graph={g2} id="math/base/special/logf" edges={['runtime']} />);
    expect(screen.getByRole('treeitem', { name: /^dasum$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas\/base, 2 packages/ }));
    expect(screen.queryByRole('treeitem', { name: /^dasum$/ })).toBeNull();
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas\/base, 2 packages/ }));
    expect(screen.getByRole('treeitem', { name: /^dasum$/ })).toBeTruthy();
  });

  it('explains an unknown id', () => {
    render(<Focus graph={g} id="nope/nothing" edges={['runtime']} />);
    expect(screen.getByText(/No package named/).textContent).toContain('nope/nothing');
  });
});
