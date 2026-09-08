import { TAG_LABEL } from '../graph/tags';

const ENTRIES: Array<[keyof typeof TAG_LABEL, string]> = [
  ['JS', 'JavaScript implementation'],
  ['C', 'C implementation'],
  ['FORTRAN', 'Fortran implementation'],
  ['WASM', 'WebAssembly build'],
  ['NATIVE', 'JS bridge to the native add-on'],
  ['CLI', 'command-line interface'],
];

export function Legend() {
  return (
    <footer className="legend">
      {ENTRIES.map(([tag, text]) => (
        <span key={tag} className="legend-item">
          <span className={`pill pill-${TAG_LABEL[tag]}`}>{TAG_LABEL[tag]}</span> {text}
        </span>
      ))}
    </footer>
  );
}
