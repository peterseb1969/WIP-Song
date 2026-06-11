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

export default function ImportDialog({ onClose }: { onClose: () => void }) {
  const wip = useWipClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const fileRef = useRef<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [trackIdx, setTrackIdx] = useState(0)
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
      setTrackIdx(0)
      setTitle(parsed.prefill.title)
      setArtist(parsed.prefill.artist || 'Unknown')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (!result || !fileRef.current) return
    const candidate = result.candidates[trackIdx]
    if (!candidate) return
    setSaving(true)
    setError(null)
    try {
      // 1. Original import file → WIP file storage (octet-stream, CASE-448).
      const upload = await wip.files.uploadFile(
        new Blob([await fileRef.current.arrayBuffer()], { type: 'application/octet-stream' }),
        fileRef.current.name,
        { description: `Original import — ${title}`, tags: ['import', result.sourceFormat.toLowerCase()] },
      )
      // 2. SONG_TRACK upsert (identity title+artist — re-import updates).
      const created = await wip.documents.createDocument({
        template_id: 'SONG_TRACK',
        namespace: WIP_NAMESPACE,
        data: {
          title: title.trim(),
          artist: artist.trim() || 'Unknown',
          duration_seconds: Math.round(result.durationMs / 100) / 10,
          tempo_bpm: result.tempoBpm,
          source_format: result.sourceFormat,
          original_file: upload.file_id,
          ...(result.lyricsText ? { lyrics_text: result.lyricsText } : {}),
          melody: { tempo_bpm: result.tempoBpm, events: candidate.events },
        },
        created_by: 'wip-song-app',
      })
      await queryClient.invalidateQueries({ queryKey: wipKeys.documents.all })
      onClose()
      navigate(`/songs/${created.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const candidate = result?.candidates[trackIdx]

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
              <span className="text-xs text-text-muted">UltraStar / LRC / CDG support comes later</span>
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
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Melody track</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.candidates.map((c, i) => (
                    <button
                      key={`${c.trackIndex}-${c.channel}`}
                      type="button"
                      onClick={() => setTrackIdx(i)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        trackIdx === i
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 bg-surface text-text-muted hover:bg-gray-50'
                      }`}
                    >
                      {trackIdx === i && <Check className="h-3 w-3" />}
                      {c.name} · {c.noteCount} notes · {midiToNoteName(c.minMidi)}–{midiToNoteName(c.maxMidi)}
                      {c.suggested && ' ★'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-muted">★ = looks like a vocal/melody track. Pick the line you want to sing.</p>
              </div>

              {candidate && (
                <div className="max-h-64 overflow-y-auto">
                  <NoteViews events={candidate.events} pxPerSecond={40} />
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
            disabled={!result || !title.trim() || saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save song'}
          </button>
        </div>
      </div>
    </div>
  )
}
