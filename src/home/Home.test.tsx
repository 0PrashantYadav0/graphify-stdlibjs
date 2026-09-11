// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { buildGraphFile } from '../graph/buildGraphFile';
import { Graph } from '../graph/Graph';
import { Tag } from '../graph/tags';
import { graphFromIds } from '../graph/testUtils';
import { Home } from './Home';

const g = graphFromIds(['array/base/a', 'math/base/special/lnf', 'stats/base/a'], { runtime: [['math/base/special/lnf', 'array/base/a']] });

afterEach(cleanup);

describe('Home', () => {
  it('renders the headline, the call to action, live numbers and the creator credit', () => {
    const onSearch = vi.fn();
    render(<Home graph={g} onSearch={onSearch} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Every stdlib package, wired.');
    expect(screen.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe('#/explore');
    const facts = within(screen.getByRole('list', { name: 'Graph summary' })).getAllByRole('listitem');
    expect(facts.map((li) => li.textContent)).toEqual([`${g.n} packages`, '1 runtime link', '3 namespaces', 'Built from a local stdlib checkout']);
    expect(screen.getByRole('link', { name: '0PrashantYadav0' }).getAttribute('href')).toBe('https://github.com/0PrashantYadav0');
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(onSearch).toHaveBeenCalled();
  });

  it('links the build source to the stdlib commit when the graph carries a full SHA', () => {
    const sha = 'fd5bfb49cac0b48b994a163effb4c3a1cc14d81d';
    const pinned = new Graph(buildGraphFile([{ id: 'array/base/a', desc: '', tags: Tag.JS, runtime: [], dev: [], native: [] }], sha));
    render(<Home graph={pinned} onSearch={() => {}} />);
    expect(screen.getByText(/Built from/).textContent).toBe('Built from stdlib commit fd5bfb4');
    expect(screen.getByRole('link', { name: 'fd5bfb4' }).getAttribute('href')).toBe(`https://github.com/stdlib-js/stdlib/commit/${sha}`);
  });

  it('states in the footer that the project is unofficial and unaffiliated', () => {
    render(<Home graph={g} onSearch={() => {}} />);
    expect(screen.getByText(/unofficial, third-party project/i).textContent).toBe(
      'An unofficial, third-party project. Not affiliated with, endorsed by, or sponsored by the stdlib project.',
    );
  });

  it('draws one constellation dot per root namespace', () => {
    render(<Home graph={g} onSearch={() => {}} />);
    expect(document.querySelectorAll('.const-ring')).toHaveLength(3);
  });
});
