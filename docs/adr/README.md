# Architecture Decision Records

This directory records decisions about this project that are worth writing
down once and referring back to, rather than re-deriving from scratch each
time they resurface.

## When an ADR is warranted

Write one when a decision is, ideally, all three of:

- **Hard to reverse.** Undoing it costs real work — e.g. it reshapes
  `public/data/graph.json`, or it commits to a data or naming rule other
  code will come to depend on.
- **Surprising without the context.** A future reader (human or agent)
  looking at the result would reasonably ask "why not the obvious
  alternative?" — and the answer isn't in the code.
- **The outcome of a real trade-off.** Something was actually given up to
  get here; there was a genuine competing option, not just one obvious way
  to do it.

Do not write an ADR to narrate routine work, and do not write one to
document a decision that has not actually been settled yet — an ADR records
what was decided, not a live debate.

## Format

One Markdown file per decision, named `NNNN-short-title.md` with a
zero-padded sequence number (`0001-`, `0002-`, …) so ordering is visible in a
directory listing. Each ADR should cover, at minimum:

- **Context** — what prompted the decision, and what was actually measured
  or tried, if anything.
- **Decision** — what was decided.
- **Consequences** — what this makes easier, what it makes harder, and what
  alternative was given up.

Status (proposed / accepted / superseded) is worth a line if it ever
changes; most ADRs here will simply be accepted on arrival, since they
record decisions already made rather than proposals under review. A
superseding ADR should link back to the one it replaces rather than editing
it in place — the record of what was once decided, and why, is part of the
value.

No ADRs exist yet. This directory is scaffolding for the first ones.
