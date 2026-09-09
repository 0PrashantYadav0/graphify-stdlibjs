# Measuring the declared-dependencies rule (issue #11)

## Recommendation

**Do not adopt the rule as stated.** Adopt a narrower fix instead: keep resolving
edges the way `scan.ts` does today (require-based, with `resolveSpec`'s ancestor
walk), and address the two real defects the walk actually has —
`REQUIRE_RE` matching inside comments/JSDoc examples and disabled code, and the
namespace-collapse case where a require targets a package that plainly does not
exist. Do not gate edges on `package.json`'s `dependencies` field.

**Why:** across the entire stdlib monorepo, only **1 of 6,203** `package.json`
files declares any dependency at all, and that one dependency is an external
package (`tape`), not a `@stdlib/...` one. Zero packages declare an internal
`@stdlib/...` dependency in `dependencies` or `devDependencies`. Applying the
rule literally removes **100% of runtime, dev, and native edges** — not because
those edges are wrong, but because stdlib's monorepo convention leaves every
package's `dependencies` field empty (`{}`) by design; internal linkage is
resolved by requiring `@stdlib/<path>` directly against a single shared
`node_modules/@stdlib` root, not through npm-style declared dependencies.
The manual spot-check (below) confirms the large majority of edges removed
are real, correct requires — the rule would be catastrophic for signal, not
just noisy.

## Setup

A full stdlib checkout was already present locally at `../stdlib` relative to
this repo (no clone needed). Its `HEAD` (`fd5bfb49cac0b48b994a163effb4c3a1cc14d81d`)
matches the `source` field recorded in the committed `public/data/graph.json`
exactly, so the same commit that produced the shipped graph was used here.

The checkout carries local, uncommitted, in-progress stdlib work (new native
implementations for several `stats/base/ndarray/*` packages, a
WIP `ndarray/tensor3d/` family, and a few edited files) — normal for someone's
personal working copy of a large monorepo, unrelated to this repository. All
numbers below are the "as found" run (dirty tree, `docs/research/measure-dependency-rule.results.json`,
6,203 packages). A second run against the exact clean commit (`git stash`,
measure, `git stash pop`) gave the same qualitative results with slightly
smaller totals (6,193 packages; runtime 43,037 / dev 45,930 / native 9,861
edges) — the ~1–2% difference is entirely attributable to the WIP packages,
and does not change any conclusion, since every declared-dependencies field
was empty in both trees. That also explains the small gap between this
script's package/edge counts here and `public/data/graph.json`'s (6,283 ids,
43,112/46,117/9,929 edges): the graph was evidently built while the checkout
already had some of that WIP content present.

Measurement script: `docs/research/measure-dependency-rule.ts`. It imports the
real helpers from `scripts/extract/scan.ts` (`findPackageDirs`, `idFromDir`,
`extractRequires`, `resolveSpec`, `readNativeDeps`) rather than
reimplementing them, so it measures exactly what the shipping extractor
produces — it does not change or fork extractor logic. Reproduce with:

```sh
npx tsx docs/research/measure-dependency-rule.ts ../stdlib
```

## Headline numbers

| | total edges | ancestor-walk-only | removed by rule | of which exact (dangerous) |
|---|---:|---:|---:|---:|
| runtime | 43,102 | 36 (0.08%) | 43,102 (100%) | 43,066 (99.92% of all runtime edges) |
| dev | 46,110 | 4 (0.01%) | 46,110 (100%) | 46,106 (99.99% of all dev edges) |
| native | 9,913 | 0 (0.00%) | 9,913 (100%) | 9,913 (100% of all native edges) |

Two things fall out of this table that reframe the original suspicion:

1. **The ancestor walk is not the problem it was thought to be.** It accounts
   for well under 0.1% of edges in every kind (native edges use exact
   matching already and produce none at all). The premise that
   `resolveSpec`'s upward walk was fabricating a large fraction of the graph's
   edges is not supported by the data — see the exhaustive review of all 40
   ancestor-walk edges below; most of them are not even real requires.
2. **The declared-dependencies rule is not a targeted fix for the ancestor
   walk. It is a blanket deletion.** Because no package declares internal
   dependencies, the rule removes every edge regardless of how it was
   resolved — 99.9%+ of what it deletes are edges that resolved via an exact,
   unambiguous package-id match. There is no scenario in this monorepo where
   the rule preserves a meaningful runtime/dev/native graph.

