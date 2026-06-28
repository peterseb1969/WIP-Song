import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTerms, useCreateDocument } from '@wip/react'
import { ArrowLeft, Loader2, AlertTriangle, Plus, X, Save } from 'lucide-react'
import NoteViews from '../components/NoteViews'
import { WIP_NAMESPACE } from '../lib/config'
import { midiToNoteName, type Melody, type NoteEvent } from '../lib/music'

/**
 * Prefill passed via router state when authoring an exercise from a song
 * section (SongDetailPage → P2). Standalone drills (P3) start blank.
 */
export interface ExercisePrefill {
  song_ref?: string
  section_start_ms?: number
  section_end_ms?: number
  target_notes?: Melody
  title?: string
  exercise_type?: string
}

const DEFAULT_DURATION_MS = 600

/** Create a SONG_EXERCISE — a standalone drill, or prefilled from a song section. */
export default function ExerciseFormPage() {
  const navigate = useNavigate()
  const prefill = (useLocation().state as ExercisePrefill | null) ?? undefined

  const { data: types } = useTerms('SONG_EXERCISE_TYPE', { status: 'active', page_size: 100 })
  const { data: difficulties } = useTerms('SONG_DIFFICULTY', { status: 'active', page_size: 100 })
  const createDoc = useCreateDocument()

  const [code, setCode] = useState('')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [exerciseType, setExerciseType] = useState(prefill?.exercise_type ?? '')
  const [difficulty, setDifficulty] = useState('')
  const [description, setDescription] = useState('')
  const [events, setEvents] = useState<NoteEvent[]>(prefill?.target_notes?.events ?? [])
  const [newMidi, setNewMidi] = useState(60)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fromSong = !!prefill?.song_ref

  const addNote = () => {
    setEvents((prev) => {
      const start = prev.reduce((acc, e) => acc + e.duration_ms, 0)
      return [...prev, { midi: newMidi, start_ms: start, duration_ms: DEFAULT_DURATION_MS }]
    })
  }
  const removeNote = (i: number) => {
    setEvents((prev) => {
      // Drop note i and re-flow start_ms so the sequence stays contiguous.
      const kept = prev.filter((_, idx) => idx !== i)
      let t = 0
      return kept.map((e) => {
        const ev = { ...e, start_ms: t }
        t += e.duration_ms
        return ev
      })
    })
  }

  const handleSave = async () => {
    if (!code.trim() || !title.trim() || !exerciseType) {
      setError('Code, title, and type are required.')
      return
    }
    if (events.length === 0) {
      setError('Add at least one target note.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const target_notes: Melody = {
        tempo_bpm: prefill?.target_notes?.tempo_bpm ?? 90,
        events,
      }
      const res = await createDoc.mutateAsync({
        template_id: 'SONG_EXERCISE',
        namespace: WIP_NAMESPACE,
        data: {
          code: code.trim(),
          title: title.trim(),
          exercise_type: exerciseType,
          ...(difficulty ? { difficulty } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          target_notes,
          ...(prefill?.song_ref ? { song_ref: prefill.song_ref } : {}),
          ...(prefill?.section_start_ms != null ? { section_start_ms: prefill.section_start_ms } : {}),
          ...(prefill?.section_end_ms != null ? { section_end_ms: prefill.section_end_ms } : {}),
        },
        created_by: 'wip-song-app',
      })
      if (res.status === 'error') throw new Error(res.error || 'Exercise save failed.')
      const newId = res.document_id ?? res.id
      navigate(newId ? `/practice/${newId}` : '/author')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/author" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Author
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">New exercise</h1>
        {fromSong && <p className="mt-1 text-sm text-text-muted">From a song section — target notes prefilled.</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="code" className="text-xs font-medium uppercase tracking-wide text-text-muted">Code</label>
          <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="pitch-match-a4"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div>
          <label htmlFor="type" className="text-xs font-medium uppercase tracking-wide text-text-muted">Type</label>
          <select id="type" value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Select…</option>
            {types?.items.map((t) => <option key={t.term_id} value={t.value}>{t.label || t.value}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="title" className="text-xs font-medium uppercase tracking-wide text-text-muted">Title</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div>
          <label htmlFor="difficulty" className="text-xs font-medium uppercase tracking-wide text-text-muted">Difficulty</label>
          <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Not set</option>
            {difficulties?.items.map((t) => <option key={t.term_id} value={t.value}>{t.label || t.value}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="text-xs font-medium uppercase tracking-wide text-text-muted">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>

      {/* Target notes */}
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Target notes</span>
        {events.length > 0 && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-surface p-2">
            <NoteViews events={events} pxPerSecond={40} />
          </div>
        )}
        {!fromSong && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {events.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {midiToNoteName(e.midi)}
                  <button type="button" onClick={() => removeNote(i)} aria-label="Remove note" className="hover:text-danger"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setNewMidi((m) => Math.max(36, m - 1))} className="rounded-md border border-gray-200 px-2 py-1 text-sm hover:bg-gray-50">−</button>
              <span className="w-14 text-center text-sm font-medium text-text">{midiToNoteName(newMidi)}</span>
              <button type="button" onClick={() => setNewMidi((m) => Math.min(96, m + 1))} className="rounded-md border border-gray-200 px-2 py-1 text-sm hover:bg-gray-50">+</button>
              <button type="button" onClick={addNote} className="ml-2 flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5">
                <Plus className="h-4 w-4" /> Add note
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link to="/author" className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">Cancel</Link>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Create exercise
        </button>
      </div>
    </div>
  )
}
