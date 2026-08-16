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

const FIREPLACE_PATH = '/models/environ/fireplace.glb';
/** Sit on the center seal pad (ThroneCenterSeal default Y). */
const FIREPLACE_POSITION: [number, number, number] = [0, 0.15, 0];
const FIREPLACE_SCALE = 0.6625;
const FIRE_MAT_NAME = 'firewall2b';
/** Shared Y spin for both fire planes so the crossed-card shape stays intact. */
const FIRE_SPIN_SPEED = 0.3675;
/** Per-plane UV scroll (units/sec). Slightly different so the crossing cards don't lock. */
const FIRE_SCROLL_SPEEDS = [
  { x: 0.22, y: 0.06 },
  { x: 0.31, y: -0.04 },
] as const;

useGLTF.preload(FIREPLACE_PATH);

export function preloadThroneFireplaceDecor(): void {
  useGLTF.preload(FIREPLACE_PATH);
}

type FireMaterial = Material & {
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

function isFireMaterial(mat: Material): boolean {
  return (mat.name || '').toLowerCase() === FIRE_MAT_NAME;
}

/**
 * Fire geosets are SkinnedMeshes. Attached bind mode cancels mesh.matrixWorld
 * against bindMatrixInverse, so rotating the mesh is a no-op. Bake to a regular
 * Mesh at bind pose so the crossed cards can spin around Y.
 */
function unskinFireMesh(skinned: Mesh): Mesh {
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

/** Additive UV-scroll fire: Stand clip is empty; WoW fire is texture animation. */
function configureFireplaceFire(root: Object3D): {
  fireTextures: Texture[];
  fireSpin: Group | null;
} {
  const fireTextures: Texture[] = [];
  const fireMeshes: Mesh[] = [];
  let plane = 0;

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isFireMesh = false;
    for (const mat of mats) {
      if (!isFireMaterial(mat)) continue;
      isFireMesh = true;
      const fire = mat as FireMaterial;
      fire.transparent = true;
      fire.depthWrite = false;
      fire.side = DoubleSide;
      fire.blending = AdditiveBlending;
      fire.toneMapped = false;
      if (typeof fire.metalness === 'number') fire.metalness = 0;
      if (typeof fire.roughness === 'number') fire.roughness = 1;
      fire.emissive?.set('#ffffff');
      fire.emissiveIntensity = 1.35;

      if (fire.map) {
        const tex = fire.map.clone();
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        tex.offset.set(0, 0);
        tex.needsUpdate = true;
        const speed = FIRE_SCROLL_SPEEDS[plane % FIRE_SCROLL_SPEEDS.length]!;
        plane += 1;
        tex.userData.scrollX = speed.x;
        tex.userData.scrollY = speed.y;
        fire.map = tex;
        fire.emissiveMap = tex;
        fireTextures.push(tex);
      }
      fire.needsUpdate = true;
    }
    if (isFireMesh) fireMeshes.push(mesh);
  });

  const fireSpin = new Group();
  fireSpin.name = 'fireplace-fire-spin';
  const spinParent = fireMeshes[0]?.parent ?? null;
  if (spinParent) spinParent.add(fireSpin);

  for (const mesh of fireMeshes) {
    const unskinned = unskinFireMesh(mesh);
    fireSpin.attach(unskinned);
  }

  return { fireTextures, fireSpin: fireMeshes.length > 0 ? fireSpin : null };
}

function ThroneFireplaceMesh() {
  const { scene } = useGLTF(FIREPLACE_PATH);

  const { clonedScene, fireTextures, fireSpin } = useMemo(() => {
    const cloned = prepareDecorScene(scene, true) as Group;
    const configured = configureFireplaceFire(cloned);
    return { clonedScene: cloned, ...configured };
  }, [scene]);
  useDisposeClonedMaterials(clonedScene);

  useEffect(() => {
    return () => {
      for (const tex of fireTextures) tex.dispose();
    };
  }, [fireTextures]);

  useFrame((_, delta) => {
    for (const tex of fireTextures) {
      tex.offset.x += delta * (tex.userData.scrollX as number);
      tex.offset.y += delta * (tex.userData.scrollY as number);
    }
    if (fireSpin) fireSpin.rotation.y += delta * FIRE_SPIN_SPEED;
  });

  return (
    <group position={FIREPLACE_POSITION} scale={FIREPLACE_SCALE}>
      <primitive object={clonedScene} />
      <PooledEffectLight
        color="#ff6b2b"
        intensity={2.4}
        distance={10}
        decay={2}
        position={[0, 0.85, 0]}
      />
    </group>
  );
}

function ThroneFireplaceDecorInner() {
  return (
    <group name="throne-fireplace-decor">
      <ThroneFireplaceMesh />
    </group>
  );
}

function ThroneFireplaceDecor() {
  return (
    <Suspense fallback={null}>
      <ThroneFireplaceDecorInner />
    </Suspense>
  );
}

const MemoThroneFireplaceDecor = React.memo(ThroneFireplaceDecor);
MemoThroneFireplaceDecor.displayName = 'ThroneFireplaceDecor';

export default MemoThroneFireplaceDecor;
