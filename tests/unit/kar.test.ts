import { describe, it, expect } from 'vitest'
import { parseMidi } from '../../server/lib/midi.js'

/**
 * .kar verification against a synthetic Soft-Karaoke file (KNOWN_ISSUES:
 * the syllable heuristic had never met a .kar). Built byte-exact to the
 * convention: @-directives and syllables as 0x01 text events on a "Words"
 * track, "/" (new line) and "\" (new verse) prefixes, melody on a separate
 * track. Two verses of Twinkle Twinkle = 28 syllables, comfortably past the
 * parser's >20 text-event gate.
 */

const DIVISION = 480

function vlq(n: number): number[] {
  const out = [n & 0x7f]
  while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80)
  return out
}

interface AbsEvent {
  tick: number
  bytes: (delta: number[]) => number[]
}

const meta = (type: number, text: string) => (delta: number[]) => {
  const p = Buffer.from(text, 'latin1')
  return [...delta, 0xff, type, ...vlq(p.length), ...p]
}
const tempo = (usPerQn: number) => (delta: number[]) => [
  ...delta, 0xff, 0x51, 3, (usPerQn >> 16) & 0xff, (usPerQn >> 8) & 0xff, usPerQn & 0xff,
]
const noteOn = (ch: number, midi: number) => (delta: number[]) => [...delta, 0x90 | ch, midi, 90]
const noteOff = (ch: number, midi: number) => (delta: number[]) => [...delta, 0x80 | ch, midi, 0]

function track(events: AbsEvent[]): Buffer {
  const sorted = [...events].sort((a, b) => a.tick - b.tick)
  const body: number[] = []
  let at = 0
  for (const ev of sorted) {
    body.push(...ev.bytes(vlq(ev.tick - at)))
    at = ev.tick
  }
  body.push(0x00, 0xff, 0x2f, 0x00) // end of track
  const head = Buffer.alloc(8)
  head.write('MTrk', 0, 'latin1')
  head.writeUInt32BE(body.length, 4)
  return Buffer.concat([head, Buffer.from(body)])
}

function smf(tracks: Buffer[]): Buffer {
  const head = Buffer.alloc(14)
  head.write('MThd', 0, 'latin1')
  head.writeUInt32BE(6, 4)
  head.writeUInt16BE(1, 8)
  head.writeUInt16BE(tracks.length, 10)
  head.writeUInt16BE(DIVISION, 12)
  return Buffer.concat([head, ...tracks])
}

// Twinkle Twinkle, two verses: one syllable per note, melody starts one
// quarter in (tick 480) like a real chart — tick-0 text is treated as a
// track label by the parser, not a syllable.
const MELODY = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]
const SYLLABLES = [
  '\\Twin-', 'kle ', 'twin-', 'kle ', 'lit-', 'tle ', 'star ',
  '/how ', 'I ', 'won-', 'der ', 'what ', 'you ', 'are ',
  '\\Up ', 'a-', 'bove ', 'the ', 'world ', 'so ', 'high ',
  '/like ', 'a ', 'dia-', 'mond ', 'in ', 'the ', 'sky ',
]
const NOTES = [...MELODY, ...MELODY]
const tickOf = (i: number) => (i + 1) * DIVISION

function buildKar(): Buffer {
  const tempoTrack = track([{ tick: 0, bytes: tempo(500_000) }]) // 120 BPM
  const softKaraoke = track([
    { tick: 0, bytes: meta(0x03, 'Soft Karaoke') },
    { tick: 0, bytes: meta(0x01, '@KMIDI KARAOKE FILE') },
    { tick: 0, bytes: meta(0x01, '@V0100') },
  ])
  const words = track([
    { tick: 0, bytes: meta(0x03, 'Words') },
    { tick: 0, bytes: meta(0x01, '@LENGL') },
    { tick: 0, bytes: meta(0x01, '@TTwinkle Twinkle') },
    ...SYLLABLES.map((text, i) => ({ tick: tickOf(i), bytes: meta(0x01, text) })),
  ])
  const melody = track([
    { tick: 0, bytes: meta(0x03, 'MELODY') },
    ...NOTES.flatMap((midi, i) => [
      { tick: tickOf(i), bytes: noteOn(0, midi) },
      { tick: tickOf(i) + DIVISION / 2, bytes: noteOff(0, midi) },
    ]),
  ])
  return smf([tempoTrack, softKaraoke, words, melody])
}

