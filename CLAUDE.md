# CLAUDE.md

Agent-facing guide to `graphify-stdlibjs`, a Vite + React + TypeScript SPA
(~3,800 LOC) that renders the stdlib-js monorepo as an interactive graph.
For vocabulary (package, namespace, variant, family, edge kinds, tags), see
`CONTEXT.md` — read that first if any of those words show up in a task.

## What this project is

An unofficial, third-party viewer for `stdlib-js/stdlib`. It is not
affiliated with, endorsed by, or sponsored by the stdlib project. Never edit
copy, branding, or metadata in a way that would make the project read as an
official stdlib product — keep the `graphify · stdlib` wordmark
(`src/app/TopBar.tsx`) intact.

The unofficial/not-affiliated disclaimer currently lives **only** in
`NOTICE`. The app's own footer (`src/home/Home.tsx`) has no such wording
today — it shows package stats and a "Made by" credit, nothing more. Adding
disclaimer copy to the UI is tracked separately ([#9](https://github.com/0PrashantYadav0/graphify-stdlibjs/issues/9));
don't assume it already exists there.

Licensed Apache-2.0, matching stdlib. `NOTICE` records how `public/data/graph.json`
is derived from a stdlib checkout and disclaims affiliation.

## Commands

Verify each of these still holds before relying on it; don't take this list
on faith if the repo has moved on.

```
npm install
npm run dev                              # Vite dev server, http://localhost:5173
npm test                                 # Vitest — 21 files, 102 tests, must stay green
npm run build                            # tsc --noEmit && vite build
npm run preview                          # serve the dist/ build
npm run extract -- --stdlib ../stdlib    # rebuild public/data/graph.json from a stdlib checkout
node e2e/smoke.mjs                       # optional local Playwright smoke run against `npm run preview`
```

`npx tsc --noEmit` is the standalone typecheck; `npm run build` already runs
it. CI (`.github/workflows/`) runs test, typecheck, and build on a Node
22.x/24.x matrix for every PR and push to `main`; it does not run
`e2e/smoke.mjs`, which needs a Playwright browser download and is a local-only
tool.

## The four surfaces

- **home** (`#/`) — landing page.
- **explorer** (`#/explore` and `#/explore/<path>`) — the full package tree,
  expandable to a given path. Namespaces expand into families and variant
  buckets (see `CONTEXT.md`) before falling through to individual packages.
- **focus** (`#/module/<id>`, optional `?edges=runtime,dev,native`) — one
  package's neighbourhood: what it requires (left) and what requires it
  (right), split by edge kind.
- **search palette** (⌘K / Ctrl+K) — a scored scan over package ids and
  descriptions, opened from anywhere.

`src/app/router.ts` parses/formats the hash-based routes above; that file is
the source of truth if this list and the code ever disagree.

## Where the data comes from

`scripts/extract/` walks a stdlib checkout (`--stdlib <path>`, default
`../stdlib`) rooted at `lib/node_modules/@stdlib`, and for every package
directory:

- reads `require('@stdlib/…')` calls under `lib/` as **runtime** edges,
- reads the same under `test/`, `benchmark/`, `examples/` as **dev** edges
  (with any that duplicate a runtime edge to the same target removed),
- reads `manifest.json` build dependencies as **native** edges,
- detects tags (`js`, `c`, `f`, `wasm`, `native`, `cli`) from what's actually
  present in the package's own files.

The result is written as one JSON file: sorted package ids, a description and
a tag bitmask per id, and three CSR (compressed sparse row) adjacency lists,
one per edge kind. The app fetches that single file and answers everything
from it client-side: hierarchy by binary search over the sorted ids (`Graph`
in `src/graph/Graph.ts`), dependents by a reverse CSR built once at load,
search by a scored scan over the ~6k ids (`src/graph/search.ts`).

`public/data/graph.json` (about 1.2 MB uncompressed) is **committed**, so
`npm run dev` and `npm test` work without a stdlib checkout present. Only
regenerate it deliberately — running `npm run extract` will silently produce
a diff against whatever stdlib checkout happens to be at `../stdlib`, which
may not match the committed `source` field (the stdlib commit SHA the current
file was built from).

## Known gotchas

- **The extractor is comment-blind (tracked in [#12](https://github.com/0PrashantYadav0/graphify-stdlibjs/issues/12)).**
  `extractRequires` (`scripts/extract/scan.ts`) regexes whole file text for
  `require('@stdlib/…')` and does not know about comments or string
  literals. It currently counts `require()` calls that appear inside JSDoc
  `@example` blocks, block comments, and commented-out code as real runtime
  dependencies — measured at 35.3% of all `require()` occurrences under
  `lib/` across the stdlib monorepo. Do not "fix" the graph's edge counts by
  adding a naive comment-stripping regex; a regex will mis-handle string and
  regex literals. If you touch this, treat #12 as the design discussion, not
  a green light to redo it inline.
- **The ancestor-walk fallback in `resolveSpec` is not a bug worth chasing.**
  It's measured at under 0.1% of edges, most of which are not errors. Don't
  spend time "fixing" it without new evidence it's wrong.
- **`package.json` `dependencies` fields are not used for anything.** They
  were considered as a cross-check and refuted ([#11](https://github.com/0PrashantYadav0/graphify-stdlibjs/issues/11)):
  essentially no package in the stdlib monorepo declares a `@stdlib/…`
  dependency there, so the field carries no signal for this graph.
- **The variant/family folding in `src/graph/variants.ts` and
  `src/graph/clusterSiblings.ts` is settled, not a starting point.** Read
  `CONTEXT.md`'s "sibling-aware parse" entry before touching either file —
  the logic looks like it could be simplified to greedy longest-prefix
  matching and is not; that would silently break names like `dsumors`.
- **The extractor and its naming conventions are stdlib-specific by
  design**, not a generalized "graph any monorepo" tool. The `@stdlib` scope
  and stdlib's directory layout (`lib/`, `test/`, `benchmark/`, `examples/`,
  `manifest.json`) are hardcoded intentionally.

## Conventions

- Branch per ticket/issue; one PR per ticket; PR body closes the issue it
  addresses. No direct commits to `main`.
- Every commit carries a `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  trailer.
- Decisions with real trade-offs, especially ones that are hard to reverse
  once made (e.g. anything that reshapes `public/data/graph.json`), get
  recorded as an ADR under `docs/adr/` — see that directory's `README.md` for
  when one is warranted.
- Keep polish and structure separate: the design token system
  (`src/styles/tokens.css`) is settled; prefer composition, spacing, and
  state fixes over introducing a new visual direction.
