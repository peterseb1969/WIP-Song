import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDocument } from '@wip/react'
import { Loader2, ArrowLeft, AlertTriangle, Mic, Play, Square } from 'lucide-react'
import NoteViews from '../components/NoteViews'
import SpeedControl from '../components/SpeedControl'
import AudioTrackUpload from '../components/AudioTrackUpload'
import MarkersEditor, { useSaveMarkers } from '../components/MarkersEditor'
import CreateExerciseFromSection from '../components/CreateExerciseFromSection'
import { playNotes } from '../lib/audio'
import type { Marker, SongData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : undefined)

function Meta({ label, value }: { label: string; value?: string | number }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  )
}

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const song = doc?.data as SongData | undefined

  const markerSave = useSaveMarkers({
    documentId: doc?.document_id ?? '',
    templateVersion: doc?.template_version ?? 1,
    song: song ?? ({ title: '', artist: '' } as SongData),
  })
  const nextMarkerLabel = () => {
    let n = 1
    while ((song?.markers ?? []).some((m) => m.label === `Marker ${n}`)) n++
    return `Marker ${n}`
  }
  /** Toggle from a piano-roll click: hit an existing marker (±250 ms) →
   *  remove it; empty space → add an auto-named point marker there. */
  const toggleMarkerAt = (ms: number) => {
    if (!doc || !song || markerSave.busy) return
    const markers = song.markers ?? []
    const hit = markers.findIndex((m) => Math.abs(m.start_ms - ms) <= 250)
    if (hit >= 0) {
      void markerSave.save(markers.filter((_, i) => i !== hit))
      return
    }
    void markerSave.save(
      [...markers, { label: nextMarkerLabel(), start_ms: Math.round(ms) } as Marker].sort((a, b) => a.start_ms - b.start_ms),
    )
  }
  /** Drag on the roll → auto-named RANGE marker (loopable on the practice page). */
  const addRangeMarker = (startMs: number, endMs: number) => {
    if (!doc || !song || markerSave.busy || endMs - startMs < 150) return
    void markerSave.save(
      [...(song.markers ?? []), { label: nextMarkerLabel(), start_ms: Math.round(startMs), end_ms: Math.round(endMs) } as Marker].sort(
        (a, b) => a.start_ms - b.start_ms,
      ),
    )
  }

  // Melody synth playback (MIDI imports carry notes, not audio) with playhead.
  const [playheadMs, setPlayheadMs] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1)
  const stopSynthRef = useRef<(() => void) | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopMelody = () => {
    stopSynthRef.current?.()
    stopSynthRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlayheadMs(null)
  }
  const playMelody = () => {
    const events = song?.melody?.events
    if (!events?.length) return
    stopMelody()
    // Skip leading silence (real imports: Bohemian Rhapsody's vocals enter at ~52s).
    const firstStart = Math.min(...events.map((e) => e.start_ms))
    stopSynthRef.current = playNotes(
      events.map((e) => ({ ...e, start_ms: e.start_ms - firstStart })),
      stopMelody,
      speed,
    )
    const startedAt = performance.now()
    const tick = () => {
      // Wall-clock advances 1:1; the melody timeline advances at `speed`.
      setPlayheadMs(firstStart + (performance.now() - startedAt) * speed)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }
  useEffect(() => stopMelody, []) // stop on unmount

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading song…
      </div>
    )
  }

  if (error != null || !song) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="text-sm text-danger">
          Song not found{error != null ? ` — ${(error as Error).message}` : ''}.{' '}
          <Link to="/songs" className="text-primary hover:underline">Back to songs</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/songs" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Songs
        </Link>
        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">{song.title}</h1>
            <p className="mt-1 text-sm text-text-muted">{song.artist}</p>
          </div>
          <button
            type="button"
            disabled
            title="Practice arrives in build phase 5"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Practice</span>
          </button>
        </header>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-surface p-4 shadow-sm sm:grid-cols-4">
        <Meta label="Genre" value={pretty(song.genre)} />
        <Meta label="Difficulty" value={pretty(song.difficulty)} />
        <Meta label="Key" value={pretty(song.musical_key)} />
        <Meta label="Language" value={song.language} />
        <Meta label="Tempo" value={song.tempo_bpm ? `${song.tempo_bpm} BPM` : undefined} />
        <Meta
          label="Duration"
          value={
            song.duration_seconds != null
              ? `${Math.floor(song.duration_seconds / 60)}:${String(Math.round(song.duration_seconds % 60)).padStart(2, '0')}`
              : undefined
          }
        />
        <Meta label="Source" value={song.source_format} />
        <Meta label="Notes" value={song.melody?.events.length} />
      </dl>

      {doc && (
        <>
          <MarkersEditor
            documentId={doc.document_id}
            templateVersion={doc.template_version ?? 1}
            song={song}
            currentMs={playheadMs}
          />
          <AudioTrackUpload
            documentId={doc.document_id}
            field="audio_backing"
            label="Backing track"
            fileId={song.audio_backing}
            songTitle={song.title}
          />
          <AudioTrackUpload
            documentId={doc.document_id}
            field="audio_full"
            label="Full mix"
            fileId={song.audio_full}
            songTitle={song.title}
          />
          <CreateExerciseFromSection songId={doc.document_id} song={song} />
        </>
      )}

      {song.melody?.events.length ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text">Melody</h2>
            <div className="flex items-center gap-2">
              <SpeedControl value={speed} onChange={setSpeed} disabled={playheadMs != null} />
              {playheadMs == null ? (
                <button
                  type="button"
                  onClick={playMelody}
                  className="flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <Play className="h-4 w-4" /> Play melody
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopMelody}
                  className="flex items-center gap-2 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-danger/40"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              )}
            </div>
          </div>
          <NoteViews
            events={song.melody.events}
            stepping
            currentMs={playheadMs}
            tuning={song.melody.tuning}
            tempoBpm={song.melody.tempo_bpm ?? song.tempo_bpm}
            onTimelineClick={toggleMarkerAt}
            onTimelineDrag={addRangeMarker}
            renderOverlay={({ xOfMs, height }) =>
              (song.markers ?? []).map((m, idx) => {
                const x = xOfMs(m.start_ms)
                const flagW = Math.max(22, m.label.length * 5.5 + 12)
                return (
                  <g key={`${m.label}-${m.start_ms}`}>
                    {m.end_ms != null && (
                      <rect x={x} y={0} width={xOfMs(m.end_ms) - x} height={height} fill="#2B579A" opacity={0.06} />
                    )}
                    <line x1={x} y1={0} x2={x} y2={height} stroke="#2B579A" strokeDasharray="3 3" opacity={0.6} />
                    {/* Flag handle: fat click target at the top — click removes the marker. */}
                    <g
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!markerSave.busy) void markerSave.save((song.markers ?? []).filter((_, i) => i !== idx))
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`Remove marker "${m.label}"`}</title>
                      <rect x={x} y={0} width={flagW} height={14} rx={3} fill="#2B579A" opacity={0.92} />
                      <text x={x + 5} y={10.5} fontSize={9} fontWeight={600} fill="#FFFFFF">{m.label}</text>
                    </g>
                  </g>
                )
              })
            }
          />
          {markerSave.error && (
            <p className="mt-2 text-sm text-danger">Marker change failed: {markerSave.error}</p>
          )}
        </section>
      ) : (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-medium text-primary">No melody data</h3>
          <p className="mt-1 text-sm text-text-muted">
            This song has no parsed note events yet — re-import it from a melody-bearing format (MIDI, .kar, UltraStar).
          </p>
        </div>
      )}

      {song.lyrics_text && (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-text">Lyrics</h2>
          <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-surface p-4 font-sans text-sm text-text shadow-sm">
            {song.lyrics_text}
          </pre>
        </section>
      )}
    </div>
  )
}