describe('parseMidi (synthetic .kar)', () => {
  const parsed = parseMidi(buildKar())
  const melody = parsed.candidates.find((c) => c.name === 'MELODY')

  it('detects .kar-style lyrics carried as 0x01 text events', () => {
    expect(parsed.hasLyrics).toBe(true)
  })

  it('suggests the melody track and parses its notes', () => {
    expect(melody).toBeDefined()
    expect(melody!.suggested).toBe(true)
    expect(melody!.noteCount).toBe(28)
    // 120 BPM, melody starts one quarter in: note i at (i+1)*500ms, 250ms long.
    expect(melody!.events[0]).toMatchObject({ midi: 60, start_ms: 500, duration_ms: 250 })
    expect(melody!.events[6]!.start_ms).toBe(3500)
  })

  it('attaches one syllable per note from the separate Words track', () => {
    const sylls = melody!.events.map((e) => e.syllable)
    expect(sylls).toHaveLength(28)
    expect(sylls.every(Boolean)).toBe(true)
    // Line markers ("/", "\") are stripped from per-note syllables.
    expect(sylls.slice(0, 7)).toEqual(['Twin-', 'kle', 'twin-', 'kle', 'lit-', 'tle', 'star'])
    expect(sylls[7]).toBe('how')
    expect(sylls[14]).toBe('Up')
  })

  it('excludes @-directives and reconstructs lyric lines in lyricsText', () => {
    expect(parsed.lyricsText).toBeDefined()
    expect(parsed.lyricsText).not.toContain('@')
    const lines = parsed.lyricsText!.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines).toEqual([
      'Twin-kle twin-kle lit-tle star',
      'how I won-der what you are',
      'Up a-bove the world so high',
      'like a dia-mond in the sky',
    ])
  })

  it('does not list the lyric-only Words track as a melody candidate', () => {
    expect(parsed.candidates.some((c) => c.name === 'Words')).toBe(false)
  })
})

describe('parseMidi (lyric heuristics around the .kar path)', () => {
  it('a track with few text events is not mistaken for lyrics', () => {
    const buf = smf([
      track([{ tick: 0, bytes: tempo(500_000) }]),
      track([
        { tick: 0, bytes: meta(0x03, 'Piano') },
        { tick: DIVISION, bytes: meta(0x01, 'arr. by somebody') },
        { tick: DIVISION, bytes: noteOn(0, 60) },
        { tick: DIVISION * 2, bytes: noteOff(0, 60) },
      ]),
    ])
    const parsed = parseMidi(buf)
    expect(parsed.hasLyrics).toBe(false)
    expect(parsed.candidates[0]!.events[0]!.syllable).toBeUndefined()
  })

  it('real 0x05 lyric events work without the >20-event gate', () => {
    const buf = smf([
      track([{ tick: 0, bytes: tempo(500_000) }]),
      track([
        { tick: 0, bytes: meta(0x03, 'Vocal') },
        { tick: DIVISION, bytes: meta(0x05, 'la ') },
        { tick: DIVISION, bytes: noteOn(0, 60) },
        { tick: DIVISION * 2, bytes: noteOff(0, 60) },
        { tick: DIVISION * 2, bytes: meta(0x05, 'di ') },
        { tick: DIVISION * 2, bytes: noteOn(0, 62) },
        { tick: DIVISION * 3, bytes: noteOff(0, 62) },
      ]),
    ])
    const parsed = parseMidi(buf)
    expect(parsed.hasLyrics).toBe(true)
    expect(parsed.candidates[0]!.events.map((e) => e.syllable)).toEqual(['la', 'di'])
  })
})
