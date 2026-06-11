import { useEffect, useState } from 'react'
import { useTerms, useCreateDocument } from '@wip/react'
import { Loader2, Check, AlertTriangle } from 'lucide-react'
import { useSinger, type SingerData } from '../contexts/SingerContext'
import { WIP_NAMESPACE } from '../lib/config'
import { midiToNoteName } from '../lib/music'

const NOTE_VIEWS = [
  { value: 'piano', label: 'Piano roll' },
  { value: 'fretboard', label: 'Fretboard' },
  { value: 'both', label: 'Both' },
] as const

export default function ProfilePage() {
  const { me, singerData, isLoading } = useSinger()
  const { data: voiceTypes } = useTerms('SONG_VOICE_TYPE', { status: 'active', page_size: 100 })
  const save = useCreateDocument()

  const [form, setForm] = useState<SingerData | null>(null)

  // Initialize the form once the profile document arrives.
  useEffect(() => {
    if (singerData && !form) setForm(singerData)
  }, [singerData, form])

  if (isLoading || !form) {
    return (
      <div className="flex items-center gap-3 py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading profile…
      </div>
    )
  }

  const set = <K extends keyof SingerData>(key: K, value: SingerData[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const handleSave = () => {
    // Upsert: same subject → new version of the same SONG_SINGER doc.
    const data: Record<string, unknown> = { ...form }
    for (const k of Object.keys(data)) {
      if (data[k] === '' || data[k] === undefined || data[k] === null) delete data[k]
    }
    save.mutate({ template_id: 'SONG_SINGER', namespace: WIP_NAMESPACE, data, created_by: 'wip-song-app' })
  }

  const rangeHint = (midi?: number) => (typeof midi === 'number' ? midiToNoteName(midi) : '—')

  return (
    <div className="max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as <span className="font-medium text-text">{me?.sub}</span>
          {me?.source === 'fallback' && ' (local dev — no login configured)'}
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-surface p-6 shadow-sm">
        <div>
          <label htmlFor="display_name" className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Display name
          </label>
          <input
            id="display_name"
            type="text"
            value={form.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label htmlFor="voice_type" className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Voice type
          </label>
          <select
            id="voice_type"
            value={form.voice_type || ''}
            onChange={(e) => set('voice_type', e.target.value || undefined)}
            className="mt-1 w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not set</option>
            {voiceTypes?.items.map((t) => (
              <option key={t.term_id} value={t.value}>{t.label || t.value}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="range_low" className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Range low (MIDI) · {rangeHint(form.range_low_midi)}
            </label>
            <input
              id="range_low"
              type="number"
              min={0}
              max={127}
              value={form.range_low_midi ?? ''}
              onChange={(e) => set('range_low_midi', e.target.value === '' ? undefined : Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label htmlFor="range_high" className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Range high (MIDI) · {rangeHint(form.range_high_midi)}
            </label>
            <input
              id="range_high"
              type="number"
              min={0}
              max={127}
              value={form.range_high_midi ?? ''}
              onChange={(e) => set('range_high_midi', e.target.value === '' ? undefined : Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Note view</span>
          <div className="mt-2 flex gap-2">
            {NOTE_VIEWS.map(({ value, label }) => {
              const isSelected = (form.preferences?.note_view || 'both') === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('preferences', { ...form.preferences, note_view: value })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-surface text-text-muted hover:bg-gray-50'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-sm text-text-muted">How melodies are displayed — piano roll, guitar fretboard, or both.</p>
        </div>

        {save.isError && (
          <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-sm text-danger">{(save.error as Error).message}</p>
          </div>
        )}
        {save.isSuccess && !save.isPending && (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-success">
            <Check className="h-4 w-4" /> Profile saved.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending || !form.display_name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
