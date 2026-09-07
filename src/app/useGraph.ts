import { useEffect, useState } from 'react';
import { Graph } from '../graph/Graph';
import type { GraphFile } from '../graph/types';

export type GraphState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

export function useGraph(url = `${import.meta.env.BASE_URL}data/graph.json`): GraphState {
  const [state, setState] = useState<GraphState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}). Run "npm run extract" first.`);
        const file = (await res.json()) as GraphFile;
        if (!cancelled) setState({ status: 'ready', graph: new Graph(file) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}
