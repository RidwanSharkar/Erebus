import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  NormalBlending,
  ShaderMaterial,
} from '@/utils/three-exports';

export const VOID_DRAG_PARTICLE_COUNT = 36;

export type VoidRgb = [number, number, number];

export type VoidEffectPalette = {
  energyDim: VoidRgb;
  energyBright: VoidRgb;
  particleDim: VoidRgb;
  particleBright: VoidRgb;
};

export const VOID_PORTAL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const VOID_MAW_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uEnergyDim;
  uniform vec3 uEnergyBright;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float spiral = sin(angle * 6.0 + uTime * 4.2 - dist * 14.0) * 0.5 + 0.5;
    float pull = sin(angle * 9.0 - uTime * 6.0 + dist * 11.0) * 0.5 + 0.5;

    float voidCore = smoothstep(0.88, 0.08, dist);
    float rimBand = smoothstep(0.58, 0.82, dist) * (1.0 - smoothstep(0.94, 1.0, dist));
    float wisp = spiral * smoothstep(0.22, 0.68, dist) * (1.0 - smoothstep(0.68, 0.9, dist));

    vec3 voidBlack = vec3(0.0, 0.0, 0.0);
    vec3 energy = mix(uEnergyDim, uEnergyBright, spiral * 0.55 + pull * 0.45);
    vec3 color = mix(voidBlack, energy, rimBand * 0.95 + wisp * 0.4);

    float alpha = max(voidCore * 0.995, (rimBand * 0.9 + wisp * 0.25) * 0.85) * uOpen;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const VOID_RIM_GLOW_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uEnergyBright;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float pulse = sin(angle * 7.0 - uTime * 5.0) * 0.5 + 0.5;
    float rim = smoothstep(0.72, 0.9, dist) * (1.0 - smoothstep(0.94, 1.0, dist));
    float alpha = rim * (0.45 + pulse * 0.25) * uOpen;
    gl_FragColor = vec4(uEnergyBright, alpha);
  }
`;

export const VOID_DRAG_VERT = /* glsl */ `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aStartHeight;

  uniform float uTime;
  uniform float uOpen;
  uniform float uEffectHeightOffset;
  uniform float uPortalRadius;
  uniform vec3 uParticleDim;
  uniform vec3 uParticleBright;

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float cycle = 1.8 + hash(aIndex) * 1.4;
    float t     = mod(uTime * aSpeed + aIndex * 1.618, cycle);
    float tNorm = t / cycle;

    float angle = aIndex * 2.39996 - uTime * aSpeed * 0.85;
    float startRadius = 0.35 + hash(aIndex + 3.0) * uPortalRadius * 0.72;
    float radius = startRadius * pow(1.0 - tNorm, 1.6);

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y = uEffectHeightOffset + aStartHeight * (1.0 - tNorm * 1.1);

    pos.x += sin(uTime * 4.2 + aIndex * 5.7) * 0.04 * (1.0 - tNorm);
    pos.z += cos(uTime * 3.5 + aIndex * 3.3) * 0.04 * (1.0 - tNorm);

    vAlpha = smoothstep(0.0, 0.08, tNorm) * (1.0 - smoothstep(0.45, 0.88, tNorm)) * uOpen;

    float heat = 1.0 - tNorm;
    vColor = mix(uParticleDim, uParticleBright, heat * heat);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.2 - tNorm * 0.5) * (220.0 / -mvPos.z) * uOpen;
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const VOID_DRAG_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.3, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9);
  }
`;

export function createVoidMawMaterial(palette: Pick<VoidEffectPalette, 'energyDim' | 'energyBright'>) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 1 },
      uEnergyDim: { value: palette.energyDim },
      uEnergyBright: { value: palette.energyBright },
    },
    vertexShader: VOID_PORTAL_VERTEX,
    fragmentShader: VOID_MAW_FRAGMENT,
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
    blending: NormalBlending,
  });
}

export function createVoidRimGlowMaterial(palette: Pick<VoidEffectPalette, 'energyBright'>) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 1 },
      uEnergyBright: { value: palette.energyBright },
    },
    vertexShader: VOID_PORTAL_VERTEX,
    fragmentShader: VOID_RIM_GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}

export function createVoidDragSystem(
  radius: number,
  palette: Pick<VoidEffectPalette, 'particleDim' | 'particleBright'>,
  options?: {
    count?: number;
    open?: number;
    effectHeightOffset?: number;
  },
) {
  const count = options?.count ?? VOID_DRAG_PARTICLE_COUNT;
  const open = options?.open ?? 1;
  const effectHeightOffset = options?.effectHeightOffset ?? 0;

  const indices = new Float32Array(count);
  const origins = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const startHeights = new Float32Array(count);
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    indices[i] = i;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.85;
    origins[i * 3] = Math.cos(a) * r;
    origins[i * 3 + 1] = 0;
    origins[i * 3 + 2] = Math.sin(a) * r;
    speeds[i] = 1.8 + Math.random() * 2.0;
    sizes[i] = 1.4 + Math.random() * 2.4;
    startHeights[i] = -0.3 + Math.random() * 3.5;
  }

  const dragGeo = new BufferGeometry();
  dragGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  dragGeo.setAttribute('aIndex', new Float32BufferAttribute(indices, 1));
  dragGeo.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
  dragGeo.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
  dragGeo.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  dragGeo.setAttribute('aStartHeight', new Float32BufferAttribute(startHeights, 1));

  const dragMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: open },
      uEffectHeightOffset: { value: effectHeightOffset },
      uPortalRadius: { value: radius },
      uParticleDim: { value: palette.particleDim },
      uParticleBright: { value: palette.particleBright },
    },
    vertexShader: VOID_DRAG_VERT,
    fragmentShader: VOID_DRAG_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  return { dragGeo, dragMat };
}
