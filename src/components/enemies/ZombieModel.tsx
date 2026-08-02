'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface ZombieModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isSummoning: boolean;
  isDying: boolean;
}

const ZOMBIE_IDLE_PATH = '/models/zombie_idle.glb';

const ZOMBIE_MODEL_PATHS = [
  ZOMBIE_IDLE_PATH,
  '/models/zombie_walk.glb',
  '/models/zombie_attack.glb',
  '/models/zombie_summon.glb',
  '/models/zombie_death.glb',
];

const ZOMBIE_DEFERRED_PATHS = {
  Walk: '/models/zombie_walk.glb',
  Attack: '/models/zombie_attack.glb',
  Summon: '/models/zombie_summon.glb',
  Death: '/models/zombie_death.glb',
} as const;

export function preloadZombieModels(): void {
  preloadSkinnedIdleAndAnimationClips(ZOMBIE_IDLE_PATH, ZOMBIE_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.0125;

export default React.memo(function ZombieModel({ isWalking, isAttacking, isSummoning, isDying }: ZombieModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(ZOMBIE_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(ZOMBIE_DEFERRED_PATHS);
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
        console.warn('Failed to load zombie animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
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
    const hasAllDeferred = Object.keys(ZOMBIE_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return idleClips;
    return getCachedEnemyAnimationClips('zombie', () => [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Attack, 'Attack'),
      ...renameAnimationClips(extraAnims.Summon, 'Summon'),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
    ]);
  }, [idleAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Summon' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isSummoning
        ? getAction('Summon')
        : isAttacking
          ? getAction('Attack')
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || isSummoning || isAttacking),
      clampWhenFinished: !!(isDying || isSummoning || isAttacking),
      fadeIn: isDying ? 0.15 : 0.2,
    });
  }, [isWalking, isAttacking, isSummoning, isDying, actions, mixer]);

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Summon' || name === 'Attack') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]);

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
