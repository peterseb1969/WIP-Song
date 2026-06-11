/**
 * Data-layer tests against a live WIP instance (Guide 7). Uses the runtime
 * key from .env directly. Skipped (not failed) when WIP is unreachable, so
 * unit tests stay green offline. Test docs are written into the dev
 * namespace under the zz-test-suite-* prefix.
 */
import { describe, it, expect } from 'vitest'
import 'dotenv/config'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // self-signed dev cert

const BASE = process.env.WIP_BASE_URL || 'https://localhost:8443'
const KEY = process.env.WIP_API_KEY || ''
const NS = process.env.WIP_NAMESPACE || 'dev-wip-song'

async function wip(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return { status: res.status, json: await res.json() }
}

// Reachability probe at module load — skipIf conditions are evaluated at
// collection time, so a beforeAll-set flag arrives too late.
const reachable = await (async () => {
  try {
    const r = await fetch(`${BASE}/api/registry/namespaces`, { headers: { 'X-API-Key': KEY } })
    return r.ok
  } catch {
    return false
  }
})()

describe('WIP data layer (live)', () => {
  it.skipIf(!reachable)('creates and versions a document via identity upsert (PoNIF #3)', async () => {
    const make = (description: string) => ({
      template_id: 'SONG_EXERCISE',
      namespace: NS,
      data: {
        code: 'zz-test-suite-drill',
        title: 'Test-suite drill',
        exercise_type: 'PITCH_MATCH',
        description,
        target_notes: { events: [{ midi: 60, start_ms: 0, duration_ms: 500 }] },
      },
      created_by: 'wip-song-test-suite',
    })
    const r1 = await wip('POST', '/api/document-store/documents', [make('first write')])
    expect(r1.status).toBe(200)
    const i1 = r1.json.results[0]
    expect(['created', 'updated']).toContain(i1.status)

    const r2 = await wip('POST', '/api/document-store/documents', [make(`changed ${Date.now()}`)])
    const i2 = r2.json.results[0]
    expect(i2.status).toBe('updated')
    expect(i2.document_id).toBe(i1.document_id)
    expect(i2.version).toBe(i1.version + 1)
    expect(i2.is_new).toBe(false)
  })

  it.skipIf(!reachable)('rejects an invalid term value with a per-item error (PoNIF #4)', async () => {
    const r = await wip('POST', '/api/document-store/documents', [
      {
        template_id: 'SONG_EXERCISE',
        namespace: NS,
        data: { code: 'zz-test-suite-bad-term', title: 'x', exercise_type: 'NOT_A_REAL_TYPE' },
        created_by: 'wip-song-test-suite',
      },
    ])
    expect(r.status).toBe(200) // bulk-first: HTTP 200 even on failure
    expect(r.json.results[0].status).toBe('error')
    expect(r.json.results[0].error).toMatch(/not valid for terminology/i)
  })

  it.skipIf(!reachable)('rejects an unresolvable document reference', async () => {
    const r = await wip('POST', '/api/document-store/documents', [
      {
        template_id: 'SONG_EXERCISE',
        namespace: NS,
        data: {
          code: 'zz-test-suite-bad-ref',
          title: 'x',
          exercise_type: 'SONG_SECTION',
          song_ref: '00000000-0000-7000-8000-000000000000',
        },
        created_by: 'wip-song-test-suite',
      },
    ])
    expect(r.json.results[0].status).toBe('error')
  })

  it.skipIf(!reachable)('queries latest-only documents by template and field filter', async () => {
    const r = await wip('POST', '/api/document-store/documents/query', {
      template_id: 'SONG_EXERCISE',
      filters: [{ field: 'data.code', operator: 'eq', value: 'zz-test-suite-drill' }],
      page_size: 5,
    })
    expect(r.status).toBe(200)
    expect(r.json.total).toBe(1) // latest version only, not one row per version
    expect(r.json.items[0].data.title).toBe('Test-suite drill')
  })
})
