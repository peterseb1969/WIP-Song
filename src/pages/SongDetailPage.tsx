import { useParams, Link } from 'react-router-dom'
import { useDocument } from '@wip/react'
import { Loader2, ArrowLeft, AlertTriangle, Mic } from 'lucide-react'
import NoteViews from '../components/NoteViews'
import { BASE } from '../lib/config'
import type { SongData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : undefined)

/** Audio content via @wip/proxy's file streaming route (browser never sees the key). */
const fileContentUrl = (fileId: string) => `${BASE}wip/files/${fileId}/content`

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

      {song.audio_backing && (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-text">Backing track</h2>
          <audio controls preload="none" src={fileContentUrl(song.audio_backing)} className="w-full" />
        </section>
      )}
      {song.audio_full && (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-text">Full mix</h2>
          <audio controls preload="none" src={fileContentUrl(song.audio_full)} className="w-full" />
        </section>
      )}

      {song.melody?.events.length ? (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-text">Melody</h2>
          <NoteViews events={song.melody.events} stepping />
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
