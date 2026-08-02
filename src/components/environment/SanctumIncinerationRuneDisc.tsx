'use client';

import { memo, useRef } from 'react';
import type { Group } from 'three';
import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import {
  getIncinerationRuneBandTextureForRing,
  INCINERATION_FIRE_CORE,
  INCINERATION_FIRE_DEEP,
  INCINERATION_FIRE_GLOW,
  INCINERATION_RUNE_BAND_BASE_OPACITY,
} from '@/components/weapons/IncinerationChargeAura';
import { CASTLE_ROOM_HALF_SIZE } from '@/utils/mapConstants';

/** Liked proportions from FLOOR_SCALE = 0.4 — thickness/rune size stay fixed. */
const LIKED_FLOOR_SCALE = 0.365;
const BAND_THICKNESS = (24.7 - 20) * LIKED_FLOOR_SCALE;
const RIM_LINE_WIDTH = 0.025 * LIKED_FLOOR_SCALE;
const REF_BAND_MID = ((20 + 24.7) / 2) * LIKED_FLOOR_SCALE;
const REF_GLYPH_COUNT = 30;

/** Outer rim slightly inset from the castle floor edge. */
export const SANCTUM_RUNE_BAND_OUTER = CASTLE_ROOM_HALF_SIZE + 0.5;
export const SANCTUM_RUNE_BAND_INNER = SANCTUM_RUNE_BAND_OUTER - BAND_THICKNESS;
const BAND_OUTER = SANCTUM_RUNE_BAND_OUTER;
const BAND_INNER = SANCTUM_RUNE_BAND_INNER;
const BAND_MID = (BAND_INNER + BAND_OUTER) / 2;
const SANCTUM_GLYPH_COUNT = Math.round(REF_GLYPH_COUNT * (BAND_MID / REF_BAND_MID));
const FLOOR_Y = 0.0175;

/** Scale so the outer band edge meets `outerRadius` (Inner Sanctum / main arena convention). */
export function sanctumRuneDiscScaleForBandOuter(outerRadius: number): number {
  return outerRadius / (CASTLE_ROOM_HALF_SIZE + 0.55);
}

/** Scale so the inner band edge meets `innerRadius` (e.g. grass disc perimeter). */
export function sanctumRuneDiscScaleForBandInner(innerRadius: number): number {
  return innerRadius / SANCTUM_RUNE_BAND_INNER;
}

const RING_SEGMENTS = 64;
const SANCTUM_INNER_RUNE_SPIN = 0.00004;
const SANCTUM_OUTER_RUNE_SPIN = 0.00005;

let sharedResources: {
  runeBandGeo: RingGeometry;
  innerRimGeo: RingGeometry;
  outerRimGeo: RingGeometry;
  outerGlowGeo: RingGeometry;
  innerGlowGeo: RingGeometry;
  runeBandMat: MeshBasicMaterial;
  innerRimMat: MeshStandardMaterial;
  outerRimMat: MeshStandardMaterial;
  outerGlowMat: MeshStandardMaterial;
  innerGlowMat: MeshStandardMaterial;
} | null = null;

function getSharedResources() {
  if (sharedResources) return sharedResources;

  const runeBandTexture = getIncinerationRuneBandTextureForRing({
    inner: BAND_INNER,
    outer: BAND_OUTER,
    glyphCount: SANCTUM_GLYPH_COUNT,
  });

  sharedResources = {
    runeBandGeo: new RingGeometry(BAND_INNER, BAND_OUTER, RING_SEGMENTS),
    innerRimGeo: new RingGeometry(BAND_INNER - RIM_LINE_WIDTH, BAND_INNER, RING_SEGMENTS),
    outerRimGeo: new RingGeometry(BAND_OUTER, BAND_OUTER + RIM_LINE_WIDTH, RING_SEGMENTS),
    outerGlowGeo: new RingGeometry(1.2, 1.8, 48),
    innerGlowGeo: new RingGeometry(1.36, 1.68, 32),
    runeBandMat: new MeshBasicMaterial({
      map: runeBandTexture,
      transparent: true,
      opacity: INCINERATION_RUNE_BAND_BASE_OPACITY,
      depthWrite: false,
    }),
    innerRimMat: new MeshStandardMaterial({
      color: INCINERATION_FIRE_CORE,
      emissive: INCINERATION_FIRE_GLOW,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
    outerRimMat: new MeshStandardMaterial({
      color: INCINERATION_FIRE_DEEP,
      emissive: INCINERATION_FIRE_CORE,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
    outerGlowMat: new MeshStandardMaterial({
      color: INCINERATION_FIRE_DEEP,
      emissive: INCINERATION_FIRE_CORE,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    innerGlowMat: new MeshStandardMaterial({
      color: INCINERATION_FIRE_CORE,
      emissive: INCINERATION_FIRE_GLOW,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  };

  return sharedResources;
}

/**
 * Large floor-mounted incineration rune disc for the Inner Sanctum.
 * Uses a sanctum-specific rune texture (more glyphs, same band thickness);
 * keeps module-level geometries/materials so remounts don't allocate or leak.
 */
interface SanctumIncinerationRuneDiscProps {
  /** Uniform scale — default matches Inner Sanctum sizing. */
  scale?: number;
  /** Multiplier on default inner rune rotation speed. */
  innerSpinScale?: number;
  /** Multiplier on default outer rune rotation speed. */
  outerSpinScale?: number;
  /** World offset — default sits flush on the sanctum floor. */
  position?: [number, number, number];
}

function SanctumIncinerationRuneDisc({
  scale = 1,
  innerSpinScale = 1,
  outerSpinScale = 1,
  position = [0, FLOOR_Y, 0],
}: SanctumIncinerationRuneDiscProps = {}) {
  const innerRunesRef = useRef<Group>(null);
  const outerRunesRef = useRef<Group>(null);
  const resources = getSharedResources();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1000;

    if (innerRunesRef.current) {
      innerRunesRef.current.rotation.y = t * SANCTUM_INNER_RUNE_SPIN * innerSpinScale;
    }
    if (outerRunesRef.current) {
      outerRunesRef.current.rotation.y = t * SANCTUM_OUTER_RUNE_SPIN * outerSpinScale;
    }
    resources.outerGlowMat.emissiveIntensity = 2.2 + Math.sin(t * 0.004) * 0.5;
    resources.innerGlowMat.emissiveIntensity = 2.8 + Math.cos(t * 0.005) * 0.4;
  });

  return (
    <group name="sanctum-incineration-rune-disc" position={position} scale={scale}>
      <group ref={innerRunesRef} position={[0, 0.002, 0]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={resources.runeBandGeo}
          material={resources.runeBandMat}
          frustumCulled={false}
          dispose={null}
        />
      </group>


     
    </group>
  );
}

export default memo(SanctumIncinerationRuneDisc);
