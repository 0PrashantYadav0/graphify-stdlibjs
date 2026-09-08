// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { SearchPalette } from './SearchPalette';

const g = graphFromIds(['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f', 'utils/noop']);

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('SearchPalette', () => {
  it('lists scored results as you type and opens the active one on Enter', () => {
    const onClose = vi.fn();
    render(<SearchPalette graph={g} onClose={onClose} />);
    const input = screen.getByRole('combobox');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'logf' } });
    const options = screen.getAllByRole('option');
    expect(options[0].textContent).toContain('math/base/special/logf');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/math/base/special/logf');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a folder node in the explorer instead of the focus view', () => {
    render(<SearchPalette graph={g} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'special' } });
    fireEvent.click(screen.getByRole('option', { name: /math\/base\/special$/ }));
    expect(window.location.hash).toBe('#/explore/math/base/special');
  });

  it('shows an empty state and closes on Escape', () => {
    const onClose = vi.fn();
    render(<SearchPalette graph={g} onClose={onClose} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No package matches “zzzz”.')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
