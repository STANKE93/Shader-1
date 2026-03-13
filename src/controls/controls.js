import * as THREE from 'three'

const MAX_STOPS = 8

// ─── UI Registry (for randomize) ────────────────────────────────────────────

const uiRegistry = []
let _regLayer = null

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('cs-styles')) return
  const s = document.createElement('style')
  s.id = 'cs-styles'
  s.textContent = `
    .cs-panel {
      position: fixed; top: 0; right: 0; z-index: 100;
      width: 284px;
      background: rgba(12, 13, 18, 0.95);
      backdrop-filter: blur(20px);
      border-left: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 0;
      color: #fff;
      font: 12px/1.5 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      max-height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 0 0 40px rgba(0,0,0,0.5);
    }
    .cs-panel::-webkit-scrollbar { width: 4px; }
    .cs-panel::-webkit-scrollbar-track { background: transparent; }
    .cs-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

    /* Header */
    .cs-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 16px 11px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .cs-title {
      font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
      color: rgba(255, 255, 255, 0.92);
      text-transform: uppercase;
    }
    .cs-pause-btn {
      background: none; border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px; color: rgba(255, 255, 255, 0.50); font-size: 12px;
      cursor: pointer; padding: 3px 10px; line-height: 1.5;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
      font-family: 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    .cs-pause-btn:hover { border-color: rgba(91, 156, 245, 0.35); background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.92); }

    /* Collapsible sections */
    .cs-section { border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    .cs-section:last-child { border-bottom: none; }
    .cs-section-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 16px; cursor: pointer; user-select: none;
      transition: background 0.12s;
    }
    .cs-section-hdr:hover { background: rgba(255, 255, 255, 0.03); }
    .cs-section-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.50); text-transform: uppercase;
    }
    .cs-chevron { font-size: 9px; color: rgba(255, 255, 255, 0.30); transition: transform 0.18s; }
    .cs-chevron.open { transform: rotate(180deg); }
    .cs-section-body { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 0; }
    .cs-section-body.hidden { display: none; }

    /* Subsections */
    .cs-sub {
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px; overflow: hidden;
      background: rgba(255, 255, 255, 0.03);
    }
    .cs-sub-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 11px;
      background: rgba(255, 255, 255, 0.02);
    }
    .cs-sub-label { font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.50); letter-spacing: 0.06em; }
    .cs-sub-body { padding: 10px 11px; display: flex; flex-direction: column; gap: 8px; }

    /* Toggle switch */
    .cs-toggle { position: relative; width: 28px; height: 16px; flex-shrink: 0; cursor: pointer; }
    .cs-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .cs-toggle-track {
      position: absolute; inset: 0; border-radius: 8px;
      background: rgba(255,255,255,0.08);
      transition: background 0.18s;
    }
    .cs-toggle input:checked ~ .cs-toggle-track { background: rgba(91, 156, 245, 0.60); }
    .cs-toggle-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: rgba(255,255,255,0.9); pointer-events: none;
      transition: transform 0.18s;
    }
    .cs-toggle input:checked ~ .cs-toggle-thumb { transform: translateX(12px); }

    /* Slider row */
    .cs-slider-row {
      display: grid;
      grid-template-columns: 86px 1fr 38px;
      align-items: center; gap: 7px;
    }
    .cs-slider-label { font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cs-slider-val { font-size: 11px; color: rgba(255,255,255,0.30); text-align: right; font-variant-numeric: tabular-nums; }
    input[type=range].cs-range {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 2px;
      background: rgba(255,255,255,0.08); border-radius: 1px;
      outline: none; cursor: pointer;
    }
    input[type=range].cs-range::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 10px; height: 10px; border-radius: 50%;
      background: #5b9cf5; border: none;
      cursor: pointer; box-shadow: 0 0 8px rgba(91, 156, 245, 0.35);
    }
    input[type=range].cs-range::-moz-range-thumb {
      width: 10px; height: 10px; border-radius: 50%;
      background: #5b9cf5; border: none;
      cursor: pointer; box-shadow: 0 0 8px rgba(91, 156, 245, 0.35);
    }

    /* Dual slider row — two mini sliders side by side */
    .cs-dual-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .cs-dual-cell {
      display: grid;
      grid-template-columns: auto 1fr 28px;
      align-items: center; gap: 4px;
    }
    .cs-dual-cell .cs-slider-label { font-size: 10px; min-width: 0; }
    .cs-dual-cell .cs-slider-val { font-size: 10px; }

    /* Tilt pad — circular XY control */
    .cs-tilt-wrap {
      display: flex; align-items: center; gap: 10px;
    }
    .cs-tilt-pad {
      width: 64px; height: 64px; flex-shrink: 0;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0,0,0,0.3);
      position: relative; cursor: crosshair;
      overflow: hidden;
    }
    .cs-tilt-crosshair {
      position: absolute; background: rgba(255,255,255,0.06);
    }
    .cs-tilt-crosshair-h { width: 100%; height: 1px; top: 50%; left: 0; }
    .cs-tilt-crosshair-v { height: 100%; width: 1px; left: 50%; top: 0; }
    .cs-tilt-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #5b9cf5; position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
      box-shadow: 0 0 8px rgba(91, 156, 245, 0.35);
    }
    .cs-tilt-labels {
      display: flex; flex-direction: column; gap: 2px;
      font-size: 10px; color: rgba(255,255,255,0.35);
      font-variant-numeric: tabular-nums;
    }
    .cs-tilt-labels span { color: rgba(255,255,255,0.30); }

    /* Field row (label + pills) */
    .cs-field-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cs-field-label { font-size: 11px; color: rgba(255,255,255,0.50); }

    /* Pills */
    .cs-pills { display: flex; gap: 3px; flex-wrap: wrap; }
    .cs-pill {
      padding: 2px 7px; border-radius: 6px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
      cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.08);
      background: transparent; color: rgba(255,255,255,0.30);
      transition: all 0.15s; text-transform: uppercase;
    }
    .cs-pill.active { background: rgba(91, 156, 245, 0.15); color: #5b9cf5; border-color: rgba(91, 156, 245, 0.35); }
    .cs-pill:hover:not(.active) { background: rgba(255, 255, 255, 0.05); color: rgba(255,255,255,0.50); }

    /* Geometry tabs */
    .cs-tabs { display: flex; gap: 4px; margin-top: 6px; margin-bottom: 2px; }
    .cs-tab {
      flex: 1; padding: 5px 0; border-radius: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.30);
      transition: all 0.15s; text-transform: uppercase; text-align: center;
    }
    .cs-tab.active { background: rgba(91, 156, 245, 0.15); color: #5b9cf5; border-color: rgba(91, 156, 245, 0.35); }
    .cs-tab:hover:not(.active) { background: rgba(255, 255, 255, 0.05); }

    /* Advanced toggle */
    .cs-adv-toggle {
      display: flex; align-items: center; gap: 6px;
      margin-top: 2px; cursor: pointer; user-select: none;
    }
    .cs-adv-line { flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }
    .cs-adv-label { font-size: 9px; color: rgba(255,255,255,0.30); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
    .cs-adv-body { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .cs-adv-body.hidden { display: none; }

    /* Compact gradient preview */
    .cs-ramp-compact { display: flex; align-items: center; gap: 8px; }
    .cs-ramp-bar {
      flex: 1; height: 14px; border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer; transition: border-color 0.13s;
    }
    .cs-ramp-bar:hover { border-color: rgba(91, 156, 245, 0.35); }
    .cs-ramp-edit {
      font-size: 9px; color: rgba(255,255,255,0.30); white-space: nowrap;
      background: none; border: none; cursor: pointer; padding: 0;
      letter-spacing: 0.08em; text-transform: uppercase;
      transition: color 0.13s;
      font-family: inherit;
    }
    .cs-ramp-edit:hover { color: #5b9cf5; }

    /* Color ramp popover */
    .cs-popover {
      position: fixed; z-index: 300; width: 238px;
      background: rgba(12, 13, 18, 0.97);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
    .cs-popover.hidden { display: none; }
    .cs-popover-hdr { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .cs-popover-title { font-size: 10px; font-weight: 600; color: rgba(255, 255, 255, 0.50); letter-spacing: 0.1em; text-transform: uppercase; flex: 1; }
    .cs-popover-add {
      font-size: 10px; font-family: inherit; padding: 2px 6px; border-radius: 6px; cursor: pointer;
      background: rgba(91, 156, 245, 0.12); border: 1px solid rgba(91, 156, 245, 0.25);
      color: #5b9cf5; transition: background 0.12s;
    }
    .cs-popover-add:hover { background: rgba(91, 156, 245, 0.22); }
    .cs-popover-close {
      background: none; border: none; color: rgba(255,255,255,0.3); font-size: 16px;
      cursor: pointer; padding: 0; line-height: 1; transition: color 0.12s;
    }
    .cs-popover-close:hover { color: #5b9cf5; }

    /* Color input row */
    .cs-color-row { display: grid; grid-template-columns: 86px 1fr; align-items: center; gap: 7px; }
    .cs-color-input {
      width: 100%; height: 22px; border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer;
      padding: 0; background: none;
    }

    /* Export */
    .cs-btn-row { display: flex; gap: 5px; }
    .cs-export-btn {
      flex: 1; padding: 6px 0; border-radius: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      cursor: pointer; text-transform: uppercase; transition: all 0.15s;
      font-family: 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    .cs-export-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .cs-btn-video { background: rgba(91, 156, 245, 0.12); border: 1px solid rgba(91, 156, 245, 0.30); color: #5b9cf5; }
    .cs-btn-video:hover:not(:disabled) { background: rgba(91, 156, 245, 0.22); }
    .cs-btn-png { background: rgba(91, 156, 245, 0.06); border: 1px solid rgba(91, 156, 245, 0.18); color: rgba(91, 156, 245, 0.70); }
    .cs-btn-png:hover:not(:disabled) { background: rgba(91, 156, 245, 0.15); }
    .cs-btn-snap {
      width: 100%; padding: 6px 0; border-radius: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255,255,255,0.30); cursor: pointer; margin-bottom: 5px;
      transition: all 0.15s;
      font-family: 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    .cs-btn-snap:hover { background: rgba(255, 255, 255, 0.05); color: rgba(255,255,255,0.50); }
    .cs-progress-wrap { display: flex; flex-direction: column; gap: 3px; }
    .cs-progress-bar { width: 100%; height: 2px; background: rgba(255,255,255,0.08); border-radius: 1px; overflow: hidden; }
    .cs-progress-fill { height: 100%; width: 0%; background: #5b9cf5; transition: width 0.1s linear; }
    .cs-progress-lbl { font-size: 9px; color: rgba(255,255,255,0.30); text-align: center; }
    .cs-divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 6px 0; }

    /* Preset circles */
    .cs-presets {
      position: fixed; top: 42px; left: 42px; z-index: 100;
      display: flex; gap: 8px; align-items: center;
    }
    .cs-preset {
      width: 28px; height: 28px; border-radius: 6px;
      border: 1.5px solid rgba(255, 255, 255, 0.10);
      cursor: pointer; transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
      background: rgba(255,255,255,0.03);
      position: relative; overflow: hidden;
      flex-shrink: 0;
    }
    .cs-preset:hover { border-color: rgba(91, 156, 245, 0.5); transform: scale(1.06); }
    .cs-preset.empty { border-style: dashed; border-color: rgba(255, 255, 255, 0.10); }
    .cs-preset.empty::after {
      content: '+'; position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: rgba(255,255,255,0.20); font-weight: 600;
    }
    .cs-preset-tooltip {
      position: fixed; z-index: 200;
      background: rgba(12, 13, 18, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px; padding: 5px 9px;
      font: 10px/1.4 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: rgba(255,255,255,0.50);
      white-space: nowrap; pointer-events: none;
      opacity: 0; transition: opacity 0.12s;
    }
    .cs-preset-tooltip.visible { opacity: 1; }
  `
  document.head.appendChild(s)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot, setAspectRatio, exportDimensions) {
  injectStyles()

  const panel = document.createElement('div')
  panel.className = 'cs-panel'

  panel.appendChild(buildHeader(togglePause, () => randomizeSettings(uniforms)))
  panel.appendChild(buildLayersSection(uniforms))
  panel.appendChild(buildGeometrySection(uniforms))
  panel.appendChild(buildRenderingSection(uniforms))
  panel.appendChild(buildExportSection(exportPNG, exportVideo, getLoopDuration, snapshot, setAspectRatio, exportDimensions))

  document.body.appendChild(panel)
  document.body.appendChild(buildPresets(uniforms))
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function buildPresets(uniforms) {
  const NUM_PRESETS = 4
  const STORAGE_KEY = 'cool-shadez-presets'
  const presets = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || new Array(NUM_PRESETS).fill(null)

  const wrap = document.createElement('div')
  wrap.className = 'cs-presets'

  // Shared tooltip element
  const tooltip = document.createElement('div')
  tooltip.className = 'cs-preset-tooltip'
  document.body.appendChild(tooltip)

  function capturePreset() {
    const l1 = stopsFromUniforms(uniforms.layer1)
    const l2 = stopsFromUniforms(uniforms.layer2)
    const sc = uniforms.streaks.uColor.value
    return { layer1: l1, layer2: l2, streakColor: [sc.x, sc.y, sc.z] }
  }

  function loadPreset(data) {
    applyRamp(data.layer1.map(s => ({ ...s })), uniforms.layer1)
    applyRamp(data.layer2.map(s => ({ ...s })), uniforms.layer2)
    if (data.streakColor) {
      const v = uniforms.streaks.uColor.value
      v.set(data.streakColor[0], data.streakColor[1], data.streakColor[2])
    }
    // Refresh ramp bar visuals in the controls panel
    document.querySelectorAll('.cs-ramp-bar').forEach((bar, i) => {
      const u = i === 0 ? uniforms.layer1 : uniforms.layer2
      bar.style.background = stopsToGradient(stopsFromUniforms(u))
    })
  }

  function presetGradient(data) {
    // Blend layer1 and layer2 stops into a combined preview
    const all = [...data.layer1, ...data.layer2].sort((a, b) => a.pos - b.pos)
    return `linear-gradient(135deg, ${all.map(s => `${s.color} ${(s.pos * 100).toFixed(0)}%`).join(', ')})`
  }

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)) }

  const circles = []

  for (let i = 0; i < NUM_PRESETS; i++) {
    const el = document.createElement('div')
    el.className = `cs-preset${presets[i] ? '' : ' empty'}`
    if (presets[i]) el.style.background = presetGradient(presets[i])

    function showTooltip(text, e) {
      tooltip.textContent = text
      tooltip.classList.add('visible')
      const r = el.getBoundingClientRect()
      tooltip.style.left = r.left + 'px'
      tooltip.style.top = (r.bottom + 6) + 'px'
    }
    function hideTooltip() { tooltip.classList.remove('visible') }

    el.addEventListener('mouseenter', e => {
      showTooltip(presets[i] ? 'Click to load · Right-click to save' : 'Click to save preset', e)
    })
    el.addEventListener('mouseleave', hideTooltip)

    el.addEventListener('click', () => {
      if (presets[i]) {
        loadPreset(presets[i])
      } else {
        presets[i] = capturePreset()
        el.classList.remove('empty')
        el.style.background = presetGradient(presets[i])
        save()
      }
      hideTooltip()
    })

    el.addEventListener('contextmenu', e => {
      e.preventDefault()
      presets[i] = capturePreset()
      el.classList.remove('empty')
      el.style.background = presetGradient(presets[i])
      save()
      hideTooltip()
    })

    wrap.appendChild(el)
    circles.push(el)
  }

  return wrap
}

