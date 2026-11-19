import { defineConfig, devices } from '@playwright/test';

// Device presets ship a 1280x720 viewport, which is below the app's 1024x768 minimum height guard.
const viewport = { width: 1280, height: 800 };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Flakes must be fixed, not retried away.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
    // Edge is Chromium-based, but running the real channel catches packaging and policy differences.
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport } },
  ],
});
