import { createScene } from './scene.js'
import { createControls } from './controls/controls.js'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

// Application frame
const frame = document.createElement('div')
frame.className = 'cs-app-frame'
;['tl','tr','bl','br'].forEach(c => {
  const corner = document.createElement('div')
  corner.className = `cs-frame-corner ${c}`
  frame.appendChild(corner)
})
document.body.appendChild(frame)

const { start, uniforms, palettes, buildRampFromPalette, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot, setAspectRatio, exportDimensions } = createScene(canvas)
createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot, setAspectRatio, exportDimensions, palettes, buildRampFromPalette)
start()

// Decline HMR — any module change triggers a full page reload.
// Partial HMR re-executes scene.js which resets all uniforms to defaults,
// making the shader appear to "revert" to its original state.
if (import.meta.hot) {
  import.meta.hot.decline()
}
