import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/#/`);
await page.waitForSelector('.constellation');
await page.screenshot({ path: 'e2e/home.png' });

await page.goto(`${base}/#/explore/blas/ext/base/dsumkbn`);
await page.waitForSelector('.gnode.is-selected');
console.log('nodes:', await page.locator('.gnode').count());
await page.screenshot({ path: 'e2e/explorer.png' });

await page.keyboard.press('Meta+K');
await page.fill('.palette-input', 'logf');
await page.keyboard.press('Enter');
await page.waitForSelector('.module-card');
console.log('focus id:', await page.locator('.module-id').textContent());
await page.screenshot({ path: 'e2e/focus.png' });

await browser.close();
