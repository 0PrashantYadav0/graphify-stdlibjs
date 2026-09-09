# stdlib brand tokens and trademark terms

Research for #6 (part of the map in #1: visual kinship with stdlib, decision 10).
Goal: find stdlib's real palette, typography, and — most importantly — what a
third-party project is actually permitted to do with the stdlib name/mark.
Primary sources only: `stdlib-js/stdlib`, `stdlib.io`, and other repos under the
`stdlib-js` GitHub org. No blog posts, no colour-picker sites.

## Quick-reference table

| Token | Value | Source | Confidence |
|---|---|---|---|
| `--stdlib-orange` (dark theme) | `#f0ad3e` | `stdlib.io/css/docs/bundle.min.css`, `html[data-theme=dark]` rule | High — declared CSS custom property on the live docs site |
| `--stdlib-orange` (light theme) | `#e99f36` | same file, `html[data-theme=light]` rule | High |
| `--stdlib-blue` (dark theme) | `#00aeef` | same file, `html[data-theme=dark]` rule | High |
| `--stdlib-blue` (light theme) | `#009cd7` | same file, `html[data-theme=light]` rule | High |
| `--theme-background-color` (dark) | `#222426` | same file | High |
| `--theme-background-color` (light) | `#ffffff` | same file | High |
| `--theme-text-color` (dark) | `#f5f7f7` | same file | High |
| `--theme-text-color` (light) | `#000000` | same file | High |
| `--link-color` (dark) | `#00abe7` | same file | High |
| `--link-color` (light) | `#0000ff` | same file | High |
| Logo gradient, amber lobe | `#A4681D → #E18F2F → #F0AD3E` | inline SVG `<linearGradient>` in `stdlib.io` homepage HTML (`/`) | High — sampled directly from the served logo markup, not an image |
| Logo gradient, blue lobe | `#006991 → #008BBF → #00AEEF` | same inline SVG, second gradient | High |
| "stdlib orange" (editorial guide) | `#E99F37` on white / `#F0AD3E` on black | `stdlib-js/blog-drafts:docs/artwork/README.md` | Medium — internal art-direction draft, not a published policy, but it independently corroborates the CSS values above almost exactly |
| UI/heading typeface | Lato (self-hosted, `LatoLatinWebLight`, weight 400) | `stdlib.io/css/docs/bundle.min.css`, `@font-face` rules pulling from `/css/common/fonts/lato/latin/*.woff2`; also present in `stdlib-js/www:public/css/common/fonts/lato/` | High |
| Body/default typeface | System UI stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, ...` | `--default-font-family` in same CSS | High |
| Code typeface | System monospace stack: `Consolas, "Liberation Mono", Menlo, Courier, monospace` | `--code-font-family` in same CSS | High |
| Blog theme typeface (separate site) | Inter (self-hosted) | `stdlib-js/www-dev-blog-theme:theme/assets/fonts/inter/` | Medium — this is `blog.stdlib.io`'s theme, a different surface from the main docs/site |
| Logo trademark status | Not separately licensed; no logo-specific licence file found. Governed by the Apache-2.0 §6 carve-out (see below) plus a general Terms-of-Service anti-affiliation clause | `stdlib-js/stdlib:LICENSE` §6; `stdlib-js/stdlib:docs/policies/TERMS_OF_SERVICE.md` | High for what exists; the absence of anything more specific is itself the finding |
| Dedicated brand/trademark policy (`TRADEMARK.md`, `BRAND.md`, press kit) | **Not found anywhere in the org** | org-wide `gh search code` for `TRADEMARK`/`BRAND`, `gh repo list stdlib-js` | High confidence of absence (see caveats below) |

## 1. Palette

The most authoritative source is the live CSS actually served by `stdlib.io`,
fetched directly (`curl -sL https://stdlib.io/css/docs/bundle.min.css`). It
defines real CSS custom properties named `--stdlib-orange` and `--stdlib-blue`,
scoped per theme:

```css
html[data-theme=dark]{
  --theme-background-color:#222426;
  --theme-text-color:#f5f7f7;
  --stdlib-orange:#f0ad3e;
  --stdlib-blue:#00aeef;
  --link-color:#00abe7;
  ...
}
html[data-theme=light]{
  --theme-background-color:#ffffff;
  --theme-text-color:#000000;
  --stdlib-orange:#e99f36;
  --stdlib-blue:#009cd7;
  --link-color:#0000ff;
  ...
}
```

This is about as primary as it gets: it is the literal stylesheet stdlib.io
ships to browsers today (verified 2026-09-09).

