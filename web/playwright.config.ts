import { defineConfig, devices } from '@playwright/test'

/**
 * Agent-runnable by design: one command, no watch mode, no prompts,
 * deterministic, exit 0/1. Failures print the failing locator and leave a
 * screenshot + trace behind.
 *
 * Protoship has NO staging environment - every deploy goes straight to
 * production - so this suite is the gate that stands in for one.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Pure-node specs (auth crypto, importer) need no browser.
    {
      name: 'unit',
      testMatch: /(auth|import|calendar)\.spec\.ts/,
    },
    {
      name: 'ui',
      testIgnore: /(auth|import|calendar)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Started only for the UI project; the unit project does not need it.
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run build && PORT=3100 node .next/standalone/server.js',
        url: 'http://127.0.0.1:3100/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          FELLOW_DB_DRIVER: 'sqlite',
          FELLOW_SQLITE_PATH: './test/.tmp/e2e.sqlite',
          CF_ACCESS_ISSUER: 'https://test-access.local',
          CF_ACCESS_AUD: 'fellow2-test-aud',
        },
      },
})
