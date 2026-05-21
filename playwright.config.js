const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 120000,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 15000,
  },
  webServer: {
    // Start Next + Inngest together. Gemini is disabled so resume parsing
    // + roadmap generation use deterministic fallbacks.
    command: 'bash -lc "GEMINI_API_KEY= npm run dev -- -p 3000 & npm run inngest:dev"',
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExisting: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

