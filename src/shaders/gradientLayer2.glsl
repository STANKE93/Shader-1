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
uniform float uRipple;         // [0..1]: radial ripple refraction depth
uniform float uRippleCount;   // ring density multiplier (default 7)
uniform float uRippleCompress; // sqrt compression factor (default 6)
uniform float uSweepSeam;       // sweep back-seam softness (0 = sharp, 1 = soft)
uniform float uSweepCenter;    // center blur radius (0 = sharp, 1 = soft)

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
  float pulse;

  if (uMode == 1) {
    // Linear drift
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    float proj = dot(vUv, dir);
    pulse  = sin(proj * 6.28318 + t) * 0.5 + 0.5;
    pulse += sin(proj * 4.39823 - t * 0.7) * 0.22; // sub-harmonic
    pulse  = clamp(pulse, 0.0, 1.0);
  } else if (uMode == 2) {
    // Sweep: rotating angular gradient
    vec2  delta = vUv - 0.5;
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x);
    float sweepAngle = -uTime * uSpeed * 1.5 + uOffset;
    float diff = angle - sweepAngle;
    diff = mod(diff + 3.14159265, 6.28318530) - 3.14159265;
    float softEdge = mix(2.5, 0.4, uDriftAngle / 6.28318);
    pulse = smoothstep(-softEdge, softEdge, -diff);
    // Back-seam softness
    float seamWidth = uSweepSeam * 1.8;
    float backFade = smoothstep(3.14159265, 3.14159265 - seamWidth, abs(diff));
    pulse = mix(0.5, pulse, backFade);
    // Center blur
    float centerFade = smoothstep(0.0, uSweepCenter * 0.5, dist);
    pulse = mix(0.5, pulse, centerFade);
  } else {
    // ─── Radial: topographic light surface ──────────────────────────────────
    vec2  delta  = vUv - 0.5;
    float dist   = length(delta);
    vec2  radDir = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);

    // Non-uniform contour compression via sqrt mapping
    float comp   = max(uRippleCompress, 0.01);
    float mapped = sqrt(max(dist, 0.0) * comp);

    // Atmospheric envelope
    float envelope = exp(-dist * 2.2) * smoothstep(0.0, 0.04, dist);

    // Primary wave + sub-harmonic
    float freq    = uRippleCount;
    float subFreq = freq * 0.614;
    float phase1  = mapped * freq - t;
    float phase2  = mapped * subFreq + t * 0.6;
    float height  = sin(phase1) * 0.78 + sin(phase2) * 0.22;

    pulse = height * envelope * 0.5 + 0.5;

    // Topographic directional lighting
    if (uRipple > 0.0) {
      float dMapped = (comp * 0.5) / max(sqrt(dist * comp), 0.15);
      float slope1 = cos(phase1) * freq * dMapped;
      float slope2 = cos(phase2) * subFreq * dMapped;
      float radialSlope = (slope1 * 0.78 + slope2 * 0.22) * envelope;

      vec2 grad = radDir * radialSlope;
      vec3 N = normalize(vec3(-grad * uRipple * 0.35, 1.0));
      vec3 L = normalize(vec3(0.4, 0.55, 1.0));
      float lighting = dot(N, L) * 0.5 + 0.5;

      pulse = pulse * mix(1.0, lighting, uRipple);
      pulse = clamp(pulse, 0.0, 1.0);
    }
  }

  gl_FragColor = vec4(evalRamp(pulse), pulse * 0.85);
}
