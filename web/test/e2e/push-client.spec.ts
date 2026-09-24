/**
 * VAPID key decoding. Pure, no browser.
 *
 * A wrong conversion here fails as an opaque DOMException from
 * PushManager.subscribe with no indication of the cause, so it is worth
 * pinning down exactly.
 */

import { test, expect } from '@playwright/test'
import { urlBase64ToUint8Array } from '../../src/lib/push-client'

// Node has atob globally; the function is otherwise environment-free.
test.describe('urlBase64ToUint8Array', () => {
  test('decodes a real VAPID public key to 65 bytes', () => {
    // Uncompressed P-256 public keys are always 65 bytes starting with 0x04.
    const key = 'BBDtXiGd_15xNM8VVr98jvqrEt8vKWivIhs1S4DyxVmom1hvSpNbFMfGQTkRBeKaxkKTnexegJJAE0V2V8Gwzjc'
    const out = urlBase64ToUint8Array(key)
    expect(out.length).toBe(65)
    expect(out[0]).toBe(0x04)
  })

  test('handles the base64url alphabet', () => {
    // "-" and "_" must become "+" and "/", or the bytes come out wrong
    // without any error being raised.
    const withDashes = urlBase64ToUint8Array('_-8')
    const withPlus = urlBase64ToUint8Array('/+8')
    expect([...withDashes]).toEqual([...withPlus])
  })

  test('adds the padding atob requires', () => {
    // Length 3 is not a multiple of 4; unpadded input throws in atob.
    expect(() => urlBase64ToUint8Array('abc')).not.toThrow()
  })

  test('round-trips a known value', () => {
    expect([...urlBase64ToUint8Array('AAEC')]).toEqual([0, 1, 2])
  })
})
