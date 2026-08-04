'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { peek as suspendPeek } from 'suspend-react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadGltfAnimationClips } from '@/utils/gltfAnimationLoader';
import { KNIGHT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';

export type KnightAbilityClip = 'Smite' | 'Aggro' | 'Cast' | 'Spin' | 'StartBlock' | 'IdleBlock';

function isBlockAbilityClip(
  clip: KnightAbilityClip | null | undefined,
): clip is 'StartBlock' | 'IdleBlock' {
  return clip === 'StartBlock' || clip === 'IdleBlock';
}

interface KnightModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  soulType?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
  /** When true, use fast walk clip regardless of soulType (e.g. allied knight with Abyssal Initiate). */
  forceFastWalk?: boolean;
  /** Multiplier applied to the base model scale (e.g. Boss1 elite knights). */
  scaleMultiplier?: number;
  castShadow?: boolean;
  /** Which ability animation is currently playing, or null when none. */
  abilityClip?: KnightAbilityClip | null;
  /** Incremented to restart the current ability clip mid-channel (Storm Lash zaps). */
  abilityPlayKey?: number;
  /** Hit-react one-shots when damage is taken (renderer sets gates). */
  isImpacting?: boolean;
  impactVariant?: 1 | 2;
  /** Incremented on each qualifying hit so the mixer can restart mid-clip. */
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  /** StartBlock finished — renderer transitions to IdleBlock hold phase. */
  onBlockStartFinished?: () => void;
}

// Load mesh + skeleton from the "with skin" idle export.
// Walk/Attack are loaded separately so each clip lives in its own single-scene
// GLB — avoiding the multi-scene node-index confusion that gltf-transform merge
// introduces when the animations target bones from different scene subtrees.
const KNIGHT_MODEL_PATHS = [
  '/models/knight_idle.glb',
  '/models/knight_walk.glb',
  '/models/knight_walk0.glb',
  '/models/knight_attack.glb',
  '/models/knight_attack2.glb',
  '/models/knight_death.glb',
  '/models/knight_smite.glb',
  '/models/knight_aggro.glb',
  '/models/knight_cast.glb',
  '/models/knight_spin.glb',
  '/models/knight_startblock.glb',
  '/models/knight_idleblock.glb',
  '/models/knight_impact1.glb',
  '/models/knight_impact2.glb',
];

type KnightDeferredAnimationName =
  | 'Walk'
  | 'Attack'
  | 'Attack2'
  | 'Death'
  | 'Smite'
  | 'Aggro'
  | 'Cast'
  | 'Spin'
  | 'StartBlock'
  | 'IdleBlock'
  | 'Impact1'
  | 'Impact2';

const KNIGHT_DEFERRED_MODEL_PATHS: Record<Exclude<KnightDeferredAnimationName, 'Walk'>, string> = {
  Attack: '/models/knight_attack.glb',
  Attack2: '/models/knight_attack2.glb',
  Death: '/models/knight_death.glb',
  Smite: '/models/knight_smite.glb',
  Aggro: '/models/knight_aggro.glb',
  Cast: '/models/knight_cast.glb',
  Spin: '/models/knight_spin.glb',
  StartBlock: '/models/knight_startblock.glb',
  IdleBlock: '/models/knight_idleblock.glb',
  Impact1: '/models/knight_impact1.glb',
  Impact2: '/models/knight_impact2.glb',
};

