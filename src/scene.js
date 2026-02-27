import * as THREE from 'three'
import baseVertex     from './shaders/baseVertex.glsl'
import gradientLayer1 from './shaders/gradientLayer1.glsl'
import gradientLayer2 from './shaders/gradientLayer2.glsl'
import diagonalBands  from './shaders/diagonalBands.glsl'
import lightStreaks   from './shaders/lightStreaks.glsl'
import halftone       from './shaders/halftone.glsl'
import { exportPNG }        from './utils/export.js'
import { exportVideo, computeLoopDuration } from './utils/exportVideo.js'

const MAX_STOPS = 8

function makeRampColors(stops) {
  const arr = new Float32Array(MAX_STOPS * 3)
  stops.forEach(({ color }, i) => {
    const c = new THREE.Color(color)
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
  })
  return arr
}

function makeRampPositions(stops) {
  const arr = new Float32Array(MAX_STOPS)
  stops.forEach(({ pos }, i) => { arr[i] = pos })
  return arr
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace  // explicit: linear shaders → sRGB screen
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  // Three isolated scenes — one per render pass
  const bgScene       = new THREE.Scene() // pass 1: gradient layers
  const bandsScene    = new THREE.Scene() // pass 2: diagonal bands distortion
  const halftoneScene = new THREE.Scene() // pass 3: halftone screen

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
  })

  let rt1 = makeRT(window.innerWidth, window.innerHeight)
  let rt2 = makeRT(window.innerWidth, window.innerHeight)

  const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)

  // --- Layer 1 ---
  const uniforms1 = {
    uTime:          { value: 0 },
    uLayerEnabled:  { value: true },
    uRampColors:    { value: makeRampColors([{ color: '#1a0533' }, { color: '#ff6ec7' }]) },
    uRampPositions: { value: makeRampPositions([{ pos: 0.0 }, { pos: 1.0 }]) },
    uRampCount:     { value: 2 },
    uSpeed:         { value: 0.4 },
    uOffset:        { value: 0.0 },
    uResolution:    { value: resolution },
    uLinearDrift:   { value: true },              // starts in linear drift (current visual)
    uDriftAngle:    { value: Math.PI * 0.25 },   // 45° diagonal
  }
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: gradientLayer1, uniforms: uniforms1,
  })))

  // --- Layer 2 ---
  const uniforms2 = {
    uTime:          { value: 0 },
    uLayerEnabled:  { value: true },
    uRampColors:    { value: makeRampColors([{ color: '#7b2fff' }, { color: '#00eaff' }]) },
    uRampPositions: { value: makeRampPositions([{ pos: 0.0 }, { pos: 1.0 }]) },
    uRampCount:     { value: 2 },
    uSpeed:         { value: 0.6 },
    uOffset:        { value: 1.5 },
    uResolution:    { value: resolution },
    uLinearDrift:   { value: false },   // starts in radial mode (current visual)
    uDriftAngle:    { value: 0.0 },    // rightward (used when switching to linear)
  }
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: gradientLayer2, uniforms: uniforms2,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })))

  // --- Light streaks layer ---
  // Additive highlights aligned to the band direction; flow along the band vector.
  // Placed in bgScene so the bands IOR pass refracts them like the gradients beneath.
  const uniformsStreaks = {
    uTime:         { value: 0 },
    uLayerEnabled: { value: true },
    uSpeed:        { value: 0.5 },
    uOffset:       { value: 0.0 },
    uAngle:        { value: Math.PI * 0.25 },   // 45° — matches bands default
    uSpacing:      { value: 6.0 },              // same density as bands
    uWidth:        { value: 0.05 },             // tight cross-band Gaussian (thinness)
    uLength:       { value: 0.3 },              // coverage along flow axis (0=point, 1=continuous band)
    uIntensity:    { value: 1.2 },              // bright additive highlights
    uColor:        { value: new THREE.Vector3(0.92, 0.88, 1.0) }, // cool near-white
  }
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: lightStreaks, uniforms: uniformsStreaks,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })))

  // --- Layer 3: diagonal bands distortion ---
  const uniformsBands = {
    uBackground:   { value: rt1.texture },
    uTime:         { value: 0 },
    uLayerEnabled: { value: true },
    uSpeed:        { value: 0.15 },
    uOffset:       { value: 0.0 },
    uSpacing:      { value: 6.0 },
    uAngle:        { value: Math.PI * 0.25 },
    uSoftness:     { value: 0.6 },
    uIOR:          { value: 1.5 },   // 1.0 = air (no effect), 1.5 = glass
    uThickness:    { value: 0.6 },   // 0 = sharp slab, 1 = smooth height-profile lens
    uFresnel:      { value: 0.65 },  // Fresnel edge attenuation strength
  }
  bandsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: diagonalBands, uniforms: uniformsBands,
  })))

  // --- Layer 4: halftone screen ---
  const uniformsHalftone = {
    uBackground:   { value: rt2.texture },
    uLayerEnabled: { value: true },
    uResolution:   { value: resolution.clone() },
    uSpacing:      { value: 18.0 },
    uScale:        { value: 0.82 },
    uShadow:       { value: 0.06 },
  }
  halftoneScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: halftone, uniforms: uniformsHalftone,
  })))

  // Handle resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h)
    resolution.set(w, h)
    rt1.dispose(); rt1 = makeRT(w, h)
    rt2.dispose(); rt2 = makeRT(w, h)
    uniformsBands.uBackground.value    = rt1.texture
    uniformsHalftone.uBackground.value = rt2.texture
    uniformsHalftone.uResolution.value.set(w, h)
  })

  // Three-pass render — used by both live tick and exports.
  // outputRT: where the final halftone pass is written.
  //   null (default) → screen canvas; Three.js applies SRGBColorSpace encoding. ✓
  //   WebGLRenderTarget → linear data for manual sRGB readback in export.js. ✓
  function renderPasses(r, bgRT1, bgRT2, w, h, outputRT = null) {
    uniformsBands.uBackground.value    = bgRT1.texture
    uniformsHalftone.uBackground.value = bgRT2.texture
    uniformsHalftone.uResolution.value.set(w, h)

    r.setRenderTarget(bgRT1);    r.render(bgScene, camera)
    r.setRenderTarget(bgRT2);    r.render(bandsScene, camera)
    r.setRenderTarget(outputRT); r.render(halftoneScene, camera)
  }

  // Live animation loop
  let rafId          = null
  let paused         = false
  let timeOffset     = 0      // accumulated seconds of paused time
  let pauseTimestamp = 0      // performance.now() snapshot when last paused

  function tick(time) {
    const t = time * 0.001 - timeOffset
    uniforms1.uTime.value         = t
    uniforms2.uTime.value         = t
    uniformsStreaks.uTime.value   = t
    uniformsBands.uTime.value     = t
    renderPasses(renderer, rt1, rt2, window.innerWidth, window.innerHeight)
    rafId = requestAnimationFrame(tick)
  }

  function togglePause() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId          = null
      pauseTimestamp = performance.now()
      paused         = true
    } else {
      timeOffset += (performance.now() - pauseTimestamp) * 0.001
      paused = false
      rafId  = requestAnimationFrame(tick)
    }
    return paused
  }

  // Collect active animation speeds for loop-duration calculation
  function activeSpeeds() {
    return [uniforms1.uSpeed.value, uniforms2.uSpeed.value, uniformsStreaks.uSpeed.value, uniformsBands.uSpeed.value]
  }

  const RESOLUTIONS = { '4K': [3840, 2160], '5K': [5120, 2880] }

  return {
    start: () => { rafId = requestAnimationFrame(tick) },

    uniforms: { layer1: uniforms1, layer2: uniforms2, streaks: uniformsStreaks, bands: uniformsBands, halftone: uniformsHalftone },

    // Returns exact loop-safe duration for a requested target duration
    getLoopDuration: (targetSecs) => computeLoopDuration(activeSpeeds(), targetSecs),

    exportPNG: (label) => {
      const [w, h] = RESOLUTIONS[label]
      // renderFrame now receives (offRenderer, finalRT) — the final halftone pass
      // renders into finalRT so export.js can read back linear pixels and apply
      // its own sRGB encoding, bypassing toDataURL() WebGL color-space quirks.
      exportPNG(w, h, label, (offRenderer, finalRT) => {
        const offRT1 = makeRT(w, h)
        const offRT2 = makeRT(w, h)
        renderPasses(offRenderer, offRT1, offRT2, w, h, finalRT)
        uniformsBands.uBackground.value    = rt1.texture
        uniformsHalftone.uBackground.value = rt2.texture
        uniformsHalftone.uResolution.value.set(window.innerWidth, window.innerHeight)
        offRT1.dispose()
        offRT2.dispose()
      })
    },

    exportVideo: async ({ targetDuration, fps = 30, onProgress, onDone }) => {
      // Snap to an exact loop duration based on current speeds
      const loopDuration = computeLoopDuration(activeSpeeds(), targetDuration)

      // Pause live animation
      cancelAnimationFrame(rafId)
      rafId = null

      await exportVideo(
        canvas,
        (t) => {
          uniforms1.uTime.value       = t
          uniforms2.uTime.value       = t
          uniformsStreaks.uTime.value = t
          uniformsBands.uTime.value   = t
          renderPasses(renderer, rt1, rt2, window.innerWidth, window.innerHeight)
        },
        loopDuration,
        fps,
        onProgress,
      )

      // Resume live animation (only if user hasn't paused during export)
      if (!paused) rafId = requestAnimationFrame(tick)
      onDone()
    },

    togglePause,
  }
}
