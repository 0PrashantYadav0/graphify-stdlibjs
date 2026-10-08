import { useCallback, useEffect, useState } from 'react';
import { Graph } from '../graph/Graph';

export type GraphState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; graph: Graph };

class HttpError extends Error {}

// One load per URL for the life of the page; a failed load is dropped so Retry fetches again.
const cache = new Map<string, Promise<Graph>>();

function load(url: string): Promise<Graph> {
  let p = cache.get(url);
  if (!p) {
    p = Graph.load(async () => {
      const res = await fetch(url);
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`);
      return res.json();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function visitorMessage(err: unknown): string {
  if (err instanceof HttpError) return `The package map didn't load (${err.message}). Reload to try again.`;
  if (err instanceof TypeError) return "The package map didn't load. Check your connection and try again.";
  return "The package map didn't load: the data file is damaged. Try again later.";
}

export function useGraph(url = `${import.meta.env.BASE_URL}data/graph.json`): GraphState {
  const [state, setState] = useState<GraphState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load(url).then(
      (graph) => {
        if (!cancelled) setState({ status: 'ready', graph });
      },
      (err: unknown) => {
        // The visitor gets plain words; the detail is for whoever is debugging.
        console.error(`Could not load ${url}. In development, run "npm run extract" to regenerate it.`, err);
        if (!cancelled) setState({ status: 'error', message: visitorMessage(err), retry });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, attempt, retry]);
  return state;
}
