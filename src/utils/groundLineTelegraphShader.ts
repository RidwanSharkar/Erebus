import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';

export type GroundLineTelegraphVariant = 'viper' | 'tentacle' | 'archon' | 'archonPurple';

export interface GroundLineTelegraphPreset {
  color: string;
  glowColor: string;
  scrollSpeed: number;
  pulseSpeed: number;
  softness: number;
  baseOpacity: number;
  glowOpacity: number;
  flickerAmount: number;
  baseLaneOpacity: number;
  baseLaneGlowOpacity: number;
  showEndpointCaps: boolean;
}

export const GROUND_LINE_TELEGRAPH_PRESETS: Record<GroundLineTelegraphVariant, GroundLineTelegraphPreset> = {
  viper: {
    color: '#c94a3a',
    glowColor: '#ff6644',
    scrollSpeed: 3.5,
    pulseSpeed: 12,
    softness: 0.18,
    baseOpacity: 0.72,
    glowOpacity: 0.35,
    flickerAmount: 0.15,
    baseLaneOpacity: 0.28,
    baseLaneGlowOpacity: 0.14,
    showEndpointCaps: false,
  },
  tentacle: {
    color: '#c94a3a',
    glowColor: '#ff5533',
    scrollSpeed: 1.8,
    pulseSpeed: 5,
    softness: 0.28,
    baseOpacity: 0.68,
    glowOpacity: 0.3,
    flickerAmount: 0.08,
    baseLaneOpacity: 0.32,
    baseLaneGlowOpacity: 0.16,
    showEndpointCaps: false,
  },
  archon: {
    color: '#ff3333',
    glowColor: '#ff8888',
    scrollSpeed: 4.5,
    pulseSpeed: 18,
    softness: 0.15,
    baseOpacity: 0.78,
    glowOpacity: 0.45,
    flickerAmount: 0.25,
    baseLaneOpacity: 0.3,
    baseLaneGlowOpacity: 0.18,
    showEndpointCaps: true,
  },
  archonPurple: {
    color: '#aa33ff',
    glowColor: '#dd88ff',
    scrollSpeed: 4.5,
    pulseSpeed: 18,
    softness: 0.15,
    baseOpacity: 0.78,
    glowOpacity: 0.45,
    flickerAmount: 0.25,
    baseLaneOpacity: 0.3,
    baseLaneGlowOpacity: 0.18,
    showEndpointCaps: true,
  },
};

export const GROUND_LINE_TELEGRAPH_VERTEX = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GROUND_LINE_TELEGRAPH_BASE_FRAGMENT = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uSoftness;
  uniform float uOpacity;
  uniform float uIsGlow;

  varying vec2 vUv;

  void main() {
    float edgeX = smoothstep(0.0, uSoftness, vUv.x) * smoothstep(0.0, uSoftness, 1.0 - vUv.x);
    float along = 1.0 - vUv.y;

    float laneGrain = sin(along * 10.0 + uTime * 0.8) * 0.5 + 0.5;
    laneGrain = 0.82 + laneGrain * 0.18;
    float edgeFade = smoothstep(0.0, 0.08, along) * smoothstep(0.0, 0.08, 1.0 - along);

    vec3 coreColor = mix(uColor * 0.55, uGlowColor * 0.35, laneGrain * 0.35);
    if (uIsGlow > 0.5) {
      coreColor = uGlowColor * 0.65;
    }

    float alpha = edgeX * edgeFade * uOpacity * laneGrain * (0.88 + 0.12 * uPulse);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(coreColor, alpha);
  }
