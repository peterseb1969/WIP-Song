import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { Loader2, GraduationCap, Dumbbell, Plus, Pencil } from 'lucide-react'
import type { ExerciseData, LessonData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '')

/**
 * Curriculum authoring hub (gated by AUTHORING_ENABLED). Entry point for
 * creating/editing lessons and exercises. Exercises can also be authored from
 * a song's section on the song detail page.
 */
export default function AuthorHubPage() {
  const lessons = useQueryDocuments({
    template_id: 'SONG_LESSON',
    filters: [],
    sort_by: 'data.code',
    sort_order: 'asc',
    page_size: 100,
  })
  const exercises = useQueryDocuments({
    template_id: 'SONG_EXERCISE',
    filters: [],
    sort_by: 'data.code',
    sort_order: 'asc',
    page_size: 100,
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Author</h1>
        <p className="mt-1 text-sm text-text-muted">Create and edit the curriculum — lessons and exercises.</p>
      </header>

      {/* Lessons */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <GraduationCap className="h-5 w-5 text-primary" /> Lessons
          </h2>
          <Link
            to="/author/lessons/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Plus className="h-4 w-4" /> New lesson
          </Link>
        </div>
        {lessons.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (lessons.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">No lessons yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border border-gray-200 bg-surface">
            {lessons.data?.items.map((doc) => {
              const l = doc.data as unknown as LessonData
              return (
                <li key={doc.document_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{l.title}</p>
                    <p className="text-xs text-text-muted">{l.code}{pretty(l.difficulty) ? ` · ${pretty(l.difficulty)}` : ''}</p>
                  </div>
                  <Link
                    to={`/author/lessons/${doc.document_id}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Exercises */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <Dumbbell className="h-5 w-5 text-primary" /> Exercises
          </h2>
          <Link
            to="/author/exercises/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Plus className="h-4 w-4" /> New drill
          </Link>
        </div>
        <p className="mb-3 text-xs text-text-muted">Tip: create an exercise from a song section on the song's page.</p>
        {exercises.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (exercises.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">No exercises yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border border-gray-200 bg-surface">
            {exercises.data?.items.map((doc) => {
              const e = doc.data as unknown as ExerciseData
              return (
                <li key={doc.document_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{e.title}</p>
                    <p className="text-xs text-text-muted">{e.code} · {pretty(e.exercise_type)}{pretty(e.difficulty) ? ` · ${pretty(e.difficulty)}` : ''}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
