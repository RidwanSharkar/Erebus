'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { peek as suspendPeek } from 'suspend-react';
import { GLTFLoader } from 'three-stdlib';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, AnimationMixer, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadAllGltfAnimationClips, loadGltfAnimationClips } from '@/utils/gltfAnimationLoader';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

export type AnimState =
  | 'Idle' | 'Run' | 'Walk' | 'WalkBack' | 'WalkLeft' | 'WalkRight' | 'Backwards'
  | 'LeftStrafe' | 'RightStrafe'
  | 'Jump' | 'JumpFront' | 'JumpBack'
  | 'Cast' | 'CastSingle' | 'SwordCast' | 'DrawBow' | 'ReleaseBow'
  | 'Death';

interface CharacterModelProps {
  animState: AnimState;
  isDead?: boolean;
}

type CharacterDeferredAnimState = keyof typeof CHARACTER_DEFERRED_MODEL_PATHS;
type CharacterDeferredClips = Record<CharacterDeferredAnimState, AnimationClip[]>;

const CHARACTER_INITIAL_MODEL_PATHS = [
  '/models/character_idle.glb',
  '/models/character_run.glb',
  '/models/character_walk.glb',
  '/models/character_walkBack.glb',
  '/models/character_walkLeft.glb',
  '/models/character_walkRight.glb',
  '/models/character_backwards.glb',
  '/models/character_leftStrafe.glb',
  '/models/character_rightStrafe.glb',
] as const;

const CHARACTER_DEFERRED_MODEL_PATHS = {
  Jump: '/models/character_jump.glb',
  JumpFront: '/models/character_jumpFront.glb',
  Cast: '/models/character_cast.glb',
  CastSingle: '/models/character_castSingle.glb',
  SwordCast: '/models/character_swordCast.glb',
  DrawBow: '/models/character_drawBow.glb',
  ReleaseBow: '/models/character_releaseBow.glb',
  Death: '/models/character_death.glb',
} as const satisfies Partial<Record<AnimState, string>>;

const CHARACTER_DEFERRED_ANIMATION_PATHS = Object.values(CHARACTER_DEFERRED_MODEL_PATHS);

const CHARACTER_EXTRA_ANIMATION_PATHS = [
  '/models/character_dash.glb',
] as const;

function loadAllCharacterDeferredClips(): Promise<CharacterDeferredClips> {
  return loadAllGltfAnimationClips(CHARACTER_DEFERRED_MODEL_PATHS);
}

export function preloadCharacterModels(): void {
  CHARACTER_INITIAL_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
  [...CHARACTER_DEFERRED_ANIMATION_PATHS, ...CHARACTER_EXTRA_ANIMATION_PATHS].forEach((path) => {
    void loadGltfAnimationClips(path).catch((error) => {
      console.warn(`Failed to preload character animation ${path}:`, error);
    });
  });
}

/**
 * Peek key must match @react-three/drei useGLTF: useLoader(three-stdlib GLTFLoader, url, extensions).
 */
const fiberCharacterGltfPeekKey = (url: string): [typeof GLTFLoader, string] => [GLTFLoader, url];

/**
 * Ensures Fiber's suspend-react cache is populated before `CharacterModel` mounts.
 * Drei's useGLTF.preload is fire-and-forget; we poll `suspend-react`'s `peek` until each GLB resolves.
 */
