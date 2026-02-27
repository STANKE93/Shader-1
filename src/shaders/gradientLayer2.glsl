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

  if (uLinearDrift) {
    // Linear drift: wave bands travelling along uDriftAngle.
    // Perpendicular fade preserves the layer's characteristic softness so
    // switching modes does not harden the edges or change alpha behaviour.
    vec2  dir      = vec2(cos(uDriftAngle), sin(uDriftAngle));
    vec2  perp     = vec2(-dir.y, dir.x);
    float proj     = dot(vUv - 0.5, dir);
    float perpDist = abs(dot(vUv - 0.5, perp));

    pulse = sin(proj * 8.0 - t * 2.0) * 0.5 + 0.5;
    pulse = clamp(pulse, 0.0, 1.0);

    // Soft fade perpendicular to travel — mirrors the vignette from radial mode
    float fade = 1.0 - smoothstep(0.2, 0.52, perpDist);
    pulse *= fade;
  } else {
    // Radial growth: rings pulsing from centre (original behaviour, unchanged)
    vec2  center   = vUv - 0.5;
    float dist     = length(center);
    pulse = sin(dist * 8.0 - t * 2.0) * 0.5 + 0.5;
    pulse = clamp(pulse, 0.0, 1.0);
    float vignette = 1.0 - smoothstep(0.3, 0.8, dist);
    pulse *= vignette;
  }

  gl_FragColor = vec4(evalRamp(pulse), pulse * 0.85);
}
