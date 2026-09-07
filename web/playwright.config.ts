import { defineConfig, devices } from '@playwright/test'
import { join } from 'node:path'

/**
 * Agent-runnable by design: one command, no watch mode, no prompts,
 * deterministic, exit 0/1. Failures leave a screenshot and a trace.
 *
 * Protoship has NO staging environment - every deploy goes straight to
 * production - so this suite is the gate that stands in for one.
 *
 * Two projects:
 *   unit - pure Node (auth crypto, importer, calendar mapping). No browser,
 *          no server. Fast, and runnable with SKIP_WEBSERVER=1.
 *   ui   - drives the real app against SQLite, authenticating with genuine
 *          RS256 tokens signed by a local test JWKS, so the production
 *          verification path runs unmodified.
 */

const UNIT_SPECS = /(auth|import|calendar|oauth|ics)\.spec\.ts/

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  globalSetup: process.env.SKIP_WEBSERVER ? undefined : './test/harness/global-setup.ts',
  globalTeardown: process.env.SKIP_WEBSERVER ? undefined : './test/harness/global-teardown.ts',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'unit', testMatch: UNIT_SPECS },
    {
      name: 'ui',
      testIgnore: UNIT_SPECS,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run build && node .next/standalone/server.js',
        url: 'http://127.0.0.1:3100/api/health',
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          PORT: '3100',
          FELLOW_DB_DRIVER: 'sqlite',
          // Absolute: the standalone server runs from .next/standalone, so a
          // relative path would resolve against the wrong directory.
          FELLOW_SQLITE_PATH: join(process.cwd(), 'test/.tmp/e2e.sqlite'),
          // Points the app's JWKS fetch at the local test server.
          CF_ACCESS_ISSUER: 'http://127.0.0.1:3199',
          CF_ACCESS_AUD: 'fellow2-test-aud',
          FELLOW_ENCRYPTION_KEY: 'test-encryption-key-long-enough-for-tests',
        },
      },
})
