#define MAX_STOPS 8
uniform vec3  uRampColors[MAX_STOPS];    // flat RGB, padded to 8
uniform float uRampPositions[MAX_STOPS]; // sorted 0..1, padded to 8
uniform int   uRampCount;

uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform int   uMode;             // 0 = radial, 1 = linear, 2 = sweep
uniform float uDriftAngle;       // drift direction in radians (linear mode only)
uniform float uCurve;            // wave shape: <1 flat/spread, 1 sine, >1 sharp peak
uniform float uRipple;         // radial ripple on/off (0 or 1)
uniform float uRippleCount;   // ring density multiplier (default 7)
uniform float uRippleCompress; // sqrt compression factor (default 6)
uniform float uLightAngle;    // light azimuth in radians
uniform vec3  uLightColor;   // relief light color (sRGB)
uniform float uShadowDepth;   // valley darkening (0-1)
uniform float uReliefDepth;  // 3D depth intensity (0-1)
uniform float uSweepSeam;       // sweep back-seam softness (0 = sharp, 1 = soft)
uniform float uSweepCenter;    // center blur radius (0 = sharp, 1 = soft)
uniform float uCenterX;        // radial/sweep center X [0..1]
uniform float uCenterY;        // radial/sweep center Y [0..1]
uniform bool  uOklab;           // true = interpolate ramp in Oklab space
uniform int   uLinearMotion;    // 0 = slide (traveling wave), 1 = cloth (2D fabric)
uniform float uClothScale;     // fold size: <1 large billows, >1 tight crumples
uniform float uClothDetail;    // wave complexity: 0 = single billow, 1 = full 4-layer
uniform float uClothSeed;     // phase offset seed for cloth pattern variation
uniform float uLinearCount;   // slide band count multiplier (default 1)
uniform float uWaveAmp;      // perpendicular wave distortion amplitude (0 = off)
uniform float uWaveFreq;     // perpendicular wave distortion frequency
uniform float uDistortAmt;   // 2D cross-warp distortion strength (0 = off)
uniform float uMetaBallCount;   // number of metaball centers (2-15)
uniform float uMetaElasticity;  // falloff sharpness (0.3-3.0, low = merged, high = sharp)
uniform float uMetaSeed;        // randomizes metaball orbit phases
uniform float uMetaSize;        // blob radius (0.03-0.4)
uniform float uMetaSoftness;    // edge softness (0 = hard, 1 = diffuse glow)
uniform float uMetaSpread;      // orbit spread multiplier (0.2-2.0)
uniform float uMetaInvert;      // invert field mapping (0 or 1)
uniform float uMetaChaos;       // secondary wobble on orbits (0-1)

varying vec2 vUv;

// ─── Oklab color space conversions ───────────────────────────────────────────
// Oklab provides perceptually uniform interpolation: equal numeric steps
// produce equal perceived color change. This avoids the desaturated muddy
// midpoints that sRGB linear interpolation creates between complementary hues.

float srgbToLinear(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float linearToSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 srgbToOklab(vec3 c) {
  vec3 lin = vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
  float l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  float m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  float s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToSrgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 lin = vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
  return clamp(vec3(linearToSrgb(lin.r), linearToSrgb(lin.g), linearToSrgb(lin.b)), 0.0, 1.0);
}

// ─── Value noise with analytical derivatives ────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

vec3 valueNoiseD(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u  = f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float k1 = b - a, k2 = c - a, k3 = a - b - c + d;
  return vec3(
    a + k1*u.x + k2*u.y + k3*u.x*u.y,
    du * vec2(k1 + k3*u.y, k2 + k3*u.x)
  );
}

vec3 liquidFBM(vec2 p, float detail) {
  vec3 sum = vec3(0.0);
  float amp = 0.5, freq = 1.0;
  vec3 n = valueNoiseD(p);
  sum += vec3(n.x * amp, n.yz * amp * freq);
  amp *= 0.5; freq *= 2.0;
  n = valueNoiseD(p * freq);
  sum += vec3(n.x * amp, n.yz * amp * freq) * smoothstep(0.0, 0.5, detail);
  amp *= 0.5; freq *= 2.0;
  n = valueNoiseD(p * freq);
  sum += vec3(n.x * amp, n.yz * amp * freq) * smoothstep(0.5, 1.0, detail);
  return sum;
}

// ─── Color ramp evaluation ───────────────────────────────────────────────────

vec3 evalRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 col = uRampColors[0];
  for (int i = 1; i < MAX_STOPS; i++) {
    if (i >= uRampCount) break;
    float prev = uRampPositions[i - 1];
    if (t > prev) {
      float span = uRampPositions[i] - prev;
      float f = span > 0.0 ? clamp((t - prev) / span, 0.0, 1.0) : 1.0;
      if (uOklab) {
        vec3 labA = srgbToOklab(uRampColors[i - 1]);
        vec3 labB = srgbToOklab(uRampColors[i]);
        col = oklabToSrgb(mix(labA, labB, f));
      } else {
        col = mix(uRampColors[i - 1], uRampColors[i], f);
      }
    }
  }
  return col;
}

