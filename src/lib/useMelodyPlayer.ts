import { useCallback, useEffect, useRef, useState } from 'react'
import { audioContext } from './audio'
import { midiToFrequency, type NoteEvent } from './music'

export type PlayerStatus = 'stopped' | 'playing' | 'paused'

/**
 * Pausable melody playback with a playhead, for the synth (MIDI-derived)
 * melody views. Unlike lib/audio.ts `playNotes` (which schedules every
 * oscillator upfront with a fixed onDone timer and only supports stop), this
 * tracks an offset so pause/resume work: pause stops the live oscillators and
 * remembers the position; resume re-schedules the notes from that offset.
 *
 * Events are played in their own start_ms timeline; `playheadMs` is reported in
 * that same timeline (callers that skip leading silence rebase events first and
 * add the offset back for display). rate <1 slows, >1 speeds; pitch unaffected.
 * Changing rate only takes effect on the next play()/resume() (the transport
 * disables the speed control while not stopped).
 */
export function useMelodyPlayer(events: NoteEvent[], rate = 1) {
  const [status, setStatusState] = useState<PlayerStatus>('stopped')
  const [playheadMs, setPlayheadMs] = useState<number | null>(null)

  // statusRef mirrors `status` for use inside callbacks (avoids stale closures
  // and keeps logic out of setState updaters, which StrictMode may double-run).
  const statusRef = useRef<PlayerStatus>('stopped')
  const setStatus = useCallback((s: PlayerStatus) => {
    statusRef.current = s
    setStatusState(s)
  }, [])

  // Read latest events/rate at play time without re-subscribing effects.
  const eventsRef = useRef(events)
  eventsRef.current = events
  const rateRef = useRef(rate)
  rateRef.current = rate

  const nodesRef = useRef<OscillatorNode[]>([])
  const rafRef = useRef<number | null>(null)
  const offsetRef = useRef(0) // ms into the melody where the current segment began
  const segStartRef = useRef(0) // performance.now() when the current segment began

  const totalMs = () =>
    eventsRef.current.reduce((m, e) => Math.max(m, e.start_ms + e.duration_ms), 0)

  const clearNodes = useCallback(() => {
    for (const o of nodesRef.current) {
      try { o.stop() } catch { /* already stopped */ }
    }
    nodesRef.current = []
  }, [])
  const clearRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const stop = useCallback(() => {
    clearNodes()
    clearRaf()
    offsetRef.current = 0
    setPlayheadMs(null)
    setStatus('stopped')
  }, [clearNodes, clearRaf])

  // Schedule every note at/after `fromMs` (notes already sounding are dropped)
  // and start the playhead animation from there.
  const scheduleFrom = useCallback(
    (fromMs: number) => {
      const ac = audioContext()
      const r = rateRef.current
      const t0 = ac.currentTime + 0.05
      const nodes: OscillatorNode[] = []
      for (const e of eventsRef.current) {
        if (e.start_ms < fromMs) continue
        const start = t0 + (e.start_ms - fromMs) / 1000 / r
        const dur = e.duration_ms / 1000 / r
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
      nodesRef.current = nodes
      offsetRef.current = fromMs
      segStartRef.current = performance.now()
      const total = totalMs()
      const tick = () => {
        const cur = offsetRef.current + (performance.now() - segStartRef.current) * rateRef.current
        if (cur >= total) {
          stop()
          return
        }
        setPlayheadMs(cur)
        rafRef.current = requestAnimationFrame(tick)
      }
      setPlayheadMs(fromMs)
      rafRef.current = requestAnimationFrame(tick)
    },
    [stop],
  )

  const play = useCallback(() => {
    if (!eventsRef.current.length) return
    clearNodes()
    clearRaf()
    scheduleFrom(0)
    setStatus('playing')
  }, [clearNodes, clearRaf, scheduleFrom])

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return
    const cur = offsetRef.current + (performance.now() - segStartRef.current) * rateRef.current
    clearNodes()
    clearRaf()
    offsetRef.current = Math.max(0, cur)
    setPlayheadMs(offsetRef.current)
    setStatus('paused')
  }, [clearNodes, clearRaf, setStatus])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    scheduleFrom(offsetRef.current)
    setStatus('playing')
  }, [scheduleFrom, setStatus])

  // Stop cleanly on unmount.
  useEffect(() => () => { clearNodes(); clearRaf() }, [clearNodes, clearRaf])

  return { status, playheadMs, play, pause, resume, stop }
}
