uniform sampler2D uBackground;
uniform float uTime;
uniform bool  uLayerEnabled;
uniform float uSpeed;
uniform float uOffset;
uniform float uScale;       // cell size (~4.0)
uniform float uIntensity;   // brightness (~0.12)

varying vec2 vUv;

void main() {
  vec4 bg = texture2D(uBackground, vUv);
  if (!uLayerEnabled) { gl_FragColor = bg; return; }

  float t = uTime * uSpeed + uOffset;
  vec2 p = vUv * uScale;

  // Two sine planes at 60° separation — product = caustic interference cells
  float a1 = 1.047;  // 60°
  float a2 = 2.094;  // 120°
  float c1 = sin(dot(p, vec2(cos(a1), sin(a1))) + t);
  float c2 = sin(dot(p, vec2(cos(a2), sin(a2))) - t * 0.7);
  float caustic = max(0.0, c1 * c2);  // positive only = bright spots

  gl_FragColor = bg + vec4(vec3(caustic * uIntensity), 0.0);
}
