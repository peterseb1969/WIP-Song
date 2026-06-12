/**
 * Guitar Pro 3/4/5 (.gp3/.gp4/.gp5) reader for the import flow. Produces the
 * same shape as the MIDI parser (ParsedMidi with melody candidates) so the
 * import route/dialog work unchanged; events additionally carry exact
 * {string, fret} positions (the point of GP files for a guitarist — no
 * fretboard position inference needed).
 *
 * Byte layout transcribed from TuxGuitar's GP3/GP4/GP5InputStream readers
 * (the de-facto reference for these reverse-engineered formats) and verified
 * against the four samples in test-data/ (GP3 v3.00, GP4 v4.0, GP5 v5.0,
 * GP5 v5.1). Deliberate v1 simplifications, documented in IMPORT_FORMATS.md:
 * repeats are NOT expanded, chords collapse to their highest note (melody on
 * top), GP lyrics land in lyrics_text without per-note syllable alignment,
 * and a mid-measure tempo change applies from its measure's start.
 */

import type { CandidateTrack, ParsedMidi, ParsedNote } from './midi.js'
import { VOCAL_NAME } from './midi.js'

interface GpVersion {
  major: 3 | 4 | 5
  /** Sub-version code (GP5: 0 = v5.00, 1 = v5.10 — layout differs). */
  vc: number
}

const VERSIONS: Record<string, GpVersion> = {
  'FICHIER GUITAR PRO v3.00': { major: 3, vc: 0 },
  'FICHIER GUITAR PRO v4.00': { major: 4, vc: 0 },
  'FICHIER GUITAR PRO v4.06': { major: 4, vc: 1 },
  'FICHIER GUITAR PRO L4.06': { major: 4, vc: 2 },
  'FICHIER GUITAR PRO v5.00': { major: 5, vc: 0 },
  'FICHIER GUITAR PRO v5.10': { major: 5, vc: 1 },
}

const decoder = new TextDecoder('windows-1252')

class R {
  pos = 0
  constructor(private buf: Buffer) {}
  private take(n: number): Buffer {
    if (this.pos + n > this.buf.length) throw new Error(`Unexpected end of file at byte ${this.pos}`)
    const b = this.buf.subarray(this.pos, this.pos + n)
    this.pos += n
    return b
  }
  u8(): number { return this.take(1)[0]! }
  i8(): number { const v = this.u8(); return v > 127 ? v - 256 : v }
  i32(): number { const b = this.take(4); return b.readInt32LE(0) }
  /** Clamped at EOF (files end exactly on the last beat; trailing pad skips
   *  run past it — TuxGuitar's InputStream.read tolerates this silently). */
  skip(n: number): void { this.pos = Math.min(this.pos + n, this.buf.length) }
  /** TuxGuitar readString(size, len): consume max(size, …) bytes, use len chars. */
  str(size: number, len: number): string {
    const b = this.take(size > 0 ? size : len)
    return decoder.decode(b.subarray(0, Math.min(Math.max(len, 0), b.length)))
  }
  /** Length byte + fixed-size buffer (e.g. track names: strByte(40)). */
  strByte(size: number): string { return this.str(size, this.u8()) }
  /** int32 (= length + 1), then length byte, then chars. */
  strIntByte(): string { return this.strByte(this.i32() - 1) }
  /** int32 length, then chars (GP lyrics). */
  strInt(): string { const len = this.i32(); return decoder.decode(this.take(Math.max(len, 0))) }
}

const TUPLETS: Record<number, [enters: number, times: number]> = {
  3: [3, 2], 5: [5, 4], 6: [6, 4], 7: [7, 4], 9: [9, 8], 10: [10, 8], 11: [11, 8], 12: [12, 8], 13: [13, 8],
}

interface GpTrack {
  name: string
  /** Open-string MIDI values in GP order (index 0 = string 1 = highest). */
  tunings: number[]
  offset: number
  percussion: boolean
}