**Important nuance: stdlib does not have a single accent colour, it has two,
named.** The logo itself (inline SVG served in the homepage HTML, not a raster
image someone had to sample) is two-tone — one lobe rendered with an amber/brass
gradient (`#A4681D → #E18F2F → #F0AD3E`), the other with a cyan-blue gradient
(`#006991 → #008BBF → #00AEEF`). The CSS variable names (`--stdlib-orange` /
`--stdlib-blue`) match this exactly. If forced to pick one as "the" brand
colour, the orange is the better candidate: it is the one independently
reiterated in the separate editorial-illustration guide (see below), it is used
for positive-feedback/hover icon states in the docs UI, and it reads as the
"foreground" lobe in the logo mark. But treating stdlib as strictly
mono-accent would be a simplification stdlib itself doesn't make.

A secondary, non-CSS source corroborates the orange: `stdlib-js/blog-drafts`
(a public repo of editorial drafts, not a customer-facing brand page) contains
`docs/artwork/README.md`, an internal "Editorial Art Direction" guide for blog
illustration. It states: "the stdlib orange (`#E99F37` on white background and
`#F0AD3E` on black background) should appear naturally within the scene." That
`#F0AD3E` is an exact match for the docs CSS's dark-theme `--stdlib-orange`,
and `#E99F37` is a one-digit rounding away from the light-theme `#e99f36`. Two
independent files converging on the same value is a good confidence signal,
even though the blog-drafts document itself is an internal creative-direction
draft, not a published brand spec — I'm flagging it as **medium** confidence
standalone, but it upgrades the CSS finding to **high** by corroboration.

I did not sample any colour from a rasterized image (PNG/JPG) anywhere in this
research — every hex value above came from either a served stylesheet or raw
SVG source markup, both text.

## 2. Typography

Also read directly from `stdlib.io`'s served CSS (`bundle.min.css` for both
the marketing homepage and `/docs/api/latest/`):

- **UI accent / nav / headings**: `LatoLatinWebLight`, a self-hosted, subset
  build of Lato at weight 400 ("Light"), loaded via `@font-face` from
  `/css/common/fonts/lato/latin/*.{woff2,woff,ttf,eot}`. This is **not**
  loaded from Google Fonts — stdlib bundles its own font files. The same font
  directory (with its Open Font License `README-WEB.txt`/`OFL.txt`) exists in
  the `stdlib-js/www` repo, confirming it's the source-of-truth site source,
  not a CDN artifact.
