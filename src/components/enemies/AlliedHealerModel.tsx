'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { AnimationAction, AnimationClip, Group, LoopOnce, LoopRepeat, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { peek as suspendPeek } from 'suspend-react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadGltfAnimationClips } from '@/utils/gltfAnimationLoader';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

type AlliedHealerClip = 'Idle' | 'Walk' | 'Death' | 'Cast' | 'HealCast' | 'Launch';

interface AlliedHealerModelProps {
  isWalking: boolean;
  isDying: boolean;
  abilityClip?: 'Cast' | 'HealCast' | 'Launch' | null;
}

const ALLIED_HEALER_MODEL_PATHS = [
  '/models/ally_idle.glb',
  '/models/ally_walk.glb',
  '/models/ally_death.glb',
  '/models/ally_cast.glb',
  '/models/ally_healcast.glb',
  '/models/ally_launch.glb',
];

const ALLIED_HEALER_DEFERRED_MODEL_PATHS: Record<Exclude<AlliedHealerClip, 'Idle'>, string> = {
  Walk: '/models/ally_walk.glb',
  Death: '/models/ally_death.glb',
  Cast: '/models/ally_cast.glb',
  HealCast: '/models/ally_healcast.glb',
  Launch: '/models/ally_launch.glb',
};

const SCALE = 0.01135;

export function preloadAlliedHealerModels(): void {
  useGLTF.preload('/models/ally_idle.glb');
  preloadGltfAnimationClips(ALLIED_HEALER_MODEL_PATHS.filter(path => path !== '/models/ally_idle.glb'));
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

/** Warm all allied healer GLBs so the model is ready when the 2nd room loads. */
export async function warmupAlliedHealerModels(): Promise<void> {
  try {
    await waitForGltfUrl('/models/ally_idle.glb');
    await Promise.all(
      ALLIED_HEALER_MODEL_PATHS
        .filter(p => p !== '/models/ally_idle.glb')
        .map(p => loadGltfAnimationClips(p).then(() => undefined as void).catch(() => {})),
    );
  } catch (e) {
    console.warn('Allied healer warmup failed:', e);
  }
}

export default function AlliedHealerModel({ isWalking, isDying, abilityClip }: AlliedHealerModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const isMountedRef = useRef(true);
  const requestedDeferredStatesRef = useRef<Set<Exclude<AlliedHealerClip, 'Idle'>>>(new Set());
  const [deferredAnimationClips, setDeferredAnimationClips] = useState<
    Partial<Record<Exclude<AlliedHealerClip, 'Idle'>, AnimationClip[]>>
  >({});

  const { scene, animations: idleAnims } = useGLTF('/models/ally_idle.glb');

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const names = new Set<Exclude<AlliedHealerClip, 'Idle'>>();
    if (isWalking) names.add('Walk');
    if (isDying) names.add('Death');
    if (abilityClip) names.add(abilityClip);

    names.forEach((name) => {
      if (deferredAnimationClips[name] || requestedDeferredStatesRef.current.has(name)) return;
      requestedDeferredStatesRef.current.add(name);
      loadGltfAnimationClips(ALLIED_HEALER_DEFERRED_MODEL_PATHS[name])
        .then((clips) => {
          if (!isMountedRef.current) return;
          setDeferredAnimationClips(prev => (prev[name] ? prev : { ...prev, [name]: clips }));
        })
        .catch((error) => {
          requestedDeferredStatesRef.current.delete(name);
          console.warn(`Failed to load allied healer animation ${name}:`, error);
        });
    });
  }, [isWalking, isDying, abilityClip, deferredAnimationClips]);

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
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: AlliedHealerClip) =>
      clips.map((clip) => {
        const renamed = clip.clone();
        renamed.name = name;
        return renamed;
      });

    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map(track => {
        if (!track.name.endsWith('.position')) return track;
        if (!track.name.toLowerCase().includes('hips')) return track;
        const values = Float32Array.from(track.values);
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0;
          values[i + 2] = 0;
        }
        return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
      });
      return clip;
    };

    return [
      ...rename(idleAnims, 'Idle').map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Walk ?? [], 'Walk').map(stripRootMotionXZ),
      ...rename(deferredAnimationClips.Death ?? [], 'Death'),
      ...rename(deferredAnimationClips.Cast ?? [], 'Cast'),
      ...rename(deferredAnimationClips.HealCast ?? [], 'HealCast'),
      ...rename(deferredAnimationClips.Launch ?? [], 'Launch'),
    ];
  }, [idleAnims, deferredAnimationClips]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: AlliedHealerClip): AnimationAction | null => actions[name] ?? null;

  useEffect(() => {
    if (!actions) return;
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');
    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);
    if (isDying || abilityClip) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    }
    currentActionRef.current = nextAction;
  }, [actions, abilityClip, isDying, isWalking]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;
    const handleFinish = (e: { action: AnimationAction }) => {
      const name = e.action.getClip().name;
      if (name !== 'Cast' && name !== 'HealCast' && name !== 'Launch') return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (!fallback) return;
      fallback.setLoop(LoopRepeat, Infinity);
      currentActionRef.current?.fadeOut(0.15);
      fallback.reset().fadeIn(0.15).play();
      currentActionRef.current = fallback;
    };
    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
