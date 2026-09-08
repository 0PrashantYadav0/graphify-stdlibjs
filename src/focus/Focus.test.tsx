// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('shows the module, counts, and both sides as trees of links', () => {
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('math/base/special/logf');
    expect(screen.getByText('Requires 1')).toBeTruthy();
    expect(screen.getByText('Required by 1')).toBeTruthy();
    expect(screen.getByText('Connected 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^lnf/ }).getAttribute('href')).toBe('#/module/math/base/special/lnf');
    expect(screen.getByRole('link', { name: /^log10f/ }).getAttribute('href')).toBe('#/module/math/base/special/log10f');
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
    expect(screen.getByRole('link', { name: /^is-nan/ })).toBeTruthy();
  });

  it('explains an unknown id', () => {
    render(<Focus graph={g} id="nope/nothing" edges={['runtime']} />);
    expect(screen.getByText(/No package named/).textContent).toContain('nope/nothing');
  });
});
