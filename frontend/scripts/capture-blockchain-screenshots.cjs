/**
 * Capture blockchain-related screenshots for documentation
 *
 * Prerequisites: npx playwright install chromium
 * Usage: cd frontend && node scripts/capture-blockchain-screenshots.cjs
 *
 * Captures:
 *   docs/screenshots/desktop/68_blockchain_panel_genesis.png
 *   docs/screenshots/desktop/69_blockchain_admin_registro.png
 *   docs/screenshots/mobile/M26_blockchain_panel_genesis_mobile.png
 *   docs/screenshots/mobile/M27_blockchain_admin_registro_mobile.png
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://sitrep.ultimamilla.com.ar';
const DOCS_DIR = path.resolve(__dirname, '../../docs/screenshots');
const CREDS = { email: 'juan.perez@dgfa.gob.ar', password: 'admin123' };
// Manifiesto with GENESIS CONFIRMADO
const MANIFIESTO_NUM = '2026-000064';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  // Click the "Administrador" demo user button (first grid button)
  await page.locator('button:has-text("Administrador")').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function captureDesktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);

  // 1. Manifiesto detail with BlockchainPanel
  console.log('Desktop: navigating to manifiesto detail...');
  await page.goto(`${BASE}/manifiestos`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // Search for the specific manifiesto
  const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(MANIFIESTO_NUM);
    await page.waitForTimeout(1500);
  }

  // Click the manifiesto row
  const row = page.locator(`text=${MANIFIESTO_NUM}`).first();
  if (await row.isVisible()) {
    await row.click();
  } else {
    // Direct navigation fallback
    await page.goto(`${BASE}/manifiestos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Try clicking any visible link/row with the number
    const link = page.locator(`a:has-text("${MANIFIESTO_NUM}"), tr:has-text("${MANIFIESTO_NUM}")`).first();
    if (await link.isVisible()) await link.click();
  }
  await page.waitForTimeout(2000);

  // Scroll to BlockchainPanel and capture it prominently
  const blockchainPanel = page.locator('text=Certificacion Blockchain').first();
  if (await blockchainPanel.isVisible()) {
    await blockchainPanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    // Scroll down a bit more so the full panel is visible
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '68_blockchain_panel_genesis.png'),
    fullPage: false,
  });
  console.log('  -> 68_blockchain_panel_genesis.png');

  // 2. Admin Blockchain page
  console.log('Desktop: navigating to admin blockchain...');
  await page.goto(`${BASE}/admin/blockchain`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'desktop', '69_blockchain_admin_registro.png'),
    fullPage: false,
  });
  console.log('  -> 69_blockchain_admin_registro.png');

  await ctx.close();
}

async function captureMobile(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await login(page);

  // 3. Mobile manifiesto detail with BlockchainPanel
  console.log('Mobile: navigating to manifiesto detail...');
  await page.goto(`${BASE}/manifiestos`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  // On mobile, search may be different
  const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(MANIFIESTO_NUM);
    await page.waitForTimeout(1500);
  }

  const row = page.locator(`text=${MANIFIESTO_NUM}`).first();
  if (await row.isVisible()) {
    await row.click();
  }
  await page.waitForTimeout(2000);

  // Scroll to blockchain panel
  const blockchainPanel = page.locator('text=Certificacion Blockchain').first();
  if (await blockchainPanel.isVisible()) {
    await blockchainPanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(DOCS_DIR, 'mobile', 'M26_blockchain_panel_genesis_mobile.png'),
    fullPage: false,
  });
  console.log('  -> M26_blockchain_panel_genesis_mobile.png');

  // 4. Mobile admin blockchain
  console.log('Mobile: navigating to admin blockchain...');
  await page.goto(`${BASE}/admin/blockchain`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(DOCS_DIR, 'mobile', 'M27_blockchain_admin_registro_mobile.png'),
    fullPage: false,
  });
  console.log('  -> M27_blockchain_admin_registro_mobile.png');

  await ctx.close();
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  try {
    await captureDesktop(browser);
    await captureMobile(browser);
    console.log('\nAll 4 blockchain screenshots captured successfully.');
  } catch (err) {
    console.error('Error capturing screenshots:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
