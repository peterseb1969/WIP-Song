/**
 * Web Audio helpers: reference-tone synthesis and microphone capture with
 * live pitch sampling. All practice audio runs through one shared
 * AudioContext (created lazily on first user gesture — autoplay policy).
 */

import { detectPitchHz } from './pitch'
import { frequencyToMidi, midiToFrequency, type NoteEvent } from './music'

let ctx: AudioContext | null = null
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
 * Play a note sequence as soft synth tones (triangle + quick envelope —
 * pleasant enough for pitch reference, no samples needed).
 * `rate` slows (<1) or speeds (>1) the timeline; pitch is unaffected.
 * Returns a cancel function.
 */
export function playNotes(events: NoteEvent[], onDone?: () => void, rate = 1): () => void {
  const ac = audioContext()
  const t0 = ac.currentTime + 0.05
  const nodes: OscillatorNode[] = []

  let endS = 0
  for (const e of events) {
    const start = t0 + e.start_ms / 1000 / rate
    const dur = e.duration_ms / 1000 / rate
    endS = Math.max(endS, e.start_ms / 1000 / rate + dur)

    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = midiToFrequency(e.midi)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.35, start + 0.02)
    gain.gain.setValueAtTime(0.35, start + Math.max(0.03, dur - 0.06))
    gain.gain.linearRampToValueAtTime(0, start + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + dur + 0.05)
    nodes.push(osc)
  }

  const timer = window.setTimeout(() => onDone?.(), (endS + 0.2) * 1000)
  return () => {
    window.clearTimeout(timer)
    for (const o of nodes) {
      try { o.stop() } catch { /* already stopped */ }
    }
  }
}

export interface PitchSample {
  /** ms since recording start */
  t_ms: number
  /** fractional MIDI number */
  midi: number
}

export interface RecordingSession {
  stop: () => Promise<{ blob: Blob; samples: PitchSample[]; durationMs: number }>
  cancel: () => void
}

/**
 * Start microphone capture: a MediaRecorder for the take (webm/opus where
 * supported) plus an analyser loop sampling pitch ~30×/s for the live trace.
 */
export async function startRecording(onSample?: (s: PitchSample) => void): Promise<RecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const ac = audioContext()
  const source = ac.createMediaStreamSource(stream)
  const analyser = ac.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  recorder.start()

  const startedAt = performance.now()
  const samples: PitchSample[] = []
  const frame = new Float32Array(analyser.fftSize)
  let polling = true
  let lastPoll = 0

  const poll = (now: number) => {
    if (!polling) return
    if (now - lastPoll >= 33) {
      lastPoll = now
      analyser.getFloatTimeDomainData(frame)
      const hz = detectPitchHz(frame, ac.sampleRate)
      if (hz != null) {
        const sample = { t_ms: Math.round(now - startedAt), midi: frequencyToMidi(hz) }
        samples.push(sample)
        onSample?.(sample)
      }
    }
    requestAnimationFrame(poll)
  }
  requestAnimationFrame(poll)

  const teardown = () => {
    polling = false
    source.disconnect()
    for (const track of stream.getTracks()) track.stop()
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          teardown()
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
            samples,
            durationMs: Math.round(performance.now() - startedAt),
          })
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = null
      try { recorder.stop() } catch { /* not started */ }
      teardown()
    },
  }
}
