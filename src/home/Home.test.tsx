// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/packages\./).textContent).toContain(`${g.n} packages.`);
    expect(screen.getByText(/runtime link/).textContent).toContain('1 runtime link');
    expect(screen.getByRole('link', { name: '0PrashantYadav0' }).getAttribute('href')).toBe('https://github.com/0PrashantYadav0');
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(onSearch).toHaveBeenCalled();
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
