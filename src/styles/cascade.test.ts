import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pins the cascade decision in
 * `docs/adr/0003-global-focus-ring-wins-the-cascade.md`: `base.css` loads
 * last so its global `:focus-visible` ring cannot be suppressed by accident,
 * and any component that means to replace that ring has to out-specify it.
 *
 * These are source-level assertions rather than the rendered-style assertion
 * the shape of the problem suggests, because jsdom cannot express it: its
 * `getComputedStyle` ignores `:focus-visible` rules entirely (it resolves the
 * plain-class rule instead, even while `el.matches(':focus-visible')` is
 * true) and never resolves `outline` from a stylesheet at all. A jsdom
 * assertion here would encode the opposite of what a browser does. The
 * browser behaviour itself is verified by hand against `npm run dev`; the ADR
 * records what was measured.
 */

const SRC = join(__dirname, '..');
const BASE_CSS = join(SRC, 'styles', 'base.css');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return full.endsWith('.css') ? [full] : [];
  });
}

/** Specificity of a single compound selector as (id, class, type). */
function specificity(selector: string): [number, number, number] {
  const s = selector.replace(/::[\w-]+/g, ''); // pseudo-elements count as type
  const ids = s.match(/#[\w-]+/g)?.length ?? 0;
  // classes, attribute selectors and pseudo-classes all count in the class column
  const classes =
    (s.match(/\.[\w-]+/g)?.length ?? 0) +
    (s.match(/\[[^\]]*\]/g)?.length ?? 0) +
    (s.match(/:(?!:)[\w-]+/g)?.length ?? 0);
  const types = s.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g)?.length ?? 0;
  return [ids, classes, types];
}

function beats(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false; // a tie loses; order decides, and base.css is last
}

/** Crude rule splitter: good enough for these hand-written stylesheets. */
function rules(css: string): { selector: string; body: string }[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutComments)) !== null) {
    const selector = m[1].trim();
    if (selector.startsWith('@')) continue; // at-rule preludes carry no selector
    out.push({ selector, body: m[2] });
  }
  return out;
}

const FOCUS_VISIBLE: [number, number, number] = [0, 1, 0]; // base.css's bare `:focus-visible`

describe('focus-ring cascade (ADR 0003)', () => {
  it('imports base.css after App, so component styles lose an equal-specificity tie', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const appIndex = main.indexOf("from './app/App'");
    const baseIndex = main.indexOf("import './styles/base.css'");

    expect(appIndex, 'main.tsx should import ./app/App').toBeGreaterThan(-1);
    expect(baseIndex, 'main.tsx should import ./styles/base.css').toBeGreaterThan(-1);
    expect(
      baseIndex,
      'base.css must be imported after App so it enters the document last',
    ).toBeGreaterThan(appIndex);
  });

  it('base.css still defines the global :focus-visible ring', () => {
    const focusRule = rules(readFileSync(BASE_CSS, 'utf8')).find(
      (r) => r.selector === ':focus-visible',
    );
    expect(focusRule, 'base.css should carry a bare :focus-visible rule').toBeDefined();
    expect(focusRule!.body).toMatch(/outline:\s*2px solid var\(--trace\)/);
    expect(specificity(':focus-visible')).toEqual(FOCUS_VISIBLE);
  });

  it('no stylesheet suppresses the ring at a specificity that cannot beat it', () => {
    const offenders: string[] = [];

    for (const file of cssFiles(SRC)) {
      if (file === BASE_CSS) continue;
      for (const { selector, body } of rules(readFileSync(file, 'utf8'))) {
        if (!/outline:\s*(none|0)\b/.test(body)) continue;
        // A comma-separated list is only as strong as its weakest branch.
        for (const branch of selector.split(',').map((s) => s.trim())) {
          if (!beats(specificity(branch), FOCUS_VISIBLE)) {
            offenders.push(`${file.slice(SRC.length + 1)}: \`${branch}\``);
          }
        }
      }
    }

    expect(
      offenders,
      'These rules suppress the focus ring but lose to base.css, so they do nothing. ' +
        'Either delete them, or add a class/pseudo-class so they out-specify ' +
        '`:focus-visible` and supply their own indicator (see ADR 0003).',
    ).toEqual([]);
  });

  it('the palette input replaces the ring at a winning specificity', () => {
    const rule = rules(readFileSync(join(SRC, 'search', 'search.css'), 'utf8')).find(
      (r) => r.selector === '.palette-input:focus-visible',
    );
    expect(rule, 'the palette input should still style its own focus').toBeDefined();
    expect(rule!.body).toMatch(/outline:\s*none/);
    expect(beats(specificity('.palette-input:focus-visible'), FOCUS_VISIBLE)).toBe(true);
    // It suppresses the ring, so it has to mark focus some other way.
    expect(rule!.body).toMatch(/var\(--trace\)/);
  });

  it('graph nodes keep the outer ring: it is the only focus mark on a selected node', () => {
    const graphview = readFileSync(join(SRC, 'graphview', 'graphview.css'), 'utf8');
    const gnode = rules(graphview).find((r) => r.selector === '.gnode');
    expect(gnode, '.gnode rule should exist').toBeDefined();
    expect(
      gnode!.body,
      '.gnode must not suppress the ring; a selected node is filled with --trace, ' +
        'so its 3px --trace focus stroke is invisible and the outer ring is all there is',
    ).not.toMatch(/outline/);
  });
});
