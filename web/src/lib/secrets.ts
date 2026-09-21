/**
 * Vault secret loading, ported from the platform's `server/secrets.js`.
 *
 * WHY THIS EXISTS: on Protoship, `DB_PASSWORD` is NOT a container env var. It
 * lives in Vault and is fetched at startup by the react-express template's
 * `server/secrets.js`. This app is off-template, so nothing was loading it and
 * every query failed with:
 *
 *   ER_ACCESS_DENIED_ERROR: Access denied for user 'app_<APP_ID>'
 *
 * The pod booted fine and /api/health stayed green (it does no DB round-trip),
 * so the failure only showed up as a 500 on the first page that reads data.
 *
 * Two Vault paths, deliberately separate:
 *   - apps/<APP_ID>            app secrets added via `add_secret`
 *   - db-credentials/<APP_ID>  platform-provisioned; only `password`, remapped
 *                              to DB_PASSWORD (host comes in as a plain env
 *                              var, user is derived from APP_ID)
 *
 * FAILS OPEN, like the platform helper: a Vault outage logs and continues
 * rather than refusing to boot. Callers must therefore validate before use -
 * `assertDbConfigured()` in db.ts turns a missing password into a clear error
 * instead of a MySQL access-denied deep in a render.
 */

/** Never let a Vault value clobber these - they are platform-controlled. */
const PROTECTED_ENV_KEYS = new Set([
  'PORT',
  'NODE_ENV',
  'PATH',
  'HOME',
  'VAULT_ADDR',
  'VAULT_ROLE_ID',
  'VAULT_SECRET_ID',
  'VAULT_MOUNT',
  'APP_ID',
])

const VAULT_TIMEOUT_MS = 5000

function log(level: 'info' | 'warn' | 'error', msg: string, extra?: Record<string, unknown>) {
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify({ level, msg, ...extra }),
  )
}

async function loadFromPath(
  vaultAddr: string,
  vaultToken: string,
  secretPath: string,
  keyMap: Record<string, string> = {},
): Promise<void> {
  const res = await fetch(`${vaultAddr}/v1/${secretPath}`, {
    headers: { 'X-Vault-Token': vaultToken },
    signal: AbortSignal.timeout(VAULT_TIMEOUT_MS),
  })

  if (res.status === 404) {
    log('info', `Vault: no secrets at ${secretPath}`)
    return
  }
  if (!res.ok) {
    log('error', 'Vault: failed to read secrets', { status: res.status, secretPath })
    return
  }

  const secrets = (await res.json())?.data?.data
  if (!secrets || typeof secrets !== 'object') {
    log('warn', 'Vault: secret response had no data', { secretPath })
    return
  }

  const loaded: string[] = []
  const skipped: string[] = []
  for (const [key, value] of Object.entries(secrets)) {
    const envKey = keyMap[key] ?? key
    if (PROTECTED_ENV_KEYS.has(envKey)) {
      skipped.push(envKey)
      continue
    }
    process.env[envKey] = String(value)
    loaded.push(envKey)
  }

  // Names only - never values.
  log('info', `Vault: loaded ${loaded.length} secret(s) from ${secretPath}`, {
    keys: loaded.join(', '),
  })
  if (skipped.length) {
    log('warn', `Vault: skipped ${skipped.length} protected key(s)`, { keys: skipped.join(', ') })
  }
}

export async function loadSecrets(): Promise<void> {
  const {
    VAULT_ADDR = 'https://vault-staging.dhapps.ai',
    VAULT_ROLE_ID,
    VAULT_SECRET_ID,
    VAULT_MOUNT = 'protoship-v1',
    APP_ID,
  } = process.env

  if (!VAULT_ROLE_ID || !VAULT_SECRET_ID || !APP_ID) {
    log('info', 'Vault not configured (missing VAULT_ROLE_ID, VAULT_SECRET_ID or APP_ID) - skipping')
    return
  }

  try {
    const loginRes = await fetch(`${VAULT_ADDR}/v1/auth/approle/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: VAULT_ROLE_ID, secret_id: VAULT_SECRET_ID }),
      signal: AbortSignal.timeout(VAULT_TIMEOUT_MS),
    })
    if (!loginRes.ok) {
      log('error', 'Vault: login failed', { status: loginRes.status })
      return
    }

    const vaultToken = (await loginRes.json())?.auth?.client_token
    if (!vaultToken) {
      log('error', 'Vault: login response contained no client_token')
      return
    }

    await loadFromPath(VAULT_ADDR, vaultToken, `${VAULT_MOUNT}/data/apps/${APP_ID}`)
    await loadFromPath(VAULT_ADDR, vaultToken, `${VAULT_MOUNT}/data/db-credentials/${APP_ID}`, {
      password: 'DB_PASSWORD',
    })

    log('info', 'Vault: secret loading complete', {
      dbPasswordPresent: Boolean(process.env.DB_PASSWORD),
    })
  } catch (err) {
    log('error', 'Vault: failed to load secrets', { err: String(err) })
  }
}
