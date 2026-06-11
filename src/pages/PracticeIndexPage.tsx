import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { Loader2, Mic, AlertTriangle } from 'lucide-react'
import type { ExerciseData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '')

export default function PracticeIndexPage() {
  const { data, isLoading, error } = useQueryDocuments({
    template_id: 'SONG_EXERCISE',
    filters: [],
    sort_by: 'data.code',
    sort_order: 'asc',
    page_size: 100,
  })

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Practice</h1>
        <p className="mt-1 text-sm text-text-muted">Pick an exercise for a quick drill — or follow a lesson.</p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-3 py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading exercises…
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
          <Mic className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-base font-medium text-text">No exercises yet</p>
          <p className="mt-1 text-sm text-text-muted">Exercises are seeded with lessons.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((doc) => {
          const ex = doc.data as unknown as ExerciseData
          return (
            <Link
              key={doc.document_id}
              to={`/practice/${doc.document_id}`}
              className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text">{ex.title}</h3>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {pretty(ex.exercise_type)}
                </span>
              </div>
              {ex.description && <p className="mt-2 text-sm text-text-muted">{ex.description}</p>}
              {ex.difficulty && <p className="mt-2 text-xs text-text-muted">{pretty(ex.difficulty)}</p>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
