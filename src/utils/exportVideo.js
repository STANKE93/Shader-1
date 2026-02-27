/**
 * Captures a frame-by-frame sequence as a loopable WebM video.
 *
 * The caller is responsible for rendering each frame when renderFrame(t) is invoked.
 * Frames run from t = 0 to t = loopDuration - dt (standard loop convention: the
 * frame at t = loopDuration is identical to t = 0, so it is not included — when
 * the video replays the transition back to frame 0 is indistinguishable from any
 * other inter-frame step).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Function}          renderFrame(t)  — synchronously renders one frame at time t
 * @param {number}            loopDuration    — exact loop duration in seconds (pre-computed)
 * @param {number}            fps
 * @param {Function}          onProgress(0..1)
 * @returns {Promise<void>}   resolves after download is triggered
 */
export async function exportVideo(canvas, renderFrame, loopDuration, fps, onProgress) {
  const totalFrames = Math.round(loopDuration * fps)
  const dt          = loopDuration / totalFrames

  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

  const stream   = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 15_000_000 })
  const chunks   = []

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  await new Promise(resolve => {
    recorder.onstop = resolve

    let frame = 0

    function next() {
      if (frame >= totalFrames) {
        // Allow the final frame to be captured before stopping
        setTimeout(() => recorder.stop(), Math.ceil(2000 / fps))
        return
      }

      renderFrame(frame * dt)
      onProgress(frame / totalFrames)
      frame++

      setTimeout(next, Math.round(1000 / fps))
    }

    recorder.start()
    // Brief startup delay so the recorder is ready before the first frame
    setTimeout(next, 150)
  })

  const blob = new Blob(chunks, { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `cool-shadez-loop-${loopDuration.toFixed(1)}s-${Date.now()}.webm`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Computes the shortest exact loop duration for the given set of animation speeds.
 * Each speed s has a period of 2π/s seconds. The loop duration is the smallest
 * value T such that T * s / (2π) is an integer for the dominant (fastest) speed.
 *
 * The target duration is rounded to the nearest integer multiple of that period.
 *
 * @param {number[]} speeds       — uSpeed values of all animated layers
 * @param {number}   targetSecs   — desired approximate duration
 * @returns {number}              — exact loop-safe duration in seconds
 */
export function computeLoopDuration(speeds, targetSecs) {
  const activeSpeeds = speeds.filter(s => s > 0)
  if (activeSpeeds.length === 0) return targetSecs

  // Use the fastest speed — its period is the shortest unit we must snap to
  const maxSpeed     = Math.max(...activeSpeeds)
  const basePeriod   = (2 * Math.PI) / maxSpeed  // seconds per cycle

  // Round the target to the nearest whole number of cycles (minimum 1)
  const cycles = Math.max(1, Math.round(targetSecs / basePeriod))
  return parseFloat((cycles * basePeriod).toFixed(4))
}
