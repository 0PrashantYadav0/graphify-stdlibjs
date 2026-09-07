# graphify-stdlibjs — Design Spec

A browsable dependency map of the stdlib-js monorepo. Two jobs:

1. **Explore** the package hierarchy from the root down to any leaf package (`stdlib → stats → base → ndarray → svariance* → svariancepn`), one click per level.
2. **Focus** on one package (reached via a keyboard-shortcut search) and see only its neighbourhood: what it requires, what requires it, how many packages are connected — each side drawn as a compressed path tree, not a flat list.

## Facts about the source (measured on the local checkout, 2026-09-07)

| Fact | Value | Consequence |
|---|---|---|
| Packages (dirs with `package.json` under `lib/node_modules/@stdlib`) | 6,203 | Whole graph fits in browser memory; no server needed. |
| Top-level namespaces | 47 (`math` 699, `stats` 1,388, `blas` 892, `ndarray` 456, …) | Root screen shows 47 boxes. |
| Max depth | 6 segments | Explorer needs up to 7 columns. |
| `package.json` `dependencies` populated | 1 of 6,203 | Edges must be extracted from `require('@stdlib/…')` calls. |
| Runtime edges (`lib/**/*.js`) | ~43,000 | CSR arrays, ~170 KB each direction. |
| Dev-only edges (`test/`, `benchmark/`, `examples/`) | ~46,000 | Kept separate; off by default. |
| C edges (`manifest.json` → `confs[task=build].dependencies`) | ~9,100 | Third edge kind, shown as "C" toggle. |
| Packages with `src/*.c` | 1,800 | `c` tag. |
| Packages with `src/*.f` | 40 | `f` tag. |
| Packages with `lib/native.js` | 1,710 | `native` tag (JS→C bridge). |
| Packages with `__stdlib__.wasm` in package.json | 252 | `wasm` tag. |
| Packages with `bin/cli` | 432 | `cli` tag. |
| Packages with `docs/types/index.d.ts` | 5,825 | Not a tag (nearly universal → noise). |
| Max in-degree | 2,029 (`utils/define-nonenumerable-read-only-property`) | Dependents list must be a compressed tree. |
| Intermediate directories without `package.json` | Possible | Extractor synthesises `folder` nodes so the hierarchy is a proper tree. |

## Architecture

```
stdlib checkout ──► scripts/extract (Node, TS) ──► public/data/graph.json ──► Vite SPA (React + TS)
                    scans package.json, lib/, src/,           CSR graph, tag bitmask         in-memory Graph class,
                    manifest.json; resolves requires          ~1.1 MB raw / ~250 KB gz       search index, path trees
```

No database. Rationale: 6k nodes / 100k edges is a few hundred KB compressed; loading it once and answering every query in memory (O(1) neighbour lookup, sub-millisecond search) beats any round-trip to SQLite or a server, works offline, and deploys as static files. The extractor is rerunnable so the data can be refreshed against any stdlib commit.

### Data structures

**On disk — `graph.json`**

```ts
interface GraphFile {
  version: 1;
  generatedAt: string;      // ISO timestamp
  source: string;           // stdlib git commit hash
  ids: string[];            // package ids without "@stdlib/", sorted lexicographically; array index = node index
  desc: string[];           // parallel to ids; "" for synthesised folder nodes
  tags: number[];           // parallel to ids; bitmask of Tag
  runtime: Csr;             // i requires j in lib/**/*.js
  dev: Csr;                 // i requires j only in test|benchmark|examples (not already in runtime)
  native: Csr;              // i's C code depends on j (manifest.json build conf)
}
interface Csr { offsets: number[]; targets: number[]; } // offsets.length === ids.length + 1; targets sorted within each row
```

Tag bits: `JS=1, C=2, FORTRAN=4, NATIVE=8, WASM=16, CLI=32, NAMESPACE=64, FOLDER=128`.

**In memory — `Graph` class**

- `ids` sorted ⇒ direct children of a node are found by binary search on the prefix `id + "/"` and filtering out ids with a further `/` — O(log n + k).
- `Map<string, number>` for id → index.
- Reverse CSR for each edge kind built once at load (one counting pass + one fill pass).
- `deps(i, kind)` and `dependents(i, kind)` return `Int32Array` slices — zero-copy.

**Derived structures (pure functions, unit-tested)**

- `clusterSiblings(names, {threshold: 24, minGroup: 3, minPrefix: 3})` — collapses a wide list of sibling names into prefix groups (`svariance…` ×7) using a character trie. Rule: walk trie branches; a branch with ≥ `minGroup` leaves becomes a group once its compressed prefix is ≥ `minPrefix` chars, otherwise recurse into it; branches with fewer leaves emit their leaves as singles. Lists at or below `threshold` are never clustered.
- `buildPathTree(ids)` — segment trie over package ids with single-child chains collapsed (`blas/base/ndarray` as one node), leaf count on every node, children sorted with folders before leaves.
- `search(query, limit)` — scored match over the 6k ids: exact last segment 100 · last-segment prefix 80 · any-segment prefix 60 · substring 40 · subsequence 20; ties broken by shorter id. Queries may contain `/`.

### Routes (hash router, no library)

