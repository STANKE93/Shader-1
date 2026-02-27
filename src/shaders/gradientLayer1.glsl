#define MAX_STOPS 8
uniform vec3  uRampColors[MAX_STOPS];    // flat RGB, padded to 8
uniform float uRampPositions[MAX_STOPS]; // sorted 0..1, padded to 8
uniform int   uRampCount;

uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform vec2  uResolution;
uniform bool  uLinearDrift; // true = linear drift, false = radial growth
uniform float uDriftAngle;  // drift direction in radians (linear mode only)

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
    // f is 0 before this segment, 1 at its end; clamped so only the active
    // segment contributes — earlier segments have already set col.
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

  if (uLinearDrift) {
    // Linear drift: project UV onto the drift axis and translate over time.
    // A primary wave plus a secondary harmonic at 70% frequency adds gradient
    // richness without chaos. Shape and softness are pure sine — unchanged.
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    float proj = dot(vUv, dir);
    wave  = sin(proj * 6.28318 + t) * 0.5 + 0.5;
    wave += sin(proj * 4.39823 - t * 0.7) * 0.22; // sub-harmonic
    wave  = clamp(wave, 0.0, 1.0);
  } else {
    // Radial growth: concentric rings expanding from canvas centre.
    float dist = length(vUv - 0.5) * 2.8;
    wave = sin(dist * 3.14159 - t) * 0.5 + 0.5;
    // Soft falloff toward edges so rings fade naturally
    float falloff = 1.0 - smoothstep(0.55, 1.35, dist);
    wave = mix(0.5, wave, falloff);
  }

  gl_FragColor = vec4(evalRamp(wave), 1.0);
}
