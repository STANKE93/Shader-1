import { createScene } from './scene.js'
import { createControls } from './controls/controls.js'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const { start, uniforms, exportPNG, exportVideo, getLoopDuration, togglePause } = createScene(canvas)
createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause)
start()
