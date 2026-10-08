// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildGraphFile } from '../graph/buildGraphFile';
import { Tag } from '../graph/tags';
import App from '../app/App';
import { SHORTCUTS } from './shortcuts';

// Every key a handler compares against, read from the handlers' source, must be in the sheet.
const HANDLERS = ['../search/useShortcut.ts', '../graphview/TreeLayer.tsx', '../webbed/Webbed.tsx', '../focus/Focus.tsx', '../explorer/GraphExplorer.tsx'];
// e.key === 'x', e.key !== 'x', e.key.toLowerCase() === 'x', case 'x':, and TreeLayer's mirrored pair.
const KEY_COMPARE = /(?:e\.key(?:\.toLowerCase\(\))? [!=]== |case )'([^']{1,10})'/g;
const MIRRORED = /Key = direction === '\w+' \? '(\w+)' : '(\w+)'/g;

describe('the shortcuts sheet lists every binding', () => {
  const listed = new Set(SHORTCUTS.flatMap((g) => g.items.flatMap((s) => s.keys)));
  it.each(HANDLERS)('%s', (file) => {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    const handled = [...[...src.matchAll(KEY_COMPARE)].map((m) => m[1]), ...[...src.matchAll(MIRRORED)].flatMap((m) => [m[1], m[2]])];
    expect(handled.length).toBeGreaterThan(0);
    for (const k of handled) expect(listed, `${file} handles "${k}"`).toContain(k);
  });
});

const file = buildGraphFile([{ id: 'array/base/a', desc: '', tags: Tag.JS, runtime: [], dev: [], native: [] }], 'test');

describe('the ? sheet', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const app = async (hash = '#/') => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(file))));
    window.location.hash = hash;
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
  };

  it('opens on ?, closes on Esc and gives focus back', async () => {
    await app();
    const trigger = screen.getByRole('link', { name: 'Get started' });
    trigger.focus();
    act(() => void fireEvent.keyDown(window, { key: '?' }));
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(sheet.textContent).toContain('Show its web');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens from the Keyboard button in the top bar', async () => {
    await app();
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
  });

  it('does not open while typing in the search palette or the Webbed filter', async () => {
    await app();
    act(() => void fireEvent.keyDown(window, { key: 'k', ctrlKey: true }));
    const input = screen.getByRole('combobox');
    act(() => void fireEvent.keyDown(input, { key: '?' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    cleanup();
    await app('#/module/array/base/a?view=webbed');
    act(() => void fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Filter the web by id' }), { key: '?' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
  });
});
