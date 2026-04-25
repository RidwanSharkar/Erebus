'use client';

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, MeshStandardMaterial } from 'three';

const RISE_MS = 520;
const HOLD_MS = 1600;
const TOTAL_MS = RISE_MS + HOLD_MS;

/** Match telegraph / hazard read (~server `BOSS_TECTONIC_SHARD_RADIUS` 2.75). */
const SPIKE_RADIUS = 0.65;
const CYLINDER_HEIGHT = 2;
const CONE_HEIGHT = 4;
const RADIAL_SEGS = 16;

/**
 * Tectonic shard: cylinder shaft + cone tip, rising from the ground.
 */
export default function BossTectonicSpike({
  worldPosition,
  onComplete,
}: {
  worldPosition: Vector3;
  onComplete: () => void;
}) {
  const root = useRef<Group>(null);
  const riseGroup = useRef<Group>(null);
  const t0 = useRef(performance.now());
  const done = useRef(false);
  const matRef = useRef(
    new MeshStandardMaterial({ color: '#4a3d2a', roughness: 0.9, metalness: 0.1 }),
  );

  useEffect(() => {
    const m = matRef.current;
    return () => m.dispose();
  }, []);

  const totalLen = CYLINDER_HEIGHT + CONE_HEIGHT;
  /** Start mostly underground, rise so full column emerges. */
  const riseDepth = totalLen * 0.92;

  useFrame(() => {
    if (done.current) return;
    const e = performance.now() - t0.current;
    let yOff = 0;
    if (e < RISE_MS) {
      const t = e / RISE_MS;
      yOff = -riseDepth * (1 - t * t);
    } else {
      yOff = 0;
    }
    if (riseGroup.current) {
      riseGroup.current.position.y = yOff;
    }
    if (e >= TOTAL_MS) {
      done.current = true;
      onComplete();
    }
  });

  return (
    <group ref={root} position={[worldPosition.x, 0, worldPosition.z]}>
      <group ref={riseGroup}>
        <mesh
          castShadow
          position={[0, CYLINDER_HEIGHT / 2, 0]}
          material={matRef.current}
        >
          <cylinderGeometry args={[SPIKE_RADIUS, SPIKE_RADIUS, CYLINDER_HEIGHT, RADIAL_SEGS]} />
        </mesh>
        <mesh
          castShadow
          position={[0, CYLINDER_HEIGHT + CONE_HEIGHT / 2, 0]}
          material={matRef.current}
        >
          <coneGeometry args={[SPIKE_RADIUS, CONE_HEIGHT, RADIAL_SEGS]} />
        </mesh>
      </group>
    </group>
  );
}
