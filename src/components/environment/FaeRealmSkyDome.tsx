'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh as MeshType } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  Color,
  DoubleSide,
  Group,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@/utils/three-exports';

const SKY_DOME_PATH = '/models/environ/SKY.glb';
const SKY_DOME_SCALE = 55;
const SKY_DOME_Y = -20;
const SKY_DRIFT_RAD_PER_SEC = 0.005;
const FAE_SKY_BACKGROUND = '#1a1028';

useGLTF.preload(SKY_DOME_PATH);

export function preloadFaeRealmSkyDome(): void {
  useGLTF.preload(SKY_DOME_PATH);
}

function toUnlitSkyMaterial(src: Material): MeshBasicMaterial {
  const std = src as MeshStandardMaterial;
  return new MeshBasicMaterial({
    map: std.map ?? null,
    color: std.color ?? new Color(0xffffff),
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

export default function FaeRealmSkyDome({ combatActive = false }: { combatActive?: boolean }) {
  const { scene: gltfScene } = useGLTF(SKY_DOME_PATH);
  const groupRef = useRef<Group>(null);
  const { scene } = useThree();

  const skyRoot = useMemo(() => SkeletonUtils.clone(gltfScene) as Group, [gltfScene]);

  useLayoutEffect(() => {
    const created: MeshBasicMaterial[] = [];
    skyRoot.traverse((child) => {
      const mesh = child as MeshType;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = -1000;
      const src = mesh.material;
      if (Array.isArray(src)) {
        mesh.material = src.map((m) => {
          const next = toUnlitSkyMaterial(m);
          created.push(next);
          return next;
        });
      } else if (src) {
        const next = toUnlitSkyMaterial(src);
        created.push(next);
        mesh.material = next;
      }
    });
    return () => {
      for (const m of created) m.dispose();
    };
  }, [skyRoot]);

  useLayoutEffect(() => {
    const prev = scene.background;
    scene.background = new Color(FAE_SKY_BACKGROUND);
    return () => {
      scene.background = prev;
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (combatActive) return;
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += SKY_DRIFT_RAD_PER_SEC * delta;
  });

  return (
    <group ref={groupRef} name="fae-realm-sky-dome">
      <primitive object={skyRoot} scale={SKY_DOME_SCALE} position={[0, SKY_DOME_Y, 0]} />
    </group>
  );
}
