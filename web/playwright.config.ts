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

// Specs that are pure logic - no browser, no server. Anything NOT listed here
// is treated as a UI spec and will be run against a real browser, so a new
// pure-logic spec omitted from this list silently becomes a slow browser test
// (or fails for want of a page). Add new unit specs here.
const SCREEN_SPECS = /\.screens\.spec\.ts/

const UNIT_SPECS = /(auth|import|calendar|oauth|ics|weekgrid|syncbutton|dialect|mention|actions-filter|timeleft|reorder|notepad|reminders|push-client)\.spec\.ts/

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
    { name: 'unit', testMatch: UNIT_SPECS, testIgnore: SCREEN_SPECS },
    {
      name: 'ui',
      testIgnore: [UNIT_SPECS, SCREEN_SPECS],
      use: { ...devices['Desktop Chrome'] },
    },
    // Screenshot-only, and present ONLY when explicitly asked for. It needs a
    // server configured for Google while the user is NOT connected, which is
    // not how the rest of the suite runs, so including it by default just
    // produces three failures.
    //   npm run screens:connect
    ...(process.env.FELLOW_SCREENS
      ? [
          {
            name: 'screens',
            testMatch: SCREEN_SPECS,
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
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
          // MySQL everywhere, same engine as production. Needs a local
          // server: `brew services start mysql` plus `npm run db:setup`.
          FELLOW_DB_DRIVER: 'mysql',
          APP_ID: process.env.APP_ID ?? 'fellow_dev',
          DB_HOST: process.env.DB_HOST ?? '127.0.0.1',
          DB_PORT: process.env.DB_PORT ?? '3306',
          DB_PASSWORD: process.env.DB_PASSWORD ?? 'fellowdev',
          // Points the app's JWKS fetch at the local test server.
          CF_ACCESS_ISSUER: 'http://127.0.0.1:3199',
          CF_ACCESS_AUD: 'fellow2-test-aud',
          FELLOW_ENCRYPTION_KEY: 'test-encryption-key-long-enough-for-tests',
          // Screenshot runs need googleConfigured() true so the connect
          // prompts render. There is still no google_connection row, so the
          // app is in the configured-but-not-connected state they exist for.
          ...(process.env.FELLOW_SCREENS
            ? {
                GOOGLE_CLIENT_ID: 'screens.apps.googleusercontent.com',
                GOOGLE_CLIENT_SECRET: 'screens-secret',
                GOOGLE_REDIRECT_URI: 'http://127.0.0.1:3100/api/auth/google/callback',
              }
            : {}),
        },
      },
})
