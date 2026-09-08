# graphify-stdlibjs

Browse the stdlib-js monorepo as a graph: start at `stdlib`, expand namespaces into their packages, and see naming families like `sum` folded into variants (`float64 (d)`, `float32 (s)`, `float64 with NaN (dnan)`, …) and their algorithms (`dsum`, `dsumkbn`, `dsumpw`). Press ⌘K / Ctrl+K to search for a package and see what it requires (left) and what requires it (right).

## Routes

- `#/` — landing page
- `#/explore` and `#/explore/<path>` — the package graph, expanded to `<path>`
- `#/module/<id>` — one package's dependency graph (`?edges=runtime,dev,native` to include dev or C edges)

## Run

    npm install
    npm run extract -- --stdlib ../stdlib   # regenerate public/data/graph.json from a stdlib checkout
    npm run dev                              # http://localhost:5173

`public/data/graph.json` is committed, so `npm run dev` works without a stdlib checkout.

`public/data/graph.json` is 1.2 MB uncompressed (≈190 KB gzipped) — make sure your static host serves it compressed.

## Scripts

- `npm test` — unit tests (Vitest)
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve `dist/`
- `npm run extract` — rebuild the graph file (`--stdlib <path>`, `--out <file>`)
- `node e2e/smoke.mjs` — optional Playwright smoke run against `npm run preview` (needs a globally installed playwright)

## How it works

The extractor scans every `package.json` under `lib/node_modules/@stdlib`, reads `require('@stdlib/…')` calls in `lib/` (runtime edges) and in `test/`, `benchmark/`, `examples/` (dev edges), and `manifest.json` build dependencies (C edges). It writes one JSON file with sorted package ids, a tag bitmask per package, and three CSR adjacency lists. The app loads that file once; hierarchy is answered by binary search over the sorted ids, dependents by a reverse CSR built at load, and search by a scored scan over ~6k ids.

The explorer folds sibling names using stdlib's naming convention: a dtype prefix (`d`, `s`, `dnan`, `snan`, `z`, `c`, `g`, …), an operation stem (`sum`, `variance`, …) and an algorithm suffix (`kbn`, `pw`, `ors`, …). The parse is sibling-aware — each name takes the stem shared by the most siblings — so `dsumors` is read as `d + sum + ors`, not `ds + um + ors`. Layout is a d3 tidy tree; everything else is plain SVG.

Tags: `js` JavaScript implementation · `c` C implementation · `f` Fortran · `wasm` WebAssembly build · `native` JS bridge to the native add-on · `cli` command-line interface.
