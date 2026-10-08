import { useState } from 'react';
import { SHOWN_TAGS, TAG_DESCRIPTION, TAG_LABEL } from '../graph/tags';
import './pills.css';

const NARROW = '(max-width: 719px)';

/** Tags and edge kinds. On a phone it starts closed behind a "Legend" summary; elsewhere it is always open. */
export function Legend() {
  const [open, setOpen] = useState(() => typeof window.matchMedia !== 'function' || !window.matchMedia(NARROW).matches);
  return (
    <details className="legend" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="legend-summary">Legend</summary>
      <div className="legend-body">
        {SHOWN_TAGS.map((tag) => (
          <span key={tag} className="legend-item">
            <span className={`pill pill-${TAG_LABEL[tag]}`}>{TAG_LABEL[tag]}</span> {TAG_DESCRIPTION[tag]}
          </span>
        ))}
        <span className="legend-item legend-edges">
          Edges: <b>runtime</b> needed to run · <b>dev</b> only tests, benchmarks, examples · <b>native</b> builds the C/Fortran add-on
        </span>
      </div>
    </details>
  );
}
