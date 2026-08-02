import { useEffect, useLayoutEffect, useState, type MutableRefObject } from 'react';
import { AnimationAction, AnimationMixer, LoopOnce, LoopRepeat } from 'three';

/** Drei `useAnimations` lazy `actions[name]` can be undefined before the mixer root ref syncs. */
const MAX_IDLE_POSE_RETRIES = 15;

export interface UseEnemyIdlePoseArgs {
  actions: Record<string, AnimationAction | null | undefined> | null | undefined;
  mixer: AnimationMixer | null | undefined;
  currentActionRef: MutableRefObject<AnimationAction | null>;
  /** Clip name looked up on `actions`. Default `'Idle'`. */
  idleClipName?: string;
  /** Override when idle lives outside `actions` (e.g. Pattern-A extraActionsRef). */
  resolveIdle?: () => AnimationAction | null | undefined;
}

function isLiveAction(action: AnimationAction | null | undefined): boolean {
  return !!action?.isRunning() && action.getEffectiveWeight() > 0;
}

function kickIdlePose(
  resolve: () => AnimationAction | null,
  currentActionRef: MutableRefObject<AnimationAction | null>,
  mixer: AnimationMixer | null | undefined,
): boolean {
  if (isLiveAction(currentActionRef.current)) return true;

  const idle = resolve();
  if (!idle) return false;

  idle.enabled = true;
  idle.setEffectiveWeight(1);
  idle.setLoop(LoopRepeat, Infinity);
  idle.clampWhenFinished = false;
  idle.reset().play();
  currentActionRef.current = idle;
  mixer?.update(0);
  return true;
}

/**
 * Kick the resting clip before first paint so enemies never flash T-pose / bind pose.
 * Re-arms when drei's useAnimations cleanup calls stopAllAction() on a clips change
 * (detected via !currentActionRef.current?.isRunning()).
 *
 * Returns `posed` — drive `visible={posed}` on the root group so bind pose never paints.
 */
export function useEnemyIdlePose({
  actions,
  mixer,
  currentActionRef,
  idleClipName = 'Idle',
  resolveIdle,
}: UseEnemyIdlePoseArgs): boolean {
  const [posed, setPosed] = useState(false);

  const resolve = (): AnimationAction | null => {
    if (resolveIdle) return resolveIdle() ?? null;
    return actions?.[idleClipName] ?? null;
  };

  // Pre-paint kick. Retries while drei's lazy actions[name] is still undefined.
  useLayoutEffect(() => {
    let rafId = 0;
    let retryCount = 0;
    let cancelled = false;

    const kick = (): void => {
      if (cancelled) return;

      if (kickIdlePose(resolve, currentActionRef, mixer)) {
        if (!cancelled) setPosed(true);
        return;
      }

      if (retryCount < MAX_IDLE_POSE_RETRIES) {
        retryCount += 1;
        rafId = requestAnimationFrame(kick);
        return;
      }
      // Safety: never leave the enemy invisible forever.
      if (!cancelled) setPosed(true);
    };

    kick();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // resolveIdle/actions identity changes are intentional re-kick triggers.
  }, [actions, mixer, currentActionRef, idleClipName, resolveIdle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drei's useAnimations cleanup (stopAllAction) runs in useEffect AFTER our layout
  // kick. Re-arm here so a clips-array expansion cannot leave the unit in bind pose.
  useEffect(() => {
    if (kickIdlePose(resolve, currentActionRef, mixer)) {
      setPosed(true);
    }
  }, [actions, mixer, currentActionRef, idleClipName, resolveIdle]); // eslint-disable-line react-hooks/exhaustive-deps

  return posed;
}

export interface PlayEnemyActionOpts {
  /** One-shot that clamps on the last frame (death / hold pose). */
  loopOnce?: boolean;
  clampWhenFinished?: boolean;
  fadeOut?: number;
  fadeIn?: number;
  /** Skip fadeIn and start at full weight (first pose / recover from bind pose). */
  instant?: boolean;
  timeScale?: number;
  /** Force restart even when next === current and still running. */
  forceRestart?: boolean;
}

/**
 * Cross-fade to `next` (or restart it). Returns false when the transition was a no-op
 * because the same action is already running at positive weight.
 */
export function playEnemyAction(
  next: AnimationAction | null | undefined,
  currentActionRef: MutableRefObject<AnimationAction | null>,
  mixer: AnimationMixer | null | undefined,
  opts: PlayEnemyActionOpts = {},
): boolean {
  if (!next) return false;

  const {
    loopOnce = false,
    clampWhenFinished = false,
    fadeOut = 0.2,
    fadeIn = 0.2,
    instant = false,
    timeScale = 1,
    forceRestart = false,
  } = opts;

  const current = currentActionRef.current;
  const sameAndAlive = next === current && isLiveAction(current);

  if (sameAndAlive && !forceRestart) {
    if (current.timeScale !== timeScale) current.timeScale = timeScale;
    return false;
  }

  if (current && current !== next) {
    current.fadeOut(fadeOut);
  }

  next.enabled = true;
  next.timeScale = timeScale;
  if (loopOnce) {
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = clampWhenFinished;
  } else {
    next.setLoop(LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }

  if (instant || !current || current === next) {
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
  } else {
    next.reset().fadeIn(fadeIn).play();
  }

  currentActionRef.current = next;
  mixer?.update(0);
  return true;
}
