// Final-lens grade: subtle chromatic aberration, animated film grain and
// a photographic vignette. Runs after tone mapping, before FXAA.
export const GradeShader = {
  name: 'ApexGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aberration: { value: 0.004 },
    grain: { value: 0.035 },
    vignette: { value: 0.34 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float aberration;
    uniform float grain;
    uniform float vignette;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - 0.5;
      float d = dot(dir, dir);
      vec2 off = dir * aberration * (0.35 + d * 1.6);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float n = hash(vUv * vec2(1280.0, 720.0) + fract(time) * 91.7) - 0.5;
      col += n * grain;
      col *= 1.0 - smoothstep(0.18, 0.82, d) * vignette;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
