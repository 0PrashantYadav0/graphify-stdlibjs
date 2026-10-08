import { MOD_KEY } from '../search/useShortcut';

export interface Shortcut {
  /** KeyboardEvent.key values this row covers; a test checks every handled key is listed. */
  keys: string[];
  /** How the keys are written in the sheet. */
  show: string;
  what: string;
}

/** Every key binding in the app, grouped by where it works. The `?` sheet renders this. */
export const SHORTCUTS: Array<{ group: string; items: Shortcut[] }> = [
  {
    group: 'Anywhere',
    items: [
      { keys: ['k'], show: `${MOD_KEY} K`, what: 'Search packages' },
      { keys: ['/'], show: '/', what: 'Search packages' },
      { keys: ['?'], show: '?', what: 'Show these shortcuts' },
    ],
  },
  {
    group: 'Graph trees (explorer and direct view)',
    items: [
      { keys: ['ArrowUp', 'ArrowDown'], show: '↑ ↓', what: 'Move between visible nodes' },
      { keys: ['ArrowRight', 'ArrowLeft'], show: '→ ←', what: 'Expand / collapse (mirrored on the "requires" side)' },
      { keys: ['Home', 'End'], show: 'Home End', what: 'First / last node' },
      { keys: ['Enter', ' '], show: 'Enter Space', what: 'Open a package, or expand a folder' },
      { keys: ['Escape'], show: 'Esc', what: 'Leave the tree: to the breadcrumb, or the module card' },
    ],
  },
  {
    group: 'Webbed',
    items: [
      { keys: ['ArrowUp', 'ArrowDown'], show: '↑ ↓', what: 'Move within a column' },
      { keys: ['ArrowRight', 'ArrowLeft'], show: '→ ←', what: 'Next / previous column, landing on a linked package' },
      { keys: ['Home', 'End'], show: 'Home End', what: 'First / last in the column' },
      { keys: ['Enter'], show: 'Enter', what: 'Show its web' },
      { keys: ['Enter'], show: 'Shift Enter', what: 'Focus on it (direct view)' },
      { keys: ['Escape'], show: 'Esc', what: 'Leave the columns, to the module card' },
    ],
  },
  {
    group: 'Search',
    items: [
      { keys: ['ArrowUp', 'ArrowDown'], show: '↑ ↓', what: 'Move between results' },
      { keys: ['Enter'], show: 'Enter', what: 'Open the result' },
      { keys: ['Escape'], show: 'Esc', what: 'Close' },
    ],
  },
];
