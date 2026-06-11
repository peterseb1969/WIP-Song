/**
 * Monophonic pitch detection via autocorrelation (ACF2+ shape: RMS gate,
 * lag-bounded autocorrelation, first-decline peak search, parabolic
 * interpolation). Good enough for singing in the 65–1000 Hz range.
 */

const MIN_HZ = 65 // ~C2
const MAX_HZ = 1000 // ~B5
const RMS_GATE = 0.01

/** Detected frequency in Hz, or null when the frame is silence/noise. */
export function detectPitchHz(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length

  let rms = 0
  for (let i = 0; i < n; i++) rms += buf[i]! * buf[i]!
  rms = Math.sqrt(rms / n)
  if (rms < RMS_GATE) return null

  const minLag = Math.floor(sampleRate / MAX_HZ)
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / MIN_HZ))

  // Autocorrelation over the singing-range lags only (keeps the frame cheap).
  const corr = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += buf[i]! * buf[i + lag]!
    corr[lag] = sum
  }

  // Skip the initial decline from the zero-lag peak, then take the best peak.
  let d = minLag
  while (d + 1 <= maxLag && corr[d + 1]! < corr[d]!) d++
  let bestLag = -1
  let bestVal = -Infinity
  for (let lag = d; lag <= maxLag; lag++) {
    if (corr[lag]! > bestVal) {
      bestVal = corr[lag]!
      bestLag = lag
    }
  }
  if (bestLag <= 0) return null

  // Confidence gate: peak must be a meaningful fraction of frame energy.
  let energy = 0
  for (let i = 0; i < n; i++) energy += buf[i]! * buf[i]!
  if (bestVal / energy < 0.3) return null

  // Parabolic interpolation around the peak for sub-sample lag precision.
  let lag = bestLag
  if (bestLag > minLag && bestLag < maxLag) {
    const y1 = corr[bestLag - 1]!
    const y2 = corr[bestLag]!
    const y3 = corr[bestLag + 1]!
    const denom = y1 - 2 * y2 + y3
    if (denom !== 0) lag = bestLag + (0.5 * (y1 - y3)) / denom
  }

  return sampleRate / lag
}
