'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface TemplarModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  /** Templar Blink Smite wind-up (templar_smite.glb) */
  isBlinkSmite?: boolean;
  blinkSmitePlayKey?: number;
  onBlinkSmiteFinished?: () => void;
}

useGLTF.preload('/models/templar_idle.glb');
useGLTF.preload('/models/templar_run.glb');
useGLTF.preload('/models/templar_attack.glb');
useGLTF.preload('/models/templar_attack2.glb');
useGLTF.preload('/models/templar_death.glb');
useGLTF.preload('/models/templar_impact.glb');
useGLTF.preload('/models/templar_smite.glb');

// Scale to match in-world height (~2 game units). Tune if GLB geometry differs.
const SCALE = 0.013;

export default function TemplarModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  isBlinkSmite = false,
  blinkSmitePlayKey = 0,
  onBlinkSmiteFinished,
}: TemplarModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const lastBlinkSmitePlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }    = useGLTF('/models/templar_idle.glb');
  const { animations: runAnims }            = useGLTF('/models/templar_run.glb');
  const { animations: attackAnims }         = useGLTF('/models/templar_attack.glb');
  const { animations: attack2Anims }        = useGLTF('/models/templar_attack2.glb');
  const { animations: deathAnims }          = useGLTF('/models/templar_death.glb');
  const { animations: impactAnims }         = useGLTF('/models/templar_impact.glb');
  const { animations: smiteAnims }          = useGLTF('/models/templar_smite.glb');

  // Clone scene + own materials so dying fade-out is isolated to this instance.
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

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    // Strip root-motion X/Z so server position stays authoritative.
    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map(track => {
        if (!track.name.endsWith('.position')) return track;
        if (!track.name.toLowerCase().includes('hips')) return track;
        const values = Float32Array.from(track.values);
        for (let i = 0; i < values.length; i += 3) {
          values[i]     = 0; // X
          values[i + 2] = 0; // Z
        }
        return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
      });
      return clip;
    };

    return [
      ...rename(idleAnims,    'Idle').map(stripRootMotionXZ),
      ...rename(runAnims,     'Walk').map(stripRootMotionXZ),
      ...rename(attackAnims,  'Attack'),
      ...rename(attack2Anims, 'Attack2'),
      ...rename(deathAnims,   'Death'),
      ...rename(impactAnims,  'Impact'),
      // Single clip: duplicate names in the mixer if the GLB has multiple takes
      ...(smiteAnims.length
        ? rename([smiteAnims[0]], 'BlinkSmite').map(stripRootMotionXZ)
        : []),
    ];
  }, [idleAnims, runAnims, attackAnims, attack2Anims, deathAnims, impactAnims, smiteAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Death' | 'Impact' | 'BlinkSmite'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > BlinkSmite > Attack > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isBlinkSmite
        ? getAction('BlinkSmite')
        : isAttacking
          ? getAction(attackClip)
          : isImpacting
            ? getAction('Impact')
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) {
      const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
      const retriggerBlinkSmite = isBlinkSmite && blinkSmitePlayKey !== lastBlinkSmitePlayKeyRef.current;
      if (!retriggerImpact && !retriggerBlinkSmite) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isBlinkSmite) {
      lastBlinkSmitePlayKeyRef.current = blinkSmitePlayKey;
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      if (!isBlinkSmite) lastBlinkSmitePlayKeyRef.current = -1;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, attackVariant, isImpacting, impactPlayKey, isBlinkSmite, blinkSmitePlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (impact, attack) finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback) {
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.reset().fadeIn(0.15).play();
        currentActionRef.current = fallback;
      }
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
      if (name === 'BlinkSmite') {
        onBlinkSmiteFinished?.();
        lastBlinkSmitePlayKeyRef.current = -1;
        blendToWalkOrIdle();
        return;
      }
      if (name === 'Attack' || name === 'Attack2') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished, onBlinkSmiteFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
