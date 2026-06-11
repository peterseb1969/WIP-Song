# Known issues & deliberate deferrals

Status: end of the first build session (2026-06-11, updated after the
CASE-448/449/450 fixes landed the same evening).

## Needs human verification

- **Practice-player audio is untested with a real microphone.** The pipeline
  (capture → pitch detection → scoring → save) is unit-tested and the save
  path verified over the wire, but no human has sung into it yet — Peter's
  machine had no mic connected at test time.
- **.kar syllable alignment is heuristic-only** — no .kar sample file has
  been parsed yet (IMPORT_FORMATS.md).
- **`wip-deploy install --app-source` acceptance run not yet executed**
  (contract verification step 3). Dockerfiles + manifest are in place.

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
