import * as THREE from 'three'
import baseVertex     from './shaders/baseVertex.glsl'
import gradientLayer1 from './shaders/gradientLayer1.glsl'
import gradientLayer2 from './shaders/gradientLayer2.glsl'
import diagonalBands  from './shaders/diagonalBands.glsl'
import halftone       from './shaders/halftone.glsl'
import lensDistortion from './shaders/lensDistortion.glsl'
import { exportPNG }        from './utils/export.js'
import { exportVideo, computeLoopDuration } from './utils/exportVideo.js'

const MAX_STOPS = 8

// Parse hex to [0..1] RGB without Three.js color management (sRGB→linear conversion).
// ShaderMaterial does not inject sRGB output encoding, so uniforms must store sRGB
// values directly — what goes in is what the screen displays.
function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Build shader ramp arrays from palette: main[0], enabled extras, main[1] — evenly spaced
function buildRampFromPalette(palette) {
  const activeExtras = palette.extras.filter((_, i) => palette.enabled[i])
  const all = [palette.main[0], ...activeExtras, palette.main[1]]
  const n = all.length
  const colArr = new Float32Array(MAX_STOPS * 3)
  const posArr = new Float32Array(MAX_STOPS)
  all.forEach((hex, i) => {
    const [r, g, b] = hexToRGB(hex)
    colArr[i * 3] = r; colArr[i * 3 + 1] = g; colArr[i * 3 + 2] = b
    posArr[i] = n > 1 ? i / (n - 1) : 0
  })
  return { colors: colArr, positions: posArr, count: n }
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true })
  // outputColorSpace is managed per-pass inside renderPasses():
  //   intermediate passes → LinearSRGBColorSpace (no encoding injected into shader)
  //   final halftone → screen pass → SRGBColorSpace (Three.js injects linear→sRGB)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const cw = () => canvas.clientWidth
  const ch = () => canvas.clientHeight

  // --- Aspect ratio control ---
  let aspectRatio = null  // null = free (fill available space), else numeric w/h

  function resizeCanvas() {
    const containerW = window.innerWidth - 12 - 353
    const containerH = window.innerHeight - 24
    let w, h, left, top

    if (aspectRatio === null) {
      w = containerW; h = containerH; left = 12; top = 12
    } else {
      if (containerW / containerH > aspectRatio) {
        h = containerH
        w = Math.round(h * aspectRatio)
      } else {
        w = containerW
        h = Math.round(w / aspectRatio)
      }
      left = 12 + Math.round((containerW - w) / 2)
      top  = 12 + Math.round((containerH - h) / 2)
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
    uniformsBands.uBackground.value    = rt1.texture
    uniformsHalftone.uBackground.value = rt2.texture
    uniformsLens.uBackground.value     = rt3.texture
    uniformsHalftone.uResolution.value.set(w, h)
    uniformsLens.uResolution.value.set(w, h)
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

  // Three isolated scenes — one per render pass
  const bgScene       = new THREE.Scene() // pass 1: gradient layers
  const bandsScene    = new THREE.Scene() // pass 2: diagonal bands distortion
  const halftoneScene = new THREE.Scene() // pass 3: halftone screen
  const lensScene     = new THREE.Scene() // pass 4: lens distortion

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
  // 2 main colors (always on) + 4 extras (toggleable)
  const palette1 = {
    main:    ['#1a0533', '#fffbe6'],
    extras:  ['#6b1d7a', '#ff6ec7', '#ffb86c', '#ff4466'],
    enabled: [true, true, true, true],   // toggle state for extras only
  }
  const ramp1 = buildRampFromPalette(palette1)
  const uniforms1 = {
    uTime:          { value: 0 },
    uLayerEnabled:  { value: true },
    uRampColors:    { value: ramp1.colors },
    uRampPositions: { value: ramp1.positions },
    uRampCount:     { value: ramp1.count },
    uSpeed:         { value: 0.4 },
    uOffset:        { value: 0.0 },
    uMode:             { value: 1 },               // 0=radial, 1=linear, 2=sweep
    uDriftAngle:       { value: Math.PI * 0.25 }, // 45° diagonal (linear mode only)
    uCurve:            { value: 1.0 },            // wave shape power (linear mode)
    uRipple:           { value: 0.0 },            // radial ripple on/off (0 or 1)
    uRippleCount:      { value: 7.0 },            // ring density multiplier
    uRippleCompress:   { value: 6.0 },            // sqrt compression factor
    uLightAngle:       { value: 0.94 },           // light azimuth in radians (~54°)
    uLightColor:       { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // relief light color
    uShadowDepth:      { value: 0.0 },            // valley darkening
    uReliefDepth:      { value: 0.5 },            // 3D depth intensity (0-1)
    uSweepSeam:        { value: 0.0 },            // sweep back-seam softness (0 = sharp, 1 = soft)
    uSweepCenter:      { value: 0.0 },            // center blur radius (0 = sharp, 1 = soft)
    uCenterX:          { value: 0.5 },            // radial/sweep center X [0..1]
    uCenterY:          { value: 0.5 },            // radial/sweep center Y [0..1]
    uOklab:            { value: true },            // Oklab perceptual interpolation
    uLinearMotion:     { value: 0 },               // 0=slide, 1=cloth, 2=liquid
    uClothScale:       { value: 1.0 },             // fold size multiplier
    uClothDetail:      { value: 0.7 },             // wave complexity (0-1)
    uClothSeed:        { value: 0.0 },             // cloth pattern seed
    uLinearCount:      { value: 1.0 },             // slide band count multiplier
    uWaveAmp:          { value: 0.0 },             // wave distortion amplitude (0 = off)
    uWaveFreq:         { value: 3.0 },             // wave distortion frequency
    uDistortAmt:       { value: 0.0 },             // 2D cross-warp distortion
    uMetaBallCount:    { value: 4.0 },             // metaball center count (2-15)
    uMetaElasticity:   { value: 1.0 },             // metaball falloff sharpness
    uMetaSeed:         { value: 0.0 },             // metaball orbit phase seed
    uMetaSize:         { value: 0.12 },            // blob radius
    uMetaSoftness:     { value: 0.3 },             // edge softness (0=hard, 1=glow)
    uMetaSpread:       { value: 1.0 },             // orbit spread multiplier
    uMetaInvert:       { value: 0.0 },             // invert field
    uMetaChaos:        { value: 0.0 },             // motion chaos
  }
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: gradientLayer1, uniforms: uniforms1,
  })))

  // --- Layer 2 ---
  const palette2 = {
    main:    ['#7b2fff', '#ffffff'],
    extras:  ['#00eaff', '#1a0533', '#ff6ec7', '#ffb86c'],
    enabled: [true, true, true, true],
  }
  const ramp2 = buildRampFromPalette(palette2)
  const uniforms2 = {
    uTime:          { value: 0 },
    uLayerEnabled:  { value: false },
    uRampColors:    { value: ramp2.colors },
    uRampPositions: { value: ramp2.positions },
    uRampCount:     { value: ramp2.count },
    uSpeed:         { value: 0.6 },
    uOffset:        { value: 1.5 },
    uMode:             { value: 0 },     // 0=radial, 1=linear, 2=sweep
    uDriftAngle:       { value: 0.0 },  // rightward (linear mode only)
    uCurve:            { value: 1.0 },  // wave shape power (linear mode)
    uRipple:           { value: 0.0 },  // radial ripple on/off (0 or 1)
    uRippleCount:      { value: 7.0 },  // ring density multiplier
    uRippleCompress:   { value: 6.0 },  // sqrt compression factor
    uLightAngle:       { value: 0.94 }, // light azimuth in radians (~54°)
    uLightColor:       { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // relief light color
    uShadowDepth:      { value: 0.0 },  // valley darkening
    uReliefDepth:      { value: 0.5 },  // 3D depth intensity (0-1)
    uSweepSeam:        { value: 0.0 },  // sweep back-seam softness (0 = sharp, 1 = soft)
    uSweepCenter:      { value: 0.0 },  // center blur radius (0 = sharp, 1 = soft)
    uCenterX:          { value: 0.5 },  // radial/sweep center X [0..1]
    uCenterY:          { value: 0.5 },  // radial/sweep center Y [0..1]
    uOklab:            { value: true },  // Oklab perceptual interpolation
    uLinearMotion:     { value: 0 },    // 0=slide, 1=cloth, 2=liquid
    uClothScale:       { value: 1.0 },  // fold size multiplier
    uClothDetail:      { value: 0.7 },  // wave complexity (0-1)
    uClothSeed:        { value: 0.0 },  // cloth pattern seed
    uLinearCount:      { value: 1.0 },  // slide band count multiplier
    uWaveAmp:          { value: 0.0 },  // wave distortion amplitude (0 = off)
    uWaveFreq:         { value: 3.0 },  // wave distortion frequency
    uDistortAmt:       { value: 0.0 },  // 2D cross-warp distortion
    uMetaBallCount:    { value: 4.0 },  // metaball center count (2-15)
    uMetaElasticity:   { value: 1.0 },  // metaball falloff sharpness
    uMetaSeed:         { value: 0.0 },  // metaball orbit phase seed
    uMetaSize:         { value: 0.12 },  // blob radius
    uMetaSoftness:     { value: 0.3 },  // edge softness
    uMetaSpread:       { value: 1.0 },  // orbit spread multiplier
    uMetaInvert:       { value: 0.0 },  // invert field
    uMetaChaos:        { value: 0.0 },  // motion chaos
  }
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: gradientLayer2, uniforms: uniforms2,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })))

  // --- Diagonal bands distortion ---
  const uniformsBands = {
    uBackground:   { value: rt1.texture },
    uTime:         { value: 0 },
    uLayerEnabled: { value: false },
    uSpeed:        { value: 0.15 },
    uOffset:       { value: 0.0 },
    uSpacing:      { value: 6.0 },
    uAngle:        { value: Math.PI * 0.25 },
    uSoftness:        { value: 0.6 },
    uIOR:             { value: 1.5 },
    uThickness:       { value: 0.6 },
    uFresnel:         { value: 0.65 },
    uTilt:            { value: 0.0 },
    uTilt2:           { value: 0.0 },
    uTiltZ:           { value: 0.0 },
    uBevelWidth:      { value: 0.3 },
    uBevelIntensity:  { value: 0.5 },
    uTintColor:       { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uTintStrength:    { value: 0.0 },
    uStep:            { value: 1 },
    uBandInvert:      { value: 0 },
    uDistort:         { value: 0.0 },
    uBlur:            { value: 0.0 },
    uBandsMode:       { value: 0 },
    uBurstCenterX:    { value: 0.5 },
    uBurstCenterY:    { value: 0.5 },
    uRaySpread:       { value: 6 },
    uRayLength:       { value: 1.2 },
    uRayIntensity:    { value: 0.5 },
    uRoughness:       { value: 0.0 },
    uBandRandom:      { value: 0 },
    uBandSeed:        { value: 0.0 },
    // Prism mode
    uPrismSeed:       { value: 0.0 },
    uPrismDepth:      { value: 0.6 },
    // Globe mode
    uGlobeRadius:     { value: 0.35 },
    uGlobeSquareness: { value: 0.0 },
    uGlobeEdge:       { value: 0.3 },
    uFresnelColor:    { value: new THREE.Vector3(0.6, 0.8, 1.0) },
    uAtmoGlow:        { value: 0.5 },
    uAtmoColor:       { value: new THREE.Vector3(0.4, 0.7, 1.0) },
  }
  bandsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: diagonalBands, uniforms: uniformsBands,
  })))

  // --- Halftone screen ---
  const uniformsHalftone = {
    uBackground:   { value: rt2.texture },
    uLayerEnabled: { value: false },
    uResolution:   { value: resolution.clone() },
    uSpacing:      { value: 18.0 },
    uScale:        { value: 0.82 },
    uShadow:       { value: 0.06 },
    uShape:        { value: 0 },
    uMono:         { value: false },
    uGrainType:    { value: 0 },      // 0=off, 1=film, 2=stipple, 3=scan, 4=ascii
    uGrainAmt:     { value: 0.5 },    // grain intensity
    uGrainScale:   { value: 0.5 },    // grain size/density
  }
  halftoneScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: halftone, uniforms: uniformsHalftone,
  })))

  // --- Lens distortion ---
  const uniformsLens = {
    uBackground:    { value: rt3.texture },
    uResolution:    { value: resolution.clone() },
    uLayerEnabled:  { value: false },
    uBarrel:        { value: 0.0 },
    uChromaAberr:   { value: 0.0 },
    uVignetteStr:   { value: 0.0 },
    uVignetteSoft:  { value: 0.5 },
  }
  lensScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: baseVertex, fragmentShader: lensDistortion, uniforms: uniformsLens,
  })))

  // Handle resize
  window.addEventListener('resize', () => resizeCanvas())
  resizeCanvas()

  // Multi-pass render — used by both live tick and exports.
  //
  // Color space strategy:
  //   Intermediate passes (bgRT1, bgRT2): LinearSRGBColorSpace — no sRGB encoding.
  //   Final pass → null (screen): SRGBColorSpace — Three.js injects linear→sRGB.
  function renderPasses(r, bgRT1, bgRT2, bgRT3, w, h, outputRT = null) {
    uniformsBands.uBackground.value    = bgRT1.texture
    uniformsHalftone.uBackground.value = bgRT2.texture
    uniformsLens.uBackground.value     = bgRT3.texture
    uniformsHalftone.uResolution.value.set(w, h)
    uniformsLens.uResolution.value.set(w, h)

    // Intermediate passes — linear throughout, no encoding injected
    r.outputColorSpace = THREE.LinearSRGBColorSpace
    r.setRenderTarget(bgRT1);  r.render(bgScene, camera)
    r.setRenderTarget(bgRT2);  r.render(bandsScene, camera)
    r.setRenderTarget(bgRT3);  r.render(halftoneScene, camera)

    // Final pass — sRGB only when writing to screen, linear for export RT readback
    if (outputRT === null) r.outputColorSpace = THREE.SRGBColorSpace
    r.setRenderTarget(outputRT); r.render(lensScene, camera)
  }

  // Live animation loop
  let rafId          = null
  let paused         = false
  let pausedTime     = 0
  let timeOffset     = 0
  let pauseTimestamp = 0

  function tick(time) {
    const t = paused ? pausedTime : (time * 0.001 - timeOffset)
    uniforms1.uTime.value     = t
    uniforms2.uTime.value     = t
    uniformsBands.uTime.value = t
    renderPasses(renderer, rt1, rt2, rt3, cw(), ch())
    rafId = requestAnimationFrame(tick)
  }

  function togglePause() {
    if (!paused) {
      pausedTime     = performance.now() * 0.001 - timeOffset
      pauseTimestamp = performance.now()
      paused         = true
    } else {
      timeOffset += (performance.now() - pauseTimestamp) * 0.001
      paused = false
    }
    return paused
  }

  function snapshot() {
    const a    = document.createElement('a')
    a.href     = canvas.toDataURL('image/png')
    a.download = `cool-shadez-snapshot-${Date.now()}.png`
    a.click()
  }

  function activeSpeeds() {
    return [uniforms1.uSpeed.value, uniforms2.uSpeed.value, uniformsBands.uSpeed.value]
  }

  return {
    start: () => { rafId = requestAnimationFrame(tick) },

    uniforms: { layer1: uniforms1, layer2: uniforms2, bands: uniformsBands, halftone: uniformsHalftone, lens: uniformsLens },
    palettes: { layer1: palette1, layer2: palette2 },
    buildRampFromPalette,

    getLoopDuration: (targetSecs) => computeLoopDuration(activeSpeeds(), targetSecs),

    setAspectRatio,
    exportDimensions,

    exportPNG: (label) => {
      const [w, h] = exportDimensions(label)
      exportPNG(w, h, label, (offRenderer) => {
        const offRT1 = makeRT(w, h)
        const offRT2 = makeRT(w, h)
        const offRT3 = makeRT(w, h)
        renderPasses(offRenderer, offRT1, offRT2, offRT3, w, h)
        uniformsBands.uBackground.value    = rt1.texture
        uniformsHalftone.uBackground.value = rt2.texture
        uniformsLens.uBackground.value     = rt3.texture
        uniformsHalftone.uResolution.value.set(cw(), ch())
        uniformsLens.uResolution.value.set(cw(), ch())
        offRT1.dispose()
        offRT2.dispose()
        offRT3.dispose()
      })
    },

    exportVideo: async ({ targetDuration, fps = 30, resolution, onProgress, onDone }) => {
      const loopDuration = computeLoopDuration(activeSpeeds(), targetDuration)

      cancelAnimationFrame(rafId)
      rafId = null

      const is4K = resolution === '4K'

      if (is4K) {
        const [w, h] = exportDimensions('4K')
        const offCanvas = document.createElement('canvas')
        offCanvas.width  = w
        offCanvas.height = h

        const offRenderer = new THREE.WebGLRenderer({
          canvas: offCanvas, antialias: false, alpha: true, preserveDrawingBuffer: true,
        })
        offRenderer.setPixelRatio(1)
        offRenderer.setSize(w, h, false)

        const offRT1 = makeRT(w, h)
        const offRT2 = makeRT(w, h)
        const offRT3 = makeRT(w, h)

        await exportVideo(
          offCanvas,
          (t) => {
            uniforms1.uTime.value     = t
            uniforms2.uTime.value     = t
            uniformsBands.uTime.value = t
            renderPasses(offRenderer, offRT1, offRT2, offRT3, w, h)
          },
          loopDuration,
          fps,
          onProgress,
        )

        uniformsBands.uBackground.value    = rt1.texture
        uniformsHalftone.uBackground.value = rt2.texture
        uniformsLens.uBackground.value     = rt3.texture
        uniformsHalftone.uResolution.value.set(cw(), ch())
        uniformsLens.uResolution.value.set(cw(), ch())

        offRT1.dispose()
        offRT2.dispose()
        offRT3.dispose()
        offRenderer.dispose()
      } else {
        await exportVideo(
          canvas,
          (t) => {
            uniforms1.uTime.value     = t
            uniforms2.uTime.value     = t
            uniformsBands.uTime.value = t
            renderPasses(renderer, rt1, rt2, rt3, cw(), ch())
          },
          loopDuration,
          fps,
          onProgress,
        )
      }

      rafId = requestAnimationFrame(tick)
      onDone()
    },

    snapshot,
    togglePause,
  }
}
