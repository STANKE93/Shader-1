uniform sampler2D uBackground;
uniform vec2      uResolution;   // viewport size for aspect correction
uniform bool      uLayerEnabled;
uniform float     uBarrel;       // barrel (+) / pincushion (-) strength
uniform float     uChromaAberr;  // chromatic aberration intensity
uniform float     uVignetteStr;  // vignette darkness
uniform float     uVignetteSoft; // vignette falloff width

varying vec2 vUv;

// ---------- Brown-Conrady barrel/pincushion distortion ----------
// Two-term radial model: k1*r^2 + k2*r^4
// k2 is derived from k1 to create the characteristic accelerating
// warp in the outer third of the frame that real lenses produce.
// The aspect ratio is corrected so distortion is circular, not elliptical.
vec2 barrelDistort(vec2 uv, float k1, vec2 aspect) {
  vec2 c  = (uv - 0.5) * aspect;          // aspect-corrected centered coords
  float r2 = dot(c, c);
  float r4 = r2 * r2;
  float k2 = k1 * 0.35;                   // derived 4th-order term — subtle mustache correction
  c *= 1.0 + k1 * r2 + k2 * r4;
  return c / aspect + 0.5;                 // undo aspect correction, re-center
}

// ---------- Edge fade for out-of-bounds UVs ----------
// Smooth falloff when distortion pushes sampling outside the texture.
// Prevents hard clamping artifacts at extreme barrel values.
float edgeFade(vec2 uv) {
  vec2 d = smoothstep(vec2(0.0), vec2(0.008), uv)
         * smoothstep(vec2(0.0), vec2(0.008), 1.0 - uv);
  return d.x * d.y;
}

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  // Aspect ratio: make distortion circular in non-square viewports
  float ar = uResolution.x / uResolution.y;
  vec2 aspect = ar >= 1.0 ? vec2(ar, 1.0) : vec2(1.0, 1.0 / ar);

  // --- Chromatic aberration via per-channel barrel coefficients ---
  // Real lateral CA: each wavelength refracts differently through glass,
  // so R/G/B effectively have slightly different distortion coefficients.
  // This naturally increases separation toward edges (where r^2 is large)
  // and stays zero at the optical center — physically correct behavior.
  float caScale = uChromaAberr * 8.0;     // map [0..0.02] slider to useful coefficient range
  float kR = uBarrel + caScale;            // red refracts least  — slightly more barrel
  float kG = uBarrel;                      // green is reference channel
  float kB = uBarrel - caScale;            // blue refracts most  — slightly less barrel

  vec2 uvR = barrelDistort(vUv, kR, aspect);
  vec2 uvG = barrelDistort(vUv, kG, aspect);
  vec2 uvB = barrelDistort(vUv, kB, aspect);

  // Sample each channel with edge fade
  float r = texture2D(uBackground, uvR).r * edgeFade(uvR);
  float g = texture2D(uBackground, uvG).g * edgeFade(uvG);
  float b = texture2D(uBackground, uvB).b * edgeFade(uvB);
  vec3 color = vec3(r, g, b);

  // --- Vignette: cos^4 natural optical falloff ---
  // Real vignette follows the "cos-fourth law" — light reaching the sensor
  // falls off as cos^4(angle from optical axis). This produces a smooth,
  // gradual darkening that starts subtly from center and accelerates
  // toward corners, unlike smoothstep which has a visible "ring" onset.
  vec2 cv = (vUv - 0.5) * aspect;          // aspect-corrected center vector
  float r2 = dot(cv, cv);
  // Map r^2 through a cos^4-inspired curve:
  // cos(theta) ~ 1 / sqrt(1 + r^2), so cos^4 ~ 1 / (1+r^2)^2
  // We soften with the uVignetteSoft uniform — lower = tighter falloff
  float falloffScale = 1.2 + uVignetteSoft * 2.8;  // range [1.2 .. 4.0]
  float cosTheta = 1.0 / (1.0 + r2 * falloffScale);
  float vig = cosTheta * cosTheta;          // cos^4 approximation
  // vig is 1.0 at center, falls toward 0 at corners
  color *= mix(1.0, vig, uVignetteStr);

  gl_FragColor = vec4(color, 1.0);
}
