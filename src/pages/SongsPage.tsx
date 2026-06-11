import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { Loader2, ListMusic, Upload, AlertTriangle } from 'lucide-react'
import ImportDialog from '../components/ImportDialog'
import type { SongData } from '../lib/types'

function Badge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'neutral' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-text-muted'
      }`}
    >
      {children}
    </span>
  )
}

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : undefined)

export default function SongsPage() {
  const [importing, setImporting] = useState(false)
  // useQueryDocuments, not useDocuments: the plain list endpoint returns every
  // document VERSION as its own row (a song edited once appears twice); the
  // query endpoint returns latest versions only.
  const { data, isLoading, error } = useQueryDocuments({
    template_id: 'SONG_TRACK',
    filters: [],
    sort_by: 'data.title',
    sort_order: 'asc',
    page_size: 50,
  })

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Songs</h1>
          <p className="mt-1 text-sm text-text-muted">Your song library.</p>
        </div>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Import</span>
        </button>
      </header>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}

      {isLoading && (
        <div className="flex items-center gap-3 py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading songs…
        </div>
      )}

      {error != null && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{(error as Error).message}</p>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ListMusic className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-base font-medium text-text">No songs yet</p>
          <p className="mt-1 text-sm text-text-muted">Import a karaoke or MIDI file to get started (coming in phase 4).</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((doc) => {
          const song = doc.data as unknown as SongData
          return (
            <Link
              key={doc.document_id}
              to={`/songs/${doc.document_id}`}
              className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <h3 className="text-lg font-semibold text-text">{song.title}</h3>
              <p className="text-sm text-text-muted">{song.artist}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pretty(song.genre) && <Badge>{pretty(song.genre)}</Badge>}
                {pretty(song.difficulty) && <Badge tone="neutral">{pretty(song.difficulty)}</Badge>}
                {song.duration_seconds != null && (
                  <Badge tone="neutral">
                    {Math.floor(song.duration_seconds / 60)}:{String(Math.round(song.duration_seconds % 60)).padStart(2, '0')}
                  </Badge>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
