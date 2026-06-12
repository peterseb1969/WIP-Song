# WIP-Song

A song teaching and singing app built on [WIP](https://github.com/) (World In
a Pie). Sing into your microphone, see your pitch live against the target
melody, get scored, and work through lessons — with both a **piano-roll** and
a **guitar-fretboard** view of every melody.

## What it does

- **Practice**: drills (pitch matching, scales, song sections) play a
  reference, record your singing, draw your detected pitch live over the
  target notes, and score pitch/rhythm/overall. Octave-equivalent singing
  earns partial credit (guitarists sing where they play).
- **Songs**: import MIDI/.kar files (melody-track picker, tempo-map aware),
  browse the library, play backing tracks, step through melodies on the
  fretboard.
- **Lessons**: ordered exercise sequences with per-singer progress (completion
  threshold 70). Progress history comes free from WIP document versioning.
- **Progress**: every attempt is stored with its recording — listen back,
  watch scores improve.
- **Multi-user**: identity via OIDC (gateway header → session → local-dev
  fallback); one `SONG_SINGER` profile per subject.

## Running locally

Prerequisites: Node 20+, a WIP instance at `https://localhost:8443`
(`wip-deploy install --target dev`), and a `.env`:

```
WIP_API_KEY=<runtime key scoped to dev-wip-song>
```

The key needs a **write grant** on the namespace — see CLAUDE.md "API Key"
(CASE-450 documents the gotcha, including the `apikey:` subject prefix).

```bash
npm ci          # @wip/* libs are vendored tarballs in libs/
npm run dev     # Express on :3016 + Vite on :5181
open http://localhost:5181
```

First launch against a fresh WIP shows the **bootstrap gate** (offer-on-empty):
one click seeds the namespace from `server/seed/`. An existing namespace is
used as-is.

```bash
npm test        # unit tests + live data-layer tests (skipped if WIP is down)
```

## Deployment

The app satisfies the wip-deployable app contract (verified 2026-06-12:
`check-app-deployability` 7/7, dev install healthy, app live at
`https://localhost:8443/apps/song/`): `Dockerfile.dev` (dev override),
two-stage `Dockerfile` (`VITE_BASE_PATH` build ARG, health check independent
of WIP), base-path-aware client/server, and `apps/song/wip-app.yaml` in the
WIP repo (ports 3016/5181, `/apps/song`).

```bash
wip-deploy install --target dev --app song --app-source song=~/Development/WIP-Song
```

The app lives at the repo root, so the repo itself is the `--app-source`
path. In dev mode the checkout is bind-mounted into the container (source
edits hot-reload); dependency changes need `wip-deploy rebuild song`.

For production, `.github/workflows/build.yaml` (manual trigger) builds and
pushes the image to GHCR; the `@wip/*` tarballs are tracked in `libs/` so CI
has the full build context.

## WIP data model

Namespace `dev-wip-song` (production: `wip-song`): 8 terminologies and 7
templates (`SONG_SINGER`, `SONG_TRACK`, `SONG_EXERCISE`, `SONG_LESSON`,
`SONG_ATTEMPT`, `SONG_PROGRESS`, `BOOTSTRAP_RECORD`). Full design +
implementation record: **DESIGN.md**. Declarative seed files: `data-model/`
(git) and `server/seed/` (bootstrap). Dependencies and identity choices:
**WIP_DEPENDENCIES.md**.

## More docs

- `DESIGN.md` — data model + UI plan + decisions (start here)
- `ARCHITECTURE.md` — code structure and data flow
- `IMPORT_FORMATS.md` — file-format mappings and quirks
- `KNOWN_ISSUES.md` — gaps and deferrals
- `CHANGELOG.md`
