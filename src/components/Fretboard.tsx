import { fretPositions, midiToNoteName, GUITAR_TUNING_MIDI } from '../lib/music'

const MAX_FRET = 15
const MARKER_FRETS = [3, 5, 7, 9, 12, 15]

interface FretboardProps {
  /** Note to locate on the neck. All playable positions shown; lowest fret emphasized. */
  midi?: number | null
  /** Exact position from the source tab (Guitar Pro): shown as THE position, alternatives faint. */
  exact?: { string: number; fret: number } | null
  /** Open-string MIDI low → high; defaults to standard EADGBE. Drives labels and string count. */
  tuning?: readonly number[]
}

const W = 720
const NUT_X = 36
const TOP = 18

/**
 * Guitar fretboard showing where a target note lives on the neck. Uniform
 * fret spacing — clarity over luthier realism. With an `exact` position
 * (Guitar Pro imports) that fret is the emphasized one regardless of
 * alternatives; supports non-6-string tunings (e.g. bass tracks).
 */
export default function Fretboard({ midi = null, exact = null, tuning = GUITAR_TUNING_MIDI }: FretboardProps) {
  const stringCount = tuning.length
  const stringGap = stringCount > 1 ? 88 / (stringCount - 1) : 0
  const H = TOP + (stringCount - 1) * stringGap + 44
  const FRET_W = (W - NUT_X - 10) / MAX_FRET

  const positions = midi != null ? fretPositions(midi, MAX_FRET, tuning) : []
  const lowestFret = positions.length ? Math.min(...positions.map((p) => p.fret)) : null
  const isPrimaryPos = (string: number, fret: number) =>
    exact ? string === exact.string && fret === exact.fret : fret === lowestFret
  // The exact position might not be in `positions` (alternate tuning vs midi mismatch) — render it regardless.
  const allPositions =
    exact && !positions.some((p) => p.string === exact.string && p.fret === exact.fret)
      ? [...positions, exact]
      : positions

  // String 0 (lowest) drawn at the BOTTOM, like tab.
  const yOfString = (string: number) => TOP + (stringCount - 1 - string) * stringGap

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-surface p-2">
      <svg width={W} height={H} role="img" aria-label="Guitar fretboard">
        {/* Nut */}
        <rect x={NUT_X - 4} y={TOP - 6} width={4} height={(stringCount - 1) * stringGap + 12} fill="#333333" />

        {/* Frets */}
        {Array.from({ length: MAX_FRET }, (_, f) => {
          const x = NUT_X + (f + 1) * FRET_W
          return <line key={f} x1={x} y1={TOP - 6} x2={x} y2={TOP + (stringCount - 1) * stringGap + 6} stroke="#CBD5E1" />
        })}

        {/* Fret markers + numbers */}
        {MARKER_FRETS.map((f) => {
          const x = NUT_X + (f - 0.5) * FRET_W
          const cy = TOP + ((stringCount - 1) / 2) * stringGap
          return (
            <g key={f}>
              {f === 12 ? (
                <>
                  <circle cx={x} cy={cy - stringGap} r={3.5} fill="#E2E8F0" />
                  <circle cx={x} cy={cy + stringGap} r={3.5} fill="#E2E8F0" />
                </>
              ) : (
                <circle cx={x} cy={cy} r={3.5} fill="#E2E8F0" />
              )}
              <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#999999">{f}</text>
            </g>
          )
        })}

        {/* Strings (thicker = lower) + names from the tuning */}
        {tuning.map((open, string) => {
          const y = yOfString(string)
          const name = midiToNoteName(open).replace(/-?\d+$/, '')
          return (
            <g key={string}>
              <line
                x1={NUT_X - 4}
                y1={y}
                x2={W - 6}
                y2={y}
                stroke="#94A3B8"
                strokeWidth={1 + (stringCount - 1 - string) * 0.3}
              />
              <text x={NUT_X - 12} y={y + 3} textAnchor="end" fontSize={10} fill="#999999">
                {string === stringCount - 1 ? name.toLowerCase() : name}
              </text>
            </g>
          )
        })}

        {/* Note positions */}
        {allPositions.map(({ string, fret }) => {
          if (string < 0 || string >= stringCount || fret < 0 || fret > MAX_FRET) return null
          const isPrimary = isPrimaryPos(string, fret)
          const x = fret === 0 ? NUT_X - 14 : NUT_X + (fret - 0.5) * FRET_W
          const y = yOfString(string)
          return (
            <g key={`${string}-${fret}`} opacity={exact && !isPrimary ? 0.45 : 1}>
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
            {exact
              ? ` — string ${exact.string + 1}, fret ${exact.fret} (from the tab)`
              : positions.length
                ? ` — ${positions.length} position${positions.length > 1 ? 's' : ''}, lowest at fret ${lowestFret}`
                : ' — outside range (' + midiToNoteName(tuning[0]!) + '–' + midiToNoteName(tuning[tuning.length - 1]! + MAX_FRET) + ')'}
          </>
        ) : (
          'Select a note to see it on the neck.'
        )}
      </p>
    </div>
  )
}