## External-dependency theory: refuted

Confirmed empirically, not just by reading the regex: 0 of 89,046 measured
edges (runtime+dev+native combined, minus the 9,913 native ones which are
inherently `@stdlib`-scoped via manifest.json) point at an id outside the
scanned stdlib package set. `REQUIRE_RE` only ever captures the string after
`require('@stdlib/`, so external packages (`tape`, etc.) can never become
graph edges — confirmed by the "external declared dependency entries found:
1" count above, which is `tape` sitting in one package's unused `dependencies`
field, never referenced by any `require()` call the extractor would follow.
The reported problem is not external-dependency pollution.

## Manual spot-check (10 edges)

The rule removes ~100k edges, so "the rule removes it" carries no
diagnostic value by itself; every sample below is one the rule removes. What
matters is whether removal is *correct* (the edge was already junk) or
*false* (a real dependency destroyed only because the requiring package's
`package.json` is empty, as essentially all of them are).

| # | kind | resolution | source → target | original spec | why removed | verdict |
|---|---|---|---|---|---|---|
| 1 | runtime | exact | `math/base/special/trunc10f` → `math/base/assert/is-nanf` | `require('@stdlib/math/base/assert/is-nanf')` in `lib/main.js` | target absent from (empty) `dependencies` | **false removal** — genuine runtime dependency, actually used in the function body |
| 2 | runtime | exact | `array/base/zeros` → `array/base/filled` | `require('@stdlib/array/base/filled')` in `lib/main.js` | target absent from (empty) `dependencies` | **false removal** — genuine runtime dependency |
| 3 | runtime | exact | `_tools/benchmarks/browser-build` → `assert/is-string` | `require('@stdlib/assert/is-string')` in `lib/main.js` and `lib/validate.js` | target absent from (empty) `dependencies` | **false removal** — genuine, used twice |
| 4 | native | exact | `blas/base/caxpy` → `blas/base/shared` | `manifest.json` `confs[].dependencies` (build task) | target absent from (empty) `dependencies` | **false removal** — genuine native build dependency |
| 5 | native | exact | `blas/base/caxpy` → `napi/argv-int64` | `manifest.json` `confs[].dependencies` (build task) | target absent from (empty) `dependencies` | **false removal** — genuine native build dependency |
| 6 | dev | exact | `math/base/special/trunc10f` (benchmark) → `random/array/uniform` | `require('@stdlib/random/array/uniform')` in `benchmark/benchmark.js` | target absent from (empty) `devDependencies` | **false removal** — genuine benchmark dependency |
| 7 | dev | exact | `_tools/benchmarks/browser-build` (examples fixture) → `math/base/special/exp` | `require('@stdlib/math/base/special/exp')` in `examples/fixtures/index.js`, real executable code | target absent from (empty) `devDependencies` | **false removal** — genuine dependency of the example fixture |
| 8 | runtime | ancestor-walk | `_tools/makie/plugins/makie-benchmark` → `_tools` | `@stdlib/_tools/makie` | not declared (trivially — all deps empty) | **correct removal, but for an unrelated reason** — the "require" is inside a `@example` JSDoc block (`* var makie = require('@stdlib/_tools/makie');`), never executed. The bug is `REQUIRE_RE` scraping comments, not the ancestor walk or the declared-deps rule. 22 more `_tools/makie/plugins/*` packages have the identical pattern. |
| 9 | dev | ancestor-walk | `_tools/browserify/file-list` → `math/base/special` | `math/base/special/exponential` | not declared | **correct removal, but for an unrelated reason** — the require lives in `test/fixtures/bad_path.js`, a fixture *deliberately* naming a non-existent package (`// non-existing package`) to test the tool's own bad-path handling. Two sibling packages (`_tools/benchmarks/bundle`, `_tools/tests/bundle`) have the same fixture pattern. |
| 10 | dev | ancestor-walk | `_tools/remark/plugins/remark-namespace-toc` → `math/base/special/fast` | `math/base/special/fast/atan` | not declared | **correct removal, but for an unrelated reason** — the require is inside a synthetic test fixture (`examples/fixtures/lib/index.js`) that mimics a real path but is not itself a real stdlib package. |