interface RawEvent {
  startQ: number
  durQ: number
  mIdx: number
  midi: number
  /** App convention: 0 = lowest string. */
  string: number
  fret: number
}

export function parseGp(buf: Buffer): ParsedMidi {
  const r = new R(buf)

  // --- version (1 length byte + 30 bytes) ---
  const versionString = r.strByte(30)
  const v = VERSIONS[versionString.trim()]
  if (!v) throw new Error(`Not a Guitar Pro 3/4/5 file (version: "${versionString.trim() || 'unknown'}")`)

  // --- song info ---
  const title = r.strIntByte()
  r.strIntByte() // subtitle
  const artist = r.strIntByte()
  r.strIntByte() // album
  r.strIntByte() // author/words
  if (v.major === 5) r.strIntByte() // GP5 extra (lyricist)
  r.strIntByte() // copyright
  r.strIntByte() // tab author
  r.strIntByte() // instructions
  const comments = r.i32()
  for (let i = 0; i < comments; i++) r.strIntByte()

  if (v.major === 3 || v.major === 4) r.u8() // triplet feel (boolean)

  // --- lyrics (GP4/GP5) ---
  let lyricsText: string | undefined
  if (v.major >= 4) {
    r.i32() // lyric track number
    for (let i = 0; i < 5; i++) {
      r.i32() // from measure
      const line = r.strInt()
      if (i === 0 && line.trim()) lyricsText = line.trim()
    }
  }

  // --- GP5 page setup ---
  if (v.major === 5) {
    r.skip(v.vc > 0 ? 49 : 30)
    for (let i = 0; i < 11; i++) { r.skip(4); r.strByte(0) }
  }

  let tempo = r.i32()
  if (tempo <= 0) tempo = 120
  if (v.major === 5 && v.vc > 0) r.skip(1)

  r.i8() // key signature
  r.skip(3)
  if (v.major >= 4) r.i8() // octave

  // --- 64 MIDI channel definitions: program int + 6 bytes + 2 padding ---
  for (let i = 0; i < 64; i++) { r.i32(); r.skip(8) }

  if (v.major === 5) r.skip(42)

  const measureCount = r.i32()
  const trackCount = r.i32()
  if (measureCount <= 0 || measureCount > 10000 || trackCount <= 0 || trackCount > 64) {
    throw new Error(`Implausible structure (${measureCount} measures, ${trackCount} tracks) — file may be corrupt`)
  }

  // --- measure headers (time signatures persist across measures) ---
  const measureQuarters: number[] = []
  let num = 4
  let den = 4
  for (let i = 0; i < measureCount; i++) {
    if (v.major === 5 && i > 0) r.skip(1)
    const flags = r.u8()
    if (flags & 0x01) num = r.i8()
    if (flags & 0x02) den = r.i8()
    if (flags & 0x08) r.i8() // repeat close
    if (v.major < 5 && flags & 0x10) r.u8() // repeat alternative
    if (flags & 0x20) { r.strIntByte(); r.skip(4) } // marker + color
    if (flags & 0x40) { r.i8(); r.skip(1) } // key signature
    if (v.major === 5) {
      if (flags & 0x03) r.skip(4) // beam-eighth-notes grouping
      if (flags & 0x10) r.u8() // repeat alternative (after key sig in GP5)
      else r.skip(1)
      r.i8() // per-measure triplet feel
    }
    measureQuarters.push(Math.max(0.25, num * (4 / Math.max(1, den))))
  }

  // --- tracks ---
  const tracks: GpTrack[] = []
  for (let t = 0; t < trackCount; t++) {
    r.u8() // track flags
    if (v.major === 5 && (t === 0 || v.vc === 0)) r.skip(1)
    const name = r.strByte(40).trim()
    const stringCount = r.i32()
    const tunings: number[] = []
    for (let i = 0; i < 7; i++) {
      const tuning = r.i32()
      if (i < stringCount) tunings.push(tuning)
    }
    r.i32() // port
    const gmChannel1 = r.i32() - 1
    r.i32() // gm channel 2
    r.i32() // frets
    const offset = r.i32() // capo
    r.skip(4) // color
    if (v.major === 5) {
      r.skip(v.vc > 0 ? 49 : 44)
      if (v.vc > 0) { r.strIntByte(); r.strIntByte() }
    }
    tracks.push({ name, tunings, offset, percussion: gmChannel1 === 9 })
  }
  if (v.major === 5) r.skip(v.vc === 0 ? 2 : 1)

  // --- measures × tracks: beats ---
  const tempoByMeasure: number[] = new Array(measureCount)
  const trackEvents: RawEvent[][] = tracks.map(() => [])
  // Per (track, voice): the last emitted event, for tie continuation.
  const lastEvent: (RawEvent | null)[][] = tracks.map(() => [null, null])
  // Per (track, string): last fret value, for tied-note pitch resolution.
  const lastFretOnString: number[][] = tracks.map(() => new Array(8).fill(-1))

  const measureStartQ: number[] = new Array(measureCount)
  {
    let q = 0
    for (let i = 0; i < measureCount; i++) { measureStartQ[i] = q; q += measureQuarters[i]! }
  }

  const tempoState = { value: tempo }

  const readDuration = (flags: number): number => {
    const d = r.i8()
    let quarters = Math.pow(2, -d) // -2 whole = 4q … 0 quarter = 1q … 3 thirty-second
    if (flags & 0x01) quarters *= 1.5 // dotted
    if (flags & 0x20) {
      const division = TUPLETS[r.i32()]
      if (division) quarters *= division[1] / division[0]
    }
    return quarters
  }

  const readChord = () => {
    if (v.major === 5) {
      r.skip(17); r.strByte(21); r.skip(4); r.i32()
      for (let i = 0; i < 7; i++) r.i32()
      r.skip(32)
    } else if ((r.u8() & 0x01) === 0) {
      r.strIntByte()
      const firstFret = r.i32()
      if (firstFret !== 0) for (let i = 0; i < 6; i++) r.i32()
    } else if (v.major === 4) {
      r.skip(16); r.strByte(21); r.skip(4); r.i32()
      for (let i = 0; i < 7; i++) r.i32()
      r.skip(32)
    } else {
      r.skip(25); r.strByte(34); r.i32()
      for (let i = 0; i < 6; i++) r.i32()
      r.skip(36)
    }
  }

  const readBendOrBar = () => { // identical layouts: skip 5, then points
    r.skip(5)
    const points = r.i32()
    for (let i = 0; i < points; i++) { r.i32(); r.i32(); r.i8() }
  }

  const readBeatEffects = () => {
    if (v.major === 3) {
      const flags = r.u8()
      if (flags & 0x20) {
        const type = r.u8()
        r.i32() // tremolo bar value (type 0) or tapping payload — both 4 bytes
        void type
      }
      if (flags & 0x40) r.skip(2) // strokes
    } else {
      const flags1 = r.u8()
      const flags2 = r.u8()
      if (flags1 & 0x20) r.u8() // tap/slap/pop
      if (flags2 & 0x04) readBendOrBar() // tremolo bar
      if (flags1 & 0x40) r.skip(2) // strokes
      if (flags2 & 0x02) r.i8() // pick stroke
    }
  }

  const readMixChange = () => {
    r.i8() // instrument
    if (v.major === 5) r.skip(16)
    const volume = r.i8()
    const pan = r.i8()
    const chorus = r.i8()
    const reverb = r.i8()
    const phaser = r.i8()
    const trem = r.i8()
    if (v.major === 5) r.strIntByte() // tempo name
    const tempoValue = r.i32()
    for (const p of [volume, pan, chorus, reverb, phaser, trem]) if (p >= 0) r.i8()
    if (tempoValue >= 0) {
      if (tempoValue > 0) tempoState.value = tempoValue
      r.skip(1)
      if (v.major === 5 && v.vc > 0) r.skip(1)
    }
    if (v.major >= 4) r.i8() // apply-to-tracks flags
    if (v.major === 5) {
      r.skip(1)
      if (v.vc > 0) { r.strIntByte(); r.strIntByte() }
    }
  }

  const readNoteEffects = () => {
    if (v.major === 3) {
      const flags = r.u8()
      if (flags & 0x01) readBendOrBar() // bend
      if (flags & 0x10) r.skip(4) // grace note
    } else {
      const flags1 = r.u8()
      const flags2 = r.u8()
      if (flags1 & 0x01) readBendOrBar() // bend
      if (flags1 & 0x10) r.skip(v.major === 5 ? 5 : 4) // grace
      if (flags2 & 0x04) r.u8() // tremolo picking
      if (flags2 & 0x08) r.i8() // slide type
      if (flags2 & 0x10) { // harmonic
        if (v.major === 5) {
          const type = r.i8()
          if (type === 2) r.skip(3)
          else if (type === 3) r.i8()
        } else {
          r.i8()
        }
      }
      if (flags2 & 0x20) r.skip(2) // trill
    }
  }

  interface BeatNote { gpString: number; fret: number; tied: boolean; dead: boolean }

  const readNote = (trackIdx: number, gpString: number): BeatNote => {
    const flags = r.u8()
    let tied = false
    let dead = false
    let fret = -1
    if (flags & 0x20) {
      const type = r.u8()
      tied = type === 0x02
      dead = type === 0x03
    }
    if (v.major < 5 && flags & 0x01) r.skip(2) // independent duration
    if (flags & 0x10) r.i8() // velocity
    if (flags & 0x20) {
      fret = r.i8()
      if (tied) fret = lastFretOnString[trackIdx]![gpString] ?? -1
      if (fret >= 0 && fret < 100) lastFretOnString[trackIdx]![gpString] = fret
      else fret = -1
    }
    if (flags & 0x80) r.skip(2) // fingering
    if (v.major === 5) {
      if (flags & 0x01) r.skip(8)
      r.skip(1)
    }
    if (flags & 0x08) readNoteEffects()
    return { gpString, fret, tied, dead }
  }

  /** Read one beat; returns its duration in quarters (0 = empty GP5 voice). */
  const readBeat = (trackIdx: number, voiceIdx: number, mIdx: number, cursorQ: number): number => {
    const track = tracks[trackIdx]!
    const flags = r.u8()
    let voiceEmpty = false
    if (flags & 0x40) {
      const beatType = r.u8()
      if (v.major === 5) voiceEmpty = (beatType & 0x02) === 0
    }
    const durQ = readDuration(flags)
    if (flags & 0x02) readChord()
    if (flags & 0x04) r.strIntByte() // beat text
    if (flags & 0x08) readBeatEffects()
    if (flags & 0x10) {
      readMixChange()
      // A tempo change applies from the start of its measure (TuxGuitar's
      // measure-granularity model; real charts change tempo at barlines).
      tempoByMeasure[mIdx] = tempoState.value
    }
    const stringFlags = r.u8()
    const notes: BeatNote[] = []
    const stringCount = track.tunings.length
    for (let i = 6; i >= 0; i--) {
      if ((stringFlags & (1 << i)) !== 0 && 6 - i < stringCount) {
        notes.push(readNote(trackIdx, 6 - i))
      }
    }
    if (v.major === 5) {
      r.skip(1)
      const transpose = r.i8()
      if (transpose & 0x08) r.skip(1)
    }
    if (voiceEmpty) return 0

    // --- emit a melody event: highest sounding note of the beat ---
    if (!track.percussion && notes.length) {
      const sounding = notes.filter((n) => !n.dead && n.fret >= 0)
      const midiOf = (n: BeatNote) => (track.tunings[n.gpString] ?? 0) + n.fret + track.offset
      const fresh = sounding.filter((n) => !n.tied)
      const last = lastEvent[trackIdx]![voiceIdx]
      if (!fresh.length && sounding.length && last && Math.abs(last.startQ + last.durQ - cursorQ) < 1e-6) {
        last.durQ += durQ // tie: sustain the previous event
      } else if (fresh.length) {
        const top = fresh.reduce((a, b) => (midiOf(b) > midiOf(a) ? b : a))
        const ev: RawEvent = {
          startQ: cursorQ,
          durQ,
          mIdx,
          midi: midiOf(top),
          string: stringCount - 1 - top.gpString, // app convention: 0 = lowest string
          fret: top.fret,
        }
        trackEvents[trackIdx]!.push(ev)
        lastEvent[trackIdx]![voiceIdx] = ev
      }
    }
    return durQ
  }

  for (let m = 0; m < measureCount; m++) {
    for (let t = 0; t < trackCount; t++) {
      const voices = v.major === 5 ? 2 : 1
      for (let voice = 0; voice < voices; voice++) {
        let cursorQ = measureStartQ[m]!
        const beats = r.i32()
        if (beats < 0 || beats > 1024) throw new Error(`Implausible beat count ${beats} (measure ${m + 1}, track ${t + 1}) — parser misaligned`)
        for (let b = 0; b < beats; b++) cursorQ += readBeat(t, voice, m, cursorQ)
      }
      if (v.major === 5) r.skip(1)
    }
    if (tempoByMeasure[m] === undefined) tempoByMeasure[m] = m > 0 ? tempoByMeasure[m - 1]! : tempo
  }
  // Carry tempo forward over measures without changes (done in-loop above).

  // --- quarters → ms via the per-measure tempo map ---
  const measureStartMs: number[] = new Array(measureCount)
  {
    let ms = 0
    for (let i = 0; i < measureCount; i++) {
      measureStartMs[i] = ms
      ms += (measureQuarters[i]! * 60000) / tempoByMeasure[i]!
    }
  }
  const msOf = (q: number, mIdx: number): number =>
    measureStartMs[mIdx]! + ((q - measureStartQ[mIdx]!) * 60000) / tempoByMeasure[mIdx]!

  // --- assemble candidates (same conventions as the MIDI parser) ---
  const candidates: CandidateTrack[] = []
  let durationMs = 0
  tracks.forEach((track, trackIndex) => {
    if (track.percussion) return
    const events: ParsedNote[] = []
    const sorted = [...trackEvents[trackIndex]!].sort((a, b) => a.startQ - b.startQ || b.midi - a.midi)
    let minMidi = 127
    let maxMidi = 0
    let prev: ParsedNote | null = null
    for (const ev of sorted) {
      const start = Math.round(msOf(ev.startQ, ev.mIdx))
      const end = Math.round(msOf(ev.startQ + ev.durQ, ev.mIdx))
      if (prev && start === prev.start_ms) continue // voice overlap: keep the higher note (sort order)
      if (prev && prev.start_ms + prev.duration_ms > start) prev.duration_ms = start - prev.start_ms // monophonic-ize
      const note: ParsedNote = { midi: ev.midi, start_ms: start, duration_ms: Math.max(1, end - start), string: ev.string, fret: ev.fret }
      events.push(note)
      prev = note
      minMidi = Math.min(minMidi, ev.midi)
      maxMidi = Math.max(maxMidi, ev.midi)
      durationMs = Math.max(durationMs, end)
    }
    if (!events.length) return
    candidates.push({
      trackIndex,
      channel: 0,
      name: track.name || `Track ${trackIndex + 1}`,
      noteCount: events.length,
      minMidi,
      maxMidi,
      suggested: VOCAL_NAME.test(track.name),
      // App-order tuning (low → high), for exact fretboard rendering.
      tuning: [...track.tunings].reverse().map((t) => t + track.offset),
      events,
    })
  })
  candidates.sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.trackIndex - b.trackIndex)

  return {
    format: v.major,
    trackCount,
    durationMs: Math.round(durationMs),
    tempoBpm: tempo,
    hasLyrics: !!lyricsText,
    ...(lyricsText ? { lyricsText } : {}),
    candidates,
    ...(title || artist ? { prefill: { title, artist } } : {}),
  }
}
