import * as THREE from 'three'

/**
 * Minimal runtime controls panel.
 * Exposes speed, offset, motion mode, and a multi-stop color ramp for each layer.
 */
export function createControls(uniforms, exportPNG, exportVideo, getLoopDuration) {
  const panel = document.createElement('div')
  panel.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 100;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
    padding: 14px 18px; color: #fff; font: 13px/1.6 monospace;
    display: flex; flex-direction: column; gap: 10px; min-width: 260px;
  `

  panel.innerHTML = `<strong style="letter-spacing:.08em">COOL SHADEZ</strong>`

  ;[1, 2].forEach(n => {
    const u = uniforms[`layer${n}`]

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
    row.innerHTML = `<span style="opacity:.5;font-size:11px">LAYER ${n}</span>`

    // Enable toggle
    const toggleLabel = document.createElement('label')
    toggleLabel.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const toggle = document.createElement('input')
    toggle.type    = 'checkbox'
    toggle.checked = true
    toggle.addEventListener('change', () => { u.uLayerEnabled.value = toggle.checked })
    toggleLabel.append('enabled', toggle)
    row.appendChild(toggleLabel)

    // Motion mode toggle
    const modeRow = document.createElement('div')
    modeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px'
    const modeLabel = document.createElement('span')
    modeLabel.style.cssText = 'font-size:12px;white-space:nowrap'
    modeLabel.textContent = 'motion'

    const modeBtnWrap = document.createElement('div')
    modeBtnWrap.style.cssText = 'display:flex;gap:4px'

    // Build angle row first — syncModeBtns references it
    const angleRow = makeSlider(
      'direction°', 0, 360,
      Math.round(u.uDriftAngle.value * 180 / Math.PI),
      1,
      v => { u.uDriftAngle.value = v * Math.PI / 180 }
    )

    function syncModeBtns() {
      const linear = u.uLinearDrift.value
      modeBtns[0].style.background = !linear ? 'rgba(123,47,255,0.55)' : 'transparent'
      modeBtns[0].style.color      = !linear ? '#fff' : 'rgba(255,255,255,0.4)'
      modeBtns[1].style.background =  linear  ? 'rgba(123,47,255,0.55)' : 'transparent'
      modeBtns[1].style.color      =  linear  ? '#fff' : 'rgba(255,255,255,0.4)'
      angleRow.style.opacity       =  linear  ? '1' : '0.3'
    }

    const modeBtns = ['radial', 'linear'].map((name, i) => {
      const btn = document.createElement('button')
      btn.textContent = name
      btn.style.cssText = `
        padding:2px 7px; border-radius:4px; font:11px monospace; cursor:pointer;
        border:1px solid rgba(255,255,255,0.2); background:transparent; color:rgba(255,255,255,0.4);
      `
      btn.addEventListener('click', () => { u.uLinearDrift.value = (i === 1); syncModeBtns() })
      return btn
    })

    modeBtnWrap.append(...modeBtns)
    modeRow.append(modeLabel, modeBtnWrap)
    row.appendChild(modeRow)

    row.appendChild(makeSlider('speed',  0.05, 2,    u.uSpeed.value,  0.01, v => { u.uSpeed.value  = v }))
    row.appendChild(makeSlider('offset', 0,    6.28, u.uOffset.value, 0.01, v => { u.uOffset.value = v }))
    row.appendChild(angleRow)

    // Color ramp
    const initialStops = stopsFromUniforms(u)
    row.appendChild(makeColorRamp(initialStops, stops => applyRamp(stops, u)))

    syncModeBtns()
    panel.appendChild(row)
  })

  // --- Diagonal bands section ---
  {
    const u   = uniforms.bands
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
    row.innerHTML = `<span style="opacity:.5;font-size:11px">DIAGONAL BANDS</span>`

    const toggleLabel = document.createElement('label')
    toggleLabel.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const toggle = document.createElement('input')
    toggle.type    = 'checkbox'
    toggle.checked = true
    toggle.addEventListener('change', () => { u.uLayerEnabled.value = toggle.checked })
    toggleLabel.append('enabled', toggle)
    row.appendChild(toggleLabel)

    row.appendChild(makeSlider('spacing',    1,     20,   u.uSpacing.value,    0.1,    v => { u.uSpacing.value    = v }))
    row.appendChild(makeSlider('angle°',     0,     360,  Math.round(u.uAngle.value * 180 / Math.PI), 1, v => { u.uAngle.value = v * Math.PI / 180 }))
    row.appendChild(makeSlider('softness',   0.01,  1,    u.uSoftness.value,   0.01,   v => { u.uSoftness.value   = v }))
    row.appendChild(makeSlider('IOR',        1.0,   3.0,  u.uIOR.value,        0.01,   v => { u.uIOR.value        = v }))
    row.appendChild(makeSlider('thickness',  0,     1,    u.uThickness.value,  0.01,   v => { u.uThickness.value  = v }))
    row.appendChild(makeSlider('fresnel',    0,     1,    u.uFresnel.value,    0.01,   v => { u.uFresnel.value    = v }))
    row.appendChild(makeSlider('speed',      0,     2,    u.uSpeed.value,      0.01,   v => { u.uSpeed.value      = v }))

    panel.appendChild(row)
  }

  // --- Light streaks section ---
  {
    const u   = uniforms.streaks
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
    row.innerHTML = `<span style="opacity:.5;font-size:11px">LIGHT STREAKS</span>`

    const toggleLabel = document.createElement('label')
    toggleLabel.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const toggle = document.createElement('input')
    toggle.type    = 'checkbox'
    toggle.checked = true
    toggle.addEventListener('change', () => { u.uLayerEnabled.value = toggle.checked })
    toggleLabel.append('enabled', toggle)
    row.appendChild(toggleLabel)

    row.appendChild(makeSlider('speed',     0,    2,    u.uSpeed.value,     0.01,  v => { u.uSpeed.value     = v }))
    row.appendChild(makeSlider('offset',    0,    6.28, u.uOffset.value,    0.01,  v => { u.uOffset.value    = v }))
    row.appendChild(makeSlider('angle°',    0,    360,  Math.round(u.uAngle.value * 180 / Math.PI), 1, v => { u.uAngle.value = v * Math.PI / 180 }))
    row.appendChild(makeSlider('spacing',   1,    20,   u.uSpacing.value,   0.1,   v => { u.uSpacing.value   = v }))
    row.appendChild(makeSlider('width',     0.01, 0.2,  u.uWidth.value,     0.005, v => { u.uWidth.value     = v }))
    row.appendChild(makeSlider('length',    0.05, 1.0,  u.uLength.value,    0.01,  v => { u.uLength.value    = v }))
    row.appendChild(makeSlider('intensity', 0,    4,    u.uIntensity.value, 0.05,  v => { u.uIntensity.value = v }))
    row.appendChild(makeSingleColor('color', u.uColor))

    panel.appendChild(row)
  }

  // --- Halftone section ---
  {
    const u   = uniforms.halftone
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
    row.innerHTML = `<span style="opacity:.5;font-size:11px">HALFTONE</span>`

    const toggleLabel = document.createElement('label')
    toggleLabel.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer'
    const toggle = document.createElement('input')
    toggle.type    = 'checkbox'
    toggle.checked = true
    toggle.addEventListener('change', () => { u.uLayerEnabled.value = toggle.checked })
    toggleLabel.append('enabled', toggle)
    row.appendChild(toggleLabel)

    row.appendChild(makeSlider('spacing', 4,   80,  u.uSpacing.value, 0.5,  v => { u.uSpacing.value = v }))
    row.appendChild(makeSlider('scale',   0.1, 1,   u.uScale.value,   0.01, v => { u.uScale.value   = v }))
    row.appendChild(makeSlider('shadow',  0,   1,   u.uShadow.value,  0.01, v => { u.uShadow.value  = v }))

    panel.appendChild(row)
  }

  // --- Video export section ---
  {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
    row.innerHTML = `<span style="opacity:.5;font-size:11px">EXPORT VIDEO</span>`

    // Progress bar (hidden until recording)
    const progressWrap = document.createElement('div')
    progressWrap.style.cssText = 'display:none;flex-direction:column;gap:3px'
    const progressBar = document.createElement('div')
    progressBar.style.cssText = 'width:100%;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden'
    const progressFill = document.createElement('div')
    progressFill.style.cssText = 'height:100%;width:0%;background:#7b2fff;transition:width 0.1s linear'
    progressBar.appendChild(progressFill)
    const progressLabel = document.createElement('div')
    progressLabel.style.cssText = 'font-size:10px;opacity:0.5;text-align:center'
    progressWrap.append(progressBar, progressLabel)
    row.appendChild(progressWrap)

    // FPS toggle
    let selectedFps = 30
    const fpsRow = document.createElement('div')
    fpsRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px'
    const fpsLabel = document.createElement('span')
    fpsLabel.style.cssText = 'font-size:12px;white-space:nowrap'
    fpsLabel.textContent = 'fps'
    const fpsBtnWrap = document.createElement('div')
    fpsBtnWrap.style.cssText = 'display:flex;gap:4px'

    const fpsBtns = [30, 60].map(fps => {
      const btn = document.createElement('button')
      btn.textContent = `${fps}`
      btn.style.cssText = `
        padding:2px 9px; border-radius:4px; font:11px monospace; cursor:pointer;
        border:1px solid rgba(255,255,255,0.2); background:transparent; color:rgba(255,255,255,0.4);
      `
      btn.addEventListener('click', () => {
        selectedFps = fps
        syncFpsBtns()
      })
      return btn
    })

    function syncFpsBtns() {
      fpsBtns.forEach((btn, i) => {
        const active = [30, 60][i] === selectedFps
        btn.style.background = active ? 'rgba(0,234,255,0.3)'        : 'transparent'
        btn.style.color      = active ? '#fff'                        : 'rgba(255,255,255,0.4)'
        btn.style.border     = active ? '1px solid rgba(0,234,255,0.6)' : '1px solid rgba(255,255,255,0.2)'
      })
    }
    syncFpsBtns()

    fpsBtnWrap.append(...fpsBtns)
    fpsRow.append(fpsLabel, fpsBtnWrap)
    row.appendChild(fpsRow)

    // Duration buttons
    const btnWrap = document.createElement('div')
    btnWrap.style.cssText = 'display:flex;gap:6px'

    let isRecording = false

    for (const secs of [3, 5, 10]) {
      const btn = document.createElement('button')
      const baseLabel = `${secs}s`
      btn.textContent = baseLabel
      btn.title = `Records a seamlessly looping WebM (~${secs}s)`
      btn.style.cssText = `
        flex:1; padding:5px 0; background:rgba(0,234,255,0.15);
        border:1px solid rgba(0,234,255,0.35); border-radius:5px;
        color:#fff; font:11px monospace; cursor:pointer; letter-spacing:.05em;
      `
      btn.addEventListener('mouseenter', () => {
        if (isRecording) return
        const exact = getLoopDuration(secs)
        btn.textContent = `${exact.toFixed(1)}s`
      })
      btn.addEventListener('mouseleave', () => {
        if (isRecording) return
        btn.textContent = baseLabel
      })

      btn.addEventListener('click', async () => {
        if (isRecording) return
        isRecording = true

        const exact = getLoopDuration(secs)
        progressWrap.style.display  = 'flex'
        progressLabel.textContent   = `recording ${exact.toFixed(1)}s @ ${selectedFps}fps…`
        progressFill.style.width    = '0%'
        btnWrap.style.opacity       = '0.35'
        btnWrap.style.pointerEvents = 'none'
        fpsBtnWrap.style.pointerEvents = 'none'

        await exportVideo({
          targetDuration: secs,
          fps:            selectedFps,
          onProgress: (p) => {
            progressFill.style.width  = `${Math.round(p * 100)}%`
            progressLabel.textContent = `recording ${exact.toFixed(1)}s @ ${selectedFps}fps… ${Math.round(p * 100)}%`
          },
          onDone: () => {
            isRecording = false
            progressWrap.style.display     = 'none'
            btnWrap.style.opacity          = '1'
            btnWrap.style.pointerEvents    = 'auto'
            fpsBtnWrap.style.pointerEvents = 'auto'
          },
        })
      })

      btnWrap.appendChild(btn)
    }

    row.appendChild(btnWrap)
    panel.appendChild(row)
  }

  // --- PNG export section ---
  const exportRow = document.createElement('div')
  exportRow.style.cssText = 'display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px'
  exportRow.innerHTML = `<span style="opacity:.5;font-size:11px">EXPORT PNG</span>`

  const btnWrap = document.createElement('div')
  btnWrap.style.cssText = 'display:flex;gap:8px'

  for (const label of ['4K', '5K']) {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.style.cssText = `
      flex:1; padding:5px 0; background:rgba(123,47,255,0.25);
      border:1px solid rgba(123,47,255,0.5); border-radius:5px;
      color:#fff; font:12px monospace; cursor:pointer; letter-spacing:.05em;
    `
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(123,47,255,0.5)' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(123,47,255,0.25)' })
    btn.addEventListener('click', () => {
      btn.textContent = '...'
      btn.disabled = true
      // defer one frame so the button state paints before the heavy render
      requestAnimationFrame(() => {
        exportPNG(label)
        btn.textContent = label
        btn.disabled = false
      })
    })
    btnWrap.appendChild(btn)
  }

  exportRow.appendChild(btnWrap)
  panel.appendChild(exportRow)

  document.body.appendChild(panel)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlider(label, min, max, value, step, onChange) {
  const wrap = document.createElement('label')
  wrap.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px'
  const input = document.createElement('input')
  input.type  = 'range'
  input.min   = min
  input.max   = max
  input.step  = step
  input.value = value
  input.style.cssText = 'flex:1;accent-color:#7b2fff'
  input.addEventListener('input', () => onChange(parseFloat(input.value)))
  wrap.append(label, input)
  return wrap
}

function makeSingleColor(label, uniform) {
  // uniform is the Three.js uniform object: { value: THREE.Vector3 }
  const wrap = document.createElement('label')
  wrap.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px'
  const input = document.createElement('input')
  input.type  = 'color'
  input.style.cssText = 'width:48px;height:22px;border:none;border-radius:3px;cursor:pointer;padding:0;background:none'
  // Convert linear Vector3 → sRGB hex for the picker's initial value
  const v = uniform.value
  input.value = '#' + new THREE.Color(v.x, v.y, v.z).getHexString()
  input.addEventListener('input', () => {
    const c = new THREE.Color(input.value)
    uniform.value.set(c.r, c.g, c.b)
  })
  wrap.append(label, input)
  return wrap
}

// ---------------------------------------------------------------------------
// Color Ramp
// ---------------------------------------------------------------------------

const MAX_STOPS = 8

/** Read current ramp state from uniforms into [{pos, color}] array */
function stopsFromUniforms(u) {
  const count  = u.uRampCount.value
  const colors = u.uRampColors.value
  const pos    = u.uRampPositions.value
  const stops  = []
  for (let i = 0; i < count; i++) {
    const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2]
    stops.push({ pos: pos[i], color: rgbToHex(r, g, b) })
  }
  return stops
}

/** Write sorted stops into Float32Array uniforms + update count */
function applyRamp(stops, u) {
  stops.forEach((s, i) => {
    const c = new THREE.Color(s.color)
    u.uRampColors.value[i * 3]     = c.r
    u.uRampColors.value[i * 3 + 1] = c.g
    u.uRampColors.value[i * 3 + 2] = c.b
    u.uRampPositions.value[i]      = s.pos
  })
  u.uRampCount.value = stops.length
}

/** Linear RGB interpolation between two hex strings; returns hex string */
function lerpHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b)
  return '#' + new THREE.Color(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  ).getHexString()
}

/** Interpolate a hex color at position t along a sorted stops array */
function lerpStops(stops, t) {
  if (stops.length === 0) return '#ffffff'
  if (t <= stops[0].pos) return stops[0].color
  if (t >= stops[stops.length - 1].pos) return stops[stops.length - 1].color
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].pos) {
      const span = stops[i].pos - stops[i - 1].pos
      const f    = span > 0 ? (t - stops[i - 1].pos) / span : 0
      return lerpHex(stops[i - 1].color, stops[i].color, f)
    }
  }
  return stops[stops.length - 1].color
}

/** Convert linear-space r,g,b (0..1) to '#rrggbb' */
function rgbToHex(r, g, b) {
  const toHex = v => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Build the CSS linear-gradient string from a sorted stops array */
function stopsToGradient(stops) {
  const parts = stops.map(s => `${s.color} ${(s.pos * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}

/**
 * Build and return a color ramp widget DOM node.
 * @param {Array<{pos:number,color:string}>} initialStops  sorted, at least 2
 * @param {function(stops)} onRampChange  called after every mutation
 */
function makeColorRamp(initialStops, onRampChange) {
  // Deep-copy so we own the state
  let stops = initialStops.map(s => ({ ...s }))

  const container = document.createElement('div')
  container.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:2px'

  // Header row
  const header = document.createElement('div')
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
  const headerLabel = document.createElement('span')
  headerLabel.style.cssText = 'font-size:11px;opacity:.5'
  headerLabel.textContent = 'color ramp'
  const addBtn = document.createElement('button')
  addBtn.textContent = '+ stop'
  addBtn.style.cssText = `
    font:10px monospace; padding:1px 6px; border-radius:3px; cursor:pointer;
    background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2);
    color:rgba(255,255,255,0.7);
  `
  header.append(headerLabel, addBtn)
  container.appendChild(header)

  // Gradient bar (click to add stop at that position)
  const bar = document.createElement('div')
  bar.style.cssText = `
    width:100%; height:18px; border-radius:4px; cursor:crosshair;
    border:1px solid rgba(255,255,255,0.15); box-sizing:border-box;
  `

  // Markers container (position:relative so markers can use position:absolute)
  const markersWrap = document.createElement('div')
  markersWrap.style.cssText = 'position:relative;width:100%;height:22px'

  container.appendChild(bar)
  container.appendChild(markersWrap)

  // Drag state
  let drag = null // { stop, marker, startX, startPos }

  document.addEventListener('mousemove', e => {
    if (!drag) return
    const rect = bar.getBoundingClientRect()
    const newPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    drag.stop.pos = newPos
    drag.marker.style.left = `${newPos * 100}%`
    bar.style.background = stopsToGradient(getSortedStops())
  })

  document.addEventListener('mouseup', () => {
    if (!drag) return
    drag = null
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

  function getSortedStops() {
    return [...stops].sort((a, b) => a.pos - b.pos)
  }

  function redraw() {
    bar.style.background = stopsToGradient(stops)
    markersWrap.innerHTML = ''
    addBtn.disabled = stops.length >= MAX_STOPS
    addBtn.style.opacity = stops.length >= MAX_STOPS ? '0.35' : '1'

    stops.forEach(stop => {
      const marker = document.createElement('div')
      marker.style.cssText = `
        position:absolute; top:0; transform:translateX(-50%);
        left:${stop.pos * 100}%; width:18px; height:22px;
        display:flex; flex-direction:column; align-items:center;
        cursor:grab; user-select:none;
      `

      // Triangle indicator
      const triangle = document.createElement('div')
      triangle.style.cssText = `
        width:0; height:0; flex-shrink:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-bottom:6px solid rgba(255,255,255,0.8);
      `

      // Colored swatch
      const swatch = document.createElement('div')
      swatch.style.cssText = `
        width:16px; height:14px; border-radius:3px; flex-shrink:0;
        background:${stop.color}; border:1px solid rgba(255,255,255,0.3);
        position:relative; cursor:pointer;
      `

      // Hidden × button (shown on hover when stops.length > 2)
      const closeBtn = document.createElement('div')
      closeBtn.textContent = '×'
      closeBtn.style.cssText = `
        position:absolute; top:-4px; right:-4px;
        width:10px; height:10px; line-height:10px; text-align:center;
        font-size:9px; border-radius:50%;
        background:rgba(255,80,80,0.85); color:#fff;
        display:none; cursor:pointer;
      `
      if (stops.length > 2) {
        swatch.addEventListener('mouseenter', () => { closeBtn.style.display = 'block' })
        swatch.addEventListener('mouseleave', () => { closeBtn.style.display = 'none' })
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.display = 'block' })
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.display = 'none' })
        closeBtn.addEventListener('click', e => {
          e.stopPropagation()
          stops = stops.filter(s => s !== stop)
          redraw()
          onRampChange(stops)
        })
      }
      swatch.appendChild(closeBtn)

      // Hidden color input behind swatch
      const colorInput = document.createElement('input')
      colorInput.type  = 'color'
      colorInput.value = stop.color
      colorInput.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;pointer-events:none'
      swatch.appendChild(colorInput)

      swatch.addEventListener('click', e => {
        e.stopPropagation()
        colorInput.click()
      })
      colorInput.addEventListener('input', () => {
        stop.color = colorInput.value
        swatch.style.background = stop.color
        bar.style.background = stopsToGradient(stops)
        onRampChange(stops)
      })

      // Drag to reposition — mousedown on triangle or marker body, not swatch
      marker.addEventListener('mousedown', e => {
        if (e.target === swatch || swatch.contains(e.target)) return
        e.preventDefault()
        drag = { stop, marker }
        marker.style.cursor = 'grabbing'
      })

      marker.appendChild(triangle)
      marker.appendChild(swatch)
      markersWrap.appendChild(marker)
    })
  }

  // Click bar to add a stop at that position
  bar.addEventListener('click', e => {
    if (stops.length >= MAX_STOPS) return
    const rect = bar.getBoundingClientRect()
    const pos  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const color = lerpStops(stops, pos)
    stops.push({ pos, color })
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

  // "+ stop" button — inserts at midpoint of the largest gap
  addBtn.addEventListener('click', () => {
    if (stops.length >= MAX_STOPS) return
    let maxGap = -1, insertPos = 0.5
    for (let i = 1; i < stops.length; i++) {
      const gap = stops[i].pos - stops[i - 1].pos
      if (gap > maxGap) { maxGap = gap; insertPos = (stops[i].pos + stops[i - 1].pos) / 2 }
    }
    stops.push({ pos: insertPos, color: lerpStops(stops, insertPos) })
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

  redraw()
  return container
}
