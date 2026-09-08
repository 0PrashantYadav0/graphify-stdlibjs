import { useCallback, useState } from 'react';
import { GraphExplorer } from '../explorer/GraphExplorer';
import { Focus } from '../focus/Focus';
import { Home } from '../home/Home';
import { SearchPalette } from '../search/SearchPalette';
import { useShortcut } from '../search/useShortcut';
import { TopBar } from './TopBar';
import { useGraph } from './useGraph';
import { useRoute } from './router';
import { Legend } from '../ui/Legend';
import './app.css';

export default function App() {
  const state = useGraph();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useShortcut(openSearch);

  let content;
  if (state.status === 'loading') content = <p className="app-note muted">Loading the package map…</p>;
  else if (state.status === 'error') content = <p className="app-note">{state.message}</p>;
  else if (route.kind === 'home') content = <Home graph={state.graph} onSearch={openSearch} />;
  else if (route.kind === 'explore') content = <GraphExplorer graph={state.graph} path={route.path} />;
  else content = <Focus graph={state.graph} id={route.id} edges={route.edges} />;

  return (
    <div className="app">
      <TopBar onSearch={openSearch} />
      <main className="app-main">{content}</main>
      <Legend />
      {searchOpen && state.status === 'ready' && <SearchPalette graph={state.graph} onClose={closeSearch} />}
    </div>
  );
}
