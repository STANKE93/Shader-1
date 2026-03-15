import * as THREE from 'three'

/**
 * Renders the scene at target resolution and downloads as a PNG.
 *
 * Uses the same rendering pipeline as the live canvas: the final pass renders
 * to the screen (null render target) so Three.js applies identical color
 * handling as the viewport.  toDataURL() then captures the pixels — exactly
 * like the snapshot button, but at the requested export resolution.
 *
 * @param {number}   width
 * @param {number}   height
 * @param {string}   label        — used in the filename, e.g. "4K"
 * @param {Function} renderFrame  — receives (renderer); must render the final
 *                                  pass to null (screen canvas), not a RT
 */
export function exportPNG(width, height, label, renderFrame) {
  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)

  renderFrame(renderer)

  renderer.dispose()

  const a = document.createElement('a')
  a.href     = canvas.toDataURL('image/png')
  a.download = `cool-shadez-${label}-${Date.now()}.png`
  a.click()
}
