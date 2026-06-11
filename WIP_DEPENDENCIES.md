# WIP dependencies

Namespace: **`dev-wip-song`** (development; production will be `wip-song`).
No cross-app references; no shared-`wip` terminologies consumed (the shared
namespace held nothing reusable at design time — see DESIGN.md).

## Terminologies (8, all owned by this app)

SONG_VOICE_TYPE (8) · SONG_DIFFICULTY (5) · SONG_EXERCISE_TYPE (7) ·
SONG_SOURCE_FORMAT (9) · SONG_MUSICAL_KEY (24, enharmonic aliases) ·
SONG_GENRE (12, **mutable/extensible**) · SONG_LANGUAGE (11, **mutable**) ·
SONG_PROGRESS_STATUS (3).

## Templates (7, all `usage: entity`) and their identity contracts

| Template | identity_fields | Versioning meaning |
|---|---|---|
| SONG_SINGER | `[subject]` | profile edits |
| SONG_TRACK | `[title, artist]` | re-import updates the song |
| SONG_EXERCISE | `[code]` | curriculum edits |
| SONG_LESSON | `[code]` | sequence edits |
| SONG_ATTEMPT | `[attempt_id]` (app-minted) | re-scoring an old take |
| SONG_PROGRESS | `[singer_ref, lesson_ref]` | **progress history over time** |
| BOOTSTRAP_RECORD | `[bootstrap_id]` | audit, append-style |

SONG_ATTEMPT is at **v2** (v1 deactivated): `recording_file.file_config`
includes `application/octet-stream` as the CASE-448 workaround. Tighten to
`audio/*` + `video/webm` when the platform accepts audio uploads.

## Files

WIP file storage holds: original import files, song audio (full/backing),
one recording per attempt — all uploaded as `application/octet-stream`
(CASE-448).

## Runtime access

Single-namespace runtime key (`wip-song-dev`) via `@wip/proxy`; namespace
auto-derives on reads. Writes require Registry grants on the namespace —
**both** `wip-song-dev` and `apikey:wip-song-dev` subjects (CASE-450,
subject format is path-dependent).

## Open platform cases this app tracks

- **CASE-448** — file store rejects `audio/*` MIME (workaround threaded
  through template v2 + all uploads).
- **CASE-449** — MCP `upload_file` broken multipart (dev-time only).
- **CASE-450** — grants not exposed via client/MCP; subject-format
  inconsistency.

## Seed / reproduction

`data-model/` (git record, exported from live) and `server/seed/` (bootstrap
input) carry the same model. `BootstrapGate` provisions a fresh instance;
`BOOTSTRAP_RECORD` documents each bootstrap run.
