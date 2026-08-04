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

interface MartyrModelProps {
  isWalking: boolean;
  isDying: boolean;
}

const MARTYR_IDLE_PATH = '/models/martyr_idle.glb';

const MARTYR_MODEL_PATHS = [
  MARTYR_IDLE_PATH,
  '/models/martyr_run.glb',
  '/models/martyr_death.glb',
];

const MARTYR_DEFERRED_PATHS = {
  Run: '/models/martyr_run.glb',
  Death: '/models/martyr_death.glb',
} as const;

export function preloadMartyrModels(): void {
  preloadSkinnedIdleAndAnimationClips(MARTYR_IDLE_PATH, MARTYR_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.008;

export default React.memo(function MartyrModel({ isWalking, isDying }: MartyrModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(MARTYR_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(MARTYR_DEFERRED_PATHS);
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
        console.warn('Failed to load martyr animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, MARTYR_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: true,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(MARTYR_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return idleClips;
    return getCachedEnemyAnimationClips('martyr', () => [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Run, 'Run').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Death, 'Death').map(stripRootMotionXZ),
    ]);
  }, [idleAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Death'): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Run (or Idle when priming) > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isWalking
        ? getAction('Run')
        : getAction('Idle');

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying,
      clampWhenFinished: isDying,
      fadeIn: isDying ? 0.15 : 0.2,
    });
  }, [isWalking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
