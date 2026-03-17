# Color Systems Engineer Agent — Skill Reflection

## When It Was Used

First deployed to audit the full color pipeline after we fixed the sRGB→linear mismatch bug, and to find better ways to distribute colors across the gradient ramp.

## Decision-Making Process

**Diagnosis — why gradients looked muddy:**
The agent identified that `evalRamp()` was interpolating in sRGB space (simple `mix()`). For analogous color pairs (blue→purple), this works fine. But for complementary pairs (red→cyan, blue→yellow), sRGB linear interpolation produces a desaturated gray midpoint — the gradient passes through a dead zone instead of maintaining chromatic richness.

**Why Oklab over other options:**
- HSL interpolation: hue wrapping issues, non-uniform lightness, expensive atan/sin/cos in GLSL
- Linear RGB: better than sRGB for some cases, but still desaturates complementaries
- CIELab: requires illuminant adaptation, more complex, not designed for screens
- Oklab: specifically designed for perceptual uniformity in screen color work. Two matrix multiplies + cube roots. Clean, well-documented, and the CSS Color Level 4 spec uses it

**What was NOT implemented (and why):**
- Auto-distribution of stops: changes user-placed positions unexpectedly, breaks manual layouts
- Midpoint bias per stop pair: marginal benefit once Oklab handles the perceptual midpoint correctly
- Shared GLSL include: would need a build preprocessor, not worth the complexity for 2 files

## What Worked Well

- The agent correctly identified that the CSS gradient bar needed to match the shader. Used CSS Color Level 4 `linear-gradient(in oklab, ...)` when Oklab is active — browser-native Oklab interpolation for the preview bar, matching what the GLSL shader produces.
- Added a simple "Color mix" pill toggle (sRGB | Oklab) per layer — gives users control without burying them in technical details.
- The JS-side `lerpHex` also branches on Oklab, so newly inserted ramp stops (click-to-insert, midpoint button) pick the correctly interpolated color.
- Defaulted to Oklab on — users get better gradients out of the box.

## What Could Be Improved

- **Performance on low-end GPUs**: The Oklab conversion runs per-fragment per-stop-pair (sRGB transfer function with pow + two 3x3 matrix multiplies + cube roots). For 8 stops at 4K, this is ~160 pow() calls per pixel. On modern desktop GPUs this is negligible (<0.1ms), but on mobile/integrated GPUs it could be measurable. A future optimization could precompute the Oklab values on the CPU side and pass them as a second uniform array, eliminating the per-pixel sRGB→Oklab conversion entirely.
- **Gamut clipping**: The `clamp(0.0, 1.0)` after Oklab→sRGB can clip vivid colors at the gamut boundary. A soft-clip or gamut mapping function would handle edge cases more gracefully, but adds complexity.
- **Oklch (polar form)**: For hue-dependent interpolation (e.g., rainbow gradients), Oklch (the polar form of Oklab) would be even better — it interpolates along hue arcs instead of straight lines through the color solid. But it requires atan2/sin/cos which adds cost and hue-wrapping logic.

## What I Learned

- **The sRGB bypass and Oklab are complementary fixes.** The sRGB bypass fixed the color ACCURACY problem (picked color matches displayed color). Oklab fixed the color INTERPOLATION problem (midpoints between stops look good). Both were needed — fixing one without the other would still produce suboptimal results.
- **CSS Color Level 4 is a gift.** Modern browsers natively support `linear-gradient(in oklab, ...)`, which means the preview bar can match the GLSL shader's Oklab interpolation without any canvas rendering or manual gradient computation.
- **Defaults matter more than options.** Making Oklab the default (rather than opt-in) means every user gets better gradients immediately. The sRGB fallback exists for users who specifically want the old behavior, but most will never need it.

## Collaboration Notes — How You Can Get More From This Agent

**What went right:**
- Clear task framing: "review color spaces and find intuitive, simple ways to distribute colors" gave the agent a quality target (intuitive, simple) not just a technical one.

**Where collaboration could improve:**

1. **Show problem gradients.** If you have specific color pairs that look wrong, screenshot them. "Red to cyan looks muddy" is more actionable than "colors don't distribute well." The agent can then verify its fix against your exact case.

2. **Specify the aesthetic target.** "Vivid" vs. "natural" vs. "filmic" implies different interpolation strategies. Oklab is the general-purpose winner, but if you're going for a specific film-stock look, you might want custom tone curves instead.

3. **Test with your actual presets.** The improvement is most visible with complementary color pairs. If your presets are mostly analogous (nearby hues), the difference will be subtle. The agent should have asked what color combinations you commonly use.