// ─── Randomize ───────────────────────────────────────────────────────────────

function randomizeSettings(uniforms) {
  const layers = ['layer1', 'layer2', 'bands', 'streaks', 'halftone']
  const activeLayers = new Set(layers.filter(k => uniforms[k].uLayerEnabled.value))

  for (const entry of uiRegistry) {
    if (!activeLayers.has(entry.layer)) continue

    if (entry.type === 'slider') {
      const range = entry.max - entry.min
      const raw = entry.min + Math.random() * range
      const snapped = Math.round(raw / entry.step) * entry.step
      const clamped = Math.min(entry.max, Math.max(entry.min, snapped))
      entry.set(clamped)
    } else if (entry.type === 'color') {
      const h = Math.random() * 360
      const s = 50 + Math.random() * 50
      const l = 30 + Math.random() * 40
      const c = new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`)
      entry.set('#' + c.getHexString())
    } else if (entry.type === 'ramp') {
      const count = 2 + Math.floor(Math.random() * 4) // 2–5 stops
      const stops = []
      for (let i = 0; i < count; i++) {
        const pos = i === 0 ? 0 : i === count - 1 ? 1 : Math.random()
        const h = Math.random() * 360
        const s = 50 + Math.random() * 50
        const l = 30 + Math.random() * 40
        const c = new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`)
        stops.push({ pos, color: '#' + c.getHexString() })
      }
      stops.sort((a, b) => a.pos - b.pos)
      entry.set(stops)
    }
  }

}

