import * as THREE from 'three'

/**
 * Renders the scene at target resolution and downloads as a PNG.
 *
 * finalRT is given SRGBColorSpace so Three.js injects the same linearToSRGB()
 * it uses for the live screen pass — applied in float precision inside the
 * shader, before the values are quantised to 8 bits.  The old approach applied
 * a JS integer LUT *after* the values had already been rounded to Uint8, which
 * gave the wrong answer for dark values (e.g. linear 0.003 → Uint8 1 → LUT[1]
 * = 13 instead of the correct 10).  With SRGBColorSpace on finalRT the
 * encoding path is bit-for-bit identical to the live render.
 *
 * readRenderTargetPixels() returns raw framebuffer bytes, so when the shader
 * has already written sRGB-encoded values those bytes are ready to copy
 * straight into ImageData — no further curve application needed.
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
  renderer.outputColorSpace = THREE.SRGBColorSpace  // match live renderer
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)

  // SRGBColorSpace causes Three.js to inject linearToSRGB() into the halftone
  // fragment shader output — the same GLSL function used for the live screen
  // pass.  The encoding runs at float precision before the values are written
  // to the 8-bit target, so there is no quantise-then-encode error.
  const finalRT = new THREE.WebGLRenderTarget(width, height, {
    minFilter:  THREE.LinearFilter,
    magFilter:  THREE.LinearFilter,
    format:     THREE.RGBAFormat,
    type:       THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  })

  renderFrame(renderer, finalRT)

  // readRenderTargetPixels returns raw framebuffer bytes.  Because the shader
  // already encoded to sRGB these are ready to write directly to ImageData.
  // OpenGL convention: row 0 is the bottom row, so we Y-flip below.
  const pixels = new Uint8Array(width * height * 4)
  renderer.readRenderTargetPixels(finalRT, 0, 0, width, height, pixels)

  finalRT.dispose()
  renderer.dispose()

  // Y-flip: OpenGL bottom-first → canvas/PNG top-first.
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
      img.data[d]     = pixels[s]
      img.data[d + 1] = pixels[s + 1]
      img.data[d + 2] = pixels[s + 2]
      img.data[d + 3] = pixels[s + 3]
    }
  }

  ctx.putImageData(img, 0, 0)

  const a = document.createElement('a')
  a.href     = out.toDataURL('image/png')
  a.download = `cool-shadez-${label}-${Date.now()}.png`
  a.click()
}
