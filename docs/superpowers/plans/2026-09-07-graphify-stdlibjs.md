# graphify-stdlibjs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app that lets a person drill from `stdlib` down to any of its 6,203 packages one column at a time, and search (⌘K) for any package to see only its dependency neighbourhood as compressed path trees, with per-package implementation tags (js / c / f / wasm / native / cli).

**Architecture:** A Node extractor scans the stdlib checkout once (`package.json`, `lib/**/*.js` requires, `manifest.json`) and writes one `graph.json` holding sorted package ids, a tag bitmask, and three CSR edge lists (runtime / dev / native). The Vite + React SPA loads that file into an in-memory `Graph` class (binary-search hierarchy, reverse CSR for dependents) and derives everything else — sibling prefix clustering, path-merged trees, scored search — with small pure functions that are unit-tested in isolation.

**Tech Stack:** Node 20+, TypeScript 5, Vite 5, React 18, Vitest 2 (+ jsdom, Testing Library), tsx for scripts. No UI kit, no router library, no database.

**Spec:** `docs/superpowers/specs/2026-09-07-graphify-stdlibjs-design.md` (same repo). Read it first — the visual tokens, layouts and copy rules live there.

## Global Constraints

- Project root: `/Users/prashantkumaryadav/Downloads/opensource/graphify-stdlibjs` (sibling of the stdlib checkout at `../stdlib`). All paths below are relative to it.
- stdlib packages root: `../stdlib/lib/node_modules/@stdlib`. Package id = path relative to that root (no `@stdlib/` prefix), e.g. `math/base/special/logf`.
- Tag bits (shared by extractor and client): `JS=1, C=2, FORTRAN=4, NATIVE=8, WASM=16, CLI=32, NAMESPACE=64, FOLDER=128`.
- `graph.json` ids are sorted lexicographically; array index is the node index everywhere.
- Edge kinds are exactly `'runtime' | 'dev' | 'native'`.
- Sibling clustering defaults: `threshold 24, minGroup 3, minPrefix 3`.
- Routes: `#/`, `#/explore/<path>[?g=<prefix>]`, `#/module/<id>[?edges=runtime,dev,native]`.
- Fonts: Instrument Sans (UI), JetBrains Mono (ids) from Google Fonts, with system fallbacks.
- Commit messages: conventional prefix (`feat:`, `test:`, `chore:`), no co-author trailers.
- Every task ends with `npm test` and `npx tsc --noEmit` passing.

---

### Task 1: Project scaffold and shared tag module

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/app/App.tsx`
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Create: `src/graph/tags.ts`
- Test: `src/graph/tags.test.ts`

**Interfaces:**
- Produces: `Tag` (const bitmask object), `TagName`, `TAG_ORDER`, `TAG_LABEL`, `decodeTags(mask): TagName[]`, `hasTag(mask, name): boolean` — used by every later task.

- [ ] **Step 1: Create the folder and git repo**

```bash
mkdir -p /Users/prashantkumaryadav/Downloads/opensource/graphify-stdlibjs
cd /Users/prashantkumaryadav/Downloads/opensource/graphify-stdlibjs
git init -b main
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "graphify-stdlibjs",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "extract": "tsx scripts/extract/index.ts"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^22.7.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`, `vite.config.ts`, `.gitignore`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>graphify · stdlib</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the design tokens and base styles**

`src/styles/tokens.css`:
```css
:root {
  --ground: #f3f5f7;
  --surface: #ffffff;
  --ink: #172033;
  --ink-muted: #5b6472;
  --line: #d6dce3;
  --trace: #1f4bff;
  --trace-ink: #ffffff;
  --trace-soft: rgba(31, 75, 255, 0.1);

  --tag-js: #c98a00;
  --tag-c: #2f6fd6;
  --tag-f: #9a3e8f;
  --tag-wasm: #0e8c7a;
  --tag-native: #5a6b7b;
  --tag-cli: #2e8b57;

  --font-ui: 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --fs-1: 12px;
  --fs-2: 13px;
  --fs-3: 15px;
  --fs-4: 18px;
  --fs-5: 24px;

  --radius: 4px;
  --col-w: 260px;
  --col-gap: 20px;
  --topbar-h: 52px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ground: #101820;
    --surface: #18232e;
    --ink: #e7ecf2;
    --ink-muted: #9aa5b4;
    --line: #2b3947;
    --trace: #6b8cff;
    --trace-ink: #0b1020;
    --trace-soft: rgba(107, 140, 255, 0.16);
  }
}
```

`src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--fs-3);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--trace);
}

button {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--trace);
  outline-offset: 2px;
}

.mono {
  font-family: var(--font-mono);
}

.muted {
  color: var(--ink-muted);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 6: Write the entry point and a first App**

`src/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/app/App.tsx` (replaced in Task 9):
```tsx
export default function App() {
  return <p style={{ padding: 20 }}>graphify · stdlib</p>;
}
```

- [ ] **Step 7: Write the failing tag test**

`src/graph/tags.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Tag, decodeTags, hasTag } from './tags';

describe('tags', () => {
  it('decodes a bitmask into names in display order', () => {
    expect(decodeTags(Tag.JS | Tag.C | Tag.NATIVE)).toEqual(['JS', 'C', 'NATIVE']);
    expect(decodeTags(0)).toEqual([]);
  });

  it('checks a single tag', () => {
    expect(hasTag(Tag.JS | Tag.CLI, 'CLI')).toBe(true);
    expect(hasTag(Tag.JS, 'C')).toBe(false);
  });

  it('bits are distinct powers of two', () => {
    const bits = Object.values(Tag);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(b & (b - 1)).toBe(0);
  });
});
```

- [ ] **Step 8: Install and run the test to verify it fails**

```bash
npm install
npm test
```
Expected: FAIL — `Cannot find module './tags'`.

- [ ] **Step 9: Write `src/graph/tags.ts`**

```ts
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

export function decodeTags(mask: number): TagName[] {
  return TAG_ORDER.filter((t) => (mask & Tag[t]) !== 0);
}

export function hasTag(mask: number, name: TagName): boolean {
  return (mask & Tag[name]) !== 0;
}
```

- [ ] **Step 10: Run tests and typecheck**

```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: 3 tests pass; `dist/` produced.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold graphify-stdlibjs with tag bitmask module"
```

---

### Task 2: Extractor — scan stdlib packages

**Files:**
- Create: `scripts/extract/scan.ts`
- Create: `scripts/extract/__fixtures__/mini/@stdlib/**` (committed fixture tree)
- Test: `scripts/extract/scan.test.ts`

**Interfaces:**
- Consumes: `Tag` from `src/graph/tags.ts`.
- Produces: `ScannedPackage { id, desc, tags, runtime: Set<string>, dev: Set<string>, native: Set<string> }`, `findPackageDirs(root)`, `idFromDir(root, dir)`, `extractRequires(source)`, `resolveSpec(spec, ids)`, `listFilesRecursive(dir, ext)`, `detectTags(dir, pkgJson)`, `readNativeDeps(dir)`, `scanPackage(root, dir, ids)`, `scanAll(root)`.

- [ ] **Step 1: Create the fixture tree**

```bash
F=scripts/extract/__fixtures__/mini/@stdlib
mkdir -p $F/math/base/special/lnf/{lib,src} $F/math/base/special/logf/{lib,src,test} \
         $F/math/base/napi/binary/src $F/assert/is-nan/{lib,bin}
for p in math math/base math/base/special assert; do
  printf '{"name":"@stdlib/%s","description":"%s namespace."}\n' "$p" "$p" > $F/$p/package.json
done
# lnf: js + c + native + wasm (via __stdlib__)
printf '{"name":"@stdlib/math/base/special/lnf","description":"Natural logarithm (float32).","__stdlib__":{"wasm":{}}}\n' > $F/math/base/special/lnf/package.json
echo "module.exports = function lnf( x ) { return Math.log( x ); };" > $F/math/base/special/lnf/lib/main.js
echo "module.exports = require( './main.js' );" > $F/math/base/special/lnf/lib/native.js
echo "/* c */" > $F/math/base/special/lnf/src/main.c
echo '{"confs":[{"task":"build","dependencies":["@stdlib/math/base/napi/unary"]}]}' > $F/math/base/special/lnf/manifest.json
# logf: js + c + native; runtime dep on lnf, dev dep on assert/is-nan, native deps on napi/binary + lnf
printf '{"name":"@stdlib/math/base/special/logf","description":"Base b logarithm (float32)."}\n' > $F/math/base/special/logf/package.json
printf "var lnf = require( '@stdlib/math/base/special/lnf/lib/main.js' );\nmodule.exports = function logf( x, b ) { return lnf( x ) / lnf( b ); };\n" > $F/math/base/special/logf/lib/main.js
printf "var tryRequire = require( '@stdlib/utils/try-require' );\nmodule.exports = require( './main.js' );\n" > $F/math/base/special/logf/lib/native.js
printf "var isnan = require( '@stdlib/assert/is-nan' );\nvar logf = require( '@stdlib/math/base/special/logf' );\n" > $F/math/base/special/logf/test/test.js
echo "/* c */" > $F/math/base/special/logf/src/main.c
echo '{"confs":[{"task":"build","dependencies":["@stdlib/math/base/napi/binary","@stdlib/math/base/special/lnf"]},{"task":"benchmark","dependencies":["@stdlib/math/base/special/lnf"]}]}' > $F/math/base/special/logf/manifest.json
# napi/binary: c only (no lib). Note: math/base/napi has NO package.json on purpose.
printf '{"name":"@stdlib/math/base/napi/binary","description":"N-API binary helper."}\n' > $F/math/base/napi/binary/package.json
echo "/* c */" > $F/math/base/napi/binary/src/main.c
# assert/is-nan: js + cli
printf '{"name":"@stdlib/assert/is-nan","description":"Test if a value is NaN."}\n' > $F/assert/is-nan/package.json
echo "module.exports = function isnan( v ) { return v !== v; };" > $F/assert/is-nan/lib/main.js
echo "#!/usr/bin/env node" > $F/assert/is-nan/bin/cli
```

- [ ] **Step 2: Write the failing test**

`scripts/extract/scan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Tag } from '../../src/graph/tags';
import { detectTags, extractRequires, findPackageDirs, idFromDir, readNativeDeps, resolveSpec, scanAll } from './scan';

const ROOT = fileURLToPath(new URL('./__fixtures__/mini/@stdlib', import.meta.url));

describe('findPackageDirs', () => {
  it('finds every dir with a package.json, sorted, skipping lib/src/test dirs', () => {
    const ids = findPackageDirs(ROOT).map((d) => idFromDir(ROOT, d));
    expect(ids).toEqual([
      'assert',
      'assert/is-nan',
      'math',
      'math/base',
      'math/base/napi/binary',
      'math/base/special',
      'math/base/special/lnf',
      'math/base/special/logf',
    ]);
  });
});

describe('extractRequires', () => {
  it('collects @stdlib specs without the prefix, deduplicated', () => {
    const src = `var a = require( '@stdlib/x/y' );\nvar b = require("@stdlib/z");\nrequire('@stdlib/x/y');\nrequire('./local');`;
    expect(extractRequires(src)).toEqual(['x/y', 'z']);
  });
});

describe('resolveSpec', () => {
  const ids = new Set(['math/base/special/logf', 'assert/is-nan']);
  it('walks up to the longest known package prefix', () => {
    expect(resolveSpec('math/base/special/logf/lib/main.js', ids)).toBe('math/base/special/logf');
    expect(resolveSpec('@stdlib/assert/is-nan', ids)).toBe('assert/is-nan');
  });
  it('returns null for unknown packages', () => {
    expect(resolveSpec('utils/try-require', ids)).toBeNull();
  });
});

describe('detectTags / readNativeDeps', () => {
  it('reads tags from the filesystem layout', () => {
    expect(detectTags(`${ROOT}/math/base/special/logf`, {})).toBe(Tag.JS | Tag.C | Tag.NATIVE);
    expect(detectTags(`${ROOT}/math/base/special/lnf`, { __stdlib__: { wasm: {} } })).toBe(Tag.JS | Tag.C | Tag.NATIVE | Tag.WASM);
    expect(detectTags(`${ROOT}/assert/is-nan`, {})).toBe(Tag.JS | Tag.CLI);
    expect(detectTags(`${ROOT}/math/base/napi/binary`, {})).toBe(Tag.C);
  });
  it('reads only build-task dependencies from manifest.json', () => {
    expect(readNativeDeps(`${ROOT}/math/base/special/logf`)).toEqual(['math/base/napi/binary', 'math/base/special/lnf']);
    expect(readNativeDeps(`${ROOT}/assert/is-nan`)).toEqual([]);
  });
});

describe('scanAll', () => {
  const byId = new Map(scanAll(ROOT).map((p) => [p.id, p]));
  it('separates runtime, dev and native edges and drops unresolved/self requires', () => {
    const logf = byId.get('math/base/special/logf')!;
    expect([...logf.runtime]).toEqual(['math/base/special/lnf']);
    expect([...logf.dev]).toEqual(['assert/is-nan']);
    expect([...logf.native].sort()).toEqual(['math/base/napi/binary', 'math/base/special/lnf']);
    expect(logf.desc).toBe('Base b logarithm (float32).');
  });
  it('drops native deps that are not packages', () => {
    expect([...byId.get('math/base/special/lnf')!.native]).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run scripts/extract/scan.test.ts
```
Expected: FAIL — `Cannot find module './scan'`.

- [ ] **Step 4: Write `scripts/extract/scan.ts`**

```ts
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
  const runtime = resolveAll(requiresIn(path.join(dir, 'lib')));
  const dev = resolveAll([
    ...requiresIn(path.join(dir, 'test')),
    ...requiresIn(path.join(dir, 'benchmark')),
    ...requiresIn(path.join(dir, 'examples')),
  ]);
  for (const r of runtime) dev.delete(r);
  const native = resolveAll(readNativeDeps(dir));
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
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run scripts/extract/scan.test.ts && npx tsc --noEmit
```
Expected: 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract
git commit -m "feat: scan stdlib packages for tags and require edges"
```

---

### Task 3: Graph file builder and extract CLI

**Files:**
- Create: `src/graph/types.ts`
- Create: `src/graph/buildGraphFile.ts`
- Create: `scripts/extract/index.ts`
- Create: `public/data/graph.json` (generated, committed)
- Test: `src/graph/buildGraphFile.test.ts`

**Interfaces:**
- Consumes: `ScannedPackage`, `scanAll` (Task 2), `Tag` (Task 1).
- Produces: `GraphFile`, `Csr`, `EdgeKind`, `EDGE_KINDS`, `PackageInput`, `buildGraphFile(pkgs: PackageInput[], source: string): GraphFile`.

- [ ] **Step 1: Write `src/graph/types.ts`**

```ts
export interface Csr {
  /** offsets.length === n + 1; row i is targets[offsets[i] .. offsets[i+1]) */
  offsets: number[];
  targets: number[];
}

export type EdgeKind = 'runtime' | 'dev' | 'native';
export const EDGE_KINDS: EdgeKind[] = ['runtime', 'dev', 'native'];

export interface GraphFile {
  version: 1;
  generatedAt: string;
  source: string;
  ids: string[];
  desc: string[];
  tags: number[];
  runtime: Csr;
  dev: Csr;
  native: Csr;
}

export interface PackageInput {
  id: string;
  desc: string;
  tags: number;
  runtime: Iterable<string>;
  dev: Iterable<string>;
  native: Iterable<string>;
}
```

- [ ] **Step 2: Write the failing test**

`src/graph/buildGraphFile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildGraphFile } from './buildGraphFile';
import { Tag } from './tags';

