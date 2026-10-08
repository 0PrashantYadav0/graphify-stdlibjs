import { useEffect } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** The modifier for the search shortcut, as this platform labels it. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

/**
 * Opens the palette on ⌘K / Ctrl+K anywhere and on "/" when not typing in a field, and
 * the shortcuts sheet on "?" when not typing.
 */
export function useShortcut(onOpen: () => void, onHelp?: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
        return;
      }
      const plain = !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (e.key === '/' && plain) {
        e.preventDefault();
        onOpen();
      } else if (e.key === '?' && plain && onHelp) {
        e.preventDefault();
        onHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, onHelp]);
}
