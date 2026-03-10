#define MAX_STOPS 8
uniform vec3  uRampColors[MAX_STOPS];    // flat RGB, padded to 8
uniform float uRampPositions[MAX_STOPS]; // sorted 0..1, padded to 8
uniform int   uRampCount;

uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform vec2  uResolution;
uniform int   uMode;             // 0 = radial, 1 = linear, 2 = noise
uniform float uDriftAngle;       // drift direction in radians (linear mode only)
uniform float uNoiseScale;       // spatial frequency of noise patches (noise mode only)
uniform float uLiquifyStrength;  // domain-warp displacement magnitude (noise mode only)
uniform float uLiquifyScale;     // spatial frequency of the flow vector field
uniform float uLiquifySpeed;     // temporal rate of the flow field (independent of uSpeed)

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

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = uTime * uSpeed + uOffset;
  float pulse;

  if (uMode == 1) {
    // Linear drift: wave bands travelling along uDriftAngle.
    vec2  dir      = vec2(cos(uDriftAngle), sin(uDriftAngle));
    vec2  perp     = vec2(-dir.y, dir.x);
    float proj     = dot(vUv - 0.5, dir);
    float perpDist = abs(dot(vUv - 0.5, perp));

    pulse = sin(proj * 8.0 - t * 2.0) * 0.5 + 0.5;
    pulse = clamp(pulse, 0.0, 1.0);
    float fade = 1.0 - smoothstep(0.2, 0.52, perpDist);
    pulse *= fade;
  } else if (uMode == 2) {
    // Noise: organic gradient driven by animated value noise + liquify domain warp.
    vec2 flowCoord = vUv * uLiquifyScale + uTime * uLiquifySpeed;
    float fx = valueNoise(flowCoord)              * 2.0 - 1.0;
    float fy = valueNoise(flowCoord + vec2(3.7, 8.3)) * 2.0 - 1.0;
    vec2 warpedUV = vUv + vec2(fx, fy) * uLiquifyStrength;

    float n1 = valueNoise(warpedUV * uNoiseScale + vec2(t * 0.31, t * 0.17));
    float n2 = valueNoise(warpedUV * uNoiseScale * 1.7 - vec2(t * 0.19, t * 0.27));
    pulse = n1 * 0.65 + n2 * 0.35;
  } else {
    // Radial growth: rings pulsing from centre.
    vec2  center   = vUv - 0.5;
    float dist     = length(center);
    pulse = sin(dist * 8.0 - t * 2.0) * 0.5 + 0.5;
    pulse = clamp(pulse, 0.0, 1.0);
    float vignette = 1.0 - smoothstep(0.3, 0.8, dist);
    pulse *= vignette;
  }

  gl_FragColor = vec4(evalRamp(pulse), pulse * 0.85);
}
