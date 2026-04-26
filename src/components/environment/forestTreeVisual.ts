/**
 * Shared forest / spine-tree geometry, shaders, and materials (used by InstancedForest + TentacleSpineRenderer).
 */
import {
  ShaderMaterial,
  CylinderGeometry,
  SphereGeometry,
  CircleGeometry,
  Float32BufferAttribute,
  Vector3,
  Color,
  DoubleSide,
} from '@/utils/three-exports';

/** 3 overlapping sphere tiers — same as InstancedForest */
export const FOREST_CANOPY_TIERS = [
  { yFrac: 0.0, rScale: 1.0 },
  { yFrac: 0.6, rScale: 0.85 },
  { yFrac: 0.35, rScale: 0.72 },
] as const;

export const FOREST_SUN_DIR = new Vector3(1.0, 0.85, -0.55).normalize();

/** InstancedMesh — uses instanceMatrix (InstancedForest) */
export const FOREST_TRUNK_VERT_INSTANCED = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float bend = aHeightRatio * aHeightRatio;
    float phase = wp.x * 0.18 + wp.z * 0.13;
    float w1 = sin(phase + uTime * 0.75) * uWindStrength * bend;
    float w2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22 * bend;
    wp.x += w1 + w2;
    wp.z += (w1 + w2) * 0.35;
    wp.y -= abs(w1) * 0.03 * bend;
    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

/** Regular Mesh — modelMatrix (TentacleSpineRenderer) */
export const FOREST_TRUNK_VERT = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float bend = aHeightRatio * aHeightRatio;
    float phase = wp.x * 0.18 + wp.z * 0.13;
    float w1 = sin(phase + uTime * 0.75) * uWindStrength * bend;
    float w2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22 * bend;
    wp.x += w1 + w2;
    wp.z += (w1 + w2) * 0.35;
    wp.y -= abs(w1) * 0.03 * bend;
    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

export const FOREST_TRUNK_FRAG = `
  uniform vec3 uTrunkDark;
  uniform vec3 uTrunkLight;
  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec3 col = mix(uTrunkDark, uTrunkLight, vHeightRatio * 0.65);
    col *= 0.82 + sin(vWorldPos.y * 5.2 + vWorldPos.x * 2.8) * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const FOREST_CANOPY_VERT_INSTANCED = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;
  varying vec3 vLocalNorm;

  void main() {
    vLocalNorm = normalize(position);

    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float phase = wp.x * 0.18 + wp.z * 0.13;

    float s1 = sin(phase + uTime * 0.75) * uWindStrength;
    float s2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22;

    float flutter = sin(wp.x * 4.8 + wp.z * 3.9 + uTime * 3.6) * uWindStrength * 0.15 * aHeightRatio;

    float totalX = s1 + s2 + flutter;
    wp.x += totalX;
    wp.z += totalX * 0.38;

    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

export const FOREST_CANOPY_VERT = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;
  varying vec3 vLocalNorm;

  void main() {
    vLocalNorm = normalize(position);

    vec4 wp = modelMatrix * vec4(position, 1.0);
    float phase = wp.x * 0.18 + wp.z * 0.13;

    float s1 = sin(phase + uTime * 0.75) * uWindStrength;
    float s2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22;

    float flutter = sin(wp.x * 4.8 + wp.z * 3.9 + uTime * 3.6) * uWindStrength * 0.15 * aHeightRatio;

    float totalX = s1 + s2 + flutter;
    wp.x += totalX;
    wp.z += totalX * 0.38;

    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

export const FOREST_CANOPY_FRAG = `
  uniform vec3 uLeafDark;
  uniform vec3 uLeafLight;
  uniform vec3 uSunDir;

  varying float vHeightRatio;
  varying vec3 vWorldPos;
  varying vec3 vLocalNorm;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec3 faceNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));

    float diffuse = clamp(dot(faceNormal, uSunDir), 0.0, 1.0);
    float skyUp   = max(0.0, dot(faceNormal, vec3(0.0, 1.0, 0.0)));
    float light   = 0.55 + diffuse * 0.28 + skyUp * 0.17;

    vec3 col = mix(uLeafDark, uLeafLight, clamp(light, 0.0, 1.0));

    vec2 sUV = vLocalNorm.xz * 3.8 + vLocalNorm.y * 1.5;

    float n1 = vnoise(sUV * 1.6);
    float n2 = vnoise(sUV * 3.5 + 7.31);
    float n3 = vnoise(sUV * 7.2 - 2.93);

    float leafTex = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

    leafTex = smoothstep(0.32, 0.75, leafTex);

    col = mix(col * 0.88, col * 1.10, leafTex);

    col *= 0.88 + skyUp * 0.16;

    col += vec3(0.08, 0.04, 0.14) * skyUp * 0.24;

    col *= 0.94 + vHeightRatio * 0.12;

    float dist = length(vWorldPos.xz);
    col *= 1.0 - smoothstep(16.0, 20.0, dist) * 0.30;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const FOREST_SHADOW_VERT_INSTANCED = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const FOREST_SHADOW_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FOREST_SHADOW_FRAG = `
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c * vec2(1.0, 0.75)) * 2.0;
    float alpha = (1.0 - smoothstep(0.55, 1.0, r)) * 0.38;
    gl_FragColor = vec4(0.05, 0.0, 0.10, alpha);
  }
`;

