/**
 * Import parsing route. The client POSTs the raw file bytes
 * (application/octet-stream, filename in the query); the server parses and
 * returns melody candidates + metadata prefill. The client then picks a
 * track, edits metadata, and saves the SONG_TRACK itself via @wip/client
 * (original-file upload included) — parsing is the only server-side step.
 */

import { Router, raw } from 'express'
import { parseMidi } from '../lib/midi.js'

const router = Router()

router.post(
  '/import/parse',
  raw({ type: 'application/octet-stream', limit: '30mb' }),
  (req, res) => {
    const filename = String(req.query.filename || 'import.mid')
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Empty body — send the file as application/octet-stream' })
      return
    }
    const ext = filename.toLowerCase().split('.').pop() || ''
    if (!['mid', 'midi', 'kar'].includes(ext)) {
      res.status(415).json({ error: `Unsupported format .${ext} — MIDI (.mid) and MIDI karaoke (.kar) are supported today` })
      return
    }
    try {
      const parsed = parseMidi(req.body)
      // Prefill from "Artist - Title" filename convention.
      const base = filename.replace(/\.[^.]+$/, '')
      const dash = base.indexOf(' - ')
      const artist = dash > 0 ? base.slice(0, dash).trim() : ''
      const title = dash > 0 ? base.slice(dash + 3).trim() : base.trim()
      res.json({
        ...parsed,
        sourceFormat: ext === 'kar' ? 'KAR' : 'MIDI',
        prefill: { title, artist },
      })
    } catch (err) {
      res.status(422).json({ error: `Could not parse ${filename}: ${(err as Error).message}` })
    }
  },
)

export default router
