/**
 * Runtime config helpers. All client URLs derive from import.meta.env.BASE_URL,
 * which is Vite's default '/': the app is served at the root of its own origin.
 */

/** Base URL with trailing slash guaranteed ('/'). */
export const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/'

/** URL for the Express app API: apiUrl('/health') → '<base>api/health' */
export function apiUrl(path: string): string {
  return `${BASE}api${path}`
}

/** URL for server-side routes: serverApiUrl('/bootstrap/status') → '<base>server-api/bootstrap/status' */
export function serverApiUrl(path: string): string {
  return `${BASE}server-api${path}`
}

/** Base URL for @wip/client through the server-side proxy (@wip/proxy). */
export const WIP_PROXY_BASE = `${BASE}wip`

/**
 * WIP namespace for document writes. The runtime API key is single-namespace
 * scoped (the server derives it automatically), but @wip/client's request
 * types require it explicitly. Keep in sync with the server's WIP_NAMESPACE.
 */
export const WIP_NAMESPACE = import.meta.env.VITE_WIP_NAMESPACE || 'dev-wip-song'

/**
 * Curriculum authoring (create/edit lessons & exercises) is gated so a future
 * learner-facing build hides it. Off by default; set VITE_AUTHORING_ENABLED=true
 * (build-time) to expose the Author section in nav + routes.
 */
export const AUTHORING_ENABLED = import.meta.env.VITE_AUTHORING_ENABLED === 'true'
