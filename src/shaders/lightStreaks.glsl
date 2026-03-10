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

// Burst mode
uniform bool  uBurstMode;    // false = parallel streaks, true = radial burst
uniform float uBurstCenterX; // burst origin X in UV space [0..1]
uniform float uBurstCenterY; // burst origin Y in UV space [0..1]

varying vec2 vUv;

void main() {
  if (!uLayerEnabled) { gl_FragColor = vec4(0.0); return; }

  float alongSigma = uLength * 0.5 + 0.005; // maps [0..1] → sigma [0.005..0.505]

  if (!uBurstMode) {
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

    // Radial vignette — fades streaks toward corners
    float vignette = 1.0 - smoothstep(0.3, 0.75, length(vUv - 0.5));

    float brightness = crossGauss * alongGauss * uIntensity * vignette;
    gl_FragColor = vec4(uColor * brightness, brightness);

  } else {
    // ─── BURST STREAKS ─────────────────────────────────────────────────────
    //
    // Streaks radiate outward from (uBurstCenterX, uBurstCenterY).
    // The cross-streak dimension maps to angle (which ray lane) and the
    // along-streak dimension maps to radius (how far out the glint sits).
    // All Gaussian parameters carry over: width = angular thinness of each
    // ray, length = radial extent of each glint blob, spacing = ray density.
    // LaneJitter now staggers glints radially so rays read as scattered
    // point-sources rather than a uniform ring.

    vec2  delta = vUv - vec2(uBurstCenterX, uBurstCenterY);
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x); // ∈ [-π, π]
    float t     = uTime * uSpeed + uOffset;

    // Angular lane — which ray. uSpacing = ray lanes per full rotation.
    float acrossScaled = angle * uSpacing / 6.28318;
    float lane         = floor(acrossScaled);
    float acrossTile   = fract(acrossScaled) - 0.5; // [-0.5, 0.5] within lane

    // Golden-ratio jitter staggers glints radially per ray lane
    float laneJitter = fract(lane * 0.6180339887);

    // Radial coordinate — glints travel outward (increasing dist) over time
    float alongScaled = dist * uSpacing - t + laneJitter;
    float alongTile   = fract(alongScaled) - 0.5; // [-0.5, 0.5]

    float crossGauss = exp(-(acrossTile * acrossTile) / (2.0 * uWidth     * uWidth));
    float alongGauss = exp(-(alongTile  * alongTile)  / (2.0 * alongSigma * alongSigma));

    // Inner fade: smooth rise from the center singularity where atan2 is
    // undefined and lane assignment is meaningless. 0.05 UV units ≈ 5% of
    // screen width — tight enough to stay invisible at normal viewing distance.
    float innerFade = smoothstep(0.0, 0.05, dist);

    float brightness = crossGauss * alongGauss * uIntensity * innerFade;
    gl_FragColor = vec4(uColor * brightness, brightness);
  }
}
