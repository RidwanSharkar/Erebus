'use client';

import React, { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
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
}

function ThroneOuterFloor({
  radius,
  texturePath = DEFAULT_OUTER_TEXTURE_PATH,
  position = DEFAULT_POSITION,
}: ThroneOuterFloorProps) {
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

  return (
    <mesh
      name="throne-outer-floor"
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      geometry={geometry}
      material={material}
      receiveShadow
    />
  );
}

export default React.memo(ThroneOuterFloor);