- `#/` — explorer at root.
- `#/explore/<path>` — explorer with one column per prefix of `<path>`; optional `?g=<prefix>` opens a sibling group as a virtual column.
- `#/module/<id>` — focus view; optional `?edges=runtime|dev|native` (comma-separated, default `runtime`).

## Visual design

**Subject.** A wiring map for a numerical library used by contributors who read package ids all day. The look borrows from schematic drawings: flat boxes, one highlighted trace, ids set in monospace because they *are* code paths.

**Tokens**

| Token | Light | Dark |
|---|---|---|
| `--ground` | `#F3F5F7` | `#101820` |
| `--surface` | `#FFFFFF` | `#18232E` |
| `--ink` | `#172033` | `#E7ECF2` |
| `--ink-muted` | `#5B6472` | `#9AA5B4` |
| `--line` | `#D6DCE3` | `#2B3947` |
| `--trace` (the one accent: selected path + edges) | `#1F4BFF` | `#6B8CFF` |
| `--trace-ink` (text on trace) | `#FFFFFF` | `#0B1020` |

Tag colours (same in both themes, tuned for 1px-border pills with tinted fill): `js #C98A00`, `c #2F6FD6`, `f #9A3E8F`, `wasm #0E8C7A`, `native #5A6B7B`, `cli #2E8B57`, `ns` = outline only in `--ink-muted`.

**Type.** "Instrument Sans" (Google Fonts) for UI, "JetBrains Mono" for package ids and counts. Scale: 12 / 13 / 15 / 18 / 24 px, line-height 1.45; ids in mono at 13 px. No all-caps labels, no eyebrows.

**Layout — explorer (Miller columns)**

```
┌ graphify · stdlib ──────────────────────────── [ search  ⌘K ] ┐
│ stdlib › stats › base › ndarray › svariance*                   │
├──────────┬──────────┬──────────┬────────────┬─────────────────┤
│ stdlib   │ stats    │ base     │ ndarray    │ svariance* (7)  │
│ 47       │ 1,388    │ 1,201    │ 96         │                 │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌────────┐ │ ┌─────────────┐ │
│ │array │ │ │base ▌│━│▐dists │ │ │dmax    │ │ │svariance  js│ │
│ ├──────┤ │ ├──────┤ │ ├──────┤ │ ├────────┤ │ ├─────────────┤ │
│ │blas  │ │ │incr  │ │ │ndarr▌│━│▐svar…*  │━│▐svariancepn ▌│ │
│ ├──────┤ │ ├──────┤ │ ├──────┤ │ ├────────┤ │ ├─────────────┤ │
│ │math  │ │ │iter  │ │ │strid │ │ │dvar…*  │ │ │svariancetk  │ │
│ ▐stats▌│━│▐…      │ │ …      │ │ …        │ │ …             │ │
└──────────┴──────────┴──────────┴────────────┴─────────────────┘
```

Left-aligned throughout. Each column is a vertical list of flat boxes (1 px `--line` border, 4 px radius, `--surface` fill). The selected box in each column fills with `--trace`, and the column it opens gets a 2 px `--trace` underline beneath its header with the header title in `--trace` — the "wire" that shows which box led here. (A line drawn across the column gap would be clipped by the scrolling list, so the connection is carried by the next column's head instead.) Group boxes (`svar…*`) show a count badge and a stacked-edge treatment (a second 1 px border offset 2 px down-right) so they read as "several". The newest column scrolls into view on open. Below 720 px width, only the last column is shown, with the breadcrumb acting as back navigation.

**Layout — focus view**

```
┌ graphify · stdlib ──────────────────────────── [ search  ⌘K ] ┐
│ ‹ explore math/base/special                                     │
│                                                                 │
│  Requires 5           ┌─────────────────────────┐   Required by 1 │
│  ─────────            │ math/base/special/logf  │   ───────────   │
│  math/base            │ Compute the base b log…  │   math/base/    │
│  ├ assert/is-nanf  js │ [js] [c] [native]        │   special/      │
│  ├ special           │ 5 requires · 1 dependent │   └ log10f      │
│  │ ├ lnf     js c     │ open on GitHub           │                 │
│  │ └ ln      js c     └─────────────────────────┘                 │
│  └ napi/binary   c    edges: (runtime) ( dev ) ( C )               │
└─────────────────────────────────────────────────────────────────┘
```

Three columns on desktop (requires / module / required by), stacked on mobile (module, then requires, then required by). Trees expand/collapse; nodes deeper than two levels start collapsed when a side has > 40 leaves. Every leaf is a link to its own focus view; every folder node is a link to the explorer.

**Search palette.** Opened with `⌘K` / `Ctrl+K` or `/`; a centred sheet with the input on top and up to 12 results below, each showing the full id (mono, matched characters in `--trace`) and tag pills. `↑ ↓` to move, `Enter` opens focus, `Esc` closes.

**Motion.** One: the wire underline scales in from the left (120 ms) when a column opens. Column entrance is an instant layout change. `prefers-reduced-motion` disables the draw.

**Copy.** Sentence case. Column header shows count only ("1,388"). Empty search: "No package matches “xyz”." Focus counts: "Requires 5", "Required by 1", "Connected 6".

## Out of scope (v1)

- Force-directed graph rendering.
- Editing or annotating packages.
- Server, database, authentication.
- Showing edge kinds inside the explorer (edges live in the focus view only).
