import { decodeTags, SHOWN_TAGS, TAG_LABEL } from '../graph/tags';
import './pills.css';

export function TagPills({ mask }: { mask: number }) {
  const tags = decodeTags(mask).filter((t) => SHOWN_TAGS.includes(t));
  if (tags.length === 0) return null;
  return (
    <span className="pills" aria-label={`implementations: ${tags.map((t) => TAG_LABEL[t]).join(', ')}`}>
      {tags.map((t) => (
        <span key={t} className={`pill pill-${TAG_LABEL[t]}`} data-testid="pill">
          {TAG_LABEL[t]}
        </span>
      ))}
    </span>
  );
}
