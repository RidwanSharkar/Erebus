import React, { useMemo } from 'react';
import { AdditiveBlending, Color } from '@/utils/three-exports';
import { MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';
import CustomSky from './CustomSky';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';

export const HEX_ARENA_RADIUS = 22;

const HEX_ARENA_GRASS_COUNT = Math.round(
  80_000 * (HEX_ARENA_RADIUS / MAIN_ARENA_HEX_RADIUS) ** 2,
);

type HexArenaVariant = 'stat' | 'chaos' | 'merchant';

interface HexCombatArenaProps {
  variant: HexArenaVariant;
  /** When true, strips decorative layers during fights. */
  combatActive?: boolean;
}

export default function HexCombatArena({ variant, combatActive = false }: HexCombatArenaProps) {
  const accent =
    variant === 'chaos' ? '#312e81' : variant === 'merchant' ? '#ec4899' : '#f97316';
  const particleColor = useMemo(
    () => new Color(variant === 'chaos' ? '#b91c1c' : variant === 'merchant' ? '#f472b6' : '#fb923c'),
    [variant],
  );
  const skyTheme = variant === 'chaos' ? 'purple' : variant === 'merchant' ? 'purple' : 'red';
  const ringColor = variant === 'chaos' ? '#7f1d1d' : variant === 'merchant' ? '#ec4899' : '#fb923c';

  return (
    <group name={`${variant}-hex-combat-arena`}>
      <CustomSky roomTheme={skyTheme} animateClouds={!combatActive} />
      {/* Subtle room tint only — shadow + key light come from CoopGameScene */}
      <hemisphereLight
        color={accent}
        groundColor={variant === 'chaos' ? '#1e1b2e' : variant === 'merchant' ? '#1a0a14' : '#08040b'}
        intensity={variant === 'chaos' ? 0.38 : variant === 'merchant' ? 0.42 : 0.35}
      />
      <StylizedGrass
        fieldShape="hex"
        radius={HEX_ARENA_RADIUS}
        count={HEX_ARENA_GRASS_COUNT}
        bladeHeight={0.45}
        windStrength={0.2}
        grassPalette="crimson"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[5.8, 6.15, 6]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={variant === 'merchant' ? 0.28 : 0.22}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {!combatActive && (
        <AtmosphericParticles
          position={[0, 0, 0]}
          count={variant === 'chaos' ? 55 : variant === 'merchant' ? 45 : 35}
          radius={14}
          color={`#${particleColor.getHexString()}`}
          speed={variant === 'chaos' ? 0.18 : variant === 'merchant' ? 0.14 : 0.25}
          size={0.025}
        />
      )}
    </group>
  );
}
