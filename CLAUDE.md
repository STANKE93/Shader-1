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
Pass 1: bgScene      → rt1   (Layer 1 + Layer 2 composited)
Pass 2: bandsScene   → rt2   (Diagonal Bands reads rt1 as uBackground)
Pass 3: halftoneScene → screen (Halftone reads rt2 as uBackground)
```

`renderPasses(renderer, bgRT1, bgRT2, w, h)` is shared between the live loop and both export paths (PNG and video) so all three produce identical output.

### Data Flow

```
main.js
  └─ createScene(canvas)  → { start, uniforms, exportPNG, exportVideo, getLoopDuration }
  └─ createControls(uniforms, exportPNG, exportVideo, getLoopDuration)
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

All layers share `baseVertex.glsl` as the vertex shader. Layers in `bgScene` render in add order: layer1 → layer2 → streaks. Because `bgScene` is composited into `rt1` before the bands pass, all three are refracted together by the IOR glass effect.

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

`uLength` maps to along-sigma as `uLength * 0.5 + 0.005`. At sigma ≈ 0.5 (uLength = 1.0) the periodic Gaussian sum across adjacent tiles is nearly flat, merging discrete streaks into a solid band. This is the only non-trivial uniform mapping in the codebase.

Bands layer: `uBackground, uTime, uLayerEnabled, uSpeed, uOffset, uSpacing, uAngle, uSoftness, uIOR, uThickness, uFresnel`

- `uThickness` [0..1]: blends `bandMask` (sharp slab) → `wave` (smooth height profile). At 1.0 displacement peaks at the crest and tapers to zero at the trough, simulating a true cylindrical lens.
- `uFresnel` [0..1]: attenuates displacement by `1 - uFresnel * slope²` where `slope = |cos(phase)|`. Slope is 0 at flat crests and 1 at steepest edges — concentrates refraction in the middle of each band. Uses raw phase slope rather than `N.z` because `STEEPNESS = 0.13` keeps `N` within 0.8° of vertical (too small for a visible cosθ variation).

Halftone layer: `uBackground, uLayerEnabled, uResolution, uSpacing, uScale, uShadow`
(no `uTime` or `uSpeed` — halftone is a static screen applied to the composited image)

`MAX_STOPS = 8` is defined in both `scene.js` and `controls.js` — keep in sync if changed.

### Export

- **PNG**: `src/utils/export.js` — creates an offscreen `WebGLRenderer`, runs all three passes with the final halftone pass rendering into a `WebGLRenderTarget` (`finalRT`) instead of null. Pixels are read back via `readRenderTargetPixels()` (always returns linear data regardless of browser), the IEC 61966-2-1 sRGB transfer function is applied with a 256-entry LUT, the rows are Y-flipped (OpenGL bottom-first → canvas top-first), and the result is written to a `CanvasRenderingContext2D` for `toDataURL()`. This bypasses the browser inconsistency where `toDataURL()` on a hardware-sRGB WebGL canvas returns pre-conversion linear values, producing dull exports.
- **Video**: `src/utils/exportVideo.js` — uses `canvas.captureStream()` + `MediaRecorder` on the live canvas (which already has correct sRGB output) to produce a loopable WebM; `computeLoopDuration()` snaps the requested duration to an integer multiple of the fastest layer's period (2π/uSpeed) so the animation loops seamlessly.
- `renderPasses(r, bgRT1, bgRT2, w, h, outputRT = null)` — the optional `outputRT` argument lets export redirect the final pass to a render target; live loop passes nothing (defaults to null = screen).
- The live renderer sets `renderer.outputColorSpace = THREE.SRGBColorSpace` explicitly so Three.js applies linear→sRGB encoding when rendering to the screen canvas.

### Controls Panel

`src/controls/controls.js` builds and injects a DOM panel (`position: fixed`) with sliders and pickers bound directly to `uniforms.*` values. No state layer — everything mutates uniforms in-place.

Panel section order: LAYER 1 → LAYER 2 → DIAGONAL BANDS → LIGHT STREAKS → HALFTONE → EXPORT VIDEO → EXPORT PNG.

Helper functions at the bottom of `controls.js`:
- `makeSlider(label, min, max, value, step, onChange)` — range input row
- `makeSingleColor(label, uniform)` — single `<input type="color">` bound to a `{ value: THREE.Vector3 }` uniform; converts hex ↔ linear RGB via `THREE.Color`
- `makeColorRamp(initialStops, onRampChange)` — interactive draggable multi-stop ramp widget (used by layers 1 & 2 only)

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
