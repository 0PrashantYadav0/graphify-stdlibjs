// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { routes } from '../app/router';
import { Focus } from './Focus';

const g = graphFromIds(
  ['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf', 'math/base/special/log10f', 'blas/base/dasum'],
  {
    runtime: [['math/base/special/logf', 'math/base/special/lnf'], ['math/base/special/log10f', 'math/base/special/logf']],
    dev: [['math/base/special/logf', 'assert/is-nan']],
    native: [['blas/base/dasum', 'math/base/special/logf']],
  },
);

const facts = () => [...document.querySelectorAll('.module-facts li')].map((li) => li.textContent);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Focus', () => {
  it('shows the module card, counts, and both sides as graph nodes', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('math/base/special/logf');
    expect(facts()).toEqual(['Requires 1 / 1 in web', 'Required by 1 / 1 in web']);
    expect(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^math\/base\/special\/log10f$/ })).toBeTruthy();
    // the centre is a treeitem like any other node -- role="img" would have been an
    // invalid child of role="tree" -- but it stays static: no count, and nothing to open.
    const centre = screen.getByRole('treeitem', { name: /^logf/ });
    expect(centre.getAttribute('aria-level')).toBe('1');
    expect(centre.getAttribute('aria-expanded')).toBe('true');
    expect(centre.querySelector('.gnode-count')).toBeNull();
  });

  it('sums up each side and links to the whole web', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/logf', { edges: ['runtime', 'dev'] })} />);
    const [left, right] = [...document.querySelectorAll('.focus-summary')];
    expect(left.textContent).toBe('2 packages in 2 namespaces · Webbed shows all 2');
    expect(within(left as HTMLElement).getByRole('link').getAttribute('href')).toBe('#/module/math/base/special/logf?view=webbed&edges=runtime,dev');
    expect(within(right as HTMLElement).getByRole('link').getAttribute('href')).toBe('#/module/math/base/special/logf?view=webbed&dir=in&edges=runtime,dev');
  });

  it('splits the neighbourhood into two named trees, each with its own single tab stop', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
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
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    const centre = screen.getByRole('treeitem', { name: /^logf/ });
    fireEvent.keyDown(centre, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^math\/base\/special\/log10f$/ }));
  });

  it('opens a neighbour on click', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('opens a neighbour with Enter', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/math/base/special/lnf');
  });

  it('includes dev and native edges when toggled on', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    fireEvent.click(screen.getByRole('button', { name: /dev/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/logf?edges=runtime,dev');
    cleanup();
    render(<Focus graph={g} route={routes.module('math/base/special/logf', { edges: ['runtime', 'dev', 'native'] })} />);
    expect(facts()).toEqual(['Requires 2 / 2 in web', 'Required by 2 / 2 in web']);
    expect(screen.getByRole('treeitem', { name: /^assert\/is-nan$/ })).toBeTruthy();
  });

  it('keeps the edge kinds that are on when hopping to a neighbour', () => {
    window.location.hash = '#/module/math/base/special/logf?edges=runtime,dev';
    render(<Focus graph={g} route={routes.module('math/base/special/logf', { edges: ['runtime', 'dev'] })} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/lnf?edges=runtime,dev');
  });

  it('toggles a requires folder open and closed', () => {
    const g2 = graphFromIds(
      ['math/base/special/logf', 'blas/base/dasum', 'blas/base/daxpy'],
      { runtime: [['math/base/special/logf', 'blas/base/dasum'], ['math/base/special/logf', 'blas/base/daxpy']] },
    );
    render(<Focus graph={g2} route={routes.module('math/base/special/logf')} />);
    expect(screen.getByRole('treeitem', { name: /^dasum$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas\/base, 2 packages/ }));
    expect(screen.queryByRole('treeitem', { name: /^dasum$/ })).toBeNull();
    fireEvent.click(screen.getByRole('treeitem', { name: /^blas\/base, 2 packages/ }));
    expect(screen.getByRole('treeitem', { name: /^dasum$/ })).toBeTruthy();
  });

  it('explains an unknown id', () => {
    render(<Focus graph={g} route={routes.module('nope/nothing')} />);
    expect(screen.getByText(/No package named/).textContent).toContain('nope/nothing');
  });

  it('suggests what a mistyped id probably meant', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/lgf')} />);
    expect(screen.getByText(/Did you mean/).textContent).toContain('math/base/special/logf');
    expect(screen.getByRole('link', { name: 'math/base/special/logf' }).getAttribute('href')).toBe('#/module/math/base/special/logf');
  });

  it('explains each edge kind on its toggle', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    expect(screen.getByRole('button', { name: 'native' }).getAttribute('title')).toBe('native: needed to build the C/Fortran add-on');
    expect(screen.getByRole('button', { name: 'dev' }).getAttribute('title')).toBe('dev: needed only by tests, benchmarks or examples');
  });

  it('copies the require statement and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy require' })));
    expect(writeText).toHaveBeenCalledWith("const logf = require( '@stdlib/math/base/special/logf' );");
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Copied the require statement');
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('https://stdlib.io/docs/api/latest/@stdlib/math/base/special/logf');
  });

  it('hides the snippet and docs for a bookkeeping folder, and offers Browse inside only for a namespace', () => {
    render(<Focus graph={g} route={routes.module('math/base')} />);
    expect(screen.queryByRole('button', { name: 'Copy require' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Browse inside' })).toBeTruthy();
    cleanup();
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    expect(screen.queryByRole('link', { name: 'Browse inside' })).toBeNull();
  });

  it('leaves a tree, or the Webbed columns, for the module card on Escape', () => {
    render(<Focus graph={g} route={routes.module('math/base/special/logf')} />);
    const node = screen.getByRole('treeitem', { name: /^math\/base\/special\/lnf$/ });
    node.focus();
    fireEvent.keyDown(node, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: /explore math\/base\/special/ }));
    cleanup();
    render(<Focus graph={g} route={routes.module('math/base/special/logf', { view: 'webbed' })} />);
    const row = screen.getAllByRole('option')[0];
    row.focus();
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: /explore math\/base\/special/ }));
  });
});

