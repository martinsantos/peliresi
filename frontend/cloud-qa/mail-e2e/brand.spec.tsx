import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, expect } from '@playwright/test';
import { MapCategorySymbol, type MapCategory } from '../../src-v6/components/ui/MapLayerToggle';
import { prefix } from '../e2e/helpers';

test('public inspection masthead uses the same brand and keeps the invalid-code recovery actionable', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(prefix(info) + '/verificar/inspecciones/qa-brand-invalid');
  await expect(page.getByRole('heading', { name: 'Código no válido' })).toBeVisible();
  const mark = page.locator('[data-sitrep-mark]');
  await expect(mark).toHaveAttribute('src', prefix(info) + '/favicon.svg');
  await expect.poll(() => mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.lucide-leaf')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ir a SITREP' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('brand-inspection.png'), fullPage: true });
  await page.getByRole('link', { name: 'Ir a SITREP' }).click();
  await expect(page).not.toHaveURL(/qa-brand-invalid/);
  expect(errors).toEqual([]);
});

test('brand is legible at small sizes and belongs to the real actor icon family', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(prefix(info) + '/login');
  await expect(page).toHaveTitle(/SITREP/);
  const actualMark = page.locator('[data-sitrep-mark]').first();
  await expect(actualMark).toBeVisible();
  await expect.poll(() => actualMark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByLabel('Correo electrónico o CUIT').fill('marca@night-qa.invalid');
  await expect(page.getByLabel('Correo electrónico o CUIT')).toHaveValue('marca@night-qa.invalid');
  await page.screenshot({ path: info.outputPath('brand-login.png'), animations: 'disabled' });

  // Isolated design proof using actual category components and compiled CSS.
  // This is not a fabricated application screen or a map business-logic test.
  const css = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.outerHTML).join(''));
  const categories: [MapCategory, string][] = [['generador', 'Generador'], ['transportista', 'Transporte'], ['operador', 'Operador'], ['inspeccion', 'Inspección']];
  const cards = categories.map(([category, label]) => `<div class="actor">${renderToStaticMarkup(<MapCategorySymbol category={category} size="hero" />)}<span>${label}</span></div>`).join('');
  await page.setContent(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${css}<title>SITREP · Sistema de identidad</title><style>
    body{margin:0;background:#f3f6f4;color:#172c24;font:16px/1.5 Arial,sans-serif}.board{max-width:840px;margin:0 auto;padding:32px 24px}.signature{display:flex;align-items:center;gap:20px;margin:20px 0 40px}.signature img{width:80px;height:80px}.signature strong{display:block;font-size:40px;line-height:1.1;letter-spacing:-1.5px}.signature p{font-size:14px;margin:8px 0 0;color:#526359}.family{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #cbd8d0;border-bottom:1px solid #cbd8d0;padding:20px 0;gap:20px}.actor{display:flex;align-items:center;gap:8px;font-size:14px}.sizes{display:flex;align-items:center;gap:26px;margin-top:32px}.sizes span{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:12px;color:#526359}h1{font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:400;color:#526359;margin:0 0 28px}.mono{margin-top:32px;padding:24px;background:#1b5e3c;color:white;display:flex;align-items:center;gap:14px;font-size:25px;font-weight:700}.mono img{width:44px;height:44px}@media(max-width:600px){.board{padding:24px 20px}.signature{gap:14px}.signature img{width:64px;height:64px}.signature strong{font-size:34px}.family{grid-template-columns:repeat(2,1fr);gap:16px 8px}.actor{gap:2px}.sizes{gap:20px}}
    </style></head><body><main class="board"><h1>Sistema de identidad · SITREP</h1><div class="signature"><img src="http://127.0.0.1:4177/favicon.svg" alt="Marca SITREP"><div><strong>SITREP</strong><p>Trazabilidad de<br>Residuos Peligrosos</p></div></div><div class="family">${cards}</div><div class="sizes">${[16,24,32,44].map(size => `<span><img src="http://127.0.0.1:4177/favicon.svg" width="${size}" height="${size}" alt="Marca a ${size} píxeles">${size} px</span>`).join('')}</div><div class="mono"><img src="http://127.0.0.1:4177/icon-192.png" alt="">SITREP</div></main></body></html>`);
  await expect(page).toHaveTitle('SITREP · Sistema de identidad');
  await expect(page.locator('[data-map-symbol]')).toHaveCount(4);
  for (const image of await page.locator('img').all()) await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const glyph of await page.locator('[data-map-symbol] svg').all()) await expect(glyph).toHaveAttribute('stroke-width', '2.5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('brand-family.png'), fullPage: true });
  expect(errors).toEqual([]);
});
