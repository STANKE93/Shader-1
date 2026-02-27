uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform float uAngle;     // flow direction in radians — align with bands
uniform float uSpacing;   // streak frequency (cycles across the diagonal)
uniform float uWidth;     // Gaussian sigma, cross-flow (thinness), in lane fractions
uniform float uLength;    // domain coverage [0..1]: 0 = point, 1 = continuous band
uniform float uIntensity; // peak additive brightness
uniform vec3  uColor;     // highlight tint (linear RGB)

varying vec2 vUv;

void main() {
  if (!uLayerEnabled) { gl_FragColor = vec4(0.0); return; }

  vec2 dir  = vec2(cos(uAngle), sin(uAngle));
  vec2 perp = vec2(-sin(uAngle), cos(uAngle));

  // Project onto band-aligned coordinate system
  float proj   = dot(vUv, dir);   // position along flow direction
  float across = dot(vUv, perp);  // position perpendicular to flow

  float t = uTime * uSpeed + uOffset;

  // --- Perpendicular tiling: which streak lane ---
  float acrossScaled = across * uSpacing;
  float lane         = floor(acrossScaled);
  float acrossTile   = fract(acrossScaled) - 0.5;  // [-0.5, 0.5], centred in lane

  // Golden-ratio jitter per lane — staggers each streak along the flow axis
  // so the pattern reads as scattered glints rather than a rigid grid.
  float laneJitter = fract(lane * 0.6180339887);

  // --- Along-flow tiling: streak position and motion ---
  // Subtracting t causes the highlight to travel in the positive dir direction.
  float alongScaled = proj * uSpacing - t + laneJitter;
  float alongTile   = fract(alongScaled) - 0.5;  // [-0.5, 0.5]

  // --- Gaussian profile ---
  // Cross: tight Gaussian controls thinness (uWidth is sigma directly).
  // Along: uLength [0..1] maps to sigma [0..0.5] in tile-fraction space.
  //   At sigma = 0.5 the periodic Gaussian sum across neighbouring tiles is
  //   nearly flat, so length = 1.0 merges all streaks into a continuous band.
  //   Below that the Gaussians remain isolated — coverage grows with length.
  float alongSigma = uLength * 0.5 + 0.005;  // +0.005 avoids degenerate sigma
  float crossGauss = exp(-(acrossTile * acrossTile) / (2.0 * uWidth      * uWidth));
  float alongGauss = exp(-(alongTile  * alongTile)  / (2.0 * alongSigma  * alongSigma));

  // Soft radial vignette — fades streaks toward corners so they stay in the
  // visual centre without hard clipping at the quad edges.
  float vignette = 1.0 - smoothstep(0.3, 0.75, length(vUv - 0.5));

  float brightness = crossGauss * alongGauss * uIntensity * vignette;

  // Alpha = brightness so AdditiveBlending contributes exactly uColor * brightness
  gl_FragColor = vec4(uColor * brightness, brightness);
}
