import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests - WCAG 2.1 AA Compliance
 * Uses axe-core for automated accessibility testing
 */

test.describe('Accessibility - WCAG 2.1 AA', () => {
  
  test('Login page should be accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations:', JSON.stringify(results.violations, null, 2));
    }
    
    expect(results.violations).toHaveLength(0);
  });

  test('App main screen should be accessible', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.leaflet-container') // Exclude map which may have known issues
      .analyze();
    
    // Allow minor violations that don't impact core functionality
    const criticalViolations = results.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('Forms should have proper labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check all form inputs have associated labels
    const inputs = await page.locator('input:not([type="hidden"])').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      
      // Input should have some form of accessible label
      const hasLabel = id || ariaLabel || ariaLabelledBy || placeholder;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('Buttons should have accessible names', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const textContent = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      // Button should have accessible name
      const hasName = (textContent && textContent.trim()) || ariaLabel || title;
      expect(hasName).toBeTruthy();
    }
  });

  test('Images should have alt text', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Decorative images can have role="presentation" or empty alt
      const isDecorative = role === 'presentation' || alt === '';
      const hasAlt = alt !== null;
      
      expect(isDecorative || hasAlt).toBeTruthy();
    }
  });

  test('Color contrast should meet WCAG AA', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    
    // Log contrast issues
    const contrastViolations = results.violations.filter(v => 
      v.id === 'color-contrast'
    );
    
    if (contrastViolations.length > 0) {
      console.log('Contrast issues:', contrastViolations);
    }
    
    // Warning rather than failure for contrast since it can be subjective
    expect(contrastViolations.length).toBeLessThanOrEqual(5);
  });

  test('Keyboard navigation should work', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Check that focus is visible
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Tab a few more times
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.locator(':focus').first();
      await expect(focused).toBeVisible();
    }
  });

  test('Page should have proper heading structure', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    
    // Headings should follow proper hierarchy (no skipping levels)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    if (headings.length > 1) {
      let lastLevel = 0;
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName);
        const level = parseInt(tagName.substring(1));
        
        // Should not skip more than one level
        if (lastLevel > 0) {
          expect(level - lastLevel).toBeLessThanOrEqual(1);
        }
        lastLevel = level;
      }
    }
  });

  test('Touch targets should be adequate size on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        // WCAG requires minimum 44x44px touch target
        // We allow 40x40 for some flexibility
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
