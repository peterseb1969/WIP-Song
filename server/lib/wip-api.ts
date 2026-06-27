/**
 * Server-side WIP API client — direct HTTP to the WIP backend with API-key
 * injection. Pattern from APP-CT (clintrial-explorer/server/lib/wip-api.ts).
 *
 * TLS note: WIP dev installs use a self-signed cert. NODE_TLS_REJECT_UNAUTHORIZED=0
 * is set by the `dev:server` script only — never here, so production keeps
 * certificate verification.
 */

const WIP_BASE_URL = process.env.WIP_BASE_URL || 'https://localhost:8443'
const WIP_API_KEY = process.env.WIP_API_KEY || ''
const NAMESPACE = process.env.WIP_NAMESPACE || 'dev-wip-song'

function headers(contentType = 'application/json'): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-API-Key': WIP_API_KEY,
  }
}

async function parseOrThrow(res: Response, what: string): Promise<unknown> {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch { /* ignore */ }
    throw new Error(`WIP ${what}: ${res.status} ${res.statusText} ${detail}`)
  }
  return res.json()
}

export async function wipGet(path: string): Promise<unknown> {
  const res = await fetch(`${WIP_BASE_URL}${path}`, { headers: headers() })
  return parseOrThrow(res, `GET ${path}`)
}

export async function wipPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${WIP_BASE_URL}${path}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  })
  return parseOrThrow(res, `POST ${path}`)
}

export async function wipPut(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${WIP_BASE_URL}${path}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(body),
  })
  return parseOrThrow(res, `PUT ${path}`)
}

/**
 * POST returning only the HTTP status, never throwing — for permission
 * probes where we care about 403-vs-not, not the body. Returns 0 on a
 * network error so callers can distinguish "couldn't reach" from a real
 * verdict and avoid false-blocking.
 */
export async function wipPostStatus(path: string, body: unknown): Promise<number> {
  try {
    const res = await fetch(`${WIP_BASE_URL}${path}`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    })
    return res.status
  } catch {
    return 0
  }
}

export async function wipPatch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${WIP_BASE_URL}${path}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(body),
  })
  return parseOrThrow(res, `PATCH ${path}`)
}

/**
 * Upload a binary file. Pass the real MIME type via opts.contentType —
 * audio/* is accepted since CASE-448 landed; octet-stream remains the
 * fallback for genuinely untyped bytes.
 */
export async function wipUploadFile(
  fileBuffer: Buffer,
  filename: string,
  opts: { description?: string; tags?: string; category?: string; contentType?: string } = {},
): Promise<{ file_id: string }> {
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([new Uint8Array(fileBuffer)], { type: opts.contentType || 'application/octet-stream' }),
    filename,
  )
  formData.append('namespace', NAMESPACE)
  if (opts.description) formData.append('description', opts.description)
  if (opts.tags) formData.append('tags', opts.tags)
  if (opts.category) formData.append('category', opts.category)

  const res = await fetch(`${WIP_BASE_URL}/api/document-store/files`, {
    method: 'POST',
    headers: { 'X-API-Key': WIP_API_KEY },
    body: formData,
  })
  const result = (await parseOrThrow(res, 'file upload')) as Record<string, unknown>
  const item = (Array.isArray(result) ? result[0] : result) as { file_id?: string; id?: string }
  return { file_id: (item.file_id || item.id) as string }
}

/** Template ID + version cache (explicit version pins per PoNIF #6). */
const templateCache = new Map<string, { id: string; version: number }>()

export async function resolveTemplate(value: string): Promise<{ id: string; version: number }> {
  const cached = templateCache.get(value)
  if (cached) return cached
  const data = (await wipGet(
    `/api/template-store/templates/by-value/${value}?namespace=${NAMESPACE}`,
  )) as { template_id: string; version: number }
  const entry = { id: data.template_id, version: data.version }
  templateCache.set(value, entry)
  return entry
}

export function clearTemplateCache(): void {
  templateCache.clear()
}

export { NAMESPACE, WIP_BASE_URL }
