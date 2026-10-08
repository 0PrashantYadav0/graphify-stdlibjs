# 0004: Webbed shows depth columns, one listbox per column

Status: accepted (2026-10-08, #32)

## Context

Webbed answers "what does this package pull in, all the way down?" and, in
the other direction, "what pulls it in?". The **web** (`CONTEXT.md`) for a
package is often large, and its members overlap heavily. On the committed data
(`c36cc64`):

- `ndarray/ctor` requires 22 packages directly and 219 in its web, 9 steps
  deep. One direct dependency, `array/base/join`, reaches 153 of those 219 by
  itself, and `ndarray/base/ctor` reaches 191. An unfolded tree (each child
  repeated under every parent that requires it) would print the same packages
  dozens of times.
- `string/format` is required, directly or not, by 4,921 packages, 8 steps
  deep. Its three nearest columns hold 1,494, 1,423 and 1,496 packages.
- `Graph.web` costs 1.2 ms for that worst case, and the `+N` size of every one
  of its 4,921 rows costs 56 ms in total. Computing is cheap; what costs is the DOM.

The existing graph views are ARIA trees (ADR-0001). A web is not a tree: a
package can have many parents in the previous column. Forcing it into a
`tree` means either repeating nodes, which is the problem above, or
mis-stating the structure to assistive technology.

## Decision

**Layout: depth columns ("strata").** Column *d* lists every package whose
shortest chain from the focused package is *d* steps. Each package appears
exactly once, in its `Web.depth` column. Rows are in index order, which is id
order because ids are sorted, so namespaces cluster. Column 0 is the package
itself.

Selecting a row shows its links instead of drawing edges:

- what it pulls in from the next column (the **down** set) is tinted;
- what pulled it in from the previous column (the **up** set) gets a neutral
  marker;
- the rows on its shortest chain get a trace-coloured edge;
- everything else is dimmed by colour, not by opacity, so dimmed text keeps
  its contrast.

A "Why it's here" strip spells out the chain (`Web.chain`).

**Keyboard and semantics.**

- Each column is a `listbox` labelled with its count and distance ("48
  packages, 2 steps out"), and each row is an `option`. Across all columns
  there is **one** tab stop, a roving `tabindex` that sits on the selected row
  (the package itself before anything is selected). This is the same
  one-tab-stop rule as the trees in ADR-0001.
- Up/Down move within a column and Home/End jump to its ends. Left/Right move
  to the adjacent column. They land on the first linked row there (the up set
  going left, the down set going right) or, failing that, on the row at the
  same position, clamped.
- **Selection follows focus.**
- Enter re-centres the web on the row ("Show its web"). Shift+Enter opens
  the row's direct view ("Focus on X").
- The chain in the why-strip is an `aria-live="polite"` region.
- Scrolling is never animated, so there is nothing for reduced motion to
  turn off.

**Large webs.** Each column renders its first 200 rows, plus a "Show N more"
button. The rows that must be visible (the selected row and each column's
first linked row) always render, so neither the keyboard nor the
auto-scroll can reach a row that isn't in the DOM.

## Consequences

- Every package appears once, so the column counts add up to the web size.
  "219 packages in 9 columns" can be checked by eye.
- Edges are not drawn. A package's full set of parents is visible only for
  the selected row (its up set). That's the trade for not drawing a hairball
  of up to 40k lines.
- A second keyboard model now exists beside the tree's. The two share the
  roving tab stop and Up/Down/Home/End, but Left/Right mean "change column"
  here and "collapse/expand" in a tree.
- **Rejected:** an unfolded tree (repeats shared packages), a force-directed
  graph (unreadable past a few hundred nodes, and no keyboard model), and
  `aria-activedescendant` on one container (ADR-0001 already chose roving
  tabindex; one model is easier to keep right than two).
- Paging means a "find in page" search can miss rows that aren't rendered
  yet. The view's own Filter searches every row, which is why it exists.
