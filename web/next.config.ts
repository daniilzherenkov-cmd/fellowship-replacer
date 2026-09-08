import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // MANDATORY for Protoship: traces a minimal node_modules into .next/standalone,
  // which is what keeps the container under the 400MB memory ceiling.
  output: 'standalone',

  // The container has no persistent filesystem - anything written at runtime is
  // lost on redeploy and is not shared across replicas. All state lives in MySQL.
  poweredByHeader: false,

  // Next auto-generates web/AGENTS.md and web/CLAUDE.md, which would shadow the
  // project's own CLAUDE.md for any work inside web/. The real instructions
  // live at the repo root.
  agentRules: false,

  // better-sqlite3 is a TEST-ONLY backend (lib/db.ts uses it when DB_HOST is
  // unset). It is a native module whose .node binary is produced by an install
  // script, so a production image built with `npm ci --ignore-scripts` ships the
  // package WITHOUT its binary and the server dies at boot - the container never
  // passes readiness and the edge reports "no healthy upstream".
  //
  // Excluding it from the trace keeps it out of the standalone bundle entirely.
  // The dynamic import in makeSqlite() is only reached in local/test runs, where
  // node_modules is present anyway.
  outputFileTracingExcludes: {
    '*': ['node_modules/better-sqlite3/**', 'node_modules/bindings/**'],
  },
}

export default nextConfig
