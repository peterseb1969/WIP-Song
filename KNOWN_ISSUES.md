# Known issues & deliberate deferrals

Status: end of the first build session (2026-06-11, updated after the
CASE-448/449/450 fixes landed the same evening).

## Needs human verification

- ~~Practice-player audio untested with a real microphone~~ **VERIFIED
  2026-06-11**: Peter sang against the A4 drill; detection read his low
  register plausibly (G2/A♭2), scoring behaved as designed (octave rule),
  attempts + audio/webm recordings persisted. Surfaced one bug (uploadFile
  needed the namespace arg — fixed in 78a7176).
- **.kar syllable alignment is heuristic-only** — no .kar sample file has
  been parsed yet (IMPORT_FORMATS.md).
- **`wip-deploy install --app-source` acceptance run not yet executed**
  (contract verification step 3). Dockerfiles + manifest are in place.

## Observations from the first human test

- **A4 drills are brutal for low voices** — Peter (baritone, range top =
  exactly A4) landed at A♭2. Range-aware target transposition (suggest the
  singer's octave, score against it) should move up the priority list.
- Minor data hygiene: two dev-session test attempts carry naive (no-Z)
  `recorded_at` strings that lexically sort above real UTC timestamps; app
  writes are proper ISO-Z. Harmless (different singer), but don't hand-write
  timestamps into attempt docs.

## Resolved platform issues (same day)

- **CASE-448** (audio MIME) — implemented and live; SONG_ATTEMPT is at **v3**
  with `["audio/*", "video/webm"]`, the app uploads real MIME types
  (audio/webm recordings, audio/midi imports), octet-stream workaround
  retired. Files uploaded during the workaround window remain typed
  octet-stream (playable; re-upload only if hygiene matters).
- **CASE-449** (MCP upload_file) — fixed; verified from this app's session.
- **CASE-450** (grants) — implemented; `create_api_key` takes
  `grant_permission`, grant subjects are canonical, MCP grant tools exist.

## Deferred by design (v1 scope cuts — DESIGN.md)

- Lesson/exercise **authoring UI** (curriculum is seed-data only).
- UltraStar / LRC / CDG / MusicXML import; audio-only import.
- Free practice on a whole song from Song detail (button present, disabled —
  needs either ad-hoc exercises or a song_ref-only practice mode; the
  SONG_ATTEMPT template already supports it).
- Alternate guitar tunings, capo, chord shapes, tab-timeline view, sheet-music
  notation (notation = future cased dependency).
- Per-skill scoring vocabulary; transposition suggestions from vocal range.
- Component-level UI tests and a Playwright E2E flow (Guide 7 calls for
  them; unit + live data-layer tests exist — see `tests/`). Add before
  calling the definition of done fully met.

## Quirks to remember

- `useDocuments`/GET `/documents` returns one row per document **version** —
  always use `useQueryDocuments` for lists (ARCHITECTURE.md).
- The WIP compose stack restarted itself once during development (~22:06,
  2026-06-11); transient 502s, recovered alone. Watch for recurrence.
