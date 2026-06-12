import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useWipClient, wipKeys } from '@wip/react'
import { X, Upload, Loader2, AlertTriangle, Check } from 'lucide-react'
import NoteViews from './NoteViews'
import { serverApiUrl, WIP_NAMESPACE } from '../lib/config'
import { midiToNoteName, type NoteEvent } from '../lib/music'

interface Candidate {
  trackIndex: number
  channel: number
  name: string
  noteCount: number
  minMidi: number
  maxMidi: number
  suggested: boolean
  events: NoteEvent[]
}

interface ParseResult {
  durationMs: number
  tempoBpm: number
  hasLyrics: boolean
  lyricsText?: string
  sourceFormat: string
  prefill: { title: string; artist: string }
  candidates: Candidate[]
}

/**
 * Per-track titles for a multi-track import. SONG_TRACK identity is
 * (title, artist), so every created document needs a distinct title —
 * single-track imports keep the plain title (today's behaviour), multi-track
 * imports append the track name, plus the channel when names collide.
 */
function titlesFor(base: string, tracks: Candidate[]): string[] {
  if (tracks.length <= 1) return [base]
  return tracks.map((c) => {
    const dupName = tracks.some((o) => o !== c && o.name === c.name)
    return `${base} (${c.name}${dupName ? ` · ch ${c.channel + 1}` : ''})`
  })
}

export default function ImportDialog({ onClose }: { onClose: () => void }) {
  const wip = useWipClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const fileRef = useRef<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewIdx, setPreviewIdx] = useState(0)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')

  const handleFile = async (file: File) => {
    fileRef.current = file
    setParsing(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(serverApiUrl(`/import/parse?filename=${encodeURIComponent(file.name)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      const parsed = body as ParseResult
      if (!parsed.candidates.length) throw new Error('No melody tracks found in this file.')
      setResult(parsed)
      setSelected(new Set([0]))
      setPreviewIdx(0)
      setTitle(parsed.prefill.title)
      setArtist(parsed.prefill.artist || 'Unknown')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const toggleTrack = (i: number) => {
    setPreviewIdx(i)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) {
        if (next.size === 1) return next // keep at least one track selected
        next.delete(i)
      } else {
        next.add(i)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!result || !fileRef.current) return
    const tracks = result.candidates.filter((_, i) => selected.has(i))
    if (!tracks.length) return
    setSaving(true)
    setError(null)
    try {
      // 1. Original import file → WIP file storage, once for all tracks
      // (real MIME — CASE-448 implemented; 4th arg: the file endpoint
      // requires namespace as a form field).
      const upload = await wip.files.uploadFile(
        new Blob([await fileRef.current.arrayBuffer()], { type: 'audio/midi' }),
        fileRef.current.name,
        { description: `Original import — ${title}`, tags: ['import', result.sourceFormat.toLowerCase()] },
        WIP_NAMESPACE,
      )
      // 2. One SONG_TRACK upsert per selected track (identity title+artist —
      // titlesFor keeps them distinct, re-import of the same titles updates).
      const titles = titlesFor(title.trim(), tracks)
      let firstId: string | null = null
      for (let t = 0; t < tracks.length; t++) {
        const track = tracks[t]!
        if (tracks.length > 1) setSaveProgress(`Saving ${t + 1}/${tracks.length}…`)
        const created = await wip.documents.createDocument({
          template_id: 'SONG_TRACK',
          namespace: WIP_NAMESPACE,
          data: {
            title: titles[t]!,
            artist: artist.trim() || 'Unknown',
            duration_seconds: Math.round(result.durationMs / 100) / 10,
            tempo_bpm: result.tempoBpm,
            source_format: result.sourceFormat,
            original_file: upload.file_id,
            ...(result.lyricsText ? { lyrics_text: result.lyricsText } : {}),
            melody: { tempo_bpm: result.tempoBpm, events: track.events },
          },
          created_by: 'wip-song-app',
        })
        firstId ??= created.id ?? null
      }
      await queryClient.invalidateQueries({ queryKey: wipKeys.documents.all })
      onClose()
      navigate(tracks.length === 1 ? `/songs/${firstId}` : '/songs')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
      setSaveProgress(null)
    }
  }

  const preview = result?.candidates[previewIdx]
  const selectedCount = selected.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-text">Import a song</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!result && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-10 text-center hover:border-primary/40">
              <Upload className="h-8 w-8 text-text-muted" />
              <span className="text-sm font-medium text-text">Choose a .mid or .kar file</span>
              <span className="text-xs text-text-muted">Guitar Pro / UltraStar / LRC / CDG support comes later</span>
              <input
                type="file"
                accept=".mid,.midi,.kar"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
            </label>
          )}

          {parsing && (
            <div className="flex items-center gap-3 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Parsing…
            </div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="imp-title" className="text-xs font-medium uppercase tracking-wide text-text-muted">Title</label>
                  <input
                    id="imp-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label htmlFor="imp-artist" className="text-xs font-medium uppercase tracking-wide text-text-muted">Artist</label>
                  <input
                    id="imp-artist"
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Tracks to import</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.candidates.map((c, i) => (
                    <button
                      key={`${c.trackIndex}-${c.channel}`}
                      type="button"
                      onClick={() => toggleTrack(i)}
                      aria-pressed={selected.has(i)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        selected.has(i)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 bg-surface text-text-muted hover:bg-gray-50'
                      } ${previewIdx === i ? 'ring-2 ring-primary/40' : ''}`}
                    >
                      {selected.has(i) && <Check className="h-3 w-3" />}
                      {c.name} · {c.noteCount} notes · {midiToNoteName(c.minMidi)}–{midiToNoteName(c.maxMidi)}
                      {c.suggested && ' ★'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  ★ = looks like a vocal/melody track. Click to select one or more tracks — each becomes its own
                  song{selectedCount > 1 ? ' (track names are appended to the title to keep them apart)' : ''}.
                </p>
              </div>

              {preview && (
                <div className="max-h-64 overflow-y-auto">
                  <NoteViews events={preview.events} pxPerSecond={40} />
                </div>
              )}

              <p className="text-sm text-text-muted">
                {Math.round(result.durationMs / 1000)}s · first tempo {result.tempoBpm} BPM ·{' '}
                {result.hasLyrics ? 'lyrics included' : 'no lyrics in this file'}
              </p>
            </>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!result || !title.trim() || saving || selectedCount === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? saveProgress ?? 'Saving…' : selectedCount > 1 ? `Save ${selectedCount} songs` : 'Save song'}
          </button>
        </div>
      </div>
    </div>
  )
}
