'use client';

import React, { useMemo } from 'react';
import { AdditiveBlending, Color } from '@/utils/three-exports';
import {
  ETERNITY_PALACE_CENTER_SEAL_RADIUS,
  ETERNITY_PALACE_HEX_RADIUS,
  HEX_ARENA_RADIUS,
  MAIN_ARENA_HEX_RADIUS,
} from '@/utils/mapConstants';
import CustomSky from './CustomSky';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';
import ThroneCenterSeal from './ThroneCenterSeal';

const ETERNITY_PALACE_GRASS_COUNT = Math.round(
  80_000 * (ETERNITY_PALACE_HEX_RADIUS / MAIN_ARENA_HEX_RADIUS) ** 2,
);

/** Accent ring scaled from HexCombatArena's 5.8–6.15 at r=18. */
const RING_INNER = 5.8 * (ETERNITY_PALACE_HEX_RADIUS / HEX_ARENA_RADIUS);
const RING_OUTER = 6.15 * (ETERNITY_PALACE_HEX_RADIUS / HEX_ARENA_RADIUS);

interface EternityPalaceRoomProps {
  combatActive?: boolean;
  /** Server-authoritative random CustomSky preset index. */
  skyPresetIndex?: number;
}

export default function EternityPalaceRoom({
  combatActive = false,
  skyPresetIndex,
}: EternityPalaceRoomProps) {
  const particleColor = useMemo(() => new Color('#f97316'), []);

  return (
    <group name="eternity-palace-room">
      <CustomSky skyPresetIndex={skyPresetIndex} skyPreset="eternityPalace" animateClouds={!combatActive} />
      <hemisphereLight color="#f97316" groundColor="#2a1810" intensity={0.38} />
      <StylizedGrass
        fieldShape="hex"
        radius={ETERNITY_PALACE_HEX_RADIUS}
        count={ETERNITY_PALACE_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={combatActive ? 0 : 0.18}
        grassPalette="orange"
        excludeInnerRadius={ETERNITY_PALACE_CENTER_SEAL_RADIUS}
        densityScale={combatActive ? 0.5 : 1}
      />
      <ThroneCenterSeal
        texturePath="/eternity.png"
        position={[0, 0.05, 0]}
        radius={ETERNITY_PALACE_CENTER_SEAL_RADIUS}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 6]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {!combatActive && (
        <AtmosphericParticles
          position={[0, 0, 0]}
          count={50}
          radius={14}
          color={`#${particleColor.getHexString()}`}
          speed={0.12}
          size={0.028}
        />
      )}
    </group>
  );
}
