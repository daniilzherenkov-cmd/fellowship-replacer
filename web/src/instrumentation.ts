/**
 * Startup hook. Next calls `register()` once per server process, before it
 * serves any request.
 *
 * This is where Vault secrets are loaded, so `DB_PASSWORD` is populated before
 * the first query. Doing it here rather than per-request matters: a lazy
 * per-request load would let the first few requests race an unpopulated
 * `process.env` and fail with access-denied for no obvious reason.
 */

export async function register() {
  // Only the Node.js server runtime can reach Vault (and only it needs to).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { loadSecrets } = await import('./lib/secrets')
  await loadSecrets()

  // The app's own scheduler. There is no platform cron, but app.yaml pins
  // this service to a single always-on replica (min: 1, max: 1), so a timer
  // started here IS a reliable scheduler. Must come after loadSecrets: the
  // VAPID keys arrive from Vault.
  const { startReminderScheduler } = await import('./lib/push')
  startReminderScheduler()

  // Shared-note channels live in this process's memory, which is only
  // correct while the service runs a single replica. Say so loudly at boot
  // if that has changed, because the failure mode otherwise is two people
  // silently not seeing each other. See docs/16.
  const { assertSingleReplica } = await import('./lib/note-hub')
  assertSingleReplica()

  // A metrics line to stdout every minute. Loki keeps the history, so there
  // is nothing to poll and nothing to install.
  const { startMetricsReporter } = await import('./lib/metrics')
  startMetricsReporter()
}
