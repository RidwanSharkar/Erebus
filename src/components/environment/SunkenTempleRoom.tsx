'use client';

import React, { useMemo, useRef } from 'react';
import type { Mesh, PointLight } from 'three';
import { MeshStandardMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { Color } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import ArenaRisingBubbles from './ArenaRisingBubbles';
import ThroneCenterSeal from './ThroneCenterSeal';
import ThroneOuterFloor from './ThroneOuterFloor';
import { PENTAGON_ARENA_RADIUS } from '@/utils/mapConstants';

const EDGE_INSET = PENTAGON_ARENA_RADIUS + 0.25;
const TORCH_Y = 0.8;
const TORCH_COLOR = '#88ddff';
const TORCH_GLOW = '#a8e8ff';
const TORCH_BASE_INTENSITY = 4.5;
const TORCH_DISTANCE = 10;

const PENTAGON_EDGE_TORCH_POSITIONS: [number, number, number][] = [
  [EDGE_INSET * 0.78, TORCH_Y, 0],
  [-EDGE_INSET * 0.78, TORCH_Y, 0],
  [EDGE_INSET * 0.24, TORCH_Y, EDGE_INSET * 0.72],
  [-EDGE_INSET * 0.24, TORCH_Y, EDGE_INSET * 0.72],
  [0, TORCH_Y, -EDGE_INSET * 0.85],
];

function SunkenEdgeLight({
  position,
  phaseOffset,
}: {
  position: [number, number, number];
  phaseOffset: number;
}) {
  const lightRef = useRef<PointLight>(null);
  const orbRef = useRef<Mesh>(null);
  const orbMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: TORCH_GLOW,
        emissive: TORCH_COLOR,
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phaseOffset;
    const flicker = 0.85 + Math.sin(t * 1.8) * 0.08 + Math.sin(t * 4.2 + 0.7) * 0.06;
    if (lightRef.current) {
      lightRef.current.intensity = TORCH_BASE_INTENSITY * flicker;
    }
    if (orbRef.current) {
      orbMat.emissiveIntensity = 1.6 + flicker * 0.8;
      orbRef.current.scale.setScalar(1.0 + flicker * 0.12);
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={new Color(TORCH_COLOR)}
        intensity={TORCH_BASE_INTENSITY}
        distance={TORCH_DISTANCE}
        decay={1.8}
        castShadow={false}
      />
      <mesh ref={orbRef} position={[0, 0.08, 0]} material={orbMat}>
        <sphereGeometry args={[0.14, 8, 8]} />
      </mesh>
    </group>
  );
}

const SunkenTempleRoom: React.FC<{ combatActive?: boolean }> = () => {
  const radius = PENTAGON_ARENA_RADIUS;

  return (
    <group name="sunken-temple-room">
      <CustomSky skyPreset="sunkenTemple" animateClouds={false} />

      <ThroneOuterFloor
        radius={radius}
        texturePath="/center_glacial.png"
        position={[0, 0.01, 0]}
      />


      <ArenaRisingBubbles radius={radius +10} />

      {PENTAGON_EDGE_TORCH_POSITIONS.map((pos, i) => (
        <SunkenEdgeLight key={`sunken-edge-light-${i}`} position={pos} phaseOffset={i * 1.4} />
      ))}
    </group>
  );
};

export default React.memo(SunkenTempleRoom);
