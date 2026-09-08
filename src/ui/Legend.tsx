import { SHOWN_TAGS, TAG_DESCRIPTION, TAG_LABEL } from '../graph/tags';
import './pills.css';

export function Legend() {
  return (
    <footer className="legend">
      {SHOWN_TAGS.map((tag) => (
        <span key={tag} className="legend-item">
          <span className={`pill pill-${TAG_LABEL[tag]}`}>{TAG_LABEL[tag]}</span> {TAG_DESCRIPTION[tag]}
        </span>
      ))}
    </footer>
  );
}
