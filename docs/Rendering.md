# Rendering — Pass 3 (Halftone) + Pass 4 (Lens Distortion)

Final visual processing before export. Halftone reads `rt2`, outputs `rt3`. Lens reads `rt3`, outputs to screen.

---

## Halftone (Pass 3)

### Files

| What | Path |
|------|------|
| Shader | `src/shaders/halftone.glsl` |
| Scene | `scene.js` — `uniformsHalftone`, `halftoneScene` |
| Controls | `controls.js` — `buildRenderingSection` |

### Uniforms

`uBackground, uLayerEnabled, uResolution, uSpacing, uScale, uShadow, uShape`

### Behavior

- **Shape** (`uShape`): 0=Circle (Euclidean) / 1=Square (Chebyshev `max(|dx|,|dy|)`)
- Dot radius driven by perceptual luminance
- Grid computed in pixel space, 1.5px anti-aliased edge
- Static effect — no `uTime` or `uSpeed`

---

## Lens Distortion (Pass 4 — Final)

### Files

| What | Path |
|------|------|
| Shader | `src/shaders/lensDistortion.glsl` |
| Scene | `scene.js` — `uniformsLens`, `lensScene` |
| Controls | `controls.js` — `buildRenderingSection`, Lens subsection |

### Uniforms

`uBackground, uResolution, uLayerEnabled, uBarrel, uChromaAberr, uVignetteStr, uVignetteSoft`

### Barrel Distortion

- Brown-Conrady two-term radial model: `k1*r^2 + k2*r^4`
- Aspect-ratio corrected
- Positive = outward (black edges, unusable for backgrounds)
- **Negative = pincushion** (safe for backgrounds)

### Chromatic Aberration

- Per-channel barrel coefficients (R/G/B refract differently)
- Naturally increases toward edges

### Vignette

- `cos^4` natural optical falloff
- `uVignetteSoft` controls softness

### Edge Handling

- Smooth falloff for out-of-bounds UVs at extreme barrel values

---

## Controls Layout

- **Halftone**: spacing, scale, shadow, shape toggle (circle/square)
- **Lens**: barrel, chromatic, vignette, softness (in advanced section)

---

## Production Bottlenecks

- **Chromatic aberration**: 3 separate texture lookups (one per channel) at different UV offsets. Triples bandwidth.
- **Barrel + CA combined**: each channel gets its own distorted UV — 3 dependent texture reads with non-linear UV mapping.
- **Halftone at high resolution**: pixel-space grid means dot count scales with resolution. 4K = 4x the dots vs 1080p.
- **Pass ordering**: lens distortion amplifies any halftone artifacts. Halftone dot aliasing becomes more visible after barrel warp.
