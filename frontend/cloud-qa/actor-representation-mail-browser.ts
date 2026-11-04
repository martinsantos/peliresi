import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assertCloudEnvironment } from './safety.ts';

assertCloudEnvironment();
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('playwright');
const directory = process.env.QA_ARTIFACTS! + '/mail-gallery';
const files = readdirSync(directory).filter(name => /^\d+\.html$/.test(name));
assert.equal(files.length, 20);
const browser = await chromium.launch();
const results: unknown[] = [];
try {
  for (const width of [360, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    // Render the exact templates locally; never request production assets or trackers.
    await page.route('**/*', (route: any) => route.abort());
    for (const file of files) {
      await page.setContent(readFileSync(directory + '/' + file, 'utf8'));
      assert.ok(await page.locator('h1').innerText());
      assert.equal(await page.locator('img').count(),2);
      await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, file + ': horizontal overflow at ' + width);
      const links = await page.locator('a').evaluateAll((elements: HTMLAnchorElement[]) => elements.map(a => a.getAttribute('href')));
      assert.ok(links.some((href: string) => href?.startsWith('http://127.0.0.1:4177/')));
      await page.screenshot({ path: directory + '/' + file.replace('.html', '-' + width + '.png'), fullPage: true });
      results.push({ file, width, overflow, links });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  writeFileSync(directory + '/visual-checks.json', JSON.stringify({ cases: results.length, externalRequests: 0, results }));
  console.log('PASS 40 email renders, no external requests or mail delivery');
} finally { await browser.close(); }
