'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface WraithModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isDying: boolean;
  /** Incremented on each buzzsaw telegraph to force Attack clip restart. */
  attackPlayKey?: number;
}

const WRAITH_IDLE_PATH = '/models/wraith_idle.glb';

const WRAITH_MODEL_PATHS = [
  WRAITH_IDLE_PATH,
  '/models/wraith_walk.glb',
  '/models/wraith_attack.glb',
  '/models/wraith_death.glb',
];

const WRAITH_DEFERRED_PATHS = {
  Walk: '/models/wraith_walk.glb',
  Attack: '/models/wraith_attack.glb',
  Death: '/models/wraith_death.glb',
} as const;

export function preloadWraithModels(): void {
  preloadSkinnedIdleAndAnimationClips(WRAITH_IDLE_PATH, WRAITH_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.01225;

export default React.memo(function WraithModel({
  isWalking,
  isAttacking,
  isDying,
  attackPlayKey = 0,
}: WraithModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(WRAITH_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WRAITH_DEFERRED_PATHS);
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
        console.warn('Failed to load wraith animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, WRAITH_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: false,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(WRAITH_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return idleClips;
    return getCachedEnemyAnimationClips('wraith', () => [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Attack, 'Attack'),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
    ]);
  }, [idleAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction('Attack')
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || isAttacking),
      clampWhenFinished: !!(isDying || isAttacking),
    });
  }, [isWalking, isAttacking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!actions || !isAttacking || attackPlayKey <= 0) return;
    playEnemyAction(getAction('Attack'), currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      forceRestart: true,
    });
  }, [attackPlayKey, isAttacking, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
