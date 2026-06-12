import { useEffect, useMemo, useRef } from 'react'
import { midiToNoteName, type NoteEvent } from '../lib/music'

/**
 * Classical staff notation, proportional layout: five-line staff with clef,
 * note heads/stems/flags by duration, sharps, and ledger lines — but x is
 * TIME (the same scale as the piano roll), so zoom, playhead, and
 * follow-scroll behave identically across views. Deliberately not engraved
 * notation: no bar lines (time signatures aren't in the data model), no
 * beaming, no rests. Hand-rolled like PianoRoll/Fretboard — engraved
 * rendering would be a new dependency (VexFlow) and its own decision.
 */

const LABEL_W = 44
const LINE_GAP = 9 // px between staff lines; a diatonic step is half this
const STEP = LINE_GAP / 2

/** Diatonic index: C0=0, D0=1 … (7 per octave). Black keys map to their natural + sharp. */
const DIATONIC_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] // C C# D D# E F F# G G# A A# B
const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false]
const diatonic = (midi: number) => Math.floor(midi / 12 - 1) * 7 + DIATONIC_OF_PC[((midi % 12) + 12) % 12]!

interface Clef {
  symbol: string
  /** Diatonic index of the BOTTOM staff line. */
  bottomLine: number
  /** Octave hint rendered under/over the clef (8vb). */
  hint?: string
}
const TREBLE: Clef = { symbol: '\u{1D11E}', bottomLine: diatonic(64) } // bottom line E4
const TREBLE_8VB: Clef = { symbol: '\u{1D11E}', bottomLine: diatonic(52), hint: '8' } // E3 (guitar/tenor)
const BASS: Clef = { symbol: '\u{1D122}', bottomLine: diatonic(43) } // bottom line G2

interface NotationViewProps {
  events: NoteEvent[]
  currentMs?: number | null
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  pxPerSecond?: number
  /** Beat length reference for note values (quarter = 60000/bpm ms). */
  tempoBpm?: number
}

