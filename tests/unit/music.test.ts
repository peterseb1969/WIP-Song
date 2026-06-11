import { describe, it, expect } from 'vitest'
import { midiToNoteName, midiToFrequency, frequencyToMidi, fretPositions } from '../../src/lib/music.js'

describe('music helpers', () => {
  it('names notes in scientific pitch (C4 = 60)', () => {
    expect(midiToNoteName(60)).toBe('C4')
    expect(midiToNoteName(69)).toBe('A4')
    expect(midiToNoteName(40)).toBe('E2') // low E string
  })

  it('round-trips frequency and MIDI at A440', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440)
    expect(frequencyToMidi(440)).toBeCloseTo(69)
    expect(frequencyToMidi(midiToFrequency(52.3))).toBeCloseTo(52.3)
  })

  it('finds guitar positions for A4 (standard tuning, 15 frets)', () => {
    const pos = fretPositions(69)
    expect(pos).toEqual([
      { string: 3, fret: 14 }, // G3 + 14
      { string: 4, fret: 10 }, // B3 + 10
      { string: 5, fret: 5 },  // E4 + 5
    ])
  })

  it('returns no positions for notes off the neck', () => {
    expect(fretPositions(30)).toHaveLength(0) // below low E
    expect(fretPositions(100)).toHaveLength(0) // above fret 15 on high e
  })
})
