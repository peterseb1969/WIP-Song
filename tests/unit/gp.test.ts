import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseGp } from '../../server/lib/gp.js'
import type { CandidateTrack } from '../../server/lib/midi.js'

/**
 * Guitar Pro parser against the real sample corpus (one file per format
 * generation — see IMPORT_FORMATS.md "Samples on hand"). Pinned values were
 * verified once by hand (durations cross-check against measures × tempo;
 * Liebeslied: 16 measures of 4/4 at 180 BPM ≈ 21.3 s).
 */

const STANDARD = [40, 45, 50, 55, 59, 64] // EADGBE low → high

function expectWellFormed(c: CandidateTrack) {
  const sorted = [...c.events].sort((a, b) => a.start_ms - b.start_ms)
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!
    expect(e.duration_ms).toBeGreaterThan(0)
    expect(e.fret).toBeGreaterThanOrEqual(0)
    expect(e.fret).toBeLessThanOrEqual(30)
    expect(e.string).toBeGreaterThanOrEqual(0)
    expect(e.string).toBeLessThan(c.tuning!.length)
    // midi must equal open-string + fret (exact-position invariant)
    expect(e.midi).toBe(c.tuning![e.string!]! + e.fret!)
    if (i > 0) {
      const prev = sorted[i - 1]!
      expect(prev.start_ms + prev.duration_ms).toBeLessThanOrEqual(e.start_ms)
    }
  }
}

describe('parseGp (GP3 — Pushed Again)', () => {
  const parsed = parseGp(readFileSync('test-data/Die Toten Hosen - Pushed Again (Pro).gp3'))

  it('reads file-internal metadata', () => {
    expect(parsed.format).toBe(3)
    expect(parsed.prefill).toEqual({ title: 'Pushed Again', artist: 'Die Toten Hosen' })
    expect(parsed.tempoBpm).toBe(112)
  })

  it('finds the four melodic tracks and excludes drums', () => {
    expect(parsed.trackCount).toBe(5)
    expect(parsed.candidates.map((c) => c.name)).toContain('Voice')
    expect(parsed.candidates).toHaveLength(4)
  })

  it('stars the Voice track and sorts it first', () => {
    expect(parsed.candidates[0]!.name).toBe('Voice')
    expect(parsed.candidates[0]!.suggested).toBe(true)
    expect(parsed.candidates[0]!.noteCount).toBe(430)
  })

  it('reads tunings (guitars standard, bass 4-string)', () => {
    const byName = new Map(parsed.candidates.map((c) => [c.name, c]))
    expect(byName.get('Guitar 1')!.tuning).toEqual(STANDARD)
    expect(byName.get('Bass')!.tuning).toEqual([28, 33, 38, 43])
  })

  it('produces well-formed exact-position events', () => {
    expect(parsed.durationMs).toBeGreaterThan(230_000)
    expect(parsed.durationMs).toBeLessThan(240_000)
    parsed.candidates.forEach(expectWellFormed)
  })
})

describe('parseGp (GP4 — Ballroom Blitz)', () => {
  const parsed = parseGp(readFileSync('test-data/sweet-ballroom-blitz.gp4'))

  it('reads file-internal metadata', () => {
    expect(parsed.format).toBe(4)
    expect(parsed.prefill).toEqual({ title: 'Ballroom Blitz', artist: 'The Sweet' })
    expect(parsed.tempoBpm).toBe(115)
  })

  it('parses all melodic tracks well-formed', () => {
    expect(parsed.candidates).toHaveLength(4)
    expect(parsed.durationMs).toBeGreaterThan(225_000)
    expect(parsed.durationMs).toBeLessThan(240_000)
    parsed.candidates.forEach(expectWellFormed)
  })
})

describe('parseGp (GP5 v5.00 — Liebeslied)', () => {
  const parsed = parseGp(readFileSync('test-data/Die Toten Hosen - Liebeslied (Pro).gp5'))

  it('reads file-internal metadata', () => {
    expect(parsed.format).toBe(5)
    expect(parsed.prefill).toEqual({ title: 'Liebeslied', artist: 'Die Toten Hosen' })
    expect(parsed.tempoBpm).toBe(180)
  })

  it('duration matches measures × tempo (16 bars of 4/4 at 180)', () => {
    // 16 × 4 quarters × (60000/180) ms ≈ 21333 ms; last event ends within the final bar.
    expect(parsed.durationMs).toBeGreaterThan(20_000)
    expect(parsed.durationMs).toBeLessThanOrEqual(22_000)
    expect(parsed.candidates).toHaveLength(1)
    expect(parsed.candidates[0]!.noteCount).toBe(82)
    expectWellFormed(parsed.candidates[0]!)
  })
})

describe('parseGp (GP5 v5.10 — Nena)', () => {
  const parsed = parseGp(readFileSync('test-data/Nena - Irgendwie Irgendwo Irgendwann (Pro).gp5'))

  it('handles the v5.10 layout deltas', () => {
    expect(parsed.format).toBe(5)
    expect(parsed.prefill!.artist).toBe('Nena')
    expect(parsed.tempoBpm).toBe(156)
    expect(parsed.candidates).toHaveLength(1)
    expect(parsed.candidates[0]!.name).toBe('Gitarre')
    expect(parsed.candidates[0]!.noteCount).toBe(616)
    expectWellFormed(parsed.candidates[0]!)
  })
})

describe('parseGp (error paths)', () => {
  it('rejects non-GP data with a clear error', () => {
    expect(() => parseGp(Buffer.from('not a guitar pro file at all, padded to be long enough'))).toThrow(/Guitar Pro/)
  })

  it('rejects GPX/BCFZ archives (not yet supported)', () => {
    const gpx = readFileSync('test-data/EASY RIFFS.gpx')
    expect(() => parseGp(gpx)).toThrow(/Guitar Pro/)
  })
})
