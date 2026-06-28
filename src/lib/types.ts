import type { Melody, NoteEvent } from './music'

/** Named position or range in a song's timeline (SONG_TRACK.markers, template v2). */
export interface Marker {
  label: string
  start_ms: number
  end_ms?: number
}

/** data shape of a SONG_TRACK document (see DESIGN.md / data-model/templates/02_SONG_TRACK.json). */
export interface SongData {
  title: string
  artist: string
  language?: string
  genre?: string
  difficulty?: string
  musical_key?: string
  duration_seconds?: number
  tempo_bpm?: number
  lyrics_text?: string
  source_format?: string
  original_file?: string
  audio_full?: string
  audio_backing?: string
  melody?: Melody
  markers?: Marker[]
}

/** data shape of a SONG_EXERCISE document. */
export interface ExerciseData {
  code: string
  title: string
  exercise_type: string
  description?: string
  difficulty?: string
  target_notes?: Melody
  song_ref?: string
  section_start_ms?: number
  section_end_ms?: number
}

/**
 * data shape of a SONG_LESSON document. Exercises are NOT stored here —
 * lesson→exercise is a SONG_LESSON_EXERCISE edge type (see useLessonExercises).
 */
export interface LessonData {
  code: string
  title: string
  description?: string
  difficulty?: string
}

/** data shape of a SONG_ATTEMPT document. */
export interface AttemptData {
  attempt_id: string
  singer_ref: string
  exercise_ref?: string
  song_ref?: string
  recorded_at: string
  recording_file: string
  transcription?: { events: NoteEvent[] }
  pitch_score?: number
  rhythm_score?: number
  overall_score?: number
  duration_seconds?: number
}

/** data shape of a SONG_PROGRESS document. */
export interface ProgressData {
  singer_ref: string
  lesson_ref: string
  status: string
  best_score?: number
  attempts_count?: number
  completed_exercise_codes?: string[]
}
