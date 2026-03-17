# Plan Agent — Skill Reflection

## When It Was Used

Deployed to architect the lens distortion post-processing pass before any code was written. The task required adding a 4th render pass to an existing 3-pass pipeline, touching scene.js, controls.js, a new shader, and all export paths.

## Decision-Making Process

**Why Plan instead of diving in?** The lens distortion touched every render path in the project — live viewport, PNG export, video export (canvas-res and 4K). Getting the architecture wrong would mean debugging color space issues or broken exports later. A Plan agent reads the full codebase first, maps dependencies, and returns a sequenced implementation plan before any edits happen.

**What the agent actually did:**
1. Read scene.js to understand the existing 3-pass pipeline signature (`renderPasses(r, bgRT1, bgRT2, w, h, outputRT)`)
2. Read halftone.glsl to clone the pattern for the new shader (uBackground, uLayerEnabled, passthrough when disabled)
3. Read controls.js to find `makeSubsection`, `makeSlider`, `makeAdvanced` patterns and where to insert the Lens section
4. Produced a concrete plan: new shader file, new rt3, updated function signature, all 4 call sites to update, control panel placement, performance budget

**Key decision**: Making halftone render to rt3 (intermediate) instead of screen, and lens becomes the new final pass. This was the only clean way to add a post-process after halftone without breaking the color space strategy (sRGB encoding only on the final screen pass).

## What Worked Well

- The plan caught that ALL `renderPasses` call sites needed updating (tick, exportPNG, exportVideo x2) — easy to miss if coding incrementally
- Identified that `uLayerEnabled: false` as default meant zero performance cost when lens is off
- Correctly placed the Lens subsection after Halftone but before the Mono toggle in controls
- The sequenced implementation order (shader -> scene -> controls) avoided forward-reference errors

## What Could Be Improved

- The plan's initial shader was basic (simple r^2 barrel, naive UV-offset CA, smoothstep vignette). It prioritized getting the pipeline plumbing right over visual quality. This was the correct priority for a Plan agent — but it meant a second pass (lens-artist) was needed to elevate the shader quality. A tighter collaboration between Plan and a visual quality agent upfront could have produced a better first draft.
- The plan didn't mention aspect ratio correction for the distortion effects. The lens-artist caught this later.
- Could have pre-identified that `uResolution` would be needed for aspect correction, saving an iteration.

## Collaboration Notes — How You Can Get More From This Agent

**What went right in your prompting:**
- You gave clear context: "These should work separately and should be added as a final touch." This told the Plan agent to design a modular, independent pass rather than trying to integrate effects into existing shaders.

**Where prompting could be sharper:**
- Specifying visual references or quality targets upfront (e.g., "I want cinematic lens effects like anamorphic flares" vs. "add lens distortion") would let the Plan agent scope the shader complexity correctly on the first pass, potentially avoiding the need for a second lens-artist pass.
- When the task clearly has both an architectural component AND a visual quality component, consider requesting both a Plan agent and a domain specialist (lens-artist) in parallel from the start.
