'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface TitanModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isPoweringUp: boolean;
  isStomping: boolean;
  isCasting: boolean;
  isDying: boolean;
}

const TITAN_IDLE_PATH = '/models/titan_walk.glb';

const TITAN_MODEL_PATHS = [
  TITAN_IDLE_PATH,
  '/models/titan_melee.glb',
  '/models/titan_death.glb',
  '/models/titan_powerup.glb',
  '/models/titan_stomp.glb',
  '/models/titan_cast.glb',
];

const TITAN_DEFERRED_PATHS = {
  Melee: '/models/titan_melee.glb',
  Death: '/models/titan_death.glb',
  Powerup: '/models/titan_powerup.glb',
  Stomp: '/models/titan_stomp.glb',
  Cast: '/models/titan_cast.glb',
} as const;

export function preloadTitanModels(): void {
  preloadSkinnedIdleAndAnimationClips(TITAN_IDLE_PATH, TITAN_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.02775;

export default React.memo(function TitanModel({
  isWalking,
  isAttacking,
  isPoweringUp,
  isStomping,
  isCasting,
  isDying,
}: TitanModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: walkAnims } = useGLTF(TITAN_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(TITAN_DEFERRED_PATHS);
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
        console.warn('Failed to load titan animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, TITAN_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: true,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const walkClips = renameAnimationClips(walkAnims, 'Walk').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(TITAN_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return walkClips;
    return getCachedEnemyAnimationClips('titan', () => [
      ...walkClips,
      ...renameAnimationClips(extraAnims.Melee, 'Melee').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Powerup, 'Powerup').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Stomp, 'Stomp').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Cast, 'Cast').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
    ]);
  }, [walkAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Walk' | 'Melee' | 'Powerup' | 'Stomp' | 'Cast' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef, idleClipName: 'Walk' });

  // Priority: Death > Cast > Stomp > Powerup > Melee > Walk
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isCasting
        ? getAction('Cast')
        : isStomping
          ? getAction('Stomp')
          : isPoweringUp
            ? getAction('Powerup')
            : isAttacking
              ? getAction('Melee')
              : getAction('Walk');

    const oneShot = !!(isDying || isCasting || isStomping || isPoweringUp || isAttacking);
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: oneShot,
      clampWhenFinished: oneShot,
      fadeIn: isDying ? 0.15 : oneShot ? 0.2 : 0.3,
      fadeOut: isDying ? 0.15 : 0.3,
    });
  }, [isWalking, isAttacking, isPoweringUp, isStomping, isCasting, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Melee' || name === 'Stomp' || name === 'Powerup' || name === 'Cast') {
        playEnemyAction(getAction('Walk'), currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
