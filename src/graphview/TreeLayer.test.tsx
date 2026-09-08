// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tag } from '../graph/tags';
import { TreeLayer, type GraphNodeLike } from './TreeLayer';

interface N extends GraphNodeLike { kids: N[] }
const leaf = (key: string, label = key): N => ({ key, label, hasChildren: false, count: 0, index: 1, kind: 'package', kids: [] });
const root: N = { key: 'root', label: 'stdlib', hasChildren: true, count: 3, index: -1, kind: 'root', kids: [
  { key: 'p:math', label: 'math', hasChildren: true, count: 2, index: -1, kind: 'package', kids: [leaf('p:math/lnf', 'lnf'), leaf('p:math/logf', 'logf')] },
  leaf('p:noop', 'noop'),
] };
const childrenOf = (n: N) => n.kids;
const tags = () => Tag.JS | Tag.C;

afterEach(cleanup);

function mount(expanded: Set<string>, onToggle = vi.fn(), onOpen = vi.fn()) {
  render(
    <svg>
      <TreeLayer root={root} childrenOf={childrenOf} expanded={expanded} direction="right" selectedKey={null} pathKeys={new Set(['root', 'p:math'])} onToggle={onToggle} onOpen={onOpen} getTagMask={tags} />
    </svg>,
  );
  return { onToggle, onOpen };
}

describe('TreeLayer', () => {
  it('renders only expanded branches as focusable nodes with labels and a count', () => {
    mount(new Set(['root']));
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['stdlib, 3 packages', 'math, 2 packages', 'noop']);
    expect(screen.getByLabelText('math, 2 packages').getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles a branch on click and Enter, opens a leaf on click and Space', () => {
    const { onToggle, onOpen } = mount(new Set(['root', 'p:math']));
    fireEvent.click(screen.getByLabelText('math, 2 packages'));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math' }));
    fireEvent.keyDown(screen.getByLabelText('math, 2 packages'), { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByLabelText('lnf'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'p:math/lnf' }));
    fireEvent.keyDown(screen.getByLabelText('logf'), { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('marks path nodes and links, and renders tag pills on leaves', () => {
    mount(new Set(['root', 'p:math']));
    expect(screen.getByLabelText('math, 2 packages').classList.contains('on-path')).toBe(true);
    expect(document.querySelectorAll('path.glink.on-path')).toHaveLength(1);
    expect(screen.getByLabelText('lnf').querySelectorAll('.spill')).toHaveLength(2);
  });
});
