# Export — PNG / Video Output

Final production stage. All export paths use the same `renderPasses()` pipeline as the live viewport.

## Files

| What | Path |
|------|------|
| PNG export | `src/utils/export.js` |
| Video export | `src/utils/exportVideo.js` |
| Controls | `controls.js` — `buildExportSection` |
| Scene API | `scene.js` — `exportPNG, exportVideo, getLoopDuration, setAspectRatio, exportDimensions` |

---

## PNG Export

- Offscreen `WebGLRenderer` with `preserveDrawingBuffer: true`
- Calls `renderPasses()` with `outputRT = null` (renders to canvas)
- Captured via `toDataURL('image/png')` — identical to live viewport path
- Tiers: HD / 4K / 5K via `exportDimensions(tier)`
- **No manual sRGB LUT, no FloatType readback, no Y-flip**

## Video Export

- Uses **live canvas** with `captureStream(0)` + `MediaRecorder`
- Frames added manually via `videoTrack.requestFrame()` after each render
- Codec priority: `vp9 → vp8 → webm` (first supported)
- Loopable WebM output

### Loop Duration

`computeLoopDuration(speeds, targetSecs)` — snaps to nearest integer multiple of fastest layer's period (`2pi / maxSpeed`) for seamless loops.

### Frame Pump

- `setTimeout` at `Math.round(1000 / fps)` ms intervals
- Final frame waits `ceil(2000 / fps)` ms before `recorder.stop()` to flush

## Color Space

- Final pass: `outputColorSpace = THREE.SRGBColorSpace` (when `outputRT = null`)
- Intermediate passes: `LinearSRGBColorSpace`
- Both live and export paths share this behavior via `renderPasses()`

## Aspect Ratio

- `setAspectRatio(ratio)` — `null` = free, numeric = locked w/h
- `exportDimensions(tier)` — computes w/h from ratio + tier

## Pause / Play

- `paused` flag + `timeOffset` (accumulated pause time) + `pauseTimestamp`
- `togglePause()` returns new state; controls button reads it for icon swap
- Video export cancels `requestAnimationFrame` directly, restarts after if `paused === false`

## Controls Layout

- FPS toggle: 30 / 60
- Duration buttons: 3s / 5s / 10s (hover previews snapped loop duration)
- Progress bar during export

---

## Critical Rules

| Rule | Why |
|------|-----|
| Never use manual sRGB LUT for PNG | `ShaderMaterial` doesn't inject encoding reliably; double-gamma = washed out |
| Always `captureStream(0)` + `requestFrame()` | Non-zero fps drifts against `setTimeout` at 60fps = still frames |

---

## Production Bottlenecks

- **4K/5K PNG**: full pipeline re-render at high resolution. Every pass scales with pixel count.
- **Video export blocks UI**: renders on the live canvas, cancels animation loop during capture.
- **WebM codec limits**: browser-dependent codec support. No H.264 in MediaRecorder on most browsers.
- **Loop snapping**: `computeLoopDuration` can extend duration significantly if layer speeds don't share clean periods.
