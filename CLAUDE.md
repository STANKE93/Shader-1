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

### Render Pipeline (4 passes)

`scene.js` runs a multi-pass render on every animation frame:

```
Pass 1: bgScene       → rt1    (Layer 1 + Layer 2 composited)
Pass 2: bandsScene    → rt2    (Diagonal Bands reads rt1 as uBackground)
Pass 3: halftoneScene → rt3    (Halftone reads rt2 as uBackground)
Pass 4: lensScene     → screen (Lens Distortion reads rt3 as uBackground)
```

`renderPasses(r, bgRT1, bgRT2, bgRT3, w, h, outputRT = null)` is shared between the live loop and both export paths (PNG and video) so all three produce identical output. All paths render the final pass to the screen canvas (`outputRT = null`).

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
  lens:     uniformsLens,       // lens distortion (barrel, CA, vignette)
}
```

### Layers

| Key | File | Scene | Blend | Description |
|-----|------|-------|-------|-------------|
| `layer1` | `gradientLayer1.glsl` | `bgScene` | `NormalBlending` (opaque base) | Animated gradient: radial, linear, sweep, or hypnotic mode |
| `layer2` | `gradientLayer2.glsl` | `bgScene` | `AdditiveBlending`, transparent | Same modes as layer 1, overlaid |
| `streaks` | `lightStreaks.glsl` | `bgScene` | `AdditiveBlending`, transparent | **Currently disabled** (`uLayerEnabled: false`), UI removed. Shader code preserved for future rework |
| `bands` | `diagonalBands.glsl` | `bandsScene` | Reads `rt1` via `uBackground` | IOR glass refraction with Schlick Fresnel, Blinn-Phong specular, multi-tap blur |
| `halftone` | `halftone.glsl` | `halftoneScene` | Reads `rt2` via `uBackground` | Dot/square-grid screen overlay |
| `lens` | `lensDistortion.glsl` | `lensScene` | Reads `rt3` via `uBackground` | Barrel distortion, chromatic aberration, vignette |

All layers share `baseVertex.glsl` as the vertex shader.

`MAX_STOPS = 8` is defined in both `scene.js` and `controls.js` — keep in sync if changed.

---

## Feature Keyword Index

Semantic lookup for quickly finding and working on specific features. Each entry lists the feature name, keywords for search, and where to find the code.

### LAYERS — Gradient Layer 1 / Layer 2
**Keywords**: layer 1, layer 2, gradient, color ramp, radial, linear, sweep, hypnotic, drift, rings, topographic, ripple, blend mode, additive, opaque, cloth, liquid, spiral, koru
- Shader: `src/shaders/gradientLayer1.glsl`, `gradientLayer2.glsl`
- Scene: `scene.js` — `uniforms1`, `uniforms2`
- Controls: `controls.js` — `buildLayersSection`, `buildGradientLayerSub`
- Uniforms: `uTime, uLayerEnabled, uSpeed, uOffset, uResolution, uRampColors[8], uRampPositions[8], uRampCount, uMode(int), uDriftAngle, uRipple, uRippleCount, uRippleCompress, uSweepSeam, uSweepCenter, uOklab(bool), uCenterX, uCenterY, uLinearMotion(int), uLinearCount, uClothScale, uClothDetail, uCurve, uLightAngle, uLightColor, uShadowDepth, uReliefDepth`
- Modes via `uMode`: **0=Radial** / **1=Linear** / **2=Sweep** / **3=Hypnotic**
- Linear sub-modes via `uLinearMotion`: **0=Slide** / **1=Cloth** / **2=Liquid**
- Layer 1: `NormalBlending` (opaque base); Layer 2: `AdditiveBlending` (transparent overlay)
- Color ramp: `stopsFromUniforms` / `applyRamp`; `MAX_STOPS=8`
- **Color mix mode** (`uOklab`, bool, default `true`): Oklab perceptual interpolation for the color ramp. When enabled, `evalRamp()` converts each stop pair to Oklab space before `mix()`, then converts back. Controls: "Color mix" pill row (sRGB | Oklab) per layer.

#### Radial Mode — Topographic Light Surface
The radial mode renders an animated topographic light surface with defined central force:
- **Non-uniform contour compression** via sqrt distance mapping (`mapped = sqrt(dist * comp)`). Inner rings bunch tight, outer rings spread.
- **Dual harmonics**: primary wave + counter-propagating sub-harmonic at `freq * 0.614` (golden-ish ratio) for organic interference.
- **Atmospheric falloff**: `exp(-dist * 2.2) * smoothstep(0.0, 0.04, dist)` — exponential energy dissipation from center.
- **Topographic directional lighting** (when `uRipple > 0`): analytical surface normal derived from height-field gradient, lit by a virtual directional light controlled via matcap sphere UI.
- Controls (visible only in radial mode, inside Ripple 3D toggle):
  - **Matcap light sphere**: interactive 3D hemisphere for positioning light direction (maps to `uLightAngle`). Sits left of position pad, outside Ripple 3D section.
  - **Knob controls** (count, compress, shadow): rotary knob UI widgets in a single row
  - `uRippleCount` (1–20): ring density multiplier (default 7)
  - `uRippleCompress` (0.01–20): sqrt compression factor (default 6)
  - `uShadowDepth` (0–1): valley darkening
  - `uLightAngle` (0–2π): light azimuth, controlled by matcap sphere

#### Linear Mode
Projects UV onto drift axis and translates over time. Three sub-motion types:
- **Slide** (`uLinearMotion=0`): Primary wave + secondary sub-harmonic at 70% frequency. `uDriftAngle` for direction, `uCurve` for waveform shape, `uLinearCount` for band count.
- **Cloth** (`uLinearMotion=1`): 2D fabric surface with 4 wave layers at irrational angle ratios. `uClothScale` controls fold size, `uClothDetail` (0–1) fades secondary layers.
- **Liquid** (`uLinearMotion=2`): Nested domain warping (Inigo Quilez technique) for finger-in-water turbulence. Value noise with quintic hermite interpolation + analytical derivatives. `uClothScale` for scale, `uClothDetail` (0–0.3) for FBM octave detail.
- Relief toggle available for all linear sub-modes (shadow, light angle, light color).

#### Sweep Mode
Rotating angular gradient — color ramp sweeps like a clock hand:
- `uDriftAngle` remapped as softness: 0° → wide gradient, 360° → sharp edge
- `uSweepSeam` (0–1): back-seam softness (where ±π meets)
- `uSweepCenter` (0–1): center blur radius

#### Hypnotic Mode
Logarithmic koru spiral — a top-level mode (not a linear sub-motion):
- `log(dist) * coils - angle + time` for natural inner-coil compression
- Dual spirals: primary + counter-propagating sub-spiral at 0.618 ratio
- Integer-snapped coil count to avoid `atan()` seam discontinuity
- Controls: **Knob pair** (twist + detail) in a horizontal row with position pad
  - `uClothScale` (0.3–3): coil density (displayed as "twist" knob)
  - `uClothDetail` (0–0.3): sub-spiral detail (displayed as "detail" knob)
  - `uCenterX/uCenterY`: spiral center position via position pad
- Speed slider hidden in hypnotic mode (speed is fixed)
- No relief controls in hypnotic mode

### GEOMETRY — Bands (Diagonal Bands)
**Keywords**: bands, diagonal bands, parallel, burst, orbit, fan, spiral, refraction, IOR, glass, lens, snell, distortion, softness, thickness, fresnel, specular, blur, tilt, venetian blind, band shape, fill, invert, roughness, non-uniform
- Shader: `src/shaders/diagonalBands.glsl`
- Scene: `scene.js` — `uniformsBands`, `bandsScene`
- Controls: `controls.js` — `buildGeometrySection`, bandsPanel
- Core uniforms: `uBackground, uTime, uLayerEnabled, uSpeed, uOffset, uSpacing, uSoftness, uIOR, uThickness, uFresnel, uDistort, uStep`
- Glass section uniforms (in `makeAdvanced('Glass')`): `uAngle, uTilt, uTilt2, uTiltZ, uBlur, uBevelWidth (highlight spread), uBevelIntensity (highlight), uTintColor, uTintStrength, uRoughness`
- Fill uniforms: `uBandInvert` (0=Normal, 1=Invert, 2=Both)
- Non-uniform uniforms: `uBandRandom` (0/1 toggle), `uBandSeed` (randomizes spacing)
- Burst mode uniforms: `uBandsMode, uBurstCenterX, uBurstCenterY, uRaySpread, uRayLength, uRayIntensity`
- **Tilt X** (`uTilt`): venetian blind rotation around long axis — asymmetric refraction across stripe
- **Tilt Y** (`uTilt2`): lean forward/backward along stripe length (perp axis)
- **Tilt Z** (`uTiltZ`, range -1..1): Z normal modulation — steepness gradient, one edge flat / other steep
- **Fill** pill row: Normal (default) | Invert (swap glass/gap) | Both (full glass, no gaps)
- **Roughness** (`uRoughness`, 0–1): frosted glass effect via noise-based UV scatter + increased blur coefficient
- **Non-uniform spacing** (`uBandRandom`): per-cell hash offsets with hermite interpolation for organic band widths. Available in Parallel, Burst, Fan, Spiral modes.
- `STEEPNESS = 0.13` hardcoded artistic constant
- TIR guard: `refract()` returns `vec3(0)` → fallback to `incident`

#### Band Modes (`uBandsMode`)
- **0 = Parallel**: sinusoidal bands along `uAngle` direction. Uses `computeBand()` + `buildNormal()` + `compositeGlass()`.
- **1 = Burst**: radial rays from `(uBurstCenterX, uBurstCenterY)`. Angular phase via `atan()`. Simplified UI: only speed, IOR, Fresnel, spacing, center XY, rays.
- **2 = Orbit**: concentric rings from `(uBurstCenterX, uBurstCenterY)`. Distance-based phase. Softness forced to 1. Distort, blur, roughness hidden.
- **3 = Fan**: perspective-projected parallel bands converging toward a vanishing point. Uses projective division (`lateral / depth`). VP constrained to screen edges/corners via origin grid UI. `fanMask` fades behind VP and at extreme perspCoord values.
- **4 = Spiral**: logarithmic spiral bands from `(uBurstCenterX, uBurstCenterY)`. `log(dist) * spacing - angle + time` for koru-style arms. Center fade via `smoothstep(0.0, 0.04, dist)`. Uses `compositeGlass()` for per-arm refraction.

#### Glass Rendering Pipeline
The bands shader implements physically-inspired glass rendering:
1. **Schlick Fresnel** (`schlickFresnel`): `R0 + (1-R0) * (1-cosθ)^5` — edges reflect more, transmit less
2. **Blinn-Phong specular** (`glassSpecular`): virtual light from upper-left `(0.4, 0.6, 2.0)`, power controlled by `uBevelWidth` (mapped 256→16)
3. **Multi-tap directional blur** (`blurSample`): 7 taps along surface normal direction, radius scaled by `uBlur * 0.015 * thickMask`
4. **Frosted glass scatter** (when `uRoughness > 0`): noise-based UV offset + increased blur
5. **Tinted glass absorption**: `mix(bg, bg * uTintColor, uTintStrength * thickMask)`
6. **Compositing**: `tinted + rimLight + specular`

#### Per-Mode UI Visibility
- **Burst**: hides angle, intensity, fill, distort, non-uniform, softness, blur, roughness, thickness from UI
- **Orbit**: hides distort, blur, roughness; forces softness=1
- **Fan**: hides thickness, softness, blur, highlight, highlight spread, tint color, tint strength, angle from Glass section
- **Spiral**: hides fill pills, angle; shows spacing, center position pad
- Controls use `syncBandsMode()` to toggle visibility

### RENDERING — Halftone
**Keywords**: halftone, dots, circles, squares, screen, dot grid, luminance, shadow, anti-alias, shape
- Shader: `src/shaders/halftone.glsl`
- Scene: `scene.js` — `uniformsHalftone`, `halftoneScene`
- Controls: `controls.js` — `buildRenderingSection`
- Uniforms: `uBackground, uLayerEnabled, uResolution, uSpacing, uScale, uShadow, uShape`
- **Shape toggle** (`uShape`, int): **0=Circle** (Euclidean distance) / **1=Square** (Chebyshev distance `max(|dx|,|dy|)`)
- Dot radius driven by perceptual luminance; grid in pixel space; 1.5px AA edge
- No `uTime`/`uSpeed` — static screen effect

### RENDERING — Lens Distortion
**Keywords**: lens, barrel, pincushion, chromatic aberration, vignette, distortion, Brown-Conrady
- Shader: `src/shaders/lensDistortion.glsl`
- Scene: `scene.js` — `uniformsLens`, `lensScene`
- Controls: `controls.js` — `buildRenderingSection`, Lens subsection
- Uniforms: `uBackground, uResolution, uLayerEnabled, uBarrel, uChromaAberr, uVignetteStr, uVignetteSoft`
- **Barrel distortion**: Brown-Conrady two-term radial model (k1*r² + k2*r⁴), aspect-ratio corrected
- **Chromatic aberration**: per-channel barrel coefficients (R/G/B refract differently). Naturally increases toward edges.
- **Vignette**: cos⁴ natural optical falloff with configurable softness
- **Edge fade**: smooth falloff for out-of-bounds UVs at extreme barrel values
- Pass 4 (final): reads halftone output (`rt3`), renders to screen

### EXPORT — PNG / Video
**Keywords**: export, png, video, webm, capture, download, sRGB, LUT, color space, loop duration, fps, aspect ratio
- PNG: `src/utils/export.js` — offscreen renderer, renders to canvas, `toDataURL('image/png')`
- Video: `src/utils/exportVideo.js` — `captureStream(0)` + `requestFrame()`, MediaRecorder, loopable WebM
- Controls: `controls.js` — `buildExportSection`
- Aspect ratio control: `setAspectRatio(ratio)` — null = free, numeric = locked w/h
- Export dimensions: `exportDimensions(tier)` — computes w/h from aspect ratio + tier (HD/4K/5K)

### UI — Controls Panel
**Keywords**: controls, panel, slider, knob, color picker, ramp, pills, toggle, advanced, section, glass, matcap
- File: `src/controls/controls.js`
- Helpers: `makeSlider`, `makeKnob`, `makeMatcapSphere`, `makeDualSlider`, `makeSingleColor`, `makeColorRamp`, `makeToggle`, `makeAdvanced`, `makePositionPad`
- `makeAdvanced(buildBody, label = 'Advanced')` — collapsible section with custom label (used as 'Glass' for bands)
- Panel width: **326px** fixed
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
- `captureStream(0)` means no automatic browser sampling — frames are added manually via `videoTrack.requestFrame()` immediately after each `renderFrame()` call. This ensures frame-accurate output at any fps.
- Produces a loopable WebM; codec priority: `vp9 → vp8 → webm` (picks first supported).
- `computeLoopDuration(speeds, targetSecs)` snaps to the nearest integer multiple of the fastest active layer's period (`2π / maxSpeed`) so the animation loops seamlessly.
- Frame pump uses `setTimeout` at `Math.round(1000 / fps)` ms intervals; final frame waits `ceil(2000 / fps)` ms before `recorder.stop()` to flush the last chunk.
- Supports canvas-resolution and offscreen 4K export paths.

**Live renderer**:
- `renderPasses()` sets `outputColorSpace = THREE.SRGBColorSpace` for the final pass when rendering to the screen canvas (`outputRT = null`). Intermediate passes use `LinearSRGBColorSpace`.

### Controls Panel

`src/controls/controls.js` builds and injects a DOM panel (`position: fixed`, 326px wide) with sliders, knobs, and pickers bound directly to `uniforms.*` values. No state layer — everything mutates uniforms in-place.

Panel section order: LAYERS (Layer 1 / Layer 2) → GEOMETRY (Bands) → RENDERING (Halftone + Lens) → EXPORT.

Header: "COOL SHADEZ" title + randomize + pause/play button (⏸/▶).

Each gradient layer sub-panel has:
- Mode pills: Radial | Linear | Sweep | Hypnotic
- Speed slider (hidden in hypnotic mode)
- Position pad (visible in radial, sweep, hypnotic) + matcap light sphere (radial only, when ripple on)
- Radial group: Ripple 3D toggle → knob row (count, compress, shadow)
- Linear group: motion type pills (Slide | Cloth | Liquid), direction, curve/count (slide), fold/detail (cloth/liquid), relief toggle
- Sweep group: softness, seam, center sliders
- Hypnotic group: horizontal dashboard with position pad + twist knob + detail knob
- Color mix pills (sRGB | Oklab)
- Compact color ramp widget

Bands panel has:
- Mode pills: Parallel | Burst | Orbit | Fan | Spiral
- Core sliders: speed, distort
- Fill pill row: Normal | Invert | Both
- Step pill row: Normal | Doubled (in Parallel group)
- Non-uniform toggle + seed button (Parallel, Fan, Spiral)
- Glass section (collapsible `makeAdvanced('Glass')`): angle, tilt pad (X/Y/Z), IOR, Fresnel, thickness, softness, blur, highlight, highlight spread, tint color, tint strength, roughness
- Parallel group: spacing, angle, step pills
- Burst group: center XY, rays (simplified — many controls hidden)
- Orbit group: center XY (distort/blur/roughness hidden, softness forced to 1)
- Fan group: spacing, origin grid (3x3 CSS Grid for VP selection)
- Spiral group: spacing, center position pad

Lens subsection has: barrel, chromatic, vignette, softness (advanced).

Video export section has: FPS toggle (30 / 60), duration buttons (3s / 5s / 10s), progress bar. Hovering a duration button previews the exact snapped loop duration (`getLoopDuration(secs).toFixed(1)s`).

Helper functions:
- `makeSlider(label, min, max, value, step, onChange)` — range input row
- `makeKnob(label, min, max, value, step, onChange)` — rotary knob widget (SVG arc + pointer, vertical drag to change value). Used for ripple and hypnotic controls. Fixed 52px column width, 36px knob diameter.
- `makeMatcapSphere(uniformAngle)` — interactive 3D hemisphere for light direction. Per-pixel shading (half-Lambert diffuse + Blinn-Phong specular + Fresnel rim). Click/drag to reposition light. Maps to `uLightAngle`.
- `makeDualSlider(labelA, labelB, min, max, valA, valB, step, onChangeA, onChangeB)` — two compact sliders side by side
- `makeSingleColor(label, uniform)` — single `<input type="color">` bound to a `{ value: THREE.Vector3 }` uniform; converts hex ↔ linear RGB via `THREE.Color`
- `makeColorRamp(initialStops, onRampChange)` — interactive draggable multi-stop ramp widget (used by layers 1 & 2 only)
- `makePositionPad(uniformX, uniformY)` — rectangular XY pad (100x64px) for center position control
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

Post-processing layers (like halftone, lens) that read a render target may omit `uTime`/`uSpeed`/`uOffset` if they apply no time-varying effect.

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

**Root cause**: The old export pipeline rendered the final pass into a `FloatType` `WebGLRenderTarget` with `outputColorSpace = LinearSRGBColorSpace`, read back raw float pixels via `readRenderTargetPixels()`, and applied a manual 4096-entry sRGB LUT. `ShaderMaterial` in Three.js 0.172 does not reliably inject output encoding, so the manual LUT applied gamma to already-final values.

**Fix**: Render to an offscreen canvas (null RT) and use `toDataURL('image/png')` — identical path to the live viewport.

**Rule to remember**: Do not use a manual sRGB LUT for PNG export. Render to a canvas (null RT) and use `toDataURL()`.

### Bug: 60fps video export produces a still frame
**Symptom**: Exporting at 60fps produced a static image; 30fps worked fine.

**Root cause**: `canvas.captureStream(fps)` timer drifts against the `setTimeout` render loop at 60fps.

**Fix**: Use `captureStream(0)` + `videoTrack.requestFrame()` for frame-accurate manual capture.

**Rule to remember**: Never pass a non-zero fps to `captureStream` when driving frames via `setTimeout`. Always use `captureStream(0)` + `requestFrame()`.

### Bug: controls.js crashes on load — temporal dead zone (TDZ)
**Symptom**: App fails to load with a ReferenceError before scene renders.

**Root cause**: `const` variable referenced before its declaration in arrays or function calls. Has occurred with `tiltPadRow` (in `prismHiddenRows` array) and `matcapSphere` (in `syncRipple` called before creation).

**Fix**: Move `const` creation above any code that references it.

**Rule to remember**: When building arrays of DOM element references or functions that reference DOM elements, ensure all referenced `const` variables are declared before any code that accesses them. Declaration order matters for `const`/`let` — unlike `function` declarations, they are not hoisted. This is especially critical in `buildGradientLayerSub` where `syncMode`/`syncRipple` are called during construction.
