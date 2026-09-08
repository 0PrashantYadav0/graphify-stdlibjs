// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { Explorer } from './Explorer';

const g = graphFromIds(['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf']);

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('Explorer', () => {
  it('renders columns for the path and the breadcrumb', () => {
    render(<Explorer graph={g} path="math/base" group={null} />);
    expect(screen.getAllByRole('listbox')).toHaveLength(3);
    expect(screen.getByRole('navigation', { name: 'path' }).textContent).toContain('base');
  });

  it('navigates into a namespace box and to a leaf box', () => {
    render(<Explorer graph={g} path="math/base/special" group={null} />);
    fireEvent.click(screen.getByRole('option', { name: /^logf/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/logf');
    fireEvent.click(screen.getByRole('option', { name: /^assert/ }));
    expect(window.location.hash).toBe('#/explore/assert');
  });
});