// ─── Header ───────────────────────────────────────────────────────────────────

function buildHeader(togglePause, onRandomize) {
  const el = document.createElement('div')
  el.className = 'cs-header'
  el.innerHTML = `<span class="cs-title">COOL SHADEZ</span>`

  const btnWrap = document.createElement('div')
  btnWrap.style.cssText = 'display:flex;gap:5px;'

  const diceBtn = document.createElement('button')
  diceBtn.className = 'cs-pause-btn'
  diceBtn.textContent = '\uD83C\uDFB2'
  diceBtn.title = 'Randomize'
  diceBtn.addEventListener('click', onRandomize)

  const pauseBtn = document.createElement('button')
  pauseBtn.className = 'cs-pause-btn'
  pauseBtn.textContent = '⏸'
  pauseBtn.addEventListener('click', () => { pauseBtn.textContent = togglePause() ? '▶' : '⏸' })

  btnWrap.appendChild(diceBtn)
  btnWrap.appendChild(pauseBtn)
  el.appendChild(btnWrap)
  return el
}

// ─── Section ──────────────────────────────────────────────────────────────────

function makeSection(label, buildBody, open = true) {
  const section = document.createElement('div')
  section.className = 'cs-section'

  const hdr = document.createElement('div')
  hdr.className = 'cs-section-hdr'
  hdr.innerHTML = `<span class="cs-section-label">${label}</span><span class="cs-chevron ${open ? 'open' : ''}">▼</span>`

  const body = document.createElement('div')
  body.className = 'cs-section-body' + (open ? '' : ' hidden')
  buildBody(body)

  hdr.addEventListener('click', () => {
    const isOpen = !body.classList.contains('hidden')
    body.classList.toggle('hidden', isOpen)
    hdr.querySelector('.cs-chevron').classList.toggle('open', !isOpen)
  })

  section.appendChild(hdr)
  section.appendChild(body)
  return section
}

// ─── Subsection ───────────────────────────────────────────────────────────────

function makeSubsection(label, u, buildBody) {
  const sub = document.createElement('div')
  sub.className = 'cs-sub'

  const hdr = document.createElement('div')
  hdr.className = 'cs-sub-hdr'

  const lbl = document.createElement('span')
  lbl.className = 'cs-sub-label'
  lbl.textContent = label

  hdr.appendChild(lbl)
  hdr.appendChild(makeToggle(u.uLayerEnabled.value, v => { u.uLayerEnabled.value = v }))

  const body = document.createElement('div')
  body.className = 'cs-sub-body'
  buildBody(body)

  sub.appendChild(hdr)
  sub.appendChild(body)
  return sub
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function makeToggle(checked, onChange) {
  const label = document.createElement('label')
  label.className = 'cs-toggle'

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))

  const track = document.createElement('div')
  track.className = 'cs-toggle-track'

  const thumb = document.createElement('div')
  thumb.className = 'cs-toggle-thumb'

  label.appendChild(input)
  label.appendChild(track)
  label.appendChild(thumb)
  return label
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function makeSlider(label, min, max, value, step, onChange) {
  const row = document.createElement('div')
  row.className = 'cs-slider-row'

  const lbl = document.createElement('span')
  lbl.className = 'cs-slider-label'
  lbl.textContent = label
  lbl.title = label

  const input = document.createElement('input')
  input.type = 'range'
  input.className = 'cs-range'
  input.min = min
  input.max = max
  input.step = step
  input.value = value

  const val = document.createElement('span')
  val.className = 'cs-slider-val'
  val.textContent = fmtVal(value, step)

  input.addEventListener('input', () => {
    const v = parseFloat(input.value)
    val.textContent = fmtVal(v, step)
    onChange(v)
  })

  if (_regLayer) {
    uiRegistry.push({ type: 'slider', layer: _regLayer, min, max, step,
      set(v) { input.value = v; val.textContent = fmtVal(v, step); onChange(v) }
    })
  }

  row.appendChild(lbl)
  row.appendChild(input)
  row.appendChild(val)
  return row
}

function makeDualSlider(labelA, labelB, min, max, valA, valB, step, onChangeA, onChangeB) {
  const row = document.createElement('div')
  row.className = 'cs-dual-row'

  function cell(label, value, onChange) {
    const c = document.createElement('div')
    c.className = 'cs-dual-cell'

    const lbl = document.createElement('span')
    lbl.className = 'cs-slider-label'
    lbl.textContent = label

    const input = document.createElement('input')
    input.type = 'range'
    input.className = 'cs-range'
    input.min = min; input.max = max; input.step = step; input.value = value

    const val = document.createElement('span')
    val.className = 'cs-slider-val'
    val.textContent = fmtVal(value, step)

    input.addEventListener('input', () => {
      const v = parseFloat(input.value)
      val.textContent = fmtVal(v, step)
      onChange(v)
    })

    if (_regLayer) {
      uiRegistry.push({ type: 'slider', layer: _regLayer, min, max, step,
        set(v) { input.value = v; val.textContent = fmtVal(v, step); onChange(v) }
      })
    }

    c.appendChild(lbl)
    c.appendChild(input)
    c.appendChild(val)
    return c
  }

  row.appendChild(cell(labelA, valA, onChangeA))
  row.appendChild(cell(labelB, valB, onChangeB))
  return row
}

