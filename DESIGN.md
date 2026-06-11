# WIP-Song Data Model — v0.1

Status: **approved by Peter and implemented in `dev-wip-song` 2026-06-11** (Phase 3 complete, all tests passed).
Namespace: `dev-wip-song` (dev), production namespace `wip-song` later.
Prefix: all terminologies and templates use `SONG_`.

## Implementation record (2026-06-11, session APP-SONG-20260611-201457)

Terminology IDs: SONG_VOICE_TYPE `019eb813-bc2e…`, SONG_DIFFICULTY `019eb813-bc4c…`,
SONG_EXERCISE_TYPE `019eb813-bc66…`, SONG_SOURCE_FORMAT `019eb813-bc7f…`,
SONG_MUSICAL_KEY `019eb813-bc98…`, SONG_GENRE `019eb813-bcb0…`,
SONG_LANGUAGE `019eb813-bccb…`, SONG_PROGRESS_STATUS `019eb813-bce3…` (79 terms total).

Template IDs (all v1 active unless noted): SONG_SINGER `019eb816-0708…`,
SONG_TRACK `019eb816-072b…`, SONG_EXERCISE `019eb816-35e1…`,
SONG_LESSON `019eb816-58b6…`, **SONG_ATTEMPT `019eb816-8df8…` — v2 active, v1
deactivated** (recording_file file_config widened to include
`application/octet-stream`, see deviation below), SONG_PROGRESS `019eb816-9e89…`,
BOOTSTRAP_RECORD `019eb816-ac8a…`.

**Deviation from design — CASE-448:** the platform file store rejects `audio/*`
uploads (global MIME allowlist). Recordings are stored as
`application/octet-stream` until CASE-448 lands; SONG_ATTEMPT.recording_file
accepts `["audio/*", "video/webm", "application/octet-stream"]` and should be
tightened back to audio-only afterwards. Related: CASE-449 (MCP upload_file
multipart bug; use REST for file uploads in MCP-driven sessions).

Test data (kept per Peter, created_by `APP-SONG-phase3-test`): singer
`019eb817-60bf…`, song "Die Gedanken sind frei" `019eb818-03db…` (v2),
exercises `019eb818-6d0e…` / `019eb818-72ee…`, lesson `019eb818-926f…`,
attempt `019eb81a-1781…` (+ recording file `019eb817-d45b…`), progress
`019eb81a-3f6d…` (v2), bootstrap-record test doc `019eb81a-47db…`.

## App definition (from Peter, 2026-06-11)

WIP-Song is a song teaching and singing app. It records the user's singing and
translates it into notes; it plays reference sounds the user must match, or
backing tracks to sing along to. WIP stores lessons, progress, song files.
Multi-user. Imports multiple sound formats (karaoke and similar). Details
iterate as we go.

Confirmed design anchors (AskUserQuestion, 2026-06-11):
1. **Users:** OIDC login; SINGER profile document keyed by OIDC subject.
2. **Recordings:** every attempt's audio stored in WIP files + analysis.
3. **Melody:** original import file kept as WIP file AND parsed into a
   canonical note-sequence stored as structured data.
4. **Lessons:** ordered sequences of exercises; exercises may reference a song
   or be standalone drills.

## Reuse findings (Phase 1 inventory, 2026-06-11)

Nothing reusable. `wip` namespace holds only `_ONTOLOGY_RELATIONSHIP_TYPES`
and `_TIME_UNITS`. `COUNTRY` exists only in `clintrial` (not needed).
`AA_GENRE` is book genres (not music). All entities below are NEW.

## Canonical note representation (app-level convention, not a template)

A note event: `{ midi: int (0-127), start_ms: int, duration_ms: int,
syllable?: string }`. A melody: `{ tempo_bpm?: number, events: NoteEvent[] }`.
Stored in `object` fields (`SONG_TRACK.melody`, `SONG_EXERCISE.target_notes`,
`SONG_ATTEMPT.transcription`). All import parsers normalize to this; the
scorer compares transcription events to target events. MIDI numbers, not note
names, are canonical (names are presentation).

