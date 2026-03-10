# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (hot reload, GLSL imports live)
npm run build    # production build
npm run preview  # preview production build locally
```

No test runner is configured. The `tests/` directory exists but is empty.

---

## Stack

- **Vite 6** + **vite-plugin-glsl** — `.glsl` files imported as strings
- **Three.js 0.172** — WebGL2, `WebGLRenderer`, `ShaderMaterial`, `WebGLRenderTarget`
- ES Modules only, no React, no UI frameworks

Do not suggest alternative stacks unless explicitly asked.

---

## Architecture

### Render Pipeline (3 passes)

`scene.js` runs a multi-pass render on every animation frame:

```
Pass 1: bgScene      → rt1   (Layer 1 + Layer 2 + Streaks composited)
Pass 2: bandsScene   → rt2   (Diagonal Bands reads rt1 as uBackground)
Pass 3: halftoneScene → screen (Halftone reads rt2 as uBackground)
```

`renderPasses(r, bgRT1, bgRT2, w, h, outputRT = null)` is shared between the live loop and both export paths (PNG and video) so all three produce identical output. The optional `outputRT` redirects the final pass to a render target instead of the screen.

### Data Flow

```
main.js
  └─ createScene(canvas)  → { start, uniforms, exportPNG, exportVideo, getLoopDuration, togglePause }
  └─ createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause)
```

`uniforms` object shape:
```js
{
  layer1:   uniforms1,        // gradient layer 1
  layer2:   uniforms2,        // gradient layer 2
  streaks:  uniformsStreaks,  // light streaks (additive highlights)
  bands:    uniformsBands,    // diagonal bands distortion
  halftone: uniformsHalftone, // halftone screen
}
```

### Layers

| Key | File | Scene | Blend | Description |
|-----|------|-------|-------|-------------|
| `layer1` | `gradientLayer1.glsl` | `bgScene` | `NormalBlending` (opaque base) | Diagonal sine wave or radial rings |
| `layer2` | `gradientLayer2.glsl` | `bgScene` | `AdditiveBlending`, transparent | Same modes, overlaid |
| `streaks` | `lightStreaks.glsl` | `bgScene` | `AdditiveBlending`, transparent | Elongated Gaussian highlights flowing along band direction |
| `bands` | `diagonalBands.glsl` | `bandsScene` | Reads `rt1` via `uBackground` | IOR-based refraction distortion |
| `halftone` | `halftone.glsl` | `halftoneScene` | Reads `rt2` via `uBackground` | Dot-grid screen overlay |

All layers share `baseVertex.glsl` as the vertex shader. Layers in `bgScene` render in draw order: layer1 → layer2 → streaks. Because `bgScene` is composited into `rt1` before the bands pass, all three are refracted together by the IOR glass effect.

### Uniform Standards

Layers 1 & 2 (animated gradient layers):
```glsl
uTime, uLayerEnabled, uSpeed, uOffset, uResolution
uRampColors[MAX_STOPS]    // flat Float32Array, RGB triplets, padded to 8
uRampPositions[MAX_STOPS] // sorted 0..1 positions, padded to 8
uRampCount                // int: number of active stops (2–8)
uLinearDrift              // bool: true = linear drift, false = radial growth
uDriftAngle               // float: radians, used in linear drift mode only
```

Gradient layer shader details:
- **Linear drift mode**: projects UV onto `uDriftAngle` axis; primary wave `sin(proj * 6.28318 + t)` plus sub-harmonic `sin(proj * 4.39823 - t * 0.7) * 0.22` (70% frequency, 22% amplitude) adds gradient richness without chaos.
- **Radial mode**: concentric rings from canvas centre; `dist = length(vUv - 0.5) * 2.8`. Smooth falloff via `smoothstep(0.55, 1.35, dist)` fades rings naturally toward edges (`mix(0.5, wave, falloff)`).
- When `uLayerEnabled = false`, layer 1 outputs `vec4(0)` (black/transparent); layer 2 also outputs `vec4(0)` — AdditiveBlending means zero contribution is correct for both.

Streaks layer:
```glsl
uTime, uLayerEnabled, uSpeed, uOffset
uAngle     // flow direction in radians (keep in sync with bands for alignment)
uSpacing   // streak tiling frequency — same unit as bands uSpacing
uWidth     // Gaussian sigma cross-flow, in lane fractions (0.01=razor, 0.2=fat)
uLength    // domain coverage [0..1]: maps to along-sigma [0..0.5] in tile space;
           // at 1.0 adjacent Gaussians overlap into a continuous band
