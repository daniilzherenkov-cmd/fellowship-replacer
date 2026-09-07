/**
 * Standalone JWKS server for UI tests.
 *
 * Serves the test public key at the same path Cloudflare Access uses, so the
 * app's real verification code can fetch it unmodified.
 *
 * Run as a detached child by global-setup so it lives for the whole test run.
 */

import { createServer } from 'node:http'
import { createPublicKey, createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const KEY_PATH = join(here, '../.tmp/test-key.pem')
const PORT = Number(process.env.FELLOW_JWKS_PORT ?? 3199)
const KID = 'fellow2-test-key'

const priv = createPrivateKey(readFileSync(KEY_PATH, 'utf8'))
const jwk = createPublicKey(priv).export({ format: 'jwk' })
const body = JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] })

createServer((req, res) => {
  if (req.url === '/cdn-cgi/access/certs') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
    return
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, '127.0.0.1')
