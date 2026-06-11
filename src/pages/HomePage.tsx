import { Link } from 'react-router-dom'
import { ListMusic, GraduationCap, TrendingUp } from 'lucide-react'

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
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Welcome to WIP-Song</h1>
        <p className="mt-1 text-sm text-text-muted">
          Sing, get instant feedback, and track your progress — lesson by lesson.
        </p>
      </header>

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
