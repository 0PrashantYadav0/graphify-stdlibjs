import fs from 'node:fs';
import path from 'node:path';
import { Tag } from '../../src/graph/tags';

export interface ScannedPackage {
  id: string;
  desc: string;
  tags: number;
  runtime: Set<string>;
  dev: Set<string>;
  native: Set<string>;
}

const SKIP_DIRS = new Set([
  'node_modules', 'test', 'benchmark', 'docs', 'lib', 'src', 'include',
  'examples', 'etc', 'bin', 'scripts', 'data', '__tests__',
]);
const REQUIRE_RE = /require\(\s*['"]@stdlib\/([^'"]+)['"]\s*\)/g;

export function findPackageDirs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (dir !== root && ents.some((e) => e.isFile() && e.name === 'package.json')) out.push(dir);
    for (const e of ents) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
    }
  };
  walk(root);
  return out.sort();
}

export function idFromDir(root: string, dir: string): string {
  return path.relative(root, dir).split(path.sep).join('/');
}

export function extractRequires(source: string): string[] {
  const out = new Set<string>();
  for (const m of source.matchAll(REQUIRE_RE)) out.add(m[1]);
  return [...out];
}

export function resolveSpec(spec: string, ids: Set<string>): string | null {
  let s = spec.replace(/^@stdlib\//, '');
  while (s) {
    if (ids.has(s)) return s;
    const i = s.lastIndexOf('/');
    if (i < 0) return null;
    s = s.slice(0, i);
  }
  return null;
}

export function listFilesRecursive(dir: string, ext: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export function detectTags(dir: string, pkgJson: { __stdlib__?: { wasm?: unknown } }): number {
  let tags = 0;
  if (listFilesRecursive(path.join(dir, 'lib'), '.js').length > 0) tags |= Tag.JS;
  const src = listDir(path.join(dir, 'src'));
  if (src.some((f) => f.endsWith('.c'))) tags |= Tag.C;
  if (src.some((f) => f.endsWith('.f'))) tags |= Tag.FORTRAN;
  if (fs.existsSync(path.join(dir, 'lib', 'native.js'))) tags |= Tag.NATIVE;
  if (pkgJson.__stdlib__?.wasm || src.some((f) => f.endsWith('.wasm') || f.endsWith('.wat'))) tags |= Tag.WASM;
  if (fs.existsSync(path.join(dir, 'bin', 'cli'))) tags |= Tag.CLI;
  return tags;
}

export function readNativeDeps(dir: string): string[] {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return [];
  let manifest: { confs?: Array<{ task?: string; dependencies?: string[] }> };
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const conf of manifest.confs ?? []) {
    if (conf.task !== 'build') continue;
    for (const d of conf.dependencies ?? []) out.add(d.replace(/^@stdlib\//, ''));
  }
  return [...out];
}

function requiresIn(dir: string): string[] {
  const out = new Set<string>();
  for (const f of listFilesRecursive(dir, '.js')) {
    for (const r of extractRequires(fs.readFileSync(f, 'utf8'))) out.add(r);
  }
  return [...out];
}

export function scanPackage(root: string, dir: string, ids: Set<string>): ScannedPackage {
  const id = idFromDir(root, dir);
  const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const resolveAll = (specs: string[]): Set<string> => {
    const out = new Set<string>();
    for (const s of specs) {
      const r = resolveSpec(s, ids);
      if (r && r !== id) out.add(r);
    }
    return out;
  };
  const resolveExact = (specs: string[]): Set<string> => {
    const out = new Set<string>();
    for (const s of specs) {
      if (ids.has(s) && s !== id) out.add(s);
    }
    return out;
  };
  const runtime = resolveAll(requiresIn(path.join(dir, 'lib')));
  const dev = resolveAll([
    ...requiresIn(path.join(dir, 'test')),
    ...requiresIn(path.join(dir, 'benchmark')),
    ...requiresIn(path.join(dir, 'examples')),
  ]);
  for (const r of runtime) dev.delete(r);
  const native = resolveExact(readNativeDeps(dir));
  return {
    id,
    desc: typeof pkgJson.description === 'string' ? pkgJson.description : '',
    tags: detectTags(dir, pkgJson),
    runtime,
    dev,
    native,
  };
}

export function scanAll(root: string): ScannedPackage[] {
  const dirs = findPackageDirs(root);
  const ids = new Set(dirs.map((d) => idFromDir(root, d)));
  return dirs.map((d) => scanPackage(root, d, ids));
}
