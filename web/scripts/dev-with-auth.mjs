#!/usr/bin/env node
/**
 * Local dev launcher.
 *
 * The app verifies a signed Cloudflare Access JWT and deliberately has NO
 * development bypass - that is correct (a `?? process.env.DEV_USER_EMAIL`
 * fallback is a documented full-admin backdoor in another DH app), but it means
 * a bare `next dev` only ever renders "Not signed in".
 *
 * So instead of weakening the auth code, this reuses the test harness:
 *   1. serve a local JWKS with a throwaway keypair,
 *   2. point CF_ACCESS_ISSUER at it,
 *   3. run a tiny proxy that injects a signed token on every request,
 *   4. start `next dev` behind it.
 *
 * The production verification path runs completely unmodified. Open the proxy
 * port, not the Next port, or you will land on "Not signed in".
 *
 * Never deployed: this file is a local convenience only.
 */

import { spawn } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import {
  createSign,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const TMP = join(root, '.dev')
const KEY_PATH = join(TMP, 'dev-key.pem')

const PROXY_PORT = Number(process.env.PORT ?? 3000)
const NEXT_PORT = PROXY_PORT + 1
const JWKS_PORT = PROXY_PORT + 2
const KID = 'fellow2-dev-key'
const AUD = 'fellow2-dev-aud'
const ISSUER = `http://127.0.0.1:${JWKS_PORT}`
const DEV_USER = process.env.FELLOW_DEV_USER || 'danya@deliveryhero.com'

if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })
if (!existsSync(KEY_PATH)) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  writeFileSync(KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
}
const priv = createPrivateKey(readFileSync(KEY_PATH, 'utf8'))

const b64u = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function mintToken(email) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' })))
  const payload = b64u(
    Buffer.from(
      JSON.stringify({
        email,
        sub: `dev-${email}`,
        iss: ISSUER,
        aud: AUD,
        iat: now,
        exp: now + 3600,
      }),
    ),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  return `${header}.${payload}.${b64u(signer.sign(priv))}`
}

// 1. JWKS endpoint, at the path Cloudflare Access uses.
const jwk = createPublicKey(priv).export({ format: 'jwk' })
const jwksBody = JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] })
createServer((req, res) => {
  if (req.url === '/cdn-cgi/access/certs') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(jwksBody)
    return
  }
  res.writeHead(404)
  res.end()
}).listen(JWKS_PORT, '127.0.0.1')

// 2. next dev, on the port behind the proxy.
const next = spawn('npx', ['next', 'dev', '-p', String(NEXT_PORT)], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    CF_ACCESS_ISSUER: ISSUER,
    CF_ACCESS_AUD: AUD,
    FELLOW_DB_DRIVER: 'sqlite',
    FELLOW_SQLITE_PATH: join(TMP, 'dev.sqlite'),
    FELLOW_ENCRYPTION_KEY:
      process.env.FELLOW_ENCRYPTION_KEY || 'local-dev-encryption-key-not-for-production',
  },
})

// 3. Proxy that stamps every request with a signed Access assertion, the way
//    Cloudflare would in front of the deployed app.
createServer((clientReq, clientRes) => {
  const proxied = httpRequest(
    {
      hostname: '127.0.0.1',
      port: NEXT_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `127.0.0.1:${NEXT_PORT}`,
        'cf-access-jwt-assertion': mintToken(DEV_USER),
      },
    },
    (upstream) => {
      clientRes.writeHead(upstream.statusCode ?? 502, upstream.headers)
      upstream.pipe(clientRes)
    },
  )
  proxied.on('error', () => {
    // next dev is still booting.
    clientRes.writeHead(503, { 'content-type': 'text/plain' })
    clientRes.end('Waiting for next dev to start...')
  })
  clientReq.pipe(proxied)
}).listen(PROXY_PORT, () => {
  console.log(`\n  Fellow 2 dev: http://localhost:${PROXY_PORT}  (signed in as ${DEV_USER})\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    next.kill()
    process.exit(0)
  })
}
