import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fmt, graph } from './graph';

/** The focused element's box lies inside the viewport. */
async function focusIsVisible(page: Page) {
  const box = await page.evaluate(() => {
    const r = document.activeElement!.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, w: innerWidth, h: innerHeight };
  });
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.w);
  expect(box.bottom).toBeLessThanOrEqual(box.h);
}

test('home shows the constellation and stats that match graph.json', async ({ page }) => {
  await page.goto('#/');
  await expect(page.locator('.constellation')).toBeVisible();
  const { commit } = graph.provenance;
  await expect(page.getByRole('list', { name: 'Graph summary' }).getByRole('listitem')).toHaveText([
    `${fmt.format(graph.n)} packages`,
    `${fmt.format(graph.edgeCount('runtime'))} runtime links`,
    `${fmt.format(graph.namespaceCount())} namespaces`,
    commit ? `Built from stdlib commit ${commit.slice(0, 7)}` : 'Built from a local stdlib checkout',
  ]);
});

test('a deep link into the explorer lands on the package, selected and on screen', async ({ page }) => {
  await page.goto('#/explore/blas/ext/base/dsumkbn');
  const node = page.getByRole('treeitem', { name: 'dsumkbn', exact: true });
  await expect(node).toHaveAttribute('aria-selected', 'true');
  await expect(node).toBeInViewport();
  await expect(page).toHaveTitle('explore blas/ext/base/dsumkbn · graphify · stdlib');
});

test('search: Ctrl/Cmd+K, type, Enter opens the package', async ({ page }) => {
  await page.goto('#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('logf');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('math/base/special/logf');
});

test('Webbed shows the whole web, and selecting a row explains why it is there', async ({ page }) => {
  const i = graph.indexOf('ndarray/ctor');
  const web = graph.web(i, { kinds: ['runtime'], dir: 'requires' });
  await page.goto('#/module/ndarray/ctor');
  await page.getByRole('button', { name: 'Webbed' }).click();
  await expect(page).toHaveURL(/#\/module\/ndarray\/ctor\?view=webbed$/);
  await expect(page.getByText(`${fmt.format(web.size)} packages, ${web.maxDepth} steps deep`)).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(web.maxDepth + 1);
  const deepest = web.order[web.size - 1];
  await page.getByRole('option', { name: new RegExp(`^${graph.ids[deepest]},`) }).click();
  await expect(page.getByRole('list', { name: 'shortest chain' }).getByRole('listitem')).toHaveText(web.chain(deepest).map((j) => graph.ids[j]));
});

test('keyboard: Tab into the explorer tree, ArrowRight expands, focus stays on screen', async ({ page }) => {
  await page.goto('#/explore');
  const tree = page.getByRole('tree', { name: 'package tree' });
  await expect(tree).toBeVisible();
  for (let i = 0; i < 20 && !(await tree.evaluate((t) => t.contains(document.activeElement))); i++) await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('role', 'treeitem');
  await page.keyboard.press('ArrowDown');
  const label = await page.locator(':focus').getAttribute('aria-label');
  await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('treeitem', { name: label!, exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight'); // into its first child
  await page.waitForTimeout(400); // the pan into view animates
  await focusIsVisible(page);
});

for (const [name, hash] of [
  ['home', '#/'],
  ['explorer', '#/explore/math/base'],
  ['focus', '#/module/ndarray/ctor'],
  ['webbed', '#/module/ndarray/ctor?view=webbed'],
  ['impact', '#/module/ndarray/ctor?view=webbed&dir=in&edges=runtime,dev,native'],
] as const) {
  test(`no serious or critical axe violations: ${name}`, async ({ page }) => {
    await page.goto(hash);
    await expect(page.locator('.app-main > *').first()).toBeVisible();
    await page.waitForTimeout(400);
    // ADR-0004: the Webbed columns share one roving tab stop, and arrow keys move focus (and so
    // scroll) between them, so a column without the tab stop is still reachable. axe's
    // scrollable-region-focusable asks for a tab stop per scrolling column; accepted, not fixed.
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .filter((v) => !(v.id === 'scrollable-region-focusable' && v.nodes.every((n) => n.html.includes('class="web-rows"'))));
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
}

test('the search palette passes axe too', async ({ page }) => {
  await page.goto('#/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('log');
  await expect(page.getByRole('option').first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('.palette').analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
