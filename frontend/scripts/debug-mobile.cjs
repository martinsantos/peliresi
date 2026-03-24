const { chromium } = require('playwright');
const APP = 'https://sitrep.ultimamilla.com.ar/app';
const MB = { width: 390, height: 844 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: MB,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const p = await ctx.newPage();

  // Step 1: go to login
  await p.goto(APP + '/login', { waitUntil: 'networkidle' });
  console.log('1. URL after goto login:', p.url());
  
  // Check buttons
  const buttons = await p.locator('button').all();
  console.log('Buttons found:', buttons.length);
  for (const btn of buttons) {
    const t = await btn.textContent();
    console.log(' -', t?.trim().replace(/\n/g,' ').substring(0, 80));
  }

  // Click Admin
  const adminBtn = p.locator('button:has-text("Administrador")').first();
  const visible = await adminBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Admin button visible:', visible);
  
  if (visible) {
    await adminBtn.click();
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1500);
    console.log('2. URL after login click:', p.url());
    console.log('Page title:', await p.title());
    
    // Check if we're authenticated
    await p.screenshot({ path: 'scripts/debug-after-login.png' });
    console.log('Screenshot saved: scripts/debug-after-login.png');
    
    // Try navigating to mobile dashboard
    await p.goto(APP + '/mobile/dashboard', { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);
    console.log('3. URL after mobile/dashboard:', p.url());
    await p.screenshot({ path: 'scripts/debug-mobile-dashboard.png' });
    console.log('Dashboard screenshot saved');
  }
  
  await browser.close();
})();
