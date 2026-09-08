import { formatRoute } from '../app/router';

export function Breadcrumb({ path }: { path: string }) {
  const segs = path ? path.split('/') : [];
  return (
    <nav className="breadcrumb" aria-label="path">
      <a href={formatRoute({ kind: 'explore', path: '' })}>stdlib</a>
      {segs.map((seg, i) => (
        <span key={segs.slice(0, i + 1).join('/')}>
          <span className="sep" aria-hidden="true">›</span>
          <a href={formatRoute({ kind: 'explore', path: segs.slice(0, i + 1).join('/') })}>{seg}</a>
        </span>
      ))}
    </nav>
  );
}
