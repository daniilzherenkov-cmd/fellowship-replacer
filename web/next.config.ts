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

  // NOTE: better-sqlite3 (test-only, native) is kept out of the production image
  // by `npm prune --omit=dev` in the Dockerfile, NOT by outputFileTracingExcludes.
  // Excluding it from the trace leaves a DANGLING SYMLINK in .next/standalone
  // that Docker's COPY follows and fails on. Pruning removes the package before
  // tracing runs, so no broken link is ever created.
}

export default nextConfig
