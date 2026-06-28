import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  useDocument,
  useQueryDocuments,
  useTerms,
  useCreateDocument,
  useDeleteDocument,
} from '@wip/react'
import { ArrowLeft, Loader2, AlertTriangle, ArrowUp, ArrowDown, X, Plus, Save } from 'lucide-react'
import { WIP_NAMESPACE } from '../lib/config'
import type { ExerciseData, LessonData } from '../lib/types'

const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '')

interface EdgeData {
  source_ref: string
  target_ref: string
  sequence: number
}

/**
 * Create / edit a lesson and its ordered exercises. The lesson is a
 * SONG_LESSON doc; each exercise link is a SONG_LESSON_EXERCISE edge
 * (source=lesson, target=exercise, sequence=position). Reorder/remove edits
 * or deletes edges on save (CASE-493 edge model).
 */
export default function LessonBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: difficulties } = useTerms('SONG_DIFFICULTY', { status: 'active', page_size: 100 })
  const catalog = useQueryDocuments({
    template_id: 'SONG_EXERCISE',
    filters: [],
    sort_by: 'data.code',
    sort_order: 'asc',
    page_size: 100,
  })
  const exerciseById = useMemo(
    () => new Map((catalog.data?.items ?? []).map((d) => [d.document_id, d.data as unknown as ExerciseData])),
    [catalog.data],
  )

  // Edit-mode prefill: lesson doc + existing edges (with their doc ids, needed
  // to delete removed links on save).
  const { data: lessonDoc, isLoading: lessonLoading } = useDocument(id ?? '')
  const edgesQ = useQueryDocuments(
    {
      template_id: 'SONG_LESSON_EXERCISE',
      filters: id ? [{ field: 'data.source_ref', operator: 'eq', value: id }] : [],
      sort_by: 'data.sequence',
      sort_order: 'asc',
      page_size: 100,
    },
    { enabled: isEdit },
  )

  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [selected, setSelected] = useState<string[]>([]) // ordered exercise document_ids
  const [picker, setPicker] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // One-time prefill once the lesson + edges have loaded (edit mode).
  useEffect(() => {
    if (!isEdit || prefilled) return
    if (lessonLoading || edgesQ.isLoading) return
    const l = lessonDoc?.data as LessonData | undefined
    if (l) {
      setCode(l.code ?? '')
      setTitle(l.title ?? '')
      setDescription(l.description ?? '')
      setDifficulty(l.difficulty ?? '')
    }
    setSelected((edgesQ.data?.items ?? []).map((e) => (e.data as unknown as EdgeData).target_ref))
    setPrefilled(true)
  }, [isEdit, prefilled, lessonLoading, edgesQ.isLoading, lessonDoc, edgesQ.data])

  const createDoc = useCreateDocument()
  const deleteDoc = useDeleteDocument()

  const addable = (catalog.data?.items ?? []).filter((d) => !selected.includes(d.document_id))

  const move = (i: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }
  const remove = (exId: string) => setSelected((prev) => prev.filter((x) => x !== exId))
  const addPicked = () => {
    if (picker && !selected.includes(picker)) setSelected((prev) => [...prev, picker])
    setPicker('')
  }

  const handleSave = async () => {
    if (!code.trim() || !title.trim()) {
      setError('Code and title are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // 1. Upsert the lesson (identity is `code`; edit re-versions the same doc).
      const lessonRes = await createDoc.mutateAsync({
        template_id: 'SONG_LESSON',
        namespace: WIP_NAMESPACE,
        data: {
          code: code.trim(),
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(difficulty ? { difficulty } : {}),
        },
        created_by: 'wip-song-app',
      })
      if (lessonRes.status === 'error') throw new Error(lessonRes.error || 'Lesson save failed.')
      const lessonId = id ?? lessonRes.document_id ?? lessonRes.id
      if (!lessonId) throw new Error('No lesson id returned.')

      // 2. Reconcile edges: delete links no longer wanted, upsert the rest with
      //    their new sequence (edge identity is (source,target); versioned:false
      //    so re-create overwrites the sequence).
      const existing = edgesQ.data?.items ?? []
      for (const e of existing) {
        const targetRef = (e.data as unknown as EdgeData).target_ref
        if (!selected.includes(targetRef)) {
          await deleteDoc.mutateAsync({ id: e.document_id })
        }
      }
      for (let i = 0; i < selected.length; i++) {
        const edgeRes = await createDoc.mutateAsync({
          template_id: 'SONG_LESSON_EXERCISE',
          namespace: WIP_NAMESPACE,
          data: { source_ref: lessonId, target_ref: selected[i]!, sequence: i + 1 },
          created_by: 'wip-song-app',
        })
        if (edgeRes.status === 'error') throw new Error(edgeRes.error || 'Saving an exercise link failed.')
      }

      navigate(`/lessons/${lessonId}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && (lessonLoading || !prefilled)) {
    return (
      <div className="flex items-center gap-3 py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading lesson…
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/author" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Author
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          {isEdit ? 'Edit lesson' : 'New lesson'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="code" className="text-xs font-medium uppercase tracking-wide text-text-muted">Code</label>
          <input
            id="code"
            type="text"
            value={code}
            disabled={isEdit}
            onChange={(e) => setCode(e.target.value)}
            placeholder="beginner-1"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-gray-50 disabled:text-text-muted"
          />
        </div>
        <div>
          <label htmlFor="difficulty" className="text-xs font-medium uppercase tracking-wide text-text-muted">Difficulty</label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not set</option>
            {difficulties?.items.map((t) => (
              <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="title" className="text-xs font-medium uppercase tracking-wide text-text-muted">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div>
        <label htmlFor="description" className="text-xs font-medium uppercase tracking-wide text-text-muted">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Ordered exercises */}
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Exercises (in order)</span>
        {selected.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No exercises yet — add some below.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {selected.map((exId, i) => {
              const ex = exerciseById.get(exId)
              return (
                <li key={exId} className="flex items-center justify-between rounded-md border border-gray-200 bg-surface p-2.5">
                  <span className="text-sm text-text">
                    {i + 1}. {ex?.title ?? exId}
                    {ex && <span className="ml-2 text-xs text-text-muted">{pretty(ex.exercise_type)}</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-text-muted hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label="Move down" className="rounded p-1 text-text-muted hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => remove(exId)} aria-label="Remove" className="rounded p-1 text-danger hover:bg-danger/10"><X className="h-4 w-4" /></button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-3 flex items-center gap-2">
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            className="flex-1 rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">{addable.length ? 'Add an exercise…' : 'All exercises added'}</option>
            {addable.map((d) => {
              const ex = d.data as unknown as ExerciseData
              return <option key={d.document_id} value={d.document_id}>{ex.title} ({pretty(ex.exercise_type)})</option>
            })}
          </select>
          <button
            type="button"
            onClick={addPicked}
            disabled={!picker}
            className="flex items-center gap-1 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link to="/author" className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">Cancel</Link>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !code.trim() || !title.trim()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save changes' : 'Create lesson'}
        </button>
      </div>
    </div>
  )
}
