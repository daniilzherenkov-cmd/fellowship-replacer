/**
 * Browser side of Web Push: register the worker, subscribe, hand the
 * subscription to the server.
 *
 * Pure of React so the encoding rules can be unit tested; they are the part
 * most likely to be wrong and the hardest to debug from a silent failure.
 */

/**
 * VAPID keys travel as base64url but `atob` wants standard base64 with
 * padding, and PushManager wants raw bytes. Getting this wrong fails with an
 * opaque DOMException rather than anything that names the cause.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  // Backed by a real ArrayBuffer, not a SharedArrayBuffer: PushManager's
  // applicationServerKey requires the narrower type.
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** Extract the two keys the server needs, base64url encoded. */
export function encodeSubscription(sub: PushSubscription): {
  endpoint: string
  p256dh: string
  authSecret: string
} {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    authSecret: json.keys?.auth ?? '',
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}