uIntensity // peak additive brightness
uColor     // vec3 linear RGB, passed as THREE.Vector3
```

Streaks motion: `proj * uSpacing - (uTime * uSpeed + uOffset) + laneJitter` — streaks travel in the positive `uAngle` direction. Per-lane golden-ratio jitter (`lane * 0.6180339887`) staggers streaks so they read as scattered glints rather than a rigid grid.

`uLength` maps to along-sigma as `uLength * 0.5 + 0.005`. At sigma ≈ 0.5 (uLength = 1.0) the periodic Gaussian sum across adjacent tiles is nearly flat, merging discrete streaks into a solid band.

Streaks include a **radial vignette**: `1.0 - smoothstep(0.3, 0.75, length(vUv - 0.5))` — fades streaks toward the quad corners so they stay centred without hard clipping.

Bands layer: `uBackground, uTime, uLayerEnabled, uSpeed, uOffset, uSpacing, uAngle, uSoftness, uIOR, uThickness, uFresnel`

- `uThickness` [0..1]: blends `bandMask` (sharp slab) → `wave` (smooth height profile). At 1.0 displacement peaks at the crest and tapers to zero at the trough, simulating a true cylindrical lens.
- `uFresnel` [0..1]: attenuates displacement by `1 - uFresnel * slope²` where `slope = |cos(phase)|`. Slope is 0 at flat crests and 1 at steepest edges — concentrates refraction in the middle of each band. Uses raw phase slope rather than `N.z` because `STEEPNESS = 0.13` keeps `N` within 0.8° of vertical (too small for a visible cosθ variation).
- `STEEPNESS = 0.13` is a hardcoded artistic constant (not exposed as a uniform). Scales the height-field surface normal to control how curved the band reads as a lens.
- TIR (total internal reflection) guard: if `refract()` returns `vec3(0)`, falls back to `incident` (straight-through) to prevent black artifacts.

Halftone layer: `uBackground, uLayerEnabled, uResolution, uSpacing, uScale, uShadow`
(no `uTime` or `uSpeed` — halftone is a static screen applied to the composited image)

- Dot radius is driven by **perceptual luminance**: `lum = dot(bg.rgb, vec3(0.2126, 0.7152, 0.0722))`.
- Grid is computed in **pixel space** (`vUv * uResolution`) for a uniform grid regardless of aspect ratio.
- Anti-aliased circle edge: `1.5px` soft band via `smoothstep(radius - 1.5, radius + 1.5, dist)`.
- Inter-dot gap colour: `bg.rgb * uShadow` (0 = black gaps, 1 = no darkening).

`MAX_STOPS = 8` is defined in both `scene.js` and `controls.js` — keep in sync if changed.

### Pause / Play

`scene.js` tracks pause state with:
- `paused` flag
- `timeOffset` — accumulated seconds of paused wall-clock time
- `pauseTimestamp` — `performance.now()` snapshot at last pause

`togglePause()` returns the new `paused` boolean. The controls panel button reads this return value to switch its icon (`⏸` / `▶`). `togglePause` is passed as a 5th argument to `createControls`.

During video export, the live `requestAnimationFrame` loop is cancelled manually (not via `togglePause`), and is only restarted after export if `paused === false`.

### Export

**PNG** (`src/utils/export.js`):
- Creates an offscreen `WebGLRenderer` with **no `outputColorSpace` set** (intentional — all passes render into RTs, so Three.js must not inject sRGB encoding; we apply it manually).
- Final pass renders into a `FloatType` `WebGLRenderTarget` (`finalRT`). `FloatType` preserves full linear precision through readback; requires `EXT_color_buffer_float` (universally available in WebGL2 on desktop).
- Pixels are read back via `readRenderTargetPixels()` into a `Float32Array`.
- A **4096-entry LUT** applies the IEC 61966-2-1 sRGB transfer function. The LUT indexes on the linear float value (quantised to 12-bit before curve application) — error ≤ 0.4 output units vs. the live path.
- Y-flip (OpenGL bottom-first → canvas top-first) is done in the same pixel loop as the LUT application.
- Result is written to a `CanvasRenderingContext2D` via `putImageData()` then downloaded via `toDataURL('image/png')`.

**Video** (`src/utils/exportVideo.js`):
- Uses `canvas.captureStream(0)` + `MediaRecorder` on the **live canvas** (which already has correct sRGB output via `renderer.outputColorSpace = THREE.SRGBColorSpace`).
- `captureStream(0)` means no automatic browser sampling — frames are added manually via `videoTrack.requestFrame()` immediately after each `renderFrame()` call. This ensures frame-accurate output at any fps (see bug below).
- Produces a loopable WebM; codec priority: `vp9 → vp8 → webm` (picks first supported).
- `computeLoopDuration(speeds, targetSecs)` snaps to the nearest integer multiple of the fastest active layer's period (`2π / maxSpeed`) so the animation loops seamlessly. `activeSpeeds()` collects `[layer1, layer2, streaks, bands]` speed values.
- Frame pump uses `setTimeout` at `Math.round(1000 / fps)` ms intervals; final frame waits `ceil(2000 / fps)` ms before `recorder.stop()` to flush the last chunk.

**Live renderer**:
- Sets `renderer.outputColorSpace = THREE.SRGBColorSpace` explicitly so Three.js applies linear→sRGB encoding when rendering to the screen canvas.

### Controls Panel

`src/controls/controls.js` builds and injects a DOM panel (`position: fixed`) with sliders and pickers bound directly to `uniforms.*` values. No state layer — everything mutates uniforms in-place.

Panel section order: LAYER 1 → LAYER 2 → DIAGONAL BANDS → LIGHT STREAKS → HALFTONE → EXPORT VIDEO → EXPORT PNG.

Header: "COOL SHADEZ" title + pause/play button (⏸/▶).

Video export section has: FPS toggle (30 / 60), duration buttons (3s / 5s / 10s), progress bar. Hovering a duration button previews the exact snapped loop duration (`getLoopDuration(secs).toFixed(1)s`).

Helper functions at the bottom of `controls.js`:
- `makeSlider(label, min, max, value, step, onChange)` — range input row
- `makeSingleColor(label, uniform)` — single `<input type="color">` bound to a `{ value: THREE.Vector3 }` uniform; converts hex ↔ linear RGB via `THREE.Color`
- `makeColorRamp(initialStops, onRampChange)` — interactive draggable multi-stop ramp widget (used by layers 1 & 2 only)

Color ramp widget internals:
- `stopsFromUniforms(u)` — reads current Float32Array uniforms into `[{pos, color}]`
- `applyRamp(stops, u)` — writes sorted stops back into Float32Array uniforms + updates count
- `lerpStops(stops, t)` + `lerpHex(a, b, t)` — interpolates a color at position `t` for new-stop placement
- Click bar → inserts stop at clicked position (color interpolated from existing ramp)
- "+ stop" button → inserts at midpoint of the widest gap
- Drag triangle → repositions stop; releases and re-sorts on mouseup
- × button on swatch → deletes stop (only shown when `stops.length > 2`)

---

## Shader Design Principles

Prefer:
- Plane geometry fullscreen shaders (`PlaneGeometry(2, 2)` + `OrthographicCamera(-1,1,1,-1,0,1)`)
- Uniform-driven animation via `uTime`
- Smooth sine/cosine motion

Avoid:
- Expensive loops or noise stacks in fragment shaders
- Recursive shader logic
- Unnecessary postprocessing chains
- Heavy 3D geometry

Motion should feel: premium, elegant, intentional — not chaotic.

---

## Layer System Contract

Every new **animated** layer must:
- Support independent enable/disable via `uLayerEnabled`
- Expose `uSpeed` and `uOffset` for motion control
- Share `baseVertex.glsl` as its vertex shader
- Be isolated in its own `.glsl` file under `src/shaders/`

Post-processing layers (like halftone) that read a render target may omit `uTime`/`uSpeed`/`uOffset` if they apply no time-varying effect.

---

## Code Style

- Shaders in `src/shaders/*.glsl`, never inline strings in JS
- Scene setup in `scene.js`; controls DOM in `controls/controls.js`; export logic in `utils/`
- Comment non-obvious math in GLSL (e.g. sub-harmonics, falloff curves)
- Do NOT over-engineer — keep it minimal, performant, and modular

---

## Known Bugs & Fixes

### Bug: Washed / desaturated PNG export
**Symptom**: Exported PNG looked significantly brighter and less saturated than the live canvas.

**Root causes (two separate issues, both fixed):**

1. **256-entry integer LUT with late quantization** — the old export code built a `Uint8Array(256)` LUT where the sRGB curve was applied *after* the linear value was rounded to a `Uint8`. Because the sRGB curve has slope ≈ 12.92 near black, rounding errors of ±0.5/255 in the linear domain produced errors up to **3 output units** in dark tones, noticeably crushing shadow detail.

   **Fix**: Upgraded to a `4096-entry` LUT (`LUT_N = 4096`). The linear float is quantised to a 12-bit index *before* applying the curve — error ≤ 0.4 output units, indistinguishable from the live path.

2. **`readRenderTargetPixels()` returning Uint8 data** — when the export renderer's `finalRT` used the default `UnsignedByteType`, pixel readback returned pre-quantized 8-bit values. Combined with the LUT issue above, precision loss compounded.

   **Fix**: `finalRT` now uses `THREE.FloatType`. `readRenderTargetPixels()` fills a `Float32Array` with true 32-bit linear values, which are then fed into the 4096-entry LUT.

### Bug: Export / viewport color mismatch
**Symptom**: Colors in the exported PNG didn't match what was visible in the browser.

**Root cause**: The export renderer had `outputColorSpace = THREE.SRGBColorSpace` set. With `ShaderMaterial`, Three.js injects its own `linearToOutputColorSpace()` transform into the fragment shader when this is set — even when rendering to a `WebGLRenderTarget`. This meant colors were sRGB-encoded *twice*: once by Three.js inside the shader, and once by our manual LUT, producing blown-out highlights and shifted hues.

**Fix**: The export renderer intentionally does **not** set `outputColorSpace`. All passes render to render targets with default `NoColorSpace`; Three.js injects no encoding. The manual LUT in `export.js` is the sole sRGB transform.

The live renderer still sets `renderer.outputColorSpace = THREE.SRGBColorSpace` because it renders the final pass to the screen canvas (null render target), where Three.js encoding is correct and desired.

**Rule to remember**: `outputColorSpace = SRGBColorSpace` is correct only for rendering to the screen canvas. Never set it when rendering to a render target that will be read back manually.

### Bug: 60fps video export produces a still frame
**Symptom**: Exporting at 60fps produced a static image (or very short video); 30fps worked fine.

**Root cause**: `canvas.captureStream(fps)` spawns the browser's own internal capture timer at the requested rate. At 60fps, that timer fires every ~16.7ms — nearly identical to our `setTimeout` interval of `Math.round(1000/60) = 17ms`. The two independent timers immediately drift out of phase. The captureStream often fires before we've rendered a new frame, so it grabs the same (old) canvas content repeatedly, resulting in a video that is either a still frame or consists entirely of duplicate frames.

At 30fps (33ms intervals) there is enough slack between the two timers that drift is less harmful in practice.

**Fix**: Use `captureStream(0)` (no automatic browser sampling) and call `videoTrack.requestFrame()` once per render, immediately after `renderFrame()`. This makes frame capture fully manual and frame-accurate at any fps.

**Rule to remember**: Never pass a non-zero fps to `captureStream` when driving frames via `setTimeout`. Always use `captureStream(0)` + `requestFrame()` for frame-accurate video export.
