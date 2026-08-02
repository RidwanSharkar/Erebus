'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  filterAnimationTracksForRoot,
  getCachedProcessedClips,
  invalidateProcessedClipCache,
} from '@/utils/enemyAnimationClipCache';
import { loadAllGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { pickWowClip } from '@/utils/wowAnimationClips';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';

interface ColossusModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
}

type ColossusClip = 'Idle' | 'Walk' | 'Melee' | 'Melee2' | 'Death';
type ColossusDeferredClip = Exclude<ColossusClip, 'Idle'>;

const IDLE_PATH = '/models/colossus/colossus_idle.glb';
const MODEL_PATHS = [
  IDLE_PATH,
  '/models/colossus/colossus_walk.glb',
  '/models/colossus/colossus_attack.glb',
  '/models/colossus/colossus_attack2.glb',
  '/models/colossus/colossus_death.glb',
];

const ANIM_PATHS: Record<ColossusDeferredClip, string> = {
  Walk: '/models/colossus/colossus_walk.glb',
  Melee: '/models/colossus/colossus_attack.glb',
  Melee2: '/models/colossus/colossus_attack2.glb',
  Death: '/models/colossus/colossus_death.glb',
};

// Bust poisoned multi-clip caches from before pickWowClip (last clip was Submerged).
invalidateProcessedClipCache('colossus');

export function preloadColossusModels(): void {
  preloadSkinnedIdleAndAnimationClips(IDLE_PATH, MODEL_PATHS, useGLTF.preload);
}

/** Meter-scale GLB (not WoW-scale) — native bind height from idle bounding box. */
const BIND_HEIGHT = 4.08;
const TARGET_HEIGHT = 6.5;
const SCALE = TARGET_HEIGHT / BIND_HEIGHT;

export default React.memo(function ColossusModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
}: ColossusModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const extraActionsRef = useRef<Partial<Record<ColossusDeferredClip, AnimationAction>>>({});
  const isMountedRef = useRef(true);
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<ColossusDeferredClip, AnimationClip[]>>
  >({});

  const { scene, animations: idleAnims } = useGLTF(IDLE_PATH);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAllGltfAnimationClips(ANIM_PATHS).then((clips) => {
      if (!cancelled && isMountedRef.current) setDeferredAnimationClips(clips);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleClips = useMemo(() => {
    // Idle GLB lists Walk first — must pick Stand explicitly.
    const picked = pickWowClip(idleAnims, 'Stand (ID 0 variation 0)', 'Stand');
    const processed = getCachedProcessedClips('colossus-idle', picked, {
      stripRootMotion: true,
      renameTo: 'Idle',
    });
    return processed.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [idleAnims, clonedScene]);

  const { actions: idleActions, mixer } = useAnimations(idleClips, sceneGroupRef);

  useEffect(() => {
    if (!mixer || !sceneGroupRef.current) return;
    const root = sceneGroupRef.current;

    const registerClip = (
      name: ColossusDeferredClip,
      rawClips: AnimationClip[] | undefined,
      cacheKey: string,
      prefixes: string[],
      options: { stripRootMotion?: boolean; renameTo?: string } = {},
    ) => {
      if (!rawClips?.length || extraActionsRef.current[name]) return;
      const picked = pickWowClip(rawClips, ...prefixes);
      if (!picked.length) return;
      const processed = getCachedProcessedClips(cacheKey, picked, options);
      processed.forEach((clip) => {
        const boundClip = filterAnimationTracksForRoot(root, clip);
        extraActionsRef.current[name] = mixer.clipAction(boundClip, root);
      });
    };

    registerClip('Walk', deferredAnimationClips.Walk, 'colossus-walk', ['Walk (ID 4 variation 0)', 'Walk'], {
      stripRootMotion: true,
      renameTo: 'Walk',
    });
    registerClip(
      'Melee',
      deferredAnimationClips.Melee,
      'colossus-melee',
      ['AttackUnarmed (ID 16 variation 0)', 'AttackUnarmed'],
      { stripRootMotion: true, renameTo: 'Melee' },
    );
    registerClip(
      'Melee2',
      deferredAnimationClips.Melee2,
      'colossus-melee2',
      ['AttackUnarmed (ID 16 variation 2)', 'AttackUnarmed (ID 16 variation 1)', 'AttackUnarmed'],
      { stripRootMotion: true, renameTo: 'Melee2' },
    );
    registerClip('Death', deferredAnimationClips.Death, 'colossus-death', ['Death (ID 1 variation 0)', 'Death'], {
      renameTo: 'Death',
    });
  }, [deferredAnimationClips, mixer]);

  const getAction = (name: ColossusClip): AnimationAction | null =>
    idleActions[name] ?? extraActionsRef.current[name as ColossusDeferredClip] ?? null;

  const resolveIdle = useCallback(() => getAction('Idle'), [idleActions]); // eslint-disable-line react-hooks/exhaustive-deps
  const posed = useEnemyIdlePose({
    actions: idleActions,
    mixer,
    currentActionRef,
    resolveIdle,
  });

  useEffect(() => {
    if (!idleActions) return;
    const attackClip = attackVariant === 2 ? 'Melee2' : 'Melee';
    const desiredAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');

    const nextAction = desiredAction ?? getAction('Idle');
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || isAttacking) && !!desiredAction,
      clampWhenFinished: isDying,
    });
  }, [idleActions, isDying, isWalking, isAttacking, attackVariant, deferredAnimationClips, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'Melee' || clipName === 'Melee2') && !isDying) {
        const walk = (isWalking ? getAction('Walk') : getAction('Idle')) ?? getAction('Idle');
        playEnemyAction(walk, currentActionRef, mixer);
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isWalking, isDying, idleActions, deferredAnimationClips]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      {/* WoW export faces +X; game yaw (atan2 dx,dz) assumes +Z forward. */}
      <group scale={SCALE} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
