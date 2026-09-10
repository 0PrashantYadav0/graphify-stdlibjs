import type { Graph } from '../graph/Graph';
import { Constellation } from './ConstellationView';
import './home.css';

const fmt = new Intl.NumberFormat('en-US');
const CREATOR = '0PrashantYadav0';
const FULL_SHA = /^[0-9a-f]{40}$/;

export function Home({ graph, onSearch }: { graph: Graph; onSearch: () => void }) {
  const runtime = countEdges(graph);
  const namespaces = graph.children(-1).length;
  const source = FULL_SHA.test(graph.source) ? `Built from stdlib commit ${graph.source.slice(0, 7)}.` : 'Built from a local stdlib checkout.';
  return (
    <section className="home">
      <div className="hero">
        <Constellation graph={graph} />
        <div className="hero-copy">
          <h1 className="hero-title">Every stdlib package, wired.</h1>
          <p className="hero-lead">
            Walk the tree from stdlib down to any of {fmt.format(graph.n)} packages, or search one and see what it needs and who needs it.
          </p>
          <div className="hero-actions">
            <a className="button-primary" href="#/explore">Get started</a>
            <button type="button" className="button-quiet" onClick={onSearch}>Search <kbd>⌘ K</kbd></button>
          </div>
        </div>
      </div>
      <footer className="home-foot">
        <p className="home-stats mono">
          {fmt.format(graph.n)} packages. {fmt.format(runtime)} runtime {runtime === 1 ? 'link' : 'links'} across {namespaces} namespaces. {source}
        </p>
        <p className="home-credit">
          Made by <a href={`https://github.com/${CREATOR}`} target="_blank" rel="noreferrer">{CREATOR}</a>
        </p>
        <p className="home-disclaimer">
          An unofficial, third-party project. Not affiliated with, endorsed by, or sponsored by the stdlib project.
        </p>
      </footer>
    </section>
  );
}

function countEdges(graph: Graph): number {
  let total = 0;
  for (let i = 0; i < graph.n; i++) total += graph.deps(i, 'runtime').length;
  return total;
}
