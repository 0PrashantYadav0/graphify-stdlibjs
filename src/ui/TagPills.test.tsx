// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TagPills } from './TagPills';
import { Tag } from '../graph/tags';

afterEach(cleanup);

describe('TagPills', () => {
  it('renders one pill per implementation tag, in order', () => {
    render(<TagPills mask={Tag.JS | Tag.C | Tag.NATIVE | Tag.CLI} />);
    expect(screen.getAllByTestId('pill').map((el) => el.textContent)).toEqual(['js', 'c', 'native', 'cli']);
  });
  it('hides namespace and folder bits', () => {
    const { container } = render(<TagPills mask={Tag.NAMESPACE | Tag.FOLDER} />);
    expect(container.querySelectorAll('[data-testid="pill"]')).toHaveLength(0);
  });
});