function waitForFiberGltfCache(url: string, timeoutMs = 45_000): Promise<void> {
  useGLTF.preload(url);
  const peekKey = fiberCharacterGltfPeekKey(url);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return new Promise((resolve, reject) => {
    function tick(): void {
      const ready = suspendPeek(peekKey) !== undefined;
      if (ready) {
        resolve();
        return;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - t0 > timeoutMs) {
        reject(new Error(`GLTF warmup timed out (${timeoutMs}ms): ${url}`));
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

/** Warm only `character_idle.glb` — call from scene mount to overlap with socket / gameStarted latency. */
export async function warmupCharacterIdleGltf(): Promise<void> {
  try {
    await waitForFiberGltfCache(CHARACTER_INITIAL_MODEL_PATHS[0]!);
  } catch (e) {
    console.warn('Character idle GLB warmup failed:', e);
  }
}

export async function warmupCharacterLocomotionGltf(): Promise<void> {
  try {
    const idle = CHARACTER_INITIAL_MODEL_PATHS[0]!;
    const run = CHARACTER_INITIAL_MODEL_PATHS[1]!;
    await waitForFiberGltfCache(idle);
    await waitForFiberGltfCache(run);
    await Promise.all([
      ...CHARACTER_INITIAL_MODEL_PATHS.slice(2).map((p) => waitForFiberGltfCache(p)),
      ...CHARACTER_DEFERRED_ANIMATION_PATHS.map((p) => loadGltfAnimationClips(p).then(() => undefined)),
      ...CHARACTER_EXTRA_ANIMATION_PATHS.map((p) => loadGltfAnimationClips(p).then(() => undefined)),
    ]);
  } catch (e) {
    console.warn('Character GLB warmup failed:', e);
  }
}

// Adjust if the character GLB geometry is larger or smaller than expected.
// Standard Mixamo / Character Creator exports at ~200 units tall (cm) → 0.01 gives ~2 world units.
const SCALE = 0.01;

// Fine-tune vertical placement so the character's feet sit flush with the ground.
// Increase (less negative) to raise, decrease (more negative) to lower.
const Y_OFFSET = -0.25;

// Crossfade durations per transition type (seconds).
const FADE_NORMAL = 0.2;
const FADE_JUMP   = 0.15;

/** Drei `useAnimations` lazy `actions[name]` can be undefined before the mixer root ref syncs; bounded retries avoid startup T-pose. */
const MAX_ANIM_APPLY_RETRIES = 15;

/** Non-forward jump clips may not be ready on first airborne frame; avoid idle-in-air while they load. */
const IDLE_FALLBACK_EXCLUDED = new Set<AnimState>(['Jump', 'JumpFront', 'JumpBack']);

/** Jump clips play once then hold the last frame while airborne (prevents bind-pose T-pose). */
const JUMP_CLAMP_ANIMS = IDLE_FALLBACK_EXCLUDED;

function holdJumpEndPoseIfFinished(action: AnimationAction, mixer: AnimationMixer | null | undefined): void {
  const duration = action.getClip().duration;
  if (action.time < duration && action.isRunning()) return;
  action.clampWhenFinished = true;
  action.enabled = true;
  action.setEffectiveWeight(1);
  action.time = duration;
  action.paused = true;
  mixer?.update(0);
}

function stripRootMotionXZ(clip: AnimationClip): AnimationClip {
  clip.tracks = clip.tracks.map(track => {
    if (!track.name.endsWith('.position')) return track;
    if (!track.name.toLowerCase().includes('hips')) return track;
    const values = Float32Array.from(track.values);
    for (let i = 0; i < values.length; i += 3) {
      values[i]     = 0;
      values[i + 2] = 0;
    }
    return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
  });
  return clip;
}

/** Eager-load all deferred clips before mounting the rig so useAnimations never sees a mid-game clips change. */
export default function CharacterModel({ animState, isDead = false }: CharacterModelProps) {
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<CharacterDeferredClips | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAllCharacterDeferredClips()
      .then((clips) => {
        if (!cancelled) setDeferredAnimationClips(clips);
      })
      .catch((error) => {
        console.warn('Failed to load character deferred animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!deferredAnimationClips) return null;

  return (
    <CharacterModelRig
      animState={animState}
      isDead={isDead}
      deferredAnimationClips={deferredAnimationClips}
    />
  );
}

interface CharacterModelRigProps extends CharacterModelProps {
  deferredAnimationClips: CharacterDeferredClips;
}

function CharacterModelRig({
  animState,
  isDead = false,
  deferredAnimationClips,
}: CharacterModelRigProps) {
  const sceneGroupRef   = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const initialPoseAppliedRef = useRef(false);
  const [initialPoseApplied, setInitialPoseApplied] = useState(false);

  const { scene, animations: idleAnims }        = useGLTF('/models/character_idle.glb');
  const { animations: runAnims }                = useGLTF('/models/character_run.glb');
  const { animations: walkAnims }               = useGLTF('/models/character_walk.glb');
  const { animations: walkBackAnims }          = useGLTF('/models/character_walkBack.glb');
  const { animations: walkLeftAnims }         = useGLTF('/models/character_walkLeft.glb');
  const { animations: walkRightAnims }        = useGLTF('/models/character_walkRight.glb');
  const { animations: backAnims }               = useGLTF('/models/character_backwards.glb');
  const { animations: leftAnims }  = useGLTF('/models/character_leftStrafe.glb');
  const { animations: rightAnims } = useGLTF('/models/character_rightStrafe.glb');

  // Clone scene so each instance owns its materials (avoids shared fade / material state).
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
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    return [
      ...rename(idleAnims,           'Idle'          ).map(stripRootMotionXZ),
      ...rename(runAnims,            'Run'           ).map(stripRootMotionXZ),
      ...rename(walkAnims,           'Walk'          ).map(stripRootMotionXZ),
      ...rename(walkBackAnims,       'WalkBack'      ).map(stripRootMotionXZ),
      ...rename(walkLeftAnims,       'WalkLeft'      ).map(stripRootMotionXZ),
      ...rename(walkRightAnims,      'WalkRight'     ).map(stripRootMotionXZ),
      ...rename(backAnims,           'Backwards'     ).map(stripRootMotionXZ),
      ...rename(leftAnims,  'LeftStrafe' ).map(stripRootMotionXZ),
      ...rename(rightAnims, 'RightStrafe').map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Jump,       'Jump'       ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.JumpFront,  'JumpFront'  ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Jump,       'JumpBack'   ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Cast,       'Cast'       ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.CastSingle, 'CastSingle' ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.SwordCast,  'SwordCast'  ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.DrawBow,    'DrawBow'    ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.ReleaseBow, 'ReleaseBow' ).map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Death,      'Death'      ).map(stripRootMotionXZ),
    ];
  }, [idleAnims, runAnims, walkAnims, walkBackAnims, walkLeftAnims, walkRightAnims, backAnims, leftAnims, rightAnims, deferredAnimationClips]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  // When the player dies, force the Death animation immediately and ignore
  // subsequent animState changes so nothing overrides the death pose.
  const deathTriggeredRef = useRef(false);

  useLayoutEffect(() => {
    if (!actions) return;

    let rafId = 0;
    let retryCount = 0;

    const clipRegistered = (name: AnimState): boolean =>
      animations.some((c) => c.name === name);

    const revealAfterFirstPose = (): void => {
      if (initialPoseAppliedRef.current) return;
      initialPoseAppliedRef.current = true;
      setInitialPoseApplied(true);
    };

    const scheduleRetry = (apply: () => void): boolean => {
      if (retryCount >= MAX_ANIM_APPLY_RETRIES) return false;
      retryCount += 1;
      rafId = requestAnimationFrame(apply);
      return true;
    };

    const fadeOutCurrentAction = (fadeOut: number): void => {
      if (!currentActionRef.current) return;
      currentActionRef.current.fadeOut(fadeOut);
    };

    const apply = (): void => {
      if (!actions) return;

      if (isDead && !deathTriggeredRef.current) {
        const deathAction = actions['Death'] ?? null;
        if (deathAction) {
          deathTriggeredRef.current = true;
          fadeOutCurrentAction(FADE_NORMAL);
          deathAction.enabled = true;
          deathAction.setLoop(LoopOnce, 1);
          deathAction.clampWhenFinished = true;
          deathAction.reset().fadeIn(FADE_NORMAL).play();
          currentActionRef.current = deathAction;
          mixer?.update(0.016);
          revealAfterFirstPose();
          return;
        }
        if (clipRegistered('Death') && scheduleRetry(apply)) return;
        return;
      }

      // Block any animation changes once death has been triggered.
      if (deathTriggeredRef.current) return;

      const useIdleFallback =
        animState !== 'Idle' &&
        !clipRegistered(animState) &&
        !IDLE_FALLBACK_EXCLUDED.has(animState);
      const playAnim: AnimState = useIdleFallback ? 'Idle' : animState;
      const nextAction = actions[playAnim] ?? null;

      if (!nextAction) {
        if (clipRegistered(animState) && scheduleRetry(apply)) return;
        // Hold the last valid pose — never expose bind pose while waiting for action registration.
        return;
      }

      if (nextAction === currentActionRef.current) {
        if (JUMP_CLAMP_ANIMS.has(playAnim)) {
          holdJumpEndPoseIfFinished(nextAction, mixer);
        }
        return;
      }

      const isInitialAction = currentActionRef.current === null;
      const fadeOut = playAnim === 'Jump' ? FADE_JUMP : FADE_NORMAL;
      const fadeIn  = fadeOut;

      nextAction.enabled = true;

      const configureNextAction = (): void => {
        if (JUMP_CLAMP_ANIMS.has(playAnim)) {
          nextAction.setLoop(LoopOnce, 1);
          nextAction.clampWhenFinished = true;
        } else if (playAnim === 'ReleaseBow') {
          nextAction.setLoop(LoopOnce, 1);
          nextAction.clampWhenFinished = false;
        } else if (playAnim === 'CastSingle') {
          nextAction.setLoop(LoopOnce, 1);
          nextAction.clampWhenFinished = true;
        } else {
          nextAction.setLoop(LoopRepeat, Infinity);
          nextAction.clampWhenFinished = false;
        }
      };

      if (isInitialAction) {
        configureNextAction();
        nextAction.reset();
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(1);
        nextAction.play();
        currentActionRef.current = nextAction;
        mixer?.update(0.016);
        revealAfterFirstPose();
        return;
      }

      if (JUMP_CLAMP_ANIMS.has(playAnim)) {
        nextAction.setLoop(LoopOnce, 1);
        nextAction.clampWhenFinished = true;
        fadeOutCurrentAction(fadeOut);
        nextAction.reset().fadeIn(fadeIn).play();
      } else if (playAnim === 'ReleaseBow') {
        nextAction.setLoop(LoopOnce, 1);
        nextAction.clampWhenFinished = false;
        fadeOutCurrentAction(fadeOut);
        nextAction.reset().fadeIn(fadeIn).play();
      } else if (playAnim === 'CastSingle') {
        nextAction.setLoop(LoopOnce, 1);
        nextAction.clampWhenFinished = true;
        fadeOutCurrentAction(fadeOut);
        nextAction.reset().fadeIn(fadeIn).play();
      } else if (playAnim === 'Cast' || playAnim === 'SwordCast' || playAnim === 'DrawBow') {
        // Always restart so the cast clip plays from the beginning on each new hold.
        nextAction.setLoop(LoopRepeat, Infinity);
        fadeOutCurrentAction(fadeOut);
        nextAction.reset().fadeIn(fadeIn).play();
      } else {
        nextAction.setLoop(LoopRepeat, Infinity);
        fadeOutCurrentAction(fadeOut);
        nextAction.fadeIn(fadeIn).play();
      }

      currentActionRef.current = nextAction;
      mixer?.update(0.016);
      revealAfterFirstPose();
    };

    apply();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [animState, isDead, actions, mixer, animations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset death flag when the component is re-mounted (e.g. after respawn).
  useEffect(() => {
    deathTriggeredRef.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} position-y={Y_OFFSET} visible={initialPoseApplied}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
