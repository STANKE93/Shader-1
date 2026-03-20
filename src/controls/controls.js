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

    /* Speed bar — segmented parallelogram meter */
    .cs-speed-row {
      display: flex;
      align-items: center; gap: 5px;
    }
    .cs-speed-row .cs-slider-label { width: 86px; flex-shrink: 0; }
    .cs-speed-row .cs-seed-btn + .cs-slider-label { width: auto; }
    .cs-speed-row .cs-speed-pct { width: 32px; flex-shrink: 0; }
    .cs-speed-bar {
      display: flex; gap: 1.5px; height: 12px; cursor: pointer;
      user-select: none; flex: 1; min-width: 0;
    }
    .cs-speed-seg {
      flex: 1; border-radius: 1.5px;
      transform: skewX(-12deg);
      background: rgba(255,255,255,0.08);
      transition: background 0.1s;
    }
    .cs-speed-seg.on {
      background: var(--seg-color, rgba(91, 156, 245, 0.7));
    }
    .cs-speed-pct {
      font-size: 11px; color: rgba(255,255,255,0.30);
      text-align: right; font-variant-numeric: tabular-nums;
    }
    .cs-seed-btn {
      font: 9px/1 inherit; letter-spacing: 0.06em; text-transform: uppercase;
      color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10); border-radius: 4px;
      padding: 3px 6px; cursor: pointer; white-space: nowrap;
      transition: color 0.12s, background 0.12s, border-color 0.12s;
    }
    .cs-seed-btn:hover {
      color: rgba(255,255,255,0.7); background: rgba(91,156,245,0.12);
      border-color: rgba(91,156,245,0.3);
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
    /* Color palette — single row: 2 main + separator + 4 extras */
    .cs-palette-row {
      display: flex; gap: 5px; align-items: center;
    }
    .cs-palette-sep {
      width: 1px; height: 18px; background: rgba(255,255,255,0.10);
      margin: 0 2px; flex-shrink: 0;
    }
    .cs-palette-swatch {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.18);
      cursor: pointer; position: relative;
      transition: opacity 0.15s, border-color 0.15s, transform 0.12s;
      box-sizing: border-box; flex-shrink: 0;
    }
    .cs-palette-swatch.main { width: 26px; height: 26px; border-color: rgba(255,255,255,0.30); }
    .cs-palette-swatch:hover { transform: scale(1.12); border-color: rgba(255,255,255,0.45); }
    .cs-palette-swatch.disabled { opacity: 0.28; border-style: dashed; }
    .cs-palette-swatch.disabled:hover { opacity: 0.45; }
    .cs-palette-toggle {
      position: absolute; bottom: -3px; right: -3px;
      width: 10px; height: 10px; border-radius: 50%;
      background: rgba(12, 13, 18, 0.9);
      border: 1.5px solid rgba(255,255,255,0.25);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 6px; color: rgba(255,255,255,0.6); line-height: 1;
      transition: background 0.12s, border-color 0.12s;
      box-sizing: border-box;
    }
    .cs-palette-toggle:hover { border-color: rgba(91, 156, 245, 0.6); }
    .cs-palette-toggle.off { color: rgba(255,255,255,0.25); }
    .cs-palette-swatch input[type="color"] {
      position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;
    }

    /* Color input row */
    .cs-color-row { display: grid; grid-template-columns: 86px 1fr; align-items: center; gap: 7px; }
    .cs-color-input {
      width: 100%; height: 22px; border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer;
      padding: 0; background: none;
    }

    /* Knob */
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

    /* ── Render overlay ─────────────────────────────────────────────────── */
    @keyframes cs-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes cs-pulse-border {
      0%, 100% { border-color: rgba(120, 80, 255, 0.25); }
      50%      { border-color: rgba(120, 80, 255, 0.6); }
    }
    @keyframes cs-fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes cs-fade-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    .cs-render-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      animation: cs-fade-in 0.3s ease-out;
    }
    .cs-render-overlay.done {
      animation: cs-fade-out 0.8s ease-in 1.5s forwards;
    }
    .cs-render-card {
      width: 340px; padding: 32px 36px;
      background: linear-gradient(135deg, rgba(18, 18, 28, 0.95), rgba(28, 22, 42, 0.95));
      border: 1px solid rgba(120, 80, 255, 0.3);
      border-radius: 16px;
      text-align: center;
      animation: cs-fade-in 0.4s ease-out, cs-pulse-border 3s ease-in-out infinite;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(120, 80, 255, 0.08);
    }
    .cs-render-shimmer {
      height: 3px; margin: 20px 0 16px;
      border-radius: 2px; overflow: hidden;
      background: rgba(255, 255, 255, 0.06);
    }
    .cs-render-shimmer-inner {
      height: 100%; width: 100%;
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(120, 80, 255, 0.5) 30%,
        rgba(200, 160, 255, 0.8) 50%,
        rgba(120, 80, 255, 0.5) 70%,
        transparent 100%);
      background-size: 200% 100%;
      animation: cs-shimmer 2s ease-in-out infinite;
    }
    .cs-render-progress {
      height: 4px; margin: 0 0 18px;
      border-radius: 2px; overflow: hidden;
      background: rgba(255, 255, 255, 0.06);
    }
    .cs-render-progress-fill {
      height: 100%; width: 0%;
      border-radius: 2px;
      background: linear-gradient(90deg, #7850ff, #b388ff);
      transition: width 0.3s ease-out;
    }
    .cs-render-title {
      font: 600 15px/1.3 'Inter', 'SF Pro Text', -apple-system, system-ui, sans-serif;
      color: rgba(255, 255, 255, 0.92);
      letter-spacing: 0.5px;
    }
    .cs-render-sub {
      font: 400 11px/1.4 'Inter', 'SF Pro Text', -apple-system, system-ui, sans-serif;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 4px;
    }
    .cs-render-percent {
      font: 500 26px/1 'Inter', 'SF Pro Text', -apple-system, system-ui, sans-serif;
      color: rgba(200, 170, 255, 0.9);
      margin-top: 12px;
      letter-spacing: 1px;
    }
    .cs-render-done-title {
      font: 600 17px/1.3 'Inter', 'SF Pro Text', -apple-system, system-ui, sans-serif;
      color: rgba(180, 160, 255, 1);
      letter-spacing: 0.3px;
    }
  `
  document.head.appendChild(s)
}

// ─── Render overlay ──────────────────────────────────────────────────────────

function createRenderOverlay() {
  const overlay = document.createElement('div')
  overlay.className = 'cs-render-overlay'

  const card = document.createElement('div')
  card.className = 'cs-render-card'

  const title = document.createElement('div')
  title.className = 'cs-render-title'
  title.textContent = 'Rendering…'

  const sub = document.createElement('div')
  sub.className = 'cs-render-sub'
  sub.textContent = 'be patient, this takes a moment'

  const shimmer = document.createElement('div')
  shimmer.className = 'cs-render-shimmer'
  const shimmerInner = document.createElement('div')
  shimmerInner.className = 'cs-render-shimmer-inner'
  shimmer.appendChild(shimmerInner)

  const progressBar = document.createElement('div')
  progressBar.className = 'cs-render-progress'
  const progressFill = document.createElement('div')
  progressFill.className = 'cs-render-progress-fill'
  progressBar.appendChild(progressFill)

  const percent = document.createElement('div')
  percent.className = 'cs-render-percent'
  percent.textContent = '0%'

  card.appendChild(title)
  card.appendChild(sub)
  card.appendChild(shimmer)
  card.appendChild(progressBar)
  card.appendChild(percent)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  return {
    setProgress(p) {
      const pct = Math.round(p * 100)
      progressFill.style.width = `${pct}%`
      percent.textContent = `${pct}%`
    },
    showDone() {
      shimmer.style.display = 'none'
      progressBar.style.display = 'none'
      percent.style.display = 'none'
      sub.style.display = 'none'
      title.className = 'cs-render-done-title'
      title.textContent = 'Your Video is Ready'
      overlay.classList.add('done')
      // Remove after fade-out animation completes
      overlay.addEventListener('animationend', e => {
        if (e.animationName === 'cs-fade-out') overlay.remove()
      })
    },
    remove() { overlay.remove() },
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// Module-level refs for palette system (set by createControls)
let _palettes = null
let _buildRampFromPalette = null

export function createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot, setAspectRatio, exportDimensions, palettes, buildRampFromPalette) {
  _palettes = palettes
  _buildRampFromPalette = buildRampFromPalette
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
    return {
      layer1: { main: [..._palettes.layer1.main], extras: [..._palettes.layer1.extras], enabled: [..._palettes.layer1.enabled] },
      layer2: { main: [..._palettes.layer2.main], extras: [..._palettes.layer2.extras], enabled: [..._palettes.layer2.enabled] },
    }
  }

  function loadPreset(data) {
    for (const key of ['layer1', 'layer2']) {
      const p = _palettes[key]
      const d = data[key]
      // Handle legacy formats
      if (Array.isArray(d)) {
        p.main[0] = d[0] ? d[0].color : '#000000'
        p.main[1] = d[d.length - 1] ? d[d.length - 1].color : '#ffffff'
        for (let i = 0; i < 4; i++) {
          p.extras[i] = d[i + 1] && i + 1 < d.length - 1 ? d[i + 1].color : '#808080'
          p.enabled[i] = i + 1 < d.length - 1
        }
      } else if (d.colors) {
        // Old 5-flat format
        p.main[0] = d.colors[0]; p.main[1] = d.colors[4] || d.colors[d.colors.length - 1]
        for (let i = 0; i < 4; i++) {
          p.extras[i] = d.colors[i + 1] || '#808080'
          p.enabled[i] = d.enabled[i + 1] !== undefined ? d.enabled[i + 1] : false
        }
      } else {
        for (let i = 0; i < 2; i++) p.main[i] = d.main[i]
        for (let i = 0; i < 4; i++) { p.extras[i] = d.extras[i]; p.enabled[i] = d.enabled[i] }
      }
      const ramp = _buildRampFromPalette(p)
      uniforms[key].uRampColors.value.set(ramp.colors)
      uniforms[key].uRampPositions.value.set(ramp.positions)
      uniforms[key].uRampCount.value = ramp.count
    }
    // Refresh palette UI
    for (const entry of uiRegistry) {
      if (entry.type === 'palette') {
        const p = _palettes[entry.layer]
        entry.set({ main: [...p.main], extras: [...p.extras], enabled: [...p.enabled] })
      }
    }
  }

  function presetGradient(data) {
    const allColors = []
    for (const key of ['layer1', 'layer2']) {
      const d = data[key]
      if (Array.isArray(d)) {
        d.forEach(s => allColors.push(s.color))
      } else if (d.main) {
        allColors.push(d.main[0])
        d.extras.forEach((c, i) => { if (d.enabled[i]) allColors.push(c) })
        allColors.push(d.main[1])
      } else if (d.colors) {
        d.colors.forEach((c, i) => { if (d.enabled[i]) allColors.push(c) })
      }
    }
    const n = allColors.length
    const stops = allColors.map((c, i) => `${c} ${n > 1 ? ((i / (n - 1)) * 100).toFixed(0) : 0}%`).join(', ')
    return `linear-gradient(135deg, ${stops})`
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
    } else if (entry.type === 'palette') {
      const randColor = () => {
        const h = Math.random() * 360, s = 50 + Math.random() * 50, l = 30 + Math.random() * 40
        return hslToHex(h, s, l)
      }
      const main = [randColor(), randColor()]
      const extras = [randColor(), randColor(), randColor(), randColor()]
      const enabled = extras.map(() => Math.random() > 0.3)
      entry.set({ main, extras, enabled })
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

const SPEED_SEGS = 10

function makeSpeedBar(label, min, max, value, step, onChange) {
  const row = document.createElement('div')
  row.className = 'cs-speed-row'

  const lbl = document.createElement('span')
  lbl.className = 'cs-slider-label'
  lbl.textContent = label

  const bar = document.createElement('div')
  bar.className = 'cs-speed-bar'

  const pct = document.createElement('span')
  pct.className = 'cs-speed-pct'

  let current = value
  const segs = []

  for (let i = 0; i < SPEED_SEGS; i++) {
    const seg = document.createElement('div')
    seg.className = 'cs-speed-seg'
    bar.appendChild(seg)
    segs.push(seg)
  }

  function refresh() {
    const t = (current - min) / (max - min)
    const filledCount = Math.round(t * SPEED_SEGS)
    pct.textContent = `${Math.round(t * 100)}%`
    segs.forEach((s, i) => {
      const on = i < filledCount
      s.classList.toggle('on', on)
      if (on) {
        const segT = filledCount > 1 ? i / (filledCount - 1) : 0
        const h = 215 + segT * 10   // blue range
        const l = 58 - segT * 14
        s.style.setProperty('--seg-color', `hsl(${h}, 70%, ${l}%)`)
      }
    })
  }

  function setFromClick(e) {
    const rect = bar.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const raw = min + t * (max - min)
    current = Math.round(raw / step) * step
    current = Math.min(max, Math.max(min, current))
    onChange(current)
    refresh()
  }

  let dragging = false
  bar.addEventListener('mousedown', e => { dragging = true; setFromClick(e) })
  document.addEventListener('mousemove', e => { if (dragging) setFromClick(e) })
  document.addEventListener('mouseup', () => { dragging = false })

  if (_regLayer) {
    uiRegistry.push({ type: 'slider', layer: _regLayer, min, max, step,
      set(v) { current = v; onChange(v); refresh() }
    })
  }

  row.appendChild(lbl)
  row.appendChild(bar)
  row.appendChild(pct)
  refresh()
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
  pad._sync = positionDot
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

function makeColorPalette(palette, u, layerKey, getOklab = () => false) {
  const row = document.createElement('div')
  row.className = 'cs-palette-row'

  function applyPalette() {
    const ramp = _buildRampFromPalette(palette)
    u.uRampColors.value.set(ramp.colors)
    u.uRampPositions.value.set(ramp.positions)
    u.uRampCount.value = ramp.count
  }

  // --- 2 main swatches (always on) ---
  const mainEls = []
  for (let i = 0; i < 2; i++) {
    const swatch = document.createElement('div')
    swatch.className = 'cs-palette-swatch main'
    swatch.style.background = palette.main[i]

    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.value = palette.main[i]
    swatch.appendChild(colorInput)

    swatch.addEventListener('click', () => colorInput.click())
    colorInput.addEventListener('input', () => {
      palette.main[i] = colorInput.value
      swatch.style.background = colorInput.value
      applyPalette()
    })

    row.appendChild(swatch)
    mainEls.push(swatch)
  }

  // --- Separator ---
  const sep = document.createElement('div')
  sep.className = 'cs-palette-sep'
  row.appendChild(sep)

  // --- 4 extra swatches (toggleable) ---
  const extraEls = []

  function refreshExtras() {
    extraEls.forEach((sw, i) => {
      sw.style.background = palette.extras[i]
      sw.classList.toggle('disabled', !palette.enabled[i])
      const tog = sw.querySelector('.cs-palette-toggle')
      if (tog) {
        tog.textContent = palette.enabled[i] ? '\u2713' : ''
        tog.classList.toggle('off', !palette.enabled[i])
      }
    })
  }

  for (let i = 0; i < 4; i++) {
    const swatch = document.createElement('div')
    swatch.className = `cs-palette-swatch${palette.enabled[i] ? '' : ' disabled'}`
    swatch.style.background = palette.extras[i]

    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.value = palette.extras[i]
    swatch.appendChild(colorInput)

    swatch.addEventListener('click', e => {
      if (e.target.classList.contains('cs-palette-toggle')) return
      colorInput.click()
    })
    colorInput.addEventListener('input', () => {
      palette.extras[i] = colorInput.value
      swatch.style.background = colorInput.value
      applyPalette()
    })

    const toggle = document.createElement('div')
    toggle.className = `cs-palette-toggle${palette.enabled[i] ? '' : ' off'}`
    toggle.textContent = palette.enabled[i] ? '\u2713' : ''
    toggle.addEventListener('click', e => {
      e.stopPropagation()
      palette.enabled[i] = !palette.enabled[i]
      refreshExtras()
      applyPalette()
    })
    swatch.appendChild(toggle)

    row.appendChild(swatch)
    extraEls.push(swatch)
  }

  row._syncOklab = () => {}

  // Register for randomize
  if (_regLayer) {
    uiRegistry.push({ type: 'palette', layer: _regLayer,
      set({ main, extras, enabled }) {
        for (let i = 0; i < 2; i++) palette.main[i] = main[i]
        for (let i = 0; i < 4; i++) {
          palette.extras[i] = extras[i]
          palette.enabled[i] = enabled[i]
        }
        mainEls.forEach((sw, i) => {
          sw.style.background = palette.main[i]
          const ci = sw.querySelector('input[type="color"]')
          if (ci) ci.value = palette.main[i]
        })
        extraEls.forEach((sw, i) => {
          sw.style.background = palette.extras[i]
          const ci = sw.querySelector('input[type="color"]')
          if (ci) ci.value = palette.extras[i]
        })
        refreshExtras()
        applyPalette()
      }
    })
  }

  applyPalette()
  refreshExtras()
  return row
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
    // Slide-specific: band count
    const countRow = makeSlider('count', 0.5, 10, u.uLinearCount.value, 0.1,
      v => { u.uLinearCount.value = v })

    // Cloth-specific sliders
    const foldRow = makeSlider('fold', 0.3, 3, u.uClothScale.value, 0.01,
      v => { u.uClothScale.value = v })
    const clothDetailRow = makeSlider('detail', 0, 1, u.uClothDetail.value, 0.01,
      v => { u.uClothDetail.value = v })

    function syncLinearMotion() {
      const m = u.uLinearMotion.value
      slidePill.classList.toggle('active', m === 0)
      clothPill.classList.toggle('active', m === 1)
      curveRow.style.display        = m === 0 ? '' : 'none'
      countRow.style.display        = m === 0 ? '' : 'none'
      foldRow.style.display         = m === 1 ? '' : 'none'
      clothDetailRow.style.display  = m === 1 ? '' : 'none'
      seedBtn.style.display         = m === 1 ? '' : 'none'
    }
    slidePill.addEventListener('click', () => { u.uLinearMotion.value = 0; syncLinearMotion() })
    clothPill.addEventListener('click', () => { u.uLinearMotion.value = 1; syncLinearMotion() })
    motionPills.appendChild(slidePill)
    motionPills.appendChild(clothPill)
    motionRow.appendChild(motionLbl)
    motionRow.appendChild(motionPills)

    // Distort toggle + panel with 3 knobs
    const distortRow = document.createElement('div')
    distortRow.className = 'cs-field-row'
    const distortLbl = document.createElement('span')
    distortLbl.className = 'cs-field-label'
    distortLbl.textContent = 'Distort'
    distortRow.appendChild(distortLbl)

    const distortPanel = document.createElement('div')
    distortPanel.style.cssText = 'display:none;flex-direction:column;gap:8px;'
    const distortKnobs = document.createElement('div')
    distortKnobs.className = 'cs-knob-pair'
    distortKnobs.appendChild(makeKnob('distort', 0, 2, u.uDistortAmt.value, 0.01,
      v => { u.uDistortAmt.value = v }))
    distortKnobs.appendChild(makeKnob('amp', 0, 2, u.uWaveAmp.value, 0.01,
      v => { u.uWaveAmp.value = v }))
    distortKnobs.appendChild(makeKnob('freq', 0.5, 15, u.uWaveFreq.value, 0.1,
      v => { u.uWaveFreq.value = v }))
    distortPanel.appendChild(distortKnobs)

    let distortOn = u.uWaveAmp.value > 0 || u.uDistortAmt.value > 0
    function syncDistort() {
      distortPanel.style.display = distortOn ? 'flex' : 'none'
    }
    distortRow.appendChild(makeToggle(distortOn, v => {
      distortOn = v
      if (!v) { u.uWaveAmp.value = 0.0; u.uDistortAmt.value = 0.0 }
      syncDistort()
    }))

    // Seed button for cloth mode (created before syncLinearMotion)
    const seedBtn = document.createElement('button')
    seedBtn.className = 'cs-seed-btn'
    seedBtn.textContent = 'seed'
    seedBtn.title = 'Randomize cloth pattern'
    seedBtn.style.display = 'none'
    seedBtn.addEventListener('click', () => {
      u.uClothSeed.value = Math.floor(Math.random() * 100)
    })

    linearGroup.appendChild(dirRow)
    linearGroup.appendChild(curveRow)
    linearGroup.appendChild(countRow)
    linearGroup.appendChild(foldRow)
    linearGroup.appendChild(clothDetailRow)

    linearGroup.appendChild(distortRow)
    linearGroup.appendChild(distortPanel)
    syncLinearMotion()
    syncDistort()

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
    }

    rippleRow.appendChild(makeToggle(u.uRipple.value > 0, v => {
      u.uRipple.value = v ? 1.0 : 0.0
      syncRipple()
    }))

    radialGroup.appendChild(rippleRow)
    radialGroup.appendChild(rippleDetails)
    syncRipple()

    // Radial distort toggle + panel with 3 knobs
    const radDistortRow = document.createElement('div')
    radDistortRow.className = 'cs-field-row'
    const radDistortLbl = document.createElement('span')
    radDistortLbl.className = 'cs-field-label'
    radDistortLbl.textContent = 'Distort'
    radDistortRow.appendChild(radDistortLbl)

    const radDistortPanel = document.createElement('div')
    radDistortPanel.style.cssText = 'display:none;flex-direction:column;gap:8px;'
    const radDistortKnobs = document.createElement('div')
    radDistortKnobs.className = 'cs-knob-pair'
    radDistortKnobs.appendChild(makeKnob('distort', 0, 2, u.uDistortAmt.value, 0.01,
      v => { u.uDistortAmt.value = v }))
    radDistortKnobs.appendChild(makeKnob('amp', 0, 2, u.uWaveAmp.value, 0.01,
      v => { u.uWaveAmp.value = v }))
    radDistortKnobs.appendChild(makeKnob('freq', 0.5, 15, u.uWaveFreq.value, 0.1,
      v => { u.uWaveFreq.value = v }))
    radDistortPanel.appendChild(radDistortKnobs)

    let radDistortOn = u.uWaveAmp.value > 0 || u.uDistortAmt.value > 0
    function syncRadDistort() {
      radDistortPanel.style.display = radDistortOn ? 'flex' : 'none'
    }
    radDistortRow.appendChild(makeToggle(radDistortOn, v => {
      radDistortOn = v
      if (!v) { u.uWaveAmp.value = 0.0; u.uDistortAmt.value = 0.0 }
      syncRadDistort()
    }))

    radialGroup.appendChild(radDistortRow)
    radialGroup.appendChild(radDistortPanel)
    syncRadDistort()

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

    // Metaball-specific controls
    const metaballGroup = document.createElement('div')
    metaballGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    const metaBallCountRow = makeSlider('balls', 2, 15, u.uMetaBallCount.value, 1,
      v => { u.uMetaBallCount.value = v })
    metaballGroup.appendChild(metaBallCountRow)

    const metaSizeRow = makeSlider('size', 0.03, 0.4, u.uMetaSize.value, 0.01,
      v => { u.uMetaSize.value = v })
    metaballGroup.appendChild(metaSizeRow)

    const metaKnobs = document.createElement('div')
    metaKnobs.className = 'cs-knob-pair'
    metaKnobs.appendChild(makeKnob('elasticity', 0.3, 3, u.uMetaElasticity.value, 0.01,
      v => { u.uMetaElasticity.value = v }))
    metaKnobs.appendChild(makeKnob('softness', 0, 1, u.uMetaSoftness.value, 0.01,
      v => { u.uMetaSoftness.value = v }))
    metaKnobs.appendChild(makeKnob('spread', 0.2, 2, u.uMetaSpread.value, 0.01,
      v => { u.uMetaSpread.value = v }))
    metaKnobs.appendChild(makeKnob('chaos', 0, 1, u.uMetaChaos.value, 0.01,
      v => { u.uMetaChaos.value = v }))
    metaballGroup.appendChild(metaKnobs)

    // Invert toggle
    const metaInvertRow = document.createElement('div')
    metaInvertRow.className = 'cs-field-row'
    const metaInvertLbl = document.createElement('span')
    metaInvertLbl.className = 'cs-field-label'
    metaInvertLbl.textContent = 'Invert'
    metaInvertRow.appendChild(metaInvertLbl)
    metaInvertRow.appendChild(makeToggle(u.uMetaInvert.value > 0.5, v => {
      u.uMetaInvert.value = v ? 1.0 : 0.0
    }))
    metaballGroup.appendChild(metaInvertRow)

    // Seed button for metaball
    const metaSeedBtn = document.createElement('button')
    metaSeedBtn.className = 'cs-seed-btn'
    metaSeedBtn.textContent = 'seed'
    metaSeedBtn.title = 'Randomize blob pattern'
    metaSeedBtn.addEventListener('click', () => {
      u.uMetaSeed.value = Math.floor(Math.random() * 100)
    })

    // Radial sub-type pills: Standard | Sweep | Hypnotic
    const radialTypeRow = document.createElement('div')
    radialTypeRow.className = 'cs-field-row'
    const radialTypeLbl = document.createElement('span')
    radialTypeLbl.className = 'cs-field-label'
    radialTypeLbl.textContent = 'Type'
    const radialTypePills = document.createElement('div')
    radialTypePills.className = 'cs-pills'

    const radialStd_ = document.createElement('button')
    radialStd_.className = 'cs-pill'
    radialStd_.textContent = 'Standard'
    const radialSweep_ = document.createElement('button')
    radialSweep_.className = 'cs-pill'
    radialSweep_.textContent = 'Sweep'
    const radialHypnotic_ = document.createElement('button')
    radialHypnotic_.className = 'cs-pill'
    radialHypnotic_.textContent = 'Hypnotic'

    function syncRadialType() {
      const mode = u.uMode.value
      radialStd_.classList.toggle('active', mode === 0)
      radialSweep_.classList.toggle('active', mode === 2)
      radialHypnotic_.classList.toggle('active', mode === 3)
      rippleRow.style.display = mode === 0 ? '' : 'none'
      rippleDetails.style.display = (mode === 0 && u.uRipple.value > 0) ? 'flex' : 'none'
      sweepGroup.style.display = mode === 2 ? 'flex' : 'none'
      hypnoticGroup.style.display = mode === 3 ? 'flex' : 'none'
      speedRow.style.display = mode === 3 ? 'none' : ''
      posPad.style.display = (mode === 0 || mode === 2) ? '' : 'none'
    }

    radialStd_.addEventListener('click', () => { u.uMode.value = 0; syncRadialType() })
    radialSweep_.addEventListener('click', () => { u.uMode.value = 2; syncRadialType() })
    radialHypnotic_.addEventListener('click', () => { u.uMode.value = 3; syncRadialType() })

    radialTypePills.appendChild(radialStd_)
    radialTypePills.appendChild(radialSweep_)
    radialTypePills.appendChild(radialHypnotic_)
    radialTypeRow.appendChild(radialTypeLbl)
    radialTypeRow.appendChild(radialTypePills)

    // Append sweep/hypnotic groups into radialGroup
    radialGroup.appendChild(sweepGroup)
    radialGroup.appendChild(hypnoticGroup)

    function syncMode() {
      const mode = u.uMode.value
      const isRadialFamily = (mode === 0 || mode === 2 || mode === 3)
      radial_.classList.toggle('active', isRadialFamily)
      linear_.classList.toggle('active', mode === 1)
      metaball_.classList.toggle('active', mode === 4)
      radialTypeRow.style.display = isRadialFamily ? '' : 'none'
      motionRow.style.display = mode === 1 ? '' : 'none'
      radialGroup.style.display = isRadialFamily ? 'flex' : 'none'
      linearGroup.style.display = mode === 1 ? 'flex' : 'none'
      metaballGroup.style.display = mode === 4 ? 'flex' : 'none'
      metaSeedBtn.style.display = mode === 4 ? '' : 'none'
      syncRadialType()
    }

    const radial_ = document.createElement('button')
    radial_.className = 'cs-pill'
    radial_.textContent = 'Radial'
    radial_.addEventListener('click', () => {
      const cur = u.uMode.value
      // If already in radial family, keep sub-type; otherwise default to Standard
      if (cur !== 0 && cur !== 2 && cur !== 3) u.uMode.value = 0
      syncMode()
    })

    const linear_ = document.createElement('button')
    linear_.className = 'cs-pill'
    linear_.textContent = 'Linear'
    linear_.addEventListener('click', () => { u.uMode.value = 1; syncMode() })

    const metaball_ = document.createElement('button')
    metaball_.className = 'cs-pill'
    metaball_.textContent = 'Metaball'
    metaball_.addEventListener('click', () => { u.uMode.value = 4; syncMode() })

    pills.appendChild(radial_)
    pills.appendChild(linear_)
    pills.appendChild(metaball_)
    modeRow.appendChild(modeLbl)
    modeRow.appendChild(pills)
    body.appendChild(modeRow)
    body.appendChild(radialTypeRow)
    body.appendChild(motionRow)

    // Position pad
    const posPad = makePositionPad(u.uCenterX, u.uCenterY)

    const padRow = document.createElement('div')
    padRow.className = 'cs-pad-row'
    padRow.appendChild(posPad)

    const speedRow = makeSpeedBar('speed', 0.05, 2, u.uSpeed.value, 0.01, v => { u.uSpeed.value = v })
    // Seed buttons sit before the speed bar
    metaSeedBtn.style.display = 'none'
    speedRow.insertBefore(metaSeedBtn, speedRow.firstChild)
    speedRow.insertBefore(seedBtn, speedRow.firstChild)
    body.appendChild(speedRow)
    body.appendChild(padRow)
    body.appendChild(radialGroup)
    body.appendChild(linearGroup)
    body.appendChild(metaballGroup)

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

    // 5-color palette
    const rampWidget = makeColorPalette(_palettes[layerKey], u, layerKey, () => u.uOklab.value)
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
      const burstPad = makePositionPad(ub.uBurstCenterX, ub.uBurstCenterY)
      burstGroup.appendChild(burstPad)

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
        spiral_.classList.toggle('active', m === 4)
        globe_.classList.toggle('active', m === 5)
        parallelGroup.style.display = m === 0 ? 'flex' : 'none'
        burstGroup.style.display    = m === 1 ? 'flex' : 'none'
        orbitGroup.style.display    = m === 2 ? 'flex' : 'none'
        fanGroup.style.display      = m === 3 ? 'flex' : 'none'
        spiralGroup.style.display   = m === 4 ? 'flex' : 'none'
        globeGroup.style.display    = m === 5 ? 'flex' : 'none'
        // Mode-specific visibility
        const isFan    = m === 3
        const isBurst  = m === 1
        const isSpiral = m === 4
        const isGlobe  = m === 5
        angleRow.style.display = (isFan || isBurst || isSpiral || isGlobe) ? 'none' : ''
        // Fan hides a subset of glass rows
        if (isFan) fanHiddenRows.forEach(r => { r.style.display = 'none' })
        // Burst hides: distort, softness, blur, roughness, thickness, invertRow
        if (isBurst) {
          distortRow.style.display = 'none'
          invertRow.style.display = 'none'
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
        // Globe hides: distort, invertRow, speed, softness, thickness, blur,
        // highlight, highlight spread, roughness, and the Glass tilt pad (globe has its own)
        if (isGlobe) {
          distortRow.style.display = 'none'
          invertRow.style.display = 'none'
          softnessRow.style.display = 'none'
          speedRow.style.display = 'none'
          thicknessRow.style.display = 'none'
          blurRow.style.display = 'none'
          highlightRow.style.display = 'none'
          hlSpreadRow.style.display = 'none'
          roughnessRow.style.display = 'none'
          tiltPadRow.style.display = 'none'
        }
      }

      const parallel_ = document.createElement('button')
      parallel_.className = 'cs-pill'
      parallel_.textContent = 'Parallel'
      parallel_.addEventListener('click', () => { ub.uBandsMode.value = 0; syncBandsMode() })

      const burst_ = document.createElement('button')
      burst_.className = 'cs-pill'
      burst_.textContent = 'Burst'
      burst_.addEventListener('click', () => {
        ub.uBandsMode.value = 1
        ub.uBurstCenterX.value = 0.5
        ub.uBurstCenterY.value = 0.5
        burstPad._sync()
        syncBandsMode()
      })

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

      const globe_ = document.createElement('button')
      globe_.className = 'cs-pill'
      globe_.textContent = 'Globe'
      globe_.addEventListener('click', () => {
        ub.uBandsMode.value = 5
        ub.uBurstCenterX.value = 0.5
        ub.uBurstCenterY.value = 0.5
        globePad._sync()
        syncBandsMode()
      })

      // Spiral-only controls (spacing + center)
      const spiralGroup = document.createElement('div')
      spiralGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      spiralGroup.appendChild(makeSlider('spacing', 1, 20, ub.uSpacing.value, 0.1, v => { ub.uSpacing.value = v }))
      spiralGroup.appendChild(makePositionPad(ub.uBurstCenterX, ub.uBurstCenterY))

      // Globe-only controls (radius, position pad, tilt pad, fresnel color, atmosphere)
      const globeGroup = document.createElement('div')
      globeGroup.style.cssText = 'display:none;flex-direction:column;gap:8px;'
      globeGroup.appendChild(makeSlider('radius', 0.05, 0.5, ub.uGlobeRadius.value, 0.01, v => { ub.uGlobeRadius.value = v }))
      globeGroup.appendChild(makeSlider('edge softness', 0, 1, ub.uGlobeEdge.value, 0.01, v => { ub.uGlobeEdge.value = v }))
      const globePad = makePositionPad(ub.uBurstCenterX, ub.uBurstCenterY)
      globeGroup.appendChild(globePad)
      globeGroup.appendChild(makeTiltPad(ub.uTilt, ub.uTilt2, ub.uTiltZ))
      globeGroup.appendChild(makeSingleColor('fresnel color', ub.uFresnelColor))
      globeGroup.appendChild(makeSlider('atmosphere', 0, 1, ub.uAtmoGlow.value, 0.01, v => { ub.uAtmoGlow.value = v }))
      globeGroup.appendChild(makeSingleColor('atmo color', ub.uAtmoColor))

      modePills.appendChild(parallel_)
      modePills.appendChild(burst_)
      modePills.appendChild(orbit_)
      modePills.appendChild(fan_)
      modePills.appendChild(spiral_)
      modePills.appendChild(globe_)
      modeRow.appendChild(modeLbl)
      modeRow.appendChild(modePills)
      sub.appendChild(modeRow)
      sub.appendChild(parallelGroup)
      sub.appendChild(burstGroup)
      sub.appendChild(orbitGroup)
      sub.appendChild(fanGroup)
      sub.appendChild(spiralGroup)
      sub.appendChild(globeGroup)

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
      const speedRow   = makeSpeedBar('speed', 0, 2, ub.uSpeed.value, 0.01, v => { ub.uSpeed.value = v })
      const distortRow = makeSlider('distort', 0, 1, ub.uDistort.value, 0.01, v => { ub.uDistort.value = v })
      sub.appendChild(speedRow)
      sub.appendChild(distortRow)


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

    // ── Grain effect ──────────────────────────────────────────────────────
    const grainRow = document.createElement('div')
    grainRow.className = 'cs-field-row'
    const grainLbl = document.createElement('span')
    grainLbl.className = 'cs-field-label'
    grainLbl.textContent = 'Grain'
    const grainPills = document.createElement('div')
    grainPills.className = 'cs-pills'

    const grainOff = document.createElement('button')
    grainOff.className = 'cs-pill'
    grainOff.textContent = 'Off'
    const grainFilm = document.createElement('button')
    grainFilm.className = 'cs-pill'
    grainFilm.textContent = 'Film'
    const grainScan = document.createElement('button')
    grainScan.className = 'cs-pill'
    grainScan.textContent = 'Scan'

    const grainPanel = document.createElement('div')
    grainPanel.style.cssText = 'display:none;flex-direction:column;gap:8px;'

    const grainKnobs = document.createElement('div')
    grainKnobs.className = 'cs-knob-pair'
    grainKnobs.appendChild(makeKnob('amount', 0, 1, u.uGrainAmt.value, 0.01,
      v => { u.uGrainAmt.value = v }))
    grainKnobs.appendChild(makeKnob('scale', 0, 1, u.uGrainScale.value, 0.01,
      v => { u.uGrainScale.value = v }))
    grainPanel.appendChild(grainKnobs)

    function syncGrain() {
      const g = u.uGrainType.value
      grainOff.classList.toggle('active', g === 0)
      grainFilm.classList.toggle('active', g === 1)
      grainScan.classList.toggle('active', g === 2)
      grainPanel.style.display = g > 0 ? 'flex' : 'none'
    }

    grainOff.addEventListener('click', () => { u.uGrainType.value = 0; syncGrain() })
    grainFilm.addEventListener('click', () => { u.uGrainType.value = 1; syncGrain() })
    grainScan.addEventListener('click', () => { u.uGrainType.value = 2; syncGrain() })

    grainPills.appendChild(grainOff)
    grainPills.appendChild(grainFilm)
    grainPills.appendChild(grainScan)
    grainRow.appendChild(grainLbl)
    grainRow.appendChild(grainPills)
    body.appendChild(grainRow)
    body.appendChild(grainPanel)
    syncGrain()
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
        const renderOverlay = createRenderOverlay()
        await exportVideo({
          targetDuration: secs, fps: selectedFps, resolution: selectedVideoRes,
          onProgress: p => {
            progressFill.style.width = `${Math.round(p * 100)}%`
            progressLbl.textContent = `recording… ${Math.round(p * 100)}%`
            renderOverlay.setProgress(p)
          },
          onDone: () => {
            isRecording = false
            progressWrap.style.display = 'none'
            durRow.style.opacity = '1'; durRow.style.pointerEvents = 'auto'
            fpsPills.style.pointerEvents = 'auto'
            resPills.style.pointerEvents = 'auto'
            renderOverlay.showDone()
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