export function preloadKnightModels(): void {
  useGLTF.preload('/models/knight_idle.glb');
  preloadGltfAnimationClips(KNIGHT_MODEL_PATHS.filter(path => path !== '/models/knight_idle.glb'));
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

/** Warm all knight GLBs so the model is ready when the 2nd room loads. */
export async function warmupKnightModels(): Promise<void> {
  try {
    await waitForGltfUrl('/models/knight_idle.glb');
    await Promise.all(
      KNIGHT_MODEL_PATHS
        .filter(p => p !== '/models/knight_idle.glb')
        .map(p => loadGltfAnimationClips(p).then(() => undefined as void).catch(() => {})),
    );
  } catch (e) {
    console.warn('Knight warmup failed:', e);
  }
}

// GLB geometry is in centimeters (bboxMax Y ≈ 172.5 cm).
// Target ≈ 2 game units tall → 2 / 172.5 ≈ 0.0116
const SCALE = 0.015;

export default React.memo(function KnightModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  soulType,
  forceFastWalk = false,
  scaleMultiplier = 1,
  castShadow = true,
  abilityClip,
  abilityPlayKey = 0,
  isImpacting = false,
  impactVariant = 1,
  impactPlayKey = 0,
  onImpactFinished,
  onBlockStartFinished,
}: KnightModelProps) {
  // This ref is the root handed to useAnimations so the mixer can find bones
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const extraActionsRef = useRef<Partial<Record<string, AnimationAction>>>({});
  const isMountedRef = useRef(true);
  const lastImpactPlayKeyRef = useRef(-1);
  const lastAbilityPlayKeyRef = useRef(-1);
  const requestedDeferredStatesRef = useRef<Set<KnightDeferredAnimationName>>(new Set());
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<KnightDeferredAnimationName, AnimationClip[]>>
  >({});

  // Scene (mesh + skeleton) comes from the idle GLB only
  const { scene, animations: idleAnims } = useGLTF('/models/knight_idle.glb');

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // When walk clip source changes (soulType / forceFastWalk), drop cached Walk so the correct GLB reloads.
  useEffect(() => {
    delete extraActionsRef.current.Walk;
    requestedDeferredStatesRef.current.delete('Walk');
    setDeferredAnimationClips((prev) => {
      if (!prev.Walk) return prev;
      const next = { ...prev };
      delete next.Walk;
      return next;
    });
  }, [soulType, forceFastWalk]);

  useEffect(() => {
    // Walk is requested unconditionally (not gated on isWalking) so it starts
    // loading as soon as the knight spawns — most knights start walking almost
    // immediately, and waiting for the first `isWalking` flip left a visible
    // T-pose/Idle gap while the GLB fetched.
    const names = new Set<KnightDeferredAnimationName>(['Walk']);
    if (isDying) names.add('Death');
    if (isAttacking) names.add(attackVariant === 2 ? 'Attack2' : 'Attack');
    if (isBlockAbilityClip(abilityClip)) {
      names.add('StartBlock');
      names.add('IdleBlock');
    } else if (abilityClip) {
      names.add(abilityClip);
    }
    if (isImpacting) names.add(impactVariant === 1 ? 'Impact1' : 'Impact2');

    names.forEach((name) => {
      const path = name === 'Walk'
        ? ((soulType === 'blue' || forceFastWalk) ? '/models/knight_walk.glb' : '/models/knight_walk0.glb')
        : KNIGHT_DEFERRED_MODEL_PATHS[name];
      if (deferredAnimationClips[name] || requestedDeferredStatesRef.current.has(name)) {
        return;
      }

      requestedDeferredStatesRef.current.add(name);
      loadGltfAnimationClips(path)
        .then((clips) => {
          if (!isMountedRef.current) return;
          setDeferredAnimationClips((prev) =>
            prev[name] ? prev : { ...prev, [name]: clips }
          );
        })
        .catch((error) => {
          requestedDeferredStatesRef.current.delete(name);
          console.warn(`Failed to load knight animation ${name}:`, error);
        });
    });
  }, [isWalking, isDying, isAttacking, attackVariant, abilityClip, isImpacting, impactVariant, soulType, forceFastWalk, deferredAnimationClips]);

  // SkeletonUtils.clone() properly re-binds each clone's SkinnedMesh to its own
  // skeleton, so multiple knight instances are fully independent.
  // Materials are shared per type for GPU batching; KnightRenderer death fade
  // calls detachSharedMaterialsForMutation before mutating opacity.
  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, '/models/knight_idle.glb', {
      selfIlluminationIntensity: KNIGHT_SELF_ILLUMINATION_INTENSITY,
      castShadow,
      receiveShadow: true,
    });
  }, [scene, castShadow]);

  useDisposeClonedMaterials(clonedScene);

  // Only Idle goes through useAnimations — it is always loaded and stable.
  // Deferred clips are registered directly on the mixer so loading them never
  // triggers useAnimations cleanup (which would stop the current Idle/Walk).
  const idleClips = useMemo(() => {
    const processed = getCachedProcessedClips('knight-idle', idleAnims, {
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
    const walkPath = (soulType === 'blue' || forceFastWalk) ? 'fast' : 'default';

    const registerClip = (
      name: string,
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

    registerClip('Walk', deferredAnimationClips.Walk, `knight-walk-${walkPath}`, { stripRootMotion: true, renameTo: 'Walk' });
    registerClip('Attack', deferredAnimationClips.Attack, 'knight-attack', { renameTo: 'Attack' });
    registerClip('Attack2', deferredAnimationClips.Attack2, 'knight-attack2', { renameTo: 'Attack2' });
    registerClip('Death', deferredAnimationClips.Death, 'knight-death', { renameTo: 'Death' });
    registerClip('Smite', deferredAnimationClips.Smite, 'knight-smite', { renameTo: 'Smite' });
    registerClip('Aggro', deferredAnimationClips.Aggro, 'knight-aggro', { renameTo: 'Aggro' });
    registerClip('Cast', deferredAnimationClips.Cast, 'knight-cast', { renameTo: 'Cast' });
    registerClip('Spin', deferredAnimationClips.Spin, 'knight-spin', { stripRootMotion: true, renameTo: 'Spin' });
    registerClip('StartBlock', deferredAnimationClips.StartBlock, 'knight-startblock', { stripRootMotion: true, renameTo: 'StartBlock' });
    registerClip('IdleBlock', deferredAnimationClips.IdleBlock, 'knight-idleblock', { stripRootMotion: true, renameTo: 'IdleBlock' });
    registerClip('Impact1', deferredAnimationClips.Impact1, 'knight-impact1', { renameTo: 'Impact1' });
    registerClip('Impact2', deferredAnimationClips.Impact2, 'knight-impact2', { renameTo: 'Impact2' });
  }, [deferredAnimationClips, mixer, soulType, forceFastWalk]);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Death' | 'Smite' | 'Aggro' | 'Cast' | 'Spin' | 'StartBlock' | 'IdleBlock' | 'Impact1' | 'Impact2'): AnimationAction | null =>
    idleActions[name] ?? extraActionsRef.current[name] ?? null;

  const resolveIdle = useCallback(() => getAction('Idle'), [idleActions]); // eslint-disable-line react-hooks/exhaustive-deps
  const posed = useEnemyIdlePose({
    actions: idleActions,
    mixer,
    currentActionRef,
    resolveIdle,
  });

  // Transition to the right animation clip when state changes.
  // Priority: Death > Attack > Ability > Impact > Walk > Idle
  useEffect(() => {
    if (!idleActions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const impactClip = impactVariant === 1 ? 'Impact1' : 'Impact2';
    const desiredAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : abilityClip
          ? getAction(abilityClip)
          : isImpacting
            ? getAction(impactClip)
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    // The desired clip's GLB may still be loading (deferred animations). Fall
    // back to Idle rather than bailing out, so the knight keeps posing instead
    // of freezing in the T-pose bind pose while it waits.
    const usingFallback = !desiredAction;
    const nextAction = desiredAction ?? getAction('Idle');
    if (!nextAction) return;

    // Block clips must not restart when impactPlayKey changes — abilityClip outranks impact
    // and the renderer clears isImpacting on block, but guard here to avoid reset().play().
    const retriggerImpact =
      !usingFallback &&
      !isBlockAbilityClip(abilityClip) &&
      isImpacting &&
      impactPlayKey !== lastImpactPlayKeyRef.current;
    const retriggerAbility =
      !usingFallback &&
      !!abilityClip &&
      !isBlockAbilityClip(abilityClip) &&
      abilityPlayKey !== lastAbilityPlayKeyRef.current;

    if (usingFallback) {
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      playEnemyAction(nextAction, currentActionRef, mixer);
      return;
    }

    if (isDying) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.15,
      });
    } else if (abilityClip === 'StartBlock') {
      lastImpactPlayKeyRef.current = impactPlayKey;
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: false,
        forceRestart: true,
      });
    } else if (abilityClip === 'IdleBlock') {
      lastImpactPlayKeyRef.current = impactPlayKey;
      playEnemyAction(nextAction, currentActionRef, mixer, { forceRestart: true });
    } else if (isAttacking || abilityClip) {
      if (abilityClip) lastAbilityPlayKeyRef.current = abilityPlayKey;
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        forceRestart: retriggerAbility,
      });
    } else if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        forceRestart: retriggerImpact,
      });
    } else {
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      if (!abilityClip) lastAbilityPlayKeyRef.current = -1;
      playEnemyAction(nextAction, currentActionRef, mixer);
    }
  }, [isWalking, isAttacking, isDying, attackVariant, abilityClip, abilityPlayKey, isImpacting, impactVariant, impactPlayKey, idleActions, deferredAnimationClips, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a one-shot animation (impact, attack, or ability) finishes, blend back to Walk or Idle.
  // Do not run for Death — the corpse should stay in the last pose.
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
      if (name === 'Impact1' || name === 'Impact2') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        blendToWalkOrIdle();
        return;
      }
      if (name === 'StartBlock') {
        onBlockStartFinished?.();
        return;
      }
      if (name === 'Attack' || name === 'Attack2' || name === 'Smite' || name === 'Aggro' || name === 'Cast' || name === 'Spin') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, idleActions, deferredAnimationClips, onImpactFinished, onBlockStartFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // sceneGroupRef wraps the clone so the AnimationMixer can traverse into the
    // bone hierarchy. The scale group converts cm → game units.
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={[SCALE * scaleMultiplier, SCALE * scaleMultiplier, SCALE * scaleMultiplier]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});

