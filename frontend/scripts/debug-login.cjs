const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  
  console.log('Navigating to login...');
  await p.goto('https://sitrep.ultimamilla.com.ar/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  const url = p.url();
  console.log('Current URL:', url);
  
  // Check what inputs exist
  const inputs = await p.locator('input').all();
  console.log('Inputs found:', inputs.length);
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log(' - input type:', type, 'name:', name, 'placeholder:', placeholder);
  }

  // Check buttons
  const buttons = await p.locator('button').all();
  console.log('Buttons found:', buttons.length);
  for (const btn of buttons) {
    const text = await btn.textContent();
    console.log(' - button:', text?.trim().substring(0, 50));
  }
  
  await p.screenshot({ path: 'scripts/debug-login.png' });
  console.log('Screenshot saved');
  
  await browser.close();
})();
