'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

interface ViperModelProps {
  isWalking: boolean;
  // Increments by 1 on every attack telegraph — guaranteed to change even when
  // the previous animation hasn't finished yet, so DrawBow always restarts.
  attackKey: number;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const VIPER_MODEL_PATHS = [
  '/models/viper_idle.glb',
  '/models/viper_walk.glb',
  '/models/viper_drawbow.glb',
  '/models/viper_releasebow.glb',
  '/models/viper_death.glb',
  '/models/viper_impact.glb',
];

export function preloadViperModels(): void {
  VIPER_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

const SCALE = 0.0125;

export default function ViperModel({
  isWalking,
  attackKey,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: ViperModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  // Tracks which sub-phase of the draw→release cycle we're in.
  const attackPhaseRef = useRef<'draw' | 'release' | 'done'>('done');
  const lastImpactPlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }   = useGLTF('/models/viper_idle.glb');
  const { animations: walkAnims }          = useGLTF('/models/viper_walk.glb');
  const { animations: drawBowAnims }     = useGLTF('/models/viper_drawbow.glb');
  const { animations: releaseBowAnims }    = useGLTF('/models/viper_releasebow.glb');
  const { animations: deathAnims }         = useGLTF('/models/viper_death.glb');
  const { animations: impactAnims }      = useGLTF('/models/viper_impact.glb');

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

    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
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
    };

    return [
      ...rename(idleAnims,      'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims,      'Walk').map(stripRootMotionXZ),
      ...rename(drawBowAnims,   'DrawBow'),
      ...rename(releaseBowAnims, 'ReleaseBow'),
      ...rename(deathAnims,     'Death'),
      ...rename(impactAnims,    'Impact'),
    ];
  }, [idleAnims, walkAnims, drawBowAnims, releaseBowAnims, deathAnims, impactAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'DrawBow' | 'ReleaseBow' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  // Death overrides everything
  useEffect(() => {
    if (!actions || !isDying) return;
    attackPhaseRef.current = 'done';
    const d = getAction('Death');
    if (!d) return;
    currentActionRef.current?.fadeOut(0.15);
    d.setLoop(LoopOnce, 1);
    d.clampWhenFinished = true;
    d.reset().fadeIn(0.15).play();
    currentActionRef.current = d;
  }, [isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hit-react (idle / walk only — not during bow cycle)
  useEffect(() => {
    if (!actions || isDying || !isImpacting) return;
    if (attackPhaseRef.current !== 'done') return;

    const im = getAction('Impact');
    if (!im) return;
    if (im === currentActionRef.current) {
      const retrigger = impactPlayKey !== lastImpactPlayKeyRef.current;
      if (!retrigger) return;
    }

    lastImpactPlayKeyRef.current = impactPlayKey;
    currentActionRef.current?.fadeOut(0.2);
    im.setLoop(LoopOnce, 1);
    im.clampWhenFinished = true;
    im.reset().fadeIn(0.2).play();
    currentActionRef.current = im;
  }, [isImpacting, impactPlayKey, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attack trigger ─────────────────────────────────────────────────────────
  // Fires every time attackKey increments (once per server telegraph), regardless
  // of whether the previous animation had finished. Hard-restarts DrawBow so the
  // animation always matches each projectile launch.
  useEffect(() => {
    if (attackKey === 0 || !actions || isDying) return;

    const drawAction = getAction('DrawBow');
    if (!drawAction) return;

    attackPhaseRef.current = 'draw';
    lastImpactPlayKeyRef.current = -1;
    currentActionRef.current?.fadeOut(0.1);
    drawAction.setLoop(LoopOnce, 1);
    drawAction.clampWhenFinished = true;
    drawAction.reset().fadeIn(0.1).play();
    currentActionRef.current = drawAction;
  }, [attackKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle / Walk transitions ────────────────────────────────────────────────
  // Only runs when the viper is NOT in the middle of an attack cycle or impact.
  useEffect(() => {
    if (!actions || isDying) return;
    if (attackPhaseRef.current !== 'done') return;
    if (isImpacting) return;

    const nextAction = isWalking ? getAction('Walk') : getAction('Idle');
    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);
    nextAction.enabled = true;
    nextAction.setLoop(LoopRepeat, Infinity);
    nextAction.fadeIn(0.2).play();
    currentActionRef.current = nextAction;
  }, [isWalking, isDying, isImpacting, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DrawBow → ReleaseBow → Idle/Walk, plus Impact/Death one-shots ─────────
  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (event: { action: AnimationAction }) => {
      if (isDying) return;
      const finishedAction = event.action;
      const clipName = finishedAction.getClip().name;

      if (clipName === 'Death') return;

      if (clipName === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        if (fallback) {
          fallback.setLoop(LoopRepeat, Infinity);
          currentActionRef.current?.fadeOut(0.15);
          fallback.reset().fadeIn(0.15).play();
          currentActionRef.current = fallback;
        }
        return;
      }

      if (finishedAction === getAction('DrawBow') && attackPhaseRef.current === 'draw') {
        const releaseAction = getAction('ReleaseBow');
        if (releaseAction) {
          attackPhaseRef.current = 'release';
          currentActionRef.current?.fadeOut(0.05);
          releaseAction.setLoop(LoopOnce, 1);
          releaseAction.clampWhenFinished = true;
          releaseAction.reset().fadeIn(0.05).play();
          currentActionRef.current = releaseAction;
        }
        return;
      }

      if (finishedAction === getAction('ReleaseBow') && attackPhaseRef.current === 'release') {
        attackPhaseRef.current = 'done';
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        if (fallback && fallback !== currentActionRef.current) {
          currentActionRef.current?.fadeOut(0.15);
          fallback.enabled = true;
          fallback.setLoop(LoopRepeat, Infinity);
          fallback.reset().fadeIn(0.15).play();
          currentActionRef.current = fallback;
        }
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
