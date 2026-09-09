// Throwaway measurement script for issue #11.
//
// Measures, for runtime/dev/native edges separately, against a real stdlib
// checkout:
//   - total edges produced by the current extractor (scripts/extract/scan.ts)
//   - how many are "ancestor-walk-only" (resolveSpec found no exact id match
//     and had to walk up the path)
//   - how many edges the proposed declared-dependencies rule (map #1: a
//     runtime edge A -> B is emitted only if B is in A's package.json
//     "dependencies") would remove, and of those, how many were exact
//     matches (the dangerous subset: real edges lost to an under-declared
//     package.json)
//
// It imports the *actual* scan.ts helpers rather than reimplementing them,
// so the edge set it measures is the one the real extractor produces.
//
// Usage:
//   npx tsx docs/research/measure-dependency-rule.ts [path-to-stdlib-checkout]
//
// Defaults to ../stdlib relative to the cwd, matching scripts/extract/index.ts.
// Run from a clean stdlib checkout (`git status` empty) for reproducible
// numbers — a dirty tree with in-progress/uncommitted package additions will
// change totals (see docs/research/dependency-rule.md for what we saw).

import fs from 'node:fs';
import path from 'node:path';
import {
  findPackageDirs,
  idFromDir,
  extractRequires,
  resolveSpec,
  readNativeDeps,
  listFilesRecursive,
} from '../../scripts/extract/scan';

const stdlibRoot = path.resolve(process.argv[2] ?? '../stdlib');
const root = path.join(stdlibRoot, 'lib', 'node_modules', '@stdlib');

if (!fs.existsSync(root)) {
  console.error(`No stdlib packages at ${root}. Pass a path to a stdlib checkout as an argument.`);
  process.exit(1);
}

function requiresIn(dir: string): string[] {
  const out = new Set<string>();
  for (const f of listFilesRecursive(dir, '.js')) {
    for (const r of extractRequires(fs.readFileSync(f, 'utf8'))) out.add(r);
  }
  return [...out];
}

type Kind = 'runtime' | 'dev' | 'native';

interface EdgeInfo {
  src: string;
  dst: string;
  kind: Kind;
  exact: boolean; // at least one spec resolved to dst without ancestor-walking
  specs: string[]; // raw specs (already stripped of the @stdlib/ prefix) that resolved to dst
}

const dirs = findPackageDirs(root);
const ids = new Set(dirs.map((d) => idFromDir(root, d)));
console.error(`packages: ${ids.size}`);

// Load each package's declared package.json dependencies (@stdlib/* keys only, prefix stripped).
const declared = new Map<string, { deps: Set<string>; devDeps: Set<string> }>();
let pkgJsonParseFailures = 0;
let totalDeclaredStdlibDeps = 0;
const packagesWithAnyDeclaredDeps: string[] = [];
for (const dir of dirs) {
  const id = idFromDir(root, dir);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pkgJson: any = {};
  try {
    pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    pkgJsonParseFailures++;
  }
  const stripStdlib = (obj: Record<string, unknown> | undefined): Set<string> => {
    const s = new Set<string>();
    for (const k of Object.keys(obj ?? {})) {
      if (k.startsWith('@stdlib/')) s.add(k.slice('@stdlib/'.length));
    }
    return s;
  };
  const deps = stripStdlib(pkgJson.dependencies);
  const devDeps = stripStdlib(pkgJson.devDependencies);
  if (deps.size > 0 || devDeps.size > 0) packagesWithAnyDeclaredDeps.push(id);
  totalDeclaredStdlibDeps += deps.size + devDeps.size;
  declared.set(id, { deps, devDeps });
}

console.error(`package.json parse failures: ${pkgJsonParseFailures}`);
console.error(`packages with ANY declared @stdlib/* dependency (dependencies or devDependencies): ${packagesWithAnyDeclaredDeps.length}`);
console.error(`total declared @stdlib/* dependency entries across whole checkout: ${totalDeclaredStdlibDeps}`);
if (packagesWithAnyDeclaredDeps.length > 0) {
  console.error(`sample: ${packagesWithAnyDeclaredDeps.slice(0, 10).join(', ')}`);
}

