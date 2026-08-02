'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  filterAnimationTracksForRoot,
  getCachedEnemyAnimationClips,
  invalidateEnemyAnimationClipCache,
  peekEnemyAnimationClipCache,
  renameAnimationClips,
  stripRootMotionXZ,
} from '@/utils/enemyAnimationClipCache';

export type SentinelAbilityClip = 'ThrowUp' | 'HoldCast';

interface SentinelModelProps {
  isWalking: boolean;
  isStunned?: boolean;
  isSlowed?: boolean;
  abilityClip: SentinelAbilityClip | null;
  isDying: boolean;
}

const SENTINEL_IDLE_PATH = '/models/sentinel_idle.glb';

const SENTINEL_MODEL_PATHS = [
  SENTINEL_IDLE_PATH,
  '/models/sentinel_walk.glb',
  '/models/sentinel_throwUp.glb',
  '/models/sentinel_holdCast.glb',
  '/models/sentinel_death.glb',
];

const SENTINEL_DEFERRED_PATHS = {
  Walk: '/models/sentinel_walk.glb',
  ThrowUp: '/models/sentinel_throwUp.glb',
  HoldCast: '/models/sentinel_holdCast.glb',
  Death: '/models/sentinel_death.glb',
} as const;

export function preloadSentinelModels(): void {
  preloadSkinnedIdleAndAnimationClips(SENTINEL_IDLE_PATH, SENTINEL_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.012;

export default React.memo(function SentinelModel({
  isWalking,
  isStunned = false,
  isSlowed = false,
  abilityClip,
  isDying,
}: SentinelModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SENTINEL_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SENTINEL_DEFERRED_PATHS);
    void Promise.all(
      entries.map(async ([name, path]) => {
        const clips = await loadGltfAnimationClips(path);
        return [name, clips] as const;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;
        setExtraAnims(Object.fromEntries(loaded));
      })
      .catch((error) => {
        console.warn('Failed to load sentinel animations:', error);
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
        child.receiveShadow = false;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(SENTINEL_DEFERRED_PATHS).every(
      (key) => extraAnims[key]?.length,
    );
    if (!hasAllDeferred) {
      return idleClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
    }

    // Recover from a session cache that was poisoned before Walk/ThrowUp/etc. loaded.
    const cached = peekEnemyAnimationClipCache('sentinel-walk-only');
    if (cached && !cached.some((clip) => clip.name === 'Walk')) {
      invalidateEnemyAnimationClipCache('sentinel-walk-only');
    }

    return getCachedEnemyAnimationClips('sentinel-walk-only', () => [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.ThrowUp, 'ThrowUp'),
      ...renameAnimationClips(extraAnims.HoldCast, 'HoldCast'),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
    ]).map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [idleAnims, extraAnims, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (name: 'Idle' | 'Walk' | 'ThrowUp' | 'HoldCast' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    const locomotion = isStunned
      ? 'Idle'
      : isSlowed
        ? (isWalking ? 'Walk' : 'Idle')
        : isWalking
          ? 'Walk'
          : 'Idle';
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : getAction(locomotion);
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || abilityClip),
      clampWhenFinished: isDying,
    });
  }, [actions, isDying, isWalking, isStunned, isSlowed, abilityClip, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'ThrowUp' || clipName === 'HoldCast') && !isDying) {
        const loc = isStunned
          ? 'Idle'
          : isSlowed
            ? (isWalking ? 'Walk' : 'Idle')
            : isWalking
              ? 'Walk'
              : 'Idle';
        playEnemyAction(getAction(loc), currentActionRef, mixer);
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isWalking, isStunned, isSlowed, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
