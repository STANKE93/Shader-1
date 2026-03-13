uniform sampler2D uBackground;
uniform float     uTime;
uniform bool      uLayerEnabled;
uniform float     uSpeed;
uniform float     uOffset;
uniform float     uSpacing;       // parallel mode: band frequency across the diagonal
uniform float     uAngle;         // parallel mode: band direction in radians
uniform float     uSoftness;      // edge softness shared by both modes
uniform float     uIOR;           // index of refraction (1.0 = none, 1.5 = glass)
uniform float     uThickness;     // [0..1]: flat slab → smooth height-profile lens
uniform float     uFresnel;       // [0..1]: Fresnel edge attenuation strength
uniform float     uTilt;          // [0..1]: venetian blind tilt across band (0 = flat, 1 = edge-on)
uniform float     uTilt2;         // [0..1]: venetian blind tilt along band (forward/backward lean)
uniform float     uTiltZ;         // [-1..1]: Z normal modulation (steepness gradient across band)
uniform int       uBandShape;     // 0 = flat slab, 1 = tube (cylindrical), 2 = fin (tapered ridge)
uniform float     uBevelWidth;    // [0..1]: half-width of bevel highlight in band space
uniform float     uBevelIntensity;// [0..2]: peak brightness of the bevel glint
uniform vec3      uTintColor;     // tinted glass absorption color (linear RGB)
uniform float     uTintStrength;  // [0..1]: tint intensity (0 = clear glass)
uniform int       uStep;          // 1 = normal (band + gap), 2 = doubled (no gap)
uniform float     uDistort;       // [0..1]: noise-based band distortion

// Mode: 0 = parallel, 1 = burst
uniform int       uBandsMode;
uniform float     uBurstCenterX;  // burst origin X in UV space [0..1]
uniform float     uBurstCenterY;  // burst origin Y in UV space [0..1]
uniform float     uRaySpread;     // ray count — keep integer to avoid ±π seam
uniform float     uRayLength;     // radial extent of rays in UV units
uniform float     uRayIntensity;  // additive brightness of the ray interior

varying vec2 vUv;

// Surface steepness — artistic constant shared by both modes.
const float STEEPNESS = 0.13;

// Simple 2D value noise for band distortion
float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep interp
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ─── Bevel highlight ─────────────────────────────────────────────────────────
// Shared by both modes. wave is the band/ray height profile [0..1];
// slope = |cos(phase)| peaks at the edge boundary.
// Returns the additive glint colour to mix into the final output.
vec3 bevelGlint(float wave, float slope, vec3 refractedColour) {
  float edgeDist   = abs(wave - 0.5) * 2.0;
  float bevelMask  = 1.0 - smoothstep(0.0, max(uBevelWidth, 0.001), edgeDist);
  float bevelFactor = bevelMask * slope;
  // 50/50 blend of scene colour and white so the streak reads as a specular
  // reflection of the environment rather than a flat white overlay.
  return mix(refractedColour, vec3(1.0), 0.5) * bevelFactor * uBevelIntensity;
}

