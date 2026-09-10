# graphify-stdlibjs

`graphify-stdlibjs` is an unofficial viewer that renders the stdlib-js
monorepo (`stdlib-js/stdlib`) as a graph. Most of the vocabulary below names
things about *stdlib's own* package layout and naming convention, not this
app's architecture — get it wrong and the graph's grouping and folding look
arbitrary instead of principled.

This file is a glossary only. Build steps, commands, and file paths live in
`CLAUDE.md`.

## Language

**Package**:
One directory in stdlib carrying its own `package.json`, identified by its
path under the `@stdlib` scope with slashes kept as the separator — e.g.
`math/base/special/dsumors`. Every node in the graph is a package node.

**Namespace**:
A package that has other packages nested under it — an interior node in the
path hierarchy rather than a leaf. `math/base/special` is a namespace because
packages like `math/base/special/dsumors` sit below it. Namespace-ness is a
fact about whether anything nests underneath a package, not a separate kind
of node — a package can carry its own code and still be a namespace.
_Avoid_: folder, directory (some path segments hold namespaces together
without ever having been their own stdlib package; those are internal
bookkeeping, not vocabulary worth reasoning about).

**Variant**:
One of several packages that implement the same operation for different
numeric types, distinguished by a dtype prefix on the name: `d` (float64),
`s` (float32), `dnan`/`snan` (NaN-aware float64/float32), `ds`/`sds`/
`dsnan`/`sdsnan` (mixed float32-in/float64-accumulate forms), `z`
(complex128), `c` (complex64), `g` (generic). `dsum` and `ssum` are variants
of `sum`.

**Family**:
A set of sibling package names in the same namespace that share an
**operation stem** once their dtype prefix and algorithm suffix are peeled
off — e.g. every `sum` package, or every `variance` package. Within a
family, members are further bucketed by variant.
_Avoid_: cluster (the explorer also groups very large namespaces
alphabetically by shared spelling, e.g. `is-nan`/`is-nanf` under `is-`, purely
so the list stays navigable — that clustering is unrelated to operation
stems or dtypes and should not be confused with a family).

**Operation stem**:
The part of a package name identifying *what* it computes, once the dtype
prefix and algorithm suffix are removed — `sum` in `dsumors`, `variance` in
`variancewd`.

**Algorithm suffix**:
The part of a package name identifying *how* the operation is computed,
appended after the stem — e.g. `kbn` (Kahan–Babuška–Neumaier summation),
`kbn2` (second-order KBN), `ors` (ordinary recursive summation), `pw`
(pairwise summation), `wd` (Welford's algorithm), `yc` (Youngs–Cramer
algorithm), `ch` (Chan's algorithm), `tk`/`mtk` (textbook, the latter given a
known mean), `pn` (two-pass).

**Sibling-aware parse**:
How a package name is split into prefix / stem / suffix — not by matching
the longest possible prefix or suffix in isolation, but by whichever split
is shared by the most siblings in the same namespace. `dsumors` is why this
matters: read greedily, `ds` is itself a valid dtype prefix (float32 in,
float64 accumulate), so a naive longest-prefix match reads `dsumors` as
`ds + um + ors` — and there is no `um` operation. The correct read is
`d + sum + ors`, because far more siblings in that namespace share the stem
`sum` (`sum`, `dsum`, `ssum`, `dsumkbn`, `dsumpw`, …) than share any stem
consistent with `ds` as the prefix. The same substring can therefore be a
dtype prefix in one namespace and just part of the stem in another; only the
sibling counts within a given namespace disambiguate it.

**Edge kind**:
One of three distinct dependency relationships between packages, kept
separate rather than merged into one generic "depends on": **runtime** (`A`
calls `require('@stdlib/B')` under its own `lib/` — `A` cannot execute
without `B`), **dev** (the same call, but only under `test/`, `benchmark/`,
or `examples/` — `A` needs `B` to be tested or benchmarked, not to run), and
**native** (`A` names `B` as a build dependency in its `manifest.json`, the
C/Fortran add-on build description — a compile-time relationship, unrelated
to any `require()` call). A single pair of packages can be connected by more
than one edge kind at once.

**Tag**:
A per-package marker describing what a package physically contains or
provides: `js` (has a JavaScript implementation), `c` (has a C
implementation), `f` (has a Fortran implementation), `wasm` (has a
WebAssembly build), `native` (has a JS bridge to a native add-on), `cli`
(has a command-line interface). A package can carry any combination.
