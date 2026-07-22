'use client';

import React, { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import {
  CircleGeometry,
  ClampToEdgeWrapping,
  MeshLambertMaterial,
  Texture,
  TextureLoader,
} from '@/utils/three-exports';

/** World-space radius of the throne prep center seal (matches legacy inner stone pad). */
export const THRONE_CENTER_SEAL_RADIUS = 8.75;

const DEFAULT_CENTER_TEXTURE_PATH = '/center.png';
const DEFAULT_POSITION: [number, number, number] = [0, 0.15, 0.65];

/** 1408×768 source — crop to a centered square via UV repeat/offset. */
function applyCenterSquareCrop(texture: Texture) {
  const img = texture.image as HTMLImageElement | undefined;
  const w = img?.width ?? 1408;
  const h = img?.height ?? 768;
  const side = Math.min(w, h);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.repeat.set(side / w, side / h);
  texture.offset.set((w - side) / (2 * w), (h - side) / (2 * h));
  texture.needsUpdate = true;
}

interface ThroneCenterSealProps {
  texturePath?: string;
  position?: [number, number, number];
}

function ThroneCenterSeal({
  texturePath = DEFAULT_CENTER_TEXTURE_PATH,
  position = DEFAULT_POSITION,
}: ThroneCenterSealProps) {
  const texture = useLoader(TextureLoader, texturePath);

  useEffect(() => {
    applyCenterSquareCrop(texture);
  }, [texture]);

  const geometry = useMemo(
    () => new CircleGeometry(THRONE_CENTER_SEAL_RADIUS, 64),
    [],
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
      name="throne-center-seal"
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      geometry={geometry}
      material={material}
      receiveShadow
    />
  );
}

export default React.memo(ThroneCenterSeal);
