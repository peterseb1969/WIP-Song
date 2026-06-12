import { useState } from 'react'
import { useCreateDocument, useUpdateDocument } from '@wip/react'
import { Loader2, Plus, Trash2, AlertTriangle, Flag } from 'lucide-react'
import { WIP_NAMESPACE } from '../lib/config'
import type { Marker, SongData } from '../lib/types'

const fmtMs = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
/** Accepts "m:ss", "m:ss.t", or plain seconds. Returns ms, or null on junk. */
const parseTime = (text: string): number | null => {
  const t = text.trim()
  if (!t) return null
  const m = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(t)
  if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000)
  const sec = Number(t)
  return Number.isFinite(sec) && sec >= 0 ? Math.round(sec * 1000) : null
}

interface MarkersEditorProps {
  documentId: string
  /** Template version the document is pinned to (PATCH validates against it). */
  templateVersion: number
  song: SongData
  /** Current playhead (melody playback) — prefills a new marker's start. */
  currentMs?: number | null
}

/**
 * Marker list + add/delete for a song (SONG_TRACK v2 `markers`). Saves via
 * PATCH of just the markers field; documents still pinned to template v1
 * (pre-markers) get migrated by one full upsert onto v2 — same identity,
 * same document_id, new version (verified live; PATCH validates against the
 * document's recorded template version, so v1 docs reject unknown fields).
 */
export default function MarkersEditor({ documentId, templateVersion, song, currentMs }: MarkersEditorProps) {
  const updateDoc = useUpdateDocument()
  const createDoc = useCreateDocument()
  const markers = song.markers ?? []

  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: Marker[]) => {
    setBusy(true)
    setError(null)
    try {
      if (templateVersion >= 2) {
        await updateDoc.mutateAsync({ documentId, patch: { markers: next } })
      } else {
        // v1-pinned doc: full upsert migrates it onto v2 (same identity).
        await createDoc.mutateAsync({
          template_id: 'SONG_TRACK',
          template_version: 2,
          namespace: WIP_NAMESPACE,
          data: { ...song, markers: next } as unknown as Record<string, unknown>,
          created_by: 'wip-song-app',
        })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const addMarker = () => {
    const startMs = parseTime(start) ?? (currentMs != null ? Math.round(currentMs) : null)
    if (!label.trim() || startMs == null) {
      setError('A marker needs a label and a start time (m:ss or seconds).')
      return
    }
    const endMs = parseTime(end)
    const marker: Marker = { label: label.trim(), start_ms: startMs, ...(endMs != null && endMs > startMs ? { end_ms: endMs } : {}) }
    void save([...markers, marker].sort((a, b) => a.start_ms - b.start_ms))
    setLabel('')
    setStart('')
    setEnd('')
  }

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-text">Markers</h2>
      {markers.length > 0 && (
        <ul className="mb-3 space-y-1">
          {markers.map((m, i) => (
            <li key={`${m.label}-${m.start_ms}`} className="flex items-center gap-3 rounded-md border border-gray-200 bg-surface px-3 py-1.5 text-sm">
              <Flag className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-medium text-text">{m.label}</span>
              <span className="text-text-muted">
                {fmtMs(m.start_ms)}
                {m.end_ms != null && ` – ${fmtMs(m.end_ms)}`}
              </span>
              <button
                type="button"
                onClick={() => void save(markers.filter((_, j) => j !== i))}
                disabled={busy}
                aria-label={`Delete marker ${m.label}`}
                className="ml-auto rounded p-1 text-text-muted hover:bg-danger/5 hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/40 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="marker-label" className="text-xs font-medium uppercase tracking-wide text-text-muted">Label</label>
          <input
            id="marker-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Chorus"
            className="mt-1 block w-36 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label htmlFor="marker-start" className="text-xs font-medium uppercase tracking-wide text-text-muted">Start</label>
          <input
            id="marker-start"
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder={currentMs != null ? fmtMs(currentMs) : 'm:ss'}
            className="mt-1 block w-20 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label htmlFor="marker-end" className="text-xs font-medium uppercase tracking-wide text-text-muted">End (opt.)</label>
          <input
            id="marker-end"
            type="text"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="m:ss"
            className="mt-1 block w-20 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={addMarker}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add marker
        </button>
        <p className="basis-full text-xs text-text-muted">
          Start defaults to the playhead while the melody is playing. Markers with an end time become loop presets on the practice page.
        </p>
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </section>
  )
}
