# Geometry — Pass 2 (Diagonal Bands)

Glass refraction layer. Reads `rt1` (gradients) via `uBackground`, writes to `rt2`.

## Files

| What | Path |
|------|------|
| Shader | `src/shaders/diagonalBands.glsl` |
| Scene | `scene.js` — `uniformsBands`, `bandsScene` |
| Controls | `controls.js` — `buildGeometrySection`, `syncBandsMode()` |

## Core Uniforms

`uBackground, uTime, uLayerEnabled, uSpeed, uOffset, uSpacing, uSoftness, uIOR, uThickness, uFresnel, uDistort, uStep`

## Glass Uniforms (in `makeAdvanced('Glass')`)

`uAngle, uTilt, uTilt2, uTiltZ, uBlur, uBevelWidth(highlight spread), uBevelIntensity(highlight), uTintColor, uTintStrength, uRoughness`

## Other Uniforms

- Fill: `uBandInvert` (0=Normal, 1=Invert, 2=Both)
- Non-uniform: `uBandRandom(0/1)`, `uBandSeed`
- Burst/Spiral: `uBandsMode, uBurstCenterX, uBurstCenterY, uRaySpread, uRayLength, uRayIntensity`

## Band Modes (`uBandsMode`)

| Mode | Shape | Phase | Notes |
|------|-------|-------|-------|
| 0 Parallel | Sinusoidal strips | `uAngle` direction | `computeBand()` + `buildNormal()` + `compositeGlass()` |
| 1 Burst | Radial rays | `atan()` angular | Simplified UI — hides most glass controls |
| 2 Orbit | Concentric rings | Distance-based | Softness forced to 1, hides distort/blur/roughness |
| 3 Fan | Perspective-projected | Projective division | VP via origin grid, `fanMask` fades behind VP |
| 4 Spiral | Logarithmic spiral | `log(dist)*sp - angle + time` | Center fade `smoothstep(0.0, 0.04, dist)` |

## Glass Rendering Pipeline

1. **Schlick Fresnel**: `R0 + (1-R0)(1-costheta)^5` — edges reflect more
2. **Blinn-Phong specular**: light at `(0.4, 0.6, 2.0)`, power via `uBevelWidth` (256->16)
3. **7-tap directional blur**: along surface normal, radius = `uBlur * 0.015 * thickMask`
4. **Frosted scatter** (when `uRoughness > 0`): noise UV offset + increased blur
5. **Tint absorption**: `mix(bg, bg * uTintColor, uTintStrength * thickMask)`
6. **Composite**: `tinted + rimLight + specular`

## Tilt System

- **Tilt X** (`uTilt`): venetian blind rotation — asymmetric refraction across stripe
- **Tilt Y** (`uTilt2`): lean along stripe length (perp axis)
- **Tilt Z** (`uTiltZ`, -1..1): steepness gradient, one edge flat / other steep

## Constants & Guards

- `STEEPNESS = 0.13` — hardcoded artistic constant
- TIR guard: `refract()` returns `vec3(0)` -> fallback to `incident`

## Per-Mode UI Visibility

- **Burst**: hides angle, fill, distort, non-uniform, softness, blur, roughness, thickness
- **Orbit**: hides distort, blur, roughness; forces softness=1
- **Fan**: hides thickness, softness, blur, highlights, tint, angle from Glass
- **Spiral**: hides fill pills, angle; shows spacing + center pad

---

## Production Bottlenecks

- **7-tap blur**: main GPU cost. Each tap = one `texture2D`. At high `uBlur` + roughness, effectively 7+ dependent reads.
- **Frosted glass**: noise-based scatter adds per-pixel randomness on top of blur taps. Double cost.
- **High IOR values**: extreme refraction offsets sample far from fragment — cache unfriendly, visible stretching at edges.
- **Non-uniform spacing**: per-cell hash + hermite interpolation adds branching complexity.
