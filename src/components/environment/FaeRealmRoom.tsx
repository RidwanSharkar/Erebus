'use client';

import React, { Suspense, useMemo } from 'react';
import { Color } from '@/utils/three-exports';
import { FAE_REALM_HEX_RADIUS, MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';
import InstancedMushrooms from './InstancedMushrooms';
import ThroneCenterSeal from './ThroneCenterSeal';
import FaeRealmDecor from './FaeRealmDecor';
import FaeRealmSkyDome from './FaeRealmSkyDome';
import ArenaFallingSnow from './ArenaFallingSnow';

const FAE_REALM_GRASS_COUNT = Math.round(
  80_000 * (FAE_REALM_HEX_RADIUS / MAIN_ARENA_HEX_RADIUS) ** 2,
);

/** Center seal disc — leaves a clear pad under the accent ring. */
const FAE_REALM_CENTER_SEAL_RADIUS = 6.25;

interface FaeRealmRoomProps {
  combatActive?: boolean;
  hiddenIndices?: ReadonlySet<number>;
}

export default function FaeRealmRoom({
  combatActive = false,
  hiddenIndices,
}: FaeRealmRoomProps) {
  const particleColor = useMemo(() => new Color('#9ad8ff'), []);

  return (
    <group name="fae-realm-room">
      <Suspense fallback={null}>
        <FaeRealmSkyDome combatActive={combatActive} />
      </Suspense>
      <hemisphereLight color="#ec4899" groundColor="#1a0a14" intensity={0.42} />
      <ArenaFallingSnow
        count={240}
        halfX={FAE_REALM_HEX_RADIUS}
        halfZ={FAE_REALM_HEX_RADIUS}
      />
      <StylizedGrass
        fieldShape="hex"
        radius={FAE_REALM_HEX_RADIUS}
        count={FAE_REALM_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={combatActive ? 0 : 0.2}
        grassPalette="dream"
        excludeInnerRadius={FAE_REALM_CENTER_SEAL_RADIUS}
        densityScale={combatActive ? 0.5 : 1}
      />
      <InstancedMushrooms
        hiddenIndices={hiddenIndices}
        hexRadius={FAE_REALM_HEX_RADIUS}
      />
      <FaeRealmDecor />

      <ThroneCenterSeal
        texturePath="/flat_eternity.png"
        position={[0, 0.05, 0]}
        radius={FAE_REALM_CENTER_SEAL_RADIUS}
        rotateSpeed={0.05}
      />

      {!combatActive && (
        <AtmosphericParticles
          position={[0, 0, 0]}
          count={45}
          radius={16.8}
          color={`#${particleColor.getHexString()}`}
          speed={0.14}
          size={0.025}
        />
      )}
    </group>
  );
}
