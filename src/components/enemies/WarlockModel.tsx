'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, WARLOCK_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';

interface WarlockModelProps {
  isWalking: boolean;
  isBlinking: boolean;
  isLaunching: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

type WarlockClip = 'Idle' | 'Walk' | 'Blink' | 'Launch' | 'Death' | 'Impact';
type WarlockDeferredClip = Exclude<WarlockClip, 'Idle'>;

const WARLOCK_IDLE_PATH = '/models/warlock_idle.glb';

const WARLOCK_MODEL_PATHS = [
  WARLOCK_IDLE_PATH,
  '/models/warlock_walk.glb',
  '/models/warlock_blink.glb',
  '/models/warlock_launch.glb',
  '/models/warlock_death.glb',
  '/models/warlock_impact.glb',
];

const WARLOCK_DEFERRED_PATHS: Record<WarlockDeferredClip, string> = {
  Walk: '/models/warlock_walk.glb',
  Blink: '/models/warlock_blink.glb',
  Launch: '/models/warlock_launch.glb',
  Death: '/models/warlock_death.glb',
  Impact: '/models/warlock_impact.glb',
};

export function preloadWarlockModels(): void {
  preloadSkinnedIdleAndAnimationClips(WARLOCK_IDLE_PATH, WARLOCK_MODEL_PATHS, useGLTF.preload);
}

const SCALE = 0.0125;

export default React.memo(function WarlockModel({
  isWalking,
  isBlinking,
  isLaunching,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: WarlockModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const extraActionsRef = useRef<Partial<Record<WarlockDeferredClip, AnimationAction>>>({});
  const lastImpactPlayKeyRef = useRef(-1);
  const isMountedRef = useRef(true);
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<WarlockDeferredClip, AnimationClip[]>>
  >({});

  const { scene, animations: idleAnims } = useGLTF(WARLOCK_IDLE_PATH);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load all deferred clips once on mount so Walk/Blink/etc. are ready without
  // ever changing the useAnimations clip list (which would stop Idle).
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WARLOCK_DEFERRED_PATHS) as [WarlockDeferredClip, string][];
    void Promise.all(
      entries.map(async ([name, path]) => {
        const clips = await loadGltfAnimationClips(path);
        return [name, clips] as const;
      }),
    )
      .then((loaded) => {
        if (cancelled || !isMountedRef.current) return;
        setDeferredAnimationClips(Object.fromEntries(loaded));
      })
      .catch((error) => {
        console.warn('Failed to load warlock animations:', error);
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
    applySelfIllumination(clone, { intensity: WARLOCK_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  // Only Idle goes through useAnimations — stable so deferred loads never
  // trigger stopAllAction / uncache and leave the unit in bind pose.
  const idleClips = useMemo(() => {
    const processed = getCachedProcessedClips('warlock-idle', idleAnims, {
      stripRootMotion: true,
      renameTo: 'Idle',
    });
    return processed.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [idleAnims, clonedScene]);

  const { actions: idleActions, mixer } = useAnimations(idleClips, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  // Register deferred clips on the mixer as they finish loading.
  useEffect(() => {
    if (!mixer || !sceneGroupRef.current) return;

    const root = sceneGroupRef.current;

    const registerClip = (
      name: WarlockDeferredClip,
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

    registerClip('Walk', deferredAnimationClips.Walk, 'warlock-walk', { stripRootMotion: true, renameTo: 'Walk' });
    registerClip('Blink', deferredAnimationClips.Blink, 'warlock-blink', { renameTo: 'Blink' });
    registerClip('Launch', deferredAnimationClips.Launch, 'warlock-launch', { renameTo: 'Launch' });
    registerClip('Death', deferredAnimationClips.Death, 'warlock-death', { renameTo: 'Death' });
    registerClip('Impact', deferredAnimationClips.Impact, 'warlock-impact', { renameTo: 'Impact' });
  }, [deferredAnimationClips, mixer]);

  const getAction = (name: WarlockClip): AnimationAction | null =>
    idleActions[name] ?? extraActionsRef.current[name as WarlockDeferredClip] ?? null;

  const resolveIdle = useCallback(() => getAction('Idle'), [idleActions]); // eslint-disable-line react-hooks/exhaustive-deps
  const posed = useEnemyIdlePose({
    actions: idleActions,
    mixer,
    currentActionRef,
    resolveIdle,
  });

  // Priority: Death > Launch > Blink > Impact > Walk > Idle
  useEffect(() => {
    if (!idleActions) return;

    const desiredAction = isDying
      ? getAction('Death')
      : isLaunching
        ? getAction('Launch')
        : isBlinking
          ? getAction('Blink')
          : isImpacting
            ? getAction('Impact')
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    // Deferred clip may still be loading — keep Idle rather than freezing in bind pose.
    const nextAction = desiredAction ?? getAction('Idle');
    if (!nextAction) return;

    const retriggerImpact = isImpacting && !!desiredAction && impactPlayKey !== lastImpactPlayKeyRef.current;
    if (isImpacting && desiredAction) lastImpactPlayKeyRef.current = impactPlayKey;
    if (!isImpacting) lastImpactPlayKeyRef.current = -1;

    const isOneShot = !!(desiredAction && (isDying || isLaunching || isBlinking || isImpacting));
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isOneShot,
      clampWhenFinished: isOneShot,
      fadeIn: isDying && desiredAction ? 0.15 : 0.2,
      fadeOut: 0.2,
      forceRestart: retriggerImpact,
    });
  }, [isWalking, isBlinking, isLaunching, isDying, isImpacting, impactPlayKey, idleActions, deferredAnimationClips, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = (isWalking ? getAction('Walk') : getAction('Idle')) ?? getAction('Idle');
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
      if (name === 'Blink' || name === 'Launch') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, idleActions, deferredAnimationClips, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
