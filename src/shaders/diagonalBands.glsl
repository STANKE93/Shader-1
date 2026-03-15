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
uniform int       uBandInvert;    // 0 = normal, 1 = invert (swap glass/gap), 2 = both (full glass)
uniform float     uDistort;       // [0..1]: noise-based band distortion
uniform float     uBlur;          // [0..1]: glass blur diffusion (multi-tap)

// Mode: 0 = parallel, 1 = burst, 2 = orbit
uniform int       uBandsMode;
uniform float     uBurstCenterX;  // burst/orbit origin X in UV space [0..1]
uniform float     uBurstCenterY;  // burst/orbit origin Y in UV space [0..1]
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

// ─── Schlick Fresnel ─────────────────────────────────────────────────────────
// Returns reflection coefficient [0..1]. cosTheta = N.z (view-aligned normal).
float schlickFresnel(float cosTheta, float ior) {
  float R0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
  return R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);
}

// ─── Blinn-Phong specular from virtual light ────────────────────────────────
// Light from upper-left; H is precomputed constant.
// specWidth remaps: 0 = tight highlight, 1 = broad soft highlight.
float glassSpecular(vec3 N, float specWidth) {
  vec3 H = normalize(vec3(0.4, 0.6, 2.0)); // half-vector: L + V, V = (0,0,1)
  float NdotH = max(dot(N, H), 0.0);
  float power = mix(256.0, 16.0, specWidth);
  return pow(NdotH, power);
}

