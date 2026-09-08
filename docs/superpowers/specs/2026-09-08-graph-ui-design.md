# graphify-stdlibjs v2 — Graph UI, variant groups, landing page

Supersedes the explorer and focus-view sections of `2026-09-07-graphify-stdlibjs-design.md`. Data pipeline, `Graph` class, search, routes for `module`, tags, tokens and type stay as specified there.

## What changes

1. **Explorer is a node-link graph.** Nodes are boxes joined by lines. `stdlib` sits at the left; clicking a node expands its children to the right, connected by curved links. Expanding again and again reaches leaf packages. Pan and zoom with the mouse/trackpad; the view auto-pans so a newly expanded node's children are visible.
2. **Semantic variant groups.** Wide namespaces that follow stdlib's `<dtype-prefix><operation><algorithm-suffix>` naming (e.g. `dsumkbn`) are folded into three levels: an *operation* node (`sum`), *variant* nodes under it (`base`, `float64 (d)`, `float32 (s)`, `float64 with NaN (dnan)`, `float32 with NaN (snan)`, …), and the package nodes under each variant (`dsum`, `dsumkbn`, `dsumkbn2`, `dsumors`, `dsumpw`). Names that don't fit a group fall back to the existing prefix clustering when the sibling list is still wider than 24 — except at the root, which always shows all 47 namespaces.
3. **Focus view is a graph too.** The searched module is the centre node; what it requires branches to the left as a path tree, what requires it branches to the right. Folder nodes collapse/expand; leaf nodes link to their own focus view.
4. **Landing page** at `#/` with a hero, a "Get started" button to `#/explore`, and a creator credit for `0PrashantYadav0`.

## Facts that drive the design (measured 2026-09-08)

| Namespace | Children | Notes |
|---|---|---|
| `blas/ext/base` | 410 | 45 names share stem `sum`; 19 `apxsum`; 6 `cusum`, `nsum`, `any` |
| `stats/strided` | 241 | 42 `mean`, 26 `variance`, 12 `stdev` |
| `stats/base/ndarray` | 193 | prefixes seen: `d`(34) `s`(46) `dnan`(21) `snan`(16) `ds`(6) `dcu`/`scu`(4 each) `sds`(2) `sdsnan`(1) `z`(2) `c`(3) none(54) |
| `math/base/special` | 374 | almost no dtype prefixes — falls back to prefix clusters |
| root | 47 | never clustered |

A naive "longest known prefix" parse splits `dsumors` as `ds + um + ors`. The parse must therefore be sibling-aware: choose, for each name, the decomposition whose stem is most frequent across all decompositions of all siblings.

## Variant grouping algorithm (`groupVariants`)

Inputs: sibling names (last path segments). Constants:

```
PREFIXES = ['sdsnan','dsnan','dnan','snan','sds','ds','d','s','z','c','g']   // longest first
SUFFIXES = ['kbn2','kbn','ors','pw','mtk','ch','tk','wd','yc','pn']         // longest first
MIN_STEM = 3      // stem must be at least this long
MIN_GROUP = 2     // a stem needs at least this many members
```

1. For every name, enumerate decompositions `(prefix, stem, suffix)` where `prefix ∈ PREFIXES ∪ {''}`, `suffix ∈ SUFFIXES ∪ {''}`, `name === prefix + stem + suffix`, `stem.length ≥ MIN_STEM`, and stem does not start or end with `-`.
2. Count how many *distinct names* produce each stem.
3. For each name pick the decomposition whose stem has the highest count; ties → longer stem, then shorter prefix.
4. A stem forms a group when ≥ `MIN_GROUP` names picked it **and** at least one of those names has a non-empty prefix or suffix (so `copy`, `copy2` stay singles but `sum`, `dsum` group).
5. Inside a group, members bucket by prefix in this order: `''` base, `d`, `s`, `dnan`, `snan`, `ds`, `sds`, `dsnan`, `sdsnan`, `z`, `c`, `g`. Within a bucket, sort by name.

Labels:

| prefix | variant label | | suffix | algorithm label |
|---|---|---|---|---|
| `''` | base | | `kbn` | Kahan–Babuška–Neumaier |
| `d` | float64 (d) | | `kbn2` | second-order KBN |
| `s` | float32 (s) | | `ors` | ordinary recursive |
| `dnan` | float64 with NaN (dnan) | | `pw` | pairwise |
| `snan` | float32 with NaN (snan) | | `pn` | two-pass |
| `ds` | float32 in, float64 accumulate (ds) | | `ch` | Chan |
| `sds` | float32 with float64 accumulate (sds) | | `tk` | textbook |
| `dsnan` | float32 in, float64 accumulate, NaN (dsnan) | | `wd` | Welford |
| `sdsnan` | float32, float64 accumulate, NaN (sdsnan) | | `yc` | Youngs–Cramer |
| `z` | complex128 (z) | | `mtk` | textbook, known mean |
| `c` | complex64 (c) | | | |
| `g` | generic (g) | | | |

