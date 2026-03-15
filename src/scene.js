import * as THREE from 'three'
import baseVertex     from './shaders/baseVertex.glsl'
import gradientLayer1 from './shaders/gradientLayer1.glsl'
import gradientLayer2 from './shaders/gradientLayer2.glsl'
import diagonalBands  from './shaders/diagonalBands.glsl'
import lightStreaks   from './shaders/lightStreaks.glsl'
import caustics       from './shaders/caustics.glsl'
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
  const cw = () => canvas.clientWidth
  const ch = () => canvas.clientHeight

  // --- Aspect ratio control ---
  let aspectRatio = null  // null = free (fill available space), else numeric w/h

  function resizeCanvas() {
    const containerW = window.innerWidth - 30 - 284
    const containerH = window.innerHeight - 60
    let w, h, left, top

    if (aspectRatio === null) {
      w = containerW; h = containerH; left = 30; top = 30
    } else {
      if (containerW / containerH > aspectRatio) {
        // pillarbox — container is wider than needed
        h = containerH
        w = Math.round(h * aspectRatio)
      } else {
        // letterbox — container is taller than needed
        w = containerW
        h = Math.round(w / aspectRatio)
      }
      left = 30 + Math.round((containerW - w) / 2)
      top  = 30 + Math.round((containerH - h) / 2)
    }

    canvas.style.width  = w + 'px'
    canvas.style.height = h + 'px'
    canvas.style.left   = left + 'px'
    canvas.style.top    = top + 'px'

    // Update frame overlay to match canvas bounds
    const frame = document.querySelector('.cs-app-frame')
    if (frame) {
      frame.style.left   = left + 'px'
      frame.style.top    = top + 'px'
      frame.style.right  = 'auto'
      frame.style.bottom = 'auto'
      frame.style.width  = w + 'px'
      frame.style.height = h + 'px'
    }

    renderer.setSize(w, h, false)
    resolution.set(w, h)
    rt1.dispose(); rt1 = makeRT(w, h)
    rt2.dispose(); rt2 = makeRT(w, h)
    rt3.dispose(); rt3 = makeRT(w, h)
    uniformsBands.uBackground.value      = rt1.texture
    uniformsCaustics.uBackground.value   = rt2.texture
    uniformsHalftone.uBackground.value   = rt3.texture
    uniformsHalftone.uResolution.value.set(w, h)
  }

  function setAspectRatio(ratio) {
    aspectRatio = ratio
    resizeCanvas()
  }

  // --- Export dimensions from aspect ratio ---
  const EXPORT_TIERS = { 'HD': 1920, '4K': 3840, '5K': 5120 }

  function exportDimensions(tier) {
    const longer = EXPORT_TIERS[tier]
    const ratio = aspectRatio ?? (cw() / ch())
    if (ratio >= 1) {
      return [longer, Math.round(longer / ratio)]
    } else {
      return [Math.round(longer * ratio), longer]
    }
  }

  renderer.setSize(cw(), ch(), false)

  // Four isolated scenes — one per render pass
  const bgScene        = new THREE.Scene() // pass 1: gradient layers
  const bandsScene     = new THREE.Scene() // pass 2: diagonal bands distortion
  const causticsScene  = new THREE.Scene() // pass 3: caustics light overlay
  const halftoneScene  = new THREE.Scene() // pass 4: halftone screen

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
  })

  let rt1 = makeRT(cw(), ch())
  let rt2 = makeRT(cw(), ch())
  let rt3 = makeRT(cw(), ch())

  const resolution = new THREE.Vector2(cw(), ch())

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
    uMode:             { value: 1 },               // 0=radial, 1=linear, 2=sweep
    uDriftAngle:       { value: Math.PI * 0.25 }, // 45° diagonal (linear mode only)
    uRipple:           { value: 0.0 },            // radial ripple on/off (0 or 1)
    uRippleCount:      { value: 7.0 },            // ring density multiplier
    uRippleCompress:   { value: 6.0 },            // sqrt compression factor
    uLightAngle:       { value: 0.94 },           // light azimuth in radians (~54°)
    uShadowDepth:      { value: 0.0 },            // valley darkening
    uSweepSeam:        { value: 0.0 },            // sweep back-seam softness (0 = sharp, 1 = soft)
    uSweepCenter:      { value: 0.0 },            // center blur radius (0 = sharp, 1 = soft)
    uCenterX:          { value: 0.5 },            // radial/sweep center X [0..1]
    uCenterY:          { value: 0.5 },            // radial/sweep center Y [0..1]
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
    uMode:             { value: 0 },     // 0=radial, 1=linear, 2=sweep
    uDriftAngle:       { value: 0.0 },  // rightward (linear mode only)
    uRipple:           { value: 0.0 },  // radial ripple on/off (0 or 1)
    uRippleCount:      { value: 7.0 },  // ring density multiplier
    uRippleCompress:   { value: 6.0 },  // sqrt compression factor
    uLightAngle:       { value: 0.94 }, // light azimuth in radians (~54°)
    uShadowDepth:      { value: 0.0 },  // valley darkening
    uSweepSeam:        { value: 0.0 },  // sweep back-seam softness (0 = sharp, 1 = soft)
    uSweepCenter:      { value: 0.0 },  // center blur radius (0 = sharp, 1 = soft)
    uCenterX:          { value: 0.5 },  // radial/sweep center X [0..1]
    uCenterY:          { value: 0.5 },  // radial/sweep center Y [0..1]
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
    uLayerEnabled: { value: false },
    uSpeed:        { value: 0.5 },
    uOffset:       { value: 0.0 },
    uAngle:        { value: Math.PI * 0.25 },   // 45° — matches bands default
    uSpacing:      { value: 6.0 },              // same density as bands
    uWidth:        { value: 0.05 },             // tight cross-band Gaussian (thinness)
    uLength:       { value: 0.3 },              // coverage along flow axis (0=point, 1=continuous band)
    uIntensity:    { value: 1.2 },              // bright additive highlights
    uColor:        { value: new THREE.Vector3(0.92, 0.88, 1.0) }, // cool near-white
    // Mode: 0 = parallel, 1 = burst, 2 = vortex
    uMode:         { value: 0 },
    uBurstCenterX: { value: 0.5 },
    uBurstCenterY: { value: 0.5 },
    uTwist:        { value: 8.0 },    // vortex spiral tightness (radians per UV unit)
    uFlicker: { value: 0.0 },
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
    uTilt:            { value: 0.0 },  // venetian blind tilt across band (0 = flat, 1 = edge-on)
    uTilt2:           { value: 0.0 },  // venetian blind tilt along band (forward/backward lean)
    uTiltZ:           { value: 0.0 },  // Z normal modulation (-1..1): steepness gradient across band
    uBandShape:       { value: 0 },     // 0 = flat slab, 1 = tube (cylindrical), 2 = fin (tapered ridge)
    uBevelWidth:      { value: 0.3 },  // bevel highlight half-width in band space
    uBevelIntensity:  { value: 0.5 },  // bevel glint peak brightness
    uTintColor:       { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // tinted glass color (linear RGB)
    uTintStrength:    { value: 0.0 },  // tint intensity (0 = clear glass)
    uStep:            { value: 1 },    // 1 = band + gap, 2 = doubled (no gap)
    uBandInvert:      { value: 0 },    // 0 = normal, 1 = invert, 2 = both
    uDistort:         { value: 0.0 },  // [0..1]: noise-based band distortion
    uBlur:            { value: 0.0 },  // [0..1]: glass blur diffusion
    // Mode: 0 = parallel, 1 = burst, 2 = orbit
    uBandsMode:       { value: 0 },
    uBurstCenterX:    { value: 0.5 },
    uBurstCenterY:    { value: 0.5 },
    uRaySpread:       { value: 6 },    // ray count — integer keeps ±π seam invisible
    uRayLength:       { value: 1.2 },  // radial extent in UV units (always max)
    uRayIntensity:    { value: 0.5 },  // additive brightness of ray interior
  }
  bandsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: diagonalBands, uniforms: uniformsBands,
  })))

  // --- Layer 4: caustics light overlay ---
  const uniformsCaustics = {
    uBackground:   { value: rt2.texture },
    uTime:         { value: 0 },
    uLayerEnabled: { value: false },   // off by default — new layer, opt-in
    uSpeed:        { value: 0.3 },
    uOffset:       { value: 0.0 },
    uScale:        { value: 4.0 },
    uIntensity:    { value: 0.12 },
  }
  causticsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: caustics, uniforms: uniformsCaustics,
  })))

  // --- Layer 5: halftone screen ---
  const uniformsHalftone = {
    uBackground:   { value: rt3.texture },
    uLayerEnabled: { value: true },
    uResolution:   { value: resolution.clone() },
    uSpacing:      { value: 18.0 },
    uScale:        { value: 0.82 },
    uShadow:       { value: 0.06 },
    uShape:        { value: 0 },    // 0 = circle, 1 = square
    uMono:         { value: false }, // global monochrome filter
  }
  halftoneScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: halftone, uniforms: uniformsHalftone,
  })))

  // Handle resize
  window.addEventListener('resize', () => resizeCanvas())
  resizeCanvas()  // initial sizing (sets canvas CSS, RTs, resolution)

  // Multi-pass render — used by both live tick and exports.
  //
  // Color space strategy:
  //   Intermediate passes (bgRT1, bgRT2): always LinearSRGBColorSpace so
  //   Three.js injects NO sRGB encoding into those shaders. Textures sampled from
  //   these RTs have NoColorSpace (default), so they are read as raw linear values.
  //   Keeping everything linear through the chain ensures correct blending math.
  //
  //   Final pass → null (screen):  SRGBColorSpace — Three.js injects linear→sRGB.
  //   Final pass → RT (export):    LinearSRGBColorSpace — manual LUT in export.js.
  function renderPasses(r, bgRT1, bgRT2, bgRT3, w, h, outputRT = null) {
    uniformsBands.uBackground.value      = bgRT1.texture
    uniformsCaustics.uBackground.value   = bgRT2.texture
    uniformsHalftone.uBackground.value   = bgRT3.texture
    uniformsHalftone.uResolution.value.set(w, h)

    // Intermediate passes — linear throughout, no encoding injected
    r.outputColorSpace = THREE.LinearSRGBColorSpace
    r.setRenderTarget(bgRT1);    r.render(bgScene, camera)
    r.setRenderTarget(bgRT2);    r.render(bandsScene, camera)
    r.setRenderTarget(bgRT3);    r.render(causticsScene, camera)

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
    uniforms1.uTime.value          = t
    uniforms2.uTime.value          = t
    uniformsStreaks.uTime.value    = t
    uniformsBands.uTime.value      = t
    uniformsCaustics.uTime.value   = t
    renderPasses(renderer, rt1, rt2, rt3, cw(), ch())
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
    return [uniforms1.uSpeed.value, uniforms2.uSpeed.value, uniformsStreaks.uSpeed.value, uniformsBands.uSpeed.value, uniformsCaustics.uSpeed.value]
  }

  return {
    start: () => { rafId = requestAnimationFrame(tick) },

    uniforms: { layer1: uniforms1, layer2: uniforms2, streaks: uniformsStreaks, bands: uniformsBands, caustics: uniformsCaustics, halftone: uniformsHalftone },

    // Returns exact loop-safe duration for a requested target duration
    getLoopDuration: (targetSecs) => computeLoopDuration(activeSpeeds(), targetSecs),

    setAspectRatio,
    exportDimensions,

    exportPNG: (label) => {
      const [w, h] = exportDimensions(label)
      // Render to the offscreen canvas (null RT) so the final pass uses the
      // identical pipeline as the live viewport.  toDataURL() then captures the
      // pixels — same as the snapshot button, just at export resolution.
      exportPNG(w, h, label, (offRenderer) => {
        const offRT1 = makeRT(w, h)
        const offRT2 = makeRT(w, h)
        const offRT3 = makeRT(w, h)
        renderPasses(offRenderer, offRT1, offRT2, offRT3, w, h)   // outputRT = null → screen
        uniformsBands.uBackground.value      = rt1.texture
        uniformsCaustics.uBackground.value   = rt2.texture
        uniformsHalftone.uBackground.value   = rt3.texture
        uniformsHalftone.uResolution.value.set(cw(), ch())
        offRT1.dispose()
        offRT2.dispose()
        offRT3.dispose()
      })
    },

    exportVideo: async ({ targetDuration, fps = 30, resolution, onProgress, onDone }) => {
      const loopDuration = computeLoopDuration(activeSpeeds(), targetDuration)

      // Suspend live loop for the duration of the export
      cancelAnimationFrame(rafId)
      rafId = null

      const is4K = resolution === '4K'

      if (is4K) {
        // Offscreen 4K rendering: create a dedicated canvas, renderer, and RTs
        const [w, h] = exportDimensions('4K')
        const offCanvas = document.createElement('canvas')
        offCanvas.width  = w
        offCanvas.height = h

        const offRenderer = new THREE.WebGLRenderer({
          canvas: offCanvas, antialias: false, alpha: true, preserveDrawingBuffer: true,
        })
        offRenderer.setPixelRatio(1)
        offRenderer.setSize(w, h, false)

        // Intermediate RTs at 4K — same type as live RTs (UnsignedByte) so
        // additive blending clips identically and exports match the viewport.
        const offRT1 = makeRT(w, h)
        const offRT2 = makeRT(w, h)
        const offRT3 = makeRT(w, h)

        await exportVideo(
          offCanvas,
          (t) => {
            uniforms1.uTime.value        = t
            uniforms2.uTime.value        = t
            uniformsStreaks.uTime.value  = t
            uniformsBands.uTime.value    = t
            uniformsCaustics.uTime.value = t
            renderPasses(offRenderer, offRT1, offRT2, offRT3, w, h)
          },
          loopDuration,
          fps,
          onProgress,
        )

        // Restore live uniform bindings after offscreen export
        uniformsBands.uBackground.value      = rt1.texture
        uniformsCaustics.uBackground.value   = rt2.texture
        uniformsHalftone.uBackground.value   = rt3.texture
        uniformsHalftone.uResolution.value.set(cw(), ch())

        // Clean up offscreen resources
        offRT1.dispose()
        offRT2.dispose()
        offRT3.dispose()
        offRenderer.dispose()
      } else {
        // Canvas-resolution export (original path)
        await exportVideo(
          canvas,
          (t) => {
            uniforms1.uTime.value        = t
            uniforms2.uTime.value        = t
            uniformsStreaks.uTime.value  = t
            uniformsBands.uTime.value    = t
            uniformsCaustics.uTime.value = t
            renderPasses(renderer, rt1, rt2, rt3, cw(), ch())
          },
          loopDuration,
          fps,
          onProgress,
        )
      }

      // Always restart — tick() respects paused state internally
      rafId = requestAnimationFrame(tick)
      onDone()
    },

    snapshot,
    togglePause,
  }
}
