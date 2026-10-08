import { MOD_KEY } from '../search/useShortcut';
import './topbar.css';

export function TopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#/">
        graphify <span className="wordmark-dot">·</span> stdlib
      </a>
      <button type="button" className="search-trigger" onClick={onSearch}>
        <span>Search packages</span>
        <kbd>{MOD_KEY} K</kbd>
      </button>
    </header>
  );
}