export function forestAddHeightRatio(geo: CylinderGeometry | SphereGeometry): void {
  const pos = geo.attributes.position.array as Float32Array;
  const hr = new Float32Array(pos.length / 3);
  const isSphere = (geo as SphereGeometry).type === 'SphereGeometry';
  for (let i = 0; i < hr.length; i++) {
    const y = pos[i * 3 + 1];
    hr[i] = isSphere
      ? Math.max(0, Math.min(1, (y + 1.0) * 0.5))
      : Math.max(0, Math.min(1, y + 0.5));
  }
  geo.setAttribute('aHeightRatio', new Float32BufferAttribute(hr, 1));
}

/** Matches `createForestTrunkGeometry` / InstancedForest trunk height. */
export const FOREST_TRUNK_CYL_H = 3.25;

/** Taper radius at relative height t in [0,1] — same as unscaled Cylinder(0.05,1,h) * trunkR. */
export function forestTrunkRadiusAtT(trunkR: number, t: number): number {
  return (1.0 + (0.05 - 1.0) * t) * trunkR;
}

/**
 * `aHeightRatio` 0 = ground end of the full trunk, 1 = tip, so trunk wind matches a single instanced tree.
 * Only for per-segment frusta used by TentacleSpineRenderer.
 */
export function forestAddHeightRatioTentacleSegment(
  geo: CylinderGeometry,
  segmentIndex: number,
  segmentCount: number,
  cylinderHeight: number = FOREST_TRUNK_CYL_H,
): void {
  const pos = geo.attributes.position.array as Float32Array;
  const hr = new Float32Array(pos.length / 3);
  const h = cylinderHeight;
  const half = h * 0.5;
  for (let i = 0; i < hr.length; i++) {
    const y = pos[i * 3 + 1];
    const localT = (y + half) / h;
    const lt = Math.max(0, Math.min(1, localT));
    const globalT = (segmentIndex + lt) / segmentCount;
    hr[i] = Math.max(0, Math.min(1, globalT));
  }
  geo.setAttribute('aHeightRatio', new Float32BufferAttribute(hr, 1));
}

/**
 * N stacked frusta matching one instanced-forest trunk taper; joints share radius.
 * (radiusTop, radiusBottom, height) = narrow at +Y, wide at -Y, same as `createForestTrunkGeometry`.
 */
