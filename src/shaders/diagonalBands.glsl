uniform sampler2D uBackground;
uniform float     uTime;
uniform bool      uLayerEnabled;
uniform float     uSpeed;
uniform float     uOffset;
uniform float     uSpacing;       // parallel mode: band frequency across the diagonal
uniform float     uAngle;         // parallel mode: band direction in radians
uniform float     uSoftness;      // edge softness shared by all modes
uniform float     uIOR;           // index of refraction (1.0 = none, 1.5 = glass)
uniform float     uThickness;     // [0..1]: flat slab → smooth height-profile lens
uniform float     uFresnel;       // [0..1]: Fresnel edge attenuation strength
uniform float     uTilt;          // [-1..1]: venetian blind tilt across band
uniform float     uTilt2;         // [-1..1]: venetian blind tilt along band
uniform float     uTiltZ;         // [-1..1]: Z normal modulation (steepness gradient)
uniform float     uBevelWidth;    // [0..1]: half-width of bevel highlight
uniform float     uBevelIntensity;// [0..2]: peak brightness of bevel glint
uniform vec3      uTintColor;     // tinted glass absorption color (linear RGB)
uniform float     uTintStrength;  // [0..1]: tint intensity (0 = clear glass)
uniform int       uStep;          // 1 = normal (band + gap), 2 = doubled (no gap)
uniform int       uBandInvert;    // 0 = normal, 1 = invert (swap glass/gap), 2 = both
uniform float     uDistort;       // [0..1]: noise-based band distortion
uniform float     uBlur;          // [0..1]: glass blur diffusion (multi-tap)
uniform float     uRoughness;     // [0..1]: surface roughness — 0 mirror, 1 matte
uniform int       uBandRandom;   // 0 = uniform spacing, 1 = non-uniform
uniform float     uBandSeed;     // randomizes non-uniform band layout

// Mode: 0 = parallel, 1 = burst, 2 = orbit, 3 = fan, 4 = spiral, 5 = globe
uniform int       uBandsMode;
uniform float     uBurstCenterX;  // burst/orbit origin X in UV space [0..1]
uniform float     uBurstCenterY;  // burst/orbit origin Y in UV space [0..1]
uniform float     uRaySpread;     // ray count — keep integer to avoid ±π seam
uniform float     uRayLength;     // radial extent of rays in UV units
uniform float     uRayIntensity;  // additive brightness of the ray interior

// Prism mode
uniform float     uPrismSeed;     // randomizes facet layout
uniform float     uPrismDepth;    // facet tilt intensity (0 = flat, 1 = steep)

// Globe mode
uniform float     uGlobeRadius;   // radius in UV units (0.05..0.5)
uniform vec3      uFresnelColor;  // tint color for Fresnel rim light
uniform float     uAtmoGlow;      // atmospheric glow intensity (0..1)
uniform vec3      uAtmoColor;     // atmospheric glow color
uniform float     uGlobeEdge;     // edge softness (0 = sharp, 1 = very soft)

varying vec2 vUv;

// Surface steepness — artistic constant
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
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 2D → 2D hash for Voronoi cell centers
vec2 hash22(vec2 p) {
  vec3 a = fract(vec3(p.xyx) * vec3(233.34, 851.73, 317.15));
  a += dot(a, a.yzx + 23.45);
  return fract(vec2(a.x * a.y, a.y * a.z));
}

// ─── Schlick Fresnel ─────────────────────────────────────────────────────────
float schlickFresnel(float cosTheta, float ior) {
  float R0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
  return R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);
}

// ─── Blinn-Phong specular from virtual light ────────────────────────────────
// Roughness scales the specular power: 0 = mirror (high power), 1 = matte (low power)
float glassSpecular(vec3 N, float specWidth) {
  vec3 H = normalize(vec3(0.4, 0.6, 2.0));
  float NdotH = max(dot(N, H), 0.0);
  float basePower = mix(256.0, 16.0, specWidth);
  // Roughness reduces specular sharpness: rough^2 for perceptual linearity
  float r2 = uRoughness * uRoughness;
  float power = basePower * mix(1.0, 0.06, r2);   // at max roughness, power drops ~16x
  return pow(NdotH, power);
}

