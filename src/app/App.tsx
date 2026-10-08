import { useCallback, useEffect, useState } from 'react';
import { GraphExplorer } from '../explorer/GraphExplorer';
import { Focus } from '../focus/Focus';
import { Home } from '../home/Home';
import { SearchPalette } from '../search/SearchPalette';
import { useShortcut } from '../search/useShortcut';
import { TopBar } from './TopBar';
import { useGraph } from './useGraph';
import { titleFor, useRoute } from './router';
import { Legend } from '../ui/Legend';
import { ShortcutsSheet } from '../ui/ShortcutsSheet';
import './app.css';

export default function App() {
  const state = useGraph();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  useShortcut(openSearch, searchOpen || helpOpen ? undefined : openHelp);
  useEffect(() => {
    document.title = titleFor(route);
  }, [route]);

  let content;
  if (state.status === 'loading') content = <p className="app-note muted">Loading the package map…</p>;
  else if (state.status === 'error')
    content = (
      <div className="app-note" role="alert">
        <p>{state.message}</p>
        <button type="button" className="button-quiet" onClick={state.retry}>Retry</button>
      </div>
    );
  else if (route.kind === 'home') content = <Home graph={state.graph} onSearch={openSearch} />;
  else if (route.kind === 'explore') content = <GraphExplorer graph={state.graph} path={route.path} />;
  else content = <Focus graph={state.graph} route={route} />;

  return (
    <div className="app">
      <TopBar onSearch={openSearch} onHelp={openHelp} />
      <main className="app-main">{content}</main>
      {route.kind !== 'home' && <Legend />}
      {searchOpen && state.status === 'ready' && <SearchPalette graph={state.graph} onClose={closeSearch} />}
      {helpOpen && <ShortcutsSheet onClose={closeHelp} />}
    </div>
  );
}
