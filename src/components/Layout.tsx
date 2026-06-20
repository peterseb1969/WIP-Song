import { NavLink, Link, Outlet } from 'react-router-dom'
import { Music, User } from 'lucide-react'
import { WipFooter } from '@wip/react'
import AskBar from './AskBar'

const NAV_ITEMS = [
  { to: '/songs', label: 'Songs' },
  { to: '/lessons', label: 'Lessons' },
  { to: '/practice', label: 'Practice' },
  { to: '/progress', label: 'Progress' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-gray-200 bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-primary">
              <Music className="h-5 w-5" />
              <span className="text-lg font-semibold tracking-tight">WIP-Song</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-muted hover:bg-primary/5 hover:text-text'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <NavLink
            to="/profile"
            aria-label="Profile"
            className={({ isActive }) =>
              `flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-primary/5 hover:text-text'
              }`
            }
          >
            <User className="h-5 w-5" />
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <WipFooter
        appName="WIP-Song"
        buildStamp={import.meta.env.VITE_BUILD_STAMP}
        buildSha={import.meta.env.VITE_BUILD_SHA}
      />
      <AskBar />
    </div>
  )
}
