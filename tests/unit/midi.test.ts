import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseMidi } from '../../server/lib/midi.js'

// The real sample file the parser was built against (IMPORT_FORMATS.md).
const SAMPLE = 'test-data/Queen - Bohemian Rhapsody.mid'

describe('parseMidi (Bohemian Rhapsody sample)', () => {
  const parsed = parseMidi(readFileSync(SAMPLE))

  it('reads the header', () => {
    expect(parsed.format).toBe(1)
    expect(parsed.trackCount).toBe(14)
  })

  it('walks the tempo map to a plausible duration', () => {
    // 3 tempo changes; naive single-tempo conversion lands far away from this.
    expect(parsed.durationMs).toBeGreaterThan(320_000)
    expect(parsed.durationMs).toBeLessThan(335_000)
    expect(parsed.tempoBpm).toBe(78)
  })

  it('finds melody candidates with vocal tracks suggested first', () => {
    expect(parsed.candidates.length).toBeGreaterThanOrEqual(10)
    expect(parsed.candidates[0]!.suggested).toBe(true)
    // Track labels arrive as 0x01 text events in this file, not 0x03 name meta.
    expect(parsed.candidates[0]!.name).toBe('Lead Vox')
    expect(parsed.candidates[1]!.name).toBe('Lead Vox 2')
  })

  it('excludes the drum channel and monophonic-izes overlaps', () => {
    expect(parsed.candidates.some((c) => c.channel === 9)).toBe(false)
    const vox = parsed.candidates[0]!
    expect(vox.noteCount).toBe(129)
    const sorted = [...vox.events].sort((a, b) => a.start_ms - b.start_ms)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]!.start_ms + sorted[i]!.duration_ms).toBeLessThanOrEqual(sorted[i + 1]!.start_ms)
    }
  })

  it('treats lyrics as optional (this file has none)', () => {
    expect(parsed.hasLyrics).toBe(false)
    expect(parsed.lyricsText).toBeUndefined()
  })

  it('rejects non-MIDI data with a clear error', () => {
    expect(() => parseMidi(Buffer.from('not a midi file'))).toThrow(/MThd/)
  })
})
