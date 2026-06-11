import { Link } from 'react-router-dom'
import { useQueryDocuments } from '@wip/react'
import { ListMusic, GraduationCap, TrendingUp, Play } from 'lucide-react'
import { useSinger } from '../contexts/SingerContext'
import type { LessonData, ProgressData } from '../lib/types'

const SECTIONS = [
  {
    to: '/songs',
    icon: ListMusic,
    title: 'Songs',
    description: 'Browse the song library, import karaoke files, and play backing tracks.',
  },
  {
    to: '/lessons',
    icon: GraduationCap,
    title: 'Lessons',
    description: 'Work through exercise sequences — pitch matching, scales, song sections.',
  },
  {
    to: '/progress',
    icon: TrendingUp,
    title: 'Progress',
    description: 'Review past attempts, listen to recordings, and watch your scores improve.',
  },
]

export default function HomePage() {
  const { singerData, singerId } = useSinger()
  const started = useQueryDocuments({
    template_id: 'SONG_PROGRESS',
    filters: singerId
      ? [
          { field: 'data.singer_ref', operator: 'eq', value: singerId },
          { field: 'data.status', operator: 'eq', value: 'STARTED' },
        ]
      : [],
    page_size: 1,
  })
  const lessonRef = (started.data?.items[0]?.data as unknown as ProgressData | undefined)?.lesson_ref
  const { data: lessonDocs } = useQueryDocuments({ template_id: 'SONG_LESSON', filters: [], page_size: 100 })
  const inProgressLesson = lessonRef
    ? (lessonDocs?.items.find((d) => d.document_id === lessonRef)?.data as unknown as LessonData | undefined)
    : undefined

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Welcome{singerData ? `, ${singerData.display_name}` : ' to WIP-Song'}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Sing, get instant feedback, and track your progress — lesson by lesson.
        </p>
      </header>

      {lessonRef && (
        <Link
          to={`/lessons/${lessonRef}`}
          className="mb-6 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <div>
            <h3 className="font-medium text-primary">Continue practicing</h3>
            <p className="mt-1 text-sm text-text-muted">
              {inProgressLesson?.title ?? 'Your lesson in progress'}
              {(() => {
                const p = started.data?.items[0]?.data as unknown as ProgressData | undefined
                return p
                  ? ` — ${p.completed_exercise_codes?.length ?? 0}/${inProgressLesson?.exercise_refs.length ?? '?'} exercises, best ${p.best_score ?? '—'}`
                  : ''
              })()}
            </p>
          </div>
          <Play className="h-5 w-5 shrink-0 text-primary" />
        </Link>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ to, icon: Icon, title, description }) => (
          <Link
            key={to}
            to={to}
            className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-2 text-lg font-semibold text-text">{title}</h3>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
