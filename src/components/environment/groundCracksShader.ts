import { Color, ShaderMaterial, PlaneGeometry, BufferAttribute } from '@/utils/three-exports';

export const CRACK_VERT = `
  attribute vec2 aCrackSeed;
  varying vec2 vCrackUv;

  void main() {
    vCrackUv = uv * 2.5 + aCrackSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const CRACK_VERT_SINGLE = `
  attribute vec2 aCrackSeed;
  varying vec2 vCrackUv;

  void main() {
    vCrackUv = uv * 2.5 + aCrackSeed;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const CRACK_FRAG = `
  varying vec2 vCrackUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float voronoiEdge(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    float minDist1 = 1e9;
    float minDist2 = 1e9;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell  = vec2(float(x), float(y));
        vec2 point = hash2(pi + cell);
        vec2 diff  = cell + point - pf;
        float d    = dot(diff, diff);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; }
        else if (d < minDist2) { minDist2 = d; }
      }
    }
    return sqrt(minDist2) - sqrt(minDist1);
  }

  float crackLine(float edge, float baseWidth) {
    float w = max(baseWidth, fwidth(edge) * 1.5);
    return smoothstep(w, 0.0, edge);
  }

  void main() {
    vec2 uv = vCrackUv;

    float edge1 = voronoiEdge(uv * 1.0);
    float edge2 = voronoiEdge(uv * 2.2 + 3.7);
    float edge3 = voronoiEdge(uv * 4.5 - 1.9);

    float crack1 = crackLine(edge1, 0.06);
    float crack2 = crackLine(edge2, 0.03) * 0.7;
    float crack3 = crackLine(edge3, 0.015) * 0.45;

    float cracks = clamp(crack1 + crack2 + crack3, 0.0, 1.0);

    vec3 crackCol = vec3(0.06, 0.05, 0.04);
    float alpha   = cracks * 0.72;

    gl_FragColor = vec4(crackCol, alpha);
  }
`;

const SPIKE_CRACK_FRAG = `
  uniform float uOpacity;
  uniform vec3 uTint;
  varying vec2 vCrackUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float voronoiEdge(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    float minDist1 = 1e9;
    float minDist2 = 1e9;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell  = vec2(float(x), float(y));
        vec2 point = hash2(pi + cell);
        vec2 diff  = cell + point - pf;
        float d    = dot(diff, diff);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; }
        else if (d < minDist2) { minDist2 = d; }
      }
    }
    return sqrt(minDist2) - sqrt(minDist1);
  }

  float crackLine(float edge, float baseWidth) {
    float w = max(baseWidth, fwidth(edge) * 1.5);
    return smoothstep(w, 0.0, edge);
  }

  void main() {
    vec2 uv = vCrackUv;

    float edge1 = voronoiEdge(uv * 1.0);
    float edge2 = voronoiEdge(uv * 2.2 + 3.7);
    float edge3 = voronoiEdge(uv * 4.5 - 1.9);

    float crack1 = crackLine(edge1, 0.08);
    float crack2 = crackLine(edge2, 0.04) * 0.75;
    float crack3 = crackLine(edge3, 0.02) * 0.5;

    float cracks = clamp(crack1 + crack2 + crack3, 0.0, 1.0);

    vec3 baseCol = vec3(0.18, 0.14, 0.10);
    vec3 crackCol = mix(baseCol, uTint, 0.35);
    float alpha = cracks * 0.88 * uOpacity;

    gl_FragColor = vec4(crackCol, alpha);
  }
`;

const SPIKE_CRACK_TINTS = {
  earth: new Color(0.55, 0.35, 0.18),
  blue: new Color(0.25, 0.45, 0.75),
  green: new Color(0.15, 0.65, 0.30),
} as const;

export type SpikeCrackTheme = keyof typeof SPIKE_CRACK_TINTS;

export function createGroundCrackMaterial(instanced = true): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: instanced ? CRACK_VERT : CRACK_VERT_SINGLE,
    fragmentShader: CRACK_FRAG,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** Brighter spike/impale decal material with opacity + theme tint uniforms for fade animation. */
export function createSpikeGroundCrackMaterial(theme: SpikeCrackTheme = 'earth'): ShaderMaterial {
  const tint = SPIKE_CRACK_TINTS[theme];
  return new ShaderMaterial({
    vertexShader: CRACK_VERT_SINGLE,
    fragmentShader: SPIKE_CRACK_FRAG,
    uniforms: {
      uOpacity: { value: 1.0 },
      uTint: { value: tint.clone() },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export const SHARED_SPIKE_CRACK_PLANE = new PlaneGeometry(1, 1);
SHARED_SPIKE_CRACK_PLANE.userData.shared = true;

const SPIKE_CRACK_MATERIAL_POOL: Record<SpikeCrackTheme, ShaderMaterial[]> = {
  earth: [],
  blue: [],
  green: [],
};

export function acquireSpikeGroundCrackMaterial(theme: SpikeCrackTheme = 'earth'): ShaderMaterial {
  const pool = SPIKE_CRACK_MATERIAL_POOL[theme];
  const mat = pool.pop() ?? createSpikeGroundCrackMaterial(theme);
  if (mat.uniforms?.uOpacity) {
    mat.uniforms.uOpacity.value = 1.0;
  }
  return mat;
}

export function releaseSpikeGroundCrackMaterial(theme: SpikeCrackTheme, material: ShaderMaterial): void {
  SPIKE_CRACK_MATERIAL_POOL[theme].push(material);
}

export function createSpikeCrackPlaneGeometry(crackSeedX: number, crackSeedY: number): PlaneGeometry {
  const geo = SHARED_SPIKE_CRACK_PLANE.clone();
  geo.setAttribute('aCrackSeed', new BufferAttribute(new Float32Array([crackSeedX, crackSeedY]), 2));
  return geo;
}