- **Body/default text**: no custom font at all — a plain system-UI stack
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif, ...`), assigned to `--default-font-family`.
- **Code**: also no custom font — a plain system monospace stack (`Consolas,
  "Liberation Mono", Menlo, Courier, monospace`), assigned to
  `--code-font-family`. stdlib.io does not use a distinctive code typeface
  (no JetBrains Mono, no Fira Code, nothing self-branded).
- `blog.stdlib.io` (a separate site/theme, `stdlib-js/www-dev-blog-theme`) uses
  self-hosted **Inter**, not Lato — this is a different surface with its own
  theme and shouldn't be conflated with the main docs/site typography above.

Net: stdlib's actual distinctive typographic choice is Lato Light for
UI chrome, layered over an otherwise plain system-font stack. It does not use
a distinctive monospace/code face.

## 3. Logo and trademark — what a third party may actually do

This was the important question and the answer is conservative:

- **The logo is not separately licensed, and no logo-specific licence text
  exists anywhere I could find.** The main repo (`stdlib-js/stdlib`) is
  Apache-2.0 licensed as a whole (confirmed via `gh repo view` `licenseInfo`
  and reading `LICENSE` directly), and I found no `NOTICE`-adjacent carve-out
  or separate `LICENSE-logo`/`LICENSE-assets` file excluding the mark from
  that grant — but there's also no explicit statement including it either.
- **The Apache-2.0 licence itself, in its standard boilerplate §6, already
  excludes trademarks from the software licence grant**, and this applies
  regardless of any stdlib-specific addendum:

  > 6. Trademarks. This License does not grant permission to use the trade
  > names, trademarks, service marks, or product names of the Licensor,
  > except as required for reasonable and customary use in describing the
  > origin of the Work and reproducing the content of the NOTICE file.

  In plain terms: Apache-2.0 covers the *code*; it does not license the
  *name or mark*. Whether the logo image file counts as "code" or "mark" is
  genuinely ambiguous here since stdlib hasn't clarified it — which is itself
  the finding.
- **`docs/policies/TERMS_OF_SERVICE.md`** (in `stdlib-js/stdlib`, effective
  2017-09-07) states services are "protected by applicable copyright and
  trademark law" and, under "Acceptable Use," that a user "will not falsely
  imply that you are affiliated with or endorsed by the Project." This is the
  closest thing stdlib has to third-party-usage guidance, and it's a general
  ToS clause, not a brand policy aimed at derivative tools.
- **`GOVERNANCE.md`** mentions Project trademarks once, in the context of
  Institutional Partners whose funding lapses: their future work "cannot use
  the Project trademarks in a way that suggests a formal relationship." This
  confirms stdlib treats "stdlib" as a trademark it controls, but again gives
  no third-party usage guidance beyond "don't imply a relationship that
  doesn't exist."
- **No `TRADEMARK.md`, `BRAND.md`, brand guidelines page, press kit, or
  logo-asset repo exists anywhere in the `stdlib-js` GitHub org.** I checked
  this three ways: `gh search repos --owner stdlib-js` for "brand" (no hits),
  `gh search code` across the org for `TRADEMARK` and `BRAND` in any file
  (the only hits were the Apache-2.0 boilerplate, the ToS/GOVERNANCE mentions
  above, third-party font OFL notices, and unrelated matches in a spam-corpus
  dataset repo), and a scan of `gh repo list stdlib-js` repo names/descriptions
  for anything brand/logo/media/asset-shaped (none). Caveat: `gh search code`
  only indexes the default branch of each repo and can lag newly pushed
  content, so this is high-confidence but not a formal legal guarantee that
  nothing exists.
- I did not find a stated policy on referencing the stdlib name in a
  third-party project's own name (e.g. "graphify · stdlib"). No permission,
  and no prohibition, is published.

**Bottom line: stdlib has never published third-party brand/trademark
guidance.** The only real signal is (a) the Apache-2.0 boilerplate trademark
carve-out and (b) a ToS clause against implying false affiliation. Everything
else is silence.

## 4. Other brand guidance found

- `stdlib-js/blog-drafts:docs/artwork/README.md` — an internal "Editorial Art
  Direction" guide, aimed at commissioning illustrations for stdlib's own blog.
  Not a public brand policy and not addressed to third parties, but it is
  useful *tone* context: stdlib self-describes as "foundational infrastructure"
  (explicitly not "an AI company," "a JavaScript framework," "a startup," "a
  dashboard product," or "a developer tool"), favours a restrained palette of
  charcoal/navy/slate/warm-neutral with the orange used only as a deliberate,
  sparing accent, and wants imagery that reads "80% professional, 20%
  playful." This is about illustration commissioning, not UI chrome or logo
  use, and should be weighted accordingly — it corroborates the orange hex
  value but says nothing about permission to use the mark.

## What could not be found (read this before acting on §1–2)

- **No trademark/brand-usage policy for third parties**, anywhere in the org.
  This is the single most important negative finding in this document: it
  means there is no green light, explicit or implicit, for a project like
  `graphify-stdlibjs` to use the stdlib name/mark. There's also no red light
  beyond the ToS's generic anti-affiliation clause. The absence has to be
  treated as "assume the most conservative reading," not as tacit permission.
- **No confirmation of whether the logo SVG/image files themselves are
  covered by the repo's Apache-2.0 grant, or reserved.** Apache-2.0 §6 only
  says the *licence* doesn't extend to trademarks; it doesn't settle whether
  stdlib considers the logo file itself "code" (freely reusable, modifiable)
  or "mark" (reserved). I found nothing settling this either way.
- **No official style guide, colour-contrast spec, spacing system, or design
  tokens file** beyond the CSS custom properties reverse-engineered from the
  live stylesheet. Everything in §1 is inferred from what the site's CSS
  *does*, not from a published design-system document that says what it
  *should* do.
- **No confirmation stdlib has ever addressed community/derivative tools
  by name** (nothing like "stdlib community projects" guidelines, no
  "built with stdlib" badge program, no `awesome-stdlib`-style
  officially-blessed listing with usage rules).

## Recommendation

Given the above, the conservative, defensible path for `graphify-stdlibjs`:

- **Safe to use as palette inspiration**: the confirmed hex values
  (`--stdlib-orange` `#f0ad3e`/`#e99f36`, `--stdlib-blue` `#00aeef`/`#009cd7`,
  the neutral background/text pairs) and Lato as a UI typeface. These are
  facts about how stdlib renders its own site, not trademarked expressions —
  colour values and font choices are not themselves protectable the way a
  name or logo mark is. Using a visually related palette to feel "kin" is
  low-risk.
- **Safe to keep**: the project's own `graphify · stdlib` wordmark in its own
  typographic treatment, and a clear, persistent "unofficial" / "not affiliated
  with the stdlib project" disclaimer. This directly satisfies the one
  explicit rule stdlib does publish (ToS: don't falsely imply affiliation).
- **Must avoid**: reproducing or closely imitating stdlib's actual logo
  mark/icon (the two-lobe amber/blue gradient symbol) — that's an unlicensed
  trademark question with zero published guidance either way, so imitation is
  the highest-risk move available. Also avoid using stdlib's name in a way
  that could read as an official product, a sub-brand, or an endorsed
  extension (e.g. no "stdlib" as the dominant/first word, no styling that
  copies the exact logo wordmark treatment, no claiming official status
  anywhere in copy or metadata).
- **Do not treat this document's palette/typography findings as a green light
  for the logo mark.** They are separable questions with separable answers:
  colour and font, reasonably safe to echo; the mark itself, not addressed by
  any policy stdlib has published, so the only safe assumption is "reserved."
