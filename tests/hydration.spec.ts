import { test, expect } from '@playwright/test';

test.describe('Creator Studio Hydration Tests (Steps 1..5)', () => {
  // Helper to register console listeners and filter out chrome-extension messages
  function attachConsoleHydrationWatch(page: any) {
    const hydrationErrors: string[] = [];
    const allConsoleMessages: string[] = [];

    page.on('console', (msg: any) => {
      const loc = msg.location();
      // Ignore chrome-extension scripts or URLs entirely
      if (loc && loc.url && loc.url.startsWith('chrome-extension://')) {
        return;
      }

      const text = msg.text();
      const type = msg.type();
      allConsoleMessages.push(`[${type}] ${text}`);

      const lower = text.toLowerCase();
      const isHydrationMismatch =
        lower.includes('hydration failed') ||
        lower.includes('did not match') ||
        lower.includes('server-rendered html') ||
        lower.includes('expected server html to contain') ||
        lower.includes('text content does not match') ||
        (lower.includes('hydration') && (type === 'error' || type === 'warning'));

      if (isHydrationMismatch) {
        hydrationErrors.push(`[${type}] ${text}`);
      }
    });

    page.on('pageerror', (err: any) => {
      const msg = err.message || '';
      if (!msg.includes('chrome-extension://')) {
        if (msg.toLowerCase().includes('hydration')) {
          hydrationErrors.push(`[pageerror] ${msg}`);
        }
      }
    });

    return { hydrationErrors, allConsoleMessages };
  }

  // 1. Guest visitor tests across Steps 1 to 5
  for (let step = 1; step <= 5; step++) {
    test(`Guest on /new-project?step=${step} loads with zero hydration errors`, async ({ page }) => {
      const { hydrationErrors, allConsoleMessages } = attachConsoleHydrationWatch(page);

      await page.goto(`/new-project?step=${step}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verify that no hydration errors occurred
      expect(hydrationErrors, `Hydration errors detected on guest step ${step}:\n${hydrationErrors.join('\n')}\nAll messages:\n${allConsoleMessages.join('\n')}`).toEqual([]);
    });
  }

  // 2. Signed-in client tests across Steps 1 to 5
  for (let step = 1; step <= 5; step++) {
    test(`Signed-in client on /new-project?step=${step} loads with zero hydration errors`, async ({ page, context }) => {
      // Seed client user and cart state into localStorage before navigation
      await context.addInitScript((targetStep: number) => {
        window.localStorage.setItem(
          'humantek_studio_user',
          JSON.stringify({
            state: {
              user: {
                id: 'usr_client_test',
                name: 'Kira Vance',
                email: 'kira@example.com',
                avatarInitials: 'KV',
                walletBalance: 250,
                role: 'client',
                emailVerified: true,
                hasProjects: true,
                canChat: true,
              },
              isHydrated: true,
            },
            version: 1,
          })
        );

        window.localStorage.setItem(
          'humantek_wizard_cart',
          JSON.stringify({
            state: {
              projectId: 'proj-seeded-client-123',
              selectedPackageId: 'creator-forge',
              fundingSource: 'package',
              currentStep: targetStep,
              selections: {
                'srv-longform-editing': { level: 1, quantity: 1 },
              },
              additions: [],
              policyAccepted: true,
              termsAccepted: true,
              brief: {
                channelName: 'Kira Tech',
                platform: 'YouTube',
                style: 'Modern Cinematic',
                colors: 'Amber & Charcoal',
                instructions: 'Detailed editing brief for automated testing suite',
              },
              savedAt: Date.now(),
              isHydrated: true,
            },
            version: 1,
          })
        );
      }, step);

      const { hydrationErrors, allConsoleMessages } = attachConsoleHydrationWatch(page);

      await page.goto(`/new-project?step=${step}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verify that no hydration errors occurred
      expect(hydrationErrors, `Hydration errors detected on signed-in step ${step}:\n${hydrationErrors.join('\n')}\nAll messages:\n${allConsoleMessages.join('\n')}`).toEqual([]);
    });
  }
});
