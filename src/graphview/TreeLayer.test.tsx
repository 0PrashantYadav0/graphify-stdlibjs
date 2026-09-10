// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tag } from '../graph/tags';
import { TreeLayer, type GraphNodeLike } from './TreeLayer';
import { CanvasViewportProvider } from './viewport';

interface N extends GraphNodeLike { kids: N[] }
const leaf = (key: string, label = key): N => ({ key, label, hasChildren: false, count: 0, index: 1, kind: 'package', kids: [] });
const root: N = { key: 'root', label: 'stdlib', hasChildren: true, count: 3, index: -1, kind: 'root', kids: [
  { key: 'p:math', label: 'math', hasChildren: true, count: 2, index: -1, kind: 'package', kids: [leaf('p:math/lnf', 'lnf'), leaf('p:math/logf', 'logf')] },
  leaf('p:noop', 'noop'),
] };
const childrenOf = (n: N) => n.kids;
const tags = () => Tag.JS | Tag.C;

afterEach(cleanup);

interface MountOpts {
  onToggle?: ReturnType<typeof vi.fn>;
  onOpen?: ReturnType<typeof vi.fn>;
  direction?: 'right' | 'left';
  selectedKey?: string | null;
  hideRoot?: boolean;
  ensureVisible?: ReturnType<typeof vi.fn>;
}

function mount(expanded: Set<string>, opts: MountOpts = {}) {
  const { onToggle = vi.fn(), onOpen = vi.fn(), direction = 'right', selectedKey = null, hideRoot = false, ensureVisible = vi.fn() } = opts;
  render(
    <svg>
      <CanvasViewportProvider value={{ ensureVisible }}>
        <TreeLayer root={root} childrenOf={childrenOf} expanded={expanded} direction={direction} selectedKey={selectedKey} pathKeys={new Set(['root', 'p:math'])} onToggle={onToggle} onOpen={onOpen} getTagMask={tags} label="package tree" hideRoot={hideRoot} />
      </CanvasViewportProvider>
    </svg>,
  );
  return { onToggle, onOpen, ensureVisible };
}

const items = () => screen.getAllByRole('treeitem');
const labels = () => items().map((el) => el.getAttribute('aria-label'));
const tabStops = () => items().filter((el) => el.getAttribute('tabindex') === '0');
const item = (name: string) => screen.getByRole('treeitem', { name });

