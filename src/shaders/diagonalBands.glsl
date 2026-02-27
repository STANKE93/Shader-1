uniform sampler2D uBackground;
uniform float     uTime;
uniform bool      uLayerEnabled;
uniform float     uSpeed;
uniform float     uOffset;
uniform float     uSpacing;    // band frequency (cycles visible across the diagonal)
uniform float     uAngle;      // band direction in radians
uniform float     uSoftness;   // band edge softness: 0 = sharp glass slab, 1 = smooth fade
uniform float     uIOR;        // index of refraction (1.0 = none, 1.5 = glass, 2.5 = heavy)
uniform float     uThickness;  // [0..1]: 0 = sharp binary slab, 1 = smooth height-profile lens
uniform float     uFresnel;    // [0..1]: Fresnel edge attenuation strength

varying vec2 vUv;

// Surface steepness of the band profile — artistic constant that sets how
// "thick" the band reads as a lens. Exposed via IOR; not a separate parameter.
const float STEEPNESS = 0.13;

void main() {
  if (!uLayerEnabled) {
    gl_FragColor = texture2D(uBackground, vUv);
    return;
  }

  vec2  dir   = vec2(cos(uAngle), sin(uAngle));
  float proj  = dot(vUv, dir);
  float phase = proj * uSpacing * 6.28318 + uTime * uSpeed + uOffset;

  // --- Band profile --------------------------------------------------------
  // wave ∈ [0,1]: the sine height profile — 1 at crests, 0 at troughs.
  // This doubles as the thickness map: thicker glass at crests.
  float wave = sin(phase) * 0.5 + 0.5;
  float edge = 0.5 - clamp(uSoftness * 0.48, 0.001, 0.479);
  float bandMask = smoothstep(edge, 1.0 - edge, wave);

  // --- Thickness scaling ---------------------------------------------------
  // At uThickness = 0: sharp binary mask (current behaviour).
  // At uThickness = 1: smooth height-profile — displacement is greatest at the
  // crest (thick glass) and tapers to zero at the trough (no glass), simulating
  // a true cylindrical lens rather than a flat slab.
  float thickMask = mix(bandMask, wave, uThickness);

  // --- Surface normal ------------------------------------------------------
  // The band profile h = sin(phase). Its gradient w.r.t. UV is:
  //   ∂h/∂uv = cos(phase) * dir
  // For a height-field surface, the outward normal (pointing toward the viewer)
  // is N ∝ (-∂h/∂x, -∂h/∂y, 1). STEEPNESS scales how curved the surface reads.
  float gradMag = cos(phase) * STEEPNESS;
  vec3  N       = normalize(vec3(-gradMag * dir, 1.0));

  // --- Snell's law refraction ----------------------------------------------
  // Incident ray from +z (the viewer), entering glass from air.
  // eta = n_air / n_glass = 1.0 / IOR
  float eta      = 1.0 / max(uIOR, 1.0);
  vec3  incident = vec3(0.0, 0.0, -1.0);
  vec3  refracted = refract(incident, N, eta);

  // refract() returns vec3(0) on total internal reflection — fall back to
  // straight-through so no hard black artifacts appear.
  if (length(refracted) < 0.001) refracted = incident;

  // --- Fresnel edge falloff ------------------------------------------------
  // cos(phase) is the band surface slope: 0 at flat crests, ±1 at steepest
  // edges. Real Fresnel says steep surfaces reflect more and transmit less,
  // so we attenuate displacement where the slope is greatest.
  // Using the raw phase slope rather than N.z because STEEPNESS keeps N within
  // 0.8° of vertical — too small to produce a visible cosθ variation.
  // Quadratic slope² gives a gentle centre-to-edge gradient that reads clearly.
  float slope        = abs(cos(phase));
  float fresnelAtten = 1.0 - uFresnel * slope * slope;

  // --- Apply displacement --------------------------------------------------
  // thickMask concentrates displacement at the crest; fresnelAtten reduces it
  // at the steep edges. The two effects are complementary: both peak at the
  // crest (wave=1, slope=0) and vanish at the trough (wave=0, slope=1).
  vec2 displacement = refracted.xy * thickMask * fresnelAtten;
  gl_FragColor = texture2D(uBackground, vUv + displacement);
}
