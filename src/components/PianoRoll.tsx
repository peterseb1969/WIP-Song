import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { midiToNoteName, type NoteEvent } from '../lib/music'

export interface PianoRollScale {
  xOfMs: (ms: number) => number
  yOfMidi: (midi: number) => number
  rowHeight: number
  width: number
  height: number
}

interface PianoRollProps {
  events: NoteEvent[]
  /** Playhead position; also highlights the sounding note. */
  currentMs?: number | null
  /** Index of the user-selected note (fretboard sync). */
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  /** Extra SVG layers drawn in the same coordinate space (live pitch trace). */
  renderOverlay?: (scale: PianoRollScale) => ReactNode
  /** Horizontal zoom in pixels per second. */
  pxPerSecond?: number
}

const ROW = 12 // px per semitone
const PAD_SEMITONES = 2
const LABEL_W = 44 // left gutter for note names

/**
 * Piano-roll renderer for canonical note events: time → x, MIDI pitch → y.
 * One renderer, three uses (DESIGN.md): song preview, practice target +
 * live-trace surface (via renderOverlay), attempt review.
 */
export default function PianoRoll({
  events,
  currentMs = null,
  selectedIndex = null,
  onSelect,
  renderOverlay,
  pxPerSecond = 80,
}: PianoRollProps) {
  const { minMidi, maxMidi, durationMs } = useMemo(() => {
    if (!events.length) return { minMidi: 57, maxMidi: 72, durationMs: 1000 }
    let lo = Infinity, hi = -Infinity, end = 0
    for (const e of events) {
      lo = Math.min(lo, e.midi)
      hi = Math.max(hi, e.midi)
      end = Math.max(end, e.start_ms + e.duration_ms)
    }
    return { minMidi: lo - PAD_SEMITONES, maxMidi: hi + PAD_SEMITONES, durationMs: end }
  }, [events])

  const width = LABEL_W + Math.max(300, (durationMs / 1000) * pxPerSecond) + 8
  const rows = maxMidi - minMidi + 1
  const height = rows * ROW + 18 // + syllable strip

  const xOfMs = (ms: number) => LABEL_W + (ms / 1000) * pxPerSecond
  const yOfMidi = (midi: number) => (maxMidi - midi) * ROW

  const scale: PianoRollScale = { xOfMs, yOfMidi, rowHeight: ROW, width, height }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-surface">
      <svg width={width} height={height} role="img" aria-label="Melody piano roll">
        {/* Row guides: line per C, soft fill on black-key rows */}
        {Array.from({ length: rows }, (_, i) => {
          const midi = maxMidi - i
          const isBlack = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
          const isC = midi % 12 === 0
          return (
            <g key={midi}>
              {isBlack && (
                <rect x={LABEL_W} y={i * ROW} width={width - LABEL_W} height={ROW} fill="#F8FAFC" />
              )}
              {isC && (
                <line x1={LABEL_W} y1={(i + 1) * ROW} x2={width} y2={(i + 1) * ROW} stroke="#E2E8F0" />
              )}
              {(isC || midi % 12 === 7) && (
                <text x={LABEL_W - 6} y={i * ROW + ROW - 3} textAnchor="end" fontSize={9} fill="#999999">
                  {midiToNoteName(midi)}
                </text>
              )}
            </g>
          )
        })}

        {/* Note bars */}
        {events.map((e, i) => {
          const isSounding =
            currentMs != null && currentMs >= e.start_ms && currentMs < e.start_ms + e.duration_ms
          const isSelected = selectedIndex === i
          return (
            <g key={i} onClick={onSelect ? () => onSelect(i) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
              <rect
                x={xOfMs(e.start_ms)}
                y={yOfMidi(e.midi) + 1.5}
                width={Math.max(3, (e.duration_ms / 1000) * pxPerSecond - 1)}
                height={ROW - 3}
                rx={3}
                fill={isSounding ? '#ED7D31' : isSelected ? '#1E3F6F' : '#2B579A'}
              />
              {e.syllable && (
                <text x={xOfMs(e.start_ms)} y={height - 5} fontSize={10} fill="#666666">
                  {e.syllable}
                </text>
              )}
            </g>
          )
        })}

        {/* Playhead */}
        {currentMs != null && (
          <line x1={xOfMs(currentMs)} y1={0} x2={xOfMs(currentMs)} y2={height} stroke="#ED7D31" strokeWidth={1.5} />
        )}

        {renderOverlay?.(scale)}
      </svg>
    </div>
  )
}
