# Gradients — Pass 1 (Layer 1 + Layer 2)

First production stage. Two gradient layers composited into `rt1`.

## Files

| What | Path |
|------|------|
| Shader L1 | `src/shaders/gradientLayer1.glsl` |
| Shader L2 | `src/shaders/gradientLayer2.glsl` |
| Scene | `scene.js` — `uniforms1`, `uniforms2` |
| Controls | `controls.js` — `buildLayersSection`, `buildGradientLayerSub` |

## Blending

- **Layer 1**: `NormalBlending` (opaque base)
- **Layer 2**: `AdditiveBlending` (transparent overlay)

## Core Uniforms

`uTime, uLayerEnabled, uSpeed, uOffset, uResolution, uMode(int), uOklab(bool)`
`uRampColors[8], uRampPositions[8], uRampCount` — color ramp, `MAX_STOPS=8`

## Modes (`uMode`)

### 0 — Radial (Topographic Light Surface)
- Sqrt distance mapping for non-uniform contour compression
- Dual harmonics: primary + sub-harmonic at `freq * 0.614`
- Atmospheric falloff: `exp(-dist * 2.2) * smoothstep(0.0, 0.04, dist)`
- Topographic lighting when `uRipple > 0`: analytical normals, directional light via matcap sphere
- Uniforms: `uRipple, uRippleCount(1-20), uRippleCompress(0.01-20), uShadowDepth(0-1), uLightAngle(0-2pi)`
- Controls: matcap sphere + knob row (count, compress, shadow)

### 1 — Linear (Slide / Cloth / Liquid)
Sub-modes via `uLinearMotion`: **0=Slide** | **1=Cloth** | **2=Liquid**
- **Slide**: wave + sub-harmonic at 70%. `uDriftAngle, uCurve, uLinearCount`
- **Cloth**: 4 wave layers at irrational angles. `uClothScale, uClothDetail(0-1)`
- **Liquid**: domain warping (Quilez technique), value noise + quintic hermite. `uClothScale, uClothDetail(0-0.3)`
- Relief toggle available for all sub-modes

### 2 — Sweep (Angular Gradient)
- `uDriftAngle` = softness (0deg wide, 360deg sharp)
- `uSweepSeam(0-1)`: back-seam softness | `uSweepCenter(0-1)`: center blur

### 3 — Hypnotic (Koru Spiral)
- `log(dist) * coils - angle + time` for inner-coil compression
- Dual spirals at 0.618 ratio, integer-snapped coil count
- `uClothScale(0.3-3)`: twist | `uClothDetail(0-0.3)`: detail
- Speed slider hidden, no relief controls

## Color System

- `uOklab(bool)`: Oklab perceptual interpolation (default true)
- `evalRamp()` converts stop pairs to Oklab before `mix()`, converts back
- `stopsFromUniforms()` / `applyRamp()` for ramp read/write
- Color ramp widget: click to insert, drag to reorder, x to delete (min 2 stops)

## Controls Visibility

- Position pad: radial, sweep, hypnotic
- Matcap sphere: radial only (when ripple on)
- Speed slider: hidden in hypnotic
- Knob rows: radial (count/compress/shadow), hypnotic (twist/detail)

---

## Known Bug Pattern: Black Screen from Missing Layer 2 Uniforms

When adding a new uniform to gradient shaders, it must be added to **both** `uniforms1` and `uniforms2` in `scene.js`. The two layers have slightly different comment formatting, so `replace_all` edits may silently match only one. If the shader declares a `uniform` but `scene.js` doesn't provide it, Three.js fails to compile the shader and renders black with no visible error.

**Checklist for new uniforms:**
1. Add `uniform` declaration to both `gradientLayer1.glsl` and `gradientLayer2.glsl`
2. Add default value to `uniforms1` in `scene.js` (Layer 1)
3. Add default value to `uniforms2` in `scene.js` (Layer 2) — **verify manually**, don't trust `replace_all`
4. Add UI control in `controls.js`

## Production Bottlenecks

- **Liquid mode noise**: FBM octaves scale GPU cost. `uClothDetail` > 0.2 gets expensive.
- **Oklab conversion**: per-fragment color space round-trip on every stop pair. 8-stop ramps with Oklab = 16 conversions/pixel.
- **Dual harmonics**: two full ramp evaluations per pixel in radial/hypnotic modes.
