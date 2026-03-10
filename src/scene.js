import * as THREE from 'three'
import baseVertex     from './shaders/baseVertex.glsl'
import gradientLayer1 from './shaders/gradientLayer1.glsl'
import gradientLayer2 from './shaders/gradientLayer2.glsl'
import diagonalBands  from './shaders/diagonalBands.glsl'
import cubesShader    from './shaders/cubes.glsl'
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true })
  // outputColorSpace is managed per-pass inside renderPasses():
  //   intermediate passes → LinearSRGBColorSpace (no encoding injected into shader)
  //   final halftone → screen pass → SRGBColorSpace (Three.js injects linear→sRGB)
  //   final halftone → export RT pass → LinearSRGBColorSpace (manual LUT in export.js)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  // Four isolated scenes — one per render pass
  const bgScene       = new THREE.Scene() // pass 1: gradient layers
  const bandsScene    = new THREE.Scene() // pass 2: diagonal bands distortion
  const cubesScene    = new THREE.Scene() // pass 3: tile grid distortion
  const halftoneScene = new THREE.Scene() // pass 4: halftone screen

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
  })

  let rt1 = makeRT(window.innerWidth, window.innerHeight)
  let rt2 = makeRT(window.innerWidth, window.innerHeight)
  let rt3 = makeRT(window.innerWidth, window.innerHeight)

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
    uMode:             { value: 1 },               // 0=radial, 1=linear, 2=noise
    uDriftAngle:       { value: Math.PI * 0.25 }, // 45° diagonal (linear mode only)
    uNoiseScale:       { value: 3.0 },            // noise patch frequency (noise mode only)
    uLiquifyStrength:  { value: 0.25 },           // domain-warp magnitude in UV units
    uLiquifyScale:     { value: 1.5 },            // flow field spatial frequency (coarser than noise)
    uLiquifySpeed:     { value: 0.12 },           // flow field drift rate (independent of uSpeed)
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
    uMode:             { value: 0 },     // 0=radial, 1=linear, 2=noise
    uDriftAngle:       { value: 0.0 },  // rightward (linear mode only)
    uNoiseScale:       { value: 3.0 },  // noise patch frequency (noise mode only)
    uLiquifyStrength:  { value: 0.25 }, // domain-warp magnitude in UV units
    uLiquifyScale:     { value: 1.5 },  // flow field spatial frequency
    uLiquifySpeed:     { value: 0.12 }, // flow field drift rate
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
    // Burst mode
    uBurstMode:    { value: false },
    uBurstCenterX: { value: 0.5 },
    uBurstCenterY: { value: 0.5 },
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
    uSoftness:        { value: 0.6 },
    uIOR:             { value: 1.5 },  // 1.0 = air (no effect), 1.5 = glass
    uThickness:       { value: 0.6 },  // 0 = sharp slab, 1 = smooth height-profile lens
    uFresnel:         { value: 0.65 }, // Fresnel edge attenuation strength
    uBevelWidth:      { value: 0.3 },  // bevel highlight half-width in band space
    uBevelIntensity:  { value: 0.5 },  // bevel glint peak brightness
    // Burst mode
    uBurstMode:       { value: false },
    uBurstCenterX:    { value: 0.5 },
    uBurstCenterY:    { value: 0.5 },
    uRaySpread:       { value: 6 },    // ray count — integer keeps ±π seam invisible
    uRayLength:       { value: 0.7 },  // radial extent in UV units
    uRayIntensity:    { value: 0.5 },  // additive brightness of ray interior
  }
  bandsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: diagonalBands, uniforms: uniformsBands,
  })))

  // --- Layer 4: cubes tile grid ---
  const uniformsCubes = {
    uBackground:   { value: rt2.texture },
    uTime:         { value: 0 },
    uLayerEnabled: { value: false },  // off by default; enable in controls
    uSpeed:        { value: 0.1 },
    uOffset:       { value: 0.0 },
    uSpacing:      { value: 4.0 },
    uAngle:        { value: Math.PI * 0.25 },
    uSoftness:     { value: 0.3 },
    uIOR:          { value: 1.5 },
    uThickness:    { value: 0.5 },
    uFresnel:      { value: 0.5 },
    uCornerRadius: { value: 0.3 },
  }
  cubesScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: cubesShader, uniforms: uniformsCubes,
  })))

  // --- Layer 5: halftone screen ---
  const uniformsHalftone = {
    uBackground:   { value: rt3.texture },
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
    rt3.dispose(); rt3 = makeRT(w, h)
    uniformsBands.uBackground.value    = rt1.texture
    uniformsCubes.uBackground.value    = rt2.texture
    uniformsHalftone.uBackground.value = rt3.texture
    uniformsHalftone.uResolution.value.set(w, h)
  })

  // Multi-pass render — used by both live tick and exports.
  //
  // Color space strategy:
  //   Intermediate passes (bgRT1, bgRT2, bgRT3): always LinearSRGBColorSpace so
  //   Three.js injects NO sRGB encoding into those shaders. Textures sampled from
  //   these RTs have NoColorSpace (default), so they are read as raw linear values.
  //   Keeping everything linear through the chain ensures correct blending math.
  //
  //   Final pass → null (screen):  SRGBColorSpace — Three.js injects linear→sRGB.
  //   Final pass → RT (export):    LinearSRGBColorSpace — manual LUT in export.js.
  function renderPasses(r, bgRT1, bgRT2, bgRT3, w, h, outputRT = null) {
    uniformsBands.uBackground.value    = bgRT1.texture
    uniformsCubes.uBackground.value    = bgRT2.texture
    uniformsHalftone.uBackground.value = bgRT3.texture
    uniformsHalftone.uResolution.value.set(w, h)

    // Intermediate passes — linear throughout, no encoding injected
    r.outputColorSpace = THREE.LinearSRGBColorSpace
    r.setRenderTarget(bgRT1);    r.render(bgScene, camera)
    r.setRenderTarget(bgRT2);    r.render(bandsScene, camera)
    r.setRenderTarget(bgRT3);    r.render(cubesScene, camera)

    // Final pass — sRGB only when writing to screen, linear for export RT readback
    if (outputRT === null) r.outputColorSpace = THREE.SRGBColorSpace
    r.setRenderTarget(outputRT); r.render(halftoneScene, camera)
  }

  // Live animation loop
  let rafId          = null
  let paused         = false
  let pausedTime     = 0      // frozen uTime value while paused
  let timeOffset     = 0      // accumulated wall-clock seconds to subtract from time
  let pauseTimestamp = 0      // performance.now() snapshot when last paused

  function tick(time) {
    // When paused, reuse the frozen time so uniform edits still re-render correctly.
    const t = paused ? pausedTime : (time * 0.001 - timeOffset)
    uniforms1.uTime.value         = t
    uniforms2.uTime.value         = t
    uniformsStreaks.uTime.value   = t
    uniformsBands.uTime.value     = t
    uniformsCubes.uTime.value     = t
    renderPasses(renderer, rt1, rt2, rt3, window.innerWidth, window.innerHeight)
    rafId = requestAnimationFrame(tick)
  }

  function togglePause() {
    if (!paused) {
      // Pause: freeze the current shader time
      pausedTime     = performance.now() * 0.001 - timeOffset
      pauseTimestamp = performance.now()
      paused         = true
    } else {
      // Resume: advance offset by however long we were paused
      timeOffset += (performance.now() - pauseTimestamp) * 0.001
      paused = false
    }
    return paused
  }

  // Capture the live canvas as-is (sRGB correct — renderer uses SRGBColorSpace for
  // the final screen pass). Works reliably because preserveDrawingBuffer: true is set.
  function snapshot() {
    const a    = document.createElement('a')
    a.href     = canvas.toDataURL('image/png')
    a.download = `cool-shadez-snapshot-${Date.now()}.png`
    a.click()
  }

  // Collect active animation speeds for loop-duration calculation
  function activeSpeeds() {
    return [uniforms1.uSpeed.value, uniforms2.uSpeed.value, uniformsStreaks.uSpeed.value, uniformsBands.uSpeed.value, uniformsCubes.uSpeed.value]
  }

  const RESOLUTIONS = { '4K': [3840, 2160], '5K': [5120, 2880] }

  return {
    start: () => { rafId = requestAnimationFrame(tick) },

    uniforms: { layer1: uniforms1, layer2: uniforms2, streaks: uniformsStreaks, bands: uniformsBands, cubes: uniformsCubes, halftone: uniformsHalftone },

    // Returns exact loop-safe duration for a requested target duration
    getLoopDuration: (targetSecs) => computeLoopDuration(activeSpeeds(), targetSecs),

    exportPNG: (label) => {
      const [w, h] = RESOLUTIONS[label]
      // renderFrame receives (offRenderer, finalRT). The final halftone pass renders
      // into finalRT (FloatType) so export.js reads back linear pixels and applies
      // its own sRGB LUT, bypassing toDataURL() color-space quirks.
      //
      // Intermediate RTs use HalfFloatType to preserve HDR headroom from additive
      // blending (Layer 2 + Streaks). Prevents bright-highlight clipping that 8-bit
      // UnsignedByte RTs would introduce.
      exportPNG(w, h, label, (offRenderer, finalRT) => {
        const makeHDRRT = (rw, rh) => new THREE.WebGLRenderTarget(rw, rh, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format:    THREE.RGBAFormat,
          type:      THREE.HalfFloatType,
        })
        const offRT1 = makeHDRRT(w, h)
        const offRT2 = makeHDRRT(w, h)
        const offRT3 = makeHDRRT(w, h)
        renderPasses(offRenderer, offRT1, offRT2, offRT3, w, h, finalRT)
        uniformsBands.uBackground.value    = rt1.texture
        uniformsCubes.uBackground.value    = rt2.texture
        uniformsHalftone.uBackground.value = rt3.texture
        uniformsHalftone.uResolution.value.set(window.innerWidth, window.innerHeight)
        offRT1.dispose()
        offRT2.dispose()
        offRT3.dispose()
      })
    },

    exportVideo: async ({ targetDuration, fps = 30, onProgress, onDone }) => {
      const loopDuration = computeLoopDuration(activeSpeeds(), targetDuration)

      // Suspend live loop for the duration of the export
      cancelAnimationFrame(rafId)
      rafId = null

      await exportVideo(
        canvas,
        (t) => {
          uniforms1.uTime.value       = t
          uniforms2.uTime.value       = t
          uniformsStreaks.uTime.value = t
          uniformsBands.uTime.value   = t
          uniformsCubes.uTime.value   = t
          renderPasses(renderer, rt1, rt2, rt3, window.innerWidth, window.innerHeight)
        },
        loopDuration,
        fps,
        onProgress,
      )

      // Always restart — tick() respects paused state internally
      rafId = requestAnimationFrame(tick)
      onDone()
    },

    snapshot,
    togglePause,
  }
}
