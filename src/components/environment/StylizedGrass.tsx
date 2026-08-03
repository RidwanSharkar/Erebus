import React, { useRef, useMemo, useCallback, useLayoutEffect, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
  CircleGeometry,
  CylinderGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { MAIN_MAP_HALF_X, MAIN_MAP_HALF_Z, MAIN_MAP_RADIUS, isInsideHexArenaXZ } from '@/utils/mapConstants';
import type { RoomBorderTheme } from './SimpleBorderEffects';

type TerrainPalette = {
  baseColor: string;
  tipColor: string;
  groundColor: string;
  groundLightColor: string;
  groundLightIntensity: number;
};

/** Post–Boss 1 blue act — deep indigo blades with luminous cyan tips. */
const ETHEREAL_BLUE_COLORS: TerrainPalette = {
  baseColor: '#1e3a6e',
  tipColor: '#6ec4ff',
  groundColor: '#152848',
  groundLightColor: '#3a7dff',
  groundLightIntensity: 0.26,
};

const ARID_COLORS: TerrainPalette = {
  baseColor: '#4a3020',
  tipColor: '#c4783a',
  groundColor: '#2e2118',
  groundLightColor: '#8a4a2a',
  groundLightIntensity: 0.28,
};

const PURPLE_FIELD_COLORS: TerrainPalette = {
  baseColor: '#2a1f2e',
  tipColor: '#4a3a55',
  groundColor: '#3a3d48',
  groundLightColor: '#4a3d58',
  groundLightIntensity: 0.22,
};

/** Hex stat/trial arenas — deep ocean blue blades. */
const OCEAN_FIELD_COLORS: TerrainPalette = {
  baseColor: '#0a1f33',
  tipColor: '#1e4d6b',
  groundColor: '#061018',
  groundLightColor: '#0d3a5c',
  groundLightIntensity: 0.28,
};

/** Hex stat/trial arenas — ash/stone grey blades. */
const GREY_FIELD_COLORS: TerrainPalette = {
  baseColor: '#3a3a3a',
  tipColor: '#6b6b6b',
  groundColor: '#2a2a2a',
  groundLightColor: '#505050',
  groundLightIntensity: 0.24,
};

/** Hex fallback / legacy crimson — distinct from arid `roomTheme="red"`. */
const DEEP_CRIMSON_COLORS: TerrainPalette = {
  baseColor: '#2a0808',
  tipColor: '#991b1b',
  groundColor: '#120508',
  groundLightColor: '#5c1010',
  groundLightIntensity: 0.32,
};

/** Delirium Gate — warm yellow-red grass on the main disc arena. */
const DELIRIUM_COLORS: TerrainPalette = {
  baseColor: '#3a2a08',
  tipColor: '#d4a017',
  groundColor: '#2e0f08',
  groundLightColor: '#7c2d12',
  groundLightIntensity: 0.42,
};

/** Dream Layer secret shop — lighter ethereal blue than Act 2 grass. */
const DREAM_LAYER_COLORS: TerrainPalette = {
  baseColor: '#2f5bb0',
  tipColor: '#9ad8ff',
  groundColor: '#20406e',
  groundLightColor: '#5b9dff',
  groundLightIntensity: 0.3,
};

/** Crypt of Currency (trial) — teal-green, greener than dream layer. */
const TEAL_FIELD_COLORS: TerrainPalette = {
  baseColor: '#1e5a52',
  tipColor: '#5ec4a0',
  groundColor: '#0e2e2a',
  groundLightColor: '#3a9a7a',
  groundLightIntensity: 0.32,
};

/** Avernus (merchant) — warm ember orange blades. */
const ORANGE_FIELD_COLORS: TerrainPalette = {
  baseColor: '#4a2808',
  tipColor: '#f97316',
  groundColor: '#1e1006',
  groundLightColor: '#c45a18',
  groundLightIntensity: 0.34,
};

/** Prep throne legacy bright green (former hard-coded base/tip overrides). */
const THRONE_ORIGINAL_COLORS: TerrainPalette = {
  baseColor: '#1a6b1a',
  tipColor: '#66dd66',
  groundColor: '#1a3e14',
  groundLightColor: '#4a9a3a',
  groundLightIntensity: 0.42,
};

const HONEY_GOLD_COLORS: TerrainPalette = {
  baseColor: '#5c3d10',
  tipColor: '#f0c14a',
  groundColor: '#2e1e08',
  groundLightColor: '#b8860b',
  groundLightIntensity: 0.36,
};

const APRICOT_DAWN_COLORS: TerrainPalette = {
  baseColor: '#6b3a1e',
  tipColor: '#ffb07a',
  groundColor: '#3a1e10',
  groundLightColor: '#d4784a',
  groundLightIntensity: 0.34,
};

const DUSTY_ROSE_COLORS: TerrainPalette = {
  baseColor: '#5a2a3a',
  tipColor: '#e8a0b0',
  groundColor: '#2e1520',
  groundLightColor: '#c06078',
  groundLightIntensity: 0.32,
};

const ARCTIC_MINT_COLORS: TerrainPalette = {
  baseColor: '#1a4a48',
  tipColor: '#7dffd4',
  groundColor: '#0e2e2c',
  groundLightColor: '#3ab89a',
  groundLightIntensity: 0.34,
};

const MAGENTA_BLOOM_COLORS: TerrainPalette = {
  baseColor: '#4a1040',
  tipColor: '#ff66cc',
  groundColor: '#280820',
  groundLightColor: '#c040a0',
  groundLightIntensity: 0.34,
};

const LIME_AURORA_COLORS: TerrainPalette = {
  baseColor: '#2a4a08',
  tipColor: '#b8f040',
  groundColor: '#1a2e06',
  groundLightColor: '#6aaa20',
  groundLightIntensity: 0.38,
};

const CHERRY_SUNSET_COLORS: TerrainPalette = {
  baseColor: '#5a1020',
  tipColor: '#ff6b6b',
  groundColor: '#2e0810',
  groundLightColor: '#c04040',
  groundLightIntensity: 0.34,
};

const SAPPHIRE_NOON_COLORS: TerrainPalette = {
  baseColor: '#0e2a5a',
  tipColor: '#4a9eff',
  groundColor: '#081830',
  groundLightColor: '#2a6acc',
  groundLightIntensity: 0.32,
};

const CORAL_REEF_COLORS: TerrainPalette = {
  baseColor: '#5a2a28',
  tipColor: '#ff8a70',
  groundColor: '#2e1414',
  groundLightColor: '#d06050',
  groundLightIntensity: 0.34,
};

const LAVENDER_MEADOW_COLORS: TerrainPalette = {
  baseColor: '#3a2a5a',
  tipColor: '#c4a0ff',
  groundColor: '#1e1830',
  groundLightColor: '#8060c0',
  groundLightIntensity: 0.32,
};

const SUNFLOWER_COLORS: TerrainPalette = {
  baseColor: '#4a3a08',
  tipColor: '#ffe066',
  groundColor: '#2a2006',
  groundLightColor: '#c0a020',
  groundLightIntensity: 0.38,
};

const ROSE_QUARTZ_COLORS: TerrainPalette = {
  baseColor: '#5a3040',
  tipColor: '#ffb6c8',
  groundColor: '#2e1820',
  groundLightColor: '#d08098',
  groundLightIntensity: 0.32,
};

const JADE_GROVE_COLORS: TerrainPalette = {
  baseColor: '#0e3a2e',
  tipColor: '#4ade80',
  groundColor: '#082018',
  groundLightColor: '#2a9a60',
  groundLightIntensity: 0.36,
};

const SUNSET_AMBER_COLORS: TerrainPalette = {
  baseColor: '#5a2808',
  tipColor: '#ffb347',
  groundColor: '#2e1404',
  groundLightColor: '#d07820',
  groundLightIntensity: 0.36,
};

const SPRING_BLOSSOM_COLORS: TerrainPalette = {
  baseColor: '#3a4a2a',
  tipColor: '#f0a0c8',
  groundColor: '#1e2818',
  groundLightColor: '#90c070',
  groundLightIntensity: 0.34,
};

const AZURE_FIELD_COLORS: TerrainPalette = {
  baseColor: '#1a3a5a',
  tipColor: '#60d0ff',
  groundColor: '#0e2030',
  groundLightColor: '#3a90c0',
  groundLightIntensity: 0.32,
};

const THEME_COUNTS: Record<RoomBorderTheme, number> = {
  green: 16_000,
  red: 16_000,
  blue: 16_000,
  purple: 16_000,
};

const THEME_WIND: Partial<Record<RoomBorderTheme, number>> = {
  red: 0.2,
  blue: 0.22,
  purple: 0.2,
};

function resolveRoomTheme(
  roomTheme: RoomBorderTheme | undefined,
  isSnowTheme: boolean | undefined,
): RoomBorderTheme {
  if (roomTheme) return roomTheme;
  if (isSnowTheme) return 'blue';
  return 'green';
}

/** Named grass palettes (includes theme defaults + random throne pool keys). Purple/grey excluded from random pool. */
export type GrassPaletteKey =
  | 'theme'
  | 'throne'
  | 'eden'
  | 'crimson'
  | 'delirium'
  | 'dream'
  | 'purple'
  | 'grey'
  | 'ocean'
  | 'teal'
  | 'orange'
  | 'arid'
  | 'etherealBlue'
  | 'honeyGold'
  | 'apricotDawn'
  | 'dustyRose'
  | 'arcticMint'
  | 'magentaBloom'
  | 'limeAurora'
  | 'cherrySunset'
  | 'sapphireNoon'
  | 'coralReef'
  | 'lavenderMeadow'
  | 'sunflower'
  | 'roseQuartz'
  | 'jadeGrove'
  | 'sunsetAmber'
  | 'springBlossom'
  | 'azureField';

/**
 * Server-authoritative random grass pool for prep ThroneRoom.
 * Keep count in sync with `COOP_RANDOM_GRASS_PRESET_COUNT` in backend/coopGrassPresets.js.
 * Excludes purple/grey (boss / ash-black look).
 */
export const RANDOM_GRASS_PRESETS: readonly GrassPaletteKey[] = [
  'throne',
  'eden',
  'dream',
  'teal',
  'orange',
  'crimson',
  'delirium',
  'ocean',
  'arid',
  'etherealBlue',
  'honeyGold',
  'apricotDawn',
  'dustyRose',
  'arcticMint',
  'magentaBloom',
  'limeAurora',
  'cherrySunset',
  'sapphireNoon',
  'coralReef',
  'lavenderMeadow',
  'sunflower',
  'roseQuartz',
  'jadeGrove',
  'sunsetAmber',
  'springBlossom',
  'azureField',
] as const;

export const RANDOM_GRASS_PRESET_COUNT = RANDOM_GRASS_PRESETS.length;

export function resolveGrassPresetByIndex(index: number | undefined | null): GrassPaletteKey {
  const n = RANDOM_GRASS_PRESET_COUNT;
  if (n <= 0) return 'throne';
  const i = Number.isFinite(index as number) ? Math.floor(index as number) : 0;
  const wrapped = ((i % n) + n) % n;
  return RANDOM_GRASS_PRESETS[wrapped] ?? 'throne';
}

interface StylizedGrassProps {
  /** `disc` = throne / circular fields; `hex` = main arena; `square` = legacy rectangle. */
  fieldShape?: 'disc' | 'square' | 'hex';
  count?: number;
  radius?: number;
  halfX?: number;
  halfZ?: number;
  bladeHeight?: number;
  windStrength?: number;
  /** Coop room archetype — drives default palette, density (purple), and wind. */
  roomTheme?: RoomBorderTheme;
  /** Override palette; fixed palettes instead of theme defaults. */
  grassPalette?: GrassPaletteKey;
  /** Legacy: when true, same as `roomTheme="blue"`. Ignored if `roomTheme` is set. */
  isSnowTheme?: boolean;
  baseColor?: string;
  tipColor?: string;
  groundColor?: string;
  groundLightColor?: string;
  groundLightIntensity?: number;
  /** When set on disc fields, blades are omitted inside this XZ radius (e.g. throne center seal). */
  excludeInnerRadius?: number;
}

const GRASS_VERTEX = `
  attribute float aHeightRatio;

  uniform float uTime;
  uniform float uWindStrength;

  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float hr = aHeightRatio;
    float bend = hr * hr;

    // Primary rolling wind wave — sweeps across the field
    float phase = wp.x * 0.35 + wp.z * 0.25;
    float w1 = sin(phase + uTime * 1.3) * uWindStrength;

    // Secondary gust layer — offset frequency for organic feel
    float w2 = sin(phase * 2.1 + uTime * 2.1 + 1.7) * uWindStrength * 0.3;

    // Micro flutter — high-frequency per-blade shimmer
    float w3 = cos(wp.x * 3.5 + wp.z * 2.0 + uTime * 4.5) * uWindStrength * 0.06;

    float wind = (w1 + w2 + w3) * bend;

    wp.x += wind;
    wp.z += wind * 0.4;
    // Slight vertical compression when bending for realism
    wp.y -= abs(wind) * 0.1;

    vHeightRatio = hr;
    vWorldPos = wp.xyz;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SNOW_BRIGHTNESS_SCALE = 0.82;

const GRASS_FRAGMENT = `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uGroundLightColor;
  uniform float uGroundLightIntensity;
  uniform float uGrassFadeInner;
  uniform float uGrassFadeOuter;
  uniform float uGrassHalfX;
  uniform float uGrassHalfZ;
  uniform float uUseSquareEdgeFade;
  uniform float uBrightnessScale;

  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    // Gradient from dark base to bright tip
    vec3 col = mix(uBaseColor, uTipColor, vHeightRatio);

    // Low-frequency spatial color variation (meadow patches)
    float n1 = sin(vWorldPos.x * 1.7) * cos(vWorldPos.z * 2.1) * 0.10;
    // High-frequency variation for blade-level uniqueness
    float n2 = sin(vWorldPos.x * 5.3 + 2.0) * cos(vWorldPos.z * 4.7 + 1.0) * 0.04;
    col += n1 + n2;

    // Ground bounce light — warms and brightens the lower half of every blade
    float bounceFalloff = 1.0 - smoothstep(0.0, 0.7, vHeightRatio);
    col += uGroundLightColor * uGroundLightIntensity * bounceFalloff;

    // Tips catch overhead light (raised from 0.55 → 0.65 for overall brightness)
    col *= 0.65 + vHeightRatio * 0.35;

    // Ambient occlusion at the base (raised floor 0.4 → 0.55 so base isn't so dark)
    col *= 0.55 + smoothstep(0.0, 0.25, vHeightRatio) * 0.45;

    // Fade at the edge: radial (disc) or normalized rectangle edge (main arena)
    float dist = uUseSquareEdgeFade > 0.5
      ? max(abs(vWorldPos.x) / uGrassHalfX, abs(vWorldPos.z) / uGrassHalfZ)
      : length(vWorldPos.xz);
    col *= 1.0 - smoothstep(uGrassFadeInner, uGrassFadeOuter, dist) * 0.5;

    col *= uBrightnessScale;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const GRASS_COLORS: TerrainPalette = {
  baseColor: '#1a4d1a',
  tipColor: '#4caf50',
  groundColor: '#1a2e12',
  groundLightColor: '#3a7a2a',
  groundLightIntensity: 0.45,
};

export function grassPaletteForKey(key: GrassPaletteKey): TerrainPalette {
  switch (key) {
    case 'throne':
      return THRONE_ORIGINAL_COLORS;
    case 'eden':
    case 'theme':
      return GRASS_COLORS;
    case 'crimson':
      return DEEP_CRIMSON_COLORS;
    case 'delirium':
      return DELIRIUM_COLORS;
    case 'dream':
      return DREAM_LAYER_COLORS;
    case 'purple':
      return PURPLE_FIELD_COLORS;
    case 'grey':
      return GREY_FIELD_COLORS;
    case 'ocean':
      return OCEAN_FIELD_COLORS;
    case 'teal':
      return TEAL_FIELD_COLORS;
    case 'orange':
      return ORANGE_FIELD_COLORS;
    case 'arid':
      return ARID_COLORS;
    case 'etherealBlue':
      return ETHEREAL_BLUE_COLORS;
    case 'honeyGold':
      return HONEY_GOLD_COLORS;
    case 'apricotDawn':
      return APRICOT_DAWN_COLORS;
    case 'dustyRose':
      return DUSTY_ROSE_COLORS;
    case 'arcticMint':
      return ARCTIC_MINT_COLORS;
    case 'magentaBloom':
      return MAGENTA_BLOOM_COLORS;
    case 'limeAurora':
      return LIME_AURORA_COLORS;
    case 'cherrySunset':
      return CHERRY_SUNSET_COLORS;
    case 'sapphireNoon':
      return SAPPHIRE_NOON_COLORS;
    case 'coralReef':
      return CORAL_REEF_COLORS;
    case 'lavenderMeadow':
      return LAVENDER_MEADOW_COLORS;
    case 'sunflower':
      return SUNFLOWER_COLORS;
    case 'roseQuartz':
      return ROSE_QUARTZ_COLORS;
    case 'jadeGrove':
      return JADE_GROVE_COLORS;
    case 'sunsetAmber':
      return SUNSET_AMBER_COLORS;
    case 'springBlossom':
      return SPRING_BLOSSOM_COLORS;
    case 'azureField':
      return AZURE_FIELD_COLORS;
    default:
      return GRASS_COLORS;
  }
}

function paletteForTheme(theme: RoomBorderTheme): TerrainPalette {
  switch (theme) {
    case 'red':
      return ARID_COLORS;
    case 'blue':
      return ETHEREAL_BLUE_COLORS;
    case 'purple':
      return PURPLE_FIELD_COLORS;
    default:
      return GRASS_COLORS;
  }
}

const StylizedGrass: React.FC<StylizedGrassProps> = ({
  fieldShape = 'disc',
  count: countOverride,
  radius = MAIN_MAP_RADIUS,
  halfX = MAIN_MAP_HALF_X,
  halfZ = MAIN_MAP_HALF_Z,
  bladeHeight = 0.50,
  windStrength: windOverride,
  roomTheme,
  grassPalette = 'theme',
  isSnowTheme,
  baseColor,
  tipColor,
  groundColor,
  groundLightColor,
  groundLightIntensity,
  excludeInnerRadius = 0,
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const [matricesReady, setMatricesReady] = useState(false);

  const effectiveTheme = resolveRoomTheme(roomTheme, isSnowTheme);
  const defaultCount = THEME_COUNTS[effectiveTheme];
  const count = countOverride ?? defaultCount;
  const palette =
    grassPalette === 'theme'
      ? paletteForTheme(effectiveTheme)
      : grassPaletteForKey(grassPalette);

  const resolvedBaseColor        = baseColor        ?? palette.baseColor;
  const resolvedTipColor         = tipColor         ?? palette.tipColor;
  const resolvedGroundColor      = groundColor      ?? palette.groundColor;
  const resolvedGroundLightColor = groundLightColor ?? palette.groundLightColor;
  const resolvedGroundLightIntensity =
    groundLightIntensity ?? palette.groundLightIntensity;
  const windStrength = windOverride ?? THEME_WIND[effectiveTheme] ?? 0.25;

  const useSquareEdge = fieldShape === 'square';
  const useHexField = fieldShape === 'hex';
  const grassFadeInner = useSquareEdge ? 0.93 : radius - 0.8;
  const grassFadeOuter = useSquareEdge ? 1.08 : radius + 3.5;

  const bladeGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    const w = 0.07;

    // Tapered blade: wide base → narrow tip, 3 height segments for smooth bending
    const positions = new Float32Array([
      -w * 0.50, 0,    0,
       w * 0.50, 0,    0,
      -w * 0.35, 0.33, 0,
       w * 0.35, 0.33, 0,
      -w * 0.15, 0.66, 0,
       w * 0.15, 0.66, 0,
       0,        1.0,  0,
    ]);

    // 5 triangles (2 quads + 1 top tri)
    geo.setIndex([0,1,3, 0,3,2, 2,3,5, 2,5,4, 4,5,6]);

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute(
      'aHeightRatio',
      new Float32BufferAttribute(new Float32Array([0, 0, 0.33, 0.33, 0.66, 0.66, 1.0]), 1)
    );

    return geo;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: new Color() },
          uTipColor: { value: new Color() },
          uWindStrength: { value: 0.25 },
          uGroundLightColor: { value: new Color() },
          uGroundLightIntensity: { value: 0.45 },
          uGrassFadeInner: { value: 0 },
          uGrassFadeOuter: { value: 0 },
          uGrassHalfX: { value: halfX },
          uGrassHalfZ: { value: halfZ },
          uUseSquareEdgeFade: { value: 0.0 },
          uBrightnessScale: { value: 1.0 },
        },
        vertexShader: GRASS_VERTEX,
        fragmentShader: GRASS_FRAGMENT,
        side: DoubleSide,
      }),
    [],
  );

  useLayoutEffect(() => {
    material.uniforms.uBaseColor.value.set(resolvedBaseColor);
    material.uniforms.uTipColor.value.set(resolvedTipColor);
    material.uniforms.uWindStrength.value = windStrength;
    material.uniforms.uGroundLightColor.value.set(resolvedGroundLightColor);
    material.uniforms.uGroundLightIntensity.value = resolvedGroundLightIntensity;
    material.uniforms.uGrassFadeInner.value = grassFadeInner;
    material.uniforms.uGrassFadeOuter.value = grassFadeOuter;
    material.uniforms.uGrassHalfX.value = halfX;
    material.uniforms.uGrassHalfZ.value = halfZ;
    material.uniforms.uUseSquareEdgeFade.value = useSquareEdge ? 1.0 : 0.0;
    material.uniforms.uBrightnessScale.value =
      effectiveTheme === 'blue' ? SNOW_BRIGHTNESS_SCALE : 1.0;
  }, [
    material,
    resolvedBaseColor,
    resolvedTipColor,
    windStrength,
    resolvedGroundLightColor,
    resolvedGroundLightIntensity,
    grassFadeInner,
    grassFadeOuter,
    halfX,
    halfZ,
    useSquareEdge,
    effectiveTheme,
  ]);

  const groundGeo = useMemo(
    () =>
      useHexField
        ? new CylinderGeometry(radius, radius, 0.02, 6)
        : useSquareEdge
        ? new PlaneGeometry(halfX * 2, halfZ * 2)
        : new CircleGeometry(radius, 48),
    [halfX, halfZ, radius, useHexField, useSquareEdge],
  );
  const groundMat = useMemo(() => new MeshBasicMaterial({ color: '#000000' }), []);

  useLayoutEffect(() => {
    groundMat.color.set(resolvedGroundColor);
  }, [groundMat, resolvedGroundColor]);

  // After InstancedMesh commits (or recreates on count change), fill matrices. useLayoutEffect
  // + rAF fallback avoids an empty instanced draw when the ref is not set in the same tick.
  const fillInstanceMatrices = useCallback((): boolean => {
    const mesh = meshRef.current;
    if (!mesh) return false;

    const mat = new Matrix4();
    const lean = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < count; i++) {
      let x: number;
      let z: number;
      if (useSquareEdge) {
        x = (Math.random() * 2 - 1) * halfX;
        z = (Math.random() * 2 - 1) * halfZ;
      } else if (useHexField) {
        do {
          x = (Math.random() * 2 - 1) * radius;
          z = (Math.random() * 2 - 1) * radius;
        } while (!isInsideHexArenaXZ(x, z, radius, 0.2));
      } else {
        const angle = Math.random() * Math.PI * 2;
        const inner = Math.max(0, excludeInnerRadius);
        const span = Math.max(0.001, radius - inner);
        const r = inner + Math.sqrt(Math.random()) * span;
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
      }

      const clump =
        Math.sin(x * 0.3 + 0.7) * Math.cos(z * 0.5 + 1.2) * 0.4 + 0.6;

      mat.makeRotationY(Math.random() * Math.PI);
      lean.makeRotationX((Math.random() - 0.5) * 0.3);
      mat.multiply(lean);

      scl.set(
        0.8 + Math.random() * 0.5,
        bladeHeight * (0.3 + Math.random() * 1.4) * clump,
        0.8 + Math.random() * 0.5,
      );
      mat.scale(scl);

      pos.set(x, 0, z);
      mat.setPosition(pos);

      mesh.setMatrixAt(i, mat);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) {
      mesh.boundingSphere.center.set(0, 0, 0);
      mesh.boundingSphere.radius = radius;
    }
    setMatricesReady(true);
    return true;
  }, [count, radius, halfX, halfZ, bladeHeight, useHexField, useSquareEdge, excludeInnerRadius]);

  useLayoutEffect(() => {
    setMatricesReady(false);
    if (fillInstanceMatrices()) return;
    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    const maxRafAttempts = 90;
    const tick = () => {
      if (cancelled) return;
      if (fillInstanceMatrices()) return;
      if (++attempts >= maxRafAttempts) {
        // eslint-disable-next-line no-console
        console.warn('[StylizedGrass] instance matrices not ready after max rAF retries');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [fillInstanceMatrices]);

  useEffect(
    () => () => {
      bladeGeometry.dispose();
    },
    [bladeGeometry],
  );
  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );
  useEffect(
    () => () => {
      groundGeo.dispose();
      groundMat.dispose();
    },
    [groundGeo, groundMat],
  );

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  return (
    <group>
      {/* Dark soil disc sits just above the existing ground */}
      <mesh
        geometry={groundGeo}
        material={groundMat}
        rotation-x={useHexField ? 0 : -Math.PI / 2}
        position-y={0.01}
      />

      <instancedMesh
        ref={meshRef}
        args={[bladeGeometry, material, count]}
        frustumCulled
        visible={matricesReady}
      />
    </group>
  );
};

export default React.memo(StylizedGrass);
