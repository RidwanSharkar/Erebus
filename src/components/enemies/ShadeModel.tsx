'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { applySelfIllumination, SHADE_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  filterAnimationClipsForRoot,
  getCachedEnemyAnimationClips,
  invalidateEnemyAnimationClipCache,
  peekEnemyAnimationClipCache,
  renameAnimationClips,
  stripRootMotionXZ,
} from '@/utils/enemyAnimationClipCache';

interface ShadeModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isBlinking: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const SHADE_IDLE_PATH = '/models/shade_idle.glb';

const SHADE_MODEL_PATHS = [
  SHADE_IDLE_PATH,
  '/models/shade_walk.glb',
  '/models/shade_throw.glb',
  '/models/shade_death.glb',
  '/models/shade_impact.glb',
];

const SHADE_DEFERRED_PATHS = {
  Walk: '/models/shade_walk.glb',
  Throw: '/models/shade_throw.glb',
  Death: '/models/shade_death.glb',
  Impact: '/models/shade_impact.glb',
} as const;

export function preloadShadeModels(): void {
  preloadSkinnedIdleAndAnimationClips(SHADE_IDLE_PATH, SHADE_MODEL_PATHS, useGLTF.preload);
}

// Doubled from the knight baseline (0.0135) since the shade GLB geometry
// is smaller than the knight's — this brings it to a similar in-world size.
const SCALE = 0.0375;

export default React.memo(function ShadeModel({
  isWalking,
  isAttacking,
  isBlinking: _isBlinking,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: ShadeModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SHADE_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SHADE_DEFERRED_PATHS);
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
        console.warn('Failed to load shade animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clone + own materials so a dying shade's fade-out doesn't affect other instances.
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
    applySelfIllumination(clone, { intensity: SHADE_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(SHADE_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) {
      return filterAnimationClipsForRoot(clonedScene, idleClips);
    }

    // Recover from a session cache that was poisoned before Walk/Throw/etc. loaded.
    const cached = peekEnemyAnimationClipCache('shade');
    if (cached && !cached.some((clip) => clip.name === 'Walk')) {
      invalidateEnemyAnimationClipCache('shade');
    }

    return filterAnimationClipsForRoot(
      clonedScene,
      getCachedEnemyAnimationClips('shade', () => [
        ...idleClips,
        ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(extraAnims.Throw, 'Throw'),
        ...renameAnimationClips(extraAnims.Death, 'Death'),
        ...renameAnimationClips(extraAnims.Impact, 'Impact'),
      ]),
    );
  }, [idleAnims, extraAnims, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Throw' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Throw > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction('Throw')
        : isImpacting
          ? getAction('Impact')
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction) return;

    const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
    if (isImpacting) lastImpactPlayKeyRef.current = impactPlayKey;
    if (!isImpacting) lastImpactPlayKeyRef.current = -1;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || isAttacking || isImpacting),
      clampWhenFinished: !!(isDying || isAttacking || isImpacting),
      fadeIn: isDying ? 0.15 : 0.2,
      fadeOut: isDying ? 0.15 : 0.2,
      forceRestart: retriggerImpact,
    });
  }, [isWalking, isAttacking, isDying, isImpacting, impactPlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (throw, impact) finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        blendToWalkOrIdle();
        return;
      }
      if (name === 'Throw') {
        blendToWalkOrIdle();
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