Score: **7 false removals, 3 "correct" removals** — and even the 3 "correct"
ones are only accidentally correct: the rule kills them because *every*
package's `dependencies` field is empty, not because it detected that the
specific specifier was a comment or a test fixture. A rule that deletes
everything cannot be credited with precision on the few cases where deleting
everything happens to match intent.

## Exhaustive review of the ancestor-walk population

Because the ancestor-walk-only population is tiny (40 edges total: 36
runtime + 4 dev + 0 native, or 30 + 4 on the clean-tree run), all of it was
reviewed by hand rather than sampled. Breakdown:

- **23 edges** (`_tools/makie/plugins/*` → `_tools`): comment-only. The only
  `require('@stdlib/_tools/makie')` in each of these packages is inside a
  `@example` JSDoc block, never executed.
- **3 edges** (`_tools/benchmarks/bundle`, `_tools/browserify/file-list`,
  `_tools/tests/bundle` → `math/base/special`, all from spec
  `math/base/special/exponential`): each lives in a `test/fixtures/bad*path*`
  file explicitly engineered to reference a non-existent package, to test
  that tool's error handling.
- **1 edge** (`_tools/remark/plugins/remark-namespace-toc` →
  `math/base/special/fast`): a synthetic test fixture package impersonating a
  real path.
- **1 edge** (`ndarray/to-fancy` → `ndarray`, from specs `ndarray/take` /
  `ndarray/mskfilter` / `ndarray/mskreject`): all three requires are
  **commented out** in `lib/get_elements.js` (`// var take = require(...)`) —
  dead code, not live requires.
- **2 edges** (`repl/server` → `repl/help`, `repl/server` →
  `repl/code-blocks`, from specs `repl/help/data/data.json` and
  `repl/code-blocks/data/data.json`): genuine, live, uncommented requires of
  a JSON data file that lives *inside* those packages. `resolveSpec`'s
  ancestor walk does exactly the right thing here — there is no
  `repl/help/data/data.json` package, so walking up to the real owning
  package `repl/help` is correct behaviour, not a namespace-collapse bug.
  (This case existed only in the dirty-tree run's 40; it also appears in the
  clean-commit run's 30, confirmed present in both.)
- **10 edges** (dirty-tree run only: `ndarray/tensor3d/{bool,complex128,
  complex64,int16,int32,int8,uint16,uint32,uint8,uint8c}` → `ndarray`, from
  spec `ndarray/tensor3d/ctor`): live, uncommented requires, but
  `ndarray/tensor3d/ctor` does not exist anywhere in the checkout (nor does
  `ndarray/tensor3d` itself have a `package.json`) — this whole family is
  local, uncommitted WIP stdlib work in this particular checkout. This is
  the one case in the entire sample that resembles the originally-feared
  failure mode (a real, active require walked up to a bare namespace) — but
  its root cause is a genuinely missing target package in an in-progress
  checkout, not a mismatch between a "real" package and a namespace that the
  extractor conflates.

So of the ancestor walk's entire (tiny) footprint: roughly **70% is comment or
dead-code noise from a text-based regex, not resolution error; ~5% is
correct/intentional (data-file requires); and at most ~25%, in a dirty tree,
reflects a genuinely missing target** — which is arguably a monorepo-state
problem, not an extractor bug. None of it is the "silently maps a deep valid
require to the wrong namespace" scenario as sharply as the ticket worried,
because so few requires actually reach that deep without either resolving
exactly or turning out to be non-executed text.

## What this means for #12

- The declared-dependencies rule as stated is not viable in this repo: it
  deletes the entire dependency graph. It should not be implemented as
  written.
- The ancestor walk is a minor contributor to graph noise (well under 0.1% of
  edges) and, on inspection, mostly isn't even the walk's fault — it's
  `REQUIRE_RE` matching text inside comments and disabled code. A more
  effective, much smaller fix would teach the extractor to skip requires
  inside comment blocks (and ideally disabled/commented-out code lines),
  which would remove essentially all of the spurious edges found here
  without touching a single genuine dependency.
- If the map still wants some cross-check against "does this even make
  sense as a dependency," the closest thing stdlib actually declares per
  package is `manifest.json`'s build-task dependency list for native
  packages (already used, exactly, for native edges) — there is no
  equivalent source of truth for runtime/dev edges to cross-check against.
- An ADR is warranted here, per the ticket — but its conclusion should be
  "do not gate on `package.json` dependencies; this monorepo does not
  populate that field," with the evidence in this document, rather than a
  design for how to implement the gate.
