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
Pass 1: bgScene       → rt1    (Layer 1 + Layer 2 composited)
Pass 2: bandsScene    → rt2    (Diagonal Bands reads rt1 as uBackground)
Pass 3: halftoneScene → screen (Halftone reads rt2 as uBackground)
```

`renderPasses(r, bgRT1, bgRT2, w, h, outputRT = null)` is shared between the live loop and both export paths (PNG and video) so all three produce identical output. All paths render the final pass to the screen canvas (`outputRT = null`). The `outputRT` parameter exists for potential future use but is not currently used.

### Data Flow

```
main.js
  └─ createScene(canvas)  → { start, uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot, setAspectRatio, exportDimensions }
  └─ createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot)
```

`uniforms` object shape:
```js
{
  layer1:   uniforms1,          // gradient layer 1
  layer2:   uniforms2,          // gradient layer 2
  streaks:  uniformsStreaks,    // light streaks (disabled, code preserved)
  bands:    uniformsBands,      // diagonal bands distortion
  halftone: uniformsHalftone,   // halftone screen
}
```

### Layers

| Key | File | Scene | Blend | Description |
|-----|------|-------|-------|-------------|
| `layer1` | `gradientLayer1.glsl` | `bgScene` | `NormalBlending` (opaque base) | Animated gradient: radial, linear, or sweep mode |
| `layer2` | `gradientLayer2.glsl` | `bgScene` | `AdditiveBlending`, transparent | Same modes as layer 1, overlaid |
| `streaks` | `lightStreaks.glsl` | `bgScene` | `AdditiveBlending`, transparent | **Currently disabled** (`uLayerEnabled: false`), UI removed. Shader code preserved for future rework |
| `bands` | `diagonalBands.glsl` | `bandsScene` | Reads `rt1` via `uBackground` | IOR glass refraction with Schlick Fresnel, Blinn-Phong specular, multi-tap blur |
| `halftone` | `halftone.glsl` | `halftoneScene` | Reads `rt2` via `uBackground` | Dot/square-grid screen overlay |

All layers share `baseVertex.glsl` as the vertex shader.

`MAX_STOPS = 8` is defined in both `scene.js` and `controls.js` — keep in sync if changed.

---

## Feature Keyword Index

Semantic lookup for quickly finding and working on specific features. Each entry lists the feature name, keywords for search, and where to find the code.

### LAYERS — Gradient Layer 1 / Layer 2
**Keywords**: layer 1, layer 2, gradient, color ramp, radial, linear, sweep, drift, rings, topographic, ripple, blend mode, additive, opaque
- Shader: `src/shaders/gradientLayer1.glsl`, `gradientLayer2.glsl`
- Scene: `scene.js` — `uniforms1`, `uniforms2`
- Controls: `controls.js` — `buildLayersSection`, `buildGradientLayerSub`
- Uniforms: `uTime, uLayerEnabled, uSpeed, uOffset, uResolution, uRampColors[8], uRampPositions[8], uRampCount, uMode(int), uDriftAngle, uRipple, uRippleCount, uRippleCompress, uSweepSeam, uSweepCenter`
- Modes via `uMode`: **0=Radial** / **1=Linear** (uses `uDriftAngle`, sub-harmonic) / **2=Sweep** (rotating angular gradient)
- Layer 1: `NormalBlending` (opaque base); Layer 2: `AdditiveBlending` (transparent overlay)
- Color ramp: `stopsFromUniforms` / `applyRamp`; `MAX_STOPS=8`

#### Radial Mode — Topographic Light Surface
The radial mode renders an animated topographic light surface with defined central force:
- **Non-uniform contour compression** via sqrt distance mapping (`mapped = sqrt(dist * comp)`). Inner rings bunch tight, outer rings spread.
- **Dual harmonics**: primary wave + counter-propagating sub-harmonic at `freq * 0.614` (golden-ish ratio) for organic interference.
- **Atmospheric falloff**: `exp(-dist * 2.2) * smoothstep(0.0, 0.04, dist)` — exponential energy dissipation from center.
- **Topographic directional lighting** (when `uRipple > 0`): analytical surface normal derived from height-field gradient, lit by a virtual directional light from upper-left `(0.4, 0.55, 1.0)`.
- Controls (visible only in radial mode):
  - `uRipple` (0–1): topographic lighting depth
  - `uRippleCount` (1–20): ring density multiplier (default 7)
  - `uRippleCompress` (0.01–20): sqrt compression factor — higher = tighter center bunching (default 6)

#### Sweep Mode
Rotating angular gradient — color ramp sweeps like a clock hand:
- `uDriftAngle` remapped as softness: 0° → wide gradient, 360° → sharp edge
- `uSweepSeam` (0–1): back-seam softness (where ±π meets)
- `uSweepCenter` (0–1): center blur radius

#### Linear Mode
Projects UV onto drift axis and translates over time:
- Primary wave + secondary sub-harmonic at 70% frequency for gradient richness
- `uDriftAngle`: drift direction in radians

### GEOMETRY — Bands (Diagonal Bands)
**Keywords**: bands, diagonal bands, parallel, burst, refraction, IOR, glass, lens, snell, distortion, softness, thickness, fresnel, specular, blur, tilt, venetian blind, band shape, fill, invert
- Shader: `src/shaders/diagonalBands.glsl`
- Scene: `scene.js` — `uniformsBands`, `bandsScene`
- Controls: `controls.js` — `buildGeometrySection`, bandsPanel
- Core uniforms: `uBackground, uTime, uLayerEnabled, uSpeed, uOffset, uSpacing, uSoftness, uIOR, uThickness, uFresnel, uDistort, uStep`
- Glass section uniforms (in `makeAdvanced('Glass')`): `uAngle, uTilt, uTilt2, uTiltZ, uBlur, uBevelWidth (highlight spread), uBevelIntensity (highlight), uTintColor, uTintStrength`
- Fill uniforms: `uBandInvert` (0=Normal, 1=Invert, 2=Both), `uBandShape` (0=flat, 1=tube, 2=fin — UI removed but uniform preserved)
- Burst mode uniforms: `uBandsMode, uBurstCenterX, uBurstCenterY, uRaySpread, uRayLength, uRayIntensity`
- **Tilt X** (`uTilt`): venetian blind rotation around long axis — asymmetric refraction across stripe
- **Tilt Y** (`uTilt2`): lean forward/backward along stripe length (perp axis)
- **Tilt Z** (`uTiltZ`, range -1..1): Z normal modulation — steepness gradient, one edge flat / other steep
- **Fill** pill row: Normal (default) | Invert (swap glass/gap) | Both (full glass, no gaps)
- `STEEPNESS = 0.13` hardcoded artistic constant
- TIR guard: `refract()` returns `vec3(0)` → fallback to `incident`

#### Glass Rendering Pipeline
The bands shader implements physically-inspired glass rendering:
1. **Schlick Fresnel** (`schlickFresnel`): `R0 + (1-R0) * (1-cosθ)^5` — edges reflect more, transmit less
2. **Blinn-Phong specular** (`glassSpecular`): virtual light from upper-left `(0.4, 0.6, 2.0)`, power controlled by `uBevelWidth` (mapped 256→16)
3. **Multi-tap directional blur** (`blurSample`): 7 taps along surface normal direction, radius scaled by `uBlur * 0.015 * thickMask`
4. **Tinted glass absorption**: `mix(bg, bg * uTintColor, uTintStrength * thickMask)`
5. **Compositing**: `tinted + rimLight + specular` (parallel) or `+ rayAdd` (burst)

#### Band Shape Options (uniform preserved, UI removed)
- `uBandShape = 0` (flat): sinusoidal profile — `gradMag = cos(phase) * STEEPNESS`
- `uBandShape = 1` (tube): cylindrical — `gradMag = crossPos * STEEPNESS * 3.0`
- `uBandShape = 2` (fin): tapered ridge — steep at center, flat at edges

### EFFECTS — Light Streaks (DISABLED)
**Keywords**: streaks, light streaks, gaussian, glints, highlights, additive, vignette, flicker, parallel streaks, rings
- **Currently disabled**: `uLayerEnabled: false` in scene.js, UI section removed from controls
- Shader code preserved in `src/shaders/lightStreaks.glsl` for future rework
- Modes in shader: 0=parallel, 1=burst, 2=vortex, 3=rings (only parallel + rings were exposed in UI before removal)
- Scene: `scene.js` — `uniformsStreaks` (mesh still in `bgScene`)

### RENDERING — Halftone
**Keywords**: halftone, dots, circles, squares, screen, dot grid, luminance, shadow, anti-alias, shape
- Shader: `src/shaders/halftone.glsl`
- Scene: `scene.js` — `uniformsHalftone`, `halftoneScene`
- Controls: `controls.js` — `buildRenderingSection`
- Uniforms: `uBackground, uLayerEnabled, uResolution, uSpacing, uScale, uShadow, uShape`
- **Shape toggle** (`uShape`, int): **0=Circle** (Euclidean distance) / **1=Square** (Chebyshev distance `max(|dx|,|dy|)`)
- Dot radius driven by perceptual luminance; grid in pixel space; 1.5px AA edge
- No `uTime`/`uSpeed` — static screen effect

### EXPORT — PNG / Video
**Keywords**: export, png, video, webm, capture, download, sRGB, LUT, color space, loop duration, fps, aspect ratio
- PNG: `src/utils/export.js` — offscreen renderer, renders to canvas, `toDataURL('image/png')`
- Video: `src/utils/exportVideo.js` — `captureStream(0)` + `requestFrame()`, MediaRecorder, loopable WebM
- Controls: `controls.js` — `buildExportSection`
- Aspect ratio control: `setAspectRatio(ratio)` — null = free, numeric = locked w/h
- Export dimensions: `exportDimensions(tier)` — computes w/h from aspect ratio + tier (HD/4K/5K)

### UI — Controls Panel
**Keywords**: controls, panel, slider, color picker, ramp, pills, toggle, advanced, section, glass
- File: `src/controls/controls.js`
- Helpers: `makeSlider`, `makeDualSlider`, `makeSingleColor`, `makeColorRamp`, `makeToggle`, `makeAdvanced`
- `makeAdvanced(buildBody, label = 'Advanced')` — collapsible section with custom label (used as 'Glass' for bands)
- Panel sections (top to bottom): Layers → Geometry → Rendering → Export

### Pause / Play

`scene.js` tracks pause state with:
- `paused` flag
- `timeOffset` — accumulated seconds of paused wall-clock time
- `pauseTimestamp` — `performance.now()` snapshot at last pause

`togglePause()` returns the new `paused` boolean. The controls panel button reads this return value to switch its icon (`⏸` / `▶`). `togglePause` is passed as a 5th argument to `createControls`.

During video export, the live `requestAnimationFrame` loop is cancelled manually (not via `togglePause`), and is only restarted after export if `paused === false`.

### Export

**PNG** (`src/utils/export.js`):
- Creates an offscreen `WebGLRenderer` with a canvas and `preserveDrawingBuffer: true`.
- The `renderFrame` callback calls `renderPasses(offRenderer, offRT1, offRT2, w, h)` with `outputRT = null` (screen canvas). This means the final pass uses the **identical pipeline** as the live viewport — same color handling, same `outputColorSpace` switching inside `renderPasses`.
- The offscreen canvas is then captured via `toDataURL('image/png')` — exactly like the snapshot button, just at the requested export resolution (HD/4K/5K).
- No manual sRGB LUT, no FloatType readback, no Y-flip — the browser handles all of this through the standard canvas-to-PNG path.

**Video** (`src/utils/exportVideo.js`):
- Uses `canvas.captureStream(0)` + `MediaRecorder` on the **live canvas** (which already has correct sRGB output via `renderer.outputColorSpace = THREE.SRGBColorSpace`).
- `captureStream(0)` means no automatic browser sampling — frames are added manually via `videoTrack.requestFrame()` immediately after each `renderFrame()` call. This ensures frame-accurate output at any fps (see bug below).
- Produces a loopable WebM; codec priority: `vp9 → vp8 → webm` (picks first supported).
- `computeLoopDuration(speeds, targetSecs)` snaps to the nearest integer multiple of the fastest active layer's period (`2π / maxSpeed`) so the animation loops seamlessly. `activeSpeeds()` collects `[layer1, layer2, streaks, bands]` speed values.
- Frame pump uses `setTimeout` at `Math.round(1000 / fps)` ms intervals; final frame waits `ceil(2000 / fps)` ms before `recorder.stop()` to flush the last chunk.
- Supports canvas-resolution and offscreen 4K export paths.

**Live renderer**:
- `renderPasses()` sets `outputColorSpace = THREE.SRGBColorSpace` for the final pass when rendering to the screen canvas (`outputRT = null`). Intermediate passes use `LinearSRGBColorSpace`.

### Controls Panel

`src/controls/controls.js` builds and injects a DOM panel (`position: fixed`) with sliders and pickers bound directly to `uniforms.*` values. No state layer — everything mutates uniforms in-place.

Panel section order: LAYERS (Layer 1 / Layer 2) → GEOMETRY (Bands) → RENDERING (Halftone) → EXPORT.

Header: "COOL SHADEZ" title + pause/play button (⏸/▶).

Each gradient layer sub-panel has:
- Mode pills: Radial | Linear | Sweep
- Speed slider (always visible)
- Radial group (visible in radial mode): ripple, count, compression sliders
- Direction slider (visible in linear mode)
- Sweep group (visible in sweep mode): softness, seam, center sliders
- Compact color ramp widget

Bands panel has:
- Mode pills: Parallel | Burst
- Core sliders: speed, spacing, softness, IOR, thickness, Fresnel, distort
- Fill pill row: Normal | Invert | Both
- Step pill row: Normal | Doubled
- Glass section (collapsible `makeAdvanced('Glass')`): angle, tilt pad (X/Y/Z), blur, highlight spread, highlight, tint color, tint strength
- Burst-specific controls: center XY, rays, ray length, ray intensity

Video export section has: FPS toggle (30 / 60), duration buttons (3s / 5s / 10s), progress bar. Hovering a duration button previews the exact snapped loop duration (`getLoopDuration(secs).toFixed(1)s`).

Helper functions:
- `makeSlider(label, min, max, value, step, onChange)` — range input row
- `makeDualSlider(labelA, labelB, min, max, valA, valB, step, onChangeA, onChangeB)` — two compact sliders side by side
- `makeSingleColor(label, uniform)` — single `<input type="color">` bound to a `{ value: THREE.Vector3 }` uniform; converts hex ↔ linear RGB via `THREE.Color`
- `makeColorRamp(initialStops, onRampChange)` — interactive draggable multi-stop ramp widget (used by layers 1 & 2 only)
- `makeAdvanced(buildBody, label = 'Advanced')` — collapsible section with custom label

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

### Bug: HD / 4K / 5K PNG exports washed out (manual sRGB LUT approach)
**Symptom**: Exported PNGs at HD/4K/5K were significantly brighter and more washed out than the live canvas. Snapshots (viewport-resolution `canvas.toDataURL()`) looked correct.

**Root cause**: The old export pipeline rendered the final pass into a `FloatType` `WebGLRenderTarget` with `outputColorSpace = LinearSRGBColorSpace`, read back raw float pixels via `readRenderTargetPixels()`, and applied a manual 4096-entry sRGB LUT. The assumption was that `ShaderMaterial` gets automatic sRGB encoding from Three.js when `outputColorSpace = SRGBColorSpace` — and therefore the export path needed its own manual encoding when rendering to an RT.

In practice, **`ShaderMaterial` in Three.js 0.172 does not reliably inject output encoding**. The live canvas displays the raw shader output without sRGB conversion, and the snapshot captures those exact values via `toDataURL()`. The manual LUT then applied an sRGB gamma curve to values that were already "final," lifting mid-tones (e.g., linear 0.5 → sRGB 0.735) and producing the washed-out appearance.

A secondary contributing factor: the export intermediate RTs used `HalfFloatType` while the live pipeline used default `UnsignedByteType`. With additive blending (Layer 2), values above 1.0 were preserved in the HalfFloat export but clipped in the live path, making bright regions appear even brighter in exports.

**Fix**: Replaced the entire FloatType-RT + manual-LUT + Y-flip pipeline with the same approach as the snapshot: render the final pass to an offscreen **canvas** (null render target, not an RT) and capture via `toDataURL('image/png')`. The export now uses `renderPasses(offRenderer, offRT1, offRT2, w, h)` with `outputRT = null`, so the final halftone pass goes through the identical color path as the live viewport. Intermediate RTs use `makeRT()` (same as live).

**Rule to remember**: Do not use a manual sRGB LUT for PNG export. Render to a canvas (null RT) and use `toDataURL()` — this guarantees pixel-perfect match with the live viewport regardless of how Three.js handles `ShaderMaterial` output encoding. The snapshot button proves this approach works.

### Bug: 60fps video export produces a still frame
**Symptom**: Exporting at 60fps produced a static image (or very short video); 30fps worked fine.

**Root cause**: `canvas.captureStream(fps)` spawns the browser's own internal capture timer at the requested rate. At 60fps, that timer fires every ~16.7ms — nearly identical to our `setTimeout` interval of `Math.round(1000/60) = 17ms`. The two independent timers immediately drift out of phase. The captureStream often fires before we've rendered a new frame, so it grabs the same (old) canvas content repeatedly, resulting in a video that is either a still frame or consists entirely of duplicate frames.

At 30fps (33ms intervals) there is enough slack between the two timers that drift is less harmful in practice.

**Fix**: Use `captureStream(0)` (no automatic browser sampling) and call `videoTrack.requestFrame()` once per render, immediately after `renderFrame()`. This makes frame capture fully manual and frame-accurate at any fps.

**Rule to remember**: Never pass a non-zero fps to `captureStream` when driving frames via `setTimeout`. Always use `captureStream(0)` + `requestFrame()` for frame-accurate video export.
