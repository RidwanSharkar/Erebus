'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Object3D, SkinnedMesh, Texture } from 'three';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { acquireEffectLight, type DynamicLightHandle } from '@/utils/dynamicLights';
import {
  AdditiveBlending,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  Vector3,
} from '@/utils/three-exports';
import {
  EXPLORE_FIRE_PIT_ANIM_RADIUS2,
  submitExploreFirePitLod,
} from '@/utils/exploreFirePitLod';

export const FIREPLACE_MODEL_PATH = '/models/environ/fireplace.glb';
export const FIREPLACE_SCALE = 0.6625;
export const FIREPLACE_GROUND_Y = 0.15;
const FIRE_MAT_NAME = 'firewall2b';
const FIRE_SPIN_SPEED = 0.3675;
const FIRE_LIGHT_INTENSITY = 2.4;
const FIRE_SCROLL_SPEEDS = [
  { x: 0.22, y: 0.06 },
  { x: 0.31, y: -0.04 },
] as const;

const _firePitWorld = new Vector3();
let firePitLodIdSeq = 1;

useGLTF.preload(FIREPLACE_MODEL_PATH);

export function preloadFireplaceVisual(): void {
  useGLTF.preload(FIREPLACE_MODEL_PATH);
}

function isFireMaterialName(name: string | undefined): boolean {
  return (name || '').toLowerCase() === FIRE_MAT_NAME;
}

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

function configureFireplaceFire(root: Object3D): {
  fireTextures: Texture[];
  fireSpin: Group | null;
  fireMeshes: Mesh[];
} {
  const fireTextures: Texture[] = [];
  const fireMeshes: Mesh[] = [];
  let plane = 0;

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isFireMesh = false;
    const nextMats = mats.map((mat) => {
      if (!isFireMaterialName(mat.name)) return mat;
      isFireMesh = true;

      const src = mat as MeshBasicMaterial & { map?: Texture | null };
      const map = src.map;
      let tex: Texture | null = null;
      if (map) {
        tex = map.clone();
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        tex.offset.set(0, 0);
        tex.needsUpdate = true;
        const speed = FIRE_SCROLL_SPEEDS[plane % FIRE_SCROLL_SPEEDS.length]!;
        plane += 1;
        tex.userData.scrollX = speed.x;
        tex.userData.scrollY = speed.y;
        fireTextures.push(tex);
      }

      const fire = new MeshBasicMaterial({
        map: tex,
        color: '#ffffff',
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: FrontSide,
        blending: AdditiveBlending,
        toneMapped: false,
        fog: false,
      });
      fire.name = FIRE_MAT_NAME;
      fire.userData = { ...fire.userData, shared: false };
      return fire;
    });
    if (isFireMesh) {
      mesh.material = Array.isArray(mesh.material) ? nextMats : nextMats[0]!;
      fireMeshes.push(mesh);
    }
  });

  const fireSpin = new Group();
  fireSpin.name = 'fireplace-fire-spin';
  const spinParent = fireMeshes[0]?.parent ?? null;
  if (spinParent) spinParent.add(fireSpin);

  for (const mesh of fireMeshes) {
    const unskinned = unskinFireMesh(mesh);
    fireSpin.attach(unskinned);
  }

  const liveMeshes: Mesh[] = [];
  fireSpin.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) liveMeshes.push(mesh);
  });

  return { fireTextures, fireSpin: fireMeshes.length > 0 ? fireSpin : null, fireMeshes: liveMeshes };
}

function FireplaceVisualInner() {
  const { scene } = useGLTF(FIREPLACE_MODEL_PATH);
  const rootRef = useRef<Group>(null);
  const lightMarkerRef = useRef<Group>(null);
  const pitIdRef = useRef(0);
  if (pitIdRef.current === 0) pitIdRef.current = firePitLodIdSeq++;
  const lightOnRef = useRef(false);
  const animateRef = useRef(true);
  const lightHandleRef = useRef<DynamicLightHandle | null>(null);

  const { clonedScene, fireTextures, fireSpin } = useMemo(() => {
    const cloned = cloneBuildingScene(scene, FIREPLACE_MODEL_PATH);
    const configured = configureFireplaceFire(cloned);
    return { clonedScene: cloned, ...configured };
  }, [scene]);
  useDisposeClonedMaterials(clonedScene);

  useEffect(() => {
    return () => {
      lightHandleRef.current?.release();
      lightHandleRef.current = null;
      for (const tex of fireTextures) tex.dispose();
    };
  }, [fireTextures]);

  useFrame((state, delta) => {
    const g = rootRef.current;
    if (g) {
      g.getWorldPosition(_firePitWorld);
      const distSq = state.camera.position.distanceToSquared(_firePitWorld);
      const frameId = (state.clock.elapsedTime * 1000) | 0;
      const rankedOn = submitExploreFirePitLod(frameId, pitIdRef.current, distSq);
      lightOnRef.current = rankedOn;
      animateRef.current = distSq <= EXPLORE_FIRE_PIT_ANIM_RADIUS2;

      let light = lightHandleRef.current;
      if (rankedOn && !light) {
        light = acquireEffectLight({
          color: '#ff6b2b',
          intensity: FIRE_LIGHT_INTENSITY,
          distance: 10,
          decay: 2,
          priority: 2,
        });
        lightHandleRef.current = light;
      } else if (!rankedOn && light) {
        light.release();
        lightHandleRef.current = null;
        light = null;
      }

      const marker = lightMarkerRef.current;
      if (marker && light) {
        marker.getWorldPosition(_firePitWorld);
        light.setPosition(_firePitWorld.x, _firePitWorld.y, _firePitWorld.z);
        light.setIntensity(FIRE_LIGHT_INTENSITY);
      }
    }
    if (!animateRef.current) return;
    for (const tex of fireTextures) {
      tex.offset.x += delta * (tex.userData.scrollX as number);
      tex.offset.y += delta * (tex.userData.scrollY as number);
    }
    if (fireSpin) fireSpin.rotation.y += delta * FIRE_SPIN_SPEED;
  });

  return (
    <group ref={rootRef} scale={FIREPLACE_SCALE}>
      <primitive object={clonedScene} />
      <group ref={lightMarkerRef} position={[0, 0.85, 0]} />
    </group>
  );
}

export interface FireplaceVisualProps {
  position?: [number, number, number];
}

export function FireplaceVisual({ position = [0, FIREPLACE_GROUND_Y, 0] }: FireplaceVisualProps) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <FireplaceVisualInner />
      </Suspense>
    </group>
  );
}

export default FireplaceVisual;
