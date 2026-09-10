# 2. Comment-aware require extraction

Accepted.

## Context

The graph showed dependencies that packages do not actually have. The
complaint that started this was vague — "the graph shows things that are not
really required" — so both candidate causes were measured before anything was
changed.

**The rule that was refuted: cross-check against declared `dependencies`.**
The obvious fix is to keep only those `require('@stdlib/…')` calls that the
package also declares in its `package.json` `dependencies`. Measured across
the stdlib monorepo, that rule would have deleted **100% of runtime, dev and
native edges**: of 6,211 `package.json` files, exactly one declares a
`dependencies` field at all, and the package it names is external. Zero
declare an `@stdlib/` dependency. In this monorepo the field carries no
signal, so it cannot be used as a cross-check. It is recorded here because it
is the first idea a reader will have.

**The rule that was adopted: ignore requires that are not code.**
`extractRequires` applied a regex to raw file text. Across 22,223 `.js` files
under `lib/`, there are 73,871 `require('@stdlib/…')` occurrences and 26,046
of them — **35.3%** — sit inside JSDoc `@example` blocks, block comments, or
commented-out code. stdlib documents nearly every package with a runnable
`@example`, and those examples require whatever the example needs. The
extractor was rendering documentation as architecture.

`array/base/getter` is the clearest case: all 13 `@stdlib/` mentions under its
`lib/` are `@example` lines. It requires nothing at runtime, and the graph
showed it requiring 11 packages.

A third candidate, the ancestor walk in `resolveSpec`, was measured at under
0.1% of edges with most of those not being errors, and was left alone.

## Decision

`extractRequires` runs a **hand-written JavaScript tokeniser**
(`scripts/extract/lexer.ts`) and matches the token sequence
`require` `(` *string* `)`. A require written inside a comment, a string, a
template literal or a regular expression literal is not a dependency.

Two alternatives were rejected:

- **A comment-stripping regex.** It cannot work: `//` occurs inside string
  literals (URLs), `/*` occurs inside regular expression literals, and `/` is
  ambiguous between division and the start of a regex. Any of these
  mis-lexings silently swallows or invents real code.
- **A full parse (acorn or similar).** Correct, but it adds a dependency and,
  more importantly, it throws. The extractor reads 22k third-party files it
  does not control, and a parse error would silently drop a whole package's
  edges — a failure mode that looks exactly like the bug being fixed. The
  tokeniser degrades locally instead: it never throws, and each construct it
  cannot make sense of costs at most the tokens around it.

The tokeniser handles single and double quotes, escaped quotes, template
literals including `${}` substitutions (which return to code), regex literals
including character classes, and division-versus-regex disambiguation from the
preceding significant token. Where a regex literal would have to span a
newline, it is re-read as division — the safe direction, since guessing
"regex" wrongly swallows real code.

acorn was still used, once, as an oracle rather than a dependency: the
tokeniser was cross-checked against a real acorn parse over every file in the
corpus that mentions `@stdlib/` — **49,488 files, zero disagreements, zero
files acorn could not parse**. That validation is not committed; it is
reproducible by parsing each file and walking for `CallExpression` nodes whose
callee is `require`.

## Consequences

Measured over one pinned stdlib tree (`fd5bfb49`), old extractor versus new,
so the only variable is the extractor:

| edge kind | before | after  | delta          |
| --------- | ------ | ------ | -------------- |
| runtime   | 43,037 | 39,049 | −3,988 (−9.3%) |
| dev       | 45,930 | 49,010 | +3,080 (+6.7%) |
| native    | 9,861  | 9,861  | 0              |

Runtime edges fall by 9.3%, not by 35%, because `scanPackage` already dropped
self-references and a package's own `@example` usually requires itself.

**Dev edges rise**, which is not a mistake. Dev edges are the requires under
`test/`, `benchmark/` and `examples/` *minus* any that duplicate a runtime
edge. Removing phantom runtime edges leaves fewer to subtract, so real dev
dependencies that were being masked now appear. Native edges are read from
`manifest.json` and are untouched by definition.

2,598 packages have a different runtime set, and 142 lose every runtime edge —
correctly, as with `array/base/getter`. In the focus view this is visible:
`array/base/getter` goes from "Requires 11, Connected 40" to "Requires 0,
Connected 29", and its whole *requires* side disappears. The explorer is
unaffected, because it is driven by the id hierarchy rather than by edges;
variant and family folding in `src/graph/variants.ts` and
`src/graph/clusterSiblings.ts` also key off ids, so what they fold does not
change.

Easier: the graph now means what it says, and a package with no runtime
dependencies looks like one.

Harder: the extractor now owns a lexer. It is about 200 lines and is covered
by unit tests for each tricky construct, but it is more code than a regex and
a future change to it can silently alter every edge in the graph. Regenerating
`public/data/graph.json` is the only way to see the effect.

Given up: matching requires without understanding JavaScript. Also given up,
deliberately, is the guarantee that the extractor and a real JS engine agree in
every case — the tokeniser is validated against the corpus that exists, not
proven correct for all input.
