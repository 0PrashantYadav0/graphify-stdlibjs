# 1. Tree-widget semantics for an SVG graph

Status: accepted

## Context

Both graph surfaces — the explorer (`#/explore/<path>`) and the focus view
(`#/module/<id>`) — render through `src/graphview/TreeLayer.tsx`, which draws
nodes as `<g>` elements positioned by absolute `transform` from a d3-hierarchy
tidy layout. Before this decision every node was `role="button"` with
`tabIndex={0}`, so a keyboard user tabbed through hundreds of nodes one at a
time, and `GraphCanvas` declared `role="application"` — which tells assistive
technology the app owns the arrow keys, while nothing in the code handled one.

Rebuilding this as the WAI-ARIA APG `tree` pattern raised four questions where
the obvious answer is not the one taken ([#13](https://github.com/0PrashantYadav0/graphify-stdlibjs/issues/13)).

## Decision

**1. Treeitems are flat siblings; there is no `role="group"`.**
The APG's nested markup (`treeitem` containing `group` containing more
`treeitem`s) would require nesting the `<g>` elements, and SVG transforms
compose — every node's `translate()` would have to become relative to its
parent's. Instead all rendered nodes stay siblings under one `role="tree"`,
and the structure is carried entirely by `aria-level`, `aria-posinset` and
`aria-setsize`, which the APG provides for exactly this case. `TreeLayer`
derives all three, plus the depth-first row order that Up/Down walks, from the
already-computed layout rather than re-walking the model, so the keyboard
order and the ARIA numbers cannot drift from what is painted.

**2. `GraphCanvas` is `role="group"`, not `role="application"`.**
The canvas is a labelled container that may hold more than one tree (the focus
view holds two: *requires* and *required by*). It is the trees that own the
arrow keys, and each carries its own roving tabindex — so the focus view is
deliberately two tab stops, not one.

**3. Left and Right are mirrored for a left-growing tree.**
The focus view's *requires* side is laid out right-to-left, its children to the
left of their parent. There, ArrowLeft expands and descends and ArrowRight
collapses and ascends. Binding Right to "expand" would have moved focus in the
opposite direction to the arrow the user pressed. This is the same flip the APG
itself specifies for right-to-left trees, applied to a mirrored layout.

**4. Focus is brought into view by panning the canvas, not `scrollIntoView`.**
Nothing scrolls: the graph moves under a d3-zoom transform inside a fixed-size
`<svg>`. The canvas therefore exposes `ensureVisible(point)` through a context
(`src/graphview/viewport.ts`); `TreeLayer` calls it whenever a node takes focus,
by arrow, Tab or click alike. It pans the smallest distance that puts the node
box inside a 24px margin and does nothing if the node is already visible, so a
walk within the visible area does not jitter the view. Those nudges deliberately
do **not** become the target "Reset view" returns to — that stays the last
deliberate fit or focus pan.

## Consequences

Easier: one tab stop per tree instead of hundreds; arrow keys that work; ARIA
that describes the real structure; and, because focus pans itself into view,
keyboard panning is not needed to reach anything (it stays out of scope).

Harder: the flat structure means the accessible tree is only as good as the
three ARIA numbers — anything that changes how rows are derived has to keep
them in step, which is why they are computed in one place (`toRows`). And a
screen reader user on the focus view meets two trees rather than one; the
shared centre node belongs to the *required by* tree, and the *requires* tree
hides it and starts at level 1.

Given up: strict conformance to the APG's nested-group markup, and its
unconditional left-to-right arrow bindings.
