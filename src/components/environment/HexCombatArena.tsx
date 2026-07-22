import React, { useMemo } from 'react';
import { AdditiveBlending, Color } from '@/utils/three-exports';
import { HEX_ARENA_RADIUS, MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';
import CustomSky from './CustomSky';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';
import InstancedMushrooms from './InstancedMushrooms';

const HEX_ARENA_GRASS_COUNT = Math.round(
  80_000 * (HEX_ARENA_RADIUS / MAIN_ARENA_HEX_RADIUS) ** 2,
);

type HexArenaVariant = 'stat' | 'chaos' | 'merchant' | 'eden' | 'dream_layer';

interface HexCombatArenaProps {
  variant: HexArenaVariant;
  /** When true, strips decorative layers during fights. */
  combatActive?: boolean;
  /** Indices to hide (server-destroyed mushrooms). */
  hiddenIndices?: ReadonlySet<number>;
}

export default function HexCombatArena({
  variant,
  combatActive = false,
  hiddenIndices,
}: HexCombatArenaProps) {
  const accent =
    variant === 'eden'
      ? '#86efac'
      : variant === 'dream_layer'
        ? '#ec4899'
      : variant === 'chaos'
        ? '#312e81'
        : variant === 'merchant'
          ? '#ec4899'
          : '#f97316';
  const particleColor = useMemo(
    () => new Color(
      variant === 'eden'
        ? '#86efac'
        : variant === 'dream_layer'
          ? '#9ad8ff'
        : variant === 'chaos'
          ? '#b91c1c'
          : variant === 'merchant'
            ? '#f472b6'
            : '#fb923c',
    ),
    [variant],
  );
  const skyTheme =
    variant === 'eden'
      ? 'green'
      : variant === 'dream_layer'
        ? 'purple'
      : variant === 'chaos'
        ? 'purple'
        : variant === 'merchant'
          ? 'purple'
          : 'red';
  const ringColor =
    variant === 'eden'
      ? '#86efac'
      : variant === 'dream_layer'
        ? '#9ad8ff'
      : variant === 'chaos'
        ? '#7f1d1d'
        : variant === 'merchant'
          ? '#ec4899'
          : '#fb923c';

  return (
    <group name={`${variant}-hex-combat-arena`}>
      <CustomSky roomTheme={skyTheme} animateClouds={!combatActive} />
      {/* Subtle room tint only — shadow + key light come from CoopGameScene */}
      <hemisphereLight
        color={accent}
        groundColor={
          variant === 'eden'
            ? '#1a2e12'
            : variant === 'dream_layer'
              ? '#1a0a14'
            : variant === 'chaos'
              ? '#1e1b2e'
              : variant === 'merchant'
                ? '#1a0a14'
                : '#08040b'
        }
        intensity={
          variant === 'eden'
            ? 0.4
            : variant === 'dream_layer'
              ? 0.42
            : variant === 'chaos'
              ? 0.38
              : variant === 'merchant'
                ? 0.42
                : 0.35
        }
      />
      <StylizedGrass
        fieldShape="hex"
        radius={HEX_ARENA_RADIUS}
        count={HEX_ARENA_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={0.2}
        grassPalette={
          variant === 'eden'
            ? 'theme'
            : variant === 'dream_layer'
              ? 'dream'
              : variant === 'merchant'
                ? 'purple'
                : variant === 'chaos'
                  ? 'grey'
                  : variant === 'stat'
                    ? 'ocean'
                    : 'crimson'
        }
        roomTheme={variant === 'eden' ? 'green' : undefined}
      />
      <InstancedMushrooms hiddenIndices={hiddenIndices} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[5.8, 6.15, 6]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={variant === 'merchant' || variant === 'dream_layer' ? 0.28 : variant === 'eden' ? 0.24 : 0.22}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {!combatActive && (
        <AtmosphericParticles
          position={[0, 0, 0]}
          count={variant === 'chaos' ? 55 : variant === 'merchant' || variant === 'dream_layer' ? 45 : variant === 'eden' ? 40 : 35}
          radius={14}
          color={`#${particleColor.getHexString()}`}
          speed={variant === 'chaos' ? 0.18 : variant === 'merchant' || variant === 'dream_layer' ? 0.14 : variant === 'eden' ? 0.16 : 0.25}
          size={0.025}
        />
      )}
    </group>
  );
}
