'use client';

import React, { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { Color } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import ArenaRisingBubbles from './ArenaRisingBubbles';
import ThroneOuterFloor from './ThroneOuterFloor';
import { PENTAGON_ARENA_RADIUS } from '@/utils/mapConstants';

const EDGE_INSET = PENTAGON_ARENA_RADIUS + 0.25;
const TORCH_Y = 0.8;
const TORCH_GLOW = '#a8e8ff';
/** Shared unlit glow color — avoid allocating Color in JSX. */
const TORCH_ORB_COLOR = new Color(TORCH_GLOW);

/** Combat-safe bubble budget (was 220 @ radius+10). */
const SUNKEN_BUBBLE_COUNT = 80;
const SUNKEN_BUBBLE_RADIUS = PENTAGON_ARENA_RADIUS + 2;

const PENTAGON_EDGE_TORCH_POSITIONS: [number, number, number][] = [
  [EDGE_INSET * 0.78, TORCH_Y, 0],
  [-EDGE_INSET * 0.78, TORCH_Y, 0],
  [EDGE_INSET * 0.24, TORCH_Y, EDGE_INSET * 0.72],
  [-EDGE_INSET * 0.24, TORCH_Y, EDGE_INSET * 0.72],
  [0, TORCH_Y, -EDGE_INSET * 0.85],
];

/** Emissive-only orb — no realtime pointLight (scene ambient + directional light the room). */
function SunkenEdgeOrb({
  position,
  phaseOffset,
  animate,
}: {
  position: [number, number, number];
  phaseOffset: number;
  animate: boolean;
}) {
  const orbRef = useRef<Mesh>(null);
  const orbMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: TORCH_ORB_COLOR,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!animate || !orbRef.current) return;
    const t = clock.elapsedTime + phaseOffset;
    const flicker = 0.85 + Math.sin(t * 1.8) * 0.08 + Math.sin(t * 4.2 + 0.7) * 0.06;
    orbMat.opacity = 0.7 + flicker * 0.2;
    orbRef.current.scale.setScalar(1.0 + flicker * 0.12);
  });

  return (
    <group position={position}>
      <mesh ref={orbRef} position={[0, 0.08, 0]} material={orbMat}>
        <sphereGeometry args={[0.14, 8, 8]} />
      </mesh>
    </group>
  );
}

const SunkenTempleRoom: React.FC<{ combatActive?: boolean }> = ({
  combatActive = false,
}) => {
  const radius = PENTAGON_ARENA_RADIUS;

  return (
    <group name="sunken-temple-room">
      <CustomSky skyPreset="sunkenTemple" animateClouds={false} />

      <ThroneOuterFloor
        radius={radius}
        texturePath="/center_glacial.png"
        position={[0, 0.01, 0]}
        rotateSpeed={0.04}
      />

      {!combatActive && (
        <ArenaRisingBubbles
          count={SUNKEN_BUBBLE_COUNT}
          radius={SUNKEN_BUBBLE_RADIUS}
        />
      )}

      {PENTAGON_EDGE_TORCH_POSITIONS.map((pos, i) => (
        <SunkenEdgeOrb
          key={`sunken-edge-orb-${i}`}
          position={pos}
          phaseOffset={i * 1.4}
          animate={!combatActive}
        />
      ))}
    </group>
  );
};

export default React.memo(SunkenTempleRoom);
