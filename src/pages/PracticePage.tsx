import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useDocument, useQueryDocuments, useCreateDocument, useWipClient } from '@wip/react'
import { Loader2, ArrowLeft, AlertTriangle, Play, Mic, Square, RotateCcw, Check, ChevronRight, Repeat } from 'lucide-react'
import NoteViews from '../components/NoteViews'
import SpeedControl from '../components/SpeedControl'
import { useSinger } from '../contexts/SingerContext'
import { WIP_NAMESPACE } from '../lib/config'
import { playNotes, startRecording, type PitchSample, type RecordingSession } from '../lib/audio'
import { scoreAttempt, traceToEvents, type AttemptScores } from '../lib/scoring'
import { updateLessonProgress, COMPLETION_SCORE } from '../lib/progress'
import { midiToNoteName, midiToFrequency, type NoteEvent } from '../lib/music'
import { BASE } from '../lib/config'
import type { ExerciseData, LessonData, SongData } from '../lib/types'

type Phase = 'idle' | 'listening' | 'recording' | 'saving' | 'done'

/** Live tuner readout while recording: note name, cents deviation, Hz. */
function Tuner({ sample }: { sample: PitchSample | null }) {
  if (!sample) {
    return (
      <div className="flex w-36 flex-col items-center rounded-lg border border-gray-200 bg-surface p-3 shadow-sm">
        <span className="text-2xl font-semibold text-text-muted">—</span>
        <span className="text-xs text-text-muted">listening…</span>
      </div>
    )
  }
  const nearest = Math.round(sample.midi)
  const cents = Math.round((sample.midi - nearest) * 100)
  const inTune = Math.abs(cents) <= 15
  return (
    <div className="flex w-36 flex-col items-center rounded-lg border border-gray-200 bg-surface p-3 shadow-sm">
      <span className={`text-2xl font-semibold ${inTune ? 'text-success' : 'text-accent'}`}>
        {midiToNoteName(nearest)}
      </span>
      <span className={`text-sm font-medium ${inTune ? 'text-success' : 'text-accent'}`}>
        {cents === 0 ? 'in tune' : `${cents > 0 ? '+' : ''}${cents}¢`}
      </span>
      <span className="text-xs text-text-muted">{midiToFrequency(sample.midi).toFixed(1)} Hz</span>
    </div>
  )
}

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

  // SONG_SECTION exercises carry no target_notes — their targets are a slice
  // of the referenced song's melody, re-based to t=0.
  const { data: songDoc, isLoading: songLoading } = useDocument(exercise?.song_ref ?? '')
  const song = songDoc?.data as SongData | undefined
  const sectionStart = exercise?.section_start_ms ?? 0
  const sectionEnd = exercise?.section_end_ms ?? Number.MAX_SAFE_INTEGER
  const targets: NoteEvent[] =
    exercise?.target_notes?.events ??
    (song?.melody?.events ?? [])
      .filter((e) => e.start_ms >= sectionStart && e.start_ms < sectionEnd)
      .map((e) => ({ ...e, start_ms: e.start_ms - sectionStart }))

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
  const [speed, setSpeed] = useState(1)
  // Speed the current/last take was sung at — keeps the trace overlay and
  // scoring consistent even if the picker changes after recording.
  const takeSpeedRef = useRef(1)
  // Loop: practice a sub-range of the targets (0-based inclusive note
  // indices). Listen repeats it until stopped; a sung take scores against
  // the range only and does NOT count toward lesson progress.
  const [loop, setLoop] = useState<{ from: number; to: number } | null>(null)
  const loopingRef = useRef(false)

  const traceRef = useRef<PitchSample[]>([])
  const [traceTick, setTraceTick] = useState(0)
  const lastSampleRef = useRef<{ sample: PitchSample; at: number } | null>(null)
  const sessionRef = useRef<RecordingSession | null>(null)
  const stopListenRef = useRef<(() => void) | null>(null)
  const autoStopRef = useRef<number | null>(null)
  const stoppingRef = useRef(false)
  const backingRef = useRef<HTMLAudioElement | null>(null)

  // Loop range clamped to the current targets; the active targets are the
  // looped slice re-based to t=0 (the whole exercise when no loop is set).
  const loopFrom = loop ? Math.min(Math.max(0, loop.from), targets.length - 1) : 0
  const loopTo = loop ? Math.min(Math.max(loopFrom, loop.to), targets.length - 1) : targets.length - 1
  const loopActive = loop != null && targets.length > 0
  const activeTargets: NoteEvent[] = useMemo(() => {
    if (!loopActive) return targets
    const slice = targets.slice(loopFrom, loopTo + 1)
    const base = slice.length ? slice[0]!.start_ms : 0
    return slice.map((e) => ({ ...e, start_ms: e.start_ms - base }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targets is rebuilt per render; its content is keyed by doc + loop bounds
  }, [doc, songDoc, loopActive, loopFrom, loopTo])
  /** Offset of the active range within the exercise timeline (for backing audio). */
  const activeOffsetMs = loopActive && targets[loopFrom] ? targets[loopFrom]!.start_ms : 0

  const totalMs = activeTargets.reduce((end, e) => Math.max(end, e.start_ms + e.duration_ms), 0)

  // Backing-track slice playback for song sections with audio.
  const hasBacking = !!song?.audio_backing
  const stopBacking = () => {
    backingRef.current?.pause()
    backingRef.current = null
  }
  const playBackingSlice = (onEnd?: () => void, repeat = false) => {
    if (!song?.audio_backing) return
    const audio = new Audio(`${BASE}wip/files/${song.audio_backing}/content`)
    const startAt = (sectionStart + activeOffsetMs) / 1000
    audio.currentTime = startAt
    audio.playbackRate = speed // pitch-preserving (preservesPitch defaults true)
    backingRef.current = audio
    const stopAt = Math.min(sectionEnd, sectionStart + activeOffsetMs + totalMs + 1500) / 1000
    audio.ontimeupdate = () => {
      if (audio.currentTime >= stopAt) {
        if (repeat && loopingRef.current) {
          audio.currentTime = startAt // loop the range
        } else {
          stopBacking()
          onEnd?.()
        }
      }
    }
    audio.onended = () => onEnd?.()
    void audio.play()
  }

  // Clean up audio on unmount / navigation.
  useEffect(
    () => () => {
      stopListenRef.current?.()
      sessionRef.current?.cancel()
      backingRef.current?.pause()
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current)
    },
    [],
  )

  const handleListen = () => {
    if (phase === 'listening') {
      // Second click stops — essential for looped listening, harmless otherwise.
      loopingRef.current = false
      stopListenRef.current?.()
      setPhase('idle')
      return
    }
    setPhase('listening')
    const done = () => {
      loopingRef.current = false
      setPhase((p) => (p === 'listening' ? 'idle' : p))
    }
    loopingRef.current = loopActive
    if (hasBacking) {
      playBackingSlice(done, loopActive)
      stopListenRef.current = () => stopBacking()
    } else if (loopActive) {
      // Synth loop: replay the range until the user stops.
      let cancel: (() => void) | null = null
      const playOnce = () => {
        cancel = playNotes(activeTargets, () => (loopingRef.current ? playOnce() : done()), speed)
      }
      playOnce()
      stopListenRef.current = () => {
        loopingRef.current = false
        cancel?.()
      }
    } else {
      stopListenRef.current = playNotes(activeTargets, done, speed)
    }
  }

  const finishRecording = useCallback(async () => {
    if (stoppingRef.current || !sessionRef.current) return
    stoppingRef.current = true
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current)
    backingRef.current?.pause()
    backingRef.current = null

    const { blob, samples, durationMs } = await sessionRef.current.stop()
    sessionRef.current = null
    // Samples are wall-clock; at reduced speed the target timeline advanced
    // slower, so map sample times onto it before scoring. The saved
    // transcription/duration stay wall-clock (they describe the recording).
    const takeSpeed = takeSpeedRef.current
    const scoringSamples =
      takeSpeed === 1 ? samples : samples.map((s) => ({ ...s, t_ms: Math.round(s.t_ms * takeSpeed) }))
    const result = scoreAttempt(activeTargets, scoringSamples)
    setScores(result)
    setPhase('saving')
    setSaveError(null)

    try {
      // Real MIME type (audio/webm from MediaRecorder) — CASE-448 implemented.
      // 4th arg: the file endpoint requires namespace as a form field
      // (README omits the param; it's in the client source).
      const upload = await wip.files.uploadFile(
        blob,
        `attempt-${Date.now()}.webm`,
        { description: `Practice take — ${exercise?.title ?? 'exercise'}`, tags: ['attempt'] },
        WIP_NAMESPACE,
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
      // Loop takes never count — completing an exercise requires the whole thing.
      if (lessonId && lesson && singerId && exercise && !loopActive) {
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
  }, [activeTargets, loopActive, wip, createAttempt, singerId, id, exercise, lessonId, lesson])

  const handleRecord = async () => {
    stopListenRef.current?.()
    traceRef.current = []
    setScores(null)
    setRecordMs(0)
    takeSpeedRef.current = speed
    try {
      const session = await startRecording((s) => {
        traceRef.current.push(s)
        lastSampleRef.current = { sample: s, at: performance.now() }
        setRecordMs(s.t_ms)
        setTraceTick((t) => t + 1)
      })
      sessionRef.current = session
      setPhase('recording')
      // Karaoke mode: backing track plays under the recording (use headphones —
      // echo cancellation helps, but speaker bleed can color the pitch trace).
      if (hasBacking) playBackingSlice()
      // Auto-stop a moment after the target timeline ends (longer at reduced speed).
      autoStopRef.current = window.setTimeout(() => void finishRecording(), totalMs / speed + 1500)
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
    setLoop(null)
    loopingRef.current = false
    traceRef.current = []
    setTraceTick((t) => t + 1)
  }, [])

  // Fresh state when navigating to the next exercise in a lesson.
  useEffect(() => reset(), [id, reset])

  // Re-render heartbeat while recording so the tuner clears during silence
  // (pitch samples only arrive while the singer is voicing).
  useEffect(() => {
    if (phase !== 'recording') return
    const t = window.setInterval(() => setTraceTick((x) => x + 1), 200)
    return () => window.clearInterval(t)
  }, [phase])

  if (isLoading || (exercise?.song_ref && songLoading)) {
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
        <h3 className="font-medium text-primary">Nothing to practice</h3>
        <p className="mt-1 text-sm text-text-muted">
          This exercise has no target notes{exercise.song_ref ? ' in its song section (the song may lack melody data)' : ''}.{' '}
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
        events={activeTargets}
        tuning={exercise?.target_notes ? undefined : song?.melody?.tuning}
        currentMs={phase === 'recording' && recordMs != null ? recordMs * takeSpeedRef.current : null}
        renderOverlay={({ xOfMs, yOfMidi, rowHeight }) => {
          // Trace samples are wall-clock; project onto the target timeline.
          const pts = traceRef.current
          const takeSpeed = takeSpeedRef.current
          if (pts.length < 2) return null
          const path = pts
            .map((s, i) => `${i ? 'L' : 'M'}${xOfMs(s.t_ms * takeSpeed).toFixed(1)},${(yOfMidi(s.midi) + rowHeight / 2).toFixed(1)}`)
            .join(' ')
          return <path d={path} fill="none" stroke="#2E8B57" strokeWidth={2} opacity={0.85} />
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SpeedControl
          value={speed}
          onChange={setSpeed}
          disabled={phase === 'listening' || phase === 'recording' || phase === 'saving'}
        />

        <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-surface p-0.5">
          <button
            type="button"
            onClick={() => setLoop(loop ? null : { from: 0, to: targets.length - 1 })}
            disabled={phase !== 'idle' && phase !== 'done'}
            aria-pressed={loopActive}
            title="Loop a section: listen repeats it, singing scores it (lesson progress not counted)"
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              loopActive ? 'bg-primary text-white' : 'text-text-muted hover:bg-primary/5'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" /> Loop
          </button>
          {loopActive && (
            <span className="flex items-center gap-1 pr-1 text-xs text-text-muted">
              notes
              <input
                type="number"
                min={1}
                max={loopTo + 1}
                value={loopFrom + 1}
                disabled={phase !== 'idle' && phase !== 'done'}
                onChange={(e) => setLoop({ from: Number(e.target.value) - 1, to: loopTo })}
                className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Loop from note"
              />
              –
              <input
                type="number"
                min={loopFrom + 1}
                max={targets.length}
                value={loopTo + 1}
                disabled={phase !== 'idle' && phase !== 'done'}
                onChange={(e) => setLoop({ from: loopFrom, to: Number(e.target.value) - 1 })}
                className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Loop to note"
              />
              / {targets.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleListen}
          disabled={phase === 'recording' || phase === 'saving'}
          className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === 'listening' ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {phase === 'listening' ? (loopActive ? 'Stop loop' : 'Stop') : loopActive ? 'Listen (loop)' : 'Listen'}
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
          <>
            <span className="flex items-center gap-2 text-sm text-danger">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Recording — sing now
            </span>
            <Tuner
              sample={
                lastSampleRef.current && performance.now() - lastSampleRef.current.at < 400
                  ? lastSampleRef.current.sample
                  : null
              }
            />
          </>
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
                {lessonId && loopActive && ' — loop practice (progress not counted)'}
                {lessonId && !loopActive && scores.overall_score >= COMPLETION_SCORE && ' — exercise completed!'}
                {lessonId && !loopActive && scores.overall_score < COMPLETION_SCORE && ` — reach ${COMPLETION_SCORE} to complete this exercise.`}
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
