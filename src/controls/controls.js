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
      width: 326px;
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

    /* Position pad — rectangular XY control for radial/sweep center */
    .cs-pos-pad {
      width: 100px; height: 64px; flex-shrink: 0;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0,0,0,0.3);
      position: relative; cursor: crosshair;
      overflow: hidden;
    }
    .cs-pos-crosshair {
      position: absolute; background: rgba(255,255,255,0.06);
    }
    .cs-pos-crosshair-h { width: 100%; height: 1px; top: 50%; left: 0; }
    .cs-pos-crosshair-v { height: 100%; width: 1px; left: 50%; top: 0; }
    .cs-pos-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #5b9cf5; position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
      box-shadow: 0 0 8px rgba(91, 156, 245, 0.35);
    }
    .cs-pos-corner {
      width: 4px; height: 4px; border-radius: 50%;
      background: rgba(255,255,255,0.12);
      position: absolute; pointer-events: none;
    }

    /* Origin grid — 3x3 clickable zone grid for fan VP selection */
    .cs-origin-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      width: 100%; aspect-ratio: 3 / 2;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .cs-origin-cell {
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      transition: background 0.12s;
    }
    .cs-origin-cell:nth-child(3n) { border-right: none; }
    .cs-origin-cell:nth-child(n+7) { border-bottom: none; }
    .cs-origin-cell:hover:not(.active) { background: rgba(255, 255, 255, 0.04); }
    .cs-origin-cell.active { background: rgba(91, 156, 245, 0.08); }
    .cs-origin-cell.center { cursor: default; pointer-events: none; }
    .cs-origin-pip {
      width: 6px; height: 6px; border-radius: 50%;
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      background: transparent;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      pointer-events: none;
    }
    .cs-origin-cell:hover:not(.active) .cs-origin-pip {
      border-color: rgba(255, 255, 255, 0.35);
    }
    .cs-origin-cell.active .cs-origin-pip {
      width: 7px; height: 7px;
      border-color: #5b9cf5;
      background: rgba(91, 156, 245, 0.35);
      box-shadow: 0 0 8px rgba(91, 156, 245, 0.4);
    }
    .cs-origin-cell.center .cs-origin-pip {
      width: 4px; height: 4px; border: none;
      background: rgba(255, 255, 255, 0.1);
    }

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

    /* Knob */
    /* Matcap light sphere */
    .cs-matcap {
      width: 64px !important; height: 64px !important;
      min-width: 64px; max-width: 64px;
      min-height: 64px; max-height: 64px;
      flex-shrink: 0;
      border-radius: 50%;
      cursor: crosshair;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .cs-matcap canvas {
      width: 64px !important; height: 64px !important;
      display: block;
    }
    .cs-pad-row {
      display: flex; align-items: center; gap: 10px;
    }

    /* Knob */
    .cs-knob-pair {
      display: flex; justify-content: center; gap: 0;
      padding: 4px 0 2px;
    }
    .cs-knob-row {
      display: flex; flex-direction: column; align-items: center;
      gap: 2px; width: 52px; flex-shrink: 0;
    }
    .cs-knob-label {
      font-size: 8px; font-weight: 600; letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.30); text-transform: uppercase;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 52px; text-align: center;
    }
    .cs-knob-wrap {
      position: relative; width: 36px; height: 36px;
      cursor: grab;
    }
    .cs-knob-wrap:active { cursor: grabbing; }
    .cs-knob-svg { width: 100%; height: 100%; }
    .cs-knob-val {
      font-size: 9px; font-weight: 500; color: rgba(255, 255, 255, 0.45);
      font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
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
    return { layer1: l1, layer2: l2 }
  }

  function loadPreset(data) {
    applyRamp(data.layer1.map(s => ({ ...s })), uniforms.layer1)
    applyRamp(data.layer2.map(s => ({ ...s })), uniforms.layer2)
    // Refresh ramp bar visuals in the controls panel
    document.querySelectorAll('.cs-ramp-bar').forEach((bar, i) => {
      const u = i === 0 ? uniforms.layer1 : uniforms.layer2
      bar.style.background = stopsToGradient(stopsFromUniforms(u), u.uOklab.value)
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
  const layers = ['layer1', 'layer2', 'bands', 'halftone']
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
      entry.set(hslToHex(h, s, l))
    } else if (entry.type === 'ramp') {
      const count = 2 + Math.floor(Math.random() * 4) // 2–5 stops
      const stops = []
      for (let i = 0; i < count; i++) {
        const pos = i === 0 ? 0 : i === count - 1 ? 1 : Math.random()
        const h = Math.random() * 360
        const s = 50 + Math.random() * 50
        const l = 30 + Math.random() * 40
        stops.push({ pos, color: hslToHex(h, s, l) })
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

function makeKnob(label, min, max, value, step, onChange) {
  const ARC_START = 225          // degrees — bottom-left
  const ARC_END   = -45          // degrees — bottom-right (clockwise sweep of 270°)
  const ARC_SPAN  = 270
  const R = 26, CX = 32, CY = 32 // SVG viewBox 64x64

  function valToAngle(v) {
    const t = (v - min) / (max - min)
    return ARC_START - t * ARC_SPAN
  }
  function polarXY(angleDeg, r) {
    const rad = angleDeg * Math.PI / 180
    return [CX + Math.cos(rad) * r, CY - Math.sin(rad) * r]
  }
  function describeArc(startAngle, endAngle, r) {
    const [sx, sy] = polarXY(startAngle, r)
    const [ex, ey] = polarXY(endAngle, r)
    const sweep = startAngle > endAngle ? 1 : 0
    const large = Math.abs(startAngle - endAngle) > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`
  }

  const row = document.createElement('div')
  row.className = 'cs-knob-row'

  const lbl = document.createElement('span')
  lbl.className = 'cs-knob-label'
  lbl.textContent = label

  const wrap = document.createElement('div')
  wrap.className = 'cs-knob-wrap'

  // Build SVG
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('class', 'cs-knob-svg')

  // Tick marks (11 ticks around the arc)
  const TICK_COUNT = 11
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i / (TICK_COUNT - 1)
    const angle = ARC_START - t * ARC_SPAN
    const [ox, oy] = polarXY(angle, R + 3)
    const [ix, iy] = polarXY(angle, R + 1)
    const tick = document.createElementNS(svgNS, 'line')
    tick.setAttribute('x1', ox)
    tick.setAttribute('y1', oy)
    tick.setAttribute('x2', ix)
    tick.setAttribute('y2', iy)
    tick.setAttribute('stroke', 'rgba(255,255,255,0.12)')
    tick.setAttribute('stroke-width', i === 0 || i === TICK_COUNT - 1 ? '1.5' : '1')
    tick.setAttribute('stroke-linecap', 'round')
    svg.appendChild(tick)
  }

  // Track arc (background)
  const trackArc = document.createElementNS(svgNS, 'path')
  trackArc.setAttribute('d', describeArc(ARC_START, ARC_END, R))
  trackArc.setAttribute('fill', 'none')
  trackArc.setAttribute('stroke', 'rgba(255,255,255,0.06)')
  trackArc.setAttribute('stroke-width', '3')
  trackArc.setAttribute('stroke-linecap', 'round')
  svg.appendChild(trackArc)

  // Active arc (filled portion)
  const activeArc = document.createElementNS(svgNS, 'path')
  activeArc.setAttribute('fill', 'none')
  activeArc.setAttribute('stroke', '#5b9cf5')
  activeArc.setAttribute('stroke-width', '3')
  activeArc.setAttribute('stroke-linecap', 'round')
  activeArc.style.filter = 'drop-shadow(0 0 4px rgba(91, 156, 245, 0.35))'
  svg.appendChild(activeArc)

  // Center body
  const body = document.createElementNS(svgNS, 'circle')
  body.setAttribute('cx', CX)
  body.setAttribute('cy', CY)
  body.setAttribute('r', R - 5)
  body.setAttribute('fill', 'rgba(255,255,255,0.03)')
  body.setAttribute('stroke', 'rgba(255,255,255,0.08)')
  body.setAttribute('stroke-width', '1')
  svg.appendChild(body)

  // Pointer line (indicator)
  const pointer = document.createElementNS(svgNS, 'line')
  pointer.setAttribute('stroke', '#5b9cf5')
  pointer.setAttribute('stroke-width', '2')
  pointer.setAttribute('stroke-linecap', 'round')
  pointer.style.filter = 'drop-shadow(0 0 3px rgba(91, 156, 245, 0.4))'
  svg.appendChild(pointer)

  wrap.appendChild(svg)

  const valSpan = document.createElement('span')
  valSpan.className = 'cs-knob-val'
  valSpan.textContent = fmtVal(value, step)

  function update(v) {
    const angle = valToAngle(v)
    // Active arc from start to current
    if (v > min) {
      activeArc.setAttribute('d', describeArc(ARC_START, angle, R))
      activeArc.style.display = ''
    } else {
      activeArc.style.display = 'none'
    }
    // Pointer
    const [px, py] = polarXY(angle, R - 8)
    const [px2, py2] = polarXY(angle, R - 16)
    pointer.setAttribute('x1', px)
    pointer.setAttribute('y1', py)
    pointer.setAttribute('x2', px2)
    pointer.setAttribute('y2', py2)
    valSpan.textContent = fmtVal(v, step)
  }
  update(value)

  // Drag interaction — vertical drag to change value
  let dragging = false
  let dragStartY = 0
  let dragStartVal = 0

  function onPointerDown(e) {
    e.preventDefault()
    dragging = true
    dragStartY = e.clientY
    dragStartVal = parseFloat(((onChange._currentVal ?? value)))
    wrap.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e) {
    if (!dragging) return
    const dy = dragStartY - e.clientY
    const range = max - min
    const sensitivity = range / 120 // 120px of drag = full range
    let v = dragStartVal + dy * sensitivity
    v = Math.round(Math.min(max, Math.max(min, v)) / step) * step
    onChange._currentVal = v
    update(v)
    onChange(v)
  }
  function onPointerUp() {
    dragging = false
  }
  wrap.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)

  onChange._currentVal = value

  row.appendChild(wrap)
  row.appendChild(valSpan)
  row.appendChild(lbl)
  return row
}

function makeMatcapSphere(uniformAngle) {
  const SIZE = 128 // canvas pixels (2x for retina on 64px display)
  const R = SIZE / 2

  const wrap = document.createElement('div')
  wrap.className = 'cs-matcap'

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.style.cssText = 'width:64px;height:64px;display:block;'
  wrap.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  // Light position on hemisphere surface, normalized [-1..1]
  let lx = Math.cos(uniformAngle.value) * 0.6
  let ly = -Math.sin(uniformAngle.value) * 0.6

  function draw() {
    const img = ctx.createImageData(SIZE, SIZE)
    const data = img.data

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        // Normalized coords [-1, 1]
        const nx = (x - R) / (R - 1)
        const ny = (y - R) / (R - 1)
        const r2 = nx * nx + ny * ny

        if (r2 > 1.0) continue // outside sphere

        // Surface normal on unit hemisphere
        const nz = Math.sqrt(1.0 - r2)

        // Light direction from matcap position
        const lz = Math.sqrt(Math.max(0, 1.0 - lx * lx - ly * ly))
        const len = Math.sqrt(lx * lx + ly * ly + lz * lz)
        const Lx = lx / len, Ly = ly / len, Lz = lz / len

        // Diffuse (half-Lambert for softer wrap)
        const NdotL = nx * Lx + ny * Ly + nz * Lz
        const diffuse = NdotL * 0.5 + 0.5

        // Specular (Blinn-Phong)
        const Hx = Lx, Hy = Ly, Hz = Lz + 1.0
        const hLen = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz)
        const NdotH = (nx * Hx + ny * Hy + nz * Hz) / hLen
        const spec = Math.pow(Math.max(NdotH, 0), 40) * 0.9

        // Fresnel rim — brighter at glancing angles
        const fresnel = Math.pow(1.0 - nz, 3) * 0.25

        // Compose: dark base + blue-tinted diffuse + white spec + rim
        const base = 0.06
        const d = diffuse * diffuse // gamma-ish boost for depth
        const rr = base + d * 0.25 + spec * 0.9 + fresnel * 0.3
        const gg = base + d * 0.30 + spec * 0.95 + fresnel * 0.45
        const bb = base + d * 0.45 + spec * 1.0 + fresnel * 0.7

        // Edge softness — anti-alias the rim
        const edge = 1.0 - smoothClamp((Math.sqrt(r2) - 0.96) / 0.04)

        const i = (y * SIZE + x) * 4
        data[i]     = Math.min(255, (rr * 255) | 0) * edge
        data[i + 1] = Math.min(255, (gg * 255) | 0) * edge
        data[i + 2] = Math.min(255, (bb * 255) | 0) * edge
        data[i + 3] = edge * 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  function smoothClamp(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t) }

  draw()

  function updateFromPointer(e) {
    const rect = wrap.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width * 2 - 1
    const py = (e.clientY - rect.top) / rect.height * 2 - 1
    const dist = Math.sqrt(px * px + py * py)
    if (dist > 1.0) return

    lx = px * 0.7
    ly = py * 0.7
    // Shader uses atan2(sin, cos) with Y-up; screen Y is down
    uniformAngle.value = Math.atan2(-py, px)
    draw()
  }

  let dragging = false
  wrap.addEventListener('pointerdown', e => {
    e.preventDefault()
    dragging = true
    wrap.setPointerCapture(e.pointerId)
    updateFromPointer(e)
  })
  wrap.addEventListener('pointermove', e => {
    if (dragging) updateFromPointer(e)
  })
  wrap.addEventListener('pointerup', () => { dragging = false })
  wrap.addEventListener('lostpointercapture', () => { dragging = false })

  return wrap
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

// Rectangular position pad for radial/sweep center.
// Maps mouse to 0..1 for both axes. Double-click resets to 0.5.
function makePositionPad(unifX, unifY) {
  const pad = document.createElement('div')
  pad.className = 'cs-pos-pad'

  // Crosshair lines at center
  const crossH = document.createElement('div')
  crossH.className = 'cs-pos-crosshair cs-pos-crosshair-h'
  const crossV = document.createElement('div')
  crossV.className = 'cs-pos-crosshair cs-pos-crosshair-v'
  pad.appendChild(crossH)
  pad.appendChild(crossV)

  // 4 decorative corner dots
  for (const [l, t] of [['4px','4px'],['calc(100% - 8px)','4px'],['4px','calc(100% - 8px)'],['calc(100% - 8px)','calc(100% - 8px)']]) {
    const c = document.createElement('div')
    c.className = 'cs-pos-corner'
    c.style.left = l; c.style.top = t
    pad.appendChild(c)
  }

  // Draggable dot
  const dot = document.createElement('div')
  dot.className = 'cs-pos-dot'
  pad.appendChild(dot)

  function positionDot() {
    dot.style.left = (unifX.value * 100) + '%'
    dot.style.top = ((1 - unifY.value) * 100) + '%' // invert Y: UV 0=bottom, screen 0=top
  }

  function updateFromMouse(e) {
    const rect = pad.getBoundingClientRect()
    let nx = (e.clientX - rect.left) / rect.width
    let ny = 1 - (e.clientY - rect.top) / rect.height // invert Y
    nx = Math.max(0, Math.min(1, nx))
    ny = Math.max(0, Math.min(1, ny))
    unifX.value = nx
    unifY.value = ny
    positionDot()
  }

  let dragging = false
  pad.addEventListener('mousedown', e => { dragging = true; updateFromMouse(e); e.preventDefault() })
  window.addEventListener('mousemove', e => { if (dragging) updateFromMouse(e) })
  window.addEventListener('mouseup', () => { dragging = false })

  pad.addEventListener('dblclick', () => {
    unifX.value = 0.5; unifY.value = 0.5
    positionDot()
  })

  positionDot()
  return pad
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

function makeAdvanced(buildBody, label = 'Advanced') {
  const wrap = document.createElement('div')

  const toggle = document.createElement('div')
  toggle.className = 'cs-adv-toggle'
  toggle.innerHTML = `<div class="cs-adv-line"></div><span class="cs-adv-label">${label} ▼</span><div class="cs-adv-line"></div>`

  const body = document.createElement('div')
  body.className = 'cs-adv-body hidden'
  buildBody(body)

  let open = false
  toggle.addEventListener('click', () => {
    open = !open
    body.classList.toggle('hidden', !open)
    toggle.querySelector('.cs-adv-label').textContent = open ? `${label} ▲` : `${label} ▼`
  })

  wrap.appendChild(toggle)
  wrap.appendChild(body)
  return wrap
}

// ─── Single color picker ──────────────────────────────────────────────────────

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
  input.value = rgbToHex(v.x, v.y, v.z)
  input.addEventListener('input', () => {
    const [r, g, b] = hexToRGB(input.value)
    uniform.value.set(r, g, b)
  })

  if (_regLayer) {
    uiRegistry.push({ type: 'color', layer: _regLayer,
      set(hex) { input.value = hex; const [r, g, b] = hexToRGB(hex); uniform.value.set(r, g, b) }
    })
  }

  row.appendChild(lbl)
  row.appendChild(input)
  return row
}

// ─── Compact color ramp + popover ─────────────────────────────────────────────

function makeCompactRamp(initialStops, onRampChange, layerLabel, getOklab = () => false) {
  let stops = initialStops.map(s => ({ ...s }))

  const wrap = document.createElement('div')
  wrap.className = 'cs-ramp-compact'

  const bar = document.createElement('div')
  bar.className = 'cs-ramp-bar'
  bar.style.background = stopsToGradient(stops, getOklab())

  const editBtn = document.createElement('button')
  editBtn.className = 'cs-ramp-edit'
  editBtn.textContent = 'Edit'

  wrap.appendChild(bar)
  wrap.appendChild(editBtn)

  // Build popover (appended to body so it escapes panel overflow)
  const popover = buildRampPopover(layerLabel, stops, newStops => {
    stops = newStops
    bar.style.background = stopsToGradient(stops, getOklab())
    onRampChange(stops)
  }, getOklab)
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

  // Allow external sync when oklab toggle changes — refreshes both gradient bars
  wrap._syncOklab = () => {
    bar.style.background = stopsToGradient(stops, getOklab())
    if (popover._syncOklab) popover._syncOklab()
  }

  if (_regLayer) {
    uiRegistry.push({ type: 'ramp', layer: _regLayer,
      set(newStops) {
        stops = newStops.map(s => ({ ...s }))
        bar.style.background = stopsToGradient(stops, getOklab())
        onRampChange(stops)
      }
    })
  }

  return wrap
}

function buildRampPopover(layerLabel, initialStops, onRampChange, getOklab = () => false) {
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
    bar.style.background = stopsToGradient(stops, getOklab())
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
    bar.style.background = stopsToGradient([...stops].sort((a, b) => a.pos - b.pos), getOklab())
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
    bar.style.background = stopsToGradient(stops, getOklab())
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
        bar.style.background = stopsToGradient(stops, getOklab())
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
    stops.push({ pos, color: lerpStops(stops, pos, getOklab()) })
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
    stops.push({ pos: insertPos, color: lerpStops(stops, insertPos, getOklab()) })
    stops.sort((a, b) => a.pos - b.pos)
    redraw()
    onRampChange(stops)
  })

  // Allow external refresh when oklab mode changes
  popover._syncOklab = () => redraw()

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
    const curveRow = makeSlider('curve', 0.2, 5, u.uCurve.value, 0.1,
      v => { u.uCurve.value = v })

    // Linear-specific group: motion type, direction, curve, relief 3D
    const linearGroup = document.createElement('div')
    linearGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    // Motion type pills: Slide | Cloth
    const motionRow = document.createElement('div')
    motionRow.className = 'cs-field-row'
    const motionLbl = document.createElement('span')
    motionLbl.className = 'cs-field-label'
    motionLbl.textContent = 'Type'
    const motionPills = document.createElement('div')
    motionPills.className = 'cs-pills'

    const slidePill = document.createElement('button')
    slidePill.className = 'cs-pill'
    slidePill.textContent = 'Slide'
    const clothPill = document.createElement('button')
    clothPill.className = 'cs-pill'
    clothPill.textContent = 'Cloth'
    const liquidPill = document.createElement('button')
    liquidPill.className = 'cs-pill'
    liquidPill.textContent = 'Liquid'
    // Slide-specific: band count
    const countRow = makeSlider('count', 0.5, 10, u.uLinearCount.value, 0.1,
      v => { u.uLinearCount.value = v })

    // Cloth-specific sliders
    const foldRow = makeSlider('fold', 0.3, 3, u.uClothScale.value, 0.01,
      v => { u.uClothScale.value = v })
    const clothDetailRow = makeSlider('detail', 0, 1, u.uClothDetail.value, 0.01,
      v => { u.uClothDetail.value = v })
    const liquidDetailRow = makeSlider('detail', 0, 0.3, Math.min(u.uClothDetail.value, 0.3), 0.01,
      v => { u.uClothDetail.value = v })

    function syncLinearMotion() {
      const m = u.uLinearMotion.value
      slidePill.classList.toggle('active', m === 0)
      clothPill.classList.toggle('active', m === 1)
      liquidPill.classList.toggle('active', m === 2)
      // Slide: curve + count. Cloth: fold + detail. Liquid: fold + detail.
      curveRow.style.display        = m === 0 ? '' : 'none'
      countRow.style.display        = m === 0 ? '' : 'none'
      foldRow.style.display         = m >= 1 ? '' : 'none'
      clothDetailRow.style.display  = m === 1 ? '' : 'none'
      liquidDetailRow.style.display = m === 2 ? '' : 'none'
      dirRow.style.display          = m === 2 ? 'none' : ''
    }
    slidePill.addEventListener('click', () => { u.uLinearMotion.value = 0; syncLinearMotion() })
    clothPill.addEventListener('click', () => { u.uLinearMotion.value = 1; syncLinearMotion() })
    liquidPill.addEventListener('click', () => { u.uLinearMotion.value = 2; syncLinearMotion() })
    motionPills.appendChild(slidePill)
    motionPills.appendChild(clothPill)
    motionPills.appendChild(liquidPill)
    motionRow.appendChild(motionLbl)
    motionRow.appendChild(motionPills)

    linearGroup.appendChild(motionRow)
    linearGroup.appendChild(dirRow)
    linearGroup.appendChild(curveRow)
    linearGroup.appendChild(countRow)
    linearGroup.appendChild(foldRow)
    linearGroup.appendChild(clothDetailRow)
    linearGroup.appendChild(liquidDetailRow)
    syncLinearMotion()

    // Relief 3D toggle + detail sliders
    const reliefRow = document.createElement('div')
    reliefRow.className = 'cs-field-row'
    const reliefLbl = document.createElement('span')
    reliefLbl.className = 'cs-field-label'
    reliefLbl.textContent = 'Relief'
    reliefRow.appendChild(reliefLbl)

    const reliefDetails = document.createElement('div')
    reliefDetails.style.cssText = 'display:none;flex-direction:column;gap:8px;'
    reliefDetails.appendChild(makeSlider('shadow', 0, 1, u.uShadowDepth.value, 0.01,
      v => { u.uShadowDepth.value = v }))
    reliefDetails.appendChild(makeSlider('light angle°', 0, 360, Math.round(u.uLightAngle.value * 180 / Math.PI), 1,
      v => { u.uLightAngle.value = v * Math.PI / 180 }))
    reliefDetails.appendChild(makeSingleColor('light color', u.uLightColor))

    function syncRelief() {
      const on = u.uRipple.value > 0.0
      reliefDetails.style.display = on ? 'flex' : 'none'
    }

    reliefRow.appendChild(makeToggle(u.uRipple.value > 0, v => {
      u.uRipple.value = v ? 1.0 : 0.0
      syncRelief()
    }))

    linearGroup.appendChild(reliefRow)
    linearGroup.appendChild(reliefDetails)
    syncRelief()

    // Matcap light sphere (created early — syncRipple references it)
    const matcapSphere = makeMatcapSphere(u.uLightAngle)
    matcapSphere.style.display = 'none'

    // Radial-specific controls: ripple toggle + compact 3D controls
    const radialGroup = document.createElement('div')
    radialGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    // Ripple on/off toggle row
    const rippleRow = document.createElement('div')
    rippleRow.className = 'cs-field-row'
    const rippleLbl = document.createElement('span')
    rippleLbl.className = 'cs-field-label'
    rippleLbl.textContent = 'Ripple 3D'
    rippleRow.appendChild(rippleLbl)

    // Ripple detail controls (shown when toggle is on)
    const rippleDetails = document.createElement('div')
    rippleDetails.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    const rippleKnobs = document.createElement('div')
    rippleKnobs.className = 'cs-knob-pair'
    rippleKnobs.appendChild(makeKnob('count', 1, 20, u.uRippleCount.value, 0.1,
      v => { u.uRippleCount.value = v }))
    rippleKnobs.appendChild(makeKnob('compress', 0.01, 20, u.uRippleCompress.value, 0.1,
      v => { u.uRippleCompress.value = v }))
    rippleKnobs.appendChild(makeKnob('shadow', 0, 1, u.uShadowDepth.value, 0.01,
      v => { u.uShadowDepth.value = v }))
    rippleDetails.appendChild(rippleKnobs)

    function syncRipple() {
      const on = u.uRipple.value > 0.0
      rippleDetails.style.display = on ? 'flex' : 'none'
      matcapSphere.style.display = (on && u.uMode.value === 0) ? '' : 'none'
    }

    rippleRow.appendChild(makeToggle(u.uRipple.value > 0, v => {
      u.uRipple.value = v ? 1.0 : 0.0
      syncRipple()
    }))

    radialGroup.appendChild(rippleRow)
    radialGroup.appendChild(rippleDetails)
    syncRipple()

    // Sweep-specific controls
    const sweepGroup = document.createElement('div')
    sweepGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
    sweepGroup.appendChild(makeSlider('softness', 0, 1, 0.5, 0.01,
      v => { u.uDriftAngle.value = v * 6.28318 }))
    sweepGroup.appendChild(makeSlider('seam', 0, 1, u.uSweepSeam.value, 0.01,
      v => { u.uSweepSeam.value = v }))
    sweepGroup.appendChild(makeSlider('center', 0, 1, u.uSweepCenter.value, 0.01,
      v => { u.uSweepCenter.value = v }))

    // Hypnotic-specific controls
    const hypnoticGroup = document.createElement('div')
    hypnoticGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    // Horizontal row: position pad + knobs
    const hypDashboard = document.createElement('div')
    hypDashboard.style.cssText = 'display:flex;align-items:center;gap:12px;'
    const hypPosPad = makePositionPad(u.uCenterX, u.uCenterY)
    hypDashboard.appendChild(hypPosPad)
    const knobPair = document.createElement('div')
    knobPair.className = 'cs-knob-pair'
    knobPair.appendChild(makeKnob('twist', 0.3, 3, u.uClothScale.value, 0.01,
      v => { u.uClothScale.value = v }))
    knobPair.appendChild(makeKnob('detail', 0, 0.3, Math.min(u.uClothDetail.value, 0.3), 0.01,
      v => { u.uClothDetail.value = v }))
    hypDashboard.appendChild(knobPair)
    hypnoticGroup.appendChild(hypDashboard)



    function syncMode() {
      const mode = u.uMode.value
      radial_.classList.toggle('active', mode === 0)
      linear_.classList.toggle('active', mode === 1)
      sweep_.classList.toggle('active', mode === 2)
      hypnotic_.classList.toggle('active', mode === 3)
      radialGroup.style.display   = mode === 0 ? 'flex' : 'none'
      linearGroup.style.display   = mode === 1 ? 'flex' : 'none'
      sweepGroup.style.display    = mode === 2 ? 'flex' : 'none'
      hypnoticGroup.style.display = mode === 3 ? 'flex' : 'none'
      speedRow.style.display = mode === 3 ? 'none' : ''
      posPad.style.display = (mode === 0 || mode === 2) ? '' : 'none'
      matcapSphere.style.display = (mode === 0 && u.uRipple.value > 0) ? '' : 'none'
    }

    const radial_ = document.createElement('button')
    radial_.className = 'cs-pill'
    radial_.textContent = 'Radial'
    radial_.addEventListener('click', () => { u.uMode.value = 0; syncMode() })

    const linear_ = document.createElement('button')
    linear_.className = 'cs-pill'
    linear_.textContent = 'Linear'
    linear_.addEventListener('click', () => { u.uMode.value = 1; syncMode() })

    const sweep_ = document.createElement('button')
    sweep_.className = 'cs-pill'
    sweep_.textContent = 'Sweep'
    sweep_.addEventListener('click', () => { u.uMode.value = 2; syncMode() })

    const hypnotic_ = document.createElement('button')
    hypnotic_.className = 'cs-pill'
    hypnotic_.textContent = 'Hypnotic'
    hypnotic_.addEventListener('click', () => { u.uMode.value = 3; syncMode() })

    pills.appendChild(radial_)
    pills.appendChild(linear_)
    pills.appendChild(sweep_)
    pills.appendChild(hypnotic_)
    modeRow.appendChild(modeLbl)
    modeRow.appendChild(pills)
    body.appendChild(modeRow)

    // Position pad + matcap light sphere
    const posPad = makePositionPad(u.uCenterX, u.uCenterY)

    const padRow = document.createElement('div')
    padRow.className = 'cs-pad-row'
    padRow.appendChild(matcapSphere)
    padRow.appendChild(posPad)

    const speedRow = makeSlider('speed', 0.05, 2, u.uSpeed.value, 0.01, v => { u.uSpeed.value = v })
    body.appendChild(speedRow)
    body.appendChild(padRow)
    body.appendChild(radialGroup)
    body.appendChild(linearGroup)
    body.appendChild(sweepGroup)
    body.appendChild(hypnoticGroup)

    // Color mix mode: sRGB vs Oklab interpolation
    const mixRow = document.createElement('div')
    mixRow.className = 'cs-field-row'
    const mixLbl = document.createElement('span')
    mixLbl.className = 'cs-field-label'
    mixLbl.textContent = 'Color mix'
    const mixPills = document.createElement('div')
    mixPills.className = 'cs-pills'

    const srgbPill = document.createElement('button')
    srgbPill.className = 'cs-pill'
    srgbPill.textContent = 'sRGB'
    const oklabPill = document.createElement('button')
    oklabPill.className = 'cs-pill'
    oklabPill.textContent = 'Oklab'

    function syncMix() {
      const ok = u.uOklab.value
      srgbPill.classList.toggle('active', !ok)
      oklabPill.classList.toggle('active', ok)
      // Notify ramp widget so gradient bars update
      if (rampWidget && rampWidget._syncOklab) rampWidget._syncOklab()
    }
    srgbPill.addEventListener('click', () => { u.uOklab.value = false; syncMix() })
    oklabPill.addEventListener('click', () => { u.uOklab.value = true; syncMix() })

    mixPills.appendChild(srgbPill)
    mixPills.appendChild(oklabPill)
    mixRow.appendChild(mixLbl)
    mixRow.appendChild(mixPills)
    body.appendChild(mixRow)

    // Compact color ramp
    const rampWidget = makeCompactRamp(stopsFromUniforms(u), stops => applyRamp(stops, u), label, () => u.uOklab.value)
    body.appendChild(rampWidget)
    syncMix()

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

      // Burst-only controls
      const burstGroup = document.createElement('div')
      burstGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      burstGroup.appendChild(makeSlider('radial count', 1, 32, ub.uRaySpread.value, 1, v => { ub.uRaySpread.value = v }))

      // Orbit-only controls (center position)
      const orbitGroup = document.createElement('div')
      orbitGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      orbitGroup.appendChild(makeSlider('spacing',  1, 20, ub.uSpacing.value, 0.1, v => { ub.uSpacing.value = v }))
      orbitGroup.appendChild(makePositionPad(ub.uBurstCenterX, ub.uBurstCenterY))

      // Fan-only controls (origin grid + spacing)
      const fanGroup = document.createElement('div')
      fanGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      fanGroup.appendChild(makeSlider('spacing',  1, 20, ub.uSpacing.value, 0.1, v => { ub.uSpacing.value = v }))

      // Origin grid — visual 3x3 cell grid for VP selection
      const originGrid = document.createElement('div')
      originGrid.className = 'cs-origin-grid'

      // 8 perimeter positions + 1 center (decorative), row-major order
      const origins = [
        { id: 'TL', x: 0,   y: 1,   angle: -Math.PI * 0.25 },
        { id: 'T',  x: 0.5, y: 1,   angle: -Math.PI * 0.5 },
        { id: 'TR', x: 1,   y: 1,   angle: -Math.PI * 0.75 },
        { id: 'L',  x: 0,   y: 0.5, angle: 0 },
        { id: 'C',  x: 0.5, y: 0.5, angle: 0, center: true },
        { id: 'R',  x: 1,   y: 0.5, angle: Math.PI },
        { id: 'BL', x: 0,   y: 0,   angle: Math.PI * 0.25 },
        { id: 'B',  x: 0.5, y: 0,   angle: Math.PI * 0.5 },
        { id: 'BR', x: 1,   y: 0,   angle: Math.PI * 0.75 },
      ]
      let activeOrigin = 'BL'
      const originCells = []
      for (const o of origins) {
        const cell = document.createElement('div')
        cell.className = 'cs-origin-cell' + (o.center ? ' center' : '') + (o.id === activeOrigin ? ' active' : '')
        const pip = document.createElement('div')
        pip.className = 'cs-origin-pip'
        cell.appendChild(pip)
        if (!o.center) {
          cell.addEventListener('click', () => {
            activeOrigin = o.id
            ub.uBurstCenterX.value = o.x
            ub.uBurstCenterY.value = o.y
            ub.uAngle.value = o.angle
            originCells.forEach(c => c.classList.remove('active'))
            cell.classList.add('active')
          })
        }
        originGrid.appendChild(cell)
        originCells.push(cell)
      }

      fanGroup.appendChild(originGrid)

      function syncBandsMode() {
        const m = ub.uBandsMode.value
        parallel_.classList.toggle('active', m === 0)
        burst_.classList.toggle('active', m === 1)
        orbit_.classList.toggle('active', m === 2)
        fan_.classList.toggle('active', m === 3)
        parallelGroup.style.display = m === 0 ? 'flex' : 'none'
        burstGroup.style.display    = m === 1 ? 'flex' : 'none'
        orbitGroup.style.display    = m === 2 ? 'flex' : 'none'
        fanGroup.style.display      = m === 3 ? 'flex' : 'none'
        spiralGroup.style.display   = m === 4 ? 'flex' : 'none'
        spiral_.classList.toggle('active', m === 4)
        // Mode-specific visibility
        const isFan    = m === 3
        const isBurst  = m === 1
        const isSpiral = m === 4
        angleRow.style.display = (isFan || isBurst || isSpiral) ? 'none' : ''
        // Fan hides a subset of glass rows
        if (isFan) fanHiddenRows.forEach(r => { r.style.display = 'none' })
        // Burst hides: distort, softness, blur, roughness, thickness, invertRow, non-uniform
        if (isBurst) {
          distortRow.style.display = 'none'
          invertRow.style.display = 'none'
          nonUniformRow.style.display = 'none'
          thicknessRow.style.display = 'none'
          softnessRow.style.display = 'none'
          blurRow.style.display = 'none'
          roughnessRow.style.display = 'none'
        }
        // Orbit hides: distort, blur, softness, roughness + force softness to 1
        const isOrbit = m === 2
        if (isOrbit) {
          distortRow.style.display = 'none'
          blurRow.style.display = 'none'
          softnessRow.style.display = 'none'
          roughnessRow.style.display = 'none'
          ub.uSoftness.value = 1.0
        }
        // Non-uniform: only for parallel, fan, and spiral
        if (!isBurst) {
          nonUniformRow.style.display = (m === 0 || isFan || isSpiral) ? '' : 'none'
        }
      }

      const parallel_ = document.createElement('button')
      parallel_.className = 'cs-pill'
      parallel_.textContent = 'Parallel'
      parallel_.addEventListener('click', () => { ub.uBandsMode.value = 0; syncBandsMode() })

      const burst_ = document.createElement('button')
      burst_.className = 'cs-pill'
      burst_.textContent = 'Burst'
      burst_.addEventListener('click', () => { ub.uBandsMode.value = 1; syncBandsMode() })

      const orbit_ = document.createElement('button')
      orbit_.className = 'cs-pill'
      orbit_.textContent = 'Orbit'
      orbit_.addEventListener('click', () => { ub.uBandsMode.value = 2; syncBandsMode() })

      const fan_ = document.createElement('button')
      fan_.className = 'cs-pill'
      fan_.textContent = 'Fan'
      fan_.addEventListener('click', () => {
        ub.uBandsMode.value = 3
        // Apply the active origin VP + angle
        const o = origins.find(o => o.id === activeOrigin)
        if (o) {
          ub.uBurstCenterX.value = o.x
          ub.uBurstCenterY.value = o.y
          ub.uAngle.value = o.angle
        }
        syncBandsMode()
      })

      const spiral_ = document.createElement('button')
      spiral_.className = 'cs-pill'
      spiral_.textContent = 'Spiral'
      spiral_.addEventListener('click', () => { ub.uBandsMode.value = 4; syncBandsMode() })

      // Spiral-only controls (spacing + center)
      const spiralGroup = document.createElement('div')
      spiralGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      spiralGroup.appendChild(makeSlider('spacing', 1, 20, ub.uSpacing.value, 0.1, v => { ub.uSpacing.value = v }))
      spiralGroup.appendChild(makePositionPad(ub.uBurstCenterX, ub.uBurstCenterY))

      modePills.appendChild(parallel_)
      modePills.appendChild(burst_)
      modePills.appendChild(orbit_)
      modePills.appendChild(fan_)
      modePills.appendChild(spiral_)
      modeRow.appendChild(modeLbl)
      modeRow.appendChild(modePills)
      sub.appendChild(modeRow)
      sub.appendChild(parallelGroup)
      sub.appendChild(burstGroup)
      sub.appendChild(orbitGroup)
      sub.appendChild(fanGroup)
      sub.appendChild(spiralGroup)

      // Invert pills: Normal | Invert | Both — shared by both modes
      const invertRow = document.createElement('div')
      invertRow.className = 'cs-field-row'
      const invertLbl = document.createElement('span')
      invertLbl.className = 'cs-field-label'
      invertLbl.textContent = 'Fill'
      const invertPills = document.createElement('div')
      invertPills.className = 'cs-pills'
      const invertNames = ['Normal', 'Invert', 'Both']
      const invertBtns = invertNames.map((name, i) => {
        const btn = document.createElement('button')
        btn.className = 'cs-pill' + (ub.uBandInvert.value === i ? ' active' : '')
        btn.textContent = name
        btn.addEventListener('click', () => { ub.uBandInvert.value = i; syncInvert() })
        invertPills.appendChild(btn)
        return btn
      })
      function syncInvert() {
        invertBtns.forEach((btn, i) => btn.classList.toggle('active', ub.uBandInvert.value === i))
      }
      invertRow.appendChild(invertLbl)
      invertRow.appendChild(invertPills)
      sub.appendChild(invertRow)

      // Speed, distortion, and Glass — shared by most modes
      const speedRow   = makeSlider('speed', 0, 2, ub.uSpeed.value, 0.01, v => { ub.uSpeed.value = v })
      const distortRow = makeSlider('distort', 0, 1, ub.uDistort.value, 0.01, v => { ub.uDistort.value = v })
      sub.appendChild(speedRow)
      sub.appendChild(distortRow)

      // Non-uniform toggle + seed button
      const nonUniformRow = document.createElement('div')
      nonUniformRow.className = 'cs-field-row'
      nonUniformRow.style.cssText = 'display:flex;align-items:center;gap:6px;'
      const nuLbl = document.createElement('span')
      nuLbl.className = 'cs-field-label'
      nuLbl.textContent = 'Non-uniform'
      nonUniformRow.appendChild(nuLbl)
      nonUniformRow.appendChild(makeToggle(ub.uBandRandom.value === 1, v => {
        ub.uBandRandom.value = v ? 1 : 0
        nuSeedBtn.style.display = v ? '' : 'none'
      }))
      const nuSeedBtn = document.createElement('button')
      nuSeedBtn.className = 'cs-pill'
      nuSeedBtn.textContent = 'seed'
      nuSeedBtn.style.display = ub.uBandRandom.value === 1 ? '' : 'none'
      nuSeedBtn.addEventListener('click', () => {
        ub.uBandSeed.value = Math.floor(Math.random() * 100)
      })
      nonUniformRow.appendChild(nuSeedBtn)
      sub.appendChild(nonUniformRow)

      // Angle slider — hidden in fan mode (origin grid controls angle)
      const angleRow = makeSlider('angle°', 0, 360, Math.round(ub.uAngle.value * 180 / Math.PI), 1, v => { ub.uAngle.value = v * Math.PI / 180 })

      // Glass controls — some hidden in fan mode
      const thicknessRow  = makeSlider('thickness',       0,    1,   ub.uThickness.value,      0.01, v => { ub.uThickness.value      = v })
      const softnessRow   = makeSlider('softness',        0.01, 1,   ub.uSoftness.value,       0.01, v => { ub.uSoftness.value       = v })
      const blurRow       = makeSlider('blur',            0,    1,   ub.uBlur.value,           0.01, v => { ub.uBlur.value           = v })
      const highlightRow  = makeSlider('highlight',       0,    2,   ub.uBevelIntensity.value, 0.01, v => { ub.uBevelIntensity.value = v })
      const hlSpreadRow   = makeSlider('highlight spread',0,    1,   ub.uBevelWidth.value,     0.01, v => { ub.uBevelWidth.value     = v })
      const roughnessRow  = makeSlider('roughness',        0,    1,   ub.uRoughness.value,      0.01, v => { ub.uRoughness.value      = v })
      const tintColorRow  = makeSingleColor('tint color', ub.uTintColor)
      const tintStrRow    = makeSlider('tint strength',   0,    1,   ub.uTintStrength.value,   0.01, v => { ub.uTintStrength.value   = v })
      const fanHiddenRows = [thicknessRow, softnessRow, blurRow, highlightRow, hlSpreadRow, roughnessRow, tintColorRow, tintStrRow]
      const tiltPadRow = makeTiltPad(ub.uTilt, ub.uTilt2, ub.uTiltZ)

      sub.appendChild(makeAdvanced(adv => {
        adv.appendChild(angleRow)
        adv.appendChild(tiltPadRow)
        adv.appendChild(makeSlider('IOR',             1.0,  3.0, ub.uIOR.value,            0.01, v => { ub.uIOR.value            = v }))
        adv.appendChild(makeSlider('fresnel',         0,    1,   ub.uFresnel.value,        0.01, v => { ub.uFresnel.value        = v }))
        adv.appendChild(thicknessRow)
        adv.appendChild(softnessRow)
        adv.appendChild(blurRow)
        adv.appendChild(highlightRow)
        adv.appendChild(hlSpreadRow)
        adv.appendChild(roughnessRow)
        adv.appendChild(tintColorRow)
        adv.appendChild(tintStrRow)
      }, 'Glass'))

      syncBandsMode()
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

    const uLens = uniforms.lens
    _regLayer = 'lens'
    body.appendChild(makeSubsection('Lens', uLens, sub => {
      sub.appendChild(makeSlider('barrel', -1, 0, uLens.uBarrel.value, 0.01,
        v => { uLens.uBarrel.value = v }))
      sub.appendChild(makeSlider('chromatic', 0, 0.02, uLens.uChromaAberr.value, 0.001,
        v => { uLens.uChromaAberr.value = v }))
      sub.appendChild(makeSlider('vignette', 0, 1, uLens.uVignetteStr.value, 0.01,
        v => { uLens.uVignetteStr.value = v }))
      sub.appendChild(makeAdvanced(adv => {
        adv.appendChild(makeSlider('softness', 0, 1, uLens.uVignetteSoft.value, 0.01,
          v => { uLens.uVignetteSoft.value = v }))
      }))
    }))
    _regLayer = null

    // Global monochrome toggle — applies on top of everything
    const monoRow = document.createElement('div')
    monoRow.className = 'cs-field-row'
    const monoLbl = document.createElement('span')
    monoLbl.className = 'cs-field-label'
    monoLbl.textContent = 'Mono'
    monoRow.appendChild(monoLbl)
    monoRow.appendChild(makeToggle(u.uMono.value, v => { u.uMono.value = v }))
    body.appendChild(monoRow)
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

// Parse hex to [0..1] without Three.js color management (no sRGB→linear).
// ShaderMaterial doesn't inject sRGB output encoding, so uniforms store sRGB directly.
function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function applyRamp(stops, u) {
  stops.forEach((s, i) => {
    const [r, g, b] = hexToRGB(s.color)
    u.uRampColors.value[i * 3]     = r
    u.uRampColors.value[i * 3 + 1] = g
    u.uRampColors.value[i * 3 + 2] = b
    u.uRampPositions.value[i]      = s.pos
  })
  u.uRampCount.value = stops.length
}

// ─── JS Oklab conversion (matches GLSL implementation) ───────────────────────

function srgbChannelToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgbChannel(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055
}

function rgbToOklab(r, g, b) {
  const lr = srgbChannelToLinear(r), lg = srgbChannelToLinear(g), lb = srgbChannelToLinear(b)
  let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  l = Math.cbrt(Math.max(l, 0)); m = Math.cbrt(Math.max(m, 0)); s = Math.cbrt(Math.max(s, 0))
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

function oklabToRgb(L, a, b) {
  let l = L + 0.3963377774 * a + 0.2158037573 * b
  let m = L - 0.1055613458 * a - 0.0638541728 * b
  let s = L - 0.0894841775 * a - 1.2914855480 * b
  l = l * l * l; m = m * m * m; s = s * s * s
  const r = linearToSrgbChannel( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const g = linearToSrgbChannel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const bl = linearToSrgbChannel(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
  return [Math.min(Math.max(r, 0), 1), Math.min(Math.max(g, 0), 1), Math.min(Math.max(bl, 0), 1)]
}

function lerpHex(a, b, t, oklab = false) {
  const [ar, ag, ab] = hexToRGB(a)
  const [br, bg, bb] = hexToRGB(b)
  if (oklab) {
    const labA = rgbToOklab(ar, ag, ab)
    const labB = rgbToOklab(br, bg, bb)
    const [r, g, bl] = oklabToRgb(
      labA[0] + (labB[0] - labA[0]) * t,
      labA[1] + (labB[1] - labA[1]) * t,
      labA[2] + (labB[2] - labA[2]) * t,
    )
    return rgbToHex(r, g, bl)
  }
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function lerpStops(stops, t, oklab = false) {
  if (stops.length === 0) return '#ffffff'
  if (t <= stops[0].pos) return stops[0].color
  if (t >= stops[stops.length - 1].pos) return stops[stops.length - 1].color
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].pos) {
      const span = stops[i].pos - stops[i - 1].pos
      const f    = span > 0 ? (t - stops[i - 1].pos) / span : 0
      return lerpHex(stops[i - 1].color, stops[i].color, f, oklab)
    }
  }
  return stops[stops.length - 1].color
}

function rgbToHex(r, g, b) {
  const h = v => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return rgbToHex(f(0), f(8), f(4))
}

function stopsToGradient(stops, oklab = false) {
  const colorStops = stops.map(s => `${s.color} ${(s.pos * 100).toFixed(1)}%`).join(', ')
  // CSS Color Level 4: 'in oklab' makes the browser interpolate in Oklab space,
  // matching the shader's perceptual interpolation so the preview bar is accurate.
  if (oklab) return `linear-gradient(in oklab to right, ${colorStops})`
  return `linear-gradient(to right, ${colorStops})`
}