// External-dependency theory check: does any package.json's "dependencies"/"devDependencies"
// contain a non-@stdlib key? (REQUIRE_RE can never turn one into an edge, by construction —
// this only characterizes what real dependency declarations, if any existed, would look like.)
let externalDeclaredDeps = 0;
for (const dir of dirs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pkgJson: any = {};
  try {
    pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  for (const k of Object.keys(pkgJson.dependencies ?? {})) if (!k.startsWith('@stdlib/')) externalDeclaredDeps++;
  for (const k of Object.keys(pkgJson.devDependencies ?? {})) if (!k.startsWith('@stdlib/')) externalDeclaredDeps++;
}
console.error(`external (non-@stdlib) declared dependency entries found: ${externalDeclaredDeps}`);

const allEdges: EdgeInfo[] = [];

function classify(id: string, specs: string[], kind: Kind, exactOnly: boolean): EdgeInfo[] {
  // Mirrors resolveAll/resolveExact + the Set-based dedup in scanPackage, but keeps
  // per-target provenance: which raw specs produced the edge, and whether any of them
  // was an exact id match (vs. only reached via resolveSpec's ancestor walk).
  const byTarget = new Map<string, { exact: boolean; specs: string[] }>();
  for (const s of specs) {
    let resolved: string | null;
    let exact: boolean;
    if (exactOnly) {
      resolved = ids.has(s) ? s : null;
      exact = true;
    } else {
      resolved = resolveSpec(s, ids);
      exact = resolved === s;
    }
    if (!resolved || resolved === id) continue;
    const cur = byTarget.get(resolved) ?? { exact: false, specs: [] };
    cur.exact = cur.exact || exact;
    cur.specs.push(s);
    byTarget.set(resolved, cur);
  }
  const out: EdgeInfo[] = [];
  for (const [dst, info] of byTarget) out.push({ src: id, dst, kind, exact: info.exact, specs: info.specs });
  return out;
}

for (const dir of dirs) {
  const id = idFromDir(root, dir);
  const runtimeSpecs = requiresIn(path.join(dir, 'lib'));
  const devSpecsRaw = [
    ...requiresIn(path.join(dir, 'test')),
    ...requiresIn(path.join(dir, 'benchmark')),
    ...requiresIn(path.join(dir, 'examples')),
  ];

  const runtimeEdges = classify(id, runtimeSpecs, 'runtime', false);
  let devEdges = classify(id, devSpecsRaw, 'dev', false);
  // scanPackage subtracts runtime targets from dev targets (dev.delete(r) for r in runtime).
  const runtimeTargets = new Set(runtimeEdges.map((e) => e.dst));
  devEdges = devEdges.filter((e) => !runtimeTargets.has(e.dst));

  const nativeSpecs = readNativeDeps(dir);
  const nativeEdges = classify(id, nativeSpecs, 'native', true);

  allEdges.push(...runtimeEdges, ...devEdges, ...nativeEdges);
}

function summarize(kind: Kind) {
  const edges = allEdges.filter((e) => e.kind === kind);
  const total = edges.length;
  const ancestorOnly = edges.filter((e) => !e.exact).length;
  let removed = 0;
  let removedExact = 0;
  const removedExactSamples: EdgeInfo[] = [];
  const removedAncestorSamples: EdgeInfo[] = [];
  for (const e of edges) {
    const decl = declared.get(e.src);
    const inDeps = decl ? decl.deps.has(e.dst) || decl.devDeps.has(e.dst) : false;
    if (!inDeps) {
      removed++;
      if (e.exact) {
        removedExact++;
        if (removedExactSamples.length < 20) removedExactSamples.push(e);
      } else if (removedAncestorSamples.length < 20) {
        removedAncestorSamples.push(e);
      }
    }
  }
  console.log(`\n=== ${kind} ===`);
  console.log(`total edges: ${total}`);
  console.log(`ancestor-walk-only edges: ${ancestorOnly} (${((ancestorOnly / total) * 100).toFixed(2)}%)`);
  console.log(`removed by declared-deps rule: ${removed} (${((removed / total) * 100).toFixed(2)}%)`);
  console.log(
    `  of which EXACT matches removed (dangerous): ${removedExact} ` +
      `(${((removedExact / total) * 100).toFixed(2)}% of all ${kind} edges, ` +
      `${total - ancestorOnly > 0 ? ((removedExact / (total - ancestorOnly)) * 100).toFixed(2) : '0'}% of exact edges)`,
  );
  return { kind, total, ancestorOnly, removed, removedExact, removedExactSamples, removedAncestorSamples };
}

const results = (['runtime', 'dev', 'native'] as const).map((k) => summarize(k));

// Verify no edge source/target falls outside the stdlib id set (refutes the external-dep theory).
let outsideIds = 0;
for (const e of allEdges) {
  if (!ids.has(e.dst) || !ids.has(e.src)) outsideIds++;
}
console.log(`\nEdges pointing outside the stdlib id set: ${outsideIds} (expect 0)`);

// Dump every ancestor-walk-only edge (population is small enough to review exhaustively)
// plus samples of exact-match removals, for manual spot-checking.
const outDir = path.resolve('docs/research');
fs.writeFileSync(
  path.join(outDir, 'measure-dependency-rule.results.json'),
  JSON.stringify(
    {
      totalPackages: ids.size,
      packagesWithAnyDeclaredDeps: packagesWithAnyDeclaredDeps.length,
      totalDeclaredStdlibDeps,
      externalDeclaredDeps,
      results,
      allAncestorWalkOnlyEdges: allEdges.filter((e) => !e.exact),
    },
    null,
    2,
  ),
);
console.error(`\nwrote ${path.join(outDir, 'measure-dependency-rule.results.json')}`);
