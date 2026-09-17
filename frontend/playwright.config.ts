import { defineConfig, devices } from '@playwright/test';

const hostResolverRules = process.env.PLAYWRIGHT_HOST_RESOLVER_RULES;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const crossBrowser = process.env.PLAYWRIGHT_CROSS_BROWSER === '1';
const safeApiMode = process.env.PLAYWRIGHT_SAFE_API === '1';

export default defineConfig({
  testDir: './e2e',
  // Shared macOS volumes may contain AppleDouble resource-fork companions
  // such as `._foo.spec.ts`. They are metadata, not executable tests.
  testIgnore: ['**/._*', '**/.__*'],
  fullyParallel: false, // serial by default for workflow tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30000,

  use: {
    // E2E must name its target explicitly. A loopback default fails safely
    // when no QA server is running instead of mutating the public mirror.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:4173',
    // Allows the suite to run through an SSH/VPN tunnel while preserving the
    // real TLS/Host name for Nginx. It is opt-in and has no effect in CI.
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === 'true',
    // Safe suites intercept every API call. Blocking workers prevents WebKit
    // from issuing worker-owned fetches that Playwright page routes cannot see.
    // Worker source, scope and cache exclusions are asserted independently.
    serviceWorkers: safeApiMode ? 'block' : 'allow',
    launchOptions: hostResolverRules
      ? { args: [`--host-resolver-rules=${hostResolverRules}`] }
      : undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
    ...(crossBrowser ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['iPhone 13'] },
      },
    ] : []),
  ],
});
