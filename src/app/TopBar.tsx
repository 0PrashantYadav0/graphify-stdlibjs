import { MOD_KEY } from '../search/useShortcut';
import './topbar.css';

export function TopBar({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#/">
        graphify <span className="wordmark-dot">·</span> stdlib
      </a>
      <div className="topbar-actions">
        <button type="button" className="keys-trigger" onClick={onHelp} aria-keyshortcuts="?">
          Keyboard
        </button>
        <button type="button" className="search-trigger" onClick={onSearch}>
          <span>Search packages</span>
          <kbd>{MOD_KEY} K</kbd>
        </button>
      </div>
    </header>
  );
}