// ─── Multi-tap directional blur ─────────────────────────────────────────────
// Samples background along the surface normal direction, scaled by thickness.
// 7 taps in a line — cheap directional blur that reads as optical diffusion.
vec3 blurSample(vec2 baseUV, vec2 blurDir, float radius) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = (float(i) - 3.0) / 3.0; // -1..1
    sum += texture2D(uBackground, baseUV + blurDir * fi * radius).rgb;
  }
  return sum / 7.0;
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
                + distortN * uDistort * 8.0;

    // Step 1: normal sine (band + gap). Step 2: abs(sin) doubles bands, no gap.
    float wave;
    if (uStep == 2) {
      wave = abs(sin(phase));
    } else {
      wave = sin(phase) * 0.5 + 0.5;
    }
    // Invert: swap glass and gap regions
    if (uBandInvert == 1) wave = 1.0 - wave;

    float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
    float bandMask  = smoothstep(edge, 1.0 - edge, wave);

    // Both: entire surface is glass — no gaps, uniform refraction
    if (uBandInvert == 2) { bandMask = 1.0; wave = 1.0; }

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

    // Schlick Fresnel: edges reflect more, transmit less
    float cosTheta    = max(N.z, 0.0);
    float fresnel     = schlickFresnel(cosTheta, uIOR);
    float transmission = 1.0 - fresnel * uFresnel;

    // Refracted background with directional blur
    vec2  baseDisp   = refracted.xy * thickMask * transmission;
    float blurRadius = thickMask * uBlur * 0.015;
    vec3  bg;
    if (blurRadius > 0.0001) {
      bg = blurSample(vUv + baseDisp, N.xy, blurRadius);
    } else {
      bg = texture2D(uBackground, vUv + baseDisp).rgb;
    }

    // Tinted glass absorption — stronger through thick glass
    vec3 tinted = mix(bg, bg * uTintColor, uTintStrength * thickMask);

    // Fresnel rim light — bright edge reflection
    vec3 rimLight = vec3(fresnel * uFresnel * 0.5) * thickMask;

    // Blinn-Phong specular highlight from virtual light
    float spec = glassSpecular(N, uBevelWidth);
    vec3 specular = vec3(0.9, 0.95, 1.0) * spec * uBevelIntensity * fresnel * thickMask;

    gl_FragColor = vec4(tinted + rimLight + specular, 1.0);

  } else if (uBandsMode == 1) {
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
                + distortN * uDistort * 8.0;

    float wave;
    if (uStep == 2) {
      wave = abs(sin(phase));
    } else {
      wave = sin(phase) * 0.5 + 0.5;
    }
    // Invert: swap glass and gap regions
    if (uBandInvert == 1) wave = 1.0 - wave;

    float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
    float bandMask  = smoothstep(edge, 1.0 - edge, wave);

    // Both: entire surface is glass — no gaps, uniform refraction
    if (uBandInvert == 2) { bandMask = 1.0; wave = 1.0; }

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

    // Schlick Fresnel
    float cosTheta    = max(N.z, 0.0);
    float fresnel     = schlickFresnel(cosTheta, uIOR);
    float transmission = 1.0 - fresnel * uFresnel;

    // Refracted background with directional blur, faded by radial extent
    vec2  baseDisp   = refracted.xy * thickMask * transmission * radialFade;
    float blurRadius = thickMask * uBlur * 0.015 * radialFade;
    vec3  bg;
    if (blurRadius > 0.0001) {
      bg = blurSample(vUv + baseDisp, N.xy, blurRadius);
    } else {
      bg = texture2D(uBackground, vUv + baseDisp).rgb;
    }

    // Tinted glass absorption
    vec3 tinted = mix(bg, bg * uTintColor, uTintStrength * thickMask * radialFade);

    // Fresnel rim light
    vec3 rimLight = vec3(fresnel * uFresnel * 0.5) * thickMask * radialFade;

    // Blinn-Phong specular
    float spec = glassSpecular(N, uBevelWidth);
    vec3 specular = vec3(0.9, 0.95, 1.0) * spec * uBevelIntensity * fresnel * thickMask * radialFade;

    // Ray intensity: additive brightness inside each ray streak
    float rayFactor = bandMask * radialFade * uRayIntensity;
    vec3  rayAdd    = mix(tinted, vec3(1.0), 0.35) * rayFactor * 0.4;

    gl_FragColor = vec4(tinted + rimLight + specular + rayAdd, 1.0);

  } else if (uBandsMode == 2) {
    // ─── ORBIT MODE ──────────────────────────────────────────────────────
    //
    // Concentric ring bands emanating from (uBurstCenterX, uBurstCenterY).
    // Wave is radial — periodic in distance from center, so each ring is a
    // concentric circle. Rings animate outward/inward over time.

    vec2  center = vec2(uBurstCenterX, uBurstCenterY);
    vec2  delta  = vUv - center;
    float dist   = length(delta);

    // Radial and tangential unit vectors
    vec2  rDir = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    vec2  tDir = vec2(-rDir.y, rDir.x);

    // Radial phase — uSpacing controls ring density, time animates outward
    float distortN = (valueNoise(vUv * 4.0 + uTime * 0.15) - 0.5) * 2.0;
    float phase = dist * uSpacing * 6.28318 + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;

    float wave;
    if (uStep == 2) {
      wave = abs(sin(phase));
    } else {
      wave = sin(phase) * 0.5 + 0.5;
    }
    if (uBandInvert == 1) wave = 1.0 - wave;

    float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
    float bandMask  = smoothstep(edge, 1.0 - edge, wave);

    if (uBandInvert == 2) { bandMask = 1.0; wave = 1.0; }

    float thickMask = mix(bandMask, wave, uThickness);

    // Tilt: same venetian blind logic, rDir = cross-ring, tDir = along-ring
    float crossPos = (wave - 0.5) * 2.0;

    float gradMag;
    if (uBandShape == 1) {
      gradMag = crossPos * STEEPNESS * 3.0;
    } else if (uBandShape == 2) {
      float absCross = abs(crossPos);
      gradMag = sign(crossPos) * pow(1.0 - absCross, 2.0) * STEEPNESS * 4.0;
    } else {
      gradMag = cos(phase) * STEEPNESS;
    }
    float tiltNormal  = uTilt  * crossPos;
    float tiltNormal2 = uTilt2 * crossPos;
    float tiltZ = 1.0 + uTiltZ * crossPos;

    vec3  N = normalize(vec3((-gradMag + tiltNormal) * rDir + tiltNormal2 * tDir, max(tiltZ, 0.05)));

    float eta      = 1.0 / max(uIOR, 1.0);
    vec3  incident = vec3(0.0, 0.0, -1.0);
    vec3  refracted = refract(incident, N, eta);
    if (length(refracted) < 0.001) refracted = incident;

    // Schlick Fresnel
    float cosTheta    = max(N.z, 0.0);
    float fresnel     = schlickFresnel(cosTheta, uIOR);
    float transmission = 1.0 - fresnel * uFresnel;

    // Refracted background with directional blur
    vec2  baseDisp   = refracted.xy * thickMask * transmission;
    float blurRadius = thickMask * uBlur * 0.015;
    vec3  bg;
    if (blurRadius > 0.0001) {
      bg = blurSample(vUv + baseDisp, N.xy, blurRadius);
    } else {
      bg = texture2D(uBackground, vUv + baseDisp).rgb;
    }

    // Tinted glass absorption
    vec3 tinted = mix(bg, bg * uTintColor, uTintStrength * thickMask);

    // Fresnel rim light
    vec3 rimLight = vec3(fresnel * uFresnel * 0.5) * thickMask;

    // Blinn-Phong specular
    float spec = glassSpecular(N, uBevelWidth);
    vec3 specular = vec3(0.9, 0.95, 1.0) * spec * uBevelIntensity * fresnel * thickMask;

    gl_FragColor = vec4(tinted + rimLight + specular, 1.0);
  } else {
    // Fallback: pass through background
    gl_FragColor = texture2D(uBackground, vUv);
  }
}
