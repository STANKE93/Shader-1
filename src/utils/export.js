import * as THREE from 'three'

// IEC 61966-2-1 piecewise sRGB transfer function — matches the curve
// Three.js applies via outputColorSpace = SRGBColorSpace on screen renders.
// Applied manually here because toDataURL() on a hardware-sRGB WebGL canvas
// reads pre-conversion linear values in some browsers (the GPU encodes to sRGB
// for display, but pixel readback skips that step), producing dark/dull PNGs.
function linearToSRGB(c) {
  return c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055
}

// 256-entry lookup table so the per-pixel sRGB loop avoids Math.pow at 4K/5K.
const SRGB_LUT = new Uint8Array(256)
for (let i = 0; i < 256; i++) {
  SRGB_LUT[i] = Math.round(linearToSRGB(i / 255) * 255)
}

/**
 * Renders the scene at target resolution and downloads as a PNG.
 *
 * The final render pass goes into a WebGLRenderTarget (not the canvas) so we
 * can read back linear pixel data deterministically via readRenderTargetPixels().
 * We then apply the sRGB transfer function ourselves and write the result to a
 * 2D canvas — bypassing any browser inconsistency with toDataURL() on hardware-
 * sRGB WebGL framebuffers.
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
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  // outputColorSpace is irrelevant here: the final pass renders to a RT (not
  // null), so Three.js never applies its screen-output sRGB encoding to it.
  // We apply the same curve manually after readRenderTargetPixels().

  const finalRT = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
    type:      THREE.UnsignedByteType,
  })

  renderFrame(renderer, finalRT)

  // Read linear pixel data — OpenGL convention: row 0 is the bottom row.
  const linear = new Uint8Array(width * height * 4)
  renderer.readRenderTargetPixels(finalRT, 0, 0, width, height, linear)

  finalRT.dispose()
  renderer.dispose()

  // Encode to sRGB and flip Y (OpenGL bottom-first → PNG/canvas top-first).
  const out = document.createElement('canvas')
  out.width  = width
  out.height = height
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(width, height)

  for (let row = 0; row < height; row++) {
    const srcRow = height - 1 - row        // flip: bottom-first → top-first
    for (let col = 0; col < width; col++) {
      const s = (srcRow * width + col) * 4 // source: linear buffer
      const d = (row    * width + col) * 4 // dest:   ImageData (sRGB)
      img.data[d]     = SRGB_LUT[linear[s]]
      img.data[d + 1] = SRGB_LUT[linear[s + 1]]
      img.data[d + 2] = SRGB_LUT[linear[s + 2]]
      img.data[d + 3] = linear[s + 3]      // alpha: pass through
    }
  }

  ctx.putImageData(img, 0, 0)

  const a = document.createElement('a')
  a.href     = out.toDataURL('image/png')
  a.download = `cool-shadez-${label}-${Date.now()}.png`
  a.click()
}
