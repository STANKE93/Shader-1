uniform sampler2D uBackground;
uniform float     uTime;
uniform bool      uLayerEnabled;
uniform float     uSpeed;
uniform float     uOffset;
uniform float     uSpacing;      // tile frequency (cycles across the screen)
uniform float     uAngle;        // grid rotation in radians
uniform float     uSoftness;     // tile edge softness: 0 = hard, 1 = diffuse
uniform float     uIOR;          // index of refraction (1.0 = none, 1.5 = glass)
uniform float     uThickness;    // [0..1]: 0 = flat slab, 1 = smooth plano-convex lens
uniform float     uFresnel;      // [0..1]: Fresnel edge attenuation strength
uniform float     uCornerRadius; // [0..1]: 0 = square tiles, 1 = circular tiles

varying vec2 vUv;

// Same artistic constant as diagonalBands so IOR/thickness feel calibrated the same way.
const float STEEPNESS = 0.13;
const float TAU = 6.28318;

// ---------------------------------------------------------------------------
// Signed distance field for a rounded rectangle centred at the origin.
//   b : half-extents of the inner flat-face box (before corner arc is applied)
//   r : corner radius
// Returns negative inside, zero at boundary, positive outside.
// ---------------------------------------------------------------------------
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// ---------------------------------------------------------------------------
// Analytical unit-length gradient of sdRoundedBox.
// Gives the outward normal direction pointing toward the nearest boundary.
//
// Three zones:
//   Corner arc zone  — q.x > 0 && q.y > 0: radial from arc centre
//   Flat x-edge zone — closer to left/right edge: ±x axis
//   Flat y-edge zone — closer to top/bottom edge: ±y axis
// ---------------------------------------------------------------------------
vec2 sdRoundedBoxGrad(vec2 p, vec2 b) {
  vec2 ap = abs(p);
  vec2 q  = ap - b;
  if (q.x > 0.0 && q.y > 0.0) {
    // Corner arc: radial gradient from the arc's centre at (±b.x, ±b.y).
    // sign(p) maps from the first-quadrant result to the actual quadrant of p.
    return sign(p) * normalize(q + vec2(1e-8));
  }
  // Flat-edge zones: pick the axis whose boundary is closest.
  // q = ap - b is more negative when farther from that edge.
  // q.x >= q.y → x-edge is closer (less distance remaining).
  if (q.x >= q.y) {
    return vec2(sign(p.x), 0.0);
  }
  return vec2(0.0, sign(p.y));
}

// ---------------------------------------------------------------------------
void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  float cosA = cos(uAngle);
  float sinA = sin(uAngle);

  // Rotate UV into tile-aligned coordinate space.
  // Tile-space X axis points in the uAngle direction in screen UV space.
  vec2 rotUV = vec2(
     vUv.x * cosA + vUv.y * sinA,
    -vUv.x * sinA + vUv.y * cosA
  );

  // Scroll the grid along the tile X axis at the same rate as diagonal bands
  // uses at the same speed/spacing values — one tile traversal per 2π time units.
  rotUV.x += (uTime * uSpeed + uOffset) / (uSpacing * TAU);

  // Per-tile local coordinates in [-0.5, 0.5].
  vec2 localUV = fract(rotUV * uSpacing) - 0.5;

  // --- Shape ---------------------------------------------------------------
  // A small fixed gap (0.03 of a tile) keeps tiles from touching even at
  // cornerRadius = 0, so the grid always reads as distinct tiles.
  float tileHalf = 0.47;
  float cr       = uCornerRadius * tileHalf;       // 0 = square, tileHalf = circle
  vec2  boxHalf  = vec2(max(tileHalf - cr, 0.0));  // flat-face half-extents (0 = circle)
  float sdf      = sdRoundedBox(localUV, boxHalf, cr);

  // --- Mask ----------------------------------------------------------------
  // uSoftness drives the edge-blur width (0 = hard pixel edge, 1 = very diffuse).
  float edgeW    = mix(0.005, 0.07, uSoftness);
  float tileMask = 1.0 - smoothstep(-edgeW, edgeW, sdf);

  // Height profile: 1 at tile centre, tapers to 0 at the boundary.
  // uThickness blends flat slab (tileMask) ↔ plano-convex lens (h).
  float h         = clamp(-sdf / max(tileHalf, 0.01), 0.0, 1.0);
  float thickMask = mix(tileMask, h, uThickness);

  // --- Surface normal from SDF gradient ------------------------------------
  // On the flat face (deep inside the tile) N = (0,0,1) — no tilt, no refraction.
  // In the bevel zone (within cornerRadius of the boundary) N tilts, refracting
  // the background like a cylindrical or spherical lens along the tile edge.
  vec2 gradTile = sdRoundedBoxGrad(localUV, boxHalf);

  // Rotate gradient back from tile space to screen-UV space (inverse rotation).
  vec2 gradUV = vec2(
    gradTile.x * cosA - gradTile.y * sinA,
    gradTile.x * sinA + gradTile.y * cosA
  );

  // slope: 0 deep in the flat interior, 1 at and beyond the boundary.
  // Bevel zone spans cornerRadius + edge-blur so it covers the full visible edge.
  float bevelDepth = max(cr + edgeW, 0.02);
  float slope      = smoothstep(-bevelDepth, 0.0, sdf);

  // Fresnel attenuation — concentrates refraction at the tile centre, weaker at
  // steep edges; mirrors the diagonal bands Fresnel behaviour exactly.
  float fresnelAtten = 1.0 - uFresnel * slope * slope;

  // 3D surface normal. STEEPNESS matches diagonalBands so IOR values transfer.
  vec3 N = normalize(vec3(-gradUV * slope * STEEPNESS, 1.0));

  // --- Snell's law refraction ----------------------------------------------
  float eta      = 1.0 / max(uIOR, 1.0);
  vec3  incident = vec3(0.0, 0.0, -1.0);
  vec3  refracted = refract(incident, N, eta);
  // TIR guard: refract() returns vec3(0) on total internal reflection.
  if (length(refracted) < 0.001) refracted = incident;

  // --- Apply displacement --------------------------------------------------
  // thickMask is zero between tiles so inter-tile gaps pass the background
  // through unmodified — no distortion in the gaps.
  vec2 displacement = refracted.xy * thickMask * fresnelAtten;
  gl_FragColor = texture2D(uBackground, vUv + displacement);
}
