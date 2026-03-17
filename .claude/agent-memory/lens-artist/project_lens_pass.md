---
name: Lens distortion pass architecture
description: 4th render pass (lensScene) implementing barrel distortion, chromatic aberration, and vignette with Brown-Conrady model
type: project
---

The lens distortion pass is the 4th and final render pass in the pipeline: bgScene -> bandsScene -> halftoneScene -> lensScene -> screen.

**Why:** Added as a post-processing lens simulation layer for cinematic feel.

**How to apply:**
- Reads rt3 (halftone output) via `uBackground`
- Uses `uResolution` uniform for aspect-ratio-correct circular distortion (added during improvement pass)
- Chromatic aberration is implemented as per-channel barrel coefficients (kR/kG/kB), not UV offsets — physically correct lateral CA that increases toward edges
- Vignette uses cos^4 natural falloff, not smoothstep ring
- Brown-Conrady two-term distortion (k1*r^2 + k2*r^4) with k2 = k1 * 0.35
- Edge fade prevents hard clamping when UVs leave [0,1]
- `uResolution` must be kept in sync in: resizeCanvas(), renderPasses(), PNG export cleanup, video export cleanup
- Disabled by default (`uLayerEnabled: false`)