`;

export const GROUND_LINE_TELEGRAPH_FRAGMENT = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uSoftness;
  uniform float uScrollSpeed;
  uniform float uOpacity;
  uniform float uIsGlow;

  varying vec2 vUv;

  void main() {
    float edgeX = smoothstep(0.0, uSoftness, vUv.x) * smoothstep(0.0, uSoftness, 1.0 - vUv.x);
    float along = 1.0 - vUv.y;
    float progressEdge = smoothstep(uProgress - 0.06, uProgress, along);
    float fillMask = step(along, uProgress) * progressEdge;

    float band = sin((along * 14.0 - uTime * uScrollSpeed) * 6.28318) * 0.5 + 0.5;
    band = pow(band, 2.2);
    float chevron = smoothstep(0.35, 0.5, band) * smoothstep(0.85, 0.65, band);

    float urgency = smoothstep(0.78, 1.0, uProgress);
    float pulseBoost = 1.0 + urgency * 0.45 * uPulse;

    vec3 coreColor = mix(uColor, uGlowColor, chevron * (0.35 + urgency * 0.35));
    if (uIsGlow > 0.5) {
      coreColor = uGlowColor;
    }

    float alpha = edgeX * fillMask * uOpacity * pulseBoost;
    alpha *= 0.55 + chevron * 0.45;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(coreColor, alpha);
  }
`;

export const GROUND_LINE_CAP_FRAGMENT = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  uniform float uScale;

  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    float ring = smoothstep(uScale + 0.08, uScale, dist) * smoothstep(uScale - 0.22, uScale - 0.05, dist);
    float inner = smoothstep(0.35, 0.05, dist);
    float pulse = 0.75 + 0.25 * uPulse;
    float alpha = (ring * 0.85 + inner * 0.25) * uOpacity * pulse;
    alpha *= 0.65 + uProgress * 0.35;
    if (alpha < 0.01) discard;
    vec3 col = mix(uColor, uGlowColor, ring);
    gl_FragColor = vec4(col, alpha);
  }
`;

function hexToVec3(hex: string): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

export function createGroundLineTelegraphMaterial(
  preset: GroundLineTelegraphPreset,
  colorOverride?: string,
  isGlow = false
): ShaderMaterial {
  const color = colorOverride ?? preset.color;
  const [r, g, b] = hexToVec3(color);
  const [gr, gg, gb] = hexToVec3(preset.glowColor);

  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPulse: { value: 1 },
      uColor: { value: [r, g, b] },
      uGlowColor: { value: [gr, gg, gb] },
      uSoftness: { value: preset.softness },
      uScrollSpeed: { value: preset.scrollSpeed },
      uOpacity: { value: isGlow ? preset.glowOpacity : preset.baseOpacity },
      uIsGlow: { value: isGlow ? 1 : 0 },
    },
    vertexShader: GROUND_LINE_TELEGRAPH_VERTEX,
    fragmentShader: GROUND_LINE_TELEGRAPH_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: isGlow ? AdditiveBlending : undefined,
  });
}

export function createGroundLineTelegraphBaseMaterial(
  preset: GroundLineTelegraphPreset,
  colorOverride?: string,
  isGlow = false
): ShaderMaterial {
  const color = colorOverride ?? preset.color;
  const [r, g, b] = hexToVec3(color);
  const [gr, gg, gb] = hexToVec3(preset.glowColor);

  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uColor: { value: [r, g, b] },
      uGlowColor: { value: [gr, gg, gb] },
      uSoftness: { value: preset.softness + 0.04 },
      uOpacity: { value: isGlow ? preset.baseLaneGlowOpacity : preset.baseLaneOpacity },
      uIsGlow: { value: isGlow ? 1 : 0 },
    },
    vertexShader: GROUND_LINE_TELEGRAPH_VERTEX,
    fragmentShader: GROUND_LINE_TELEGRAPH_BASE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: isGlow ? AdditiveBlending : undefined,
  });
}

export function createGroundLineCapMaterial(preset: GroundLineTelegraphPreset, colorOverride?: string): ShaderMaterial {
  const color = colorOverride ?? preset.color;
  const [r, g, b] = hexToVec3(color);
  const [gr, gg, gb] = hexToVec3(preset.glowColor);

  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPulse: { value: 1 },
      uColor: { value: [r, g, b] },
      uGlowColor: { value: [gr, gg, gb] },
      uOpacity: { value: preset.baseOpacity + 0.1 },
      uScale: { value: 0.72 },
    },
    vertexShader: GROUND_LINE_TELEGRAPH_VERTEX,
    fragmentShader: GROUND_LINE_CAP_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}

/** Boss 2 Archon Lightning windup — keep in sync with backend/enemyAI.js */
export const BOSS2_ARCHON_LIGHTNING_WINDUP_MS = 750;
