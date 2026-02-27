uniform sampler2D uBackground;
uniform bool      uLayerEnabled;
uniform vec2      uResolution; // actual pixel dimensions of the render target
uniform float     uSpacing;    // grid cell size in pixels
uniform float     uScale;      // max dot radius as fraction of cell half-width (0..1)
uniform float     uShadow;     // inter-dot darkness (0 = black gaps, 1 = no gap darkening)

varying vec2 vUv;

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  // Work in pixel space for a perfectly uniform grid
  vec2 px = vUv * uResolution;

  // Snap to grid cell
  vec2 cell         = floor(px / uSpacing);
  vec2 cellCenterPx = (cell + 0.5) * uSpacing;
  vec2 cellCenterUV = cellCenterPx / uResolution;

  // Sample background colour at the cell centre — this is the dot's colour
  vec4  bg  = texture2D(uBackground, cellCenterUV);

  // Perceptual luminance drives dot radius
  float lum = dot(bg.rgb, vec3(0.2126, 0.7152, 0.0722));

  float maxRadius = uSpacing * 0.5 * uScale;
  float radius    = lum * maxRadius;

  // Signed distance from current pixel to cell centre (pixel space)
  float dist = length(px - cellCenterPx);

  // Anti-aliased circle — 1.5px soft edge, consistent across all spacings
  float circle = 1.0 - smoothstep(radius - 1.5, radius + 1.5, dist);

  // Inter-dot: dark tinted version of bg; dot: full bg colour at cell centre
  vec3 shadow = bg.rgb * uShadow;
  vec3 color  = mix(shadow, bg.rgb, circle);

  gl_FragColor = vec4(color, 1.0);
}
