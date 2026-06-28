import { useSyncExternalStore } from 'react'
import { AUTHORING_ENABLED as ENV_DEFAULT } from './config'

/**
 * Runtime toggle for curriculum authoring — persisted in localStorage so it
 * can be flipped from the Settings page with no env juggling. Falls back to
 * the build-time VITE_AUTHORING_ENABLED default when never set.
 *
 * Reactive via useSyncExternalStore so nav/routes update the instant it's
 * toggled (and across tabs, via the storage event).
 */
const KEY = 'wip-song:authoring-enabled'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? ENV_DEFAULT : v === 'true'
  } catch {
    return ENV_DEFAULT
  }
}

export function setAuthoringEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, String(on))
  } catch {
    /* ignore storage failures */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** Reactive authoring-enabled flag for components (nav, routes, shortcuts). */
export function useAuthoringEnabled(): boolean {
  return useSyncExternalStore(subscribe, read, () => ENV_DEFAULT)
}
