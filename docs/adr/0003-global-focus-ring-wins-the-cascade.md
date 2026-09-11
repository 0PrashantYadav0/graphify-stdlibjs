# 3. The global focus ring wins the cascade

Status: accepted

## Context

`src/main.tsx` imports `App` before `./styles/base.css`. Every component
stylesheet is imported from its own component, so all of them enter the
document ahead of `base.css` and, at equal specificity, `base.css` has the
last word. Its

```css
:focus-visible { outline: 2px solid var(--trace); outline-offset: 2px }
```

is specificity (0,1,0), so it beats a component's `.gnode { outline: none }`
at the same (0,1,0) on order alone. That looked like an accident worth
correcting ([#25](https://github.com/0PrashantYadav0/graphify-stdlibjs/issues/25)),
and the obvious correction was to import `base.css` first so component styles
win, as they conventionally do.

Both orders were driven with the keyboard in Chromium at 1280×800, in light
and dark, across all four surfaces, reading the computed style of the focused
element at each stop.

**What the current order does.** A focused `treeitem` paints two rings: the
3px `--trace` stroke from `.gnode:focus-visible .gnode-box`, and the 2px
`--trace` outline at 2px offset from `base.css`. The palette input paints
neither — its computed `outline-style` is already `none`, because
`.palette-input:focus-visible` is (0,2,0) and out-specifies the global rule;
it marks focus with a `--trace` bottom edge instead. Home's controls take the
global ring alone. So across the whole app the cascade order decides exactly
one thing: whether graph treeitems get the outer ring.

**What reordering does.** With `base.css` imported first, the focused
treeitem's computed `outline-style` becomes `none` and the double ring
collapses to the 3px stroke. On an ordinary node that reads well — one clear
ring, arguably better than two. On a **selected** node it is a regression that
removes the indicator entirely: `.gnode.is-selected .gnode-box` fills with
`--trace` and strokes with `--trace`, so a 3px `--trace` stroke is invisible
against its own fill. Screenshots of the selected node focused and blurred
were identical in both colour schemes.

That case is not a corner. The roving tabindex puts a selected node first on
both graph surfaces — the explorer opens with `.gnode.is-selected.on-path` as
its single tab stop, and the focus view's *required by* tree starts at the
selected `.gnode-centre`. Reordering would therefore delete the focus ring
from the first node a keyboard user reaches on each of the two surfaces that
ADR 0001 built the tree semantics for.

## Decision

Keep the import order. `base.css` loads last on purpose, so the global
`:focus-visible` ring cannot be suppressed by accident — a component that
writes `outline: none` at plain-class specificity gets no effect rather than
an invisible focus state.

Two things follow, and both are now in the code:

**1. Components add to the global ring; they do not replace it.** The dead
`.gnode { outline: none }` is deleted rather than kept with a comment, and
`graphview.css` says why the outer ring has to stay. The double ring is a
decision, not an accident: it is what keeps focus visible on nodes whose fill
already is `--trace`.

**2. A component that genuinely must replace the ring has to out-specify it.**
`:focus-visible` is (0,1,0), so the suppressing rule needs at least a class
*and* the pseudo-class — `.palette-input:focus-visible` (0,2,0) — and it has
to supply its own indicator. `src/styles/cascade.test.ts` pins both halves:
the import order in `main.tsx`, and the rule that no stylesheet may write
`outline: none` at a specificity that cannot beat `:focus-visible`.

`!important` is not an acceptable route to this; the specificity is.

## Consequences

Easier: focus is never silently lost. A component stylesheet cannot delete
the ring by writing the one-line rule everyone reaches for first, and the
failure mode of getting the specificity wrong is a visible extra ring rather
than an invisible focus state. The two graph surfaces keep a focus indicator
that survives every combination of `is-selected`, `on-path` and hover.

Harder: the cascade here is the opposite of the conventional expectation, so
it has to be written down — which is what this record is for. Anyone styling
focus has to know that replacing the ring costs a specificity bump, and the
test will fail rather than the page looking wrong.

Given up: the conventional order, and the single clean ring on ordinary graph
nodes. Making the double ring unnecessary is possible, but it means giving
`.gnode.is-selected:focus-visible` a focus treatment that reads against a
`--trace` fill — a visual change to the selected state, which is out of scope
for a cascade-order fix and would need its own decision.
