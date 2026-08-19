'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Material, Object3D, SkinnedMesh, Texture } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  RepeatWrapping,
} from '@/utils/three-exports';

export const ALCHEMY_CAULDRON_PATH = '/models/environ/alchemy_cauldron.glb';
/** Native XZ ≈ 2.54. Scale to a ~3.2-unit footprint (hull radius 1.6). */
export const ALCHEMY_CAULDRON_SCALE = 1.061;
/** Lift so the lowest vertex (native min Y ≈ -0.953) sits on the ground. */
export const ALCHEMY_CAULDRON_GROUND_Y = 1.202;
/** HP billboard just above the scaled rim. */
export const ALCHEMY_CAULDRON_HP_BAR_Y = 2.58;
const BUBBLE_MAT_NAME = 'alchemy_cauldron_bubble_green';
const BUBBLE_SPIN_SPEED = 0.85;
const BUBBLE_SCROLL_SPEEDS = [
  { x: 0.18, y: 0.42 },
  { x: 0.11, y: -0.28 },
] as const;

useGLTF.preload(ALCHEMY_CAULDRON_PATH);

export function preloadAlchemyCauldron(): void {
  useGLTF.preload(ALCHEMY_CAULDRON_PATH);
}

type BubbleMaterial = Material & {
  map?: Texture | null;
  emissiveMap?: Texture | null;
  transparent?: boolean;
  depthWrite?: boolean;
  side?: number;
  blending?: number;
  toneMapped?: boolean;
  metalness?: number;
  roughness?: number;
  emissiveIntensity?: number;
  emissive?: { set: (color: string) => unknown };
  needsUpdate?: boolean;
};

function isBubbleMaterial(mat: Material): boolean {
  return (mat.name || '').toLowerCase() === BUBBLE_MAT_NAME;
}

function unskinBubbleMesh(skinned: Mesh): Mesh {
  const skinnedMesh = skinned as SkinnedMesh;
  if (!skinnedMesh.isSkinnedMesh) return skinned;

  const mesh = new Mesh(skinnedMesh.geometry, skinnedMesh.material);
  mesh.name = skinnedMesh.name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = skinnedMesh.renderOrder;
  mesh.matrixAutoUpdate = true;

  const parent = skinnedMesh.parent;
  if (parent) {
    mesh.position.copy(skinnedMesh.position);
    mesh.quaternion.copy(skinnedMesh.quaternion);
    mesh.scale.copy(skinnedMesh.scale);
    parent.add(mesh);
    parent.remove(skinnedMesh);
  }
  return mesh;
}

function configureCauldronBubbles(root: Object3D): {
  bubbleTextures: Texture[];
  bubbleSpin: Group | null;
} {
  const bubbleTextures: Texture[] = [];
  const bubbleMeshes: Mesh[] = [];
  let plane = 0;

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isBubbleMesh = false;
    for (const mat of mats) {
      if (!isBubbleMaterial(mat)) continue;
      isBubbleMesh = true;
      const bubble = mat as BubbleMaterial;
      bubble.transparent = true;
      bubble.depthWrite = false;
      bubble.side = DoubleSide;
      bubble.blending = AdditiveBlending;
      bubble.toneMapped = false;
      if (typeof bubble.metalness === 'number') bubble.metalness = 0;
      if (typeof bubble.roughness === 'number') bubble.roughness = 1;
      bubble.emissive?.set('#7dff6a');
      bubble.emissiveIntensity = 1.45;

      if (bubble.map) {
        const tex = bubble.map.clone();
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        tex.offset.set(0, 0);
        tex.needsUpdate = true;
        const speed = BUBBLE_SCROLL_SPEEDS[plane % BUBBLE_SCROLL_SPEEDS.length]!;
        plane += 1;
        tex.userData.scrollX = speed.x;
        tex.userData.scrollY = speed.y;
        bubble.map = tex;
        bubble.emissiveMap = tex;
        bubbleTextures.push(tex);
      }
      bubble.needsUpdate = true;
    }
    if (isBubbleMesh) bubbleMeshes.push(mesh);
  });

  const bubbleSpin = new Group();
  bubbleSpin.name = 'alchemy-cauldron-bubble-spin';
  const spinParent = bubbleMeshes[0]?.parent ?? null;
  if (spinParent) spinParent.add(bubbleSpin);

  for (const mesh of bubbleMeshes) {
    const unskinned = unskinBubbleMesh(mesh);
    bubbleSpin.attach(unskinned);
  }

  return { bubbleTextures, bubbleSpin: bubbleMeshes.length > 0 ? bubbleSpin : null };
}

function AlchemyCauldronInner() {
  const { scene } = useGLTF(ALCHEMY_CAULDRON_PATH);

  const { clonedScene, bubbleTextures, bubbleSpin } = useMemo(() => {
    const cloned = prepareDecorScene(scene, true) as Group;
    const configured = configureCauldronBubbles(cloned);
    return { clonedScene: cloned, ...configured };
  }, [scene]);
  useDisposeClonedMaterials(clonedScene);

  useEffect(() => {
    return () => {
      for (const tex of bubbleTextures) tex.dispose();
    };
  }, [bubbleTextures]);

  useFrame((_, delta) => {
    for (const tex of bubbleTextures) {
      tex.offset.x += delta * (tex.userData.scrollX as number);
      tex.offset.y += delta * (tex.userData.scrollY as number);
    }
    if (bubbleSpin) bubbleSpin.rotation.y += delta * BUBBLE_SPIN_SPEED;
  });

  return (
    <group scale={ALCHEMY_CAULDRON_SCALE}>
      <primitive object={clonedScene} />
      <PooledEffectLight
        color="#5dff4a"
        intensity={1.8}
        distance={8}
        decay={2}
        position={[0, 0.55, 0]}
      />
    </group>
  );
}

export interface AlchemyCauldronProps {
  position?: [number, number, number];
}

export function AlchemyCauldron({ position = [0, ALCHEMY_CAULDRON_GROUND_Y, 0] }: AlchemyCauldronProps) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <AlchemyCauldronInner />
      </Suspense>
    </group>
  );
}

export default AlchemyCauldron;
