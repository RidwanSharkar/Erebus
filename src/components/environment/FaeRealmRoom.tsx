'use client';

import React, { useMemo } from 'react';
import { AdditiveBlending, Color } from '@/utils/three-exports';
import { FAE_REALM_HEX_RADIUS, MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';
import CustomSky from './CustomSky';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';
import InstancedMushrooms from './InstancedMushrooms';
import InstancedEmbers, { buildFaeRealmEmberCampOrigins } from './InstancedEmbers';

const FAE_REALM_GRASS_COUNT = Math.round(
  80_000 * (FAE_REALM_HEX_RADIUS / MAIN_ARENA_HEX_RADIUS) ** 2,
);

/** Accent ring scaled from HexCombatArena's 5.8–6.15 at r=18. */
const RING_INNER = 5.8 * (FAE_REALM_HEX_RADIUS / MAIN_ARENA_HEX_RADIUS);
const RING_OUTER = 6.15 * (FAE_REALM_HEX_RADIUS / MAIN_ARENA_HEX_RADIUS);

const FAE_EMBER_CAMP_TYPES: string[] = ['pink', 'pink', 'pink'];

interface FaeRealmRoomProps {
  combatActive?: boolean;
  hiddenIndices?: ReadonlySet<number>;
}

export default function FaeRealmRoom({
  combatActive = false,
  hiddenIndices,
}: FaeRealmRoomProps) {
  const particleColor = useMemo(() => new Color('#9ad8ff'), []);
  const faeEmberCampOrigins = useMemo(
    () => buildFaeRealmEmberCampOrigins(FAE_REALM_HEX_RADIUS),
    [],
  );

  return (
    <group name="fae-realm-room">
      <CustomSky skyPreset="faeRealm" animateClouds={!combatActive} />
      <hemisphereLight color="#ec4899" groundColor="#1a0a14" intensity={0.42} />
      <StylizedGrass
        fieldShape="hex"
        radius={FAE_REALM_HEX_RADIUS}
        count={FAE_REALM_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={0.2}
        grassPalette="dream"
      />
      <InstancedMushrooms
        hiddenIndices={hiddenIndices}
        hexRadius={FAE_REALM_HEX_RADIUS}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 6]} />
        <meshBasicMaterial
          color="#9ad8ff"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {!combatActive && (
        <AtmosphericParticles
          position={[0, 0, 0]}
          count={45}
          radius={12}
          color={`#${particleColor.getHexString()}`}
          speed={0.14}
          size={0.025}
        />
      )}
    </group>
  );
}
