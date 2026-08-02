'use client';

import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, Object3D } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  UNIT_SELF_ILLUMINATION_INTENSITY,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import type { ThroneFloatingDecorDef } from '@/utils/throneCenterDecorLayout';

function prepareDecorScene(scene: Object3D, cloneMaterials = false): Object3D {
  const root = cloneMaterials ? (SkeletonUtils.clone(scene) as Group) : scene;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    if (cloneMaterials && mesh.material) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    }
  });
  if (cloneMaterials) {
    applySelfIllumination(root, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
  }
  return root;
}

export { prepareDecorScene };

export function FloatingTrinketMesh({
  path,
  def,
  lightColor,
  lightIntensity = 0,
}: {
  path: string;
  def: ThroneFloatingDecorDef;
  lightColor?: string;
  lightIntensity?: number;
}) {
  const rootRef = useRef<Group>(null);
  const { scene } = useGLTF(path);

  const clonedScene = useMemo(() => prepareDecorScene(scene, true), [scene]);
  useDisposeClonedMaterials(clonedScene);

  const [bx, by, bz] = def.position;
  const modelY = def.modelOffsetY ?? 0;
  const isBook = def.motion === 'book';
  const bobAmp = isBook ? 0.04 : 0.08;
  const spinSpeed = isBook ? 0 : 0.35;
  const tiltAmp = isBook ? 0.05 : 0.1;

  useFrame((state) => {
    const g = rootRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime + def.phase;
    g.position.x = bx + Math.sin(t * 0.55) * 0.03;
    g.position.y = by + Math.sin(t * 1.15) * bobAmp;
    g.position.z = bz + Math.cos(t * 0.48) * 0.025;
    if (isBook) {
      g.rotation.y = Math.sin(t * 0.42) * 0.12;
      g.rotation.x = Math.sin(t * 0.9) * tiltAmp;
      g.rotation.z = Math.sin(t * 0.7) * tiltAmp * 0.5;
    } else {
      g.rotation.y = t * spinSpeed;
      g.rotation.x = Math.sin(t * 0.8) * tiltAmp;
      g.rotation.z = Math.sin(t * 1.05) * tiltAmp * 0.7;
    }
  });

  return (
    <group ref={rootRef} position={[bx, by, bz]}>
      {/* Position is model-space (pre-scale) so Y offsets match raw GLB centers. */}
      <group scale={def.scale}>
        <group position={[0, modelY, 0]}>
          <primitive object={clonedScene} />
        </group>
      </group>
      {lightIntensity > 0 && lightColor ? (
        <PooledEffectLight
          color={lightColor}
          intensity={lightIntensity}
          distance={4}
          decay={2}
        />
      ) : null}
    </group>
  );
}
