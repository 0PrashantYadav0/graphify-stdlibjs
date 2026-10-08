// The committed graph.json, loaded the way the app loads it, so specs assert against
// whatever the weekly refresh last wrote rather than pinned numbers.
import { readFileSync } from 'node:fs';
import { Graph } from '../src/graph/Graph';
import type { GraphFile } from '../src/graph/types';

export const graph = new Graph(JSON.parse(readFileSync(new URL('../public/data/graph.json', import.meta.url), 'utf8')) as GraphFile);
export const fmt = new Intl.NumberFormat('en-US');
