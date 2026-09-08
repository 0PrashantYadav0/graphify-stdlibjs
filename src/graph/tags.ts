export const Tag = {
  JS: 1,
  C: 2,
  FORTRAN: 4,
  NATIVE: 8,
  WASM: 16,
  CLI: 32,
  NAMESPACE: 64,
  FOLDER: 128,
} as const;

export type TagName = keyof typeof Tag;

export const TAG_ORDER: TagName[] = ['JS', 'C', 'FORTRAN', 'WASM', 'NATIVE', 'CLI', 'NAMESPACE', 'FOLDER'];

export const TAG_LABEL: Record<TagName, string> = {
  JS: 'js',
  C: 'c',
  FORTRAN: 'f',
  WASM: 'wasm',
  NATIVE: 'native',
  CLI: 'cli',
  NAMESPACE: 'ns',
  FOLDER: 'dir',
};

export const SHOWN_TAGS: TagName[] = ['JS', 'C', 'FORTRAN', 'WASM', 'NATIVE', 'CLI'];

export const TAG_DESCRIPTION: Record<TagName, string> = {
  JS: 'JavaScript implementation',
  C: 'C implementation',
  FORTRAN: 'Fortran implementation',
  WASM: 'WebAssembly build',
  NATIVE: 'JS bridge to the native add-on',
  CLI: 'command-line interface',
  NAMESPACE: 'namespace',
  FOLDER: 'folder',
};

export function decodeTags(mask: number): TagName[] {
  return TAG_ORDER.filter((t) => (mask & Tag[t]) !== 0);
}

export function hasTag(mask: number, name: TagName): boolean {
  return (mask & Tag[name]) !== 0;
}
