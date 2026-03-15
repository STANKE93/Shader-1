#define MAX_STOPS 8
uniform vec3  uRampColors[MAX_STOPS];    // flat RGB, padded to 8
uniform float uRampPositions[MAX_STOPS]; // sorted 0..1, padded to 8
uniform int   uRampCount;

uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform vec2  uResolution;
uniform int   uMode;             // 0 = radial, 1 = linear, 2 = sweep
uniform float uDriftAngle;       // drift direction in radians (linear mode only)
uniform float uRipple;         // radial ripple on/off (0 or 1)
uniform float uRippleCount;   // ring density multiplier (default 7)
uniform float uRippleCompress; // sqrt compression factor (default 6)
uniform float uLightAngle;    // light azimuth in radians
uniform float uShadowDepth;   // valley darkening (0-1)
uniform float uSweepSeam;       // sweep back-seam softness (0 = sharp, 1 = soft)
uniform float uSweepCenter;    // center blur radius (0 = sharp, 1 = soft)
uniform float uCenterX;        // radial/sweep center X [0..1]
uniform float uCenterY;        // radial/sweep center Y [0..1]

varying vec2 vUv;

// Evaluate a linear color ramp at position t in [0,1].
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
    // richness without chaos.
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    float proj = dot(vUv, dir);
    wave  = sin(proj * 6.28318 + t) * 0.5 + 0.5;
    wave += sin(proj * 4.39823 - t * 0.7) * 0.22; // sub-harmonic
    wave  = clamp(wave, 0.0, 1.0);
  } else if (uMode == 2) {
    // Sweep: rotating angular gradient — color ramp sweeps like a clock hand.
    vec2  delta = vUv - vec2(uCenterX, uCenterY);
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x); // [-π, π]
    float sweepAngle = -uTime * uSpeed * 1.5 + uOffset;
    float diff = angle - sweepAngle;
    diff = mod(diff + 3.14159265, 6.28318530) - 3.14159265;
    // Soft edge controlled by uDriftAngle remapped: 0° → wide, 360° → sharp
    float softEdge = mix(2.5, 0.4, uDriftAngle / 6.28318);
    wave = smoothstep(-softEdge, softEdge, -diff);
    // Back-seam softness
    float seamWidth = uSweepSeam * 1.8;
    float backFade = smoothstep(3.14159265, 3.14159265 - seamWidth, abs(diff));
    wave = mix(0.5, wave, backFade);
    // Center blur
    float centerFade = smoothstep(0.0, uSweepCenter * 0.5, dist);
    wave = mix(0.5, wave, centerFade);
  } else {
    // ─── Radial: topographic light surface ──────────────────────────────────
    //
    // Central force with non-uniform contour compression, subtle asymmetry,
    // and atmospheric falloff. Reads as a lit terrain / water-drop impact.

    vec2  delta  = vUv - vec2(uCenterX, uCenterY);
    float dist   = length(delta);
    vec2  radDir = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);

    // Non-uniform contour compression via sqrt mapping:
    // inner rings bunch tight (high energy near source), outer rings spread.
    // uRippleCompress: higher = tighter center bunching. 0 = even spacing (linear).
    float comp   = max(uRippleCompress, 0.01);
    float mapped = sqrt(max(dist, 0.0) * comp);

    // Atmospheric envelope: exponential energy dissipation from center.
    float envelope = exp(-dist * 2.2) * smoothstep(0.0, 0.04, dist);

    // Primary wave + counter-propagating sub-harmonic for organic feel.
    float freq    = uRippleCount;
    float subFreq = freq * 0.614; // sub-harmonic at ~61.4% (golden-ish ratio)
    float phase1  = mapped * freq - t;
    float phase2  = mapped * subFreq + t * 0.6;
    float height  = sin(phase1) * 0.78 + sin(phase2) * 0.22;

    wave = height * envelope * 0.5 + 0.5;

    // Ripple: topographic 3D lighting from the height field.
    if (uRipple > 0.0) {
      // d(mapped)/d(dist) = d(sqrt(dist*comp))/d(dist) = comp/(2*sqrt(dist*comp))
      float dMapped = (comp * 0.5) / max(sqrt(dist * comp), 0.15);

      // Radial slope: chain rule through both harmonics
      float slope1 = cos(phase1) * freq * dMapped;
      float slope2 = cos(phase2) * subFreq * dMapped;
      float radialSlope = (slope1 * 0.78 + slope2 * 0.22) * envelope;

      // 2D gradient in UV space → surface normal
      vec2 grad = radDir * radialSlope;
      vec3 N = normalize(vec3(-grad * 0.35, 1.0));

      // Light direction from angle (rotate in XY plane, fixed elevation)
      float lx = cos(uLightAngle) * 0.68;
      float ly = sin(uLightAngle) * 0.68;
      vec3 L = normalize(vec3(lx, ly, 1.0));

      // Diffuse: half-Lambert wrap
      float diffuse = dot(N, L) * 0.5 + 0.5;

      // Shadow: darken valleys using the raw height field
      float shadowMask = smoothstep(-0.3, 0.2, height);
      float shadow = mix(1.0, shadowMask, uShadowDepth);

      wave = wave * diffuse * shadow;
      wave = clamp(wave, 0.0, 1.0);
    }
  }

  gl_FragColor = vec4(evalRamp(wave), 1.0);
}
