#define MAX_STOPS 8
uniform vec3  uRampColors[MAX_STOPS];    // flat RGB, padded to 8
uniform float uRampPositions[MAX_STOPS]; // sorted 0..1, padded to 8
uniform int   uRampCount;

uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform vec2  uResolution;
uniform int   uMode;             // 0 = radial, 1 = linear, 2 = noise, 3 = sweep
uniform float uDriftAngle;       // drift direction in radians (linear mode only)
uniform float uNoiseScale;       // spatial frequency of noise patches (noise mode only)
uniform float uDetail;           // fractal octave count (1–8, float for smooth blending)
uniform float uDimension;        // fractal dimension H — higher = smoother (0–2)
uniform float uNoiseDepth;       // emboss/3D lighting intensity (0 = flat, 1 = full)
uniform float uLiquifyStrength;  // domain-warp displacement magnitude (noise mode only)
uniform float uLiquifyScale;     // spatial frequency of the flow vector field
uniform float uLiquifySpeed;     // temporal rate of the flow field (independent of uSpeed)
uniform float uSweepSeam;       // sweep back-seam softness (0 = sharp, 1 = soft)
uniform float uSweepCenter;    // center blur radius (0 = sharp, 1 = soft)

varying vec2 vUv;

// Evaluate a linear color ramp at position t in [0,1].
// Iterates at most MAX_STOPS-1 = 7 times — cheap per CLAUDE.md perf rules.
vec3 evalRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 col = uRampColors[0];
  for (int i = 1; i < MAX_STOPS; i++) {
    if (i >= uRampCount) break;
    float prev = uRampPositions[i - 1];
    float span = uRampPositions[i] - prev;
    float f = span > 0.0 ? clamp((t - prev) / span, 0.0, 1.0) : 1.0;
    col = mix(uRampColors[i - 1], uRampColors[i], f);
  }
  return col;
}

// Hash for value noise — low-cost, no texture lookup needed.
float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// Single-octave value noise with quintic smoothstep (C2 continuity, no grid artefacts).
float valueNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash21(i),                  hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Musgrave fBM — fractal Brownian motion with dimension-controlled roughness.
// Each octave's amplitude is scaled by lacunarity^(-H) where H = uDimension.
// Higher H → smoother (high-frequency octaves contribute less).
// uDetail controls octave count as a float for smooth transitions.
float musgraveFBM(vec2 uv) {
  const float lacunarity = 2.0;
  float sum   = 0.0;
  float amp   = 1.0;
  float freq  = 1.0;
  float maxAmp = 0.0;
  int octaves = int(ceil(uDetail));
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    // Smooth last octave contribution for fractional uDetail
    float w = (i == octaves - 1) ? fract(uDetail) : 1.0;
    if (w <= 0.0 && i == octaves - 1) w = 1.0; // integer detail = full last octave
    sum    += valueNoise(uv * freq) * amp * w;
    maxAmp += amp * w;
    freq   *= lacunarity;
    amp    *= pow(lacunarity, -uDimension);
  }
  return sum / maxAmp; // normalize to [0, 1]
}

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = uTime * uSpeed + uOffset;
  float wave;

  if (uMode == 1) {
    // Linear drift: project UV onto the drift axis and translate over time.
    // A primary wave plus a secondary harmonic at 70% frequency adds gradient
    // richness without chaos. Shape and softness are pure sine — unchanged.
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    float proj = dot(vUv, dir);
    wave  = sin(proj * 6.28318 + t) * 0.5 + 0.5;
    wave += sin(proj * 4.39823 - t * 0.7) * 0.22; // sub-harmonic
    wave  = clamp(wave, 0.0, 1.0);
  } else if (uMode == 2) {
    // Noise: organic gradient driven by animated value noise.
    //
    // Liquify: domain-warp vUv using a secondary low-frequency vector field
    // before sampling the main noise. Two decorrelated noise samples give
    // independent X and Y displacement so warping isn't diagonally biased.
    vec2 flowCoord = vUv * uLiquifyScale + uTime * uLiquifySpeed;
    float fx = valueNoise(flowCoord)              * 2.0 - 1.0; // [-1, 1]
    float fy = valueNoise(flowCoord + vec2(3.7, 8.3)) * 2.0 - 1.0;
    vec2 warpedUV = vUv + vec2(fx, fy) * uLiquifyStrength;

    vec2 noiseCoord = warpedUV * uNoiseScale + vec2(t * 0.31, t * 0.17);
    wave = musgraveFBM(noiseCoord);

    // Depth: treat noise as a height field, compute gradient via finite
    // differences, derive a surface normal, and apply directional lighting.
    // Light from upper-left creates natural highlight/shadow emboss.
    if (uNoiseDepth > 0.0) {
      float eps = 0.008;
      float hR = musgraveFBM(noiseCoord + vec2(eps, 0.0));
      float hU = musgraveFBM(noiseCoord + vec2(0.0, eps));
      // Surface normal from height gradient (Z scale controls emboss strength)
      vec3 N = normalize(vec3(wave - hR, wave - hU, 0.15));
      // Light from upper-left
      vec3 L = normalize(vec3(0.5, 0.7, 1.0));
      float lighting = dot(N, L) * 0.5 + 0.5; // remap to 0..1
      // Blend: 1.0 = flat (no depth), lighting = full emboss
      wave = wave * mix(1.0, lighting, uNoiseDepth);
      wave = clamp(wave, 0.0, 1.0);
    }
  } else if (uMode == 3) {
    // Sweep: rotating angular gradient — color ramp sweeps like a clock hand.
    vec2  delta = vUv - 0.5;
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x); // [-π, π]
    float sweepAngle = -uTime * uSpeed * 1.5 + uOffset;
    float diff = angle - sweepAngle;
    diff = mod(diff + 3.14159265, 6.28318530) - 3.14159265;
    // Soft edge controlled by uDriftAngle remapped: 0° → wide, 360° → sharp
    float softEdge = mix(2.5, 0.4, uDriftAngle / 6.28318);
    wave = smoothstep(-softEdge, softEdge, -diff);
    // Back-seam softness: fade the hard line at the opposite side of the
    // sweep arm (where diff wraps at ±π) by blending toward mid-ramp.
    float seamWidth = uSweepSeam * 1.8;
    float backFade = smoothstep(3.14159265, 3.14159265 - seamWidth, abs(diff));
    wave = mix(0.5, wave, backFade);
    // Center blur: dissolve the seam where it converges at the middle
    float centerFade = smoothstep(0.0, uSweepCenter * 0.5, dist);
    wave = mix(0.5, wave, centerFade);
  } else {
    // Radial growth: concentric rings expanding from canvas centre.
    float dist = length(vUv - 0.5) * 2.8;
    wave = sin(dist * 3.14159 - t) * 0.5 + 0.5;
    float falloff = 1.0 - smoothstep(0.55, 1.35, dist);
    wave = mix(0.5, wave, falloff);
  }

  gl_FragColor = vec4(evalRamp(wave), 1.0);
}
