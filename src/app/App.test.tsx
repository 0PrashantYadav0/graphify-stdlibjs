// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildGraphFile } from '../graph/buildGraphFile';
import { Tag } from '../graph/tags';
import App from './App';

const file = buildGraphFile([{ id: 'array/base/a', desc: '', tags: Tag.JS, runtime: [], dev: [], native: [] }], 'test');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App loading', () => {
  it('tells a visitor the map did not load, and Retry fetches it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(file)));
    vi.stubGlobal('fetch', fetch);
    window.location.hash = '#/';
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain("The package map didn't load (HTTP 404). Reload to try again.");
    expect(console.error).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