// ─── Multi-tap directional blur ─────────────────────────────────────────────
vec3 blurSample(vec2 baseUV, vec2 blurDir, float radius) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = (float(i) - 3.0) / 3.0;
    sum += texture2D(uBackground, baseUV + blurDir * fi * radius).rgb;
  }
  return sum / 7.0;
}

// ─── Shared wave computation ────────────────────────────────────────────────
// Returns: wave, bandMask, thickMask
// Inputs: raw phase from the coordinate system
void computeBand(float phase, out float wave, out float bandMask, out float thickMask) {
  if (uStep == 2) {
    wave = abs(sin(phase));
  } else {
    wave = sin(phase) * 0.5 + 0.5;
  }
  if (uBandInvert == 1) wave = 1.0 - wave;

  float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
  bandMask = smoothstep(edge, 1.0 - edge, wave);

  if (uBandInvert == 2) { bandMask = 1.0; wave = 1.0; }

  thickMask = mix(bandMask, wave, uThickness);
}

// ─── Shared glass compositing ───────────────────────────────────────────────
// Computes refraction, blur, tint, fresnel rim, specular
vec3 compositeGlass(vec3 N, float thickMask, float fadeMask) {
  float eta      = 1.0 / max(uIOR, 1.0);
  vec3  incident = vec3(0.0, 0.0, -1.0);
  vec3  refracted = refract(incident, N, eta);
  if (length(refracted) < 0.001) refracted = incident; // TIR guard

  float cosTheta    = max(N.z, 0.0);
  float fresnel     = schlickFresnel(cosTheta, uIOR);
  float transmission = 1.0 - fresnel * uFresnel;

  vec2  baseDisp   = refracted.xy * thickMask * transmission * fadeMask;

  // Roughness: scatter refraction (frosted glass) + diffuse blur
  float r2 = uRoughness * uRoughness;
  // Noise-based scatter: randomize refraction offset per pixel
  float scatter = r2 * 0.04;
  vec2 noiseUV = vUv * 30.0 + N.xy * 5.0;
  vec2 scatterOff = vec2(
    hash21(noiseUV) - 0.5,
    hash21(noiseUV + 7.13) - 0.5
  ) * scatter * thickMask * fadeMask;
  baseDisp += scatterOff;

  // Blur radius: artistic control + roughness-driven diffusion
  float roughBlur  = r2 * 0.06;
  float blurRadius = thickMask * (uBlur * 0.015 + roughBlur) * fadeMask;
  vec3  bg;
  if (blurRadius > 0.0001) {
    bg = blurSample(vUv + baseDisp, N.xy, blurRadius);
  } else {
    bg = texture2D(uBackground, vUv + baseDisp).rgb;
  }

  vec3 tinted   = mix(bg, bg * uTintColor, uTintStrength * thickMask * fadeMask);
  vec3 rimLight = vec3(fresnel * uFresnel * 0.5) * thickMask * fadeMask;
  float spec    = glassSpecular(N, uBevelWidth);
  vec3 specular = vec3(0.9, 0.95, 1.0) * spec * uBevelIntensity * fresnel * thickMask * fadeMask;

  return tinted + rimLight + specular;
}

// ─── Shared surface normal from tilt system ─────────────────────────────────
vec3 buildNormal(float phase, float wave, vec2 axisDir, vec2 perpDir) {
  float crossPos = (wave - 0.5) * 2.0;
  float gradMag  = cos(phase) * STEEPNESS;

  float tiltNormal  = uTilt  * crossPos;
  float tiltNormal2 = uTilt2 * crossPos;
  float tiltZ       = 1.0 + uTiltZ * crossPos;

  return normalize(vec3((-gradMag + tiltNormal) * axisDir + tiltNormal2 * perpDir, max(tiltZ, 0.05)));
}

