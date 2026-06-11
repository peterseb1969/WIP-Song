/**
 * Lesson-progress upsert. SONG_PROGRESS identity is (singer_ref, lesson_ref),
 * so re-submitting after every attempt versions ONE document per singer per
 * lesson — WIP's version history *is* the progress-over-time record.
 */

import type { WipClient } from '@wip/client'
import { WIP_NAMESPACE } from './config'
import type { ProgressData } from './types'

export const COMPLETION_SCORE = 70

export async function updateLessonProgress(
  client: WipClient,
  args: {
    singerId: string
    lessonId: string
    exerciseCode: string
    score: number
    /** All exercise codes in the lesson (to detect completion). */
    lessonExerciseCodes: string[]
  },
): Promise<ProgressData> {
  const { singerId, lessonId, exerciseCode, score, lessonExerciseCodes } = args

  const existing = await client.documents.queryDocuments({
    template_id: 'SONG_PROGRESS',
    filters: [
      { field: 'data.singer_ref', operator: 'eq', value: singerId },
      { field: 'data.lesson_ref', operator: 'eq', value: lessonId },
    ],
    page_size: 1,
  })
  const current = existing.items[0]?.data as ProgressData | undefined

  const completed = new Set(current?.completed_exercise_codes ?? [])
  if (score >= COMPLETION_SCORE) completed.add(exerciseCode)

  const allDone = lessonExerciseCodes.length > 0 && lessonExerciseCodes.every((c) => completed.has(c))

  const next: ProgressData = {
    singer_ref: singerId,
    lesson_ref: lessonId,
    status: allDone ? 'COMPLETED' : 'STARTED',
    best_score: Math.max(current?.best_score ?? 0, score),
    attempts_count: (current?.attempts_count ?? 0) + 1,
    completed_exercise_codes: [...completed],
  }

  await client.documents.createDocument({
    template_id: 'SONG_PROGRESS',
    namespace: WIP_NAMESPACE,
    data: next as unknown as Record<string, unknown>,
    created_by: 'wip-song-app',
  })

  return next
}
