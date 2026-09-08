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
