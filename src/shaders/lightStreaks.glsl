uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform float uAngle;     // parallel mode: flow direction in radians
uniform float uSpacing;   // streak/ray lane frequency
uniform float uWidth;     // Gaussian sigma cross-flow / cross-ray (thinness)
uniform float uLength;    // domain coverage [0..1]: 0 = point, 1 = continuous band
uniform float uIntensity; // peak additive brightness
uniform vec3  uColor;     // highlight tint (linear RGB)

// Mode: 0 = parallel, 1 = burst, 2 = vortex, 3 = rings
uniform int   uMode;
uniform float uBurstCenterX; // burst/vortex origin X in UV space [0..1]
uniform float uBurstCenterY; // burst/vortex origin Y in UV space [0..1]
uniform float uTwist;        // vortex spiral tightness (radians per UV unit of radius)

uniform float uFlicker; // 0 = steady, 1 = full per-lane brightness pulsing

varying vec2 vUv;

void main() {
  if (!uLayerEnabled) { gl_FragColor = vec4(0.0); return; }

  float alongSigma = uLength * 0.5 + 0.005; // maps [0..1] → sigma [0.005..0.505]

  if (uMode == 0) {
    // ─── PARALLEL STREAKS ──────────────────────────────────────────────────

    vec2 dir  = vec2(cos(uAngle), sin(uAngle));
    vec2 perp = vec2(-sin(uAngle), cos(uAngle));

    float proj   = dot(vUv, dir);
    float across = dot(vUv, perp);
    float t      = uTime * uSpeed + uOffset;

    // Perpendicular tiling — which streak lane
    float acrossScaled = across * uSpacing;
    float lane         = floor(acrossScaled);
    float acrossTile   = fract(acrossScaled) - 0.5;

    // Golden-ratio jitter staggers each streak along the flow axis
    float laneJitter = fract(lane * 0.6180339887);

    // Along-flow tiling and motion
    float alongScaled = proj * uSpacing - t + laneJitter;
    float alongTile   = fract(alongScaled) - 0.5;

    float crossGauss = exp(-(acrossTile * acrossTile) / (2.0 * uWidth     * uWidth));

    float alongGauss = exp(-(alongTile  * alongTile)  / (2.0 * alongSigma * alongSigma));

    // Per-lane flicker: staggered brightness oscillation
    float flicker = mix(1.0, 0.5 + 0.5 * sin(uTime * 2.5 + lane * 2.399), uFlicker);

    // Radial vignette — fades streaks toward corners
    float vignette = 1.0 - smoothstep(0.3, 0.75, length(vUv - 0.5));

    float brightness = crossGauss * alongGauss * uIntensity * vignette * flicker;
    gl_FragColor = vec4(uColor * brightness, brightness);

  } else if (uMode == 1 || uMode == 2) {
    // ─── BURST & VORTEX STREAKS ──────────────────────────────────────────
    //
    // Both radiate from (uBurstCenterX, uBurstCenterY).
    // Burst: straight radial rays.
    // Vortex: rays twist with distance — angle offset = dist * uTwist,
    // creating spiral arms (galaxy / whirlpool). At uTwist=0 vortex = burst.

    vec2  delta = vUv - vec2(uBurstCenterX, uBurstCenterY);
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x); // ∈ [-π, π]
    float t     = uTime * uSpeed + uOffset;

    // Vortex twist: rotate the angular coordinate by an amount proportional
    // to distance. This curves each ray into a spiral arm.
    if (uMode == 2) {
      angle -= dist * uTwist;
    }

    // Angular lane — which ray. Snap to integer so the 2π atan2 seam
    // (left side from center) wraps cleanly through fract().
    float angularLanes = max(round(uSpacing), 1.0);
    float acrossScaled = angle * angularLanes / 6.28318;
    float lane         = floor(acrossScaled);
    float acrossTile   = fract(acrossScaled) - 0.5; // [-0.5, 0.5] within lane

    // Golden-ratio jitter staggers glints radially per ray lane
    float laneJitter = fract(lane * 0.6180339887);

    // Radial coordinate — glints travel outward (increasing dist) over time
    float alongScaled = dist * uSpacing - t + laneJitter;
    float alongTile   = fract(alongScaled) - 0.5; // [-0.5, 0.5]

    float crossGauss = exp(-(acrossTile * acrossTile) / (2.0 * uWidth     * uWidth));

    float alongGauss = exp(-(alongTile * alongTile) / (2.0 * alongSigma * alongSigma));

    // Per-lane flicker: staggered brightness oscillation
    float flickerB = mix(1.0, 0.5 + 0.5 * sin(uTime * 2.5 + lane * 2.399), uFlicker);

    // Inner fade: smooth rise from the center singularity where atan2 is
    // undefined and lane assignment is meaningless. 0.05 UV units ≈ 5% of
    // screen width — tight enough to stay invisible at normal viewing distance.
    float innerFade = smoothstep(0.0, 0.05, dist);

    float brightness = crossGauss * alongGauss * uIntensity * innerFade * flickerB;
    gl_FragColor = vec4(uColor * brightness, brightness);

  } else if (uMode == 3) {
    // ─── RINGS ───────────────────────────────────────────────────────────
    //
    // Concentric rings expanding outward from (uBurstCenterX, uBurstCenterY).
    // Rotationally symmetric — no angular tiling, just radial.
    // uWidth controls ring thickness (radial Gaussian sigma).
    // uSpacing controls ring density along the radius.

    vec2  delta = vUv - vec2(uBurstCenterX, uBurstCenterY);
    float dist  = length(delta);
    float t     = uTime * uSpeed + uOffset;

    // Radial tiling — rings travel outward over time
    float radScaled = dist * uSpacing - t;
    float lane      = floor(radScaled);      // which ring
    float radTile   = fract(radScaled) - 0.5; // [-0.5, 0.5] within ring cell

    // Ring profile: Gaussian cross-section controlled by uWidth
    float ringGauss = exp(-(radTile * radTile) / (2.0 * uWidth * uWidth));

    // Per-ring flicker: staggered brightness oscillation
    float flickerR = mix(1.0, 0.5 + 0.5 * sin(uTime * 2.5 + lane * 2.399), uFlicker);

    // Fade rings toward edges so they don't clip hard at the quad boundary
    float edgeFade = 1.0 - smoothstep(0.35, 0.7, dist);

    // Inner fade from center singularity
    float innerFade = smoothstep(0.0, 0.03, dist);

    float brightness = ringGauss * uIntensity * edgeFade * innerFade * flickerR;
    gl_FragColor = vec4(uColor * brightness, brightness);
  }
}
