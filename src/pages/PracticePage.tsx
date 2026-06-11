import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useDocument, useQueryDocuments, useCreateDocument, useWipClient } from '@wip/react'
import { Loader2, ArrowLeft, AlertTriangle, Play, Mic, Square, RotateCcw, Check, ChevronRight } from 'lucide-react'
import NoteViews from '../components/NoteViews'
import { useSinger } from '../contexts/SingerContext'
import { WIP_NAMESPACE } from '../lib/config'
import { playNotes, startRecording, type PitchSample, type RecordingSession } from '../lib/audio'
import { scoreAttempt, traceToEvents, type AttemptScores } from '../lib/scoring'
import { updateLessonProgress, COMPLETION_SCORE } from '../lib/progress'
import { midiToNoteName } from '../lib/music'
import type { ExerciseData, LessonData } from '../lib/types'

type Phase = 'idle' | 'listening' | 'recording' | 'saving' | 'done'

function ScoreRing({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'text-success' : value >= 50 ? 'text-accent' : 'text-danger'
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
      <span className={`text-2xl font-semibold ${tone}`}>{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
    </div>
  )
}

export default function PracticePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const lessonId = searchParams.get('lesson')
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const exercise = doc?.data as ExerciseData | undefined
  const targets = exercise?.target_notes?.events ?? []

  // Lesson context (when launched from a lesson): progress writes + next-exercise.
  const { data: lessonDoc } = useDocument(lessonId ?? '')
  const lesson = lessonDoc?.data as LessonData | undefined
  const exerciseCatalog = useQueryDocuments({ template_id: 'SONG_EXERCISE', filters: [], page_size: 100 })
  const codeOfRef = new Map(
    (exerciseCatalog.data?.items ?? []).map((d) => [d.document_id, (d.data as unknown as ExerciseData).code]),
  )
  const nextExerciseRef = (() => {
    if (!lesson || !id) return null
    const idx = lesson.exercise_refs.indexOf(id)
    return idx >= 0 ? lesson.exercise_refs[idx + 1] ?? null : null
  })()

  const { singerId } = useSinger()
  const wip = useWipClient()
  const createAttempt = useCreateDocument()

  const [phase, setPhase] = useState<Phase>('idle')
  const [recordMs, setRecordMs] = useState<number | null>(null)
  const [scores, setScores] = useState<AttemptScores | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const traceRef = useRef<PitchSample[]>([])
  const [traceTick, setTraceTick] = useState(0)
  const sessionRef = useRef<RecordingSession | null>(null)
  const stopListenRef = useRef<(() => void) | null>(null)
  const autoStopRef = useRef<number | null>(null)
  const stoppingRef = useRef(false)

  const totalMs = targets.reduce((end, e) => Math.max(end, e.start_ms + e.duration_ms), 0)

  // Clean up audio on unmount / navigation.
  useEffect(
    () => () => {
      stopListenRef.current?.()
      sessionRef.current?.cancel()
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current)
    },
    [],
  )

  const handleListen = () => {
    if (phase === 'listening') return
    setPhase('listening')
    stopListenRef.current = playNotes(targets, () => setPhase((p) => (p === 'listening' ? 'idle' : p)))
  }

  const finishRecording = useCallback(async () => {
    if (stoppingRef.current || !sessionRef.current) return
    stoppingRef.current = true
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current)

    const { blob, samples, durationMs } = await sessionRef.current.stop()
    sessionRef.current = null
    const result = scoreAttempt(targets, samples)
    setScores(result)
    setPhase('saving')
    setSaveError(null)

    try {
      // CASE-448: the file store rejects audio/* MIME types, so the take is
      // uploaded as octet-stream (SONG_ATTEMPT.recording_file allows it).
      const upload = await wip.files.uploadFile(
        new Blob([blob], { type: 'application/octet-stream' }),
        `attempt-${Date.now()}.webm`,
        { description: `Practice take — ${exercise?.title ?? 'exercise'}`, tags: ['attempt'] },
      )
      await createAttempt.mutateAsync({
        template_id: 'SONG_ATTEMPT',
        namespace: WIP_NAMESPACE,
        data: {
          attempt_id: crypto.randomUUID(),
          singer_ref: singerId,
          exercise_ref: id,
          recorded_at: new Date().toISOString(),
          recording_file: upload.file_id,
          transcription: { events: traceToEvents(samples) },
          pitch_score: result.pitch_score,
          rhythm_score: result.rhythm_score,
          overall_score: result.overall_score,
          duration_seconds: Math.round(durationMs / 100) / 10,
        },
        created_by: 'wip-song-app',
      })
      // Lesson context: upsert the singer×lesson progress doc (new version).
      if (lessonId && lesson && singerId && exercise) {
        const lessonExerciseCodes = lesson.exercise_refs
          .map((ref) => codeOfRef.get(ref))
          .filter((c): c is string => !!c)
        await updateLessonProgress(wip, {
          singerId,
          lessonId,
          exerciseCode: exercise.code,
          score: result.overall_score,
          lessonExerciseCodes,
        })
      }
      setPhase('done')
    } catch (err) {
      setSaveError((err as Error).message)
      setPhase('done')
    } finally {
      stoppingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codeOfRef is rebuilt per render from the catalog query
  }, [targets, wip, createAttempt, singerId, id, exercise, lessonId, lesson])

  const handleRecord = async () => {
    stopListenRef.current?.()
    traceRef.current = []
    setScores(null)
    setRecordMs(0)
    try {
      const session = await startRecording((s) => {
        traceRef.current.push(s)
        setRecordMs(s.t_ms)
        setTraceTick((t) => t + 1)
      })
      sessionRef.current = session
      setPhase('recording')
      // Auto-stop a moment after the target timeline ends.
      autoStopRef.current = window.setTimeout(() => void finishRecording(), totalMs + 1500)
    } catch (err) {
      const e = err as DOMException
      const hint =
        e.name === 'NotFoundError'
          ? 'No microphone found — connect one (or check system audio input settings) and try again.'
          : e.name === 'NotAllowedError'
            ? 'Microphone access was denied — allow it in the browser address-bar permissions and try again.'
            : `Microphone unavailable: ${e.message}`
      setSaveError(hint)
      setPhase('idle')
    }
  }

  const reset = useCallback(() => {
    setPhase('idle')
    setScores(null)
    setSaveError(null)
    setRecordMs(null)
    traceRef.current = []
    setTraceTick((t) => t + 1)
  }, [])

  // Fresh state when navigating to the next exercise in a lesson.
  useEffect(() => reset(), [id, reset])

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading exercise…
      </div>
    )
  }
  if (error != null || !exercise) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="text-sm text-danger">
          Exercise not found. <Link to="/practice" className="text-primary hover:underline">Back to practice</Link>
        </p>
      </div>
    )
  }
  if (!targets.length) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="font-medium text-primary">Song-section practice not built yet</h3>
        <p className="mt-1 text-sm text-text-muted">
          This exercise practices part of a song — that player arrives in build phase 6.{' '}
          <Link to="/practice" className="text-primary hover:underline">Back to practice</Link>
        </p>
      </div>
    )
  }

  // Re-render trigger for the live trace (the samples live in a ref).
  void traceTick

  return (
    <div className="space-y-6">
      <div>
        <Link to="/practice" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Practice
        </Link>
        <header className="mt-2">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{exercise.title}</h1>
          {exercise.description && <p className="mt-1 text-sm text-text-muted">{exercise.description}</p>}
        </header>
      </div>

      <NoteViews
        events={targets}
        currentMs={phase === 'recording' ? recordMs : null}
        renderOverlay={({ xOfMs, yOfMidi, rowHeight }) => {
          const pts = traceRef.current
          if (pts.length < 2) return null
          const path = pts
            .map((s, i) => `${i ? 'L' : 'M'}${xOfMs(s.t_ms).toFixed(1)},${(yOfMidi(s.midi) + rowHeight / 2).toFixed(1)}`)
            .join(' ')
          return <path d={path} fill="none" stroke="#2E8B57" strokeWidth={2} opacity={0.85} />
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleListen}
          disabled={phase === 'recording' || phase === 'saving'}
          className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> {phase === 'listening' ? 'Playing…' : 'Listen'}
        </button>

        {phase !== 'recording' ? (
          <button
            type="button"
            onClick={() => void handleRecord()}
            disabled={phase === 'listening' || phase === 'saving'}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> {scores ? 'Sing again' : 'Sing'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finishRecording()}
            className="flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-danger/40"
          >
            <Square className="h-4 w-4" /> Stop
          </button>
        )}

        {scores && phase === 'done' && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}

        {phase === 'recording' && (
          <span className="flex items-center gap-2 text-sm text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Recording — sing now
          </span>
        )}
        {phase === 'saving' && (
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving attempt…
          </span>
        )}
      </div>

      {scores && (
        <section className="space-y-4">
          <div className="grid grid-cols-3 gap-4 sm:max-w-md">
            <ScoreRing label="Pitch" value={scores.pitch_score} />
            <ScoreRing label="Rhythm" value={scores.rhythm_score} />
            <ScoreRing label="Overall" value={scores.overall_score} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-surface p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-text">Note by note</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {scores.notes.map((n, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    n.pitchCredit >= 0.9
                      ? 'bg-success/10 text-success'
                      : n.pitchCredit >= 0.4
                        ? 'bg-accent/10 text-accent'
                        : 'bg-danger/10 text-danger'
                  }`}
                >
                  {midiToNoteName(n.target.midi)}
                  {n.medianMidi != null ? ` → ${midiToNoteName(Math.round(n.medianMidi))}` : ' → silent'}
                </span>
              ))}
            </div>
          </div>

          {phase === 'done' && !saveError && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-success">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Attempt saved
                {lessonId && scores.overall_score >= COMPLETION_SCORE && ' — exercise completed!'}
                {lessonId && scores.overall_score < COMPLETION_SCORE && ` — reach ${COMPLETION_SCORE} to complete this exercise.`}
              </span>
              {lessonId && nextExerciseRef && (
                <Link
                  to={`/practice/${nextExerciseRef}?lesson=${lessonId}`}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  Next exercise <ChevronRight className="h-3 w-3" />
                </Link>
              )}
              {lessonId && !nextExerciseRef && (
                <Link
                  to={`/lessons/${lessonId}`}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  Back to lesson <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {saveError && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{saveError}</p>
        </div>
      )}
    </div>
  )
}
