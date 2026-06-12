import { describe, it, expect } from 'vitest'
import { singerRange, suggestTransposition, transposeEvents, VOICE_RANGES } from '../../src/lib/transpose.js'
import type { NoteEvent } from '../../src/lib/music.js'

const ev = (midi: number): NoteEvent => ({ midi, start_ms: 0, duration_ms: 500 })

describe('singerRange', () => {
  it('explicit profile range beats the voice-type default', () => {
    expect(
      singerRange({ subject: 's', display_name: 'd', voice_type: 'BARITONE', range_low_midi: 45, range_high_midi: 67 }),
    ).toEqual({ low: 45, high: 67 })
  })

  it('falls back to the voice-type default', () => {
    expect(singerRange({ subject: 's', display_name: 'd', voice_type: 'BARITONE' })).toEqual(VOICE_RANGES.BARITONE)
  })

  it('ignores degenerate explicit ranges and unknown voice types', () => {
    expect(singerRange({ subject: 's', display_name: 'd', range_low_midi: 60, range_high_midi: 60 })).toBeNull()
    expect(singerRange({ subject: 's', display_name: 'd', voice_type: 'KAZOO' })).toBeNull()
    expect(singerRange(undefined)).toBeNull()
  })
})

describe('suggestTransposition', () => {
  const BARITONE = VOICE_RANGES.BARITONE! // 43–64

  it('the founding case: an A4 drill for a baritone suggests an octave down', () => {
    expect(suggestTransposition([ev(69)], BARITONE)).toBe(-12)
  })

  it('suggests nothing when the targets already fit', () => {
    expect(suggestTransposition([ev(48), ev(55), ev(60)], BARITONE)).toBe(0)
  })

  it('suggests up for a line below a soprano range', () => {
    // G2–E3 line vs soprano 60–81 → two octaves up fits
    expect(suggestTransposition([ev(43), ev(48), ev(52)], VOICE_RANGES.SOPRANO!)).toBe(24)
  })

  it('prefers the smallest octave shift that fully fits', () => {
    // C5–E5 vs baritone: −12 brings 48–52 (fits); −24 would too far down (36–40, below 43)
    expect(suggestTransposition([ev(72), ev(76)], BARITONE)).toBe(-12)
  })

  it('maximizes coverage when the span exceeds the range', () => {
    // Span E2–C6 (40..84) is wider than any range — pick the shift covering most notes.
    const wide = [ev(40), ev(52), ev(64), ev(76), ev(84)]
    const t = suggestTransposition(wide, BARITONE)
    const fit = (shift: number) => wide.filter((e) => e.midi + shift >= 43 && e.midi + shift <= 64).length
    expect(fit(t)).toBeGreaterThanOrEqual(fit(0))
  })

  it('returns 0 for empty targets', () => {
    expect(suggestTransposition([], BARITONE)).toBe(0)
  })
})

describe('transposeEvents', () => {
  it('shifts midi and preserves timing/syllables', () => {
    const out = transposeEvents([{ midi: 69, start_ms: 100, duration_ms: 400, syllable: 'la' }], -12)
    expect(out).toEqual([{ midi: 57, start_ms: 100, duration_ms: 400, syllable: 'la' }])
  })

  it('drops exact fret positions (they belong to the original register)', () => {
    const out = transposeEvents([{ midi: 64, start_ms: 0, duration_ms: 100, string: 5, fret: 0 }], -12)
    expect(out[0]!.midi).toBe(52)
    expect(out[0]!.string).toBeUndefined()
    expect(out[0]!.fret).toBeUndefined()
  })

  it('is the identity at 0 semitones', () => {
    const events = [{ midi: 64, start_ms: 0, duration_ms: 100, string: 5, fret: 0 }]
    expect(transposeEvents(events, 0)).toBe(events)
  })
})
