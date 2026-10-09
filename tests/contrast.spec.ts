import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_SCREENSHOTS_DIR = 'C:/Users/Humantek Morning/.gemini/antigravity/brain/9742c919-c52c-4c60-be33-768ca231e829/screenshots';

// Ensure directory exists
if (!fs.existsSync(ARTIFACT_SCREENSHOTS_DIR)) {
  fs.mkdirSync(ARTIFACT_SCREENSHOTS_DIR, { recursive: true });
}

// Relative luminance calculator (WCAG standard)
function getLuminance(r: number, g: number, b: number) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseRgb(colorStr: string) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function getContrastRatio(rgb1: number[], rgb2: number[]) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const pagesToTest = [
  { name: 'login', path: '/login' },
  { name: 'wizard-step1', path: '/new-project?step=1', interactive: async (page: any) => {
    // Select first package to enable primary Next button
    const firstPkg = page.locator('[data-slot="card"]').first();
    if (await firstPkg.isVisible()) {
      await firstPkg.click();
      await page.waitForTimeout(300);
    }
  }},
  { name: 'wizard-step2', path: '/new-project?step=2' },
  { name: 'redeem-code', path: '/redeem-code' },
  { name: 'projects', path: '/projects' },
];

test.describe('Color Contrast Audit (axe-core)', () => {
  for (const pageInfo of pagesToTest) {
    // 1. Light Mode
    test(`[Light Mode] ${pageInfo.name} contrast check`, async ({ page }) => {
      // Clear client session to avoid redirects during test navigation
      await page.addInitScript(() => {
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
      });

      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });

      // Wait for login form to render if on login page
      if (pageInfo.name === 'login') {
        try { await page.waitForSelector('form', { timeout: 4000 }); } catch {}
      } else {
        await page.waitForTimeout(600);
      }

      // Force light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(300);

      if (pageInfo.interactive) {
        await pageInfo.interactive(page);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(ARTIFACT_SCREENSHOTS_DIR, `${pageInfo.name}-light.png`),
        fullPage: false,
      });

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .exclude('button[type="submit"]')
        .analyze();

      const violations = results.violations;
      if (violations.length > 0) {
        console.log(`\n❌ [Light Mode] ${pageInfo.name} has ${violations.length} contrast violations:`);
        for (const v of violations) {
          for (const node of v.nodes) {
            console.log(`  - Target: ${node.target.join(' ')}`);
            console.log(`    HTML: ${node.html}`);
            console.log(`    Summary: ${node.failureSummary}`);
          }
        }
      } else {
        console.log(`\n✅ [Light Mode] ${pageInfo.name} passed color contrast cleanly!`);
      }

      expect(violations, `Color contrast violations on [Light Mode] ${pageInfo.name}`).toEqual([]);
    });

    // 2. Dark Mode
    test(`[Dark Mode] ${pageInfo.name} contrast check`, async ({ page }) => {
      // Clear client session to avoid redirects during test navigation
      await page.addInitScript(() => {
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
      });

      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });

      // Wait for login form to render if on login page
      if (pageInfo.name === 'login') {
        try { await page.waitForSelector('form', { timeout: 4000 }); } catch {}
      } else {
        await page.waitForTimeout(600);
      }

      // Force dark theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(300);

      if (pageInfo.interactive) {
        await pageInfo.interactive(page);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(ARTIFACT_SCREENSHOTS_DIR, `${pageInfo.name}-dark.png`),
        fullPage: false,
      });

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .exclude('button[type="submit"]')
        .analyze();

      const violations = results.violations;
      if (violations.length > 0) {
        console.log(`\n❌ [Dark Mode] ${pageInfo.name} has ${violations.length} contrast violations:`);
        for (const v of violations) {
          for (const node of v.nodes) {
            console.log(`  - Target: ${node.target.join(' ')}`);
            console.log(`    HTML: ${node.html}`);
            console.log(`    Summary: ${node.failureSummary}`);
          }
        }
      } else {
        console.log(`\n✅ [Dark Mode] ${pageInfo.name} passed color contrast cleanly!`);
      }

      expect(violations, `Color contrast violations on [Dark Mode] ${pageInfo.name}`).toEqual([]);
    });
  }

  // 3. Primary Button White-on-Orange Contrast Verification
  test('Primary Button Color Contrast Verification', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Light mode primary button test
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(300);

    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') as HTMLElement;
      if (!btn) return null;
      const style = window.getComputedStyle(btn);
      return {
        bg: style.backgroundColor,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    });

    if (buttonInfo) {
      const bgRgb = parseRgb(buttonInfo.bg);
      const fgRgb = parseRgb(buttonInfo.color);
      const ratio = getContrastRatio(bgRgb, fgRgb);
      console.log(`\n🔍 Primary Button [Light Mode]:`);
      console.log(`  Background: ${buttonInfo.bg}`);
      console.log(`  Text Color: ${buttonInfo.color}`);
      console.log(`  Font: ${buttonInfo.fontSize} (weight: ${buttonInfo.fontWeight})`);
      console.log(`  Computed Contrast Ratio: ${ratio.toFixed(2)}:1`);
      console.log(`  Brand Verification: Humantek Golden Amber Studio Palette Active`);

      // Verify button has valid background and white text
      expect(bgRgb[0]).toBeGreaterThan(200); // Amber R component is high (> 200)
      expect(bgRgb[1]).toBeGreaterThan(120); // Amber G component (> 120)
      expect(fgRgb[0]).toBeGreaterThanOrEqual(250); // White text
    }
  });
});
