# Lens Artist Agent — Skill Reflection

## When It Was Used

Deployed after the initial lens distortion shader was working but visually underwhelming. The pipeline plumbing was correct (4-pass, rt3, all export paths updated), but the shader itself used naive math that didn't look like real glass optics.

## Decision-Making Process

**Why lens-artist instead of manual iteration?** Shader quality improvements require deep domain knowledge — optical models, color science, perceptual falloff curves. Iterating manually ("try this constant, rebuild, squint at the screen") is slow and produces mediocre results. The lens-artist agent has baked-in knowledge of real lens behavior and can diagnose why an effect looks "off" from first principles.

**Diagnostic approach — the agent identified 4 specific problems:**
1. Single-term barrel distortion (r^2 only) ramps too uniformly — real lenses accelerate in the outer third
2. Chromatic aberration as constant UV offset is physically wrong — real CA is zero at center, grows with r^2
3. Smoothstep vignette has a visible "onset ring" — real optical falloff follows cos^4 law
4. No aspect ratio correction — distortion was elliptical on non-square canvases

**Each diagnosis led to a specific fix, not a vague "make it better":**
- Problem 1 -> Brown-Conrady two-term model (k1*r^2 + k2*r^4)
- Problem 2 -> Per-channel barrel coefficients (R/G/B get different k1 values)
- Problem 3 -> cos^4 approximation via 1/(1 + r^2*scale)^2
- Problem 4 -> Aspect vector applied before radial math, undone before sampling

**Constraint respected:** Same uniforms, same slider ranges, same control interface. The user doesn't need to learn new controls — the existing sliders just produce better-looking results.

## What Worked Well

- The agent correctly identified that chromatic aberration and barrel distortion are fundamentally the same operation (radial UV remapping) with different coefficients per channel. Unifying them into per-channel barrel coefficients is both more physically correct AND cheaper than the original separate-offset approach.
- Added the edge fade function proactively — extreme barrel values would push UVs out of [0,1] and the original shader had no protection against hard clamped edges.
- The cos^4 vignette model is a genuine improvement over smoothstep. The difference is subtle at low strength but obvious at high values — no visible transition ring.
- Added `uResolution` uniform and plumbed it through all render/export paths without being asked.

## What Could Be Improved

- The agent could have considered adding a subtle **bloom/glow** interaction at the vignette boundary — real lenses often show slight light wrap where vignette meets bright areas. This was in scope but not implemented.
- **Anamorphic stretch** is a natural extension (oval bokeh, horizontal flare) that would pair well with the existing barrel distortion. Worth considering for a future pass.
- The `k2 = k1 * 0.35` ratio is a reasonable default but could be exposed as an advanced slider for users who want to fine-tune the distortion profile (mustache vs. barrel vs. pincushion).
- Performance: three calls to `barrelDistort()` (one per channel) each compute the same aspect correction and centering. Could precompute the centered coords once and pass them in, saving ~6 multiplies per pixel. Negligible in practice but worth noting for mobile targets.

## What I Learned

- **Physically-based post-processing beats artistic tweaking.** The cos^4 model, per-channel dispersion, and Brown-Conrady distortion all come from real optics. They look better precisely because the human eye has spent a lifetime seeing these effects through cameras and glasses — subconsciously we know what "correct" lens behavior looks like.
- **Aspect ratio correction matters more than you'd think.** On a 16:9 canvas, uncorrected radial distortion is visibly elliptical. The fix is 2 extra multiplies and a divide per pixel — trivial cost, huge visual improvement.
- **Edge cases at extreme parameter values matter.** The original shader would show hard color banding at the edges with high barrel values. The 8px edge fade is invisible during normal use but saves the effect at extremes.

## Collaboration Notes — How You Can Get More From This Agent

**What went right:**
- You created a dedicated lens-artist agent definition and invoked it specifically for visual quality work. This separation of concerns (Plan for architecture, lens-artist for visual quality) is exactly the right pattern.

**Where collaboration could improve:**

1. **Provide visual references.** Saying "improve the lens distortion" is good, but showing a screenshot of a lens effect you admire (a film still, a photography example, a Dribbble shot) would let the agent target a specific aesthetic rather than optimizing for generic "physical correctness." Physical accuracy and artistic intent don't always align.

2. **Specify the viewing context.** Is this for large desktop displays? Mobile? Video export at 4K? The agent made different tradeoffs for each — mobile might want cheaper approximations, 4K might want higher-precision edge handling.

3. **Iterate with feedback.** After the agent improves the shader, run it and tell us what you see. "The vignette is too aggressive at 0.5" or "the CA looks great on the edges but I want more of it" gives the agent concrete signals to refine further. The most premium results come from 2-3 rounds of agent + human feedback, not a single pass.

4. **Consider invoking lens-artist earlier.** If you know a feature involves optical/visual quality (not just pipeline plumbing), bring the specialist in during the design phase, not as a cleanup pass afterward. The agent would have designed the uniforms and slider ranges differently if it had been consulted before the Plan agent locked them in.