// ─── Bevel extra refraction ───────────────────────────────────────────────────
// Small extra UV nudge at the edge contour — simulates the rounded lip.
// 0.04 hardcoded artistic constant (same order as STEEPNESS).
vec2 bevelDisp(float wave, float slope, vec3 refractedDir) {
  float edgeDist  = abs(wave - 0.5) * 2.0;
  float bevelMask = 1.0 - smoothstep(0.0, max(uBevelWidth, 0.001), edgeDist);
  return refractedDir.xy * bevelMask * slope * 0.04;
}

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  if (uBandsMode == 0) {
    // ─── PARALLEL BANDS ────────────────────────────────────────────────────

    vec2  dir   = vec2(cos(uAngle), sin(uAngle));
    float proj  = dot(vUv, dir);
    // Noise-based distortion: gently warps band positions
    float distortN = (valueNoise(vUv * 4.0 + uTime * 0.15) - 0.5) * 2.0;
    float phase = proj * uSpacing * 6.28318 + uTime * uSpeed + uOffset
                + distortN * uDistort * 2.5;

    // Step 1: normal sine (band + gap). Step 2: abs(sin) doubles bands, no gap.
    float wave;
    if (uStep == 2) {
      wave = abs(sin(phase));
    } else {
      wave = sin(phase) * 0.5 + 0.5;
    }
    float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
    float bandMask  = smoothstep(edge, 1.0 - edge, wave);
    float thickMask = mix(bandMask, wave, uThickness);

    // Tilt: rotate each band like a venetian blind.
    // (wave - 0.5) is the signed cross-band position: -0.5..+0.5
    // uTilt  = tilt around long axis (asymmetric refraction across stripe)
    // uTilt2 = tilt around short axis (lean forward/backward along stripe)
    // uTiltZ = Z normal modulation: one edge flat (weak refraction),
    //          other edge steep (strong refraction)
    vec2  perp = vec2(-dir.y, dir.x);
    float crossPos = (wave - 0.5) * 2.0;
    float tiltNormal = uTilt * crossPos;
    float tiltNormal2 = uTilt2 * crossPos;
    float tiltZ = 1.0 + uTiltZ * crossPos;
    // Band cross-section shape determines the surface gradient:
    //   Flat:  sinusoidal profile — gradMag = cos(phase), peaks at edges
    //   Tube:  cylindrical — linear normal proportional to crossPos
    //   Fin:   tapered ridge — steep spine at center, fading to flat at edges
    float gradMag;
    if (uBandShape == 1) {
      gradMag = crossPos * STEEPNESS * 3.0;
    } else if (uBandShape == 2) {
      // Fin: sharp ridge at center (crossPos ≈ 0), tapering to zero at edges.
      // sign(crossPos) gives direction; pow() concentrates slope near spine.
      float absCross = abs(crossPos);
      gradMag = sign(crossPos) * pow(1.0 - absCross, 2.0) * STEEPNESS * 4.0;
    } else {
      gradMag = cos(phase) * STEEPNESS;
    }

    vec3  N = normalize(vec3((-gradMag + tiltNormal) * dir + tiltNormal2 * perp, max(tiltZ, 0.05)));

    float eta      = 1.0 / max(uIOR, 1.0);
    vec3  incident = vec3(0.0, 0.0, -1.0);
    vec3  refracted = refract(incident, N, eta);
    if (length(refracted) < 0.001) refracted = incident;

    float slope        = abs(cos(phase));
    float fresnelAtten = 1.0 - uFresnel * slope * slope;

    vec2 displacement = refracted.xy * thickMask * fresnelAtten;
    vec2 totalDisp    = displacement + bevelDisp(wave, slope, refracted);

    vec4 bg    = texture2D(uBackground, vUv + totalDisp);

    // Tinted glass: absorb color based on optical thickness (thickMask).
    // At band center (thickest glass) tint is strongest; edges are clear.
    vec3 tinted = mix(bg.rgb, bg.rgb * uTintColor, uTintStrength * thickMask);

    vec3 glint = bevelGlint(wave, slope, tinted);
    gl_FragColor = vec4(tinted + glint, bg.a);

  } else {
    // ─── BURST MODE ────────────────────────────────────────────────────────
    //
    // Rays radiate from (uBurstCenterX, uBurstCenterY). Wave is angular —
    // periodic in atan2 space so each ray is a wedge of constant angle.
    //
    // Integer uRaySpread is critical: sin(±π·k) = 0 for any integer k, so
    // the pattern is seamlessly continuous across the atan2 discontinuity at
    // angle = ±π (the leftward axis from center).

    vec2  delta = vUv - vec2(uBurstCenterX, uBurstCenterY);
    float dist  = length(delta);

    // Radial unit vector. Guard the center singularity with a small epsilon
    // so atan2 and the normal calculation stay well-defined.
    vec2  rDir  = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    float angle = atan(delta.y, delta.x); // ∈ [-π, π]

    // Angular phase → uRaySpread positive lobes = uRaySpread rays in 360°.
    float distortN = (valueNoise(vUv * 4.0 + uTime * 0.15) - 0.5) * 2.0;
    float phase = angle * uRaySpread + uTime * uSpeed + uOffset
                + distortN * uDistort * 2.5;

    float wave;
    if (uStep == 2) {
      wave = abs(sin(phase));
    } else {
      wave = sin(phase) * 0.5 + 0.5;
    }
    float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
    float bandMask  = smoothstep(edge, 1.0 - edge, wave);
    float thickMask = mix(bandMask, wave, uThickness);

    // Radial fade: smooth rise from the center singularity, smooth fall at
    // uRayLength. The 0.05 inner-fade radius keeps a clean dark core at origin.
    float innerFade  = smoothstep(0.0, 0.05, dist);
    float outerFade  = 1.0 - smoothstep(uRayLength * 0.72, uRayLength, dist);
    float radialFade = innerFade * outerFade;

    // Tilt: same venetian blind logic as parallel bands.
    // rDir = radial (cross-ray), tDir = tangential (along-ray).
    vec2  tDir = vec2(-rDir.y, rDir.x);
    float crossPos = (wave - 0.5) * 2.0;

    // Surface normal: shape-dependent gradient (same options as parallel bands).
    float slope   = abs(cos(phase));
    float gradMag;
    if (uBandShape == 1) {
      gradMag = crossPos * STEEPNESS * 3.0;
    } else if (uBandShape == 2) {
      float absCross = abs(crossPos);
      gradMag = sign(crossPos) * pow(1.0 - absCross, 2.0) * STEEPNESS * 4.0;
    } else {
      gradMag = slope * STEEPNESS;
    }
    float tiltNormal  = uTilt  * crossPos;
    float tiltNormal2 = uTilt2 * crossPos;
    float tiltZ = 1.0 + uTiltZ * crossPos;

    vec3  N = normalize(vec3((-gradMag + tiltNormal) * rDir + tiltNormal2 * tDir, max(tiltZ, 0.05)));

    float eta      = 1.0 / max(uIOR, 1.0);
    vec3  incident = vec3(0.0, 0.0, -1.0);
    vec3  refracted = refract(incident, N, eta);
    if (length(refracted) < 0.001) refracted = incident;

    float fresnelAtten = 1.0 - uFresnel * slope * slope;

    // Apply radialFade so refraction and bevel vanish where rays do.
    vec2 displacement = refracted.xy * thickMask * fresnelAtten * radialFade;
    vec2 totalDisp    = displacement + bevelDisp(wave, slope, refracted) * radialFade;

    vec4 bg    = texture2D(uBackground, vUv + totalDisp);

    // Tinted glass absorption
    vec3 tinted = mix(bg.rgb, bg.rgb * uTintColor, uTintStrength * thickMask * radialFade);

    vec3 glint = bevelGlint(wave, slope, tinted) * radialFade;

    // Ray intensity: additive brightness inside each ray streak.
    float rayFactor = bandMask * radialFade * uRayIntensity;
    vec3  rayAdd    = mix(tinted, vec3(1.0), 0.35) * rayFactor * 0.4;

    vec3 burstColor = tinted + rayAdd + glint;
    gl_FragColor = vec4(burstColor, bg.a);
  }
}
