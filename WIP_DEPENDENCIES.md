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

SONG_ATTEMPT is at **v3** (v1/v2 deactivated): `recording_file.file_config`
is back to `["audio/*", "video/webm"]` — the CASE-448 octet-stream
workaround (v2) was retired the same day the platform fix landed.

## Files

WIP file storage holds: original import files (audio/midi), song audio
(full/backing), one recording per attempt (audio/webm). Files from the
CASE-448 workaround window remain typed application/octet-stream.

## Runtime access

Single-namespace runtime key (`wip-song-dev`) via `@wip/proxy`; namespace
auto-derives on reads. Writes require a Registry write grant on the namespace (in place for
`wip-song-dev`; subjects are canonical bare key names since CASE-450).

## Platform cases this app filed (all implemented 2026-06-11)

- **CASE-448** — audio MIME allowlist (fixed; app re-tightened to real types).
- **CASE-449** — MCP `upload_file` multipart (fixed; verified from this app).
- **CASE-450** — grants exposure + subject canonicalization (fixed;
  `create_api_key grant_permission` is the provisioning path now).

## Seed / reproduction

`data-model/` (git record, exported from live) and `server/seed/` (bootstrap
input) carry the same model. `BootstrapGate` provisions a fresh instance;
`BOOTSTRAP_RECORD` documents each bootstrap run.
