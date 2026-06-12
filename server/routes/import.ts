/**
 * Import parsing route. The client POSTs the raw file bytes
 * (application/octet-stream, filename in the query); the server parses and
 * returns melody candidates + metadata prefill. The client then picks a
 * track, edits metadata, and saves the SONG_TRACK itself via @wip/client
 * (original-file upload included) — parsing is the only server-side step.
 */

import { Router, raw } from 'express'
import { parseMidi } from '../lib/midi.js'
import { parseGp } from '../lib/gp.js'

const router = Router()

const GP_EXTS = ['gp3', 'gp4', 'gp5']

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
    if (ext === 'gp' || ext === 'gpx') {
      res.status(415).json({ error: `.${ext} (Guitar Pro 6/7+) is not supported yet — export as .gp5 from Guitar Pro, or wait for the GP7 importer` })
      return
    }
    if (!['mid', 'midi', 'kar', ...GP_EXTS].includes(ext)) {
      res.status(415).json({ error: `Unsupported format .${ext} — MIDI (.mid/.kar) and Guitar Pro 3/4/5 (.gp3/.gp4/.gp5) are supported today` })
      return
    }
    try {
      const isGp = GP_EXTS.includes(ext)
      const parsed = isGp ? parseGp(req.body) : parseMidi(req.body)
      // Prefill: file-internal metadata (Guitar Pro) beats the
      // "Artist - Title" filename convention; fall back per field.
      const base = filename.replace(/\.[^.]+$/, '')
      const dash = base.indexOf(' - ')
      const fnArtist = dash > 0 ? base.slice(0, dash).trim() : ''
      const fnTitle = dash > 0 ? base.slice(dash + 3).trim() : base.trim()
      res.json({
        ...parsed,
        sourceFormat: isGp ? 'GUITAR_PRO' : ext === 'kar' ? 'KAR' : 'MIDI',
        prefill: {
          title: parsed.prefill?.title?.trim() || fnTitle,
          artist: parsed.prefill?.artist?.trim() || fnArtist,
        },
      })
    } catch (err) {
      res.status(422).json({ error: `Could not parse ${filename}: ${(err as Error).message}` })
    }
  },
)

export default router
