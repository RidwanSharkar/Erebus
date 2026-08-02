'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AnimationClip, Group, LoopRepeat } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  UNIT_SELF_ILLUMINATION_INTENSITY,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  filterAnimationTracksForRoot,
  getCachedProcessedClips,
} from '@/utils/enemyAnimationClipCache';

const SKYRAY_SWIM_PATH = '/models/SkyRay_swim.glb';
const BASILISK_SWIM_PATH = '/models/basilisk_swim.glb';

const ORBIT_Y = 4.5;
/** Radians per second — slow ambient swim. */
const ORBIT_SPEED = 0.2;
const BOB_AMPLITUDE = 0.35;
const BOB_SPEED = 0.8;
const PHASE_OFFSETS = [0, Math.PI] as const;

const TARGET_HEIGHT = 2.4;
const SKYRAY_BIND_HEIGHT = 2.0;
/** ~20% smaller than combat SkyRays — distant ambient decor. */
const DECOR_SIZE_SCALE = 0.4;
const SCALE = (TARGET_HEIGHT / SKYRAY_BIND_HEIGHT) * DECOR_SIZE_SCALE;
const MODEL_Y_OFFSET = 0.35 * SCALE;
/** Inner mesh bind rotation in OrbitSwimMesh — parent Y must compensate. */
const MODEL_Y_BIND = -Math.PI / 2;
/** Mesh forward is radial after bind; +π/2 aligns nose with orbit tangent. */
const ORBIT_TANGENT_Y_OFFSET = Math.PI / 2;
/** Flip 180° so they swim nose-first, not tail-first. */
const ORBIT_FORWARD_FLIP = Math.PI;

useGLTF.preload(SKYRAY_SWIM_PATH);

function clipCacheKeyForPath(modelPath: string): string {
  if (modelPath === BASILISK_SWIM_PATH) return 'orbit-fly-basilisk';
  return 'orbit-swim-skyray';
}

function isBasiliskOrbitPath(modelPath: string): boolean {
  return modelPath === BASILISK_SWIM_PATH;
}

export function preloadSkyRayOrbitDecor(modelPath: string = SKYRAY_SWIM_PATH): void {
  useGLTF.preload(modelPath);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]!] : [];
}

/** Orbit skinned mesh — swim for SkyRay, fly for basilisk/Yulon; no useFrame (orbit owned by parent). */
function OrbitSwimMesh({ modelPath }: { modelPath: string }) {
  const sceneGroupRef = useRef<Group>(null);
  const { scene, animations: swimAnims } = useGLTF(modelPath);
  const useFlyClip = isBasiliskOrbitPath(modelPath);
  const actionName = useFlyClip ? 'Fly' : 'Swim';

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  // Basilisk/Yulon: fly-first (GLB has both Swim + Fly). SkyRay: swim-first.
  const orbitSource = useMemo(
    () =>
      useFlyClip
        ? pickWowClip(
            swimAnims,
            'Fly (ID 135 variation 0)',
            'FlyRun (ID 234 variation 0)',
            'MountFlightIdle (ID 548 variation 0)',
            'Swim (ID 42 variation 0)',
          )
        : pickWowClip(
            swimAnims,
            'Swim (ID 42 variation 0)',
            'Fly (ID 135 variation 0)',
            'FlyRun (ID 234 variation 0)',
          ),
    [swimAnims, useFlyClip],
  );

  const animations = useMemo(() => {
    const clips = getCachedProcessedClips(clipCacheKeyForPath(modelPath), orbitSource, {
      stripRootMotion: true,
      renameTo: actionName,
    });
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [modelPath, orbitSource, clonedScene, actionName]);

  const { actions } = useAnimations(animations, sceneGroupRef);

  useEffect(() => {
    const action = actions?.[actionName];
    if (!action) return;
    action.enabled = true;
    action.setLoop(LoopRepeat, Infinity);
    action.reset().fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, actionName]);

  return (
    <group ref={sceneGroupRef}>
      <group
        scale={[SCALE, SCALE, SCALE]}
        position={[0, MODEL_Y_OFFSET, 0]}
        rotation={[0, MODEL_Y_BIND, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function SkyRayOrbitDecorInner({
  orbitRadius,
  modelPath,
}: {
  orbitRadius: number;
  modelPath: string;
}) {
  const group0Ref = useRef<Group>(null);
  const group1Ref = useRef<Group>(null);
  const groupRefs = useMemo(() => [group0Ref, group1Ref], []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PHASE_OFFSETS.length; i++) {
      const group = groupRefs[i]!.current;
      if (!group) continue;
      const phase = PHASE_OFFSETS[i]!;
      const angle = t * ORBIT_SPEED + phase;
      group.position.set(
        Math.cos(angle) * orbitRadius,
        ORBIT_Y + Math.sin(t * BOB_SPEED + phase) * BOB_AMPLITUDE,
        Math.sin(angle) * orbitRadius,
      );
      // CCW orbit tangent — perpendicular to radius so they swim around the room.
      const tangentX = -Math.sin(angle);
      const tangentZ = Math.cos(angle);
      group.rotation.y =
        Math.atan2(tangentX, tangentZ) - MODEL_Y_BIND + ORBIT_TANGENT_Y_OFFSET + ORBIT_FORWARD_FLIP;
    }
  });

  return (
    <group name="skyray-orbit-decor">
      <group ref={group0Ref}>
        <OrbitSwimMesh modelPath={modelPath} />
      </group>
      <group ref={group1Ref}>
        <OrbitSwimMesh modelPath={modelPath} />
      </group>
    </group>
  );
}

/** Two decorative swim meshes orbiting just beyond the playable arena edge. */
export default function SkyRayOrbitDecor({
  orbitRadius,
  modelPath = SKYRAY_SWIM_PATH,
}: {
  orbitRadius: number;
  modelPath?: string;
}) {
  return (
    <Suspense fallback={null}>
      <SkyRayOrbitDecorInner orbitRadius={orbitRadius} modelPath={modelPath} />
    </Suspense>
  );
}