describe('TreeLayer', () => {
  it('renders only expanded branches as treeitems inside a named tree', () => {
    mount(new Set(['root']));
    expect(screen.getByRole('tree', { name: 'package tree' })).toBeTruthy();
    expect(labels()).toEqual(['stdlib, 3 packages', 'math, 2 packages', 'noop']);
    expect(item('math, 2 packages').getAttribute('aria-expanded')).toBe('false');
    expect(item('stdlib, 3 packages').getAttribute('aria-expanded')).toBe('true');
    expect(item('noop').hasAttribute('aria-expanded')).toBe(false);
  });

  it('orders rows depth-first and numbers them with aria-level, posinset and setsize', () => {
    mount(new Set(['root', 'p:math']));
    expect(labels()).toEqual(['stdlib, 3 packages', 'math, 2 packages', 'lnf', 'logf', 'noop']);
    const aria = (name: string) => {
      const el = item(name);
      return [el.getAttribute('aria-level'), el.getAttribute('aria-posinset'), el.getAttribute('aria-setsize')];
    };
    expect(aria('stdlib, 3 packages')).toEqual(['1', '1', '1']);
    expect(aria('math, 2 packages')).toEqual(['2', '1', '2']);
    expect(aria('lnf')).toEqual(['3', '1', '2']);
    expect(aria('logf')).toEqual(['3', '2', '2']);
    expect(aria('noop')).toEqual(['2', '2', '2']);
  });

  it('lifts the hidden root’s children to level 1 when hideRoot is set', () => {
    mount(new Set(['root']), { hideRoot: true });
    expect(labels()).toEqual(['math, 2 packages', 'noop']);
    expect(item('math, 2 packages').getAttribute('aria-level')).toBe('1');
    expect(item('noop').getAttribute('aria-posinset')).toBe('2');
    expect(item('noop').getAttribute('aria-setsize')).toBe('2');
  });

  it('toggles a branch on click and Enter, opens a leaf on click and Space', () => {
    const { onToggle, onOpen } = mount(new Set(['root', 'p:math']));
    fireEvent.click(item('math, 2 packages'));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math' }));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    fireEvent.click(item('lnf'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math/lnf' }));
    fireEvent.keyDown(item('logf'), { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps exactly one tab stop, starting on the selected node and following focus', () => {
    mount(new Set(['root', 'p:math']), { selectedKey: 'p:math/logf' });
    expect(tabStops().map((el) => el.getAttribute('aria-label'))).toEqual(['logf']);
    fireEvent.keyDown(item('logf'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('noop'));
    expect(tabStops().map((el) => el.getAttribute('aria-label'))).toEqual(['noop']);
    expect(item('logf').getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the first row for the tab stop when nothing is selected', () => {
    mount(new Set(['root']));
    expect(tabStops().map((el) => el.getAttribute('aria-label'))).toEqual(['stdlib, 3 packages']);
  });

  it('moves focus through visible rows with Up, Down, Home and End', () => {
    mount(new Set(['root', 'p:math']));
    fireEvent.keyDown(item('stdlib, 3 packages'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('math, 2 packages'));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('lnf'));
    fireEvent.keyDown(item('lnf'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('math, 2 packages'));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'End' });
    expect(document.activeElement).toBe(item('noop'));
    fireEvent.keyDown(item('noop'), { key: 'Home' });
    expect(document.activeElement).toBe(item('stdlib, 3 packages'));
  });

  it('skips the rows inside a collapsed subtree', () => {
    mount(new Set(['root']));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('noop'));
  });

  it('expands with Right, then descends into the first child on a second Right', () => {
    const collapsed = mount(new Set(['root']));
    item('math, 2 packages').focus();
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowRight' });
    expect(collapsed.onToggle).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math' }));
    expect(document.activeElement).toBe(item('math, 2 packages')); // expanding does not move focus
    cleanup();
    const open = mount(new Set(['root', 'p:math']));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowRight' });
    expect(open.onToggle).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(item('lnf'));
  });

  it('collapses with Left, and ascends to the parent when there is nothing to collapse', () => {
    const { onToggle } = mount(new Set(['root', 'p:math']));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowLeft' });
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math' }));
    fireEvent.keyDown(item('lnf'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('math, 2 packages'));
    fireEvent.keyDown(item('stdlib, 3 packages'), { key: 'ArrowLeft' });
    expect(onToggle).toHaveBeenCalledTimes(2); // the root collapses; it has no parent to ascend to
  });

  it('mirrors Left and Right for a left-growing tree', () => {
    const { onToggle } = mount(new Set(['root', 'p:math']), { direction: 'left' });
    fireEvent.keyDown(item('lnf'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('math, 2 packages'));
    fireEvent.keyDown(item('math, 2 packages'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('lnf'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('asks the canvas to bring a newly focused node into view', () => {
    const { ensureVisible } = mount(new Set(['root', 'p:math']));
    fireEvent.keyDown(item('stdlib, 3 packages'), { key: 'End' });
    expect(ensureVisible).toHaveBeenCalledTimes(1);
    const noop = item('noop');
    const [x, y] = noop.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number);
    expect(ensureVisible).toHaveBeenCalledWith({ x: x + 130, y: y + 20 }); // node box centre
  });

  it('marks the selected node, path nodes and links, and renders tag pills on leaves', () => {
    mount(new Set(['root', 'p:math']), { selectedKey: 'p:math' });
    expect(item('math, 2 packages').getAttribute('aria-selected')).toBe('true');
    expect(item('noop').hasAttribute('aria-selected')).toBe(false);
    expect(item('math, 2 packages').classList.contains('on-path')).toBe(true);
    expect(document.querySelectorAll('path.glink.on-path')).toHaveLength(1);
    expect(item('lnf').querySelectorAll('.spill')).toHaveLength(2);
  });
});
