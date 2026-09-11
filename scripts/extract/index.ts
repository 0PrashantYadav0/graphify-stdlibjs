import fs from 'node:fs';
import path from 'node:path';
import { buildGraphFile } from '../../src/graph/buildGraphFile';
import { checkDirty, resolveSource } from './gitState';
import { scanAll } from './scan';

const args = process.argv.slice(2);
const arg = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stdlibRoot = path.resolve(arg('--stdlib', '../stdlib'));
const out = path.resolve(arg('--out', 'public/data/graph.json'));
const root = path.join(stdlibRoot, 'lib', 'node_modules', '@stdlib');
const allowDirty = args.includes('--allow-dirty');

if (!fs.existsSync(root)) {
  console.error(`No stdlib packages at ${root}. Pass --stdlib <path-to-stdlib-checkout>.`);
  process.exit(1);
}

// A non-git checkout resolves source to "unknown" — that is unknown
// provenance, not dirtiness, and extraction proceeds as before. Only a real
// git checkout gets checked for uncommitted/untracked changes, and only
// within lib/node_modules/@stdlib: that is the only part of the tree the
// scan actually reads, so dirtiness elsewhere (docs, scripts, a README edit)
// is not a reason to refuse.
const { source, isGitCheckout } = resolveSource(stdlibRoot);
let sourceDirty = false;
let dirtyFileCount = 0;
if (isGitCheckout) {
  const scopeRelPath = path.relative(stdlibRoot, root).split(path.sep).join('/');
  const state = checkDirty(stdlibRoot, scopeRelPath);
  sourceDirty = state.dirty;
  dirtyFileCount = state.fileCount;
}

if (sourceDirty && !allowDirty) {
  console.error(
    `${stdlibRoot} has ${dirtyFileCount} uncommitted/untracked change(s) under lib/node_modules/@stdlib.\n` +
      `Extracting now would bake that work-in-progress into graph.json while stamping it with commit ${source} — ` +
      `the same source would no longer reproduce the same graph.json.\n` +
      'Commit or stash those changes, or pass --allow-dirty to proceed anyway (graph.json will record sourceDirty: true).',
  );
  process.exit(1);
}
if (sourceDirty) {
  console.warn(
    `Warning: extracting from a dirty checkout (${dirtyFileCount} uncommitted/untracked change(s) under lib/node_modules/@stdlib). Recording sourceDirty: true.`,
  );
}

console.time('scan');
const pkgs = scanAll(root);
console.timeEnd('scan');

const file = buildGraphFile(pkgs, source);
// sourceDirty/dirtyFileCount are appended to the written JSON without
// changing the GraphFile shape/type in src/graph — they're additive fields
// that existing consumers (e.g. src/home/Home.tsx, which only reads
// graph.source and tests it against a 40-char SHA regex) simply ignore.
const output = sourceDirty ? { ...file, sourceDirty: true, dirtyFileCount } : file;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(output));

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(
  `nodes ${file.ids.length}  runtime ${file.runtime.targets.length}  dev ${file.dev.targets.length}  native ${file.native.targets.length}  → ${out} (${kb} KB)${sourceDirty ? '  [dirty]' : ''}`,
);
