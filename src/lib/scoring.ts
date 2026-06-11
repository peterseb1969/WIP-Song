/**
 * Attempt scoring: compare the detected pitch trace against target note
 * events. Octave-equivalent pitches earn partial credit (DESIGN.md — a
 * guitarist sings an octave away from where the melody is written).
 */

import type { PitchSample } from './audio'
import type { NoteEvent } from './music'

export interface AttemptScores {
  pitch_score: number
  rhythm_score: number
  overall_score: number
  /** Per-note breakdown for the score reveal. */
  notes: Array<{ target: NoteEvent; medianMidi: number | null; pitchCredit: number; coverage: number }>
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Credit for a pitch error in semitones: 1 within a quartertone, fading to 0 at 1.5 st. */
function creditForError(errSemitones: number): number {
  if (errSemitones <= 0.5) return 1
  if (errSemitones >= 1.5) return 0
  return 1 - (errSemitones - 0.5)
}

export function scoreAttempt(targets: NoteEvent[], samples: PitchSample[]): AttemptScores {
  const notes = targets.map((target) => {
    const within = samples.filter(
      (s) => s.t_ms >= target.start_ms && s.t_ms < target.start_ms + target.duration_ms,
    )
    const med = median(within.map((s) => s.midi))

    let pitchCredit = 0
    if (med != null) {
      const err = Math.abs(med - target.midi)
      // Octave equivalence: right pitch class an octave off → half credit.
      const octaveErr = Math.abs(((err + 6) % 12) - 6)
      pitchCredit = Math.max(creditForError(err), 0.5 * creditForError(octaveErr))
    }

    // Rhythm proxy: how much of the note window was voiced (~30 samples/s).
    const expectedSamples = Math.max(1, target.duration_ms / 33)
    const coverage = Math.min(1, within.length / expectedSamples)

    return { target, medianMidi: med, pitchCredit, coverage }
  })

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const pitch = Math.round(100 * avg(notes.map((n) => n.pitchCredit)))
  const rhythm = Math.round(100 * avg(notes.map((n) => n.coverage)))
  const overall = Math.round(0.7 * pitch + 0.3 * rhythm)

  return { pitch_score: pitch, rhythm_score: rhythm, overall_score: overall, notes }
}

/**
 * Condense the raw trace into canonical note events for
 * SONG_ATTEMPT.transcription: consecutive voiced samples within ±0.5 st of
 * their running median become one event.
 */
export function traceToEvents(samples: PitchSample[]): NoteEvent[] {
  const events: NoteEvent[] = []
  let run: PitchSample[] = []

  const flush = () => {
    if (run.length < 3) { run = []; return } // <100ms — ignore blips
    const med = median(run.map((s) => s.midi))!
    const first = run[0]!
    const last = run[run.length - 1]!
    events.push({
      midi: Math.round(med),
      start_ms: first.t_ms,
      duration_ms: Math.max(33, last.t_ms - first.t_ms + 33),
    })
    run = []
  }

  for (const s of samples) {
    if (!run.length) { run.push(s); continue }
    const prev = run[run.length - 1]!
    const med = median(run.map((r) => r.midi))!
    const gap = s.t_ms - prev.t_ms
    if (gap > 100 || Math.abs(s.midi - med) > 0.75) flush()
    run.push(s)
  }
  flush()
  return events
}