// Circular XY pad + Z slider for 3-axis tilt control.
// X maps left/right (-1..1), Y maps up/down (-1..1), constrained to circle.
// Z is a vertical slider on the side.
function makeTiltPad(unifX, unifY, unifZ) {
  const wrap = document.createElement('div')
  wrap.className = 'cs-tilt-wrap'

  // ── Circular pad ──
  const pad = document.createElement('div')
  pad.className = 'cs-tilt-pad'

  const crossH = document.createElement('div')
  crossH.className = 'cs-tilt-crosshair cs-tilt-crosshair-h'
  const crossV = document.createElement('div')
  crossV.className = 'cs-tilt-crosshair cs-tilt-crosshair-v'
  pad.appendChild(crossH)
  pad.appendChild(crossV)

  const dot = document.createElement('div')
  dot.className = 'cs-tilt-dot'
  pad.appendChild(dot)

  // Labels showing current values
  const labels = document.createElement('div')
  labels.className = 'cs-tilt-labels'
  const xLabel = document.createElement('div')
  const yLabel = document.createElement('div')
  const zLabel = document.createElement('div')
  labels.appendChild(xLabel)
  labels.appendChild(yLabel)
  labels.appendChild(zLabel)

  function updateLabels() {
    xLabel.innerHTML = 'X <span>' + unifX.value.toFixed(2) + '</span>'
    yLabel.innerHTML = 'Y <span>' + unifY.value.toFixed(2) + '</span>'
    zLabel.innerHTML = 'Z <span>' + unifZ.value.toFixed(2) + '</span>'
  }

  function positionDot() {
    // Map -1..1 → 0%..100%
    const px = (unifX.value + 1) * 0.5 * 100
    const py = (1 - (unifY.value + 1) * 0.5) * 100 // invert Y so up = positive
    dot.style.left = px + '%'
    dot.style.top = py + '%'
  }

  function updateFromMouse(e) {
    const rect = pad.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    // Mouse position relative to center, normalized to -1..1
    let nx = (e.clientX - rect.left - cx) / cx
    let ny = -(e.clientY - rect.top - cy) / cy // invert Y
    // Constrain to circle
    const len = Math.sqrt(nx * nx + ny * ny)
    if (len > 1) { nx /= len; ny /= len }
    unifX.value = nx
    unifY.value = ny
    positionDot()
    updateLabels()
  }

  let dragging = false
  pad.addEventListener('mousedown', e => {
    dragging = true
    updateFromMouse(e)
    e.preventDefault()
  })
  window.addEventListener('mousemove', e => {
    if (dragging) updateFromMouse(e)
  })
  window.addEventListener('mouseup', () => { dragging = false })

  // Double-click to reset to center
  pad.addEventListener('dblclick', () => {
    unifX.value = 0; unifY.value = 0
    positionDot(); updateLabels()
  })

  // ── Z slider (vertical, beside the pad) ──
  const zWrap = document.createElement('div')
  zWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;height:64px;'
  const zInput = document.createElement('input')
  zInput.type = 'range'
  zInput.className = 'cs-range'
  zInput.min = -1; zInput.max = 1; zInput.step = 0.01; zInput.value = unifZ.value
  zInput.style.cssText = 'writing-mode:vertical-lr;direction:rtl;height:64px;width:18px;margin:0;'
  zInput.addEventListener('input', () => {
    unifZ.value = parseFloat(zInput.value)
    updateLabels()
  })
  zWrap.appendChild(zInput)

  if (_regLayer) {
    uiRegistry.push({ type: 'slider', layer: _regLayer, min: -1, max: 1, step: 0.01,
      set(v) { unifX.value = v; positionDot(); updateLabels() }
    })
    uiRegistry.push({ type: 'slider', layer: _regLayer, min: -1, max: 1, step: 0.01,
      set(v) { unifY.value = v; positionDot(); updateLabels() }
    })
    uiRegistry.push({ type: 'slider', layer: _regLayer, min: -1, max: 1, step: 0.01,
      set(v) { zInput.value = v; unifZ.value = v; updateLabels() }
    })
  }

  positionDot()
  updateLabels()

  wrap.appendChild(pad)
  wrap.appendChild(zWrap)
  wrap.appendChild(labels)
  return wrap
}

function fmtVal(v, step) {
  if (step >= 1)   return Math.round(v).toString()
  if (step >= 0.1) return v.toFixed(1)
  return v.toFixed(2)
}

// ─── Advanced disclosure ──────────────────────────────────────────────────────

function makeAdvanced(buildBody) {
  const wrap = document.createElement('div')

  const toggle = document.createElement('div')
  toggle.className = 'cs-adv-toggle'
  toggle.innerHTML = `<div class="cs-adv-line"></div><span class="cs-adv-label">Advanced ▼</span><div class="cs-adv-line"></div>`

  const body = document.createElement('div')
  body.className = 'cs-adv-body hidden'
  buildBody(body)

  let open = false
  toggle.addEventListener('click', () => {
    open = !open
    body.classList.toggle('hidden', !open)
    toggle.querySelector('.cs-adv-label').textContent = open ? 'Advanced ▲' : 'Advanced ▼'
  })

  wrap.appendChild(toggle)
  wrap.appendChild(body)
  return wrap
}

// ─── Single color (streaks) ───────────────────────────────────────────────────

function makeSingleColor(label, uniform) {
  const row = document.createElement('div')
  row.className = 'cs-color-row'

  const lbl = document.createElement('span')
  lbl.className = 'cs-slider-label'
  lbl.textContent = label

  const input = document.createElement('input')
  input.type = 'color'
  input.className = 'cs-color-input'
  const v = uniform.value
  input.value = '#' + new THREE.Color(v.x, v.y, v.z).getHexString()
  input.addEventListener('input', () => {
    const c = new THREE.Color(input.value)
    uniform.value.set(c.r, c.g, c.b)
  })

  if (_regLayer) {
    uiRegistry.push({ type: 'color', layer: _regLayer,
      set(hex) { input.value = hex; const c = new THREE.Color(hex); uniform.value.set(c.r, c.g, c.b) }
    })
  }

  row.appendChild(lbl)
  row.appendChild(input)
  return row
}

// ─── Compact color ramp + popover ─────────────────────────────────────────────

function makeCompactRamp(initialStops, onRampChange, layerLabel) {
  let stops = initialStops.map(s => ({ ...s }))

  const wrap = document.createElement('div')
  wrap.className = 'cs-ramp-compact'

  const bar = document.createElement('div')
  bar.className = 'cs-ramp-bar'
  bar.style.background = stopsToGradient(stops)

  const editBtn = document.createElement('button')
  editBtn.className = 'cs-ramp-edit'
  editBtn.textContent = 'Edit'

  wrap.appendChild(bar)
  wrap.appendChild(editBtn)

  // Build popover (appended to body so it escapes panel overflow)
  const popover = buildRampPopover(layerLabel, stops, newStops => {
    stops = newStops
    bar.style.background = stopsToGradient(stops)
    onRampChange(stops)
  })
  document.body.appendChild(popover)

  function openPopover(e) {
    e.stopPropagation()
    // Close any other open popovers
    document.querySelectorAll('.cs-popover:not(.hidden)').forEach(p => {
      if (p !== popover) p.classList.add('hidden')
    })
    popover.classList.remove('hidden')
    const rect = wrap.getBoundingClientRect()
    const pw = 238, ph = 230
    let left = rect.left - pw - 10
    if (left < 8) left = Math.min(rect.right + 8, window.innerWidth - pw - 8)
    let top = rect.top
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8
    popover.style.left = `${Math.max(8, left)}px`
    popover.style.top  = `${Math.max(8, top)}px`
  }

  bar.addEventListener('click', openPopover)
  editBtn.addEventListener('click', openPopover)

  document.addEventListener('click', e => {
    if (!popover.classList.contains('hidden') && !popover.contains(e.target)) {
      popover.classList.add('hidden')
    }
  })

  if (_regLayer) {
    uiRegistry.push({ type: 'ramp', layer: _regLayer,
      set(newStops) {
        stops = newStops.map(s => ({ ...s }))
        bar.style.background = stopsToGradient(stops)
        onRampChange(stops)
      }
    })
  }

  return wrap
}

