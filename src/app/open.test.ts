import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { routeForPackage } from './open';

const g = graphFromIds(['math/base/special/logf']);

describe('routeForPackage', () => {
  it('opens a package in its module view, keeping the edge kinds', () => {
    expect(routeForPackage(g, g.indexOf('math/base/special/logf'), ['runtime', 'dev'])).toMatchObject({ kind: 'module', id: 'math/base/special/logf', edges: ['runtime', 'dev'] });
  });
  it('opens a bookkeeping folder in the explorer', () => {
    expect(routeForPackage(g, g.indexOf('math/base'))).toEqual({ kind: 'explore', path: 'math/base' });
  });
});
