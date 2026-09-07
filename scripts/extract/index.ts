import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildGraphFile } from '../../src/graph/buildGraphFile';
import { scanAll } from './scan';

const args = process.argv.slice(2);
const arg = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stdlibRoot = path.resolve(arg('--stdlib', '../stdlib'));
const out = path.resolve(arg('--out', 'public/data/graph.json'));
const root = path.join(stdlibRoot, 'lib', 'node_modules', '@stdlib');

if (!fs.existsSync(root)) {
  console.error(`No stdlib packages at ${root}. Pass --stdlib <path-to-stdlib-checkout>.`);
  process.exit(1);
}

let source = 'unknown';
try {
  source = execSync('git rev-parse HEAD', { cwd: stdlibRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* not a git checkout; keep "unknown" */
}

console.time('scan');
const pkgs = scanAll(root);
console.timeEnd('scan');

const file = buildGraphFile(pkgs, source);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(file));

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(
  `nodes ${file.ids.length}  runtime ${file.runtime.targets.length}  dev ${file.dev.targets.length}  native ${file.native.targets.length}  → ${out} (${kb} KB)`,
);
