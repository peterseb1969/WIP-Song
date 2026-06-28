import { useQueryDocuments } from '@wip/react'

/** One SONG_LESSON_EXERCISE edge: lesson → exercise at an ordered position. */
interface LessonExerciseEdge {
  source_ref: string
  target_ref: string
  sequence: number
}

/**
 * Ordered exercise document_ids for a lesson, read from SONG_LESSON_EXERCISE
 * edges (source_ref = lesson, target_ref = exercise, ordered by `sequence`).
 *
 * Replaces the retired SONG_LESSON.exercise_refs array — lesson→exercise is
 * an edge type now (CASE-493 cleanup, 2026-06-27). Drop-in for the old
 * `lesson.exercise_refs: string[]`: returns the same ordered id list.
 */
export function useLessonExercises(lessonId: string | null | undefined) {
  const edges = useQueryDocuments(
    {
      template_id: 'SONG_LESSON_EXERCISE',
      filters: lessonId
        ? [{ field: 'data.source_ref', operator: 'eq', value: lessonId }]
        : [],
      sort_by: 'data.sequence',
      sort_order: 'asc',
      page_size: 100,
    },
    { enabled: !!lessonId },
  )

  const exerciseIds = (edges.data?.items ?? []).map(
    (e) => (e.data as unknown as LessonExerciseEdge).target_ref,
  )

  return { exerciseIds, isLoading: edges.isLoading, error: edges.error }
}

/**
 * Exercise count per lesson, for list views (LessonsPage, ProgressPage)
 * where calling useLessonExercises per row would break the rules of hooks.
 * One query over all edges, grouped by source_ref (lesson document_id).
 */
export function useLessonExerciseCounts() {
  const edges = useQueryDocuments({
    template_id: 'SONG_LESSON_EXERCISE',
    filters: [],
    page_size: 500,
  })
  const counts = new Map<string, number>()
  for (const e of edges.data?.items ?? []) {
    const src = (e.data as unknown as LessonExerciseEdge).source_ref
    counts.set(src, (counts.get(src) ?? 0) + 1)
  }
  return { counts, isLoading: edges.isLoading }
}
