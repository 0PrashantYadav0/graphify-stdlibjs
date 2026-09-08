import { useState } from 'react';
import { Explorer } from '../explorer/Explorer';
import { TopBar } from './TopBar';
import { useGraph } from './useGraph';
import { useRoute } from './router';
import './app.css';

export default function App() {
  const state = useGraph();
  const route = useRoute();
  const [, setSearchOpen] = useState(false);

  let content;
  if (state.status === 'loading') content = <p className="app-note muted">Loading the package map…</p>;
  else if (state.status === 'error') content = <p className="app-note">{state.message}</p>;
  else if (route.kind === 'explore') content = <Explorer graph={state.graph} path={route.path} group={route.group} />;
  else content = <Explorer graph={state.graph} path={route.id.slice(0, route.id.lastIndexOf('/'))} group={null} />;

  return (
    <div className="app">
      <TopBar onSearch={() => setSearchOpen(true)} />
      <main className="app-main">{content}</main>
    </div>
  );
}
