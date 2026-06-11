import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { Loader2, GraduationCap, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useSinger } from '../contexts/SingerContext'
import type { LessonData, ProgressData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : undefined)

function StatusBadge({ progress, total }: { progress?: ProgressData; total: number }) {
  if (!progress) {
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-muted">Not started</span>
  }
  const done = progress.completed_exercise_codes?.length ?? 0
  if (progress.status === 'COMPLETED' || progress.status === 'MASTERED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3 w-3" /> {pretty(progress.status)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {done}/{total} exercises
    </span>
  )
}

export default function LessonsPage() {
  const { singerId } = useSinger()
  const lessons = useQueryDocuments({
    template_id: 'SONG_LESSON',
    filters: [],
    sort_by: 'data.code',
    sort_order: 'asc',
    page_size: 100,
  })
  const progress = useQueryDocuments({
    template_id: 'SONG_PROGRESS',
    filters: singerId ? [{ field: 'data.singer_ref', operator: 'eq', value: singerId }] : [],
    page_size: 100,
  })

  const progressByLesson = new Map<string, ProgressData>(
    (progress.data?.items ?? []).map((d) => {
      const p = d.data as unknown as ProgressData
      return [p.lesson_ref, p]
    }),
  )

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Lessons</h1>
        <p className="mt-1 text-sm text-text-muted">Structured practice, one exercise sequence at a time.</p>
      </header>

      {lessons.isLoading && (
        <div className="flex items-center gap-3 py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading lessons…
        </div>
      )}
      {lessons.error != null && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{(lessons.error as Error).message}</p>
        </div>
      )}
      {lessons.data && lessons.data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GraduationCap className="h-10 w-10 text-text-muted" />
          <p className="mt-3 text-base font-medium text-text">No lessons yet</p>
          <p className="mt-1 text-sm text-text-muted">Lessons are seeded with the curriculum.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {lessons.data?.items.map((doc) => {
          const lesson = doc.data as unknown as LessonData
          const p = progressByLesson.get(doc.document_id)
          return (
            <Link
              key={doc.document_id}
              to={`/lessons/${doc.document_id}`}
              className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text">{lesson.title}</h3>
                <StatusBadge progress={p} total={lesson.exercise_refs.length} />
              </div>
              {lesson.description && <p className="mt-2 text-sm text-text-muted">{lesson.description}</p>}
              <div className="mt-3 flex gap-3 text-xs text-text-muted">
                <span>{lesson.exercise_refs.length} exercises</span>
                {pretty(lesson.difficulty) && <span>{pretty(lesson.difficulty)}</span>}
                {p?.best_score != null && <span>best {p.best_score}</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
