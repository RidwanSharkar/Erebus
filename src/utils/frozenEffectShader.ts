import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';

// ---------------------------------------------------------------------------
// Shared simplex noise (compact GLSL)
// ---------------------------------------------------------------------------
const SIMPLEX_NOISE_GLSL = `
  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const ICE_SHELL_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ICE_SHELL_FRAG = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  ${SIMPLEX_NOISE_GLSL}

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.8);

    float frostA = snoise(n * 4.0 + vec3(uTime * 0.12));
    float frostB = snoise(n * 8.0 - vec3(uTime * 0.08));
    float frost = (frostA * 0.6 + frostB * 0.4) * 0.5 + 0.5;

    vec3 col = mix(uColorCore, uColorRim, fresnel);
    col += vec3(0.85, 0.95, 1.0) * frost * 0.18;
    col *= 0.85 + uIntensity * 0.15;

    float alpha = (0.18 + fresnel * 0.62 + frost * 0.12) * uOpacity * uIntensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

const FROST_GROUND_VERT = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FROST_GROUND_FRAG = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uIntensity;

  varying vec2 vUv;

  ${SIMPLEX_NOISE_GLSL}

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;
    float radial = 1.0 - smoothstep(0.15, 1.0, dist);
    radial = pow(radial, 1.4);

    float noise = snoise(vec3(vUv * 5.0, uTime * 0.25));
    noise = noise * 0.5 + 0.5;
    float ring = smoothstep(0.55, 0.75, dist) * (1.0 - smoothstep(0.75, 0.95, dist));

    float frost = radial * (0.55 + noise * 0.45) + ring * 0.35;
    vec3 col = mix(vec3(0.55, 0.82, 0.98), vec3(0.88, 0.96, 1.0), noise);

    gl_FragColor = vec4(col, frost * uOpacity * uIntensity * 0.72);
  }
`;

export const ICE_MOTE_VERT = `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uIntensity;

  varying float vAlpha;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float t     = mod(uTime * aSpeed + aIndex * 2.718, 4.0);
    float tNorm = t / 4.0;

    vec3 pos = aOrigin;
    float angle = aIndex * 1.618 + uTime * aSpeed * 0.35;
    pos.x += cos(angle) * (0.15 + hash(aIndex) * 0.35);
    pos.z += sin(angle) * (0.15 + hash(aIndex + 3.0) * 0.35);
    pos.y += sin(uTime * 1.8 + aIndex * 4.1) * 0.12 + tNorm * 0.8;

    pos.x += sin(uTime * 2.4 + aIndex * 5.3) * 0.06;
    pos.z += cos(uTime * 2.1 + aIndex * 2.7) * 0.06;

    vAlpha = smoothstep(0.0, 0.12, tNorm) * (1.0 - smoothstep(0.7, 1.0, tNorm));
    vAlpha *= uOpacity * uIntensity;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.2 - tNorm * 0.5) * (280.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const ICE_MOTE_FRAG = `
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.35, 1.0, r);
    gl_FragColor = vec4(0.78, 0.94, 1.0, vAlpha * soft * 0.85);
  }
`;

const ICE_CORE = new Color('#B3E5FC');
const ICE_RIM = new Color('#4FC3F7');

export function createIceShellMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uIntensity: { value: 1 },
      uColorCore: { value: ICE_CORE.clone() },
      uColorRim: { value: ICE_RIM.clone() },
    },
    vertexShader: ICE_SHELL_VERT,
    fragmentShader: ICE_SHELL_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

export function createFrostGroundMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uIntensity: { value: 1 },
    },
    vertexShader: FROST_GROUND_VERT,
    fragmentShader: FROST_GROUND_FRAG,
    transparent: true,
    depthWrite: false,
  });
}

export function createIceMoteMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uIntensity: { value: 1 },
    },
    vertexShader: ICE_MOTE_VERT,
    fragmentShader: ICE_MOTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
