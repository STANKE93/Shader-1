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
uniform float uLinearCount;   // slide band count multiplier (default 1)

varying vec2 vUv;

// ─── Oklab color space conversions ───────────────────────────────────────────
// Oklab provides perceptually uniform interpolation: equal numeric steps
// produce equal perceived color change. This avoids the desaturated muddy
// midpoints that sRGB linear interpolation creates between complementary hues
// (e.g. red↔cyan, blue↔yellow).
//
// Pipeline: sRGB → linear RGB → LMS (cone response) → Oklab (perceptual)

// sRGB transfer function: sRGB channel → linear light
float srgbToLinear(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

// Inverse: linear light → sRGB channel
float linearToSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

// sRGB → Oklab
vec3 srgbToOklab(vec3 c) {
  // sRGB → linear
  vec3 lin = vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
  // linear RGB → LMS (long/medium/short cone response)
  float l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  float m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  float s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  // Cube root for perceptual uniformity (like L* in CIELab)
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  // LMS^(1/3) → Oklab
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

// Oklab → sRGB
vec3 oklabToSrgb(vec3 lab) {
  // Oklab → LMS^(1/3)
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  // Cube to recover linear LMS
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  // LMS → linear RGB
  vec3 lin = vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
  // linear → sRGB, clamped to [0,1]
  return clamp(vec3(linearToSrgb(lin.r), linearToSrgb(lin.g), linearToSrgb(lin.b)), 0.0, 1.0);
}

// ─── Value noise with analytical derivatives ────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

// Returns vec3(value, dN/dx, dN/dy) — quintic hermite for smooth blobs
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

// 3-octave FBM with detail fade
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

// Evaluate color ramp at position t in [0,1].
// When uOklab is true, interpolation happens in Oklab space for perceptually
// smooth gradients; otherwise standard sRGB linear mix.
vec3 evalRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 col = uRampColors[0];
  for (int i = 1; i < MAX_STOPS; i++) {
    if (i >= uRampCount) break;
    float prev = uRampPositions[i - 1];
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
    vec2  dir  = vec2(cos(uDriftAngle), sin(uDriftAngle));
    vec2  perp = vec2(-dir.y, dir.x);
    float height;

    // Analytical gradient for lighting (filled by either motion path)
    vec2 grad = vec2(0.0);

    if (uLinearMotion == 1) {
      // ─── Cloth: 2D fabric surface ─────────────────────────────────────
      // 4 wave layers at irrational angle ratios. uClothScale controls
      // fold size, uClothDetail fades secondary layers in/out.
      vec2 uv = vUv;
      float sc = uClothScale;
      float dt = uClothDetail;

      // Wave 1: dominant billow (always full strength)
      float a1 = uDriftAngle;
      vec2 d1 = vec2(cos(a1), sin(a1));
      float f1 = 3.0 * sc;
      float p1 = dot(uv, d1) * f1 + t * 0.7;
      float w1 = sin(p1) * 0.35;

      // Wave 2: counter-wave at golden angle offset
      float a2 = a1 + 2.399;
      vec2 d2 = vec2(cos(a2), sin(a2));
      float f2 = 4.3 * sc;
      float p2 = dot(uv, d2) * f2 - t * 0.5;
      float w2 = sin(p2) * 0.25 * dt;

      // Wave 3: medium ripple
      float a3 = a1 + 1.047;
      vec2 d3 = vec2(cos(a3), sin(a3));
      float f3 = 6.1 * sc;
      float p3 = dot(uv, d3) * f3 + t * 0.35;
      float w3 = sin(p3) * 0.18 * dt;

      // Wave 4: slow breathing
      float a4 = a1 + 3.83;
      vec2 d4 = vec2(cos(a4), sin(a4));
      float f4 = 1.4 * sc;
      float p4 = dot(uv, d4) * f4 - t * 0.2;
      float w4 = sin(p4) * 0.22 * smoothstep(0.0, 0.5, dt);

      // Combine into height field, remap to [0,1]
      float raw = w1 + w2 + w3 + w4;
      height = raw * 0.5 + 0.5;

      // Analytical gradient: d(height)/d(uv) — frequencies baked into derivatives
      float dw1 = cos(p1) * f1 * 0.35;
      float dw2 = cos(p2) * f2 * 0.25 * dt;
      float dw3 = cos(p3) * f3 * 0.18 * dt;
      float dw4 = cos(p4) * f4 * 0.22 * smoothstep(0.0, 0.5, dt);
      grad = (d1 * dw1 + d2 * dw2 + d3 * dw3 + d4 * dw4) * 0.5;

    } else if (uLinearMotion == 2) {
      // ─── Liquid: finger-in-water nested domain warping ──────────────
      float sc = uClothScale * 3.0;
      vec2 p = vUv * sc;

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
      height = raw * raw * (3.0 - 2.0 * raw);   // smooth hermite, no flat zones
      float h_deriv = 6.0 * raw * (1.0 - raw);  // d(hermite)/d(raw)
      grad = fbm.yz * 0.5 * h_deriv * sc;

    } else {
      // ─── Slide: traveling wave along drift axis ───────────────────────
      float proj     = dot(vUv, dir);
      float perpProj = dot(vUv, perp);

      // Fabric deformation when relief is on
      float warpA = 2.5;
      float warpB = 5.2;
      float warpPhaseA = perpProj * warpA + t * 0.4;
      float warpPhaseB = perpProj * warpB - t * 0.25;
      float depth = uReliefDepth * uRipple;
      float warp = (sin(warpPhaseA) * 0.06 + sin(warpPhaseB) * 0.025) * depth;
      float warpedProj = proj + warp;

      // Primary wave + sub-harmonic along warped coordinate
      float freq1 = 6.28318 * uLinearCount;
      float freq2 = 3.89 * uLinearCount;
      float phase1 = warpedProj * freq1 + t;
      float phase2 = warpedProj * freq2 - t * 0.6;
      float base1 = sin(phase1) * 0.5 + 0.5;
      float base2 = sin(phase2) * 0.5 + 0.5;
      float h1 = pow(base1, uCurve);
      float h2 = pow(base2, uCurve);
      height = h1 * 0.82 + h2 * 0.18;

      // Analytical gradient for slide mode
      float dh1 = uCurve * pow(max(base1, 0.001), uCurve - 1.0) * cos(phase1) * 0.5 * freq1;
      float dh2 = uCurve * pow(max(base2, 0.001), uCurve - 1.0) * cos(phase2) * 0.5 * freq2;
      float slopeWarp = dh1 * 0.82 + dh2 * 0.18;
      float dWarp = (cos(warpPhaseA) * warpA * 0.06
                   + cos(warpPhaseB) * warpB * 0.025) * depth;
      grad = dir * slopeWarp + perp * (slopeWarp * dWarp);
    }

    wave = clamp(height, 0.0, 1.0);

    // 3D lighting — shared between slide, cloth, and liquid
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

      // Apply lighting with light color post-evalRamp
      vec3 baseColor = evalRamp(wave);
      vec3 lit = baseColor * diffuse * shadow
               + spec * uLightColor;
      gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
      return;
    }
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
  } else if (uMode == 3) {
    // ─── Hypnotic: logarithmic koru spiral ────────────────────────────────
    vec2  delta  = vUv - vec2(uCenterX, uCenterY);
    float dist   = length(delta);
    float angle  = atan(delta.y, delta.x);
    vec2  radDir = dist > 0.001 ? delta / dist : vec2(1.0, 0.0);
    vec2  tanDir = vec2(-radDir.y, radDir.x);

    float logR  = log(max(dist, 0.0001));
    float coils = uClothScale * 3.0;
    float spiral  = logR * coils - angle + t;
    float spiral2 = logR * coils * 0.618 + angle - t * 0.7;

    float dt = uClothDetail;
    float h1 = sin(spiral) * 0.5 + 0.5;
    float h2 = sin(spiral2) * 0.5 + 0.5;
    wave = h1 * (1.0 - dt * 0.4) + h2 * dt * 0.4;

    float centerFade = smoothstep(0.0, 0.04, dist);
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
