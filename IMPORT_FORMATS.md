# Import formats

How imported files map onto WIP-Song's canonical note events
(`{midi, start_ms, duration_ms, syllable?}`) and the `SONG_TRACK` template.
Documented per format as parsers land (build-app playbook, Step 3b).

## Standard MIDI (.mid, .midi) — implemented 2026-06-11

Parser: `server/lib/midi.ts` (no dependencies; minimal SMF reader).
Endpoint: `POST /server-api/import/parse?filename=…` with raw bytes as
`application/octet-stream`.

| Source | Mapping |
|---|---|
| Note on/off per (track, channel) | One melody **candidate** per pair; user picks **one or more** in the import dialog (multi-select since 2026-06-12). Channel 10 (drums) excluded. Vocal-looking names (`vox/vocal/melod/lead/sing/kara`) sorted first and starred. |
| Multiple tracks selected | One `SONG_TRACK` document per track, sharing one uploaded original file. SONG_TRACK identity is `(title, artist)`, so multi-track imports append the track name to each title — `Bohemian Rhapsody (Lead Vox)` — plus the channel when names collide. Single-track imports keep the plain title. |
| Note-on velocity 0 | Treated as note-off (running-status files use this heavily). |
| Overlapping notes in a candidate | Monophonic-ized: a note is truncated at the next note's start. |
| Tempo meta (0x51), all of them | Tick→ms conversion walks the full tempo map (sample file has 3 tempo changes). `tempo_bpm` stores the *first* tempo for display. |
| Track-name meta (0x03) | Candidate name — BUT real files (the Bohemian Rhapsody sample) often carry names as text events (0x01) at tick 0 instead; used as fallback. |
| Lyric meta (0x05) | Syllables, attached to the note starting within ±¼ quarter-note. Joined (with `/` and `\` as line breaks) into `lyrics_text`. |
| Time division | Ticks/quarter only. SMPTE division is rejected with a clear error. |
| Filename `Artist - Title.mid` | Prefills `artist` / `title` (identity fields — re-importing the same song updates it, PoNIF #3). |
| Original file | Stored via WIP file storage as `audio/midi` (CASE-448 implemented) and linked in `original_file`. |

Quirks observed in the first sample (`Queen - Bohemian Rhapsody.mid`,
format 1, 14 tracks, 192 tpqn): no lyrics at all; two vocal candidates
("Lead Vox", "Lead Vox 2"); all track labels as 0x01 text events; vocals
enter at ~52 s.

## MIDI karaoke (.kar) — implemented (same parser), verified synthetically

Same SMF structure; syllables conventionally arrive as text events (0x01)
rather than lyric meta. Heuristic: a track with >20 text events is treated as
a lyric track; `@`-prefixed directives (`@T` title, `@I` info…) are skipped;
`/` (line) and `\` (verse) prefixes are stripped from per-note syllables and
become line breaks in `lyrics_text`.

Verified against a byte-exact synthetic Soft-Karaoke file
(`tests/unit/kar.test.ts`): cross-track attachment (Words track ↔ separate
melody track), marker stripping, directive exclusion, the >20-event gate
(sparse text annotations are not mistaken for lyrics), and 0x05-lyric
precedence. A real-world .kar exercise is still welcome — wild files carry
encoding quirks no synthetic covers.

## Planned, not implemented

- **Guitar Pro (.gp3/.gp4/.gp5/.gpx/.gp)** — requested by Peter 2026-06-12
  (he's a guitarist). Two format families: the classic binary formats
  (.gp3–.gp5, reverse-engineered and well documented) and the modern
  container formats (.gpx is a proprietary "BCFZ" archive; .gp since GP7 is
  a zip holding `Content/score.gpif` XML). Notes carry string+fret — exact
  fretboard positions for the fretboard view, no position inference needed —
  plus rhythm, tempo map, and per-track tuning. Likely first cut: the
  classic binary family and/or GP7 zip+XML (both dependency-free); .gpx
  (BCFZ) last. Multi-track import (2026-06-12) already gives each track a
  home. **Samples on hand** (`test-data/`, verified magic bytes): GP3 v3.00
  (Pushed Again), GP4 v4.0 (sweet-ballroom-blitz), GP5 v5.0 (Liebeslied),
  GP5 v5.1 (Nena — v5.1 deviates from v5.0, both needed), GPX/BCFZ (EASY
  RIFFS), GP7+ zip (TheManWhoSoldTheWorld, `Content/score.gpif` is 110 KB
  of plain XML).
- **UltraStar (.txt)** — `: start dur pitch syllable` lines; pitches relative
  to a `#GAP`/`#BPM` header. Candidate for the next import iteration.
- **LRC (.lrc)** — lyrics+timing only (no pitch); would attach syllables to an
  existing melody.
- **MP3+G (.cdg)** — graphics-based karaoke; lyrics not machine-readable.
  Original file storage only; no melody extraction.
- **MusicXML (.musicxml/.mxl)** — full notation; melody extraction feasible
  later.
- **Plain audio (MP3/WAV/OGG)** — stored as `audio_full`/`audio_backing`
  files; no melody extraction (pitch-tracking import is a future feature).
