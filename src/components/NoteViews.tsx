import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PianoRoll, { type PianoRollScale } from './PianoRoll'
import Fretboard from './Fretboard'
import { useSinger } from '../contexts/SingerContext'
import type { NoteEvent } from '../lib/music'

type ViewMode = 'piano' | 'fretboard' | 'both'

interface NoteViewsProps {
  events: NoteEvent[]
  currentMs?: number | null
  /** Show prev/next note stepping controls (song detail). */
  stepping?: boolean
  renderOverlay?: (scale: PianoRollScale) => ReactNode
  pxPerSecond?: number
  /** Open-string MIDI low → high (Guitar Pro imports) — drives the fretboard. */
  tuning?: number[]
}

/**
 * The combined melody display: piano roll and/or guitar fretboard, with the
 * singer's preferred view as the default. Selecting a note in the roll (or
 * stepping) drives the fretboard.
 */
export default function NoteViews({ events, currentMs = null, stepping = false, renderOverlay, pxPerSecond, tuning }: NoteViewsProps) {
  const { singerData } = useSinger()
  const [view, setView] = useState<ViewMode>(singerData?.preferences?.note_view || 'both')
  const [selected, setSelected] = useState<number | null>(events.length ? 0 : null)

  // Fretboard target: explicit selection, else the note sounding at the playhead.
  const soundingIndex =
    currentMs != null
      ? events.findIndex((e) => currentMs >= e.start_ms && currentMs < e.start_ms + e.duration_ms)
      : -1
  const fretIndex = soundingIndex >= 0 ? soundingIndex : selected
  const fretEvent = fretIndex != null && fretIndex >= 0 ? events[fretIndex] : undefined
  const fretMidi = fretEvent?.midi ?? null
  // Exact tab position (Guitar Pro imports) beats midi-derived alternatives.
  const fretExact =
    fretEvent?.string != null && fretEvent.fret != null
      ? { string: fretEvent.string, fret: fretEvent.fret }
      : null

  const step = (delta: number) =>
    setSelected((s) => {
      if (!events.length) return null
      const next = Math.min(events.length - 1, Math.max(0, (s ?? 0) + delta))
      return next
    })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['piano', 'fretboard', 'both'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                view === mode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-surface text-text-muted hover:bg-gray-50'
              }`}
            >
              {mode === 'piano' ? 'Piano roll' : mode === 'fretboard' ? 'Fretboard' : 'Both'}
            </button>
          ))}
        </div>
        {stepping && view !== 'piano' && events.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous note"
              className="rounded-md p-1 text-text-muted hover:bg-primary/5 hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-text-muted">
              note {(selected ?? 0) + 1}/{events.length}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next note"
              className="rounded-md p-1 text-text-muted hover:bg-primary/5 hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {(view === 'piano' || view === 'both') && (
        <PianoRoll
          events={events}
          currentMs={currentMs}
          selectedIndex={selected}
          onSelect={setSelected}
          renderOverlay={renderOverlay}
          pxPerSecond={pxPerSecond}
        />
      )}
      {(view === 'fretboard' || view === 'both') && (
        <Fretboard midi={fretMidi} exact={fretExact} {...(tuning?.length ? { tuning } : {})} />
      )}
    </div>
  )
}
