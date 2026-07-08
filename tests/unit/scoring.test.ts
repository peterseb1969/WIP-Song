import { describe, it, expect } from 'vitest'
import { scoreAttempt, traceToEvents } from '../../src/lib/scoring.js'
import type { PitchSample } from '../../src/lib/audio.js'
import type { NoteEvent } from '../../src/lib/music.js'

const TARGET: NoteEvent[] = [{ midi: 69, start_ms: 0, duration_ms: 1000 }]

/** A steady trace at `midi`, sampled every 33ms across the window. */
function steady(midi: number, fromMs = 0, toMs = 1000): PitchSample[] {
  const out: PitchSample[] = []
  for (let t = fromMs; t < toMs; t += 33) out.push({ t_ms: t, midi })
  return out
}

describe('scoreAttempt', () => {
  it('gives full marks for singing the target', () => {
    const s = scoreAttempt(TARGET, steady(69))
    expect(s.pitch_score).toBe(100)
    expect(s.rhythm_score).toBeGreaterThanOrEqual(95)
    expect(s.overall_score).toBeGreaterThanOrEqual(95)
  })

  it('gives zero for the right note an octave off by default (tolerance Off)', () => {
    const s = scoreAttempt(TARGET, steady(57)) // A3 vs target A4
    expect(s.pitch_score).toBe(0)
  })

  it('gives full credit for the right note an octave off with ±1 tolerance (guitarist rule)', () => {
    const s = scoreAttempt(TARGET, steady(57), 1) // A3 vs target A4
    expect(s.pitch_score).toBe(100)
  })

  it('gives zero for silence', () => {
    const s = scoreAttempt(TARGET, [])
    expect(s.pitch_score).toBe(0)
    expect(s.rhythm_score).toBe(0)
    expect(s.overall_score).toBe(0)
    expect(s.notes[0]!.medianMidi).toBeNull()
  })

  it('fades credit with pitch error', () => {
    const slightlyOff = scoreAttempt(TARGET, steady(69.4)).pitch_score // within quartertone
    const wayOff = scoreAttempt(TARGET, steady(71)).pitch_score // 2 semitones
    expect(slightlyOff).toBe(100)
    expect(wayOff).toBe(0)
  })

  it('scores rhythm as voiced coverage of the note window', () => {
    const half = scoreAttempt(TARGET, steady(69, 0, 500))
    expect(half.rhythm_score).toBeGreaterThanOrEqual(45)
    expect(half.rhythm_score).toBeLessThanOrEqual(55)
  })
})

describe('traceToEvents', () => {
  it('condenses a steady run into one canonical event', () => {
    const events = traceToEvents(steady(69))
    expect(events).toHaveLength(1)
    expect(events[0]!.midi).toBe(69)
    expect(events[0]!.start_ms).toBe(0)
    expect(events[0]!.duration_ms).toBeGreaterThan(900)
  })

  it('splits on pitch jumps and ignores sub-100ms blips', () => {
    const trace = [...steady(60, 0, 500), ...steady(67, 500, 1000), { t_ms: 1010, midi: 80 }]
    const events = traceToEvents(trace)
    expect(events.map((e) => e.midi)).toEqual([60, 67])
  })
})
