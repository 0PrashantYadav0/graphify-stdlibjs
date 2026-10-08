// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createSearch } from '../graph/search';
import { graphFromIds } from '../graph/testUtils';
import { SearchPalette } from './SearchPalette';

// Count index builds: Graph.search must build its index once, however often the palette opens.
vi.mock('../graph/search', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../graph/search')>();
  return { ...mod, createSearch: vi.fn(mod.createSearch) };
});

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

  it('returns focus to the previously focused element when it closes', () => {
    document.body.innerHTML = '<button>trigger</button>';
    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    const { unmount } = render(<SearchPalette graph={g} onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab inside the dialog', () => {
    render(<SearchPalette graph={g} onClose={() => {}} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('does nothing on ArrowDown when nothing matched', () => {
    render(<SearchPalette graph={g} onClose={() => {}} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzzz' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'log' } });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(`hit-${g.indexOf('math/base/special/log')}`);
  });

  it('shows how many matched in all, the descriptions, and the / shortcut', () => {
    const many = graphFromIds(Array.from({ length: 20 }, (_, i) => `pkg/item${i}`));
    render(<SearchPalette graph={many} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'item' } });
    expect(screen.getAllByRole('option')).toHaveLength(12);
    expect(screen.getByText(/of 20/).textContent).toBe('12 of 20 · ');
    expect(screen.getByText(/also opens search/).textContent).toContain('/ also opens search');
    expect(document.querySelector('.palette-desc')!.textContent).toBe('pkg/item0 description');
  });

  it('highlights every character a fuzzy match used', () => {
    render(<SearchPalette graph={g} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'logf' } });
    const fuzzy = screen.getByRole('option', { name: /^math\/base\/special\/log10f/ });
    expect([...fuzzy.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['log', 'f']);
  });

  it('builds the search index once per graph, however often it opens', () => {
    const fresh = graphFromIds(['a/one', 'a/two']);
    const before = vi.mocked(createSearch).mock.calls.length;
    for (let i = 0; i < 2; i++) {
      render(<SearchPalette graph={fresh} onClose={() => {}} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'one' } });
      cleanup();
    }
    expect(vi.mocked(createSearch).mock.calls.length - before).toBe(1);
  });
});
