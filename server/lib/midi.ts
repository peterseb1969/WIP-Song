/**
 * Minimal Standard MIDI File reader for the import flow. Produces canonical
 * note events ({midi, start_ms, duration_ms, syllable?}) per melody-candidate
 * track. Shaped by the realities of the first sample file (see
 * IMPORT_FORMATS.md): track "names" arriving as text (0x01) events, multiple
 * vocal candidates, a multi-event tempo map, running status, and
 * note-on-velocity-0 as note-off. Lyrics (0x05, or .kar-style 0x01 syllables)
 * are optional.
 */

export interface ParsedNote {
  midi: number
  start_ms: number
  duration_ms: number
  syllable?: string
  /** Exact fretboard position (Guitar Pro imports): 0 = lowest string. */
  string?: number
  fret?: number
}

export interface CandidateTrack {
  trackIndex: number
  channel: number
  name: string
  noteCount: number
  minMidi: number
  maxMidi: number
  /** Name matches a vocal/melody heuristic. */
  suggested: boolean
  /** Open-string MIDI values, low → high (Guitar Pro imports). */
  tuning?: number[]
  events: ParsedNote[]
}

export interface ParsedMidi {
  format: number
  trackCount: number
  durationMs: number
  /** BPM of the first tempo event (display only — conversion uses the full map). */
  tempoBpm: number
  hasLyrics: boolean
  /** Joined lyric text (for SONG_TRACK.lyrics_text), when present. */
  lyricsText?: string
  candidates: CandidateTrack[]
  /** Title/artist carried inside the file (Guitar Pro); beats the filename heuristic. */
  prefill?: { title: string; artist: string }
}

interface RawNote {
  tick: number
  midi: number
  durTicks: number
}

interface LyricEvent {
  tick: number
  text: string
}

export const VOCAL_NAME = /vo[xci]|melod|lead(?!\s*g)|sing|kara|gesang|stimme/i

class Reader {
  pos = 0
  constructor(private buf: Buffer) {}
  u8(): number { return this.buf[this.pos++]! }
  peek(): number { return this.buf[this.pos]! }
  u16(): number { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v }
  u32(): number { const v = this.buf.readUInt32BE(this.pos); this.pos += 4; return v }
  bytes(n: number): Buffer { const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v }
  vlq(): number {
    let v = 0
    for (;;) {
      const b = this.u8()
      v = (v << 7) | (b & 0x7f)
      if (!(b & 0x80)) return v
    }
  }
}

