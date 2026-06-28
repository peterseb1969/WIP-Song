import { Settings as SettingsIcon, PencilRuler } from 'lucide-react'
import { useAuthoringEnabled, setAuthoringEnabled } from '../lib/authoring'

/** Toggle row with a label, description, and an accessible switch. */
function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
          <p className="text-sm font-medium text-text">{label}</p>
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const authoring = useAuthoringEnabled()

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-text">
          <SettingsIcon className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="mt-1 text-sm text-text-muted">Preferences for this browser.</p>
      </header>

      <Toggle
        checked={authoring}
        onChange={setAuthoringEnabled}
        label="Curriculum authoring"
        description="Show the Author section for creating and editing lessons and exercises. Stored in this browser."
        icon={<PencilRuler className="h-5 w-5" />}
      />
    </div>
  )
}
