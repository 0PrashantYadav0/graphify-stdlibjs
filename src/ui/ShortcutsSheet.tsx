import { useEffect, useRef } from 'react';
import { SHORTCUTS } from './shortcuts';
import '../search/search.css';
import './shortcuts.css';

/** The `?` sheet: same dialog pattern as the search palette (scrim, aria-modal, trapped Tab, Esc). */
export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // the Close button is the sheet's only stop
      e.preventDefault();
      closeRef.current?.focus();
    }
  };
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette shortcuts" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <header className="shortcuts-head">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="shortcuts-close" onClick={onClose}>Close</button>
        </header>
        <div className="shortcuts-body">
          {SHORTCUTS.map(({ group, items }) => (
            <section key={group}>
              <h3>{group}</h3>
              <dl>
                {items.map((s) => (
                  <div key={s.show + s.what}>
                    <dt>{s.show.split(' ').map((k) => <kbd key={k}>{k}</kbd>)}</dt>
                    <dd>{s.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
