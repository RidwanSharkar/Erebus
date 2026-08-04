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

interface ViperModelProps {
  isWalking: boolean;
  // Increments by 1 on every attack telegraph — guaranteed to change even when
  // the previous animation hasn't finished yet, so DrawBow always restarts.
  attackKey: number;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const VIPER_IDLE_PATH = '/models/viper_idle.glb';

const VIPER_MODEL_PATHS = [
  VIPER_IDLE_PATH,
  '/models/viper_walk.glb',
  '/models/viper_drawbow.glb',
  '/models/viper_releasebow.glb',
  '/models/viper_death.glb',
  '/models/viper_impact.glb',
];

const VIPER_DEFERRED_PATHS = {
  Walk: '/models/viper_walk.glb',
  DrawBow: '/models/viper_drawbow.glb',
  ReleaseBow: '/models/viper_releasebow.glb',
  Death: '/models/viper_death.glb',
  Impact: '/models/viper_impact.glb',
} as const;

export function preloadViperModels(): void {
  preloadSkinnedIdleAndAnimationClips(VIPER_IDLE_PATH, VIPER_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.0125;

export default React.memo(function ViperModel({
  isWalking,
  attackKey,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: ViperModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const attackPhaseRef = useRef<'draw' | 'release' | 'done'>('done');
  const lastImpactPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(VIPER_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(VIPER_DEFERRED_PATHS);
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
        console.warn('Failed to load viper animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, VIPER_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: false,
      receiveShadow: false,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(VIPER_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return idleClips;
    return getCachedEnemyAnimationClips('viper', () => [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.DrawBow, 'DrawBow'),
      ...renameAnimationClips(extraAnims.ReleaseBow, 'ReleaseBow'),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
      ...renameAnimationClips(extraAnims.Impact, 'Impact'),
    ]);
  }, [idleAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'DrawBow' | 'ReleaseBow' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Death overrides everything
  useEffect(() => {
    if (!actions || !isDying) return;
    attackPhaseRef.current = 'done';
    playEnemyAction(getAction('Death'), currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.15,
      fadeOut: 0.15,
    });
  }, [isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hit-react (idle / walk only — not during bow cycle)
  useEffect(() => {
    if (!actions || isDying || !isImpacting) return;
    if (attackPhaseRef.current !== 'done') return;

    const retrigger = impactPlayKey !== lastImpactPlayKeyRef.current;
    lastImpactPlayKeyRef.current = impactPlayKey;
    playEnemyAction(getAction('Impact'), currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      forceRestart: retrigger,
    });
  }, [isImpacting, impactPlayKey, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attack trigger ─────────────────────────────────────────────────────────
  // Fires every time attackKey increments (once per server telegraph), regardless
  // of whether the previous animation had finished. Hard-restarts DrawBow so the
  // animation always matches each projectile launch.
  useEffect(() => {
    if (attackKey === 0 || !actions || isDying) return;

    attackPhaseRef.current = 'draw';
    lastImpactPlayKeyRef.current = -1;
    playEnemyAction(getAction('DrawBow'), currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.1,
      fadeOut: 0.1,
      forceRestart: true,
    });
  }, [attackKey, actions, isDying, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle / Walk transitions ────────────────────────────────────────────────
  // Only runs when the viper is NOT in the middle of an attack cycle or impact.
  useEffect(() => {
    if (!actions || isDying) return;
    if (attackPhaseRef.current !== 'done') return;
    if (isImpacting) return;

    const nextAction = isWalking ? getAction('Walk') : getAction('Idle');
    playEnemyAction(nextAction, currentActionRef, mixer);
  }, [isWalking, isDying, isImpacting, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DrawBow → ReleaseBow → Idle/Walk, plus Impact/Death one-shots ─────────
  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (event: { action: AnimationAction }) => {
      if (isDying) return;
      const finishedAction = event.action;
      const clipName = finishedAction.getClip().name;

      if (clipName === 'Death') return;

      if (clipName === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }

      if (finishedAction === getAction('DrawBow') && attackPhaseRef.current === 'draw') {
        attackPhaseRef.current = 'release';
        playEnemyAction(getAction('ReleaseBow'), currentActionRef, mixer, {
          loopOnce: true,
          clampWhenFinished: true,
          fadeIn: 0.05,
          fadeOut: 0.05,
        });
        return;
      }

      if (finishedAction === getAction('ReleaseBow') && attackPhaseRef.current === 'release') {
        attackPhaseRef.current = 'done';
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
