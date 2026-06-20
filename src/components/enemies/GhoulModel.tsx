'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface GhoulModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isSummoning: boolean;
  isDying: boolean;
  isLeaping?: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  scaleMultiplier?: number;
}

const GHOUL_MODEL_PATHS = [
  '/models/ghoul_idle.glb',
  '/models/ghoul_run.glb',
  '/models/ghoul_attack.glb',
  '/models/ghoul_attack2.glb',
  '/models/ghoul_summon.glb',
  '/models/ghoul_death.glb',
  '/models/ghoul_impact.glb',
  '/models/ghoul_leap.glb',
];

export function preloadGhoulModels(): void {
  GHOUL_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// ── Module-level animation clip cache ─────────────────────────────────────────
// All GhoulModel instances share the same set of AnimationClip objects.
// THREE.js AnimationMixer creates per-instance AnimationActions that reference
// shared clips, so this is safe. Caching here eliminates the per-mount
// Float32Array.from() / Array.from() work for every ghoul after the first.
let _cachedAnimations: AnimationClip[] | null = null;

const SCALE = 0.014;

export default function GhoulModel({
  isWalking,
  isAttacking,
  attackVariant,
  isSummoning,
  isDying,
  isLeaping = false,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  scaleMultiplier = 1,
}: GhoulModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }    = useGLTF('/models/ghoul_idle.glb');
  const { animations: runAnims }            = useGLTF('/models/ghoul_run.glb');
  const { animations: attackAnims }         = useGLTF('/models/ghoul_attack.glb');
  const { animations: attack2Anims }        = useGLTF('/models/ghoul_attack2.glb');
  const { animations: summonAnims }         = useGLTF('/models/ghoul_summon.glb');
  const { animations: deathAnims }          = useGLTF('/models/ghoul_death.glb');
  const { animations: impactAnims }         = useGLTF('/models/ghoul_impact.glb');
  const { animations: leapAnims }           = useGLTF('/models/ghoul_leap.glb');

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

  const animations = useMemo(() => {
    // Return the session-level cache on subsequent mounts; all ghouls share the
    // same clip objects and each gets its own AnimationMixer + Actions via useAnimations.
    if (_cachedAnimations) return _cachedAnimations;

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

    _cachedAnimations = [
      ...rename(idleAnims,    'Idle').map(stripRootMotionXZ),
      ...rename(runAnims,     'Run').map(stripRootMotionXZ),
      ...rename(attackAnims,  'Attack'),
      ...rename(attack2Anims, 'Attack2'),
      ...rename(summonAnims,  'Summon'),
      ...rename(deathAnims,   'Death'),
      ...rename(impactAnims,  'Impact'),
      ...rename(leapAnims,    'Leap').map(stripRootMotionXZ),
    ];
    return _cachedAnimations;
  }, [idleAnims, runAnims, attackAnims, attack2Anims, summonAnims, deathAnims, impactAnims, leapAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Summon' | 'Death' | 'Impact' | 'Leap'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Summon > Leap > Attack > Impact > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isSummoning
        ? getAction('Summon')
        : isLeaping
          ? getAction('Leap')
          : isAttacking
            ? getAction(attackClip)
            : isImpacting
              ? getAction('Impact')
              : isWalking
                ? getAction('Run')
                : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) {
      const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
      if (!retriggerImpact) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isLeaping) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.1).play();
    } else if (isSummoning || isAttacking) {
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
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, attackVariant, isSummoning, isDying, isLeaping, isImpacting, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (summon, attack, impact) finishes, blend back to Run or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToRunOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Run') : getAction('Idle');
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
        blendToRunOrIdle();
        return;
      }
      if (name === 'Summon' || name === 'Attack' || name === 'Attack2') {
        blendToRunOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE * scaleMultiplier, SCALE * scaleMultiplier, SCALE * scaleMultiplier]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