// ─── Non-uniform band spacing ─────────────────────────────────────────────
// Warps the phase coordinate so each band gets a different width.
// Uses cumulative random offsets per band cell for smooth transitions.
float nonUniformPhase(float phase) {
  if (uBandRandom == 0) return phase;
  float cell = floor(phase / 6.28318);
  float frac = fract(phase / 6.28318);
  // Per-cell random offset: shifts each band boundary
  float r0 = hash21(vec2(cell, uBandSeed * 13.7)) - 0.5;
  float r1 = hash21(vec2(cell + 1.0, uBandSeed * 13.7)) - 0.5;
  // Smooth interpolation between cell offsets
  float warp = mix(r0, r1, frac * frac * (3.0 - 2.0 * frac)) * 3.5;
  return phase + warp;
}

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  // Noise distortion shared by all modes
  float distortN = (valueNoise(vUv * 4.0 + uTime * 0.15) - 0.5) * 2.0;

  if (uBandsMode == 0) {
    // ─── PARALLEL BANDS ──────────────────────────────────────────────────

    vec2  dir   = vec2(cos(uAngle), sin(uAngle));
    vec2  perp  = vec2(-dir.y, dir.x);
    float proj  = dot(vUv, dir);
    float phase = proj * uSpacing * 6.28318 + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;
    phase = nonUniformPhase(phase);

    float wave, bandMask, thickMask;
    computeBand(phase, wave, bandMask, thickMask);

    vec3  N   = buildNormal(phase, wave, dir, perp);
    vec3  col = compositeGlass(N, thickMask, 1.0);

    gl_FragColor = vec4(col, 1.0);

  } else if (uBandsMode == 1) {
    // ─── BURST MODE ──────────────────────────────────────────────────────

    vec2  delta = vUv - vec2(uBurstCenterX, uBurstCenterY);
    float dist  = length(delta);
    vec2  rDir  = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    vec2  tDir  = vec2(-rDir.y, rDir.x);
    float angle = atan(delta.y, delta.x);

    float phase = angle * uRaySpread + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;
    phase = nonUniformPhase(phase);

    float wave, bandMask, thickMask;
    computeBand(phase, wave, bandMask, thickMask);

    // Radial fade: smooth rise from center, smooth fall at uRayLength
    float innerFade  = smoothstep(0.0, 0.05, dist);
    float outerFade  = 1.0 - smoothstep(uRayLength * 0.72, uRayLength, dist);
    float radialFade = innerFade * outerFade;

    vec3  N   = buildNormal(phase, wave, rDir, tDir);
    vec3  col = compositeGlass(N, thickMask, radialFade);

    // Ray intensity: additive brightness inside each ray streak
    float rayFactor = bandMask * radialFade * uRayIntensity;
    vec3  rayAdd    = mix(col, vec3(1.0), 0.35) * rayFactor * 0.4;

    gl_FragColor = vec4(col + rayAdd, 1.0);

  } else if (uBandsMode == 2) {
    // ─── ORBIT MODE ──────────────────────────────────────────────────────

    vec2  center = vec2(uBurstCenterX, uBurstCenterY);
    vec2  delta  = vUv - center;
    float dist   = length(delta);
    vec2  rDir   = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    vec2  tDir   = vec2(-rDir.y, rDir.x);

    float phase = dist * uSpacing * 6.28318 + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;

    float wave, bandMask, thickMask;
    computeBand(phase, wave, bandMask, thickMask);

    vec3  N   = buildNormal(phase, wave, rDir, tDir);
    vec3  col = compositeGlass(N, thickMask, 1.0);

    gl_FragColor = vec4(col, 1.0);

  } else if (uBandsMode == 3) {
    // ─── FAN MODE ────────────────────────────────────────────────────────
    //
    // Perspective-projected parallel bands converging toward a vanishing
    // point at a screen corner. Uses projective division (lateral / depth)
    // so bands compress near the VP and spread further away.
    // Pixels behind the VP (depth <= 0) fade to clean passthrough.

    vec2  vp    = vec2(uBurstCenterX, uBurstCenterY);
    vec2  delta = vUv - vp;
    vec2  dir   = vec2(cos(uAngle), sin(uAngle));
    vec2  perp  = vec2(-dir.y, dir.x);

    float depth   = dot(delta, dir);
    float lateral = dot(delta, perp);

    // Fade to passthrough behind the VP
    float fanMask = smoothstep(0.0, 0.05, depth);

    float perspCoord = lateral / max(depth, 0.012);

    // Fade out extreme edges where bands compress below readable size
    fanMask *= 1.0 - smoothstep(3.5, 5.5, abs(perspCoord));

    float phase = perspCoord * uSpacing + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;
    phase = nonUniformPhase(phase);

    float wave, bandMask, thickMask;
    computeBand(phase, wave, bandMask, thickMask);

    // Per-pixel band directions radiate from the VP
    float dist = length(delta);
    vec2  rDir = dist > 0.001 ? delta / dist : dir;
    vec2  tDir = vec2(-rDir.y, rDir.x);

    vec3  N   = buildNormal(phase, wave, rDir, tDir);
    vec3  col = compositeGlass(N, thickMask, fanMask);

    // Blend with clean background behind the VP
    vec3  bg  = texture2D(uBackground, vUv).rgb;
    gl_FragColor = vec4(mix(bg, col, fanMask), 1.0);

  } else if (uBandsMode == 4) {
    // ─── SPIRAL MODE ─────────────────────────────────────────────────────
    //
    // Single-arm logarithmic spiral (koru). log(dist) compresses inner
    // coils naturally. Angle coefficient = 1 (integer) → no atan seam.

    vec2  center = vec2(uBurstCenterX, uBurstCenterY);
    vec2  delta  = vUv - center;
    float dist   = length(delta);
    float angle  = atan(delta.y, delta.x);
    vec2  rDir   = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    vec2  tDir   = vec2(-rDir.y, rDir.x);

    // Logarithmic spiral: log(r) makes inner coils tighter
    float logR  = log(max(dist, 0.0001));
    float phase = logR * uSpacing - angle + uTime * uSpeed + uOffset
                + distortN * uDistort * 8.0;
    phase = nonUniformPhase(phase);

    float wave, bandMask, thickMask;
    computeBand(phase, wave, bandMask, thickMask);

    // Fade near center where spiral converges
    float centerFade = smoothstep(0.0, 0.04, dist);
    thickMask *= centerFade;
    bandMask  *= centerFade;

    vec3  N   = buildNormal(phase, wave, rDir, tDir);
    vec3  col = compositeGlass(N, thickMask, centerFade);

    gl_FragColor = vec4(col, 1.0);

  } else if (uBandsMode == 5) {
    // ─── GLOBE MODE ───────────────────────────────────────────────────────
    //
    // Glass sphere with hemisphere normals, volumetric depth cues,
    // and radial edge blur to dissolve aliasing at the boundary.
    // No hard if/else at the circle edge — everything is a soft field.

    vec2  center = vec2(uBurstCenterX, uBurstCenterY);
    vec2  delta  = vUv - center;
    float dist   = length(delta);
    float r      = max(uGlobeRadius, 0.01);
    float nd     = dist / r;

    vec3 bg = texture2D(uBackground, vUv).rgb;

    // Edge softness zone: uGlobeEdge controls how far inward the blend extends
    // 0 = tight (2% of radius), 1 = very soft (25% of radius)
    float softWidth = mix(0.02, 0.25, uGlobeEdge);
    float edgeFade = smoothstep(1.0, 1.0 - softWidth, nd);

    // ── Atmospheric glow (both sides of the edge) ──
    // Extends outward as a halo and inward as rim glow — bridges the boundary
    float glowDist = max(nd - 1.0, 0.0) / max(r, 0.01);
    float outerGlow = exp(-glowDist * 3.0) * uAtmoGlow * (1.0 - edgeFade);
    vec3 atmo = uAtmoColor * outerGlow;

    // Contact shadow (outside only)
    float shadowDist = max(nd - 1.0, 0.0) * r * 800.0;
    float shadow = 1.0 - 0.15 * exp(-shadowDist * 0.8) * (1.0 - edgeFade);

    if (edgeFade < 0.001) {
      // Fully outside — just atmosphere + shadow, skip glass math
      gl_FragColor = vec4(bg * shadow + atmo, 1.0);
    } else {
      // ── Radial edge blur ──
      // Near the rim, sample the globe at multiple radial offsets and average.
      // This dissolves the aliased circle boundary into a smooth optical falloff.
      // Blur intensity ramps up only in the edge zone for efficiency.
      float edgeProximity = smoothstep(1.0 - softWidth * 1.5, 1.0, nd);
      float blurSpread = edgeProximity * uGlobeEdge * r * 0.06;

      // 8-tap radial ring + center = 9 samples (only when blurSpread > 0)
      vec3 col = vec3(0.0);
      float totalWeight = 0.0;

      // Tap offsets: center + 8 directions at 45° increments
      for (int i = 0; i < 9; i++) {
        vec2 offset = vec2(0.0);
        if (i > 0) {
          float angle = float(i - 1) * 0.7854; // pi/4
          offset = vec2(cos(angle), sin(angle)) * blurSpread;
        }
        vec2 sampleDelta = delta + offset;
        float sampleDist = length(sampleDelta);
        float sampleNd = sampleDist / r;

        // Weight: center tap strongest, outer taps fall off
        float w = (i == 0) ? 2.0 : 1.0;

        if (sampleNd < 1.0) {
          // This tap is inside the globe — compute glass
          vec2  sNxy = sampleDelta / r;
          float sNz  = sqrt(1.0 - sampleNd * sampleNd);

          float sTiltX = uTilt  * sNxy.x * 2.0;
          float sTiltY = uTilt2 * sNxy.y * 2.0;
          float sTiltZ = sNz + uTiltZ * sampleNd;
          vec3 sN = normalize(vec3(sNxy.x + sTiltX, sNxy.y + sTiltY, max(sTiltZ, 0.05)));

          float sThick = mix(1.0, sNz, uThickness);
          float sFade  = smoothstep(1.0, 1.0 - softWidth, sampleNd);

          vec3 sCol = compositeGlass(sN, sThick * sFade, sFade);

          // Caustic
          sCol *= 1.0 + smoothstep(0.35, 0.0, sampleNd) * (uIOR - 1.0) * 0.8;

          // Secondary specular
          vec3 sH2 = normalize(vec3(-0.3, -0.5, 2.0));
          sCol += vec3(0.85, 0.9, 1.0) * pow(max(dot(sN, sH2), 0.0), 128.0)
                  * uBevelIntensity * 0.3 * sFade;

          // Fresnel rim
          float sFresnel = pow(1.0 - sNz, 5.0);
          sCol += uFresnelColor * sFresnel * uFresnel * sFade;

          // Inner atmosphere
          sCol += uAtmoColor * pow(1.0 - sNz, 3.0) * uAtmoGlow * 0.4 * sFade;

          col += sCol * w;
        } else {
          // This tap is outside — sample background (this naturally blends the edge)
          vec2 tapUv = vUv + offset;
          col += texture2D(uBackground, tapUv).rgb * w;
        }
        totalWeight += w;
      }
      col /= totalWeight;

      // Final blend with background
      gl_FragColor = vec4(mix(bg * shadow + atmo, col, edgeFade), 1.0);
    }

  } else {
    gl_FragColor = texture2D(uBackground, vUv);
  }
}
