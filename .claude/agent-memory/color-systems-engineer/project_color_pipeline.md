---
name: Color pipeline architecture
description: How colors flow from hex picker through uniforms to shader output - sRGB throughout, no Three.js color management
type: project
---

The color pipeline bypasses Three.js color management entirely.

**Why:** ShaderMaterial in Three.js 0.172 does not reliably inject sRGB output encoding. Using `THREE.Color` to parse hex values caused an unwanted sRGB-to-linear conversion on input, making displayed colors darker than what the user picked.

**How to apply:**
- `hexToRGB()` in both `scene.js` and `controls.js` does raw hex parsing to [0,1] -- no color space conversion
- Uniforms store sRGB values directly; shader outputs sRGB values directly
- `renderPasses()` sets `outputColorSpace = SRGBColorSpace` only for the final screen pass, `LinearSRGBColorSpace` for intermediate RT passes
- The `makeSingleColor()` helper in controls.js also uses raw `hexToRGB()` to write to `THREE.Vector3` uniforms
- `rgbToHex()` does the inverse: clamp [0,1] to [0,255] integer, format as hex
- Never use `THREE.Color` for ramp/picker color values -- it applies color management
- Export (PNG/video) uses the same `renderPasses()` so color output matches the live canvas
