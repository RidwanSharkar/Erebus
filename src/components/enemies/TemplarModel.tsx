'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

interface TemplarModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isLeaping?: boolean;
  onLeapFinished?: () => void;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  /** Templar Blink Smite wind-up (templar_smite.glb) */
  isBlinkSmite?: boolean;
  blinkSmitePlayKey?: number;
  onBlinkSmiteFinished?: () => void;
}

const TEMPLAR_IDLE_PATH = '/models/templar_idle.glb';

const TEMPLAR_MODEL_PATHS = [
  TEMPLAR_IDLE_PATH,
  '/models/templar_run.glb',
  '/models/templar_attack.glb',
  '/models/templar_attack2.glb',
  '/models/templar_death.glb',
  '/models/templar_impact.glb',
  '/models/templar_smite.glb',
  '/models/templar_leap.glb',
];

const TEMPLAR_DEFERRED_PATHS = {
  Walk: '/models/templar_run.glb',
  Attack: '/models/templar_attack.glb',
  Attack2: '/models/templar_attack2.glb',
  Death: '/models/templar_death.glb',
  Impact: '/models/templar_impact.glb',
  BlinkSmite: '/models/templar_smite.glb',
  Leap: '/models/templar_leap.glb',
} as const;

export function preloadTemplarModels(): void {
  preloadSkinnedIdleAndAnimationClips(TEMPLAR_IDLE_PATH, TEMPLAR_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.01275;

export default React.memo(function TemplarModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  isLeaping = false,
  onLeapFinished,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  isBlinkSmite = false,
  blinkSmitePlayKey = 0,
  onBlinkSmiteFinished,
}: TemplarModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const lastBlinkSmitePlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(TEMPLAR_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(TEMPLAR_DEFERRED_PATHS);
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
        console.warn('Failed to load templar animations:', error);
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

  const animations = useMemo(
    () => [
      ...getCachedProcessedClips('templar-idle', idleAnims, { stripRootMotion: true, renameTo: 'Idle' }),
      ...getCachedProcessedClips('templar-run', extraAnims.Walk ?? [], { stripRootMotion: true, renameTo: 'Walk' }),
      ...getCachedProcessedClips('templar-attack', extraAnims.Attack ?? [], { renameTo: 'Attack' }),
      ...getCachedProcessedClips('templar-attack2', extraAnims.Attack2 ?? [], { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('templar-death', extraAnims.Death ?? [], { renameTo: 'Death' }),
      ...getCachedProcessedClips('templar-impact', extraAnims.Impact ?? [], { renameTo: 'Impact' }),
      ...(extraAnims.BlinkSmite?.length
        ? getCachedProcessedClips('templar-smite', [extraAnims.BlinkSmite[0]], { stripRootMotion: true, renameTo: 'BlinkSmite' })
        : []),
      ...getCachedProcessedClips('templar-leap', extraAnims.Leap ?? [], { stripRootMotion: true, renameTo: 'Leap' }),
    ],
    [idleAnims, extraAnims],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Death' | 'Impact' | 'BlinkSmite' | 'Leap'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Leap > BlinkSmite > Attack > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isLeaping
        ? getAction('Leap')
        : isBlinkSmite
          ? getAction('BlinkSmite')
          : isAttacking
            ? getAction(attackClip)
            : isImpacting
              ? getAction('Impact')
              : isWalking
                ? getAction('Walk')
                : getAction('Idle');

    const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
    const retriggerBlinkSmite = isBlinkSmite && blinkSmitePlayKey !== lastBlinkSmitePlayKeyRef.current;
    if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
    } else {
      lastImpactPlayKeyRef.current = -1;
    }
    if (isBlinkSmite) {
      lastBlinkSmitePlayKeyRef.current = blinkSmitePlayKey;
    } else {
      lastBlinkSmitePlayKeyRef.current = -1;
    }

    const oneShot = !!(isDying || isLeaping || isBlinkSmite || isAttacking || isImpacting);
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: oneShot,
      clampWhenFinished: oneShot,
      fadeIn: isLeaping ? 0.1 : isBlinkSmite ? 0.15 : isDying ? 0.15 : 0.2,
      fadeOut: isLeaping ? 0.1 : 0.2,
      forceRestart: retriggerImpact || retriggerBlinkSmite,
    });
  }, [isWalking, isAttacking, isDying, attackVariant, isLeaping, isImpacting, impactPlayKey, isBlinkSmite, blinkSmitePlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }
      if (name === 'Leap') {
        onLeapFinished?.();
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }
      if (name === 'BlinkSmite') {
        onBlinkSmiteFinished?.();
        lastBlinkSmitePlayKeyRef.current = blinkSmitePlayKey;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished, onBlinkSmiteFinished, onLeapFinished, blinkSmitePlayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