// ─── Metaball position from index, time, seed, spread, chaos ────────────
vec2 metaBallPos(int i, float t, float seed, float spread, float chaos) {
  float fi = float(i);
  float s = seed * 17.31;
  float a = fi * 2.399 + 0.5 + s;
  float sx = (0.28 + fi * 0.04) * spread;
  float sy = (0.24 + fi * 0.035) * spread;
  float fx = 0.3 + fi * 0.11;
  float fy = 0.25 + fi * 0.087;
  vec2 pos = vec2(
    0.5 + sx * sin(t * fx + a),
    0.5 + sy * cos(t * fy + a * 1.7 + s * 0.73)
  );
  if (chaos > 0.0) {
    pos.x += sin(t * 1.7 + fi * 3.91 + s) * 0.08 * chaos;
    pos.y += cos(t * 2.1 + fi * 4.73 + s) * 0.08 * chaos;
  }
  return pos;
}

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = uTime * uSpeed + uOffset;
  float pulse;

  if (uMode == 1) {
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    vec2  perp = vec2(-dir.y, dir.x);
    float height;
    vec2 grad = vec2(0.0);

    vec2 uv = vUv;
    if (uDistortAmt > 0.0) {
      float d = uDistortAmt * 0.12;
      uv.x += sin(vUv.y * 5.7 + t * 0.4) * d;
      uv.y += sin(vUv.x * 4.3 - t * 0.3) * d;
      uv.x += cos(vUv.y * 9.1 - t * 0.2) * d * 0.4;
    }
    if (uWaveAmp > 0.0) {
      float perpCoord = dot(uv, perp);
      float waveDisp = sin(perpCoord * uWaveFreq * 6.2832 + t * 0.5) * uWaveAmp * 0.15;
      uv += dir * waveDisp;
    }

    if (uLinearMotion == 1) {
      // ─── Cloth: 2D fabric surface ─────────────────────────────────────
      float sc = uClothScale;
      float dt = uClothDetail;

      float a1 = uDriftAngle;
      vec2 d1 = vec2(cos(a1), sin(a1));
      float f1 = 3.0 * sc;
      float seed = uClothSeed * 17.31;
      float p1 = dot(uv, d1) * f1 + t * 0.7 + seed;
      float w1 = sin(p1) * 0.35;

      float a2 = a1 + 2.399;
      vec2 d2 = vec2(cos(a2), sin(a2));
      float f2 = 4.3 * sc;
      float p2 = dot(uv, d2) * f2 - t * 0.5 + seed * 1.37;
      float w2 = sin(p2) * 0.25 * dt;

      float a3 = a1 + 1.047;
      vec2 d3 = vec2(cos(a3), sin(a3));
      float f3 = 6.1 * sc;
      float p3 = dot(uv, d3) * f3 + t * 0.35 + seed * 0.83;
      float w3 = sin(p3) * 0.18 * dt;

      float a4 = a1 + 3.83;
      vec2 d4 = vec2(cos(a4), sin(a4));
      float f4 = 1.4 * sc;
      float p4 = dot(uv, d4) * f4 - t * 0.2 + seed * 2.11;
      float w4 = sin(p4) * 0.22 * smoothstep(0.0, 0.5, dt);

      float raw = w1 + w2 + w3 + w4;
      height = raw * 0.5 + 0.5;

      float dw1 = cos(p1) * f1 * 0.35;
      float dw2 = cos(p2) * f2 * 0.25 * dt;
      float dw3 = cos(p3) * f3 * 0.18 * dt;
      float dw4 = cos(p4) * f4 * 0.22 * smoothstep(0.0, 0.5, dt);
      grad = (d1 * dw1 + d2 * dw2 + d3 * dw3 + d4 * dw4) * 0.5;

    } else if (uLinearMotion == 2) {
      // ─── Liquid: finger-in-water nested domain warping ──────────────
      float sc = uClothScale * 3.0;
      vec2 p = uv * sc;

      // Warp layer 1: large slow swirls (the "finger push")
      vec2 q = vec2(
        valueNoiseD(p + vec2(t * 0.17, t * 0.11)).x,
        valueNoiseD(p + vec2(-t * 0.13, t * 0.19) + 5.2).x
      );
      p += (q - 0.5) * 1.6;

      // Warp layer 2: secondary turbulence (eddies forming behind the finger)
      float dt = uClothDetail;
      vec2 r = vec2(
        valueNoiseD(p * 1.3 + vec2(t * 0.23, -t * 0.09) + 1.7).x,
        valueNoiseD(p * 1.3 + vec2(t * 0.15, t * 0.21) + 8.3).x
      );
      p += (r - 0.5) * 1.0 * dt;

      // Final FBM with analytical gradient
      vec3 fbm = liquidFBM(p, dt);
      // Soft contrast: preserve full range, gentle S-curve
      float raw = fbm.x * 0.5 + 0.5;
      height = raw * raw * (3.0 - 2.0 * raw);
      float h_deriv = 6.0 * raw * (1.0 - raw);
      grad = fbm.yz * 0.5 * h_deriv * sc;

    } else {
      // ─── Slide: traveling wave along drift axis ───────────────────────
      float proj     = dot(uv, dir);
      float perpProj = dot(uv, perp);
      float warpA = 2.5;
      float warpB = 5.2;
      float warpPhaseA = perpProj * warpA + t * 0.4;
      float warpPhaseB = perpProj * warpB - t * 0.25;
      float depth = uReliefDepth * uRipple;
      float warp = (sin(warpPhaseA) * 0.06 + sin(warpPhaseB) * 0.025) * depth;
      float warpedProj = proj + warp;

      float freq1 = 6.28318 * uLinearCount;
      float freq2 = 3.89 * uLinearCount;
      float phase1 = warpedProj * freq1 + t;
      float phase2 = warpedProj * freq2 - t * 0.6;
      float base1 = sin(phase1) * 0.5 + 0.5;
      float base2 = sin(phase2) * 0.5 + 0.5;
      float h1 = pow(base1, uCurve);
      float h2 = pow(base2, uCurve);
      height = h1 * 0.82 + h2 * 0.18;

      float dh1 = uCurve * pow(max(base1, 0.001), uCurve - 1.0) * cos(phase1) * 0.5 * freq1;
      float dh2 = uCurve * pow(max(base2, 0.001), uCurve - 1.0) * cos(phase2) * 0.5 * freq2;
      float slopeWarp = dh1 * 0.82 + dh2 * 0.18;
      float dWarp = (cos(warpPhaseA) * warpA * 0.06
                   + cos(warpPhaseB) * warpB * 0.025) * depth;
      grad = dir * slopeWarp + perp * (slopeWarp * dWarp);
    }

    pulse = clamp(height, 0.0, 1.0);

    if (uRipple > 0.0) {
      float normalStrength = mix(0.3, 1.5, uReliefDepth);
      vec3 N = normalize(vec3(-grad * normalStrength, 1.0));

      float lx = cos(uLightAngle) * 0.68;
      float ly = sin(uLightAngle) * 0.68;
      vec3 L = normalize(vec3(lx, ly, 1.0));

      float NdotL = dot(N, L);
      float diffuse = NdotL * 0.425 + 0.575;

      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), 12.0) * 0.3 * uReliefDepth;

      float shadowMask = smoothstep(-0.1, 0.35, height - 0.5);
      float shadow = mix(1.0, shadowMask, uShadowDepth);

      vec3 baseColor = evalRamp(pulse);
      vec3 lit = baseColor * diffuse * shadow
               + spec * uLightColor;
      gl_FragColor = vec4(clamp(lit, 0.0, 1.0), pulse * 0.85);
      return;
    }
  } else if (uMode == 2) {
    // Sweep: rotating angular gradient
    vec2  delta = vUv - vec2(uCenterX, uCenterY);
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
  } else if (uMode == 3) {
    // ─── Hypnotic: logarithmic koru spiral ────────────────────────────────
    vec2  delta  = vUv - vec2(uCenterX, uCenterY);
    float dist   = length(delta);
    float angle  = atan(delta.y, delta.x);

    float logR  = log(max(dist, 0.0001));
    float coils = uClothScale * 3.0;
    float spiral  = logR * coils - angle + t;
    float spiral2 = logR * coils * 0.618 + angle - t * 0.7;

    float dt = uClothDetail;
    float h1 = sin(spiral) * 0.5 + 0.5;
    float h2 = sin(spiral2) * 0.5 + 0.5;
    pulse = h1 * (1.0 - dt * 0.4) + h2 * dt * 0.4;

    float centerFade = smoothstep(0.0, 0.04, dist);
    pulse = mix(0.5, pulse, centerFade);

  } else if (uMode == 4) {
    // ─── Metaball: organic blobby field ─────────────────────────────────────
    float field = 0.0;
    float radius = uMetaSize;
    float exponent = 2.0 * uMetaElasticity;
    for (int i = 0; i < 15; i++) {
      if (float(i) >= uMetaBallCount) break;
      vec2 center = metaBallPos(i, t, uMetaSeed, uMetaSpread, uMetaChaos);
      float d = length(vUv - center);
      field += pow(radius / max(d, 0.001), exponent);
    }
    float edge0 = mix(0.8, 0.1, uMetaSoftness);
    float edge1 = mix(1.2, 4.0, uMetaSoftness);
    pulse = smoothstep(edge0, edge1, field);
    if (uMetaInvert > 0.5) pulse = 1.0 - pulse;

  } else {
    // ─── Radial: topographic light surface ──────────────────────────────────

    // Distortion: 2D cross-warp on UV before radial computation
    vec2 ruv = vUv;
    if (uDistortAmt > 0.0) {
      float d = uDistortAmt * 0.12;
      ruv.x += sin(vUv.y * 5.7 + t * 0.4) * d;
      ruv.y += sin(vUv.x * 4.3 - t * 0.3) * d;
      ruv.x += cos(vUv.y * 9.1 - t * 0.2) * d * 0.4;
    }
    // Wave distortion: radial ripple on UV
    if (uWaveAmp > 0.0) {
      vec2 wDelta = ruv - vec2(uCenterX, uCenterY);
      float wDist = length(wDelta);
      float waveDisp = sin(wDist * uWaveFreq * 6.2832 + t * 0.5) * uWaveAmp * 0.15;
      ruv += (wDist > 0.001 ? wDelta / wDist : vec2(0.0)) * waveDisp;
    }

    vec2  delta  = ruv - vec2(uCenterX, uCenterY);
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

    // Topographic 3D lighting
    if (uRipple > 0.0) {
      float dMapped = (comp * 0.5) / max(sqrt(dist * comp), 0.15);
      float slope1 = cos(phase1) * freq * dMapped;
      float slope2 = cos(phase2) * subFreq * dMapped;
      float radialSlope = (slope1 * 0.78 + slope2 * 0.22) * envelope;

      vec2 grad = radDir * radialSlope;
      vec3 N = normalize(vec3(-grad * 0.35, 1.0));

      // Light direction from angle
      float lx = cos(uLightAngle) * 0.68;
      float ly = sin(uLightAngle) * 0.68;
      vec3 L = normalize(vec3(lx, ly, 1.0));

      // Diffuse: half-Lambert wrap
      float diffuse = dot(N, L) * 0.5 + 0.5;

      // Shadow: darken valleys
      float shadowMask = smoothstep(-0.3, 0.2, height);
      float shadow = mix(1.0, shadowMask, uShadowDepth);

      pulse = pulse * diffuse * shadow;
      pulse = clamp(pulse, 0.0, 1.0);
    }
  }

  gl_FragColor = vec4(evalRamp(pulse), pulse * 0.85);
}
