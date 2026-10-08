# graphify-stdlibjs

> An unofficial, third-party project. Not affiliated with, endorsed by, or sponsored by the [stdlib](https://stdlib.io) project. It reads a stdlib checkout; it is not part of stdlib. "stdlib" is used here only to name the library this tool reads.

**Live:** <https://0prashantyadav0.github.io/graphify-stdlibjs/>

Browse the stdlib-js monorepo as a graph: start at `stdlib`, expand namespaces into their packages, and see naming families like `sum` folded into variants (`float64 (d)`, `float32 (s)`, `float64 with NaN (dnan)`, …) and their algorithms (`dsum`, `dsumkbn`, `dsumpw`). Press ⌘K / Ctrl+K to search for a package and see what it requires (left) and what requires it (right).

## Features

- **Browse the hierarchy.** Start at `stdlib` and expand namespaces down to single packages. Naming families fold into variants and algorithms, so a namespace with hundreds of packages reads as a few dozen rows.
- **See a package's direct dependencies.** `#/module/<id>` shows what it requires on the left and what requires it on the right, grouped by folder, along with its description, tags, and links to GitHub and the explorer.
- **Choose edge kinds.** Toggle `runtime` (`lib/`), `dev` (tests, benchmarks, examples) and `C` (native build dependencies). Your choice stays on as you hop from package to package.
- **Read tags at a glance.** `js`, `c`, `f`, `wasm`, `native`, `cli` show what a package actually ships.
- **Search.** ⌘K / Ctrl+K (or `/`) from anywhere: a ranked match on package ids, then descriptions, with what matched highlighted. A folder opens in the explorer, a package opens its own view.
- **Use the keyboard.** Each graph is an ARIA tree: Up/Down to move, Left/Right to collapse or expand, Home/End, Enter to open.
- **Share deep links.** Every view is a URL (`#/explore/math/base`, `#/module/ndarray/ctor?edges=runtime,native`), so you can paste one into an issue or a PR review.

## Routes

- `#/` — landing page
- `#/explore` and `#/explore/<path>` — the package graph, expanded to `<path>`
- `#/module/<id>` — one package's dependency graph (`?edges=runtime,dev,native` to include dev or native edges)

`public/data/graph.json` is regenerated from stdlib's `develop` branch every Monday by `.github/workflows/refresh-data.yml`, which opens a PR when the data changed.

## Run

    npm install
    npm run extract -- --stdlib ../stdlib   # regenerate public/data/graph.json from a stdlib checkout
                                             # (add --allow-dirty to proceed despite uncommitted changes)
    npm run dev                              # http://localhost:5173

`public/data/graph.json` is committed, so `npm run dev` works without a stdlib checkout.

`public/data/graph.json` is 1.2 MB uncompressed (≈190 KB gzipped) — make sure your static host serves it compressed.

The build uses relative asset URLs (`base: './'`), so `dist/` works at any sub-path. Every push to `main` deploys it to GitHub Pages (`.github/workflows/pages.yml`).

## Scripts

- `npm test` — unit tests (Vitest)
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve `dist/`
- `npm run check:data` — validate `public/data/graph.json` the way the app loads it (CI runs this)
- `npm run extract` — rebuild the graph file (`--stdlib <path>`, `--out <file>`,
  `--allow-dirty` to proceed when the stdlib checkout has uncommitted changes)
- `npm run lint` — ESLint (typescript-eslint, react-hooks, jsx-a11y)
- `npm run check:size` — size budgets for the built JS and `graph.json`
- `npm run e2e` — Playwright specs against a production build (run `npx playwright install chromium` once)

## How it works

The extractor scans every `package.json` under `lib/node_modules/@stdlib`, reads `require('@stdlib/…')` calls in `lib/` (runtime edges) and in `test/`, `benchmark/`, `examples/` (dev edges), and `manifest.json` build dependencies (native edges). It writes one JSON file with sorted package ids, a tag bitmask per package, and three CSR adjacency lists. The app loads that file once; hierarchy is answered by binary search over the sorted ids, dependents by a reverse CSR built at load, and search by a scored scan over ~6k ids.

The explorer folds sibling names using stdlib's naming convention: a dtype prefix (`d`, `s`, `dnan`, `snan`, `z`, `c`, `g`, …), an operation stem (`sum`, `variance`, …) and an algorithm suffix (`kbn`, `pw`, `ors`, …). The parse is sibling-aware — each name takes the stem shared by the most siblings — so `dsumors` is read as `d + sum + ors`, not `ds + um + ors`. Layout is a d3 tidy tree; everything else is plain SVG.

Tags: `js` JavaScript implementation · `c` C implementation · `f` Fortran · `wasm` WebAssembly build · `native` JS bridge to the native add-on · `cli` command-line interface.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). See [`NOTICE`](NOTICE) for the
disclaimer of stdlib affiliation and how `public/data/graph.json` is
derived from a stdlib checkout.
