// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Legend } from './Legend';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const media = (matches: boolean) => vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }));

describe('Legend', () => {
  it('explains the edge kinds as well as the tags', () => {
    render(<Legend />);
    expect(screen.getByText(/Edges:/).textContent).toBe('Edges: runtime needed to run · dev only tests, benchmarks, examples · native builds the C/Fortran add-on');
  });

  it('starts open on a wide screen and closed on a phone', () => {
    media(false);
    render(<Legend />);
    expect(document.querySelector('details.legend')!.hasAttribute('open')).toBe(true);
    cleanup();
    media(true);
    render(<Legend />);
    expect(document.querySelector('details.legend')!.hasAttribute('open')).toBe(false);
  });
});
