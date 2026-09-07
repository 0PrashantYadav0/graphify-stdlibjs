import './topbar.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#/">
        graphify <span className="wordmark-dot">·</span> stdlib
      </a>
      <button type="button" className="search-trigger" onClick={onSearch}>
        <span>Search packages</span>
        <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
    </header>
  );
}
