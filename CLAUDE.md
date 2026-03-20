# CLAUDE.md

Project guidance for Claude Code. Detailed specs are split by production stage in `docs/`.

## Commands

```bash
npm run dev      # Vite dev server (hot reload, GLSL imports live)
npm run build    # production build
npm run preview  # preview production build
```

No test runner configured. `tests/` exists but is empty.

---

## Stack

- **Vite 6** + **vite-plugin-glsl** — `.glsl` files imported as strings
- **Three.js 0.172** — WebGL2, `ShaderMaterial`, `WebGLRenderTarget`
- ES Modules only, no React, no UI frameworks

Do not suggest alternative stacks unless explicitly asked.

---

## Render Pipeline (4 passes)

```
Pass 1  bgScene       → rt1     Gradients (Layer 1 + Layer 2)       → docs/Gradients.md
Pass 2  bandsScene    → rt2     Glass Bands (reads rt1)             → docs/Geometry.md
Pass 3  halftoneScene → rt3     Halftone (reads rt2)                → docs/Rendering.md
Pass 4  lensScene     → screen  Lens Distortion (reads rt3)         → docs/Rendering.md
Export  PNG / Video                                                  → docs/Export.md
```

`renderPasses(r, bgRT1, bgRT2, bgRT3, w, h, outputRT = null)` — shared by live loop, PNG, and video export.

---

## Data Flow

```
main.js
  └─ createScene(canvas)  → { start, uniforms, exportPNG, exportVideo, ... }
  └─ createControls(uniforms, exportPNG, exportVideo, getLoopDuration, togglePause, snapshot)
```

Uniforms: `{ layer1, layer2, streaks (disabled), bands, halftone, lens }`

---

## Shader Design Principles

- Fullscreen quad shaders (`PlaneGeometry(2,2)` + ortho camera)
- Uniform-driven animation via `uTime`, smooth sine/cosine motion
- Avoid: expensive loops, noise stacks, recursive logic, heavy 3D geometry
- Motion feel: premium, elegant, intentional

## Layer Contract

Every animated layer: `uLayerEnabled`, `uSpeed`, `uOffset`, `baseVertex.glsl`, own `.glsl` file.
Post-processing layers may omit `uTime`/`uSpeed` if static.

## Code Style

- Shaders in `src/shaders/*.glsl`, never inline
- Scene in `scene.js`, controls in `controls/controls.js`, export in `utils/`
- Comment non-obvious GLSL math
- `MAX_STOPS = 8` synced in `scene.js` and `controls.js`

---

## Known Bugs & Rules

| Bug | Rule |
|-----|------|
| PNG exports washed out | Never use manual sRGB LUT. Render to canvas (null RT) + `toDataURL()` |
| 60fps video = still frame | Always `captureStream(0)` + `requestFrame()`, never non-zero fps |
| TDZ crash in controls.js | Declare `const` DOM refs before any code that accesses them |

---

## Docs Index

| File | Stage | Scope |
|------|-------|-------|
| [Gradients.md](docs/Gradients.md) | Pass 1 | Layer 1 & 2 — color ramps, modes, radial/linear/sweep/hypnotic |
| [Geometry.md](docs/Geometry.md) | Pass 2 | Diagonal Bands — glass refraction, IOR, band modes, tilt system |
| [Rendering.md](docs/Rendering.md) | Pass 3–4 | Halftone screen + Lens distortion (barrel, CA, vignette) |
| [Export.md](docs/Export.md) | Output | PNG / Video export pipeline, color space, aspect ratio |
