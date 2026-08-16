'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { THRONE_CENTER_SEAL_RADIUS } from './ThroneCenterSeal';

const PLATFORM_PATH = '/models/environ/platform.glb';
/** Native XZ half-extent (max |x|, |z|) from the optimized GLB bbox. */
const PLATFORM_NATIVE_XZ_RADIUS = 39.976871490478516;
/** Native deck (bbox max Y) — sink so this lands on the seal / fireplace plane. */
const PLATFORM_NATIVE_MAX_Y = 1.1564632654190063;
/** Match `ThroneCenterSeal` / fireplace pad height. */
const PLATFORM_DECK_Y = 0.15;
/** Sit overlay meshes just above the slab so cream/teal inserts aren't buried. */
const OVERLAY_LIFT_EPSILON = 0.04;
const OVERLAY_EMISSIVE = 0.55;
/**
 * Gold filigree is an RGBA cutout marked OPAQUE in the GLB. A low cutoff
 * punches the black holes so the cream slab shows through; 0.5 would also
 * strip the medium-alpha orange/teal fills in the gold band.
 */
const OVERLAY_ALPHA_TEST = 0.08;

/** Local XZ radius after scale (inside the 1.35× defense throne group). */
export const DEFENSE_PLATFORM_RADIUS = THRONE_CENTER_SEAL_RADIUS;
export const DEFENSE_PLATFORM_MODEL_SCALE =
  DEFENSE_PLATFORM_RADIUS / PLATFORM_NATIVE_XZ_RADIUS;
const PLATFORM_POSITION_Y =
  PLATFORM_DECK_Y - PLATFORM_NATIVE_MAX_Y * DEFENSE_PLATFORM_MODEL_SCALE;

useGLTF.preload(PLATFORM_PATH);

export function preloadDefenseCenterPlatform(): void {
  useGLTF.preload(PLATFORM_PATH);
}

function meshLocalMaxY(mesh: Mesh): number {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  return geo.boundingBox?.max.y ?? -Infinity;
}

function liftPlatformOverlays(root: Group): Group {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh && mesh.geometry) meshes.push(mesh);
  });
  if (meshes.length < 2) return root;

  let slab: Mesh | null = null;
  let slabMaxY = -Infinity;
  for (const mesh of meshes) {
    const maxY = meshLocalMaxY(mesh);
    if (maxY > slabMaxY) {
      slabMaxY = maxY;
      slab = mesh;
    }
  }
  if (!slab) return root;

  for (const mesh of meshes) {
    if (mesh === slab) continue;
    const lift = slabMaxY - meshLocalMaxY(mesh) + OVERLAY_LIFT_EPSILON;
    if (lift > 0) mesh.position.y += lift;
    mesh.renderOrder = 1;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as MeshStandardMaterial;
      if (!std) continue;
      std.alphaTest = OVERLAY_ALPHA_TEST;
      std.transparent = false;
      std.depthWrite = true;
      if (std.emissive) {
        std.emissiveIntensity = Math.max(std.emissiveIntensity ?? 0, OVERLAY_EMISSIVE);
      }
      std.needsUpdate = true;
    }
  }
  return root;
}

function DefenseCenterPlatformMesh() {
  const { scene } = useGLTF(PLATFORM_PATH);
  const clonedScene = useMemo(
    () => liftPlatformOverlays(prepareDecorScene(scene, true) as Group),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group
      name="defense-center-platform"
      scale={DEFENSE_PLATFORM_MODEL_SCALE}
      position={[0, PLATFORM_POSITION_Y, 0]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

function DefenseCenterPlatform() {
  return (
    <Suspense fallback={null}>
      <DefenseCenterPlatformMesh />
    </Suspense>
  );
}

export default React.memo(DefenseCenterPlatform);
