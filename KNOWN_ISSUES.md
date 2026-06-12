# Known issues & deliberate deferrals

Status: end of the first build session (2026-06-11, updated after the
CASE-448/449/450 fixes landed the same evening; deployment verifications
added 2026-06-12).

## Needs human verification

- ~~Practice-player audio untested with a real microphone~~ **VERIFIED
  2026-06-11**: Peter sang against the A4 drill; detection read his low
  register plausibly (G2/A♭2), scoring behaved as designed (octave rule),
  attempts + audio/webm recordings persisted. Surfaced one bug (uploadFile
  needed the namespace arg — fixed in 78a7176).
- ~~.kar syllable alignment is heuristic-only~~ **VERIFIED 2026-06-12**
  against a synthetic Soft-Karaoke file (`tests/unit/kar.test.ts`) — all
  heuristics behave as designed. A real-world .kar would still add value
  (encoding quirks), but the logic is no longer untested.
- ~~`wip-deploy install --app-source` acceptance run not yet executed~~
  **VERIFIED 2026-06-12**: `check-app-deployability` passed 7/7 and a full
  dev reinstall included `--app-source song=~/Development/WIP-Song`;
  container healthy, app live at `https://localhost:8443/apps/song/` behind
  the auth gateway. The manifest is committed in World-in-a-Pie (6093751).
  Operational notes from that run:
  - Song's app lives at the **repo root** — pass the repo itself as the
    `--app-source` path (unlike clintrial/dnd, which need a subdirectory).
  - Dev hot-wiring bind-mounts the checkout rw at `/app` with a named
    volume shadowing `/app/node_modules` — source edits reload instantly,
    but **dependency changes need `wip-deploy rebuild song`**.
  - The dev container gets `WIP_API_KEY=${API_KEY}` — the **install admin
    key**, not the scoped `wip-song-dev` runtime key. The CASE-450 grant
    setup applies to the scoped-key path only.
  - `wip-deploy add-app` was blocked by stale deployer state (filed
    upstream as CASE-455); the full reinstall was the workaround.
  Separately, the production image is deployed as a **cloud container**
  (GHCR image from `.github/workflows/build.yaml`); that path surfaced the
  missing-wget healthcheck failure fixed in b2f664c.

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

## Backlog from Peter (2026-06-11, end of first session)

- ~~Playback speed~~ **DONE 2026-06-12**: 0.5×/0.75×/1× picker on the song
  page (melody synth + playhead) and the practice page (reference, backing
  track via pitch-preserving `playbackRate`, and sing-along — wall-clock
  samples are mapped onto the target timeline before scoring). Caveat: a
  saved attempt does not record the speed it was sung at — SONG_ATTEMPT has
  no such field (adding one = data-model change, Rule 6); a 0.5× attempt
  scores like any other.
- ~~Loops~~ **DONE 2026-06-12**: note-range loop on the practice page —
  repeated listen (synth + backing slice), range-scoped scoring, lesson
  progress deliberately not counted on loop takes. Time-range/marker-anchored
  loops arrive with markers.
- ~~Markers~~ **DONE 2026-06-12** (through Phase 2/3: SONG_TRACK v2 adds
  `markers` array, v1 deactivated, seeds exported): marker editor on the
  song page (add at playhead / by time, delete), marker lines+ranges drawn
  on the piano roll, range markers appear as one-click **loop presets** on
  the practice page. v1-pinned docs migrate transparently on first marker
  save; re-imports preserve markers (merge-over-existing). Deferred:
  jump-to-marker playback, marker rename (delete+add for now).
- ~~Background tracks~~ **DONE 2026-06-12**: upload/replace UI for
  audio_backing and audio_full on the song page (`AudioTrackUpload.tsx`);
  real MIME enforced (extension fallback map — octet-stream would be
  rejected by the audio/* file_config).
- Range-aware transposition (from the first mic test — A4 drills are brutal
  for low voices).

## Backlog from Peter (2026-06-12)

- **Zoom in/out** — zoom the note views (piano roll / fretboard timeline) in
  and out; long songs are cramped at the fixed px-per-second scale.
- **Smooth scrolling** (Peter, 2026-06-12 evening) — the note view should
  scroll smoothly with playback/recording so the playhead stays in view
  (long songs run off-screen today); pairs with zoom as one viewport rework.

- ~~Guitar Pro import~~ **GP3/4/5 DONE 2026-06-12** (`server/lib/gp.ts`,
  12 tests against the four-sample corpus; exact string+fret+tuning stored
  on melody events). Still open: **GP6/GP7 (.gpx/.gp)** container formats —
  workaround: export as .gp5. Also open: per-note GP lyric syllables, repeat
  expansion (see IMPORT_FORMATS.md).
- ~~Multi-track MIDI import~~ **DONE 2026-06-12**: the import dialog
  multi-selects tracks; one SONG_TRACK per track, shared original file,
  track names appended to titles to keep identities distinct.

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

- **Multi-namespace (admin) keys get no namespace derivation** — under the
  wip-deploy dev render the container runs on the install admin key, and
  reads with value-form template IDs silently return zero rows ("no songs
  after redeploy", 2026-06-12). Fixed by a server middleware that appends
  `?namespace=` to every proxied WIP call that isn't already scoped
  (`server/index.ts`). The injection is an ALLOWLIST of exactly one
  endpoint — `POST /documents/query` — because the namespace spelling is
  per-endpoint (found the hard way via Peter's import tests, 2026-06-12):
  query accepts `?namespace=`; the files API wants a multipart form field
  and 422s on the query param; document writes/PATCH want it in the body
  and ALSO 422 on the query param; `namespace` in the query body is
  `extra_forbidden`. Blanket injection broke uploads and saves. Noted on
  CASE-457.

- `useDocuments`/GET `/documents` returns one row per document **version** —
  always use `useQueryDocuments` for lists (ARCHITECTURE.md).
- The WIP compose stack restarted itself once during development (~22:06,
  2026-06-11); transient 502s, recovered alone. Watch for recurrence.
