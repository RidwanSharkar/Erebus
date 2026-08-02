'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { Group } from 'three';
import {
  CircleGeometry,
  MeshLambertMaterial,
  TextureLoader,
} from '@/utils/three-exports';

const DEFAULT_OUTER_TEXTURE_PATH = '/outer.webp';
const DEFAULT_POSITION: [number, number, number] = [0, 0.12, 0.65];

interface ThroneOuterFloorProps {
  radius: number;
  texturePath?: string;
  position?: [number, number, number];
  /** Radians per second around Y. Omit for a static floor. */
  rotateSpeed?: number;
}

function ThroneOuterFloor({
  radius,
  texturePath = DEFAULT_OUTER_TEXTURE_PATH,
  position = DEFAULT_POSITION,
  rotateSpeed,
}: ThroneOuterFloorProps) {
  const groupRef = useRef<Group>(null);
  const texture = useLoader(TextureLoader, texturePath);

  const geometry = useMemo(
    () => new CircleGeometry(radius, 64),
    [radius],
  );

  const material = useMemo(
    () =>
      new MeshLambertMaterial({
        map: texture,
        color: '#ffffff',
      }),
    [texture],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.map = null;
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    if (rotateSpeed == null || !groupRef.current) return;
    groupRef.current.rotation.y += rotateSpeed * delta;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh
        name="throne-outer-floor"
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={geometry}
        material={material}
        receiveShadow
      />
    </group>
  );
}

export default React.memo(ThroneOuterFloor);
