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
const proxy = createServer((clientReq, clientRes) => {
  const proxied = httpRequest(
    {
      hostname: '127.0.0.1',
      port: NEXT_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        // Keep the host the BROWSER used, not the upstream port. Next validates
        // Server Action requests against host/origin, so rewriting it makes
        // every action fail with "Invalid Server Actions request". Dev-proxy
        // only; production has no proxy in front of the app.
        host: clientReq.headers.host ?? `localhost:${PROXY_PORT}`,
        'cf-access-jwt-assertion': mintToken(DEV_USER),
      },
    },
    (upstream) => {
      clientRes.writeHead(upstream.statusCode ?? 502, upstream.headers)
      upstream.pipe(clientRes)
    },
  )
  proxied.on('error', () => {
    // next dev is still booting, or the client went away mid-flight.
    if (!clientRes.headersSent) {
      clientRes.writeHead(503, { 'content-type': 'text/plain' })
      clientRes.end('Waiting for next dev to start...')
    } else {
      clientRes.end()
    }
  })
  // A browser navigating away mid-request produces EPIPE/ECONNRESET on these
  // sockets. Unhandled, they take the whole proxy down mid-session.
  clientReq.on('error', () => proxied.destroy())
  clientRes.on('error', () => proxied.destroy())
  clientReq.pipe(proxied)
})

proxy.on('clientError', (_err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

// Next's HMR runs over a WebSocket. A plain HTTP proxy drops the upgrade
// handshake, and without HMR the client bundle never fully hydrates - buttons
// render but their onChange/onClick never fire, which looks exactly like an
// application bug. Forward upgrades explicitly.
proxy.on('upgrade', (req, socket, head) => {
  const upstream = httpRequest({
    hostname: '127.0.0.1',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${NEXT_PORT}` },
  })
  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamRes.headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\r\n')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`)
    if (upstreamHead?.length) socket.unshift(upstreamHead)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
  })
  upstream.on('error', () => socket.destroy())
  if (head?.length) upstream.write(head)
  upstream.end()
})

proxy.listen(PROXY_PORT, () => {
  console.log(`\n  Fellow 2 dev: http://localhost:${PROXY_PORT}  (signed in as ${DEV_USER})\n`)
})

process.on('uncaughtException', (err) => {
  // Socket teardown races are routine here and must not kill the dev server.
  if (['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED'].includes(err?.code)) return
  throw err
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    next.kill()
    process.exit(0)
  })
}
