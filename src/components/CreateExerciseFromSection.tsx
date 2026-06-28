import { useNavigate } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { AUTHORING_ENABLED } from '../lib/config'
import type { SongData } from '../lib/types'
import type { ExercisePrefill } from '../pages/ExerciseFormPage'

/**
 * Gated authoring shortcut (P2): for each range marker on a song, offer
 * "Create exercise" — slices the song melody to the section and hands it to
 * the exercise form prefilled (song_ref + section + target_notes). Only
 * renders when authoring is enabled and the song has range markers.
 */
export default function CreateExerciseFromSection({ songId, song }: { songId: string; song: SongData }) {
  const navigate = useNavigate()
  if (!AUTHORING_ENABLED) return null

  const ranges = (song.markers ?? []).filter((m) => m.end_ms != null)
  if (!ranges.length) return null

  const create = (label: string, start: number, end: number) => {
    const events = (song.melody?.events ?? [])
      .filter((e) => e.start_ms >= start && e.start_ms < end)
      .map((e) => ({ ...e, start_ms: e.start_ms - start })) // rebase to 0
    const prefill: ExercisePrefill = {
      song_ref: songId,
      section_start_ms: start,
      section_end_ms: end,
      target_notes: { tempo_bpm: song.melody?.tempo_bpm, events },
      title: `${song.title} — ${label}`,
      exercise_type: 'SONG_SECTION',
    }
    navigate('/author/exercises/new', { state: prefill })
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold text-text">
        <Dumbbell className="h-5 w-5 text-primary" /> Create exercise from a section
      </h2>
      <ul className="divide-y rounded-lg border border-gray-200 bg-surface">
        {ranges.map((m, i) => (
          <li key={`${m.label}-${i}`} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text">
              {m.label}
              <span className="ml-2 text-xs text-text-muted">
                {(m.start_ms / 1000).toFixed(1)}s–{((m.end_ms ?? 0) / 1000).toFixed(1)}s
              </span>
            </span>
            <button
              type="button"
              onClick={() => create(m.label, m.start_ms, m.end_ms!)}
              className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Create exercise
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
