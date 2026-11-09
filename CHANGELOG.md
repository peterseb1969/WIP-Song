# Changelog

## Unreleased

- Served at the root of its own origin, `https://song.<host>/` (CASE-1115,
  after WIP's CASE-1103 removed path mode). The `APP_BASE_PATH` /
  `VITE_BASE_PATH` plumbing is gone from Vite, the server, the Dockerfile and
  CI; the image is built at Vite's default base `/`. Unmatched API paths
  (`/api`, `/auth`, `/wip`, `/server-api`, `/mcp`) answer 404 JSON instead of
  `index.html`; the server trusts the edge proxy so the secure session cookie
  is set; the image starts tsx by path (tsx is now a runtime dependency).
  Libraries: `@wip/client` 0.107.0, `@wip/proxy` 0.9.0, `@wip/react` 0.26.1.

- Range-aware transposition on the practice page: a ±semitone control plus
  a one-click suggestion ("Transpose −12 for your range") derived from the
  singer's profile range (explicit low/high beats the voice-type default;
  octave shifts only, so the melody keeps its key). Listening, the live
  trace, and scoring all run in the transposed register; exact fret
  positions are dropped while transposed; lesson progress COUNTS — singing
  in your own octave is the fair version of the exercise, not a shortcut.

- Classical notation view: a third renderer next to piano roll and
  fretboard — five-line staff with auto clef (treble / treble-8vb for low
  voices and guitar / bass), note heads with stems and flags by duration,
  sharps, ledger lines, syllables, playhead + follow-scroll and the shared
  zoom. Proportional layout (x = time, like the roll) — deliberately not
  engraved notation: no bar lines (time signatures aren't in the data
  model), no beaming/rests; engraved rendering would be a VexFlow-class
  dependency and its own decision. View pills are now independent toggles.

- Zoom + follow-scroll for the piano roll: −/+ zoom control (25%–400%) in
  the note-view toolbar, zoom keeps the viewport centered; during playback
  and recording the roll auto-scrolls so the playhead stays ~35% into view
  and the notes glide under it.

- Markers by mouse: click empty piano-roll space to drop a marker there
  (auto-named); each marker now has a fat flag handle at the top of its
  line — click it to remove. Drag across the roll to create a RANGE marker
  (live highlight while dragging; ranges become loop presets on the
  practice page). Note clicks still select for the fretboard.

- Song detail: ▶ Play melody — synthesizes imported note data (MIDI carries
  no audio) with a moving playhead; skips leading silence.
- Practice: live tuner readout while recording (note name, cents, Hz).
- Fix: browser file uploads now pass the required namespace form field.
- Fix: the namespace-scoping middleware is now an allowlist of exactly
  `POST /documents/query` — the only endpoint that needs and accepts
  `?namespace=`. The blanket version broke file uploads AND document
  creates/PATCHes (each endpoint spells namespace differently and 422s on
  unknown query params). Found by Peter's import tests.
- Markers (SONG_TRACK v2): name positions/ranges in a song ("Chorus",
  "the hard bit") on the song page; they draw on the piano roll and ranged
  markers become one-click loop presets on the practice page. Existing
  documents migrate to template v2 transparently on first marker save;
  re-imports now merge over existing songs so markers/audio/metadata edits
  survive. Fix: document PATCHes apply at the data level (the audio-upload
  PATCH was wrapped in {data:…} and would have failed).
- Loops: practice a note range on repeat. Toggle Loop on the practice page,
  pick the range (notes m–n); Listen repeats it (synth or backing-track
  slice, at any speed) until stopped, and a sung take is scored against the
  range only. Loop takes save as attempts but never count toward lesson
  progress — completing an exercise still requires the whole thing.
- Background-track upload: the song page's backing-track and full-mix
  sections now upload/replace audio (MP3/WAV/OGG…) — file goes to WIP
  storage with its real MIME, then a PATCH sets just that field (new
  document version; melody and identity untouched). Karaoke-style practice
  needs no console detour anymore.
- Fretboard view honors exact tab positions: on Guitar Pro imports the
  played string+fret is THE emphasized marker (alternatives faint, caption
  "from the tab"), and the board renders the track's actual tuning and
  string count (bass tracks get 4 strings).
- Guitar Pro 3/4/5 import (.gp3/.gp4/.gp5): dependency-free parser (byte
  layout from TuxGuitar's readers), file-internal title/artist prefill,
  per-track tunings, and exact string+fret positions on every melody event
  (`melody.tuning`, `events[].string/fret`). Data model: `GUITAR_PRO` term
  added to SONG_SOURCE_FORMAT (additive). GP6/GP7 containers still planned.
- Multi-track MIDI import: select several tracks in one go — one song per
  track, shared original file, track names appended to titles (identity is
  title+artist). Guitar Pro import added to the planned-formats list.
- Fix: songs invisible when the app runs on a multi-namespace (admin) API
  key — e.g. the wip-deploy dev render. The server proxy now pins every
  unscoped WIP call to the app namespace via `?namespace=`; under the
  single-namespace runtime key this matches automatic derivation.
- Playback speed (0.5×/0.75×/1×, pitch-preserving) on the song page and the
  practice page — applies to reference playback, backing tracks, and
  sing-along (scoring maps the slowed take onto the target timeline).
- .kar syllable handling verified via a synthetic Soft-Karaoke test file
  (7 new tests): cross-track syllable attachment, line-marker stripping,
  @-directive exclusion, lyric-track gate, 0x05 precedence.
- Deployment verified (2026-06-12): `check-app-deployability` 7/7; included
  in a wip-deploy dev install via `--app-source` (container healthy, live at
  `/apps/song/`); manifest committed in World-in-a-Pie. Production image
  builds via GHCR workflow (`@wip/*` tarballs tracked in-repo, CASE-442);
  runtime stage installs wget for the healthcheck probe (b2f664c). Docs
  updated (README, KNOWN_ISSUES).

## 0.1.0 — 2026-06-11

First build session (Phases 1–4 in one day):

- Data model in `dev-wip-song`: 8 terminologies (79 terms), 7 templates;
  approved design + implementation record in DESIGN.md; seed files exported
  to `data-model/` and `server/seed/`.
- App foundation: @wip/client/react/proxy wiring, BootstrapGate
  (offer-on-empty / use-on-exists), top-nav layout, ports 3016/5181.
- Singer profiles keyed by OIDC subject (gateway/session/local-dev fallback).
- Songs library + song detail; **piano-roll and guitar-fretboard renderers**
  with per-singer view preference.
- MIDI/.kar import: dependency-free SMF parser (tempo-map aware,
  melody-track picker), original-file storage.
- Practice player: reference tones, mic recording, live autocorrelation pitch
  trace, per-note scoring with octave-equivalence credit, SONG_ATTEMPT +
  recording persisted; song-section karaoke mode with backing-track slices.
- Lessons with per-singer progress (SONG_PROGRESS versioning as history),
  progress page with attempt playback, home dashboard.
- Tests (21: unit + live data-layer), deployable-app contract surfaces
  (Dockerfile.dev/Dockerfile/.dockerignore, `apps/song/wip-app.yaml`).
- Platform cases filed: CASE-448 (audio MIME), CASE-449 (MCP upload_file),
  CASE-450 (namespace grants exposure).