## Terminologies (8, all new)

| Value | Label | Initial terms | Notes |
|---|---|---|---|
| SONG_VOICE_TYPE | Voice Type | SOPRANO, MEZZO_SOPRANO, ALTO, COUNTERTENOR, TENOR, BARITONE, BASS, CHILD | |
| SONG_DIFFICULTY | Difficulty | BEGINNER, EASY, INTERMEDIATE, ADVANCED, EXPERT | |
| SONG_EXERCISE_TYPE | Exercise Type | PITCH_MATCH, INTERVAL, SCALE, RHYTHM, SONG_SECTION, BREATHING, FREE_PRACTICE | |
| SONG_SOURCE_FORMAT | Source Format | MIDI, KAR, ULTRASTAR_TXT, LRC, CDG, MUSICXML, MP3, WAV, OGG | import format of the original file |
| SONG_MUSICAL_KEY | Musical Key | 24 terms: C_MAJOR … B_MINOR | aliases like "C", "Am", "F#m" |
| SONG_GENRE | Genre | POP, ROCK, FOLK, CLASSICAL, JAZZ, MUSICAL, CHILDREN, HYMN, COUNTRY, BLUES, SCHLAGER, OTHER | `mutable: true`, extensible — users add genres |
| SONG_LANGUAGE | Lyrics Language | EN, DE, FR, ES, IT, SV, NL, PT, JA, KO, OTHER | extensible; values are ISO 639-1 where possible |
| SONG_PROGRESS_STATUS | Progress Status | STARTED, COMPLETED, MASTERED | "not started" = no PROGRESS doc exists |

No hierarchical vocabularies in v1 (GENRE could grow is_a relations later;
flat is fine now).

## Templates (6 + BOOTSTRAP_RECORD, all new, all `usage: entity`)

### SONG_SINGER — user profile
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| subject | string | yes | OIDC subject claim — stable user ID. **identity** |
| display_name | string | yes | |
| email | string (semantic_type: email) | no | |
| voice_type | term → SONG_VOICE_TYPE | no | |
| range_low_midi | integer (0–127) | no | measured vocal range |
| range_high_midi | integer (0–127) | no | |
| preferences | object | no | UI/app prefs |

identity_fields: `[subject]` — one doc per user; profile edits = new versions.

