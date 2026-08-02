'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface GhoulModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isSummoning: boolean;
  isDying: boolean;
  isLeaping?: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  scaleMultiplier?: number;
}

const GHOUL_IDLE_PATH = '/models/ghoul_idle.glb';

const GHOUL_MODEL_PATHS = [
  GHOUL_IDLE_PATH,
  '/models/ghoul_run.glb',
  '/models/ghoul_attack.glb',
  '/models/ghoul_attack2.glb',
  '/models/ghoul_summon.glb',
  '/models/ghoul_death.glb',
  '/models/ghoul_impact.glb',
  '/models/ghoul_leap.glb',
];

const GHOUL_DEFERRED_PATHS = {
  Run: '/models/ghoul_run.glb',
  Attack: '/models/ghoul_attack.glb',
  Attack2: '/models/ghoul_attack2.glb',
  Summon: '/models/ghoul_summon.glb',
  Death: '/models/ghoul_death.glb',
  Impact: '/models/ghoul_impact.glb',
  Leap: '/models/ghoul_leap.glb',
} as const;

export function preloadGhoulModels(): void {
  preloadSkinnedIdleAndAnimationClips(GHOUL_IDLE_PATH, GHOUL_MODEL_PATHS, useGLTF.preload);
}

let _cachedAnimations: AnimationClip[] | null = null;

const SCALE = 0.014;

export default React.memo(function GhoulModel({
  isWalking,
  isAttacking,
  attackVariant,
  isSummoning,
  isDying,
  isLeaping = false,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  scaleMultiplier = 1,
}: GhoulModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(GHOUL_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(GHOUL_DEFERRED_PATHS);
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
        console.warn('Failed to load ghoul animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow    = false;
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
    const hasAllDeferred = Object.keys(GHOUL_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) return idleClips;
    if (_cachedAnimations) return _cachedAnimations;

    _cachedAnimations = [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Run, 'Run').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Attack, 'Attack'),
      ...renameAnimationClips(extraAnims.Attack2, 'Attack2'),
      ...renameAnimationClips(extraAnims.Summon, 'Summon'),
      ...renameAnimationClips(extraAnims.Death, 'Death'),
      ...renameAnimationClips(extraAnims.Impact, 'Impact'),
      ...renameAnimationClips(extraAnims.Leap, 'Leap').map(stripRootMotionXZ),
    ];
    return _cachedAnimations;
  }, [idleAnims, extraAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Summon' | 'Death' | 'Impact' | 'Leap'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Summon > Leap > Attack > Impact > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isSummoning
        ? getAction('Summon')
        : isLeaping
          ? getAction('Leap')
          : isAttacking
            ? getAction(attackClip)
            : isImpacting
              ? getAction('Impact')
              : isWalking
                ? getAction('Run')
                : getAction('Idle');

    const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
    if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
    } else {
      lastImpactPlayKeyRef.current = -1;
    }

    const oneShot = !!(isDying || isLeaping || isSummoning || isAttacking || isImpacting);
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: oneShot,
      clampWhenFinished: oneShot,
      fadeIn: isLeaping ? 0.1 : isDying ? 0.15 : 0.2,
      fadeOut: isLeaping ? 0.1 : 0.2,
      forceRestart: retriggerImpact,
    });
  }, [isWalking, isAttacking, attackVariant, isSummoning, isDying, isLeaping, isImpacting, impactPlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (summon, attack, impact) finishes, blend back to Run or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }
      if (name === 'Summon' || name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE * scaleMultiplier, SCALE * scaleMultiplier, SCALE * scaleMultiplier]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
