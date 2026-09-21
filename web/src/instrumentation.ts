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
}
