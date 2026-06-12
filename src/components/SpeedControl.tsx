/** Segmented playback-speed picker (pitch is preserved at all speeds). */

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1] as const

export default function SpeedControl({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (speed: number) => void
  disabled?: boolean
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-surface p-0.5"
      role="group"
      aria-label="Playback speed"
    >
      {PLAYBACK_SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={`rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
            value === s ? 'bg-primary text-white' : 'text-text-muted hover:bg-primary/5'
          }`}
        >
          {s}×
        </button>
      ))}
    </div>
  )
}
