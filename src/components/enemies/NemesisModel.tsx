'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { loadAllGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';

interface NemesisModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
}

type NemesisClip = 'Idle' | 'Walk' | 'Melee' | 'Melee2' | 'Death';
type NemesisDeferredClip = Exclude<NemesisClip, 'Idle'>;

const NEMESIS_MODEL_PATHS = [
  '/models/nemesis_idle.glb',
  '/models/nemesis_walk.glb',
  '/models/nemesis_melee.glb',
  '/models/nemesis_melee2.glb',
  '/models/nemesis_death.glb',
];

const NEMESIS_ANIM_PATHS: Record<NemesisDeferredClip, string> = {
  Walk: '/models/nemesis_walk.glb',
  Melee: '/models/nemesis_melee.glb',
  Melee2: '/models/nemesis_melee2.glb',
  Death: '/models/nemesis_death.glb',
};

export function preloadNemesisModels(): void {
  preloadSkinnedIdleAndAnimationClips(
    '/models/nemesis_idle.glb',
    NEMESIS_MODEL_PATHS,
    useGLTF.preload,
  );
}

const SCALE = 0.022;

export default React.memo(function NemesisModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
}: NemesisModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const extraActionsRef = useRef<Partial<Record<NemesisDeferredClip, AnimationAction>>>({});
  const isMountedRef = useRef(true);
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<NemesisDeferredClip, AnimationClip[]>>
  >({});

  const { scene, animations: idleAnims } = useGLTF('/models/nemesis_idle.glb');

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load deferred clips once — register on mixer directly so useAnimations clip
  // list stays idle-only and never triggers stopAllAction cleanup (T-pose).
  useEffect(() => {
    let cancelled = false;
    loadAllGltfAnimationClips(NEMESIS_ANIM_PATHS).then((clips) => {
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

  // Only Idle goes through useAnimations — stable so deferred loads never
  // trigger stopAllAction / uncache and leave the unit in bind pose.
  const idleClips = useMemo(() => {
    const processed = getCachedProcessedClips('nemesis-idle', idleAnims, {
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
      name: NemesisDeferredClip,
      rawClips: AnimationClip[] | undefined,
      cacheKey: string,
      options: { stripRootMotion?: boolean; renameTo?: string } = {},
    ) => {
      if (!rawClips?.length || extraActionsRef.current[name]) return;
      const processed = getCachedProcessedClips(cacheKey, rawClips, options);
      processed.forEach((clip) => {
        const boundClip = filterAnimationTracksForRoot(root, clip);
        extraActionsRef.current[name] = mixer.clipAction(boundClip, root);
      });
    };

    registerClip('Walk', deferredAnimationClips.Walk, 'nemesis-walk', { stripRootMotion: true, renameTo: 'Walk' });
    registerClip('Melee', deferredAnimationClips.Melee, 'nemesis-melee', { stripRootMotion: true, renameTo: 'Melee' });
    registerClip('Melee2', deferredAnimationClips.Melee2, 'nemesis-melee2', { stripRootMotion: true, renameTo: 'Melee2' });
    registerClip('Death', deferredAnimationClips.Death, 'nemesis-death', { renameTo: 'Death' });
  }, [deferredAnimationClips, mixer]);

  const getAction = (name: NemesisClip): AnimationAction | null =>
    idleActions[name] ?? extraActionsRef.current[name as NemesisDeferredClip] ?? null;

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

    // Walk/Melee may still be loading — keep Idle rather than freezing in bind pose.
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
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
