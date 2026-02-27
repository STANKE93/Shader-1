import * as THREE from 'three'

// IEC 61966-2-1 piecewise sRGB transfer function.
function linearToSRGB(c) {
  return c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055
}

// 4096-entry LUT: float input quantised to 12-bit precision before the curve
// is applied — error ≤ 0.4 output units vs. the live path.  The old 256-entry
// integer LUT applied the curve *after* linear values were already rounded to
// Uint8, producing errors up to 3 units in dark tones because the sRGB curve
// is steepest there (slope ≈ 12.92 near black).
const LUT_N = 4096
const SRGB_LUT = new Uint8Array(LUT_N)
for (let i = 0; i < LUT_N; i++) {
  SRGB_LUT[i] = Math.round(linearToSRGB(i / (LUT_N - 1)) * 255)
}

/**
 * Renders the scene at target resolution and downloads as a PNG.
 *
 * finalRT uses FloatType so readRenderTargetPixels() returns 32-bit linear
 * values.  The sRGB transfer function is then applied in JavaScript at float
 * precision — matching the live renderer's linearToSRGB() GLSL encoding —
 * without relying on Three.js shader injection, which behaves differently for
 * ShaderMaterial depending on how outputColorSpace interacts with render
 * targets.
 *
 * @param {number}   width
 * @param {number}   height
 * @param {string}   label        — used in the filename, e.g. "4K"
 * @param {Function} renderFrame  — receives (renderer, finalRT); must render the final
 *                                  pass into finalRT rather than into null (screen)
 */
export function exportPNG(width, height, label, renderFrame) {
  // No canvas needed — all rendering goes into render targets.
  // alpha: false avoids premultiplied-alpha complications in the WebGL context.
  // outputColorSpace is intentionally not set: every render goes to a RT whose
  // texture.colorSpace defaults to NoColorSpace, so Three.js injects no sRGB
  // encoding into any pass.  We apply the curve ourselves below.
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)

  // FloatType preserves full linear precision through to readback.
  // Requires EXT_color_buffer_float (universally available in WebGL2 on desktop).
  const finalRT = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
    type:      THREE.FloatType,
  })

  renderFrame(renderer, finalRT)

  // Read back linear float pixel data.
  // OpenGL convention: row 0 is the bottom row — Y-flipped below.
  const linear = new Float32Array(width * height * 4)
  renderer.readRenderTargetPixels(finalRT, 0, 0, width, height, linear)

  finalRT.dispose()
  renderer.dispose()

  // Apply sRGB transfer + Y-flip in one pass.
  const out = document.createElement('canvas')
  out.width  = width
  out.height = height
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(width, height)

  for (let row = 0; row < height; row++) {
    const srcRow = height - 1 - row        // flip: bottom-first → top-first
    for (let col = 0; col < width; col++) {
      const s = (srcRow * width + col) * 4
      const d = (row    * width + col) * 4
      const ri = Math.max(0, Math.min(LUT_N - 1, Math.round(linear[s]     * (LUT_N - 1))))
      const gi = Math.max(0, Math.min(LUT_N - 1, Math.round(linear[s + 1] * (LUT_N - 1))))
      const bi = Math.max(0, Math.min(LUT_N - 1, Math.round(linear[s + 2] * (LUT_N - 1))))
      img.data[d]     = SRGB_LUT[ri]
      img.data[d + 1] = SRGB_LUT[gi]
      img.data[d + 2] = SRGB_LUT[bi]
      img.data[d + 3] = Math.round(Math.max(0, Math.min(1, linear[s + 3])) * 255)
    }
  }

  ctx.putImageData(img, 0, 0)

  const a = document.createElement('a')
  a.href     = out.toDataURL('image/png')
  a.download = `cool-shadez-${label}-${Date.now()}.png`
  a.click()
}
