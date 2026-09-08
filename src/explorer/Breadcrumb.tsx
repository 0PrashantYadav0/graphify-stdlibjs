import { formatRoute } from '../app/router';

export function Breadcrumb({ path, group }: { path: string; group: string | null }) {
  const segs = path ? path.split('/') : [];
  const crumbs = segs.map((seg, i) => ({ label: seg, href: formatRoute({ kind: 'explore', path: segs.slice(0, i + 1).join('/'), group: null }) }));
  return (
    <nav className="breadcrumb" aria-label="path">
      <a href="#/">stdlib</a>
      {crumbs.map((c) => (
        <span key={c.href}>
          <span className="sep" aria-hidden="true">›</span>
          <a href={c.href}>{c.label}</a>
        </span>
      ))}
      {group && (
        <span>
          <span className="sep" aria-hidden="true">›</span>
          <span>{group}…</span>
        </span>
      )}
    </nav>
  );
}
