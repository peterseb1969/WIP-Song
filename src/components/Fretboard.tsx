import { fretPositions, midiToNoteName, GUITAR_TUNING_MIDI } from '../lib/music'

const MAX_FRET = 15
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] // low → high; rendered high string on top (tab convention)
const MARKER_FRETS = [3, 5, 7, 9, 12, 15]

interface FretboardProps {
  /** Note to locate on the neck. All playable positions shown; lowest fret emphasized. */
  midi?: number | null
}

const W = 720
const H = 132
const NUT_X = 36
const TOP = 18
const STRING_GAP = (H - TOP - 22) / 5
const FRET_W = (W - NUT_X - 10) / MAX_FRET

/**
 * Guitar fretboard (standard tuning EADGBE) showing where a target note
 * lives on the neck. Uniform fret spacing — clarity over luthier realism.
 */
export default function Fretboard({ midi = null }: FretboardProps) {
  const positions = midi != null ? fretPositions(midi, MAX_FRET) : []
  const lowestFret = positions.length ? Math.min(...positions.map((p) => p.fret)) : null

  // String 0 (low E) drawn at the BOTTOM, like tab.
  const yOfString = (string: number) => TOP + (5 - string) * STRING_GAP

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-surface p-2">
      <svg width={W} height={H} role="img" aria-label="Guitar fretboard">
        {/* Nut */}
        <rect x={NUT_X - 4} y={TOP - 6} width={4} height={5 * STRING_GAP + 12} fill="#333333" />

        {/* Frets */}
        {Array.from({ length: MAX_FRET }, (_, f) => {
          const x = NUT_X + (f + 1) * FRET_W
          return <line key={f} x1={x} y1={TOP - 6} x2={x} y2={TOP + 5 * STRING_GAP + 6} stroke="#CBD5E1" />
        })}

        {/* Fret markers + numbers */}
        {MARKER_FRETS.map((f) => {
          const x = NUT_X + (f - 0.5) * FRET_W
          const cy = TOP + 2.5 * STRING_GAP
          return (
            <g key={f}>
              {f === 12 ? (
                <>
                  <circle cx={x} cy={cy - STRING_GAP} r={3.5} fill="#E2E8F0" />
                  <circle cx={x} cy={cy + STRING_GAP} r={3.5} fill="#E2E8F0" />
                </>
              ) : (
                <circle cx={x} cy={cy} r={3.5} fill="#E2E8F0" />
              )}
              <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#999999">{f}</text>
            </g>
          )
        })}

        {/* Strings (thicker = lower) + names */}
        {STRING_NAMES.map((name, string) => {
          const y = yOfString(string)
          return (
            <g key={string}>
              <line x1={NUT_X - 4} y1={y} x2={W - 6} y2={y} stroke="#94A3B8" strokeWidth={1 + (5 - string) * 0.3} />
              <text x={NUT_X - 12} y={y + 3} textAnchor="end" fontSize={10} fill="#999999">{name}</text>
            </g>
          )
        })}

        {/* Note positions */}
        {positions.map(({ string, fret }) => {
          const isPrimary = fret === lowestFret
          const x = fret === 0 ? NUT_X - 14 : NUT_X + (fret - 0.5) * FRET_W
          const y = yOfString(string)
          return (
            <g key={`${string}-${fret}`}>
              <circle
                cx={x}
                cy={y}
                r={7}
                fill={isPrimary ? '#2B579A' : '#FFFFFF'}
                stroke="#2B579A"
                strokeWidth={isPrimary ? 0 : 1.5}
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill={isPrimary ? '#FFFFFF' : '#2B579A'}
              >
                {fret}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="px-2 pb-1 text-sm text-text-muted">
        {midi != null ? (
          <>
            <span className="font-medium text-text">{midiToNoteName(midi)}</span>
            {positions.length
              ? ` — ${positions.length} position${positions.length > 1 ? 's' : ''}, lowest at fret ${lowestFret}`
              : ' — outside guitar range (E2–' + midiToNoteName(GUITAR_TUNING_MIDI[5] + MAX_FRET) + ')'}
          </>
        ) : (
          'Select a note to see it on the neck.'
        )}
      </p>
    </div>
  )
}
