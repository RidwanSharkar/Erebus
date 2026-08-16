'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AnimationClip, Group, LoopOnce } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  UNIT_SELF_ILLUMINATION_INTENSITY,
  useCleanupAnimationMixer,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  filterAnimationTracksForRoot,
  getCachedProcessedClips,
} from '@/utils/enemyAnimationClipCache';

const ACTION_NAME = 'Play';

function pickStandClip(clips: AnimationClip[]): AnimationClip[] {
  const stand = clips.find((clip) => clip.name.startsWith('Stand')) ?? clips[0];
  return stand ? [stand] : [];
}

/**
 * One persistent skinned-GLB clone that plays a Stand clip once per `play()` call.
 * Hidden between shots; clip data is shared via the session processed-clip cache.
 */
export function useOneShotGlbVfx(modelPath: string, cacheKey: string) {
  const groupRef = useRef<Group>(null);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const durationRef = useRef(1);
  const pendingDurationRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const { scene, animations } = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = false;
      child.material = Array.isArray(child.material)
        ? child.material.map((m: any) => m.clone())
        : child.material.clone();
    });
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const processed = useMemo(() => {
    const source = pickStandClip(animations);
    const clips = getCachedProcessedClips(cacheKey, source, { renameTo: ACTION_NAME });
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [cacheKey, animations, clonedScene]);

  const { actions, mixer } = useAnimations(processed, groupRef);
  useCleanupAnimationMixer(mixer, groupRef);

  const hide = useCallback(() => {
    playingRef.current = false;
    pendingDurationRef.current = null;
    const action = actions?.[ACTION_NAME];
    action?.stop();
    setVisible(false);
  }, [actions]);

  const play = useCallback((durationMs: number) => {
    const action = actions?.[ACTION_NAME];
    durationRef.current = Math.max(0.05, durationMs / 1000);
    elapsedRef.current = 0;
    playingRef.current = true;
    setVisible(true);
    if (!action) {
      pendingDurationRef.current = durationMs;
      return;
    }
    pendingDurationRef.current = null;
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }, [actions]);

  useEffect(() => {
    if (pendingDurationRef.current == null) return;
    if (!actions?.[ACTION_NAME]) return;
    const ms = pendingDurationRef.current;
    pendingDurationRef.current = null;
    play(ms);
  }, [actions, play]);

  useFrame((_, delta) => {
    if (!playingRef.current) return;
    elapsedRef.current += delta;
    if (elapsedRef.current >= durationRef.current) {
      hide();
    }
  });

  return { groupRef, clonedScene, play, visible };
}
