'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationClipsForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface WeaverModelProps {
  isWalking: boolean;
  isCastingHeal: boolean;
  /** When true, CastHeal clips loop until `isCastingHeal` clears. */
  castHealLoop?: boolean;
  /** When true, CastHeal plays once and freezes on the last frame while `isCastingHeal` stays true. */
  castHealHoldEnd?: boolean;
  isCastingSummon: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const WEAVER_IDLE_PATH = '/models/weaver_idle.glb';

const WEAVER_MODEL_PATHS = [
  WEAVER_IDLE_PATH,
  '/models/weaver_walk.glb',
  '/models/weaver_castheal.glb',
  '/models/weaver_castsummon.glb',
  '/models/weaver_death.glb',
  '/models/weaver_impact.glb',
];

const WEAVER_DEFERRED_PATHS = {
  Walk: '/models/weaver_walk.glb',
  CastHeal: '/models/weaver_castheal.glb',
  CastSummon: '/models/weaver_castsummon.glb',
  Death: '/models/weaver_death.glb',
  Impact: '/models/weaver_impact.glb',
} as const;

export function preloadWeaverModels(): void {
  preloadSkinnedIdleAndAnimationClips(WEAVER_IDLE_PATH, WEAVER_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.01235;

export default React.memo(function WeaverModel({
  isWalking,
  isCastingHeal,
  castHealLoop = false,
  castHealHoldEnd = false,
  isCastingSummon,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: WeaverModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(WEAVER_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WEAVER_DEFERRED_PATHS);
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
        console.warn('Failed to load weaver animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow    = true;
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

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(WEAVER_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) {
      return filterAnimationClipsForRoot(clonedScene, idleClips);
    }
    return filterAnimationClipsForRoot(
      clonedScene,
      getCachedEnemyAnimationClips('weaver', () => [
        ...idleClips,
        ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(extraAnims.CastHeal, 'CastHeal'),
        ...renameAnimationClips(extraAnims.CastSummon, 'CastSummon'),
        ...renameAnimationClips(extraAnims.Death, 'Death'),
        ...renameAnimationClips(extraAnims.Impact, 'Impact'),
      ]),
    );
  }, [idleAnims, extraAnims, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'CastHeal' | 'CastSummon' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > CastSummon > CastHeal > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isCastingSummon
        ? getAction('CastSummon')
        : isCastingHeal
          ? getAction('CastHeal')
          : isImpacting
            ? getAction('Impact')
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    if (!nextAction) return;

    const sameClip = nextAction === currentActionRef.current;
    const sameAndAlive = sameClip && nextAction.isRunning() && nextAction.getEffectiveWeight() > 0;
    const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
    if (sameAndAlive) {
      if (isCastingHeal && castHealHoldEnd && getAction('CastHeal') === nextAction) {
        return;
      }
      if (isCastingHeal && castHealLoop && getAction('CastHeal') === nextAction) {
        nextAction.setLoop(LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
        if (!nextAction.isRunning()) nextAction.play();
        return;
      }
      if (!retriggerImpact) return;
    }

    if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
    } else {
      lastImpactPlayKeyRef.current = -1;
    }

    if (isDying) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.15,
        forceRestart: retriggerImpact,
      });
    } else if (isCastingSummon) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        forceRestart: retriggerImpact,
      });
    } else if (isCastingHeal) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: !castHealLoop,
        clampWhenFinished: castHealHoldEnd || !castHealLoop,
        forceRestart: retriggerImpact,
      });
    } else if (isImpacting) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        forceRestart: retriggerImpact,
      });
    } else {
      playEnemyAction(nextAction, currentActionRef, mixer);
    }
  }, [isWalking, isCastingHeal, castHealLoop, castHealHoldEnd, isCastingSummon, isDying, isImpacting, impactPlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (name === 'CastHeal' || name === 'CastSummon') {
        if (name === 'CastHeal' && (castHealLoop || castHealHoldEnd)) return;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isCastingHeal, castHealLoop, castHealHoldEnd, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