## Explorer tree model (`treeModel`)

Every node in the explorer graph has a stable string key and a kind:

```ts
type NodeKind = 'root' | 'package' | 'operation' | 'variant' | 'cluster';
interface TreeNode {
  key: string;        // 'root' | 'p:<id>' | 'op:<parentId>:<stem>' | 'v:<parentId>:<stem>:<prefix>' | 'c:<parentId>:<prefix>'
  kind: NodeKind;
  label: string;      // name, stem, variant label, or '<prefix>…'
  sublabel?: string;  // algorithm label for packages inside a variant
  index: number;      // graph index for package nodes; -1 otherwise
  count: number;      // leaf packages reachable below (0 for a leaf package)
  hasChildren: boolean;
}
childrenOf(graph, node): TreeNode[]
```

`childrenOf` for a `root`/`package` node (a namespace): take `graph.children(index)`, run `groupVariants(names)` → operation nodes; the remaining singles run through `clusterSiblings` only when the parent is not the root **and** the singles count exceeds 24; order: operation nodes, then clusters, then packages, each alphabetical. Operation → variants → packages; cluster → packages.

`expandPathFor(graph, path)` returns the list of node keys that must be expanded so the package at `path` is visible, walking through operation/variant/cluster nodes as needed.

## Layout

`d3-hierarchy`'s tidy tree with `nodeSize([52, 320])`, horizontal (depth → x). Only expanded nodes contribute children. Links are `d3-shape` `linkHorizontal` curves. Boxes are 260 × 40 px (name in `--font-mono` 13 px; a package's algorithm label on a second 10 px line beneath it; pills right-aligned; a small count badge for expandable nodes). Labels truncate with an ellipsis only after the pills/count have been given their space. The selected/expanded path is drawn in `--trace` (node border and link stroke 2 px); other links are `--line` 1 px.

Focus view uses the same renderer twice from one centre node: `direction: 'right'` for required-by, `direction: 'left'` (x mirrored) for requires, each fed a `buildPathTree` result. Folders at depth ≥ 2 start collapsed when a side has > 40 leaves.

## Interaction

- Click a node with children → toggle expand; the view pans so the node sits at 1/3 from the left and its children are visible (240 ms ease, disabled under `prefers-reduced-motion`).
- Click a leaf package → `#/module/<id>`. A namespace package has a small "open" affordance on its node for the same.
- Keyboard: nodes are focusable in document order; `Enter`/`Space` toggles or opens; visible focus ring in `--trace`.
- Wheel/pinch zooms (0.4–2×), drag pans. A "Reset view" button returns to the initial transform.
- URL `#/explore/<path>` opens with that path expanded and the target node selected, and the view scaled (never below 0.4×) and panned so the whole path from `stdlib` to the target is on screen; `#/explore` opens with `stdlib` expanded to its 47 namespaces.

## Landing page (`#/`)

The hero **is** the graph: a live SVG constellation drawn from the real data — `stdlib` at the centre, the 47 namespaces on a ring, links from the centre, a second faint ring of the 12 biggest sub-namespaces. Links draw in once on load (the single orchestrated motion; skipped under reduced motion). The headline sits over it.

```
┌ graphify · stdlib ─────────────────────────── [ search ⌘K ] ┐
│                                                               │
│      ·  ·        Every stdlib package, wired.        ·   ·    │
│   ·      \       Walk the tree from stdlib down to any        │
│    ·  ────(stdlib)──── ·   of 6,283 packages, or search one   │
│   ·      /   |   \     and see what it needs and who needs it.│
│      ·  ·    ·    ·                                           │
│              [ Get started ]   Search  ⌘K                     │
│                                                               │
│  6,283 packages. 43,112 runtime links. Built from stdlib      │
│  commit fd5bfb4.                     Made by 0PrashantYadav0  │
└───────────────────────────────────────────────────────────────┘
```

Copy is sentence case; numbers come from the loaded graph, never hard-coded. The creator line links to `https://github.com/0PrashantYadav0`. Tokens, fonts and dark mode as in v1. No gradients, no numbered markers, no all-caps eyebrows.

## Routes

- `#/` — landing page.
- `#/explore` — graph at root; `#/explore/<path>` — graph with `<path>` expanded and selected.
- `#/module/<id>[?edges=…]` — focus graph.

## Carried-over rulings from plan 1

- The root column/level is never clustered.
- Page chrome must not rely on a fixed-height subtraction for the legend; the graph canvas flexes to fill the remaining viewport.