const pkgs = [
  { id: 'math', desc: 'math', tags: Tag.JS, runtime: [], dev: [], native: [] },
  { id: 'math/base/special/logf', desc: 'logf', tags: Tag.JS | Tag.C, runtime: ['math/base/special/lnf'], dev: ['assert/is-nan'], native: ['math/base/napi/binary', 'math/base/special/lnf'] },
  { id: 'math/base/special/lnf', desc: 'lnf', tags: Tag.JS, runtime: [], dev: [], native: [] },
  { id: 'math/base/napi/binary', desc: 'binary', tags: Tag.C, runtime: [], dev: [], native: [] },
  { id: 'assert/is-nan', desc: 'isnan', tags: Tag.JS, runtime: [], dev: [], native: [] },
];

describe('buildGraphFile', () => {
  const file = buildGraphFile(pkgs, 'abc123');
  const at = (id: string) => file.ids.indexOf(id);

  it('sorts ids and synthesises missing folder nodes', () => {
    expect(file.ids).toEqual([
      'assert', 'assert/is-nan', 'math', 'math/base', 'math/base/napi', 'math/base/napi/binary',
      'math/base/special', 'math/base/special/lnf', 'math/base/special/logf',
    ]);
    expect(file.tags[at('assert')]).toBe(Tag.FOLDER | Tag.NAMESPACE);
    expect(file.desc[at('assert')]).toBe('');
  });

  it('marks packages that have children as namespaces', () => {
    expect(file.tags[at('math')]).toBe(Tag.JS | Tag.NAMESPACE);
    expect(file.tags[at('math/base/special/logf')]).toBe(Tag.JS | Tag.C);
  });

  it('builds CSR rows with sorted targets', () => {
    const i = at('math/base/special/logf');
    expect(file.runtime.offsets).toHaveLength(file.ids.length + 1);
    expect(file.runtime.targets.slice(file.runtime.offsets[i], file.runtime.offsets[i + 1])).toEqual([at('math/base/special/lnf')]);
    expect(file.dev.targets.slice(file.dev.offsets[i], file.dev.offsets[i + 1])).toEqual([at('assert/is-nan')]);
    expect(file.native.targets.slice(file.native.offsets[i], file.native.offsets[i + 1])).toEqual([at('math/base/napi/binary'), at('math/base/special/lnf')]);
    expect(file.native.targets).toHaveLength(2);
  });

  it('records the source and version', () => {
    expect(file.version).toBe(1);
    expect(file.source).toBe('abc123');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/graph/buildGraphFile.test.ts
```
Expected: FAIL — `Cannot find module './buildGraphFile'`.

- [ ] **Step 4: Write `src/graph/buildGraphFile.ts`**

```ts
import { Tag } from './tags';
import type { Csr, GraphFile, PackageInput } from './types';

const EMPTY: PackageInput = { id: '', desc: '', tags: Tag.FOLDER, runtime: [], dev: [], native: [] };

export function buildGraphFile(pkgs: PackageInput[], source: string): GraphFile {
  const byId = new Map<string, PackageInput>();
  for (const p of pkgs) byId.set(p.id, p);
  for (const id of [...byId.keys()]) {
    const parts = id.split('/');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      if (!byId.has(prefix)) byId.set(prefix, { ...EMPTY, id: prefix });
    }
  }
  const ids = [...byId.keys()].sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const hasChild = new Set<string>();
  for (const id of ids) {
    const k = id.lastIndexOf('/');
    if (k > 0) hasChild.add(id.slice(0, k));
  }
  const csr = (pick: (p: PackageInput) => Iterable<string>): Csr => {
    const offsets = [0];
    const targets: number[] = [];
    for (const id of ids) {
      const row: number[] = [];
      for (const t of pick(byId.get(id)!)) {
        const j = index.get(t);
        if (j !== undefined && j !== index.get(id)) row.push(j);
      }
      row.sort((a, b) => a - b);
      for (const j of row) targets.push(j);
      offsets.push(targets.length);
    }
    return { offsets, targets };
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    ids,
    desc: ids.map((id) => byId.get(id)!.desc),
    tags: ids.map((id) => byId.get(id)!.tags | (hasChild.has(id) ? Tag.NAMESPACE : 0)),
    runtime: csr((p) => p.runtime),
    dev: csr((p) => p.dev),
    native: csr((p) => p.native),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/graph/buildGraphFile.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 6: Write the CLI `scripts/extract/index.ts`**

```ts
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
```

- [ ] **Step 7: Run the extractor against the real checkout and sanity-check the output**

```bash
npm run extract -- --stdlib ../stdlib
node -e "const g=require('./public/data/graph.json'); console.log(g.ids.length, g.runtime.targets.length, g.native.targets.length, g.ids.indexOf('math/base/special/logf'), g.ids.includes('stats/base/ndarray/svariancepn'))"
```
Expected: scan finishes in under ~60 s; nodes ≥ 6200, runtime targets ≥ 40000, native targets ≥ 9000, logf index ≥ 0, `true`. File size roughly 1–1.5 MB.

- [ ] **Step 8: Typecheck and commit (including the generated data)**

```bash
npx tsc --noEmit && npm test
git add src/graph/types.ts src/graph/buildGraphFile.ts src/graph/buildGraphFile.test.ts scripts/extract/index.ts public/data/graph.json
git commit -m "feat: build CSR graph file from scanned packages"
```

---

### Task 4: In-memory `Graph` class

**Files:**
- Create: `src/graph/Graph.ts`
- Create: `src/graph/testUtils.ts`
- Test: `src/graph/Graph.test.ts`

**Interfaces:**
- Consumes: `GraphFile`, `Csr`, `EdgeKind` (Task 3), `buildGraphFile` (Task 3).
- Produces: `class Graph { n, ids, desc, tags, source; indexOf(id): number; name(i): string; parent(i): number; children(i): number[]; descendantCount(i): number; deps(i, kind): number[]; dependents(i, kind): number[] }`, `reverseCsr(csr, n)`, `lowerBound(arr, key)`, and the test helper `graphFromIds(ids, edges?)`.

- [ ] **Step 1: Write the test helper `src/graph/testUtils.ts`**

```ts
import { buildGraphFile } from './buildGraphFile';
import { Graph } from './Graph';
import { Tag } from './tags';
import type { EdgeKind } from './types';

export type EdgeList = Partial<Record<EdgeKind, Array<[string, string]>>>;

/** Build a Graph from package ids (all tagged JS) and optional [from, to] edge pairs per kind. */
export function graphFromIds(ids: string[], edges: EdgeList = {}): Graph {
  const pick = (kind: EdgeKind, id: string): string[] =>
    (edges[kind] ?? []).filter(([a]) => a === id).map(([, b]) => b);
  return new Graph(
    buildGraphFile(
      ids.map((id) => ({ id, desc: `${id} description`, tags: Tag.JS, runtime: pick('runtime', id), dev: pick('dev', id), native: pick('native', id) })),
      'test',
    ),
  );
}
```

- [ ] **Step 2: Write the failing test**

`src/graph/Graph.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { lowerBound, reverseCsr } from './Graph';
import { graphFromIds } from './testUtils';

const g = graphFromIds(
  ['assert/is-nan', 'math', 'math/base/special', 'math/base/special/lnf', 'math/base/special/logf'],
  { runtime: [['math/base/special/logf', 'math/base/special/lnf']], dev: [['math/base/special/logf', 'assert/is-nan']] },
);
const at = (id: string) => g.indexOf(id);

describe('Graph hierarchy', () => {
  it('lists root children (ids without a slash)', () => {
    expect(g.children(-1).map((i) => g.ids[i])).toEqual(['assert', 'math']);
  });
  it('lists direct children only', () => {
    expect(g.children(at('math/base/special')).map((i) => g.ids[i])).toEqual(['math/base/special/lnf', 'math/base/special/logf']);
    expect(g.children(at('math')).map((i) => g.ids[i])).toEqual(['math/base']);
    expect(g.children(at('math/base/special/lnf'))).toEqual([]);
  });
  it('finds parent and name', () => {
    expect(g.parent(at('math/base/special/logf'))).toBe(at('math/base/special'));
    expect(g.parent(at('math'))).toBe(-1);
    expect(g.name(at('math/base/special/logf'))).toBe('logf');
  });
  it('counts descendants', () => {
    expect(g.descendantCount(at('math'))).toBe(4);
    expect(g.descendantCount(-1)).toBe(g.n);
  });
  it('returns -1 for unknown ids', () => {
    expect(g.indexOf('nope')).toBe(-1);
  });
});

describe('Graph edges', () => {
  it('reads forward and reverse edges per kind', () => {
    expect(g.deps(at('math/base/special/logf'), 'runtime')).toEqual([at('math/base/special/lnf')]);
    expect(g.dependents(at('math/base/special/lnf'), 'runtime')).toEqual([at('math/base/special/logf')]);
    expect(g.dependents(at('assert/is-nan'), 'dev')).toEqual([at('math/base/special/logf')]);
    expect(g.dependents(at('assert/is-nan'), 'runtime')).toEqual([]);
    expect(g.deps(at('math/base/special/logf'), 'native')).toEqual([]);
  });
});

describe('helpers', () => {
  it('lowerBound finds the first index >= key', () => {
    expect(lowerBound(['a', 'b', 'd'], 'c')).toBe(2);
    expect(lowerBound(['a', 'b', 'd'], 'a')).toBe(0);
    expect(lowerBound(['a', 'b', 'd'], 'z')).toBe(3);
  });
  it('reverseCsr transposes with sorted rows', () => {
    const rev = reverseCsr({ offsets: [0, 1, 3, 3], targets: [2, 0, 2] }, 3);
    expect(rev).toEqual({ offsets: [0, 1, 1, 3], targets: [1, 0, 1] });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/graph/Graph.test.ts
```
Expected: FAIL — `Cannot find module './Graph'`.

- [ ] **Step 4: Write `src/graph/Graph.ts`**

```ts
import type { Csr, EdgeKind, GraphFile } from './types';

export function lowerBound(arr: string[], key: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function reverseCsr(csr: Csr, n: number): Csr {
  const offsets = new Array<number>(n + 1).fill(0);
  for (const t of csr.targets) offsets[t + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  const fill = offsets.slice(0, n);
  const targets = new Array<number>(csr.targets.length);
  for (let i = 0; i < n; i++) {
    for (let k = csr.offsets[i]; k < csr.offsets[i + 1]; k++) {
      targets[fill[csr.targets[k]]++] = i;
    }
  }
  return { offsets, targets };
}

export class Graph {
  readonly n: number;
  readonly ids: string[];
  readonly desc: string[];
  readonly tags: number[];
  readonly source: string;
  private readonly index = new Map<string, number>();
  private readonly fwd: Record<EdgeKind, Csr>;
  private readonly rev: Record<EdgeKind, Csr>;
  private readonly rootChildren: number[] = [];

  constructor(file: GraphFile) {
    this.ids = file.ids;
    this.desc = file.desc;
    this.tags = file.tags;
    this.source = file.source;
    this.n = file.ids.length;
    file.ids.forEach((id, i) => {
      this.index.set(id, i);
      if (!id.includes('/')) this.rootChildren.push(i);
    });
    this.fwd = { runtime: file.runtime, dev: file.dev, native: file.native };
    this.rev = {
      runtime: reverseCsr(file.runtime, this.n),
      dev: reverseCsr(file.dev, this.n),
      native: reverseCsr(file.native, this.n),
    };
  }

  indexOf(id: string): number {
    return this.index.get(id) ?? -1;
  }

  name(i: number): string {
    const id = this.ids[i];
    return id.slice(id.lastIndexOf('/') + 1);
  }

  parent(i: number): number {
    const id = this.ids[i];
    const k = id.lastIndexOf('/');
    return k < 0 ? -1 : this.indexOf(id.slice(0, k));
  }

  /** Direct children of node i; pass -1 for the root. */
  children(i: number): number[] {
    if (i < 0) return this.rootChildren.slice();
    const prefix = this.ids[i] + '/';
    const out: number[] = [];
    for (let j = lowerBound(this.ids, prefix); j < this.n && this.ids[j].startsWith(prefix); j++) {
      if (this.ids[j].indexOf('/', prefix.length) < 0) out.push(j);
    }
    return out;
  }

  /** Number of nodes strictly below node i; pass -1 for the root. */
  descendantCount(i: number): number {
    if (i < 0) return this.n;
    const prefix = this.ids[i] + '/';
    const start = lowerBound(this.ids, prefix);
    let j = start;
    while (j < this.n && this.ids[j].startsWith(prefix)) j++;
    return j - start;
  }

  private row(csr: Csr, i: number): number[] {
    return csr.targets.slice(csr.offsets[i], csr.offsets[i + 1]);
  }

  deps(i: number, kind: EdgeKind): number[] {
    return this.row(this.fwd[kind], i);
  }

  dependents(i: number, kind: EdgeKind): number[] {
    return this.row(this.rev[kind], i);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/graph/Graph.test.ts && npx tsc --noEmit
```
Expected: 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/graph/Graph.ts src/graph/Graph.test.ts src/graph/testUtils.ts
git commit -m "feat: in-memory Graph with hierarchy lookup and reverse edges"
```

---

### Task 5: Sibling prefix clustering

**Files:**
- Create: `src/graph/clusterSiblings.ts`
- Test: `src/graph/clusterSiblings.test.ts`

**Interfaces:**
- Produces: `SiblingItem = { kind: 'single'; name } | { kind: 'group'; prefix; members: string[] }`, `ClusterOptions { threshold?, minGroup?, minPrefix? }`, `clusterSiblings(names, opts?): SiblingItem[]` (sorted by `name`/`prefix`).

- [ ] **Step 1: Write the failing test**

`src/graph/clusterSiblings.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clusterSiblings } from './clusterSiblings';

const svariance = ['svariance', 'svariancech', 'svariancepn', 'svariancetk', 'svariancewd', 'svarianceyc', 'svariancemtk'];
const dvariance = ['dvariance', 'dvariancech', 'dvariancepn'];
const others = ['dmax', 'dmin', 'dmean', 'dnanmax', 'smax', 'smin', 'smean', 'ssum', 'dsum', 'zsum', 'csum', 'gsum', 'sabs', 'sabs2', 'dabs', 'dabs2', 'nanmax', 'nanmin', 'range', 'mean'];

describe('clusterSiblings', () => {
  it('leaves short lists alone', () => {
    const out = clusterSiblings(['b', 'a', 'c']);
    expect(out).toEqual([{ kind: 'single', name: 'a' }, { kind: 'single', name: 'b' }, { kind: 'single', name: 'c' }]);
  });

  it('groups siblings sharing a prefix of at least minPrefix chars with at least minGroup members', () => {
    const names = [...svariance, ...dvariance, ...others];
    expect(names.length).toBeGreaterThan(24);
    const out = clusterSiblings(names);
    const groups = out.filter((i) => i.kind === 'group');
    const sv = groups.find((g) => g.kind === 'group' && g.prefix === 'svariance');
    expect(sv && sv.kind === 'group' ? sv.members.sort() : null).toEqual([...svariance].sort());
    const dv = groups.find((g) => g.kind === 'group' && g.prefix === 'dvariance');
    expect(dv && dv.kind === 'group' ? dv.members.length : 0).toBe(3);
    expect(out.length).toBeLessThan(names.length);
    // every input name appears exactly once, as a single or inside a group
    const seen = out.flatMap((i) => (i.kind === 'single' ? [i.name] : i.members));
    expect(seen.sort()).toEqual([...names].sort());
  });

  it('never groups on a prefix shorter than minPrefix', () => {
    const names = Array.from({ length: 30 }, (_, i) => `ab${String.fromCharCode(97 + i)}`); // aba, abb, ...
    const out = clusterSiblings(names, { minPrefix: 3 });
    expect(out.every((i) => i.kind === 'single')).toBe(true);
  });

  it('does not produce a group larger than threshold', () => {
    const names = Array.from({ length: 40 }, (_, i) => `dist${String(i).padStart(2, '0')}`);
    const out = clusterSiblings(names, { threshold: 24 });
    for (const item of out) if (item.kind === 'group') expect(item.members.length).toBeLessThanOrEqual(24);
    const seen = out.flatMap((i) => (i.kind === 'single' ? [i.name] : i.members));
    expect(seen.sort()).toEqual([...names].sort());
  });

  it('returns items sorted by label', () => {
    const names = [...svariance, ...dvariance, ...others];
    const labels = clusterSiblings(names).map((i) => (i.kind === 'single' ? i.name : i.prefix));
    expect(labels).toEqual([...labels].sort());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/graph/clusterSiblings.test.ts
```
Expected: FAIL — `Cannot find module './clusterSiblings'`.

- [ ] **Step 3: Write `src/graph/clusterSiblings.ts`**

```ts
export type SiblingItem =
  | { kind: 'single'; name: string }
  | { kind: 'group'; prefix: string; members: string[] };

export interface ClusterOptions {
  /** Lists with this many names or fewer are never clustered. */
  threshold?: number;
  /** Minimum members for a group. */
  minGroup?: number;
  /** Minimum shared-prefix length for a group. */
  minPrefix?: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
  leaves: number;
}

function newNode(): TrieNode {
  return { children: new Map(), end: false, leaves: 0 };
}

function buildTrie(names: string[]): TrieNode {
  const root = newNode();
  for (const name of names) {
    let node = root;
    node.leaves++;
    for (const ch of name) {
      let next = node.children.get(ch);
      if (!next) {
        next = newNode();
        node.children.set(ch, next);
      }
      node = next;
      node.leaves++;
    }
    node.end = true;
  }
  return root;
}

function leavesOf(node: TrieNode, prefix: string, out: string[]): string[] {
  if (node.end) out.push(prefix);
  for (const [ch, child] of node.children) leavesOf(child, prefix + ch, out);
  return out;
}

function collect(node: TrieNode, prefix: string, out: SiblingItem[], minGroup: number, minPrefix: number, threshold: number): void {
  if (node.end) out.push({ kind: 'single', name: prefix });
  for (const [ch, child] of node.children) {
    if (child.leaves < minGroup) {
      for (const name of leavesOf(child, prefix + ch, [])) out.push({ kind: 'single', name });
      continue;
    }
    // follow the single-child chain so the prefix is as long as it can be
    let n = child;
    let p = prefix + ch;
    while (n.children.size === 1 && !n.end) {
      const [c, next] = [...n.children][0];
      p += c;
      n = next;
    }
    if (p.length >= minPrefix && n.leaves <= threshold) {
      out.push({ kind: 'group', prefix: p, members: leavesOf(n, p, []) });
    } else {
      collect(n, p, out, minGroup, minPrefix, threshold);
    }
  }
}

const label = (i: SiblingItem): string => (i.kind === 'single' ? i.name : i.prefix);

export function clusterSiblings(names: string[], opts: ClusterOptions = {}): SiblingItem[] {
  const { threshold = 24, minGroup = 3, minPrefix = 3 } = opts;
  const sorted = [...names].sort();
  if (sorted.length <= threshold) return sorted.map((name) => ({ kind: 'single', name }));
  const out: SiblingItem[] = [];
  collect(buildTrie(sorted), '', out, minGroup, minPrefix, threshold);
  return out.sort((a, b) => (label(a) < label(b) ? -1 : label(a) > label(b) ? 1 : 0));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/graph/clusterSiblings.test.ts && npx tsc --noEmit
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graph/clusterSiblings.ts src/graph/clusterSiblings.test.ts
git commit -m "feat: cluster wide sibling lists by shared name prefix"
```

---

### Task 6: Path-merged tree

**Files:**
- Create: `src/graph/pathTree.ts`
- Test: `src/graph/pathTree.test.ts`

**Interfaces:**
- Produces: `PathNode { label; path; index; leafCount; children: PathNode[] }`, `buildPathTree(ids: string[], indexOf: (id: string) => number): PathNode` (root has `label ''`, `path ''`, `index -1`).

- [ ] **Step 1: Write the failing test**

`src/graph/pathTree.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildPathTree } from './pathTree';

const ids = ['blas/base/dasum', 'blas/base/daxpy', 'math/base/special/lnf', 'math/base/special', 'utils/noop'];
const indexOf = (id: string) => ids.indexOf(id);

describe('buildPathTree', () => {
  const tree = buildPathTree(ids, indexOf);

  it('collapses single-child chains into one labelled node', () => {
    expect(tree.children.map((c) => c.label)).toEqual(['blas/base', 'math/base/special', 'utils/noop']);
    expect(tree.children[0].path).toBe('blas/base');
    expect(tree.children[0].index).toBe(-1);
  });

  it('keeps a node that is itself a package even when it has one child', () => {
    const special = tree.children[1];
    expect(special.index).toBe(indexOf('math/base/special'));
    expect(special.children.map((c) => c.label)).toEqual(['lnf']);
    expect(special.leafCount).toBe(2);
  });

  it('counts leaves and sorts folders before leaves, alphabetically', () => {
    expect(tree.leafCount).toBe(5);
    expect(tree.children[0].children.map((c) => c.label)).toEqual(['dasum', 'daxpy']);
    expect(tree.children[0].leafCount).toBe(2);
    expect(tree.children[2].index).toBe(indexOf('utils/noop'));
  });

  it('handles an empty list', () => {
    expect(buildPathTree([], indexOf)).toEqual({ label: '', path: '', index: -1, leafCount: 0, children: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/graph/pathTree.test.ts
```
Expected: FAIL — `Cannot find module './pathTree'`.

- [ ] **Step 3: Write `src/graph/pathTree.ts`**

```ts
export interface PathNode {
  /** Display label; may contain slashes when a chain was collapsed ("blas/base"). */
  label: string;
  /** Full package path of this node. */
  path: string;
  /** Node index in the Graph, or -1 when this is only a folder in the tree. */
  index: number;
  leafCount: number;
  children: PathNode[];
}

interface Raw {
  seg: string;
  path: string;
  index: number;
  children: Map<string, Raw>;
}

function finish(raw: Raw, isRoot: boolean): PathNode {
  let label = raw.seg;
  let node = raw;
  while (!isRoot && node.index < 0 && node.children.size === 1) {
    const only = [...node.children.values()][0];
    label = `${label}/${only.seg}`;
    node = only;
  }
  const children = [...node.children.values()].map((c) => finish(c, false));
  children.sort((a, b) => {
    const folderDiff = Number(b.children.length > 0) - Number(a.children.length > 0);
    return folderDiff !== 0 ? folderDiff : a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
  const leafCount = (node.index >= 0 ? 1 : 0) + children.reduce((s, c) => s + c.leafCount, 0);
  return { label, path: node.path, index: node.index, leafCount, children };
}

export function buildPathTree(ids: string[], indexOf: (id: string) => number): PathNode {
  const root: Raw = { seg: '', path: '', index: -1, children: new Map() };
  for (const id of ids) {
    let node = root;
    let acc = '';
    for (const seg of id.split('/')) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = node.children.get(seg);
      if (!next) {
        next = { seg, path: acc, index: -1, children: new Map() };
        node.children.set(seg, next);
      }
      node = next;
    }
    node.index = indexOf(id);
  }
  return finish(root, true);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/graph/pathTree.test.ts && npx tsc --noEmit
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graph/pathTree.ts src/graph/pathTree.test.ts
git commit -m "feat: build path-merged trees for dependency lists"
```

---

### Task 7: Scored search

**Files:**
- Create: `src/graph/search.ts`
- Test: `src/graph/search.test.ts`

**Interfaces:**
- Produces: `SearchHit { index; score }`, `scoreMatch(idLower, q): number`, `createSearch(ids): (query: string, limit?: number) => SearchHit[]`, `highlightRange(id, q): [number, number] | null`.

- [ ] **Step 1: Write the failing test**

`src/graph/search.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createSearch, highlightRange, scoreMatch } from './search';

const ids = ['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f', 'stats/base/ndarray/svariancepn', 'utils/try-require'];
const search = createSearch(ids);
const names = (q: string) => search(q).map((h) => ids[h.index]);

describe('scoreMatch', () => {
  it('ranks exact > last-segment prefix > segment prefix > substring > subsequence', () => {
    expect(scoreMatch('math/base/special/logf', 'logf')).toBe(100);
    expect(scoreMatch('math/base/special/logf', 'lo')).toBe(80);
    expect(scoreMatch('math/base/special/logf', 'spec')).toBe(60);
    expect(scoreMatch('math/base/special/logf', 'ecial')).toBe(40);
    expect(scoreMatch('math/base/special/log10f', 'logf')).toBe(20);
    expect(scoreMatch('math/base/special/logf', 'zzz')).toBe(0);
  });
});

describe('createSearch', () => {
  it('returns the exact match first, then fuzzy matches', () => {
    expect(names('logf')).toEqual(['math/base/special/logf', 'math/base/special/log10f']);
  });
  it('breaks score ties by shorter id', () => {
    expect(names('log')).toEqual(['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f']);
  });
  it('supports slashes in the query', () => {
    expect(names('special/log')[0]).toBe('math/base/special/log');
    expect(names('special/log')).toHaveLength(3);
  });
  it('is case-insensitive and trims', () => {
    expect(names('  SVARIANCEPN ')).toEqual(['stats/base/ndarray/svariancepn']);
  });
  it('returns nothing for an empty query and respects limit', () => {
    expect(search('')).toEqual([]);
    expect(search('log', 1)).toHaveLength(1);
  });
});

describe('highlightRange', () => {
  it('returns the substring range when present, else the last-segment prefix range', () => {
    expect(highlightRange('math/base/special/logf', 'spec')).toEqual([10, 14]);
    expect(highlightRange('math/base/special/log10f', 'logf')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/graph/search.test.ts
```
Expected: FAIL — `Cannot find module './search'`.

- [ ] **Step 3: Write `src/graph/search.ts`**

```ts
export interface SearchHit {
  index: number;
  score: number;
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
  return i === q.length;
}

/** Both arguments must already be lower-cased. */
export function scoreMatch(idLower: string, q: string): number {
  const last = idLower.slice(idLower.lastIndexOf('/') + 1);
  if (last === q || idLower === q) return 100;
  if (last.startsWith(q)) return 80;
  if (idLower.startsWith(q) || idLower.includes('/' + q)) return 60;
  if (idLower.includes(q)) return 40;
  if (q.length >= 3 && !q.includes('/') && isSubsequence(q, last)) return 20;
  return 0;
}

export function highlightRange(id: string, query: string): [number, number] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const at = id.toLowerCase().indexOf(q);
  return at < 0 ? null : [at, at + q.length];
}

export function createSearch(ids: string[]): (query: string, limit?: number) => SearchHit[] {
  const lower = ids.map((s) => s.toLowerCase());
  return (query, limit = 12) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (let i = 0; i < lower.length; i++) {
      const score = scoreMatch(lower[i], q);
      if (score > 0) hits.push({ index: i, score });
    }
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        ids[a.index].length - ids[b.index].length ||
        (ids[a.index] < ids[b.index] ? -1 : 1),
    );
    return hits.slice(0, limit);
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/graph/search.test.ts && npx tsc --noEmit
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graph/search.ts src/graph/search.test.ts
git commit -m "feat: scored package search over ids"
```

---

### Task 8: Router, graph loading, top bar and tag pills

**Files:**
- Create: `src/app/router.ts`
- Create: `src/app/useGraph.ts`
- Create: `src/app/TopBar.tsx`, `src/app/topbar.css`
- Create: `src/ui/TagPills.tsx`, `src/ui/pills.css`
- Test: `src/app/router.test.ts`, `src/ui/TagPills.test.tsx`

**Interfaces:**
- Consumes: `Graph` (Task 4), `GraphFile`, `EdgeKind`, `EDGE_KINDS` (Task 3), `decodeTags`, `TAG_LABEL` (Task 1).
- Produces: `Route`, `parseHash(hash): Route`, `formatRoute(r): string`, `navigate(r): void`, `useRoute(): Route`; `GraphState`, `useGraph(url?): GraphState`; `<TopBar onSearch />`; `<TagPills mask />`.

- [ ] **Step 1: Write the failing router test**

`src/app/router.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash } from './router';

describe('parseHash', () => {
  it('parses root and explore routes', () => {
    expect(parseHash('')).toEqual({ kind: 'explore', path: '', group: null });
    expect(parseHash('#/')).toEqual({ kind: 'explore', path: '', group: null });
    expect(parseHash('#/explore/math/base')).toEqual({ kind: 'explore', path: 'math/base', group: null });
    expect(parseHash('#/explore/stats/base/ndarray?g=svariance')).toEqual({ kind: 'explore', path: 'stats/base/ndarray', group: 'svariance' });
  });
  it('parses module routes with edge kinds, defaulting to runtime', () => {
    expect(parseHash('#/module/math/base/special/logf')).toEqual({ kind: 'module', id: 'math/base/special/logf', edges: ['runtime'] });
    expect(parseHash('#/module/x?edges=runtime,native')).toEqual({ kind: 'module', id: 'x', edges: ['runtime', 'native'] });
    expect(parseHash('#/module/x?edges=bogus')).toEqual({ kind: 'module', id: 'x', edges: ['runtime'] });
  });
  it('treats a bare /module as the root explorer', () => {
    expect(parseHash('#/module')).toEqual({ kind: 'explore', path: '', group: null });
  });
});

describe('formatRoute', () => {
  it('round-trips every route shape', () => {
    for (const h of ['#/', '#/explore/math/base', '#/explore/stats/base/ndarray?g=svariance', '#/module/math/base/special/logf', '#/module/x?edges=runtime,dev']) {
      expect(formatRoute(parseHash(h))).toBe(h);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/app/router.test.ts
```
Expected: FAIL — `Cannot find module './router'`.

- [ ] **Step 3: Write `src/app/router.ts`**

```ts
import { useEffect, useState } from 'react';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';

export type Route =
  | { kind: 'explore'; path: string; group: string | null }
  | { kind: 'module'; id: string; edges: EdgeKind[] };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  if (segs[0] === 'module' && segs.length > 1) {
    const edges = (params.get('edges') ?? 'runtime')
      .split(',')
      .filter((k): k is EdgeKind => (EDGE_KINDS as string[]).includes(k));
    return { kind: 'module', id: segs.slice(1).join('/'), edges: edges.length ? edges : ['runtime'] };
  }
  const path = segs[0] === 'explore' ? segs.slice(1).join('/') : '';
  return { kind: 'explore', path, group: params.get('g') };
}

export function formatRoute(r: Route): string {
  if (r.kind === 'module') {
    const onlyRuntime = r.edges.length === 1 && r.edges[0] === 'runtime';
    return `#/module/${r.id}${onlyRuntime ? '' : `?edges=${r.edges.join(',')}`}`;
  }
  const base = r.path ? `#/explore/${r.path}` : '#/';
  return r.group ? `${base}?g=${encodeURIComponent(r.group)}` : base;
}

export function navigate(r: Route): void {
  window.location.hash = formatRoute(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
```

- [ ] **Step 4: Run the router test to verify it passes**

```bash
npx vitest run src/app/router.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 5: Write `src/app/useGraph.ts`**

```ts
import { useEffect, useState } from 'react';
import { Graph } from '../graph/Graph';
import type { GraphFile } from '../graph/types';

export type GraphState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

export function useGraph(url = `${import.meta.env.BASE_URL}data/graph.json`): GraphState {
  const [state, setState] = useState<GraphState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}). Run "npm run extract" first.`);
        const file = (await res.json()) as GraphFile;
        if (!cancelled) setState({ status: 'ready', graph: new Graph(file) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}
```

- [ ] **Step 6: Write the failing TagPills test**

`src/ui/TagPills.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TagPills } from './TagPills';
import { Tag } from '../graph/tags';

afterEach(cleanup);

describe('TagPills', () => {
  it('renders one pill per implementation tag, in order', () => {
    render(<TagPills mask={Tag.JS | Tag.C | Tag.NATIVE | Tag.CLI} />);
    expect(screen.getAllByTestId('pill').map((el) => el.textContent)).toEqual(['js', 'c', 'native', 'cli']);
  });
  it('hides namespace and folder bits', () => {
    const { container } = render(<TagPills mask={Tag.NAMESPACE | Tag.FOLDER} />);
    expect(container.querySelectorAll('[data-testid="pill"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

```bash
npx vitest run src/ui/TagPills.test.tsx
```
Expected: FAIL — `Cannot find module './TagPills'`.

- [ ] **Step 8: Write `src/ui/TagPills.tsx` and `src/ui/pills.css`**

`src/ui/TagPills.tsx`:
```tsx
import { decodeTags, TAG_LABEL, type TagName } from '../graph/tags';
import './pills.css';

const SHOWN: TagName[] = ['JS', 'C', 'FORTRAN', 'WASM', 'NATIVE', 'CLI'];

export function TagPills({ mask }: { mask: number }) {
  const tags = decodeTags(mask).filter((t) => SHOWN.includes(t));
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
```

`src/ui/pills.css`:
```css
.pills {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}

.pill {
  --pill: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
  padding: 3px 5px;
  border-radius: 3px;
  border: 1px solid var(--pill);
  color: var(--pill);
  background: color-mix(in srgb, var(--pill) 10%, transparent);
}

.pill-js { --pill: var(--tag-js); }
.pill-c { --pill: var(--tag-c); }
.pill-f { --pill: var(--tag-f); }
.pill-wasm { --pill: var(--tag-wasm); }
.pill-native { --pill: var(--tag-native); }
.pill-cli { --pill: var(--tag-cli); }
```

- [ ] **Step 9: Write `src/app/TopBar.tsx` and `src/app/topbar.css`**

`src/app/TopBar.tsx`:
```tsx
import './topbar.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#/">
        graphify <span className="wordmark-dot">·</span> stdlib
      </a>
      <button type="button" className="search-trigger" onClick={onSearch}>
        <span>Search packages</span>
        <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
    </header>
  );
}
```

`src/app/topbar.css`:
```css
.topbar {
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.wordmark {
  font-weight: 600;
  font-size: var(--fs-3);
  color: var(--ink);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.wordmark-dot {
  color: var(--trace);
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  padding: 6px 8px 6px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--ground);
  color: var(--ink-muted);
  cursor: pointer;
  font-size: var(--fs-2);
}

.search-trigger:hover {
  border-color: var(--trace);
  color: var(--ink);
}

.search-trigger kbd {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-1);
  padding: 2px 5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--surface);
}

@media (max-width: 719px) {
  .search-trigger { min-width: 0; }
  .search-trigger span { display: none; }
}
```

- [ ] **Step 10: Run all tests and typecheck**

```bash
npm test && npx tsc --noEmit
```
Expected: all pass (router 4, TagPills 2, plus earlier).

- [ ] **Step 11: Commit**

```bash
git add src/app src/ui
git commit -m "feat: hash router, graph loader, top bar and tag pills"
```

---

### Task 9: Explorer (Miller columns)

**Files:**
- Create: `src/explorer/columns.ts`
- Create: `src/explorer/Explorer.tsx`, `src/explorer/Column.tsx`, `src/explorer/Breadcrumb.tsx`, `src/explorer/explorer.css`
- Modify: `src/app/App.tsx` (replace placeholder)
- Test: `src/explorer/columns.test.ts`, `src/explorer/Explorer.test.tsx`

**Interfaces:**
- Consumes: `Graph` (Task 4), `clusterSiblings` (Task 5), `hasTag` (Task 1), `navigate`, `formatRoute`, `useRoute` (Task 8), `useGraph`, `TopBar`, `TagPills` (Task 8).
- Produces: `ColumnItem { kind: 'package' | 'group'; label; index; prefix; members: number[]; selected }`, `ColumnModel { key; title; parentIndex; parentId; total; items }`, `columnsForRoute(graph, path, group): ColumnModel[]`, `<Explorer graph path group />`.

- [ ] **Step 1: Write the failing columns test**

`src/explorer/columns.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { columnsForRoute } from './columns';

const small = graphFromIds(['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf']);

const wideNames = [
  ...['', 'ch', 'pn', 'tk', 'wd', 'yc', 'mtk'].map((s) => `svariance${s}`),
  ...['dmax', 'dmin', 'dmean', 'dnanmax', 'smax', 'smin', 'smean', 'ssum', 'dsum', 'zsum', 'csum', 'gsum', 'sabs', 'sabs2', 'dabs', 'dabs2', 'nanmax', 'nanmin', 'range', 'mean'],
];
const wide = graphFromIds(wideNames.map((n) => `stats/base/ndarray/${n}`));

describe('columnsForRoute', () => {
  it('shows one root column at the root', () => {
    const cols = columnsForRoute(small, '', null);
    expect(cols).toHaveLength(1);
    expect(cols[0].title).toBe('stdlib');
    expect(cols[0].items.map((i) => i.label)).toEqual(['assert', 'math']);
    expect(cols[0].items.every((i) => !i.selected)).toBe(true);
  });

  it('opens one column per path segment and marks the selected box', () => {
    const cols = columnsForRoute(small, 'math/base/special', null);
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'math', 'base', 'special']);
    expect(cols[0].items.find((i) => i.label === 'math')?.selected).toBe(true);
    expect(cols[3].items.map((i) => i.label)).toEqual(['lnf', 'logf']);
    expect(cols[3].parentId).toBe('math/base/special');
    expect(cols[3].total).toBe(2);
  });

  it('stops at an unknown segment', () => {
    expect(columnsForRoute(small, 'math/nope/x', null).map((c) => c.title)).toEqual(['stdlib', 'math']);
  });

  it('inserts a group column when the next segment sits inside a group', () => {
    const cols = columnsForRoute(wide, 'stats/base/ndarray/svariancepn', null);
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'stats', 'base', 'ndarray', 'svariance…', 'svariancepn']);
    const group = cols[3].items.find((i) => i.kind === 'group' && i.prefix === 'svariance');
    expect(group?.selected).toBe(true);
    expect(cols[4].items.find((i) => i.label === 'svariancepn')?.selected).toBe(true);
    expect(cols[4].total).toBe(7);
  });

  it('opens a group column at the end when the route asks for it', () => {
    const cols = columnsForRoute(wide, 'stats/base/ndarray', 'svariance');
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'stats', 'base', 'ndarray', 'svariance…']);
    expect(cols[4].items.every((i) => !i.selected)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/explorer/columns.test.ts
```
Expected: FAIL — `Cannot find module './columns'`.

- [ ] **Step 3: Write `src/explorer/columns.ts`**

```ts
import type { Graph } from '../graph/Graph';
import { clusterSiblings, type SiblingItem } from '../graph/clusterSiblings';

export interface ColumnItem {
  kind: 'package' | 'group';
  label: string;
  /** Graph index for packages; -1 for groups. */
  index: number;
  /** Group prefix; '' for packages. */
  prefix: string;
  /** Group member indexes; [] for packages. */
  members: number[];
  selected: boolean;
}

export interface ColumnModel {
  key: string;
  title: string;
  parentIndex: number;
  parentId: string;
  total: number;
  items: ColumnItem[];
}

function toItem(c: SiblingItem, byName: Map<string, number>, nextSeg: string | null): ColumnItem {
  if (c.kind === 'single') {
    return { kind: 'package', label: c.name, index: byName.get(c.name)!, prefix: '', members: [], selected: c.name === nextSeg };
  }
  return {
    kind: 'group',
    label: `${c.prefix}…`,
    index: -1,
    prefix: c.prefix,
    members: c.members.map((m) => byName.get(m)!),
    selected: nextSeg !== null && c.members.includes(nextSeg),
  };
}

export function columnsForRoute(graph: Graph, path: string, group: string | null): ColumnModel[] {
  const segs = path ? path.split('/') : [];
  const columns: ColumnModel[] = [];
  let parentIndex = -1;
  let parentId = '';
  for (let depth = 0; depth <= segs.length; depth++) {
    const nextSeg = segs[depth] ?? null;
    const byName = new Map(graph.children(parentIndex).map((i) => [graph.name(i), i]));
    const items = clusterSiblings([...byName.keys()]).map((c) => toItem(c, byName, nextSeg));
    columns.push({
      key: parentId || '~root',
      title: parentIndex < 0 ? 'stdlib' : graph.name(parentIndex),
      parentIndex,
      parentId,
      total: graph.descendantCount(parentIndex),
      items,
    });
    const openGroup = items.find(
      (it) => it.kind === 'group' && (it.selected || (nextSeg === null && group !== null && it.prefix === group)),
    );
    if (openGroup) {
      openGroup.selected = true;
      columns.push({
        key: `${parentId}/~${openGroup.prefix}`,
        title: `${openGroup.prefix}…`,
        parentIndex,
        parentId,
        total: openGroup.members.length,
        items: openGroup.members.map((i) => ({
          kind: 'package',
          label: graph.name(i),
          index: i,
          prefix: '',
          members: [],
          selected: graph.name(i) === nextSeg,
        })),
      });
    }
    if (nextSeg === null) break;
    const nextIndex = byName.get(nextSeg);
    if (nextIndex === undefined) break;
    parentIndex = nextIndex;
    parentId = parentId ? `${parentId}/${nextSeg}` : nextSeg;
  }
  return columns;
}
```

- [ ] **Step 4: Run the columns test to verify it passes**

```bash
npx vitest run src/explorer/columns.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 5: Write the failing Explorer render test**

`src/explorer/Explorer.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { Explorer } from './Explorer';

const g = graphFromIds(['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf']);

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('Explorer', () => {
  it('renders columns for the path and the breadcrumb', () => {
    render(<Explorer graph={g} path="math/base" group={null} />);
    expect(screen.getAllByRole('listbox')).toHaveLength(3);
    expect(screen.getByRole('navigation', { name: 'path' }).textContent).toContain('base');
  });

  it('navigates into a namespace box and to a leaf box', () => {
    render(<Explorer graph={g} path="math/base/special" group={null} />);
    fireEvent.click(screen.getByRole('option', { name: /^logf/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/logf');
    fireEvent.click(screen.getByRole('option', { name: /^assert/ }));
    expect(window.location.hash).toBe('#/explore/assert');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx vitest run src/explorer/Explorer.test.tsx
```
Expected: FAIL — `Cannot find module './Explorer'`.

- [ ] **Step 7: Write `src/explorer/Breadcrumb.tsx`**

```tsx
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
```

- [ ] **Step 8: Write `src/explorer/Column.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import { formatRoute } from '../app/router';
import { TagPills } from '../ui/TagPills';
import type { ColumnItem, ColumnModel } from './columns';

interface Props {
  graph: Graph;
  column: ColumnModel;
  /** True when a box in the previous column is selected and leads here. */
  connected: boolean;
  onSelect: (item: ColumnItem) => void;
}

const fmt = new Intl.NumberFormat('en-US');

export function Column({ graph, column, connected, onSelect }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [column.key]);

  const isPackage = column.parentIndex >= 0 && !hasTag(graph.tags[column.parentIndex], 'FOLDER') && !column.key.includes('/~');

  return (
    <section className={`column${connected ? ' is-connected' : ''}`} aria-label={column.title}>
      <header className="column-head">
        <span className="column-title">{column.title}</span>
        <span className="column-meta">
          {isPackage && (
            <a className="column-open" href={formatRoute({ kind: 'module', id: column.parentId, edges: ['runtime'] })}>
              open
            </a>
          )}
          <span className="column-total">{fmt.format(column.total)}</span>
        </span>
      </header>
      <div className="column-list" role="listbox" aria-label={`${column.title} contents`}>
        {column.items.map((item) => {
          const isGroup = item.kind === 'group';
          const mask = isGroup ? 0 : graph.tags[item.index];
          const childCount = !isGroup && hasTag(mask, 'NAMESPACE') ? graph.children(item.index).length : 0;
          return (
            <button
              key={item.label}
              ref={item.selected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={item.selected}
              className={`box${item.selected ? ' is-selected' : ''}${isGroup ? ' is-group' : ''}`}
              onClick={() => onSelect(item)}
            >
              <span className="box-name">{item.label}</span>
              {isGroup ? (
                <span className="box-count">{item.members.length}</span>
              ) : (
                <>
                  <TagPills mask={mask} />
                  {childCount > 0 && <span className="box-count">{childCount} ›</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Write `src/explorer/Explorer.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react';
import type { Graph } from '../graph/Graph';
import { hasTag } from '../graph/tags';
import { navigate } from '../app/router';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { columnsForRoute, type ColumnItem, type ColumnModel } from './columns';
import './explorer.css';

interface Props {
  graph: Graph;
  path: string;
  group: string | null;
}

export function Explorer({ graph, path, group }: Props) {
  const columns = useMemo(() => columnsForRoute(graph, path, group), [graph, path, group]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.scrollWidth });
  }, [columns.length]);

  const onSelect = (column: ColumnModel, item: ColumnItem) => {
    if (item.kind === 'group') {
      navigate({ kind: 'explore', path: column.parentId, group: item.prefix });
      return;
    }
    const id = graph.ids[item.index];
    if (hasTag(graph.tags[item.index], 'NAMESPACE')) navigate({ kind: 'explore', path: id, group: null });
    else navigate({ kind: 'module', id, edges: ['runtime'] });
  };

  return (
    <section className="explorer">
      <Breadcrumb path={path} group={group} />
      <div className="columns" ref={scroller}>
        {columns.map((column, i) => (
          <Column
            key={column.key}
            graph={graph}
            column={column}
            connected={i > 0 && columns[i - 1].items.some((it) => it.selected)}
            onSelect={(item) => onSelect(column, item)}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Write `src/explorer/explorer.css`**

```css
.explorer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--topbar-h));
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  padding: 12px 20px 8px;
  font-family: var(--font-mono);
  font-size: var(--fs-2);
  color: var(--ink-muted);
}

.breadcrumb a {
  color: inherit;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--trace);
}

.breadcrumb .sep {
  margin: 0 4px;
  opacity: 0.5;
}

.columns {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--col-gap);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 20px 20px;
  scroll-snap-type: x proximity;
}

.column {
  flex: 0 0 var(--col-w);
  display: flex;
  flex-direction: column;
  min-height: 0;
  scroll-snap-align: start;
}

.column-head {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 8px;
}

/* the wire: a trace-coloured underline drawn under the head of a column reached from a selected box */
.column-head::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--trace);
  transform: scaleX(0);
  transform-origin: left;
}

.column.is-connected .column-head::after {
  transform: scaleX(1);
  transition: transform 120ms ease-out;
}

.column.is-connected .column-title {
  color: var(--trace);
}

.column-title {
  font-weight: 600;
  font-size: var(--fs-3);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
}

.column-open {
  font-size: var(--fs-1);
  text-decoration: none;
}

.column-open:hover {
  text-decoration: underline;
}

.column-total {
  font-family: var(--font-mono);
  font-size: var(--fs-1);
  color: var(--ink-muted);
}

.column-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 2px 2px 0;
}

.box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
  cursor: pointer;
}

.box:hover {
  border-color: var(--trace);
}

.box-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: var(--fs-2);
}

.box-count {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-1);
  color: var(--ink-muted);
}

.box.is-group {
  box-shadow: 2px 2px 0 -1px var(--surface), 2px 2px 0 0 var(--line);
}

.box.is-selected {
  background: var(--trace);
  border-color: var(--trace);
  color: var(--trace-ink);
}

.box.is-selected .box-count {
  color: inherit;
  opacity: 0.8;
}

.box.is-selected .pill {
  --pill: var(--trace-ink);
}

@media (max-width: 719px) {
  .breadcrumb { padding: 10px 12px 6px; }
  .columns { padding: 0 12px 12px; gap: 0; }
  .column { flex: 1 0 100%; }
  .column:not(:last-child) { display: none; }
}
```

- [ ] **Step 11: Replace `src/app/App.tsx`**

```tsx
import { useState } from 'react';
import { Explorer } from '../explorer/Explorer';
import { TopBar } from './TopBar';
import { useGraph } from './useGraph';
import { useRoute } from './router';
import './app.css';

export default function App() {
  const state = useGraph();
  const route = useRoute();
  const [, setSearchOpen] = useState(false);

  let content;
  if (state.status === 'loading') content = <p className="app-note muted">Loading the package map…</p>;
  else if (state.status === 'error') content = <p className="app-note">{state.message}</p>;
  else if (route.kind === 'explore') content = <Explorer graph={state.graph} path={route.path} group={route.group} />;
  else content = <Explorer graph={state.graph} path={route.id.slice(0, route.id.lastIndexOf('/'))} group={null} />;

  return (
    <div className="app">
      <TopBar onSearch={() => setSearchOpen(true)} />
      <main className="app-main">{content}</main>
    </div>
  );
}
```

`src/app/app.css`:
```css
.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  min-height: 0;
}

.app-note {
  padding: 40px 20px;
  max-width: 60ch;
}
```

- [ ] **Step 12: Run tests, typecheck, and look at it in the browser**

```bash
npm test && npx tsc --noEmit
npm run dev
```
Open `http://localhost:5173/#/explore/stats/base/ndarray/svariancepn`. Expected: five columns, `svariance…` group box selected in the `ndarray` column, `svariancepn` selected in the group column, breadcrumb `stdlib › stats › base › ndarray › svariancepn`. Resize below 720 px: only the last column shows. Fix anything that looks off before committing.

- [ ] **Step 13: Commit**

```bash
git add src/explorer src/app
git commit -m "feat: Miller-column explorer with sibling grouping"
```

---

### Task 10: Module focus view

**Files:**
- Create: `src/focus/neighbourhood.ts`
- Create: `src/focus/Focus.tsx`, `src/focus/PathTreeView.tsx`, `src/focus/focus.css`
- Modify: `src/app/App.tsx` (route `module` → `<Focus>`)
- Test: `src/focus/neighbourhood.test.ts`, `src/focus/Focus.test.tsx`

**Interfaces:**
- Consumes: `Graph` (Task 4), `buildPathTree`, `PathNode` (Task 6), `EdgeKind`, `EDGE_KINDS` (Task 3), `formatRoute`, `navigate` (Task 8), `TagPills` (Task 8), `hasTag`.
- Produces: `Neighbourhood { requires: number[]; requiredBy: number[]; connected: number }`, `neighbourhood(graph, index, kinds): Neighbourhood`, `<Focus graph id edges />`, `<PathTreeView graph title indexes />`.

- [ ] **Step 1: Write the failing neighbourhood test**

`src/focus/neighbourhood.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { neighbourhood } from './neighbourhood';

const g = graphFromIds(['a', 'b', 'c', 'd'], {
  runtime: [['a', 'b'], ['c', 'a']],
  dev: [['a', 'c'], ['d', 'a']],
  native: [['a', 'b']],
});
const at = (id: string) => g.indexOf(id);

describe('neighbourhood', () => {
  it('collects runtime neighbours only by default', () => {
    expect(neighbourhood(g, at('a'), ['runtime'])).toEqual({ requires: [at('b')], requiredBy: [at('c')], connected: 2 });
  });
  it('unions across edge kinds without double counting', () => {
    const n = neighbourhood(g, at('a'), ['runtime', 'dev', 'native']);
    expect(n.requires).toEqual([at('b'), at('c')]);
    expect(n.requiredBy).toEqual([at('c'), at('d')]);
    expect(n.connected).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/focus/neighbourhood.test.ts
```
Expected: FAIL — `Cannot find module './neighbourhood'`.

- [ ] **Step 3: Write `src/focus/neighbourhood.ts`**

```ts
import type { Graph } from '../graph/Graph';
import type { EdgeKind } from '../graph/types';

export interface Neighbourhood {
  requires: number[];
  requiredBy: number[];
  connected: number;
}

export function neighbourhood(graph: Graph, index: number, kinds: EdgeKind[]): Neighbourhood {
  const req = new Set<number>();
  const by = new Set<number>();
  for (const kind of kinds) {
    for (const j of graph.deps(index, kind)) req.add(j);
    for (const j of graph.dependents(index, kind)) by.add(j);
  }
  const asc = (a: number, b: number) => a - b;
  return {
    requires: [...req].sort(asc),
    requiredBy: [...by].sort(asc),
    connected: new Set([...req, ...by]).size,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/focus/neighbourhood.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Write the failing Focus render test**

`src/focus/Focus.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { Focus } from './Focus';

const g = graphFromIds(
  ['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf', 'math/base/special/log10f', 'blas/base/dasum'],
  {
    runtime: [['math/base/special/logf', 'math/base/special/lnf'], ['math/base/special/log10f', 'math/base/special/logf']],
    dev: [['math/base/special/logf', 'assert/is-nan']],
    native: [['blas/base/dasum', 'math/base/special/logf']],
  },
);

afterEach(cleanup);

describe('Focus', () => {
  it('shows the module, counts, and both sides as trees of links', () => {
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('math/base/special/logf');
    expect(screen.getByText('Requires 1')).toBeTruthy();
    expect(screen.getByText('Required by 1')).toBeTruthy();
    expect(screen.getByText('Connected 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^lnf/ }).getAttribute('href')).toBe('#/module/math/base/special/lnf');
    expect(screen.getByRole('link', { name: /^log10f/ }).getAttribute('href')).toBe('#/module/math/base/special/log10f');
  });

  it('includes dev and native edges when toggled on', () => {
    window.location.hash = '#/module/math/base/special/logf';
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime']} />);
    fireEvent.click(screen.getByRole('button', { name: /dev/ }));
    expect(window.location.hash).toBe('#/module/math/base/special/logf?edges=runtime,dev');
    cleanup();
    render(<Focus graph={g} id="math/base/special/logf" edges={['runtime', 'dev', 'native']} />);
    expect(screen.getByText('Requires 2')).toBeTruthy();
    expect(screen.getByText('Required by 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^is-nan/ })).toBeTruthy();
  });

  it('explains an unknown id', () => {
    render(<Focus graph={g} id="nope/nothing" edges={['runtime']} />);
    expect(screen.getByText(/No package named/).textContent).toContain('nope/nothing');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx vitest run src/focus/Focus.test.tsx
```
Expected: FAIL — `Cannot find module './Focus'`.

- [ ] **Step 7: Write `src/focus/PathTreeView.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { buildPathTree, type PathNode } from '../graph/pathTree';
import { formatRoute } from '../app/router';
import { TagPills } from '../ui/TagPills';

interface Props {
  graph: Graph;
  title: string;
  indexes: number[];
}

const COLLAPSE_ABOVE = 40;

export function PathTreeView({ graph, title, indexes }: Props) {
  const tree = useMemo(() => buildPathTree(indexes.map((i) => graph.ids[i]), (id) => graph.indexOf(id)), [graph, indexes]);
  const [closed, setClosed] = useState<Set<string>>(() => {
    // start with deep folders collapsed when the side is large
    const out = new Set<string>();
    if (tree.leafCount > COLLAPSE_ABOVE) {
      const walk = (n: PathNode, depth: number) => {
        if (depth >= 2 && n.children.length > 0) out.add(n.path);
        n.children.forEach((c) => walk(c, depth + 1));
      };
      tree.children.forEach((c) => walk(c, 1));
    }
    return out;
  });

  const toggle = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <section className="side">
      <h2 className="side-title">
        {title} {indexes.length}
      </h2>
      {indexes.length === 0 ? (
        <p className="muted side-empty">None.</p>
      ) : (
        <ul className="tree">
          {tree.children.map((n) => (
            <TreeRow key={n.path} graph={graph} node={n} closed={closed} toggle={toggle} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RowProps {
  graph: Graph;
  node: PathNode;
  closed: Set<string>;
  toggle: (path: string) => void;
}

function TreeRow({ graph, node, closed, toggle }: RowProps) {
  const isFolder = node.children.length > 0;
  const isOpen = !closed.has(node.path);
  return (
    <li className="tree-row">
      <div className="tree-line">
        {isFolder && (
          <button type="button" className="tree-caret" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.label}`} onClick={() => toggle(node.path)}>
            {isOpen ? '▾' : '▸'}
          </button>
        )}
        {node.index >= 0 ? (
          <a className="tree-leaf" href={formatRoute({ kind: 'module', id: node.path, edges: ['runtime'] })}>
            <span className="mono">{node.label}</span>
            <TagPills mask={graph.tags[node.index]} />
          </a>
        ) : (
          <a className="tree-folder mono" href={formatRoute({ kind: 'explore', path: node.path, group: null })}>
            {node.label}
          </a>
        )}
        {isFolder && <span className="tree-count mono">{node.leafCount}</span>}
      </div>
      {isFolder && isOpen && (
        <ul className="tree">
          {node.children.map((c) => (
            <TreeRow key={c.path} graph={graph} node={c} closed={closed} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [ ] **Step 8: Write `src/focus/Focus.tsx`**

```tsx
import { useMemo } from 'react';
import type { Graph } from '../graph/Graph';
import { EDGE_KINDS, type EdgeKind } from '../graph/types';
import { formatRoute, navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import { neighbourhood } from './neighbourhood';
import { PathTreeView } from './PathTreeView';
import './focus.css';

interface Props {
  graph: Graph;
  id: string;
  edges: EdgeKind[];
}

const KIND_LABEL: Record<EdgeKind, string> = { runtime: 'runtime', dev: 'dev', native: 'C' };
const GITHUB = 'https://github.com/stdlib-js/stdlib/tree/develop/lib/node_modules/@stdlib/';

export function Focus({ graph, id, edges }: Props) {
  const index = graph.indexOf(id);
  const n = useMemo(() => (index >= 0 ? neighbourhood(graph, index, edges) : null), [graph, index, edges]);

  if (index < 0 || !n) {
    return (
      <section className="focus-missing">
        <p>
          No package named <span className="mono">{id}</span>. <a href="#/">Browse from the top</a> or search with ⌘K.
        </p>
      </section>
    );
  }

  const parent = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
  const toggleKind = (kind: EdgeKind) => {
    const next = edges.includes(kind) ? edges.filter((k) => k !== kind) : EDGE_KINDS.filter((k) => k === kind || edges.includes(k));
    navigate({ kind: 'module', id, edges: next.length ? next : ['runtime'] });
  };

  return (
    <section className="focus">
      <a className="focus-back mono" href={formatRoute({ kind: 'explore', path: parent, group: null })}>
        ‹ explore {parent || 'stdlib'}
      </a>
      <div className="focus-grid">
        <PathTreeView graph={graph} title="Requires" indexes={n.requires} />
        <article className="module-card">
          <h1 className="module-id mono">{id}</h1>
          {graph.desc[index] && <p className="module-desc">{graph.desc[index]}</p>}
          <TagPills mask={graph.tags[index]} />
          <ul className="module-facts">
            <li>Requires {n.requires.length}</li>
            <li>Required by {n.requiredBy.length}</li>
            <li>Connected {n.connected}</li>
          </ul>
          <div className="edge-toggle" role="group" aria-label="edge kinds">
            {EDGE_KINDS.map((kind) => (
              <button key={kind} type="button" aria-pressed={edges.includes(kind)} className={edges.includes(kind) ? 'is-on' : ''} onClick={() => toggleKind(kind)}>
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <p className="module-links">
            <a href={GITHUB + id} target="_blank" rel="noreferrer">Open on GitHub</a>
            <a href={formatRoute({ kind: 'explore', path: id, group: null })}>Browse inside</a>
          </p>
        </article>
        <PathTreeView graph={graph} title="Required by" indexes={n.requiredBy} />
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Write `src/focus/focus.css`**

```css
.focus {
  padding: 12px 20px 40px;
}

.focus-missing {
  padding: 40px 20px;
  max-width: 60ch;
}

.focus-back {
  display: inline-block;
  margin-bottom: 16px;
  font-size: var(--fs-2);
  color: var(--ink-muted);
  text-decoration: none;
}

.focus-back:hover {
  color: var(--trace);
}

.focus-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 400px) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.module-card {
  position: sticky;
  top: 12px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--trace);
  border-radius: var(--radius);
  box-shadow: 0 0 0 4px var(--trace-soft);
}

.module-id {
  margin: 0 0 8px;
  font-size: var(--fs-4);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.module-desc {
  margin: 0 0 12px;
  color: var(--ink-muted);
  max-width: 48ch;
}

.module-facts {
  list-style: none;
  margin: 16px 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--line);
  display: grid;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: var(--fs-2);
}

.edge-toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.edge-toggle button {
  padding: 5px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: var(--fs-2);
  color: var(--ink-muted);
}

.edge-toggle button + button {
  border-left: 1px solid var(--line);
}

.edge-toggle button.is-on {
  background: var(--trace);
  color: var(--trace-ink);
}

.module-links {
  display: flex;
  gap: 16px;
  margin: 16px 0 0;
  font-size: var(--fs-2);
}

.side-title {
  margin: 0 0 8px;
  font-size: var(--fs-3);
  font-weight: 600;
}

.side-empty {
  margin: 0;
}

.tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree .tree {
  margin-left: 9px;
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.tree-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  font-size: var(--fs-2);
}

.tree-caret {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
  font-size: 11px;
}

.tree-folder {
  color: var(--ink-muted);
  text-decoration: none;
}

.tree-folder:hover {
  color: var(--trace);
}

.tree-leaf {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  text-decoration: none;
  padding: 2px 6px;
  margin-left: -6px;
  border-radius: 3px;
}

.tree-leaf:hover {
  background: var(--trace-soft);
  color: var(--trace);
}

.tree-count {
  margin-left: auto;
  font-size: var(--fs-1);
  color: var(--ink-muted);
}

@media (max-width: 900px) {
  .focus-grid {
    grid-template-columns: 1fr;
  }
  .module-card {
    position: static;
    order: -1;
  }
}
```

- [ ] **Step 10: Wire the route in `src/app/App.tsx`**

Replace the two `content` branches for `state.status === 'ready'` with:
```tsx
  else if (route.kind === 'explore') content = <Explorer graph={state.graph} path={route.path} group={route.group} />;
  else content = <Focus graph={state.graph} id={route.id} edges={route.edges} />;
```
and add `import { Focus } from '../focus/Focus';` at the top.

- [ ] **Step 11: Run tests, typecheck, check in the browser**

```bash
npm test && npx tsc --noEmit
npm run dev
```
Open `http://localhost:5173/#/module/math/base/special/logf` — expect a card in the middle, requires on the left as a path tree, required by on the right. Then open `#/module/utils/define-nonenumerable-read-only-property` — "Required by" should be ~2,000 leaves grouped under top-level folders with deep folders collapsed, and the page must stay responsive. Toggle `dev` and `C` and confirm the hash and counts change.

- [ ] **Step 12: Commit**

```bash
git add src/focus src/app/App.tsx
git commit -m "feat: module focus view with requires/required-by path trees"
```

---

### Task 11: Search palette with keyboard shortcut

**Files:**
- Create: `src/search/useShortcut.ts`, `src/search/SearchPalette.tsx`, `src/search/search.css`
- Modify: `src/app/App.tsx` (open/close palette, hook shortcut)
- Test: `src/search/SearchPalette.test.tsx`

**Interfaces:**
- Consumes: `Graph` (Task 4), `createSearch`, `highlightRange` (Task 7), `navigate` (Task 8), `TagPills` (Task 8), `hasTag` (Task 1).
- Produces: `useShortcut(onOpen: () => void): void`, `<SearchPalette graph onClose />`.

- [ ] **Step 1: Write the failing test**

`src/search/SearchPalette.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { graphFromIds } from '../graph/testUtils';
import { SearchPalette } from './SearchPalette';

const g = graphFromIds(['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f', 'utils/noop']);

beforeEach(() => {
  window.location.hash = '';
});
afterEach(cleanup);

describe('SearchPalette', () => {
  it('lists scored results as you type and opens the active one on Enter', () => {
    const onClose = vi.fn();
    render(<SearchPalette graph={g} onClose={onClose} />);
    const input = screen.getByRole('combobox');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'logf' } });
    const options = screen.getAllByRole('option');
    expect(options[0].textContent).toContain('math/base/special/logf');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/module/math/base/special/logf');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a folder node in the explorer instead of the focus view', () => {
    render(<SearchPalette graph={g} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'special' } });
    fireEvent.click(screen.getByRole('option', { name: /math\/base\/special$/ }));
    expect(window.location.hash).toBe('#/explore/math/base/special');
  });

  it('shows an empty state and closes on Escape', () => {
    const onClose = vi.fn();
    render(<SearchPalette graph={g} onClose={onClose} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No package matches “zzzz”.')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/search/SearchPalette.test.tsx
```
Expected: FAIL — `Cannot find module './SearchPalette'`.

- [ ] **Step 3: Write `src/search/useShortcut.ts`**

```ts
import { useEffect } from 'react';

/** Opens the palette on ⌘K / Ctrl+K anywhere, and on "/" when not typing in a field. */
export function useShortcut(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
        return;
      }
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}
```

- [ ] **Step 4: Write `src/search/SearchPalette.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../graph/Graph';
import { createSearch, highlightRange } from '../graph/search';
import { hasTag } from '../graph/tags';
import { navigate } from '../app/router';
import { TagPills } from '../ui/TagPills';
import './search.css';

interface Props {
  graph: Graph;
  onClose: () => void;
}

function Highlighted({ id, query }: { id: string; query: string }) {
  const range = highlightRange(id, query);
  if (!range) return <>{id}</>;
  const [a, b] = range;
  return (
    <>
      {id.slice(0, a)}
      <mark>{id.slice(a, b)}</mark>
      {id.slice(b)}
    </>
  );
}

export function SearchPalette({ graph, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useMemo(() => createSearch(graph.ids), [graph]);
  const hits = useMemo(() => search(query, 12), [search, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [query]);

  const open = (index: number) => {
    const id = graph.ids[index];
    if (hasTag(graph.tags[index], 'FOLDER')) navigate({ kind: 'explore', path: id, group: null });
    else navigate({ kind: 'module', id, edges: ['runtime'] });
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      open(hits[active].index);
    }
  };

  const trimmed = query.trim();

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search packages" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input mono"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="palette-results"
          aria-activedescendant={hits[active] ? `hit-${hits[active].index}` : undefined}
          aria-autocomplete="list"
          placeholder="Package name or path, e.g. logf or blas/base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {trimmed && hits.length === 0 && <p className="palette-empty muted">No package matches “{trimmed}”.</p>}
        {hits.length > 0 && (
          <ul id="palette-results" className="palette-results" role="listbox">
            {hits.map((h, i) => (
              <li
                key={h.index}
                id={`hit-${h.index}`}
                role="option"
                aria-selected={i === active}
                className={`palette-hit${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(h.index)}
              >
                <span className="palette-id mono">
                  <Highlighted id={graph.ids[h.index]} query={query} />
                </span>
                <TagPills mask={graph.tags[h.index]} />
              </li>
            ))}
          </ul>
        )}
        <p className="palette-hint muted">↑ ↓ to move, Enter to open, Esc to close</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/search/search.css`**

```css
.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(16, 24, 32, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 16px 0;
}

.palette {
  width: min(640px, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.palette-input {
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-3);
  outline: none;
}

.palette-input::placeholder {
  color: var(--ink-muted);
}

.palette-results {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 50vh;
  overflow-y: auto;
}

.palette-hit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--radius);
  cursor: pointer;
}

.palette-hit.is-active {
  background: var(--trace-soft);
}

.palette-id {
  font-size: var(--fs-2);
  overflow-wrap: anywhere;
}

.palette-id mark {
  background: transparent;
  color: var(--trace);
  font-weight: 500;
}

.palette-empty {
  margin: 0;
  padding: 16px;
}

.palette-hint {
  margin: 0;
  padding: 8px 16px 10px;
  border-top: 1px solid var(--line);
  font-size: var(--fs-1);
}
```

- [ ] **Step 6: Wire the palette into `src/app/App.tsx`**

Replace the file with:
```tsx
import { useCallback, useState } from 'react';
import { Explorer } from '../explorer/Explorer';
import { Focus } from '../focus/Focus';
import { SearchPalette } from '../search/SearchPalette';
import { useShortcut } from '../search/useShortcut';
import { TopBar } from './TopBar';
import { useGraph } from './useGraph';
import { useRoute } from './router';
import './app.css';

export default function App() {
  const state = useGraph();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useShortcut(openSearch);

  let content;
  if (state.status === 'loading') content = <p className="app-note muted">Loading the package map…</p>;
  else if (state.status === 'error') content = <p className="app-note">{state.message}</p>;
  else if (route.kind === 'explore') content = <Explorer graph={state.graph} path={route.path} group={route.group} />;
  else content = <Focus graph={state.graph} id={route.id} edges={route.edges} />;

  return (
    <div className="app">
      <TopBar onSearch={openSearch} />
      <main className="app-main">{content}</main>
      {searchOpen && state.status === 'ready' && <SearchPalette graph={state.graph} onClose={closeSearch} />}
    </div>
  );
}
```

- [ ] **Step 7: Run tests, typecheck, try the shortcut**

```bash
npm test && npx tsc --noEmit
npm run dev
```
Press ⌘K (or Ctrl+K, or `/`) on any page; type `logf`; Enter. Expected: focus view for `math/base/special/logf`. Esc closes; clicking the backdrop closes.

- [ ] **Step 8: Commit**

```bash
git add src/search src/app/App.tsx
git commit -m "feat: search palette with keyboard shortcut"
```

---

### Task 12: Legend, README, production build and smoke check

**Files:**
- Create: `src/ui/Legend.tsx` and append styles to `src/ui/pills.css`
- Modify: `src/app/App.tsx` (render `<Legend />` under `main`)
- Create: `README.md`
- Create: `e2e/smoke.mjs` (optional Playwright script)

**Interfaces:**
- Consumes: `TAG_LABEL` (Task 1).
- Produces: `<Legend />`.

- [ ] **Step 1: Write `src/ui/Legend.tsx`**

```tsx
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
```

Append to `src/ui/pills.css`:
```css
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  padding: 10px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface);
  font-size: var(--fs-1);
  color: var(--ink-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

In `src/app/App.tsx`, add `import { Legend } from '../ui/Legend';` and render `<Legend />` right after `</main>`. In `src/explorer/explorer.css`, change the explorer height to `calc(100vh - var(--topbar-h) - 38px)` so the legend stays visible without page scroll.

- [ ] **Step 2: Write `README.md`**

```markdown
# graphify-stdlibjs

Browse the stdlib-js monorepo as a dependency map: drill from `stdlib` down to any package one column at a time, or press ⌘K / Ctrl+K and search for a package to see what it requires and what requires it.

## Run

    npm install
    npm run extract -- --stdlib ../stdlib   # regenerate public/data/graph.json from a stdlib checkout
    npm run dev                              # http://localhost:5173

`public/data/graph.json` is committed, so `npm run dev` works without a stdlib checkout.

## Scripts

- `npm test` — unit tests (Vitest)
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve `dist/`
- `npm run extract` — rebuild the graph file (`--stdlib <path>`, `--out <file>`)

## How it works

The extractor scans every `package.json` under `lib/node_modules/@stdlib`, reads `require('@stdlib/…')` calls in `lib/` (runtime edges) and in `test/`, `benchmark/`, `examples/` (dev edges), and `manifest.json` build dependencies (C edges). It writes one JSON file with sorted package ids, a tag bitmask per package, and three CSR adjacency lists. The app loads that file once; hierarchy is answered by binary search over the sorted ids, dependents by a reverse CSR built at load, and search by a scored scan over ~6k ids.

Tags: `js` JavaScript implementation · `c` C implementation · `f` Fortran · `wasm` WebAssembly build · `native` JS bridge to the native add-on · `cli` command-line interface.
```

- [ ] **Step 3: Production build and preview**

```bash
npm test && npm run build && npm run preview
```
Open the preview URL and check, in this order: root explorer shows 47 boxes; `#/explore/stats/base/ndarray` shows grouped boxes; ⌘K → `svariancepn` → Enter lands on its focus view; the `dev` and `C` toggles work; narrow the window under 720 px and confirm one column at a time with the breadcrumb; switch the OS to dark mode and confirm contrast; tab through boxes and confirm the focus ring is visible.

- [ ] **Step 4: (Optional) Playwright smoke script**

If Playwright is available (`npx playwright --version`), add `e2e/smoke.mjs`:
```js
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/#/explore/stats/base/ndarray/svariancepn`);
await page.waitForSelector('.column');
console.log('columns:', await page.locator('.column').count());
await page.screenshot({ path: 'e2e/explorer.png' });

await page.keyboard.press('Meta+K');
await page.fill('.palette-input', 'logf');
await page.keyboard.press('Enter');
await page.waitForSelector('.module-card');
console.log('focus id:', await page.locator('.module-id').textContent());
await page.screenshot({ path: 'e2e/focus.png' });

await browser.close();
```
Run with `npm run preview` in one terminal and `node e2e/smoke.mjs` in another. Expected: `columns: 6`, `focus id: math/base/special/logf`, two screenshots to eyeball.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tag legend, README and production build check"
```

---

## Self-review

**Spec coverage**
- Explore hierarchy one click per level → Task 9 (columns, breadcrumb, namespace vs leaf navigation).
- Compression of wide sibling lists → Task 5 (`clusterSiblings`) used in Task 9; group columns and `?g=` route → Tasks 8/9.
- Search with shortcut (⌘K / Ctrl+K / `/`) → Task 11.
- Search result shows only the module's neighbourhood with counts (requires / required by / connected) as path trees → Tasks 6, 10.
- Tags with distinct colours (js, c, f, wasm, native, cli) → Tasks 1, 2, 8, 12 (legend).
- Data structure: sorted ids + CSR + reverse CSR + in-memory search → Tasks 3, 4, 7; rationale recorded in the spec.
- Responsive + dark mode + reduced motion + focus ring → Tasks 1 (tokens/base), 9, 10, 11 CSS; verified in Task 12.
- Working end to end from a fresh clone (data committed) → Task 3 step 8, Task 12 README.

**Placeholder scan** — no TBD/TODO; every code step carries its full content. The Task 1 `App.tsx` and Task 9 module-route fallback are transitional and replaced within the plan (Tasks 9 and 10).

**Type consistency** — `ColumnItem`/`ColumnModel` fields match between `columns.ts`, `Column.tsx`, `Explorer.tsx`; `Route` shapes match between `router.ts`, `Explorer`, `Focus`, `SearchPalette`; `neighbourhood()` returns `{requires, requiredBy, connected}` as consumed by `Focus`; `graphFromIds(ids, edges)` signature is the same in every test that uses it; `PathNode` fields `label/path/index/leafCount/children` match between `pathTree.ts` and `PathTreeView.tsx`.
