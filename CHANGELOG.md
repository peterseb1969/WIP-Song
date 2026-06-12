# Changelog

## Unreleased

- Song detail: ▶ Play melody — synthesizes imported note data (MIDI carries
  no audio) with a moving playhead; skips leading silence.
- Practice: live tuner readout while recording (note name, cents, Hz).
- Fix: browser file uploads now pass the required namespace form field.
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