### SONG_TRACK — a song (label "Song")
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| title | string | yes | **identity** |
| artist | string | yes | **identity**; use "Traditional"/"Unknown" rather than blank |
| language | term → SONG_LANGUAGE | no | |
| genre | term → SONG_GENRE | no | |
| difficulty | term → SONG_DIFFICULTY | no | |
| musical_key | term → SONG_MUSICAL_KEY | no | |
| duration_seconds | number | no | |
| tempo_bpm | number | no | |
| lyrics_text | string | no | full-text indexed |
| source_format | term → SONG_SOURCE_FORMAT | no | format of original_file |
| original_file | file | no | the imported source (e.g. .kar, UltraStar zip) |
| audio_full | file (audio/*) | no | full mix |
| audio_backing | file (audio/*) | no | instrumental / karaoke track |
| melody | object | no | canonical note events (see convention above) |

identity_fields: `[title, artist]` — re-import of the same song updates it
(new version) instead of duplicating. External catalog IDs (UltraStar DB id,
etc.) registered as **Registry synonyms** on the document at import time.
Reporting config: exclude `melody` from flattening (large object).

### SONG_EXERCISE — a drill or song-section task
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| code | string | yes | stable slug, e.g. `scale-c-major-1oct`. **identity** |
| title | string | yes | |
| exercise_type | term → SONG_EXERCISE_TYPE | yes | |
| description | string | no | |
| difficulty | term → SONG_DIFFICULTY | no | |
| target_notes | object | no | canonical note events to match (drills) |
| song_ref | reference → SONG_TRACK | no | for SONG_SECTION exercises |
| section_start_ms | integer | no | song slice |
| section_end_ms | integer | no | |

identity_fields: `[code]`. App rule (not WIP rule): SONG_SECTION type requires
song_ref; drill types require target_notes.

### SONG_LESSON — ordered curriculum unit
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| code | string | yes | stable slug. **identity** |
| title | string | yes | |
| description | string | no | |
| difficulty | term → SONG_DIFFICULTY | no | |
| exercise_refs | array of reference → SONG_EXERCISE | yes | ordered |

identity_fields: `[code]`. Editing a lesson's sequence = new version (history
of curriculum changes for free).

### SONG_ATTEMPT — one recorded practice take
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| attempt_id | string | yes | app-minted UUID. **identity** |
| singer_ref | reference → SONG_SINGER | yes | |
| exercise_ref | reference → SONG_EXERCISE | no | one of exercise_ref / song_ref set (app-enforced) |
| song_ref | reference → SONG_TRACK | no | free practice on a whole song |
| recorded_at | datetime | yes | fixed per attempt; safe outside identity |
| recording_file | file (audio/*) | yes | the take itself (decision: store all) |
| transcription | object | no | detected note events (canonical form) |
| pitch_score | number (0–100) | no | |
| rhythm_score | number (0–100) | no | |
| overall_score | number (0–100) | no | |
| duration_seconds | number | no | |

identity_fields: `[attempt_id]` — deliberately NOT empty/append-only: the app
mints the ID, and re-scoring (improved analysis later) updates the same doc as
a new version instead of duplicating. Reporting config: exclude
`transcription` from flattening.

### SONG_PROGRESS — singer × lesson state
| Field | Type | Mandatory | Notes |
|---|---|---|---|
| singer_ref | reference → SONG_SINGER | yes | **identity** |
| lesson_ref | reference → SONG_LESSON | yes | **identity** |
| status | term → SONG_PROGRESS_STATUS | yes | |
| best_score | number | no | |
| attempts_count | integer | no | |
| completed_exercise_codes | array of string | no | which exercises in the lesson are done |

identity_fields: `[singer_ref, lesson_ref]` — exactly one doc per singer per
lesson; every update is a new version, so **progress history over time falls
out of WIP versioning for free**.

### BOOTSTRAP_RECORD — bootstrap audit (CLAUDE.md mandate)
From `templates/bootstrap/`; fields per the template file (bootstrap_id,
app_version, bootstrapped_at, commit_sha, templates_created,
edge_types_created, terminologies_created). Append-only.

## Relations / edge types

All relations are reference fields on entity templates. **No edge types in
v1** — there is no many-to-many with payload yet (duets, shared playlists
would be candidates later).

## Creation order (Phase 3)

1. All 8 terminologies + terms (no dependencies)
2. SONG_SINGER, SONG_TRACK (reference only terminologies)
3. SONG_EXERCISE (references SONG_TRACK)
4. SONG_LESSON (references SONG_EXERCISE)
5. SONG_ATTEMPT, SONG_PROGRESS (reference SINGER/TRACK/EXERCISE/LESSON)
6. BOOTSTRAP_RECORD
7. Test documents: 1 singer, 1 imported song, 2 exercises, 1 lesson,
   2 attempts, 1 progress doc — verify term + reference resolution
No circular references → no draft mode needed.

## Noted for later (not v1)

- SONG_SKILL terminology + per-skill scoring (fixed score fields suffice now)
- Genre/skill ontology relations (is_a)
- Edge types for duets / shared playlists / teacher-student links
- Audio normalization policy: recordings should be compressed (webm/opus or
  mp3) client-side; file fields cap at 100 MB but practice takes should be ~1 MB/min
- Promotion of any terminology to `wip` namespace if a second app needs it
