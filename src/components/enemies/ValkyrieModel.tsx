'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';
import { loadAllGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';

export type ValkyrieAbilityClip = 'Attack' | 'Attack2' | 'Cast';

interface ValkyrieModelProps {
  abilityClip: ValkyrieAbilityClip | null;
  isDying: boolean;
}

const VALKYRIE_MODEL_PATHS = [
  '/models/valkyrie_idle.glb',
  '/models/valkyrie_attack.glb',
  '/models/valkyrie_attack2.glb',
  '/models/valkyrie_cast.glb',
  '/models/valkyrie_death.glb',
];

const VALKYRIE_ANIM_PATHS = {
  Attack: '/models/valkyrie_attack.glb',
  Attack2: '/models/valkyrie_attack2.glb',
  Cast: '/models/valkyrie_cast.glb',
  Death: '/models/valkyrie_death.glb',
} as const;

export function preloadValkyrieModels(): void {
  preloadSkinnedIdleAndAnimationClips(
    '/models/valkyrie_idle.glb',
    VALKYRIE_MODEL_PATHS,
    useGLTF.preload,
  );
}

const SCALE = 0.0161;

export default React.memo(function ValkyrieModel({
  abilityClip,
  isDying,
}: ValkyrieModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/valkyrie_idle.glb');
  const [extraClips, setExtraClips] = useState<Record<keyof typeof VALKYRIE_ANIM_PATHS, AnimationClip[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAllGltfAnimationClips(VALKYRIE_ANIM_PATHS).then((clips) => {
      if (!cancelled) setExtraClips(clips);
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

  const processedClips = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    if (!extraClips) return idleClips;
    return getCachedEnemyAnimationClips('valkyrie', () => [
      ...idleClips,
      ...renameAnimationClips(extraClips.Attack, 'Attack').map(stripRootMotionXZ),
      ...renameAnimationClips(extraClips.Attack2, 'Attack2').map(stripRootMotionXZ),
      ...renameAnimationClips(extraClips.Cast, 'Cast').map(stripRootMotionXZ),
      ...renameAnimationClips(extraClips.Death, 'Death'),
    ]);
  }, [idleAnims, extraClips]);

  const animations = useMemo(
    () => processedClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip)),
    [processedClips, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (name: 'Idle' | 'Attack' | 'Attack2' | 'Cast' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : getAction('Idle');
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || abilityClip),
      clampWhenFinished: isDying,
      timeScale: abilityClip === 'Attack' || abilityClip === 'Attack2' ? 2 : 1,
    });
  }, [actions, isDying, abilityClip, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'Attack' || clipName === 'Attack2' || clipName === 'Cast') && !isDying) {
        playEnemyAction(getAction('Idle'), currentActionRef, mixer, { timeScale: 1 });
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
