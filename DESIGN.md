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
SONG_TRACK `019eb816-072b…` (v2), SONG_EXERCISE `019eb816-35e1…`,
SONG_LESSON `019eb816-58b6…`, **SONG_ATTEMPT `019eb816-8df8…` — v3 active,
v1/v2 deactivated** (v2 was the CASE-448 workaround; see deviation below),
SONG_PROGRESS `019eb816-9e89…`, BOOTSTRAP_RECORD `019eb816-ac8a…`.

**Deviation from design — CASE-448 (RESOLVED same day):** the file store
initially rejected `audio/*` uploads, so v2 widened recording_file to accept
octet-stream. CASE-448 was implemented by BE-YAC within hours; **SONG_ATTEMPT
is now at v3** with the designed `["audio/*", "video/webm"]` config and the
app uploads real MIME types. CASE-449 (MCP upload_file multipart) was also
fixed and verified.

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
syllable?: string, string?: int, fret?: int }` — `string`/`fret` are the
exact fretboard position (0 = lowest string), present on Guitar Pro imports
(added 2026-06-12). A melody: `{ tempo_bpm?: number, events: NoteEvent[],
tuning?: number[] }` — `tuning` is open-string MIDI low → high, also from
Guitar Pro imports. Object fields are schema-free inside, so these optional
additions are non-breaking (no template version bump).
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
| SONG_SOURCE_FORMAT | Source Format | MIDI, KAR, ULTRASTAR_TXT, LRC, CDG, MUSICXML, MP3, WAV, OGG, GUITAR_PRO | import format of the original file (GUITAR_PRO added 2026-06-12, term `019ebadc-ef15…`) |
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
| markers | array (object items) | no | **v2 (2026-06-12)**: named positions/ranges `{label, start_ms, end_ms?}` — user-authored, PATCH-edited |

identity_fields: `[title, artist]` — re-import of the same song updates it
(new version) instead of duplicating. External catalog IDs (UltraStar DB id,
etc.) registered as **Registry synonyms** on the document at import time.
Reporting config: exclude `melody` from flattening (large object).

**SONG_TRACK is at v2** (markers added 2026-06-12; v1 deactivated per
PoNIF #2). Two operational facts, verified live: (1) PATCH validates against
the template version recorded on the document, so v1-pinned docs reject
`markers` — the marker editor migrates them with one full upsert onto v2
(same identity, same document_id, new doc version). (2) Re-import is a full
upsert and would wipe user-authored fields — the import dialog merges over
the existing document's data so markers, uploaded audio, and metadata edits
survive.

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

## UI Plan — v0.1 (approved by Peter 2026-06-11, Phase 4 gate)

App identity: id `song`, path `/apps/song`, Express port **3016**, Vite port **5181**.

**Audio architecture:** recording via MediaRecorder (webm/opus); live pitch
detection via Web Audio autocorrelation (client-side, real-time); reference
tones synthesized via Web Audio; backing tracks via `<audio>`; import parsing
server-side (.kar/MIDI first), normalizing to the canonical note-event form.

**Pages:** Home (continue-practicing dashboard, landing) · Songs (library
cards + import flow + song detail with melody preview and backing playback) ·
Lessons (cards with progress → exercise sequence) · Practice (full-screen
exercise player: target notes, live pitch trace, record → score reveal) ·
Progress (attempt history + playback, lesson progress over time) · Profile
(display name, voice type, vocal range). AskBar overlay retained from scaffold.

**Navigation:** top bar (Songs / Lessons / Progress + profile chip). Peter:
may switch to a sidebar later; top nav for v1.

**Note rendering — two synchronized views (Peter is a guitarist):**
- Piano-roll strip (SVG, custom, no new dependency): time × MIDI pitch, note
  bars with syllables; doubles as the practice overlay surface (live pitch
  trace) and attempt review (target vs transcription).
- Fretboard panel (SVG): 6 strings, standard tuning EADGBE, shows all playable
  positions of the current target note (lowest emphasized), synced to the
  playhead; note-by-note stepping in song detail.
- View toggle + stacked mode; preference persisted in SONG_SINGER.preferences.
- Pitch scoring treats octave-equivalent notes as partial credit (guitarists
  sing an octave off from where they play).

**v1 scope cuts (deliberate):** no lesson/exercise authoring UI (seeded
curriculum only); no duets/sharing; standard tuning only, no capo, no chord
shapes, no tab-timeline view; no sheet-music notation (VexFlow/abcjs would be
a cased dependency later); English UI only.

**Build order (one commit each):** 1 foundation (libs, providers, proxy,
tokens, nav, BootstrapGate) · 2 profile/singer context · 3 songs + detail +
both note renderers · 4 import flow (needs sample .kar from Peter) ·
5 practice player drills · 6 practice song sections · 7 lessons + progress ·
8 progress page + playback · 9 tests, containerization, wip-app.yaml, docs.

## Noted for later (not v1)

- SONG_SKILL terminology + per-skill scoring (fixed score fields suffice now)
- Genre/skill ontology relations (is_a)
- Edge types for duets / shared playlists / teacher-student links
- Audio normalization policy: recordings should be compressed (webm/opus or
  mp3) client-side; file fields cap at 100 MB but practice takes should be ~1 MB/min
- Promotion of any terminology to `wip` namespace if a second app needs it
