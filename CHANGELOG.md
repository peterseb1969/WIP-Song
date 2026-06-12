# Changelog

## Unreleased

- Song detail: ▶ Play melody — synthesizes imported note data (MIDI carries
  no audio) with a moving playhead; skips leading silence.
- Practice: live tuner readout while recording (note name, cents, Hz).
- Fix: browser file uploads now pass the required namespace form field.
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