export function parseMidi(buf: Buffer): ParsedMidi {
  const r = new Reader(buf)
  if (r.bytes(4).toString('latin1') !== 'MThd') throw new Error('Not a MIDI file (missing MThd)')
  const headerLen = r.u32()
  const format = r.u16()
  const trackCount = r.u16()
  const division = r.u16()
  if (division & 0x8000) throw new Error('SMPTE time division is not supported')
  r.pos += headerLen - 6

  const tempoMap: Array<{ tick: number; usPerQn: number }> = []
  const tracks: Array<{ name: string; notes: Map<number, RawNote[]>; lyrics: LyricEvent[]; texts: LyricEvent[] }> = []

  for (let t = 0; t < trackCount; t++) {
    if (r.bytes(4).toString('latin1') !== 'MTrk') throw new Error(`Track ${t}: missing MTrk`)
    const len = r.u32()
    const end = r.pos + len

    let tick = 0
    let running = 0
    let name = ''
    const notes = new Map<number, RawNote[]>()
    const open = new Map<string, RawNote>() // "ch:midi" → note awaiting its off
    const lyrics: LyricEvent[] = []
    const texts: LyricEvent[] = []

    const noteOn = (ch: number, midi: number) => {
      const note: RawNote = { tick, midi, durTicks: 0 }
      if (!notes.has(ch)) notes.set(ch, [])
      notes.get(ch)!.push(note)
      open.set(`${ch}:${midi}`, note)
    }
    const noteOff = (ch: number, midi: number) => {
      const key = `${ch}:${midi}`
      const note = open.get(key)
      if (note) {
        note.durTicks = tick - note.tick
        open.delete(key)
      }
    }

    while (r.pos < end) {
      tick += r.vlq()
      let status = r.peek()
      if (status === 0xff) {
        r.pos++
        const metaType = r.u8()
        const metaLen = r.vlq()
        const payload = r.bytes(metaLen)
        if (metaType === 0x03 && !name) name = payload.toString('latin1').trim()
        else if (metaType === 0x05) lyrics.push({ tick, text: payload.toString('latin1') })
        else if (metaType === 0x01) texts.push({ tick, text: payload.toString('latin1') })
        else if (metaType === 0x51) tempoMap.push({ tick, usPerQn: (payload[0]! << 16) | (payload[1]! << 8) | payload[2]! })
      } else if (status === 0xf0 || status === 0xf7) {
        r.pos++
        r.pos += r.vlq()
      } else {
        if (status & 0x80) { r.pos++; running = status } else status = running
        const hi = status & 0xf0
        const ch = status & 0x0f
        if (hi === 0x90) {
          const midi = r.u8(); const vel = r.u8()
          if (vel > 0) noteOn(ch, midi)
          else noteOff(ch, midi)
        } else if (hi === 0x80) {
          const midi = r.u8(); r.u8()
          noteOff(ch, midi)
        } else if (hi === 0xc0 || hi === 0xd0) {
          r.u8()
        } else {
          r.u8(); r.u8()
        }
      }
    }
    // Close any hanging notes at track end.
    for (const note of open.values()) note.durTicks = Math.max(note.durTicks, division)

    // The sample file carries track labels as 0x01 text at tick 0, not 0x03.
    if (!name) {
      const early = texts.find((x) => x.tick === 0 && !x.text.startsWith('@'))
      if (early) name = early.text.trim()
    }
    tracks.push({ name, notes, lyrics, texts })
    r.pos = end
  }

  // --- tick → ms via the tempo map ---
  tempoMap.sort((a, b) => a.tick - b.tick)
  if (!tempoMap.length || tempoMap[0]!.tick > 0) tempoMap.unshift({ tick: 0, usPerQn: 500_000 })
  const msOfTick = (tick: number): number => {
    let ms = 0
    for (let i = 0; i < tempoMap.length; i++) {
      const seg = tempoMap[i]!
      const segEnd = i + 1 < tempoMap.length ? tempoMap[i + 1]!.tick : Infinity
      if (tick <= seg.tick) break
      const span = Math.min(tick, segEnd) - seg.tick
      ms += (span * seg.usPerQn) / division / 1000
      if (tick <= segEnd) break
    }
    return ms
  }

  // --- lyric syllables (.kar files use 0x01 text events; real lyric meta is 0x05) ---
  const lyricEvents: LyricEvent[] = []
  for (const tr of tracks) {
    if (tr.lyrics.length) lyricEvents.push(...tr.lyrics)
    else if (tr.texts.length > 20) {
      // .kar-style: many text events on a lyric track; skip @-directives.
      lyricEvents.push(...tr.texts.filter((x) => !x.text.startsWith('@') && x.tick > 0))
    }
  }
  lyricEvents.sort((a, b) => a.tick - b.tick)

  // --- melody candidates: per (track, channel), excluding drums (ch 9) ---
  const candidates: CandidateTrack[] = []
  let durationMs = 0
  tracks.forEach((tr, trackIndex) => {
    for (const [channel, rawNotes] of tr.notes) {
      if (channel === 9 || !rawNotes.length) continue

      // Monophonic-ize: truncate a note at the next note's start when overlapping.
      const sorted = [...rawNotes].sort((a, b) => a.tick - b.tick)
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i]!
        const next = sorted[i + 1]!
        if (cur.tick + cur.durTicks > next.tick) cur.durTicks = next.tick - cur.tick
      }

      let li = 0
      const events: ParsedNote[] = []
      let minMidi = 127
      let maxMidi = 0
      for (const n of sorted) {
        if (n.durTicks <= 0) continue
        const start = Math.round(msOfTick(n.tick))
        const dur = Math.max(1, Math.round(msOfTick(n.tick + n.durTicks) - start))
        const ev: ParsedNote = { midi: n.midi, start_ms: start, duration_ms: dur }
        // Attach the next pending syllable that falls at/just before this note.
        while (li < lyricEvents.length && lyricEvents[li]!.tick < n.tick - division / 4) li++
        if (li < lyricEvents.length && Math.abs(lyricEvents[li]!.tick - n.tick) <= division / 4) {
          const text = lyricEvents[li]!.text.replace(/[\r\n/\\]/g, ' ').trim()
          if (text) ev.syllable = text
          li++
        }
        events.push(ev)
        minMidi = Math.min(minMidi, n.midi)
        maxMidi = Math.max(maxMidi, n.midi)
        durationMs = Math.max(durationMs, start + dur)
      }
      if (!events.length) continue

      candidates.push({
        trackIndex,
        channel,
        name: tr.name || `Track ${trackIndex} / ch ${channel + 1}`,
        noteCount: events.length,
        minMidi,
        maxMidi,
        suggested: VOCAL_NAME.test(tr.name),
        events,
      })
    }
  })
  // Suggested tracks first, then by track order.
  candidates.sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.trackIndex - b.trackIndex)

  const lyricsText = lyricEvents.length
    ? lyricEvents.map((l) => l.text).join('').replace(/\\/g, '\n').replace(/\//g, '\n').trim()
    : undefined

  return {
    format,
    trackCount,
    durationMs: Math.round(durationMs),
    tempoBpm: Math.round(60_000_000 / tempoMap[0]!.usPerQn),
    hasLyrics: lyricEvents.length > 0,
    ...(lyricsText ? { lyricsText } : {}),
    candidates,
  }
}
