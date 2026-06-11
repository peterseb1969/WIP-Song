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
| Note on/off per (track, channel) | One melody **candidate** per pair; user picks in the import dialog. Channel 10 (drums) excluded. Vocal-looking names (`vox/vocal/melod/lead/sing/kara`) sorted first and starred. |
| Note-on velocity 0 | Treated as note-off (running-status files use this heavily). |
| Overlapping notes in a candidate | Monophonic-ized: a note is truncated at the next note's start. |
| Tempo meta (0x51), all of them | Tick→ms conversion walks the full tempo map (sample file has 3 tempo changes). `tempo_bpm` stores the *first* tempo for display. |
| Track-name meta (0x03) | Candidate name — BUT real files (the Bohemian Rhapsody sample) often carry names as text events (0x01) at tick 0 instead; used as fallback. |
| Lyric meta (0x05) | Syllables, attached to the note starting within ±¼ quarter-note. Joined (with `/` and `\` as line breaks) into `lyrics_text`. |
| Time division | Ticks/quarter only. SMPTE division is rejected with a clear error. |
| Filename `Artist - Title.mid` | Prefills `artist` / `title` (identity fields — re-importing the same song updates it, PoNIF #3). |
| Original file | Stored via WIP file storage as `application/octet-stream` (CASE-448: the file store rejects audio/* and there's no `audio/midi` either) and linked in `original_file`. |

Quirks observed in the first sample (`Queen - Bohemian Rhapsody.mid`,
format 1, 14 tracks, 192 tpqn): no lyrics at all; two vocal candidates
("Lead Vox", "Lead Vox 2"); all track labels as 0x01 text events; vocals
enter at ~52 s.

## MIDI karaoke (.kar) — implemented (same parser), unverified

Same SMF structure; syllables conventionally arrive as text events (0x01)
rather than lyric meta. Heuristic: a track with >20 text events is treated as
a lyric track; `@`-prefixed directives (`@T` title, `@I` info…) are skipped.
**No .kar sample tested yet — verify with a real file before trusting the
syllable alignment.**

## Planned, not implemented

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
