# Architecture

## Shape

Browser SPA (React 19 + Vite + Tailwind 3, canonical stack) + a thin Express
server. **All WIP access from the browser goes through `@wip/proxy`** mounted
at `/wip` (API-key injection server-side; the key never reaches the browser).
The server's own WIP calls (bootstrap, none at request time) use
`server/lib/wip-api.ts`.

```
Browser ── @wip/client+react hooks ──► /wip/* ── @wip/proxy ──► WIP (8443)
        ── fetch ───────────────────► /api/*        Express (3016)
        ── fetch ───────────────────► /server-api/* (bootstrap, import parse)
```

Vite (5181) proxies `/api`, `/wip`, `/server-api` to Express in dev; in
production Express serves `dist/` itself under `APP_BASE_PATH` (CASE-370
path-prefix contract; every client URL derives from `import.meta.env.BASE_URL`).

## Server (`server/`)

- `index.ts` — middleware order matters: session → auth → **`/wip` proxy
  BEFORE `express.json()`** (raw-body forwarding) → JSON → `/server-api`
  routes → `/api` routes → prod static.
- `lib/bootstrap.ts` + `routes/bootstrap.ts` — offer-on-empty / use-on-exists
  gate, SSE progress, BOOTSTRAP_RECORD audit (from `templates/bootstrap/`).
  Seeds from `server/seed/`.
- `lib/midi.ts` + `routes/import.ts` — dependency-free SMF parser; see
  IMPORT_FORMATS.md.
- `agent.ts` / `auth.ts` — scaffold AskBar agent + OIDC (pass-through when
  `OIDC_ISSUER` unset).

## Client (`src/`)

- `contexts/SingerContext.tsx` — `/api/me` (gateway header → OIDC → local-dev)
  → load-or-create `SONG_SINGER`. Auto-create is upsert-safe (identity =
  subject).
- `components/PianoRoll.tsx` — SVG time×MIDI renderer; `renderOverlay(scale)`
  lets the practice page draw the live pitch trace in the same coordinate
  space. `Fretboard.tsx` — EADGBE positions of the current note.
  `NoteViews.tsx` — both views behind the singer's preference.
- `lib/pitch.ts` — autocorrelation pitch detection (~30 Hz sampling);
  `lib/audio.ts` — tone synthesis + MediaRecorder capture; `lib/scoring.ts` —
  per-note credit (quartertone tolerance, octave-equivalence half credit) +
  trace→canonical-event condenser; `lib/progress.ts` — singer×lesson upsert.
- `pages/PracticePage.tsx` — the state machine (idle → listening → recording →
  saving → done). Song-section exercises slice the song melody; backing track
  plays under the recording when present.

## Canonical note events

One shape everywhere: `{midi, start_ms, duration_ms, syllable?}` — song
melodies, exercise targets, attempt transcriptions. Import parsers normalize
into it; the scorer compares within it; both renderers draw it.

## Read/write discipline (WIP)

- **Lists use `useQueryDocuments`** (latest-only), never `useDocuments` — the
  plain list endpoint returns one row per document *version*.
- Writes go through `useCreateDocument`/`createDocument` upserts; identity
  fields per template are the dedup contract (DESIGN.md).
- Recordings/imports upload as `application/octet-stream` until CASE-448
  (file-store audio MIME allowlist) lands.
