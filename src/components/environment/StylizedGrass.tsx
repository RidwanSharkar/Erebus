import React, { useRef, useMemo, useCallback, useLayoutEffect, useEffect } from 'react';
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

const SNOW_COLORS_SOFT: TerrainPalette = {
  baseColor: '#7a96b0',
  tipColor: '#a8bdd0',
  groundColor: '#889aad',
  groundLightColor: '#6a8aa4',
  groundLightIntensity: 0.18,
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

const THEME_COUNTS: Record<RoomBorderTheme, number> = {
  green: 80_000,
  red: 80_000,
  blue: 80_000,
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
  /** Legacy: when true, same as `roomTheme="blue"`. Ignored if `roomTheme` is set. */
  isSnowTheme?: boolean;
  baseColor?: string;
  tipColor?: string;
  groundColor?: string;
  groundLightColor?: string;
  groundLightIntensity?: number;
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

function paletteForTheme(theme: RoomBorderTheme): TerrainPalette {
  switch (theme) {
    case 'red':
      return ARID_COLORS;
    case 'blue':
      return SNOW_COLORS_SOFT;
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
  bladeHeight = 0.45,
  windStrength: windOverride,
  roomTheme,
  isSnowTheme,
  baseColor,
  tipColor,
  groundColor,
  groundLightColor,
  groundLightIntensity,
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  const effectiveTheme = resolveRoomTheme(roomTheme, isSnowTheme);
  const defaultCount = THEME_COUNTS[effectiveTheme];
  const count = countOverride ?? defaultCount;
  const palette = paletteForTheme(effectiveTheme);

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

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(resolvedBaseColor) },
        uTipColor: { value: new Color(resolvedTipColor) },
        uWindStrength: { value: windStrength },
        uGroundLightColor: { value: new Color(resolvedGroundLightColor) },
        uGroundLightIntensity: { value: resolvedGroundLightIntensity },
        uGrassFadeInner: { value: grassFadeInner },
        uGrassFadeOuter: { value: grassFadeOuter },
        uGrassHalfX: { value: halfX },
        uGrassHalfZ: { value: halfZ },
        uUseSquareEdgeFade: { value: useSquareEdge ? 1.0 : 0.0 },
        uBrightnessScale: { value: effectiveTheme === 'blue' ? SNOW_BRIGHTNESS_SCALE : 1.0 },
      },
      vertexShader: GRASS_VERTEX,
      fragmentShader: GRASS_FRAGMENT,
      side: DoubleSide,
    });
  }, [resolvedBaseColor, resolvedTipColor, windStrength, resolvedGroundLightColor, resolvedGroundLightIntensity, grassFadeInner, grassFadeOuter, halfX, halfZ, useSquareEdge, effectiveTheme]);

  const groundGeo = useMemo(
    () =>
      useHexField
        ? new CylinderGeometry(radius, radius, 0.02, 6)
        : useSquareEdge
        ? new PlaneGeometry(halfX * 2, halfZ * 2)
        : new CircleGeometry(radius, 48),
    [halfX, halfZ, radius, useHexField, useSquareEdge],
  );
  const groundMat = useMemo(
    () => new MeshBasicMaterial({ color: resolvedGroundColor }),
    [resolvedGroundColor]
  );

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
        const r = Math.sqrt(Math.random()) * radius;
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
    return true;
  }, [count, radius, halfX, halfZ, bladeHeight, useHexField, useSquareEdge]);

  useLayoutEffect(() => {
    if (fillInstanceMatrices()) return;
    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    const maxRafAttempts = 90;
    const tick = () => {
      if (cancelled) return;
      if (fillInstanceMatrices()) return;
      if (++attempts >= maxRafAttempts) return;
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
        key={`grass-instances-${count}`}
        ref={meshRef}
        args={[bladeGeometry, material, count]}
        frustumCulled={false}
      />
    </group>
  );
};

export default React.memo(StylizedGrass);
