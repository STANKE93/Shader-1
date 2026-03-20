uniform sampler2D uBackground;
uniform bool      uLayerEnabled;
uniform vec2      uResolution; // actual pixel dimensions of the render target
uniform float     uSpacing;    // grid cell size in pixels
uniform float     uScale;      // max dot radius as fraction of cell half-width (0..1)
uniform float     uShadow;     // inter-dot darkness (0 = black gaps, 1 = no gap darkening)
uniform int       uShape;      // 0 = circle, 1 = square
uniform bool      uMono;       // global monochrome filter
uniform int       uGrainType;  // 0 = off, 1 = film, 2 = stipple, 3 = scan, 4 = ascii
uniform float     uGrainAmt;   // grain intensity (0-1)
uniform float     uGrainScale; // grain size/density control

varying vec2 vUv;

// ─── Hash functions for noise ───────────────────────────────────────────────
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec3 color;

  if (!uLayerEnabled) {
    color = texture2D(uBackground, vUv).rgb;
  } else {
    // Work in pixel space for a perfectly uniform grid
    vec2 px = vUv * uResolution;

    // Snap to grid cell
    vec2 cell         = floor(px / uSpacing);
    vec2 cellCenterPx = (cell + 0.5) * uSpacing;
    vec2 cellCenterUV = cellCenterPx / uResolution;

    // Sample background colour at the cell centre — this is the dot's colour
    vec4  bg  = texture2D(uBackground, cellCenterUV);

    // Perceptual luminance drives dot radius / half-size
    float lum = dot(bg.rgb, vec3(0.2126, 0.7152, 0.0722));

    float maxRadius = uSpacing * 0.5 * uScale;
    float radius    = lum * maxRadius;

    // Signed distance from current pixel to cell centre (pixel space)
    vec2 d = abs(px - cellCenterPx);
    float dist;
    if (uShape == 1) {
      // Chebyshev distance → square
      dist = max(d.x, d.y);
    } else {
      // Euclidean distance → circle
      dist = length(d);
    }

    // Anti-aliased edge — 1.5px soft band, consistent across all spacings
    float mask = 1.0 - smoothstep(radius - 1.5, radius + 1.5, dist);

    // Inter-dot: dark tinted version of bg; dot: full bg colour at cell centre
    vec3 shadow = bg.rgb * uShadow;
    color = mix(shadow, bg.rgb, mask);
  }

  // Monochrome: perceptual grayscale filter on top of everything
  if (uMono) {
    float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = vec3(gray);
  }

  // ─── Grain effects ──────────────────────────────────────────────────────────
  if (uGrainType > 0 && uGrainAmt > 0.0) {
    vec2 px = vUv * uResolution;
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

    if (uGrainType == 1) {
      // ── Film grain: organic per-pixel noise ──────────────────────────────
      float grain = hash12(px * 0.7 + 0.5) * 2.0 - 1.0;
      // Reduce grain in bright areas (like real film stock)
      float strength = uGrainAmt * 0.35 * (1.0 - lum * 0.5);
      color += grain * strength;

    } else if (uGrainType == 2) {
      // ── Scanlines: horizontal CRT lines ──────────────────────────────────
      float lineWidth = mix(4.0, 1.5, uGrainScale);
      float scanline = sin(px.y * 3.14159 / lineWidth);
      float darken = smoothstep(0.0, 0.6, scanline);
      color *= mix(1.0, darken, uGrainAmt * 0.5);
    }

    color = clamp(color, 0.0, 1.0);
  }

  gl_FragColor = vec4(color, 1.0);
}
