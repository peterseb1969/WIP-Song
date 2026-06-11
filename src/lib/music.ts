/**
 * Music helpers shared by the note renderers, practice player, and profile.
 * MIDI note numbers are the canonical pitch representation app-wide
 * (DESIGN.md "Canonical note representation"); note names are presentation.
 */

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const

/** 69 → "A4" (A above middle C). Octave numbering: C4 = 60 (scientific pitch). */
export function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/** Frequency in Hz for a MIDI note (A4 = 440). */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Frequency in Hz → fractional MIDI number (for pitch detection display). */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

/** Canonical note event (matches SONG_TRACK.melody / SONG_EXERCISE.target_notes / SONG_ATTEMPT.transcription). */
export interface NoteEvent {
  midi: number
  start_ms: number
  duration_ms: number
  syllable?: string
}

export interface Melody {
  tempo_bpm?: number
  events: NoteEvent[]
}

/** Guitar standard tuning, low to high: E2 A2 D3 G3 B3 E4. */
export const GUITAR_TUNING_MIDI = [40, 45, 50, 55, 59, 64] as const

/** All playable (string, fret) positions for a MIDI note within maxFret. String 0 = low E. */
export function fretPositions(midi: number, maxFret = 15): Array<{ string: number; fret: number }> {
  const positions: Array<{ string: number; fret: number }> = []
  GUITAR_TUNING_MIDI.forEach((open, string) => {
    const fret = midi - open
    if (fret >= 0 && fret <= maxFret) positions.push({ string, fret })
  })
  return positions
}
