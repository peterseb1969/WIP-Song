import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react'
import { useSinger } from '../contexts/SingerContext'
import { useLessonExerciseCounts } from '../lib/useLessonExercises'
import { BASE } from '../lib/config'
import type { AttemptData, ExerciseData, LessonData, ProgressData } from '../lib/types'

const fileContentUrl = (fileId: string) => `${BASE}wip/files/${fileId}/content`
const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '')

function scoreTone(v?: number) {
  if (v == null) return 'text-text-muted'
  return v >= 80 ? 'text-success' : v >= 50 ? 'text-accent' : 'text-danger'
}

export default function ProgressPage() {
  const { singerId } = useSinger()

  const attempts = useQueryDocuments({
    template_id: 'SONG_ATTEMPT',
    filters: singerId ? [{ field: 'data.singer_ref', operator: 'eq', value: singerId }] : [],
    sort_by: 'data.recorded_at',
    sort_order: 'desc',
    page_size: 50,
  })
  const progress = useQueryDocuments({
    template_id: 'SONG_PROGRESS',
    filters: singerId ? [{ field: 'data.singer_ref', operator: 'eq', value: singerId }] : [],
    page_size: 100,
  })
  const exercises = useQueryDocuments({ template_id: 'SONG_EXERCISE', filters: [], page_size: 100 })
  const lessons = useQueryDocuments({ template_id: 'SONG_LESSON', filters: [], page_size: 100 })
  const { counts: exerciseCounts } = useLessonExerciseCounts()

  const exerciseById = new Map(
    (exercises.data?.items ?? []).map((d) => [d.document_id, d.data as unknown as ExerciseData]),
  )
  const lessonById = new Map(
    (lessons.data?.items ?? []).map((d) => [d.document_id, d.data as unknown as LessonData]),
  )

  const isLoading = attempts.isLoading || progress.isLoading

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Progress</h1>
        <p className="mt-1 text-sm text-text-muted">Your attempts and lesson journey.</p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-3 py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading progress…
        </div>
      )}
      {attempts.error != null && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{(attempts.error as Error).message}</p>
        </div>
      )}

      {!isLoading && (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">Lessons</h2>
            {progress.data?.items.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {progress.data.items.map((doc) => {
                  const p = doc.data as unknown as ProgressData
                  const lesson = lessonById.get(p.lesson_ref)
                  return (
                    <Link
                      key={doc.document_id}
                      to={`/lessons/${p.lesson_ref}`}
                      className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-text">{lesson?.title ?? p.lesson_ref}</h3>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {pretty(p.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-sm text-text-muted">
                        <span>
                          best <span className={`font-medium ${scoreTone(p.best_score)}`}>{p.best_score ?? '—'}</span>
                        </span>
                        <span>{p.attempts_count ?? 0} attempts</span>
                        <span>
                          {p.completed_exercise_codes?.length ?? 0}/{exerciseCounts.get(p.lesson_ref) ?? '?'} exercises
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No lesson progress yet — start one under Lessons.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">Attempts</h2>
            {attempts.data?.items.length ? (
              <div className="space-y-2">
                {attempts.data.items.map((doc) => {
                  const a = doc.data as unknown as AttemptData
                  const ex = a.exercise_ref ? exerciseById.get(a.exercise_ref) : undefined
                  const when = a.recorded_at ? new Date(a.recorded_at).toLocaleString() : ''
                  return (
                    <div
                      key={doc.document_id}
                      className="flex flex-col gap-2 rounded-md border border-gray-200 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-text">{ex?.title ?? 'Free practice'}</span>
                        <span className="text-xs text-text-muted">{when}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-text-muted">
                          pitch <span className={`text-sm font-semibold ${scoreTone(a.pitch_score)}`}>{a.pitch_score ?? '—'}</span>
                        </span>
                        <span className="text-xs text-text-muted">
                          rhythm <span className={`text-sm font-semibold ${scoreTone(a.rhythm_score)}`}>{a.rhythm_score ?? '—'}</span>
                        </span>
                        <span className="text-xs text-text-muted">
                          overall <span className={`text-sm font-semibold ${scoreTone(a.overall_score)}`}>{a.overall_score ?? '—'}</span>
                        </span>
                        {a.recording_file && (
                          <audio controls preload="none" src={fileContentUrl(a.recording_file)} className="h-8 w-44" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="h-10 w-10 text-text-muted" />
                <p className="mt-3 text-base font-medium text-text">No attempts yet</p>
                <p className="mt-1 text-sm text-text-muted">Sing an exercise and it will show up here.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
