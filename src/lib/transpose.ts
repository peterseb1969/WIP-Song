/**
 * Range-aware transposition: suggest a shift (octaves preferred) that moves
 * exercise targets into the singer's comfortable range. Born from the first
 * human mic test — an A4 drill against a baritone lands a fifth of the way
 * up his falsetto; the right answer is "sing it an octave down and score it
 * there", not "half credit via the octave rule".
 */

import type { NoteEvent } from './music'
import type { SingerData } from '../contexts/SingerContext'

export interface VocalRange {
  low: number
  high: number
}

/** Comfortable working ranges per voice type (MIDI, conservative choral values). */
export const VOICE_RANGES: Record<string, VocalRange> = {
  SOPRANO: { low: 60, high: 81 }, // C4–A5
  MEZZO_SOPRANO: { low: 57, high: 77 }, // A3–F5
  ALTO: { low: 53, high: 74 }, // F3–D5
  COUNTERTENOR: { low: 55, high: 76 }, // G3–E5
  TENOR: { low: 48, high: 69 }, // C3–A4
  BARITONE: { low: 43, high: 64 }, // G2–E4
  BASS: { low: 40, high: 60 }, // E2–C4
  CHILD: { low: 57, high: 76 }, // A3–E5
}

/** The singer's range: explicit profile values beat the voice-type default. */
export function singerRange(singer?: SingerData): VocalRange | null {
  if (singer?.range_low_midi != null && singer?.range_high_midi != null && singer.range_high_midi > singer.range_low_midi) {
    return { low: singer.range_low_midi, high: singer.range_high_midi }
  }
  if (singer?.voice_type && VOICE_RANGES[singer.voice_type]) return VOICE_RANGES[singer.voice_type]!
  return null
}

/**
 * Suggest a transposition (semitones) that brings the targets into range.
 * Octave shifts only — the melody stays in its key, just in the singer's
 * register. Picks the smallest shift that fits ALL notes; if nothing fully
 * fits (melody span exceeds the range), picks the shift covering the most
 * notes. Returns 0 when the targets already fit.
 */
export function suggestTransposition(targets: NoteEvent[], range: VocalRange): number {
  if (!targets.length) return 0
  const fitCount = (t: number) => targets.reduce((n, e) => n + (e.midi + t >= range.low && e.midi + t <= range.high ? 1 : 0), 0)
  let best = 0
  let bestFit = fitCount(0)
  for (const t of [-12, 12, -24, 24, -36, 36]) {
    const fit = fitCount(t)
    if (fit > bestFit || (fit === bestFit && Math.abs(t) < Math.abs(best))) {
      best = t
      bestFit = fit
    }
    if (bestFit === targets.length && best === 0) return 0
  }
  return bestFit > fitCount(0) ? best : 0
}

/** Apply a transposition. Exact fret positions are dropped — they belong to the original register. */
export function transposeEvents(events: NoteEvent[], semitones: number): NoteEvent[] {
  if (!semitones) return events
  return events.map((e) => {
    const { string: _s, fret: _f, ...rest } = e
    return { ...rest, midi: e.midi + semitones }
  })
}
