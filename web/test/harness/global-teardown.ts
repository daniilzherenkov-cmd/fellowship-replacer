/** Stop the detached JWKS server so it does not linger between runs. */

import { readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { TMP_DIR } from './setup'

export default async function globalTeardown() {
  const pidFile = join(TMP_DIR, 'jwks.pid')
  if (!existsSync(pidFile)) return
  const pid = Number(readFileSync(pidFile, 'utf8'))
  try {
    process.kill(pid)
  } catch {
    // already gone
  }
  rmSync(pidFile, { force: true })
}
