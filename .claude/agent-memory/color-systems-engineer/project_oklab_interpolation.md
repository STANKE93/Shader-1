---
name: Oklab gradient interpolation
description: Oklab perceptual color interpolation added to gradient layers - shader, CSS preview, and JS stop insertion all use matching Oklab math
type: project
---

Oklab perceptual interpolation was added to both gradient layers (Layer 1 and Layer 2) on 2026-03-15.

**Why:** sRGB linear interpolation (the previous default) produces desaturated, muddy midpoints between complementary hues. For example, red-to-cyan interpolates through gray in sRGB because the RGB midpoint (0.5, 0.5, 0.5) has zero saturation. Oklab interpolates through perceptually uniform intermediate colors, maintaining saturation and hue continuity.

**How to apply:**
- `uOklab` uniform (bool, default `true`) controls the mode per layer
- The shader `evalRamp()` branches on `uOklab`: converts stop pairs to Oklab via `srgbToOklab()`, mixes, converts back via `oklabToSrgb()`
- The CSS gradient bar uses `linear-gradient(in oklab to right, ...)` to match the shader output
- JS `lerpHex()` and `lerpStops()` accept an `oklab` parameter for accurate new-stop color picking
- The Oklab conversion functions are duplicated in both GLSL shaders and in controls.js (JS side) -- they must stay in sync
- Performance: ~20-30 extra ALU ops per fragment per stop pair (sRGB transfer + two 3x3 matrices + cbrt). Negligible for fullscreen gradients.
- UI: "Color mix" pill row (sRGB | Oklab) in each layer's controls panel
