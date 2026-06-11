/**
 * Runtime config helpers. All client URLs derive from import.meta.env.BASE_URL
 * (set by Vite from APP_BASE_PATH) so the app works identically at '/' in
 * local dev and at '/apps/song/' behind the wip-deploy ingress (CASE-370).
 */

/** Base URL with trailing slash guaranteed ('/' in dev, '/apps/song/' deployed). */
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