export function createForestTrunkTaperedSegmentGeometries(
  segmentCount: number,
  trunkR: number,
  radialSegments = 5,
  heightSegments = 4,
  cylinderHeight = FOREST_TRUNK_CYL_H,
): CylinderGeometry[] {
  return Array.from({ length: segmentCount }, (_, i) => {
    const t0 = i / segmentCount;
    const t1 = (i + 1) / segmentCount;
    const rBottom = forestTrunkRadiusAtT(trunkR, t0);
    const rTop = forestTrunkRadiusAtT(trunkR, t1);
    const g = new CylinderGeometry(rTop, rBottom, cylinderHeight, radialSegments, heightSegments);
    forestAddHeightRatioTentacleSegment(g, i, segmentCount, cylinderHeight);
    return g;
  });
}

export function createForestTrunkGeometry(): CylinderGeometry {
  const g = new CylinderGeometry(0.05, 1.0, FOREST_TRUNK_CYL_H, 5, 4);
  forestAddHeightRatio(g);
  return g;
}

export function createForestCanopyGeometries(): SphereGeometry[] {
  return FOREST_CANOPY_TIERS.map(() => {
    const g = new SphereGeometry(0.05, 3, 25);
    forestAddHeightRatio(g);
    return g;
  });
}

export function createForestShadowDiscGeometry(): CircleGeometry {
  return new CircleGeometry(0.5, 10);
}

export interface ForestTreePalette {
  trunkDark: string;
  trunkLight: string;
  leafDark: string;
  leafLight: string;
  windStrength: number;
}

export const DEFAULT_FOREST_PALETTE: ForestTreePalette = {
  trunkDark: '#3d2b1f',
  trunkLight: '#6b4a34',
  leafDark: '#2a6b14',
  leafLight: '#F991CC',
  windStrength: 0.65,
};

export function createForestTrunkShaderMaterial(
  p: ForestTreePalette,
  instanced: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: p.windStrength },
      uTrunkDark: { value: new Color(p.trunkDark) },
      uTrunkLight: { value: new Color(p.trunkLight) },
    },
    vertexShader: instanced ? FOREST_TRUNK_VERT_INSTANCED : FOREST_TRUNK_VERT,
    fragmentShader: FOREST_TRUNK_FRAG,
    side: DoubleSide,
  });
}

export function createForestCanopyShaderMaterials(
  p: ForestTreePalette,
  instanced: boolean,
): ShaderMaterial[] {
  const vert = instanced ? FOREST_CANOPY_VERT_INSTANCED : FOREST_CANOPY_VERT;
  return FOREST_CANOPY_TIERS.map(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uWindStrength: { value: p.windStrength },
          uLeafDark: { value: new Color(p.leafDark) },
          uLeafLight: { value: new Color(p.leafLight) },
          uSunDir: { value: FOREST_SUN_DIR.clone() },
        },
        vertexShader: vert,
        fragmentShader: FOREST_CANOPY_FRAG,
        side: DoubleSide,
        extensions: { derivatives: true },
      }),
  );
}

export function createForestShadowMaterial(instanced: boolean): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: instanced ? FOREST_SHADOW_VERT_INSTANCED : FOREST_SHADOW_VERT,
    fragmentShader: FOREST_SHADOW_FRAG,
    transparent: true,
    depthWrite: false,
  });
}

/** Deterministic [0,1) from string — stable visuals per enemy id */
export function forestHash01(id: string, salt: number): number {
  let h = salt >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface ForestSingleTreeLayout {
  trunkH: number;
  trunkR: number;
  canopyR: number;
  rotAngle: number;
}

/** Same parameter ranges as InstancedForest instance placement (single tree at origin). */
export function getForestSingleTreeLayoutFromId(id: string): ForestSingleTreeLayout {
  const trunkH = 2.5 + forestHash01(id, 1) * 2.5;
  const trunkR = 0.2 + forestHash01(id, 2) * 0.16;
  const canopyR = (0.5 + forestHash01(id, 3) * 0.9) * trunkR * 6.5;
  const rotAngle = forestHash01(id, 4) * Math.PI * 2;
  return { trunkH, trunkR, canopyR, rotAngle };
}
