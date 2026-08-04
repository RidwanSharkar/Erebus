'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { AnimationAction, AnimationClip, Group } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { peek as suspendPeek } from 'suspend-react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadGltfAnimationClips } from '@/utils/gltfAnimationLoader';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';

/** Greed uses the idle mesh (same as allied healer / merchant NPC) and always plays Walk. */
type GreedClip = 'Idle' | 'Walk' | 'Death' | 'Cast' | 'HealCast' | 'Launch';
export type GreedAbilityClip = 'Cast' | 'HealCast' | 'Launch';

interface GreedModelProps {
  isDying: boolean;
  abilityClip?: GreedAbilityClip | null;
  /** When false, hold Idle instead of the default always-on Walk loop. Defaults to true. */
  isWalking?: boolean;
}

const GREED_MODEL_PATHS = [
  '/models/ally_idle.glb',
  '/models/ally_walk.glb',
  '/models/ally_death.glb',
  '/models/ally_cast.glb',
  '/models/ally_healcast.glb',
  '/models/ally_launch.glb',
];

const GREED_DEFERRED_MODEL_PATHS: Record<Exclude<GreedClip, 'Idle'>, string> = {
  Walk: '/models/ally_walk.glb',
  Death: '/models/ally_death.glb',
  Cast: '/models/ally_cast.glb',
  HealCast: '/models/ally_healcast.glb',
  Launch: '/models/ally_launch.glb',
};

const SCALE = 0.01135;

export function preloadGreedModels(): void {
  useGLTF.preload('/models/ally_idle.glb');
  preloadGltfAnimationClips(GREED_MODEL_PATHS.filter(path => path !== '/models/ally_idle.glb'));
}

function waitForGltfUrl(url: string, timeoutMs = 30_000): Promise<void> {
  useGLTF.preload(url);
  const peekKey: [typeof GLTFLoader, string] = [GLTFLoader, url];
  const t0 = Date.now();
  return new Promise<void>((resolve) => {
    function tick(): void {
      if (suspendPeek(peekKey) !== undefined) { resolve(); return; }
      if (Date.now() - t0 > timeoutMs) { resolve(); return; }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

/** Warm all Greed GLBs so the model is ready the moment a Greed bonus enemy spawns. */
export async function warmupGreedModels(): Promise<void> {
  try {
    await waitForGltfUrl('/models/ally_idle.glb');
    await Promise.all(
      GREED_MODEL_PATHS
        .filter(p => p !== '/models/ally_idle.glb')
        .map(p => loadGltfAnimationClips(p).then(() => undefined as void).catch(() => {})),
    );
  } catch (e) {
    console.warn('Greed warmup failed:', e);
  }
}

export default React.memo(function GreedModel({ isDying, abilityClip, isWalking = true }: GreedModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const extraActionsRef = useRef<Partial<Record<GreedClip, AnimationAction>>>({});
  const isMountedRef = useRef(true);
  const requestedDeferredStatesRef = useRef<Set<Exclude<GreedClip, 'Idle'>>>(new Set());
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<Exclude<GreedClip, 'Idle'>, AnimationClip[]>>
  >({});

  const { scene, animations: idleAnims } = useGLTF('/models/ally_idle.glb');

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const names = new Set<Exclude<GreedClip, 'Idle'>>(['Walk']);
    if (isDying) names.add('Death');
    if (abilityClip) names.add(abilityClip);

    names.forEach((name) => {
      if (deferredAnimationClips[name] || requestedDeferredStatesRef.current.has(name)) return;
      requestedDeferredStatesRef.current.add(name);
      loadGltfAnimationClips(GREED_DEFERRED_MODEL_PATHS[name])
        .then((clips) => {
          if (!isMountedRef.current) return;
          setDeferredAnimationClips(prev => (prev[name] ? prev : { ...prev, [name]: clips }));
        })
        .catch((error) => {
          requestedDeferredStatesRef.current.delete(name);
          console.warn(`Failed to load Greed animation ${name}:`, error);
        });
    });
  }, [isDying, abilityClip, deferredAnimationClips]);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, '/models/ally_idle.glb', {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: true,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  // Idle is always loaded and stable — deferred clips register on the mixer directly
  // so loading Walk never triggers useAnimations cleanup on an empty clip list.
  const idleClips = useMemo(
    () => getCachedProcessedClips('greed-idle', idleAnims, { stripRootMotion: true, renameTo: 'Idle' }),
    [idleAnims],
  );

  const { actions: idleActions, mixer } = useAnimations(idleClips, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  useEffect(() => {
    if (!mixer || !sceneGroupRef.current) return;

    const root = sceneGroupRef.current;

    const registerClip = (
      name: Exclude<GreedClip, 'Idle'>,
      rawClips: AnimationClip[] | undefined,
      cacheKey: string,
      options: { stripRootMotion?: boolean; renameTo?: string } = {},
    ) => {
      if (!rawClips?.length || extraActionsRef.current[name]) return;
      const processed = getCachedProcessedClips(cacheKey, rawClips, options);
      processed.forEach((clip) => {
        extraActionsRef.current[name] = mixer.clipAction(clip, root);
      });
    };

    registerClip('Walk', deferredAnimationClips.Walk, 'greed-walk', { stripRootMotion: true, renameTo: 'Walk' });
    registerClip('Death', deferredAnimationClips.Death, 'greed-death', { renameTo: 'Death' });
    registerClip('Cast', deferredAnimationClips.Cast, 'greed-cast', { renameTo: 'Cast' });
    registerClip('HealCast', deferredAnimationClips.HealCast, 'greed-healcast', { renameTo: 'HealCast' });
    registerClip('Launch', deferredAnimationClips.Launch, 'greed-launch', { renameTo: 'Launch' });
  }, [deferredAnimationClips, mixer]);

  const getAction = (name: GreedClip): AnimationAction | null =>
    idleActions[name] ?? extraActionsRef.current[name] ?? null;

  const resolveIdle = useCallback(() => getAction('Idle'), [idleActions]); // eslint-disable-line react-hooks/exhaustive-deps
  const posed = useEnemyIdlePose({
    actions: idleActions,
    mixer,
    currentActionRef,
    resolveIdle,
  });

  useEffect(() => {
    if (!idleActions) return;
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : (isWalking ? getAction('Walk') : getAction('Idle')) ?? getAction('Idle');
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || abilityClip),
      clampWhenFinished: !!(isDying || abilityClip),
      fadeIn: isDying || abilityClip ? 0.15 : 0.2,
    });
  }, [idleActions, abilityClip, isDying, isWalking, deferredAnimationClips, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;
    const handleFinish = (e: { action: AnimationAction }) => {
      const name = e.action.getClip().name;
      if (name !== 'Cast' && name !== 'HealCast' && name !== 'Launch') return;
      const fallback = (isWalking ? getAction('Walk') : getAction('Idle')) ?? getAction('Idle');
      playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
    };
    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, idleActions, deferredAnimationClips]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
