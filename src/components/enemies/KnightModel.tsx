'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { peek as suspendPeek } from 'suspend-react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadGltfAnimationClips } from '@/utils/gltfAnimationLoader';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

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
  StartBlock: '/models/knight_cast.glb',
  IdleBlock: '/models/knight_cast.glb',
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
  const hasKickedIdleRef = useRef(false);
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
  // Plain scene.clone(true) shares the skeleton across all instances, causing
  // all models to collapse to the same world position.
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = true;
        // SkeletonUtils.clone() re-binds skeletons but leaves Material references
        // shared across all instances (Object3D.clone() is shallow for materials).
        // The death fade-out in KnightRenderer mutates mat.opacity directly, so
        // each instance MUST own its own material objects or one dying knight will
        // make every other knight on the map invisible simultaneously.
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [scene, castShadow]);

  useDisposeClonedMaterials(clonedScene);

  // Only Idle goes through useAnimations — it is always loaded and stable.
  // Deferred clips are registered directly on the mixer so loading them never
  // triggers useAnimations cleanup (which would stop the current Idle/Walk).
  const idleClips = useMemo(
    () => getCachedProcessedClips('knight-idle', idleAnims, { stripRootMotion: true, renameTo: 'Idle' }),
    [idleAnims],
  );

  const { actions: idleActions, mixer } = useAnimations(idleClips, sceneGroupRef);

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
        extraActionsRef.current[name] = mixer.clipAction(clip, root);
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

  // Kick Idle before first paint so the knight never flashes T-pose on spawn.
  useLayoutEffect(() => {
    const idle = idleActions.Idle;
    if (!idle || hasKickedIdleRef.current) return;
    hasKickedIdleRef.current = true;
    idle.enabled = true;
    idle.setLoop(LoopRepeat, Infinity);
    idle.play();
    currentActionRef.current = idle;
  }, [idleActions]);

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
    if (nextAction === currentActionRef.current) {
      // Block clips must not restart when impactPlayKey changes — abilityClip outranks impact
      // and the renderer clears isImpacting on block, but guard here to avoid reset().play().
      const retriggerImpact =
        !isBlockAbilityClip(abilityClip) &&
        isImpacting &&
        impactPlayKey !== lastImpactPlayKeyRef.current;
      const retriggerAbility =
        !!abilityClip &&
        !isBlockAbilityClip(abilityClip) &&
        abilityPlayKey !== lastAbilityPlayKeyRef.current;
      if (!retriggerImpact && !retriggerAbility) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (usingFallback) {
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    } else if (isDying) {
      // Death is a one-shot that clamps on its last frame (corpse pose).
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (abilityClip === 'StartBlock') {
      // Raise-shield one-shot — IdleBlock follows via onBlockStartFinished.
      lastImpactPlayKeyRef.current = impactPlayKey;
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = false;
      nextAction.reset().fadeIn(0.2).play();
    } else if (abilityClip === 'IdleBlock') {
      // Hold shield idly for the remainder of the block window.
      lastImpactPlayKeyRef.current = impactPlayKey;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    } else if (isAttacking || abilityClip) {
      // Attack and ability animations are one-shot — always restart from frame 0.
      if (abilityClip) {
        lastAbilityPlayKeyRef.current = abilityPlayKey;
      }
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      // Walk / Idle are continuous loops.
      // Re-enable explicitly: Three.js auto-disables actions whose weight reaches 0
      // after a fadeOut (_updateWeight sets enabled=false).
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      if (!abilityClip) lastAbilityPlayKeyRef.current = -1;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, attackVariant, abilityClip, abilityPlayKey, isImpacting, impactVariant, impactPlayKey, idleActions, deferredAnimationClips]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a one-shot animation (impact, attack, or ability) finishes, blend back to Walk or Idle.
  // Do not run for Death — the corpse should stay in the last pose.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback) {
        fallback.enabled = true;
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.fadeIn(0.15).play();
        currentActionRef.current = fallback;
      }
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
    <group ref={sceneGroupRef}>
      <group scale={[SCALE * scaleMultiplier, SCALE * scaleMultiplier, SCALE * scaleMultiplier]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});

