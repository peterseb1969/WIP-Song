import { useRef, useState } from 'react'
import { useWipClient, useUpdateDocument } from '@wip/react'
import { Loader2, Upload, AlertTriangle } from 'lucide-react'
import { BASE, WIP_NAMESPACE } from '../lib/config'

/** Audio content via @wip/proxy's file streaming route (browser never sees the key). */
const fileContentUrl = (fileId: string) => `${BASE}wip/files/${fileId}/content`

/** The file store enforces the template's audio/* allowlist — octet-stream is
 *  rejected, so files the browser can't type get a MIME from their extension. */
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus', webm: 'audio/webm',
}
const audioMime = (file: File): string => {
  if (file.type.startsWith('audio/')) return file.type
  const ext = file.name.toLowerCase().split('.').pop() || ''
  return MIME_BY_EXT[ext] ?? 'audio/mpeg'
}

interface AudioTrackUploadProps {
  documentId: string
  field: 'audio_backing' | 'audio_full'
  label: string
  fileId?: string
  songTitle: string
}

/**
 * One audio slot on the song page (backing track / full mix): player when the
 * file exists, upload (or replace) via WIP file storage + a PATCH that sets
 * only this field — the melody and identity fields are never resent.
 */
export default function AudioTrackUpload({ documentId, field, label, fileId, songTitle }: AudioTrackUploadProps) {
  const wip = useWipClient()
  const updateDoc = useUpdateDocument()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      // 4th arg: the file endpoint requires namespace as a form field.
      const upload = await wip.files.uploadFile(
        new Blob([await file.arrayBuffer()], { type: audioMime(file) }),
        file.name,
        { description: `${label} — ${songTitle}`, tags: [field] },
        WIP_NAMESPACE,
      )
      await updateDoc.mutateAsync({ documentId, patch: { data: { [field]: upload.file_id } } })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text">{label}</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Uploading…' : fileId ? 'Replace' : `Upload ${label.toLowerCase()}`}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
      </div>
      {fileId ? (
        <audio controls preload="none" src={fileContentUrl(fileId)} className="w-full" />
      ) : (
        <p className="text-sm text-text-muted">
          No {label.toLowerCase()} yet — upload an MP3/WAV/OGG to {field === 'audio_backing' ? 'practice karaoke-style against it' : 'hear the original'}.
        </p>
      )}
      {error && (
        <div className="mt-2 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </section>
  )
}
