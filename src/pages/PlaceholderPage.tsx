import { Hammer } from 'lucide-react'

/** Stub for pages that arrive in later build phases (see DESIGN.md build order). */
export default function PlaceholderPage({ title, comingIn }: { title: string; comingIn: string }) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      </header>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Hammer className="h-10 w-10 text-text-muted" />
        <p className="mt-3 text-base font-medium text-text">Not built yet</p>
        <p className="mt-1 text-sm text-text-muted">{comingIn}</p>
      </div>
    </div>
  )
}
