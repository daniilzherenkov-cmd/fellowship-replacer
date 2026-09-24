'use client'

/**
 * Subscribe and unsubscribe this browser for Web Push.
 *
 * Shared by the Settings panel and the first-run prompt so both go through
 * exactly the same path: register the worker, ask permission, subscribe,
 * store server side.
 */

import { useCallback, useEffect, useState } from 'react'
import { savePushSubscriptionAction, removePushSubscriptionAction } from '@/actions'
import { urlBase64ToUint8Array, encodeSubscription, pushSupported } from '@/lib/push-client'

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

export function usePushSubscription(vapidPublicKey: string) {
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    if (Notification.permission !== 'granted') {
      setState('default')
      return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const existing = await reg?.pushManager.getSubscription()
      setState(existing ? 'subscribed' : 'granted')
    } catch {
      setState('granted')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!pushSupported() || !vapidPublicKey) return false
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default')
        return false
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      // Wait for activation, or subscribe() can reject on a fresh install.
      await navigator.serviceWorker.ready

      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Required by Chrome: a push that shows nothing is not allowed.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }))

      await savePushSubscriptionAction(encodeSubscription(sub))
      setState('subscribed')
      return true
    } catch {
      await refresh()
      return false
    } finally {
      setBusy(false)
    }
  }, [vapidPublicKey, refresh])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('granted')
    } catch {
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [refresh])

  return { state, busy, subscribe, unsubscribe, refresh }
}