function buildRampPopover(layerLabel, initialStops, onRampChange) {
  let stops = initialStops.map(s => ({ ...s }))

  const popover = document.createElement('div')
  popover.className = 'cs-popover hidden'

  // Header
  const hdr = document.createElement('div')
  hdr.className = 'cs-popover-hdr'

  const title = document.createElement('span')
  title.className = 'cs-popover-title'
  title.textContent = `${layerLabel} Colors`

  const addBtn = document.createElement('button')
  addBtn.className = 'cs-popover-add'
  addBtn.textContent = '+ stop'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'cs-popover-close'
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => popover.classList.add('hidden'))

  hdr.appendChild(title)
  hdr.appendChild(addBtn)
  hdr.appendChild(closeBtn)
  popover.appendChild(hdr)

  // Gradient bar
  const bar = document.createElement('div')
  bar.style.cssText = `width:100%;height:18px;border-radius:4px;cursor:crosshair;border:1px solid rgba(255,255,255,0.12);box-sizing:border-box;margin-top:2px;`

  const markersWrap = document.createElement('div')
  markersWrap.style.cssText = 'position:relative;width:100%;height:22px'

  popover.appendChild(bar)
  popover.appendChild(markersWrap)

  // Hex input row
  let activeStop = null
  const hexRow = document.createElement('div')
  hexRow.style.cssText = 'display:none;align-items:center;gap:6px'

  const hexLbl = document.createElement('span')
  hexLbl.style.cssText = 'font-size:10px;opacity:.4;white-space:nowrap;flex-shrink:0'
  hexLbl.textContent = 'hex'

  const hexInput = document.createElement('input')
  hexInput.type = 'text'
  hexInput.maxLength = 7
  hexInput.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.18);border-radius:3px;color:#fff;font:11px monospace;padding:2px 5px;outline:none'

  const hexPreview = document.createElement('div')
  hexPreview.style.cssText = 'width:14px;height:14px;border-radius:3px;flex-shrink:0;border:1px solid rgba(255,255,255,0.18)'

  hexRow.append(hexLbl, hexInput, hexPreview)
  popover.appendChild(hexRow)

  hexInput.addEventListener('input', () => {
    if (!activeStop) return
    const raw = hexInput.value.trim()
    const hex = raw.startsWith('#') ? raw : '#' + raw
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
    activeStop.color = hex
    hexPreview.style.background = hex
    bar.style.background = stopsToGradient(stops)
    const idx = stops.indexOf(activeStop)
    if (idx >= 0 && markersWrap.children[idx]) {
      markersWrap.children[idx].children[1].style.background = hex
    }
    onRampChange(stops)
  })

  // Drag state
  let drag = null

  document.addEventListener('mousemove', e => {
    if (!drag) return
    const rect = bar.getBoundingClientRect()
    const newPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    drag.stop.pos = newPos
    drag.marker.style.left = `${newPos * 100}%`
    bar.style.background = stopsToGradient([...stops].sort((a, b) => a.pos - b.pos))
  })

  document.addEventListener('mouseup', () => {
    if (!drag) return
    drag = null
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

  function redraw() {
    activeStop = null
    hexRow.style.display = 'none'
    bar.style.background = stopsToGradient(stops)
    markersWrap.innerHTML = ''
    addBtn.disabled = stops.length >= MAX_STOPS
    addBtn.style.opacity = stops.length >= MAX_STOPS ? '0.3' : '1'

    stops.forEach(stop => {
      const marker = document.createElement('div')
      marker.style.cssText = `position:absolute;top:0;transform:translateX(-50%);left:${stop.pos * 100}%;width:18px;height:22px;display:flex;flex-direction:column;align-items:center;cursor:grab;user-select:none;`

      const triangle = document.createElement('div')
      triangle.style.cssText = `width:0;height:0;flex-shrink:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:6px solid rgba(255,255,255,0.75);`

      const swatch = document.createElement('div')
      swatch.style.cssText = `width:16px;height:14px;border-radius:3px;flex-shrink:0;background:${stop.color};border:1px solid rgba(255,255,255,0.28);position:relative;cursor:pointer;`

      const closeX = document.createElement('div')
      closeX.textContent = '×'
      closeX.style.cssText = `position:absolute;top:-4px;right:-4px;width:10px;height:10px;line-height:10px;text-align:center;font-size:9px;border-radius:50%;background:rgba(255,60,60,0.85);color:#fff;display:none;cursor:pointer;`

      if (stops.length > 2) {
        swatch.addEventListener('mouseenter', () => { closeX.style.display = 'block' })
        swatch.addEventListener('mouseleave', () => { closeX.style.display = 'none' })
        closeX.addEventListener('mouseenter', () => { closeX.style.display = 'block' })
        closeX.addEventListener('mouseleave', () => { closeX.style.display = 'none' })
        closeX.addEventListener('click', e => {
          e.stopPropagation()
          stops = stops.filter(s => s !== stop)
          redraw()
          onRampChange(stops)
        })
      }
      swatch.appendChild(closeX)

      const colorInput = document.createElement('input')
      colorInput.type = 'color'
      colorInput.value = stop.color
      colorInput.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;pointer-events:none'
      swatch.appendChild(colorInput)

      swatch.addEventListener('click', e => {
        e.stopPropagation()
        activeStop = stop
        hexInput.value = stop.color
        hexPreview.style.background = stop.color
        hexRow.style.display = 'flex'
        colorInput.click()
      })

      colorInput.addEventListener('input', () => {
        stop.color = colorInput.value
        swatch.style.background = stop.color
        bar.style.background = stopsToGradient(stops)
        if (activeStop === stop) {
          hexInput.value = stop.color
          hexPreview.style.background = stop.color
        }
        onRampChange(stops)
      })

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

  bar.addEventListener('click', e => {
    if (stops.length >= MAX_STOPS) return
    const rect = bar.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    stops.push({ pos, color: lerpStops(stops, pos) })
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

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
  return popover
}

// ─── LAYERS section ───────────────────────────────────────────────────────────

function buildLayersSection(uniforms) {
  return makeSection('Layers', body => {
    ;[1, 2].forEach(n => body.appendChild(buildGradientLayerSub(`Layer ${n}`, uniforms[`layer${n}`], `layer${n}`)))
  })
}

function buildGradientLayerSub(label, u, layerKey) {
  return makeSubsection(label, u, body => {
    _regLayer = layerKey
    // Motion mode
    const modeRow = document.createElement('div')
    modeRow.className = 'cs-field-row'

    const modeLbl = document.createElement('span')
    modeLbl.className = 'cs-field-label'
    modeLbl.textContent = 'Motion'

    const pills = document.createElement('div')
    pills.className = 'cs-pills'

    // Build mode-specific rows first (syncMode references them)
    const dirRow = makeSlider('direction°', 0, 360,
      Math.round(u.uDriftAngle.value * 180 / Math.PI), 1,
      v => { u.uDriftAngle.value = v * Math.PI / 180 })

    // Sweep-specific controls
    const sweepGroup = document.createElement('div')
    sweepGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
    sweepGroup.appendChild(makeSlider('softness', 0, 1, 0.5, 0.01,
      v => { u.uDriftAngle.value = v * 6.28318 }))
    sweepGroup.appendChild(makeSlider('seam', 0, 1, u.uSweepSeam.value, 0.01,
      v => { u.uSweepSeam.value = v }))
    sweepGroup.appendChild(makeSlider('center', 0, 1, u.uSweepCenter.value, 0.01,
      v => { u.uSweepCenter.value = v }))

    // Noise preset pills — replace individual noise sliders
    const noisePresetRow = document.createElement('div')
    noisePresetRow.className = 'cs-field-row'
    noisePresetRow.style.display = 'none'
    const noisePresetLbl = document.createElement('span')
    noisePresetLbl.className = 'cs-field-label'
    noisePresetLbl.textContent = 'Style'
    const noisePresetPills = document.createElement('div')
    noisePresetPills.className = 'cs-pills'

    const noisePresets = {
      subtle:   { scale: 1.5, detail: 1.5, dimension: 1.8, depth: 0.4, liqStr: 0.08, liqScale: 1.0, liqSpeed: 0.05 },
      contrast: { scale: 3.0, detail: 2.5, dimension: 0.8, depth: 0.7, liqStr: 0.3,  liqScale: 1.5, liqSpeed: 0.12 },
    }

    function applyNoisePreset(name) {
      const p = noisePresets[name]
      u.uNoiseScale.value      = p.scale
      u.uDetail.value          = p.detail
      u.uDimension.value       = p.dimension
      u.uNoiseDepth.value      = p.depth
      u.uLiquifyStrength.value = p.liqStr
      u.uLiquifyScale.value    = p.liqScale
      u.uLiquifySpeed.value    = p.liqSpeed
      subtleBtn.classList.toggle('active', name === 'subtle')
      contrastBtn.classList.toggle('active', name === 'contrast')
    }

    const subtleBtn = document.createElement('button')
    subtleBtn.className = 'cs-pill active'
    subtleBtn.textContent = 'Subtle'
    subtleBtn.addEventListener('click', () => applyNoisePreset('subtle'))

    const contrastBtn = document.createElement('button')
    contrastBtn.className = 'cs-pill'
    contrastBtn.textContent = 'Contrast'
    contrastBtn.addEventListener('click', () => applyNoisePreset('contrast'))

    noisePresetPills.appendChild(subtleBtn)
    noisePresetPills.appendChild(contrastBtn)
    noisePresetRow.appendChild(noisePresetLbl)
    noisePresetRow.appendChild(noisePresetPills)

    function syncMode() {
      const mode = u.uMode.value
      radial_.classList.toggle('active', mode === 0)
      linear_.classList.toggle('active', mode === 1)
      noise_.classList.toggle('active', mode === 2)
      sweep_.classList.toggle('active', mode === 3)
      dirRow.style.display = mode === 1 ? '' : 'none'
      noisePresetRow.style.display = mode === 2 ? 'flex' : 'none'
      sweepGroup.style.display = mode === 3 ? 'flex' : 'none'
    }

    const radial_ = document.createElement('button')
    radial_.className = 'cs-pill'
    radial_.textContent = 'Radial'
    radial_.addEventListener('click', () => { u.uMode.value = 0; syncMode() })

    const linear_ = document.createElement('button')
    linear_.className = 'cs-pill'
    linear_.textContent = 'Linear'
    linear_.addEventListener('click', () => { u.uMode.value = 1; syncMode() })

    const noise_ = document.createElement('button')
    noise_.className = 'cs-pill'
    noise_.textContent = 'Noise'
    noise_.addEventListener('click', () => { u.uMode.value = 2; syncMode() })

    const sweep_ = document.createElement('button')
    sweep_.className = 'cs-pill'
    sweep_.textContent = 'Sweep'
    sweep_.addEventListener('click', () => { u.uMode.value = 3; syncMode() })

    pills.appendChild(radial_)
    pills.appendChild(linear_)
    pills.appendChild(noise_)
    pills.appendChild(sweep_)
    modeRow.appendChild(modeLbl)
    modeRow.appendChild(pills)
    body.appendChild(modeRow)

    body.appendChild(makeSlider('speed', 0.05, 2, u.uSpeed.value, 0.01, v => { u.uSpeed.value = v }))
    body.appendChild(dirRow)
    body.appendChild(noisePresetRow)
    body.appendChild(sweepGroup)

    // Compact color ramp
    body.appendChild(makeCompactRamp(stopsFromUniforms(u), stops => applyRamp(stops, u), label))

    // Advanced: offset
    body.appendChild(makeAdvanced(adv => {
      adv.appendChild(makeSlider('offset', 0, 6.28, u.uOffset.value, 0.01, v => { u.uOffset.value = v }))
    }))

    _regLayer = null
    syncMode()
  })
}

// ─── GEOMETRY section ─────────────────────────────────────────────────────────

function buildGeometrySection(uniforms) {
  return makeSection('Geometry', body => {
    const ub = uniforms.bands

    _regLayer = 'bands'
    body.appendChild(makeSubsection('Bands', ub, sub => {

      // ── Mode pills: Parallel | Burst ──────────────────────────────────────
      const modeRow = document.createElement('div')
      modeRow.className = 'cs-field-row'
      const modeLbl = document.createElement('span')
      modeLbl.className = 'cs-field-label'
      modeLbl.textContent = 'Mode'
      const modePills = document.createElement('div')
      modePills.className = 'cs-pills'

      // Parallel-only controls (spacing + angle)
      const parallelGroup = document.createElement('div')
      parallelGroup.style.cssText = 'display:flex;flex-direction:column;gap:8px;'
      parallelGroup.appendChild(makeSlider('spacing', 1, 20, ub.uSpacing.value, 0.1, v => { ub.uSpacing.value = v }))
      // Step pills: 1 Step (band + gap) vs 2 Step (no gap)
      const stepRow = document.createElement('div')
      stepRow.className = 'cs-field-row'
      const stepLbl = document.createElement('span')
      stepLbl.className = 'cs-field-label'
      stepLbl.textContent = 'Step'
      const stepPills = document.createElement('div')
      stepPills.className = 'cs-pills'
      const step1 = document.createElement('button')
      step1.className = 'cs-pill' + (ub.uStep.value === 1 ? ' active' : '')
      step1.textContent = '1'
      const step2 = document.createElement('button')
      step2.className = 'cs-pill' + (ub.uStep.value === 2 ? ' active' : '')
      step2.textContent = '2'
      function syncStep() {
        step1.classList.toggle('active', ub.uStep.value === 1)
        step2.classList.toggle('active', ub.uStep.value === 2)
      }
      step1.addEventListener('click', () => { ub.uStep.value = 1; syncStep() })
      step2.addEventListener('click', () => { ub.uStep.value = 2; syncStep() })
      stepPills.appendChild(step1)
      stepPills.appendChild(step2)
      stepRow.appendChild(stepLbl)
      stepRow.appendChild(stepPills)
      parallelGroup.appendChild(stepRow)
      parallelGroup.appendChild(makeSlider('angle°',  0, 360, Math.round(ub.uAngle.value * 180 / Math.PI), 1, v => { ub.uAngle.value = v * Math.PI / 180 }))
      parallelGroup.appendChild(makeTiltPad(ub.uTilt, ub.uTilt2, ub.uTiltZ))

      // Burst-only controls
      const burstGroup = document.createElement('div')
      burstGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      burstGroup.appendChild(makeSlider('angle°',    0,   360,  Math.round(ub.uOffset.value * 180 / Math.PI), 1, v => { ub.uOffset.value = v * Math.PI / 180 }))
      burstGroup.appendChild(makeSlider('intensity', 0,   2,    ub.uRayIntensity.value, 0.01, v => { ub.uRayIntensity.value = v }))
      burstGroup.appendChild(makeTiltPad(ub.uTilt, ub.uTilt2, ub.uTiltZ))

      function syncBandsMode() {
        const m = ub.uBandsMode.value
        parallel_.classList.toggle('active', m === 0)
        burst_.classList.toggle('active', m === 1)
        parallelGroup.style.display = m === 0 ? 'flex' : 'none'
        burstGroup.style.display    = m === 1 ? 'flex' : 'none'
      }

      const parallel_ = document.createElement('button')
      parallel_.className = 'cs-pill'
      parallel_.textContent = 'Parallel'
      parallel_.addEventListener('click', () => { ub.uBandsMode.value = 0; syncBandsMode() })

      const burst_ = document.createElement('button')
      burst_.className = 'cs-pill'
      burst_.textContent = 'Burst'
      burst_.addEventListener('click', () => { ub.uBandsMode.value = 1; syncBandsMode() })

      modePills.appendChild(parallel_)
      modePills.appendChild(burst_)
      modeRow.appendChild(modeLbl)
      modeRow.appendChild(modePills)
      sub.appendChild(modeRow)
      sub.appendChild(parallelGroup)
      sub.appendChild(burstGroup)

      // Speed, distortion, and Advanced shared by both modes
      sub.appendChild(makeSlider('speed', 0, 2, ub.uSpeed.value, 0.01, v => { ub.uSpeed.value = v }))
      sub.appendChild(makeSlider('distort', 0, 1, ub.uDistort.value, 0.01, v => { ub.uDistort.value = v }))
      sub.appendChild(makeAdvanced(adv => {
        // Band shape toggle: Flat / Tube / Fin
        const shapeRow = document.createElement('div')
        shapeRow.className = 'cs-field-row'
        const shapeLbl = document.createElement('span')
        shapeLbl.className = 'cs-field-label'
        shapeLbl.textContent = 'Shape'
        const shapePills = document.createElement('div')
        shapePills.className = 'cs-pills'
        const shapeNames = ['Flat', 'Tube', 'Fin']
        const shapeBtns = shapeNames.map((name, i) => {
          const btn = document.createElement('button')
          btn.className = 'cs-pill' + (ub.uBandShape.value === i ? ' active' : '')
          btn.textContent = name
          btn.addEventListener('click', () => { ub.uBandShape.value = i; syncShape() })
          shapePills.appendChild(btn)
          return btn
        })
        function syncShape() {
          shapeBtns.forEach((btn, i) => btn.classList.toggle('active', ub.uBandShape.value === i))
        }
        shapeRow.appendChild(shapeLbl)
        shapeRow.appendChild(shapePills)
        adv.appendChild(shapeRow)

        adv.appendChild(makeSlider('softness',        0.01, 1,   ub.uSoftness.value,       0.01, v => { ub.uSoftness.value       = v }))
        adv.appendChild(makeSlider('IOR',             1.0,  3.0, ub.uIOR.value,            0.01, v => { ub.uIOR.value            = v }))
        adv.appendChild(makeSlider('thickness',       0,    1,   ub.uThickness.value,      0.01, v => { ub.uThickness.value      = v }))
        adv.appendChild(makeSlider('fresnel',         0,    1,   ub.uFresnel.value,        0.01, v => { ub.uFresnel.value        = v }))
        adv.appendChild(makeSlider('bevel width',     0,    1,   ub.uBevelWidth.value,     0.01, v => { ub.uBevelWidth.value     = v }))
        adv.appendChild(makeSlider('bevel intensity', 0,    2,   ub.uBevelIntensity.value, 0.01, v => { ub.uBevelIntensity.value = v }))
        adv.appendChild(makeSingleColor('tint color', ub.uTintColor))
        adv.appendChild(makeSlider('tint strength',   0,    1,   ub.uTintStrength.value,   0.01, v => { ub.uTintStrength.value   = v }))
      }))

      syncBandsMode()
      _regLayer = null
    }))
  })
}

// ─── EFFECTS section ──────────────────────────────────────────────────────────

function buildEffectsSection(uniforms) {
  return makeSection('Effects', body => {
    const u = uniforms.streaks
    _regLayer = 'streaks'
    body.appendChild(makeSubsection('Light Streaks', u, sub => {

      // ── Mode pills: Parallel | Rings ──────────────────────────────────────
      const modeRow = document.createElement('div')
      modeRow.className = 'cs-field-row'
      modeRow.style.cssText = 'flex-direction:column;align-items:stretch;gap:4px;'
      const modeLbl = document.createElement('span')
      modeLbl.className = 'cs-field-label'
      modeLbl.textContent = 'Mode'
      const modePills = document.createElement('div')
      modePills.className = 'cs-pills'

      // Parallel-only controls (angle)
      const parallelGroup = document.createElement('div')
      parallelGroup.style.cssText = 'display:flex;flex-direction:column;gap:8px;'
      parallelGroup.appendChild(makeSlider('angle°', 0, 360, Math.round(u.uAngle.value * 180 / Math.PI), 1, v => { u.uAngle.value = v * Math.PI / 180 }))

      function syncStreaksMode() {
        const m = u.uMode.value
        parallelBtn.classList.toggle('active', m === 0)
        ringsBtn.classList.toggle('active', m === 3)
        parallelGroup.style.display = m === 0 ? 'flex' : 'none'
      }

      const parallelBtn = document.createElement('button')
      parallelBtn.className = 'cs-pill active'
      parallelBtn.textContent = 'Parallel'
      parallelBtn.addEventListener('click', () => { u.uMode.value = 0; syncStreaksMode() })

      const ringsBtn = document.createElement('button')
      ringsBtn.className = 'cs-pill'
      ringsBtn.textContent = 'Rings'
      ringsBtn.addEventListener('click', () => { u.uMode.value = 3; syncStreaksMode() })

      modePills.appendChild(parallelBtn)
      modePills.appendChild(ringsBtn)
      modeRow.appendChild(modeLbl)
      modeRow.appendChild(modePills)
      sub.appendChild(modeRow)
      sub.appendChild(parallelGroup)

      // Shared controls
      sub.appendChild(makeSlider('speed',     0,    2,   u.uSpeed.value,     0.01,  v => { u.uSpeed.value     = v }))
      sub.appendChild(makeSlider('intensity', 0,    4,   u.uIntensity.value, 0.05,  v => { u.uIntensity.value = v }))
      sub.appendChild(makeSlider('flicker',  0,    1,   u.uFlicker.value,   0.01,  v => { u.uFlicker.value   = v }))
      sub.appendChild(makeSingleColor('color', u.uColor))
      sub.appendChild(makeAdvanced(adv => {
        adv.appendChild(makeSlider('spacing', 1,    20,  u.uSpacing.value,   0.1,   v => { u.uSpacing.value   = v }))
        adv.appendChild(makeSlider('width',   0.01, 0.2, u.uWidth.value,     0.005, v => { u.uWidth.value     = v }))
        adv.appendChild(makeSlider('length',  0.05, 1.0, u.uLength.value,    0.01,  v => { u.uLength.value    = v }))
        adv.appendChild(makeSlider('offset',  0,    6.28,u.uOffset.value,    0.01,  v => { u.uOffset.value    = v }))
      }))
      _regLayer = null
    }))
  })
}

// ─── RENDERING section ────────────────────────────────────────────────────────

function buildRenderingSection(uniforms) {
  return makeSection('Rendering', body => {
    const u = uniforms.halftone
    _regLayer = 'halftone'
    body.appendChild(makeSubsection('Halftone', u, sub => {
      // Shape pills: Circle | Square
      const shapeRow = document.createElement('div')
      shapeRow.className = 'cs-field-row'
      const shapeLbl = document.createElement('span')
      shapeLbl.className = 'cs-field-label'
      shapeLbl.textContent = 'Shape'
      const shapePills = document.createElement('div')
      shapePills.className = 'cs-pills'

      const circleBtn = document.createElement('button')
      circleBtn.className = 'cs-pill active'
      circleBtn.textContent = 'Circle'
      circleBtn.addEventListener('click', () => { u.uShape.value = 0; syncShape() })

      const squareBtn = document.createElement('button')
      squareBtn.className = 'cs-pill'
      squareBtn.textContent = 'Square'
      squareBtn.addEventListener('click', () => { u.uShape.value = 1; syncShape() })

      function syncShape() {
        circleBtn.classList.toggle('active', u.uShape.value === 0)
        squareBtn.classList.toggle('active', u.uShape.value === 1)
      }

      shapePills.appendChild(circleBtn)
      shapePills.appendChild(squareBtn)
      shapeRow.appendChild(shapeLbl)
      shapeRow.appendChild(shapePills)
      sub.appendChild(shapeRow)

      sub.appendChild(makeSlider('spacing', 4,   80, u.uSpacing.value, 0.5,  v => { u.uSpacing.value = v }))
      sub.appendChild(makeSlider('scale',   0.1, 1,  u.uScale.value,   0.01, v => { u.uScale.value   = v }))
      sub.appendChild(makeAdvanced(adv => {
        adv.appendChild(makeSlider('shadow', 0, 1, u.uShadow.value, 0.01, v => { u.uShadow.value = v }))
      }))
      _regLayer = null
    }))
  })
}

// ─── EXPORT section ───────────────────────────────────────────────────────────

function buildExportSection(exportPNG, exportVideo, getLoopDuration, snapshot, setAspectRatio, exportDimensions) {
  return makeSection('Export', body => {
    // Aspect ratio pills
    const arRow = document.createElement('div')
    arRow.className = 'cs-field-row'
    const arLbl = document.createElement('span')
    arLbl.className = 'cs-field-label'
    arLbl.textContent = 'Aspect ratio'
    const arPills = document.createElement('div')
    arPills.className = 'cs-pills'

    const ratios = [
      { label: 'Free', value: null },
      { label: '1:1',  value: 1 },
      { label: '4:5',  value: 4/5 },
      { label: '3:4',  value: 3/4 },
      { label: '4:3',  value: 4/3 },
      { label: '16:9', value: 16/9 },
      { label: '9:16', value: 9/16 },
    ]
    const arBtns = ratios.map(({ label, value }) => {
      const btn = document.createElement('button')
      btn.className = 'cs-pill' + (value === null ? ' active' : '')
      btn.textContent = label
      btn.addEventListener('click', () => {
        setAspectRatio(value)
        arBtns.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
      return btn
    })
    arBtns.forEach(b => arPills.appendChild(b))
    arRow.appendChild(arLbl)
    arRow.appendChild(arPills)
    body.appendChild(arRow)

    // FPS toggle
    let selectedFps = 30
    const fpsRow = document.createElement('div')
    fpsRow.className = 'cs-field-row'
    fpsRow.style.marginTop = '4px'

    const fpsLbl = document.createElement('span')
    fpsLbl.className = 'cs-field-label'
    fpsLbl.textContent = 'Frame rate'

    const fpsPills = document.createElement('div')
    fpsPills.className = 'cs-pills'

    const fpsBtns = [30, 60].map(fps => {
      const btn = document.createElement('button')
      btn.className = 'cs-pill' + (fps === 30 ? ' active' : '')
      btn.textContent = `${fps} fps`
      btn.addEventListener('click', () => {
        selectedFps = fps
        fpsBtns.forEach((b, i) => b.classList.toggle('active', [30, 60][i] === selectedFps))
      })
      return btn
    })
    fpsBtns.forEach(b => fpsPills.appendChild(b))
    fpsRow.appendChild(fpsLbl)
    fpsRow.appendChild(fpsPills)
    body.appendChild(fpsRow)

    // Video resolution toggle
    let selectedVideoRes = 'Canvas'
    const resRow = document.createElement('div')
    resRow.className = 'cs-field-row'
    resRow.style.marginTop = '4px'

    const resLbl = document.createElement('span')
    resLbl.className = 'cs-field-label'
    resLbl.textContent = 'Video resolution'

    const resPills = document.createElement('div')
    resPills.className = 'cs-pills'

    const resBtns = ['Canvas', '4K'].map(res => {
      const btn = document.createElement('button')
      btn.className = 'cs-pill' + (res === 'Canvas' ? ' active' : '')
      btn.textContent = res
      if (res === '4K') {
        btn.addEventListener('mouseenter', () => {
          if (!btn.classList.contains('active') || true) {
            const [ew, eh] = exportDimensions('4K')
            btn.textContent = `${ew}\u00d7${eh}`
          }
        })
        btn.addEventListener('mouseleave', () => { btn.textContent = '4K' })
      }
      btn.addEventListener('click', () => {
        selectedVideoRes = res
        resBtns.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
      return btn
    })
    resBtns.forEach(b => resPills.appendChild(b))
    resRow.appendChild(resLbl)
    resRow.appendChild(resPills)
    body.appendChild(resRow)

    // Progress bar
    const progressWrap = document.createElement('div')
    progressWrap.className = 'cs-progress-wrap'
    progressWrap.style.display = 'none'
    progressWrap.style.marginTop = '8px'
    const progressBar  = document.createElement('div'); progressBar.className  = 'cs-progress-bar'
    const progressFill = document.createElement('div'); progressFill.className = 'cs-progress-fill'
    const progressLbl  = document.createElement('div'); progressLbl.className  = 'cs-progress-lbl'
    progressBar.appendChild(progressFill)
    progressWrap.append(progressBar, progressLbl)
    body.appendChild(progressWrap)

    // Duration buttons
    const durRow = document.createElement('div')
    durRow.className = 'cs-btn-row'
    durRow.style.marginTop = '8px'

    let isRecording = false

    for (const secs of [3, 5, 10]) {
      const btn = document.createElement('button')
      btn.className = 'cs-export-btn cs-btn-video'
      btn.textContent = `${secs}s`
      btn.title = `Record a seamlessly looping ${secs}s WebM`
      btn.addEventListener('mouseenter', () => { if (!isRecording) btn.textContent = `${getLoopDuration(secs).toFixed(1)}s` })
      btn.addEventListener('mouseleave', () => { if (!isRecording) btn.textContent = `${secs}s` })
      btn.addEventListener('click', async () => {
        if (isRecording) return
        isRecording = true
        const exact = getLoopDuration(secs)
        progressWrap.style.display = 'flex'
        progressFill.style.width = '0%'
        const resLabel = selectedVideoRes === '4K' ? '4K' : ''
        progressLbl.textContent = `recording ${exact.toFixed(1)}s @ ${selectedFps}fps${resLabel ? ' ' + resLabel : ''}…`
        durRow.style.opacity = '0.35'; durRow.style.pointerEvents = 'none'
        fpsPills.style.pointerEvents = 'none'
        resPills.style.pointerEvents = 'none'
        await exportVideo({
          targetDuration: secs, fps: selectedFps, resolution: selectedVideoRes,
          onProgress: p => {
            progressFill.style.width = `${Math.round(p * 100)}%`
            progressLbl.textContent = `recording… ${Math.round(p * 100)}%`
          },
          onDone: () => {
            isRecording = false
            progressWrap.style.display = 'none'
            durRow.style.opacity = '1'; durRow.style.pointerEvents = 'auto'
            fpsPills.style.pointerEvents = 'auto'
            resPills.style.pointerEvents = 'auto'
          },
        })
      })
      durRow.appendChild(btn)
    }
    body.appendChild(durRow)

    // Divider + PNG
    const divider = document.createElement('div')
    divider.className = 'cs-divider'
    body.appendChild(divider)

    const snapBtn = document.createElement('button')
    snapBtn.className = 'cs-btn-snap'
    snapBtn.textContent = 'Snapshot'
    snapBtn.title = 'Download current frame at viewport resolution'
    snapBtn.addEventListener('click', () => snapshot())
    body.appendChild(snapBtn)

    const pngRow = document.createElement('div')
    pngRow.className = 'cs-btn-row'
    for (const label of ['HD', '4K', '5K']) {
      const btn = document.createElement('button')
      btn.className = 'cs-export-btn cs-btn-png'
      btn.textContent = label
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) {
          const [ew, eh] = exportDimensions(label)
          btn.textContent = `${ew}×${eh}`
        }
      })
      btn.addEventListener('mouseleave', () => { if (!btn.disabled) btn.textContent = label })
      btn.addEventListener('click', () => {
        btn.textContent = '…'; btn.disabled = true
        requestAnimationFrame(() => {
          exportPNG(label)
          btn.textContent = label; btn.disabled = false
        })
      })
      pngRow.appendChild(btn)
    }
    body.appendChild(pngRow)
  })
}

// ─── Color ramp utilities ─────────────────────────────────────────────────────

function stopsFromUniforms(u) {
  const stops = []
  for (let i = 0; i < u.uRampCount.value; i++) {
    const r = u.uRampColors.value[i * 3]
    const g = u.uRampColors.value[i * 3 + 1]
    const b = u.uRampColors.value[i * 3 + 2]
    stops.push({ pos: u.uRampPositions.value[i], color: rgbToHex(r, g, b) })
  }
  return stops
}

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

function lerpHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b)
  return '#' + new THREE.Color(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  ).getHexString()
}

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

function rgbToHex(r, g, b) {
  const h = v => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function stopsToGradient(stops) {
  return `linear-gradient(to right, ${stops.map(s => `${s.color} ${(s.pos * 100).toFixed(1)}%`).join(', ')})`
}
