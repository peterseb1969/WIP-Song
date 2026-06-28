import { useParams, Link } from 'react-router-dom'
import { useDocument, useQueryDocuments } from '@wip/react'
import { Loader2, ArrowLeft, AlertTriangle, Play, CheckCircle2, Circle } from 'lucide-react'
import { useSinger } from '../contexts/SingerContext'
import { useLessonExercises } from '../lib/useLessonExercises'
import type { ExerciseData, LessonData, ProgressData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '')

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { singerId } = useSinger()
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const lesson = doc?.data as LessonData | undefined

  // Exercises referenced by the lesson. Few enough to fetch the catalog and
  // join client-side (no by-ids batch endpoint in @wip/client today).
  const exercises = useQueryDocuments({ template_id: 'SONG_EXERCISE', filters: [], page_size: 100 })
  const byId = new Map((exercises.data?.items ?? []).map((d) => [d.document_id, d.data as unknown as ExerciseData]))
  // Ordered exercise ids come from SONG_LESSON_EXERCISE edges, not the doc.
  const { exerciseIds } = useLessonExercises(id)

  const progressQ = useQueryDocuments({
    template_id: 'SONG_PROGRESS',
    filters:
      singerId && id
        ? [
            { field: 'data.singer_ref', operator: 'eq', value: singerId },
            { field: 'data.lesson_ref', operator: 'eq', value: id },
          ]
        : [],
    page_size: 1,
  })
  const progress = progressQ.data?.items[0]?.data as unknown as ProgressData | undefined
  const completed = new Set(progress?.completed_exercise_codes ?? [])

  if (isLoading || exercises.isLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading lesson…
      </div>
    )
  }
  if (error != null || !lesson) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="text-sm text-danger">
          Lesson not found. <Link to="/lessons" className="text-primary hover:underline">Back to lessons</Link>
        </p>
      </div>
    )
  }

  const firstOpen = exerciseIds.find((ref) => {
    const ex = byId.get(ref)
    return ex && !completed.has(ex.code)
  })

  return (
    <div className="space-y-6">
      <div>
        <Link to="/lessons" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Lessons
        </Link>
        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">{lesson.title}</h1>
            {lesson.description && <p className="mt-1 text-sm text-text-muted">{lesson.description}</p>}
          </div>
          {firstOpen && (
            <Link
              to={`/practice/${firstOpen}?lesson=${id}`}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <Play className="h-4 w-4" /> {progress ? 'Continue' : 'Start'}
            </Link>
          )}
        </header>
      </div>

      {progress && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-medium text-primary">
            {completed.size}/{exerciseIds.length} exercises completed
            {progress.best_score != null ? ` · best score ${progress.best_score}` : ''}
            {progress.attempts_count != null ? ` · ${progress.attempts_count} attempts` : ''}
          </h3>
        </div>
      )}

      <ol className="space-y-2">
        {exerciseIds.map((ref, i) => {
          const ex = byId.get(ref)
          if (!ex) {
            return (
              <li key={ref} className="rounded-md border border-gray-200 bg-surface p-3 text-sm text-text-muted">
                Exercise {i + 1}: unresolved reference {ref}
              </li>
            )
          }
          const done = completed.has(ex.code)
          return (
            <li key={ref}>
              <Link
                to={`/practice/${ref}?lesson=${id}`}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-surface p-3 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-text-muted" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">
                      {i + 1}. {ex.title}
                    </span>
                    <span className="text-xs text-text-muted">{pretty(ex.exercise_type)}</span>
                  </div>
                </div>
                <Play className="h-4 w-4 text-text-muted" />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
