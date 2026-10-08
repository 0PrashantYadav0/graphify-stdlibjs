// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { routes } from '../app/router';
import { graphFromIds } from '../graph/testUtils';
import { Focus } from '../focus/Focus';
import { impactList, impactSet } from './impact';

// a → b, a → c, b → d, c → d, d → e (runtime); x → a (dev).
const g = graphFromIds(['p/a', 'p/b', 'p/c', 'p/d', 'p/e', 'q/x'], {
  runtime: [['p/a', 'p/b'], ['p/a', 'p/c'], ['p/b', 'p/d'], ['p/c', 'p/d'], ['p/d', 'p/e']],
  dev: [['q/x', 'p/a']],
});
const webbed = (id = 'p/a', opts = {}) => render(<Focus graph={g} route={routes.module(id, { view: 'webbed', ...opts })} />);
const option = (id: string) => screen.getByRole('option', { name: new RegExp(`^${id.replace('/', '\\/')},`) });
const chain = () => within(screen.getByRole('list', { name: 'shortest chain' })).getAllByRole('listitem').map((li) => li.textContent);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Webbed', () => {
  it('switches between Direct and Webbed through the URL', () => {
    window.location.hash = '#/module/p/a';
    render(<Focus graph={g} route={routes.module('p/a')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Webbed' }));
    expect(window.location.hash).toBe('#/module/p/a?view=webbed');
    cleanup();
    webbed();
    expect(screen.getByRole('button', { name: 'Webbed' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Direct' }));
    expect(window.location.hash).toBe('#/module/p/a');
  });

  it('lists every package once, one listbox per distance', () => {
    webbed();
    expect(screen.getByText('4 packages, 3 steps deep')).toBeTruthy();
    const boxes = screen.getAllByRole('listbox');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['this package', '2 packages, 1 step out', '1 package, 2 steps out', '1 package, 3 steps out']);
    expect(within(boxes[2]).getAllByRole('option')).toHaveLength(1); // d, reached twice, listed once
    expect(option('p/b').getAttribute('aria-label')).toBe('p/b, 2 in its own web');
  });

  it('shows why a selected package is here, and what it links to', () => {
    webbed();
    fireEvent.click(option('p/d'));
    expect(chain()).toEqual(['p/a', 'p/b', 'p/d']);
    expect(option('p/d').getAttribute('aria-selected')).toBe('true');
    expect(option('p/b').className).toContain('is-up');
    expect(option('p/c').className).toContain('is-up');
    expect(option('p/e').className).toContain('is-down');
    expect(screen.getByRole('link', { name: 'Focus on d' }).getAttribute('href')).toBe('#/module/p/d');
    expect(screen.getByRole('link', { name: 'Show its web' }).getAttribute('href')).toBe('#/module/p/d?view=webbed');
  });

  it('runs the other way, keeping the edge kinds', () => {
    window.location.hash = '#/module/p/e?view=webbed';
    webbed('p/e', { edges: ['runtime', 'dev'] });
    fireEvent.click(screen.getByRole('button', { name: 'What requires it' }));
    expect(window.location.hash).toBe('#/module/p/e?view=webbed&dir=in&edges=runtime,dev');
    cleanup();
    webbed('p/e', { edges: ['runtime', 'dev'], dir: 'in' });
    expect(screen.getByText('5 packages, 4 steps deep')).toBeTruthy(); // d, b c, a, then x through dev
  });

  it('follows the ADR-0004 keyboard model', () => {
    window.location.hash = '#/module/p/a?view=webbed';
    webbed();
    const tabStops = () => screen.getAllByRole('option').filter((o) => o.tabIndex === 0);
    expect(tabStops().map((o) => o.getAttribute('data-index'))).toEqual([String(g.indexOf('p/a'))]);
    fireEvent.keyDown(option('p/a'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(option('p/b')); // first linked row in the next column
    expect(chain()).toEqual(['p/a', 'p/b']); // selection follows focus
    fireEvent.keyDown(option('p/b'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(option('p/c'));
    fireEvent.keyDown(option('p/c'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(option('p/d'));
    fireEvent.keyDown(option('p/d'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(option('p/b')); // first of its up links, not back to c
    expect(tabStops()).toHaveLength(1);
    fireEvent.keyDown(option('p/b'), { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/p/b?view=webbed');
    fireEvent.keyDown(option('p/b'), { key: 'Enter', shiftKey: true });
    expect(window.location.hash).toBe('#/module/p/b');
  });

  it('filters every column at once', () => {
    webbed();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter the web by id' }), { target: { value: 'p/c' } });
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.queryByRole('option', { name: /^p\/b,/ })).toBeNull();
  });
});

describe('Impact', () => {
  // x changes. Runtime: a → x, b → a. Native: n → x. Dev: t → a, v → x, w → t (w must not count).
  const h = graphFromIds(['m/a', 'm/b', 'p/n', 'p/t', 'p/v', 'p/w', 'p/x'], {
    runtime: [['m/a', 'p/x'], ['m/b', 'm/a']],
    native: [['p/n', 'p/x']],
    dev: [['p/t', 'm/a'], ['p/v', 'p/x'], ['p/w', 'p/t']],
  });
  const all = { edges: ['runtime', 'dev', 'native'], view: 'webbed' as const, dir: 'in' as const };
  const bucket = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} `) });

  it('opens from the card with every edge kind on, and the card agrees with impactSet', () => {
    render(<Focus graph={h} route={routes.module('p/x')} />);
    const link = screen.getByRole('link', { name: /^Impact/ });
    expect(link.getAttribute('href')).toBe('#/module/p/x?view=webbed&dir=in&edges=runtime,dev,native');
    expect(link.getAttribute('title')).toBe('If it changes: 2 runtime · 1 rebuild · 2 tests');
    expect(link.textContent).toBe('Impact 5');
  });

  it('shows the buckets on "What requires it" only, with the impactSet counts', () => {
    render(<Focus graph={h} route={routes.module('p/x', { ...all, dir: 'out' })} />);
    expect(screen.queryByRole('group', { name: 'impact buckets' })).toBeNull();
    cleanup();
    render(<Focus graph={h} route={routes.module('p/x', all)} />);
    const set = impactSet(h, h.indexOf('p/x'));
    expect(bucket('Runtime').textContent).toBe(`Runtime ${set.runtime.length}`);
    expect(bucket('Rebuild').textContent).toBe(`Rebuild ${set.rebuild.length}`);
    expect(bucket('Tests').textContent).toBe(`Tests ${set.tests.length}`);
  });

  it('filters the strata to a bucket, and to a namespace', () => {
    render(<Focus graph={h} route={routes.module('p/x', all)} />);
    fireEvent.click(bucket('Tests'));
    const shown = () => screen.getAllByRole('option').map((o) => o.getAttribute('aria-label')!.split(',')[0]);
    expect(shown()).toEqual(['p/x', 'p/v', 'p/t']); // by column; w is in the dev web but not affected
    fireEvent.click(bucket('Tests'));
    fireEvent.click(within(screen.getByRole('group', { name: 'by namespace' })).getByRole('button', { name: 'm 2' }));
    expect(shown()).toEqual(['p/x', 'm/a', 'm/b']);
  });

  it('copies the affected ids grouped by bucket', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<Focus graph={h} route={routes.module('p/x', all)} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy list' })));
    expect(writeText).toHaveBeenCalledWith(impactList(h, impactSet(h, h.indexOf('p/x'))));
    expect(writeText.mock.calls[0][0]).toContain('# tests (2)\np/t\np/v\n');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });
});