export default function NotationView({
  events,
  currentMs = null,
  selectedIndex = null,
  onSelect,
  pxPerSecond = 80,
  tempoBpm = 120,
}: NotationViewProps) {
  const { clef, durationMs, loDia, hiDia } = useMemo(() => {
    if (!events.length) return { clef: TREBLE, durationMs: 1000, loDia: TREBLE.bottomLine, hiDia: TREBLE.bottomLine + 8 }
    const midis = [...events.map((e) => e.midi)].sort((a, b) => a - b)
    const median = midis[Math.floor(midis.length / 2)]!
    const clef = midis[midis.length - 1]! <= 57 ? BASS : median < 60 ? TREBLE_8VB : TREBLE
    let end = 0
    let lo = Infinity
    let hi = -Infinity
    for (const e of events) {
      end = Math.max(end, e.start_ms + e.duration_ms)
      const d = diatonic(e.midi)
      lo = Math.min(lo, d)
      hi = Math.max(hi, d)
    }
    return { clef, durationMs: end, loDia: Math.min(lo, clef.bottomLine), hiDia: Math.max(hi, clef.bottomLine + 8) }
  }, [events])

  // Vertical geometry: leave room above the top staff line / below the bottom
  // one for ledger-line notes, plus a syllable strip.
  const padAbove = Math.max(2, hiDia - (clef.bottomLine + 8) + 2)
  const padBelow = Math.max(2, clef.bottomLine - loDia + 2)
  const topY = 12 + padAbove * STEP
  const yOfDia = (d: number) => topY + (clef.bottomLine + 8 - d) * STEP
  const staffBottom = yOfDia(clef.bottomLine)
  const height = staffBottom + padBelow * STEP + 18

  const width = LABEL_W + Math.max(300, (durationMs / 1000) * pxPerSecond) + 8
  const xOfMs = (ms: number) => LABEL_W + (ms / 1000) * pxPerSecond

  // Note value from duration vs the beat (quarter note) at the song tempo.
  const beat = 60000 / Math.max(20, tempoBpm)
  const valueOf = (ms: number): { hollow: boolean; stem: boolean; flags: number } => {
    const beats = ms / beat
    if (beats >= 3.2) return { hollow: true, stem: false, flags: 0 } // whole
    if (beats >= 1.6) return { hollow: true, stem: true, flags: 0 } // half
    if (beats >= 0.8) return { hollow: false, stem: true, flags: 0 } // quarter
    if (beats >= 0.4) return { hollow: false, stem: true, flags: 1 } // eighth
    return { hollow: false, stem: true, flags: 2 } // sixteenth-ish
  }

  // Follow the playhead, same behaviour as the piano roll.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || currentMs == null) return
    const target = Math.max(0, xOfMs(currentMs) - el.clientWidth * 0.35)
    if (Math.abs(el.scrollLeft - target) > 1) el.scrollLeft = target
    // eslint-disable-next-line react-hooks/exhaustive-deps -- xOfMs is stable per pxPerSecond
  }, [currentMs, pxPerSecond])

  const middleLine = clef.bottomLine + 4

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-gray-200 bg-surface">
      <svg width={width} height={height} role="img" aria-label="Staff notation">
        {/* Staff lines */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = yOfDia(clef.bottomLine + i * 2)
          return <line key={i} x1={LABEL_W - 30} y1={y} x2={width} y2={y} stroke="#94A3B8" />
        })}

        {/* Clef */}
        <text x={LABEL_W - 28} y={yOfDia(middleLine) + STEP * (clef.symbol === BASS.symbol ? 2 : 3)} fontSize={LINE_GAP * 4.4} fill="#333333">
          {clef.symbol}
        </text>
        {clef.hint && (
          <text x={LABEL_W - 22} y={staffBottom + 12} fontSize={9} fontWeight={600} fill="#333333">
            {clef.hint}
          </text>
        )}

        {/* Notes */}
        {events.map((e, i) => {
          const d = diatonic(e.midi)
          const x = xOfMs(e.start_ms)
          const y = yOfDia(d)
          const { hollow, stem, flags } = valueOf(e.duration_ms)
          const sharp = IS_SHARP[((e.midi % 12) + 12) % 12]
          const stemUp = d < middleLine
          const isSounding = currentMs != null && currentMs >= e.start_ms && currentMs < e.start_ms + e.duration_ms
          const color = isSounding ? '#ED7D31' : selectedIndex === i ? '#1E3F6F' : '#333333'

          // Ledger lines between the note and the staff.
          const ledgers: number[] = []
          for (let l = clef.bottomLine - 2; l >= d - (d % 2 === 0 ? 0 : 1); l -= 2) ledgers.push(l)
          for (let l = clef.bottomLine + 10; l <= d + (d % 2 === 0 ? 0 : 1); l += 2) ledgers.push(l)

          const stemX = stemUp ? x + 4.2 : x - 4.2
          const stemY2 = stemUp ? y - LINE_GAP * 3 : y + LINE_GAP * 3

          return (
            <g
              key={i}
              onClick={onSelect ? (ev) => { ev.stopPropagation(); onSelect(i) } : undefined}
              style={onSelect ? { cursor: 'pointer' } : undefined}
            >
              {ledgers.map((l) => (
                <line key={l} x1={x - 8} y1={yOfDia(l)} x2={x + 8} y2={yOfDia(l)} stroke="#94A3B8" />
              ))}
              {sharp && (
                <text x={x - 14} y={y + 3.5} fontSize={11} fill={color}>♯</text>
              )}
              <ellipse cx={x} cy={y} rx={4.6} ry={3.6} fill={hollow ? '#FFFFFF' : color} stroke={color} strokeWidth={1.4} transform={`rotate(-15 ${x} ${y})`} />
              {stem && <line x1={stemX} y1={y} x2={stemX} y2={stemY2} stroke={color} strokeWidth={1.2} />}
              {Array.from({ length: flags }, (_, f) => (
                <path
                  key={f}
                  d={
                    stemUp
                      ? `M ${stemX} ${stemY2 + f * 5} q 7 3 5 11`
                      : `M ${stemX} ${stemY2 - f * 5} q 7 -3 5 -11`
                  }
                  fill="none"
                  stroke={color}
                  strokeWidth={1.4}
                />
              ))}
              {e.syllable && (
                <text x={x - 4} y={height - 5} fontSize={10} fill="#666666">{e.syllable}</text>
              )}
              <title>{midiToNoteName(e.midi)}</title>
            </g>
          )
        })}

        {/* Playhead */}
        {currentMs != null && (
          <line x1={xOfMs(currentMs)} y1={0} x2={xOfMs(currentMs)} y2={height} stroke="#ED7D31" strokeWidth={1.5} />
        )}
      </svg>
    </div>
  )
}
