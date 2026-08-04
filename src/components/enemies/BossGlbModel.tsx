'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';

import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  Group,
  AnimationAction,
  AnimationClip,
  Vector3,
} from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { filterAnimationClipsForRoot, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const SCALE = 0.0205;

const BOSS_CORE_GLOW = '#BA55D3';
const BOSS_TECTONIC_ACCENT = '#ff8c42';

const KEY_LIGHT_INTENSITY = 3.2;
const KEY_LIGHT_DISTANCE = 20;
const RIM_LIGHT_INTENSITY = 1.1;
const RIM_LIGHT_DISTANCE = 12;

const FILL_LIGHT_INTENSITY = 2.6;
const FILL_LIGHT_DISTANCE = 26;
const FILL_LIGHT_COLOR = '#ddd8e8';

function BossLightRig({ isDying }: { isDying: boolean }) {
  const fadeRef = useRef(1);
  const markerRef = useRef<Group>(null);
  const worldPos = useMemo(() => new Vector3(), []);
  const fillLight = useDynamicLight({ color: FILL_LIGHT_COLOR, distance: FILL_LIGHT_DISTANCE, decay: 2, priority: 2 });
  const keyLight = useDynamicLight({ color: BOSS_CORE_GLOW, distance: KEY_LIGHT_DISTANCE, decay: 2, priority: 2 });
  const rimLight = useDynamicLight({ color: BOSS_TECTONIC_ACCENT, distance: RIM_LIGHT_DISTANCE, decay: 2, priority: 2 });

  useFrame((_, delta) => {
    const target = isDying ? 0 : 1;
    fadeRef.current += (target - fadeRef.current) * Math.min(1, delta * 5);

    const f = fadeRef.current;
    if (markerRef.current) {
      markerRef.current.getWorldPosition(worldPos);
    }
    const x = worldPos.x;
    const y = worldPos.y;
    const z = worldPos.z;

    const fill = fillLight.current;
    if (fill?.active) {
      fill.setPosition(x, y + 1.95, z);
      fill.setIntensity(FILL_LIGHT_INTENSITY * f);
    }
    const key = keyLight.current;
    if (key?.active) {
      key.setPosition(x, y + 2.2, z);
      key.setIntensity(KEY_LIGHT_INTENSITY * f);
    }
    const rim = rimLight.current;
    if (rim?.active) {
      rim.setPosition(x - 0.55, y + 1.95, z + 0.45);
      rim.setIntensity(RIM_LIGHT_INTENSITY * f);
    }
  });

  return <group ref={markerRef} />;
}

const BOSS_IDLE_PATH = '/models/boss_idle.glb';

const BOSS_MODEL_PATHS = [
  BOSS_IDLE_PATH,
  '/models/boss_walk.glb',
  '/models/boss_attack1.glb',
  '/models/boss_attack2.glb',
  '/models/boss_throw.glb',
  '/models/boss_leap.glb',
  '/models/boss_jump.glb',
  '/models/boss_impact.glb',
  '/models/boss_death.glb',
];

const BOSS_DEFERRED_PATHS = {
  Walk: '/models/boss_walk.glb',
  Attack0: '/models/boss_attack1.glb',
  Attack1: '/models/boss_attack2.glb',
  Throw: '/models/boss_throw.glb',
  Leap: '/models/boss_leap.glb',
  TectonicJump: '/models/boss_jump.glb',
  Impact: '/models/boss_impact.glb',
  Death: '/models/boss_death.glb',
} as const;

export function preloadBossModels(): void {
  preloadSkinnedIdleAndAnimationClips(BOSS_IDLE_PATH, BOSS_MODEL_PATHS, useGLTF.preload);
}

export interface BossGlbModelProps {
  isWalking: boolean;
  isDying: boolean;
  isLeaping: boolean;
  /** Bumps to play `boss_jump.glb` (Tectonic). */
  tectonicJumpTrigger: number;
  /** Bumps to play one-shot melee (uses meleeIndex on bump frame). */
  attackTrigger: number;
  meleeIndex: 0 | 1;
  /** Bumps to play the one-shot throw animation. */
  throwTrigger: number;
  isImpacting: boolean;
  impactPlayKey: number;
  onImpactFinished?: () => void;
  onTectonicJumpFinished?: () => void;
  onAttackFinished?: () => void;
  onLeapFinished?: () => void;
  onThrowAnimFinished?: () => void;
}

export default function BossGlbModel({
  isWalking,
  isDying,
  isLeaping,
  tectonicJumpTrigger,
  attackTrigger,
  meleeIndex,
  throwTrigger,
  isImpacting,
  impactPlayKey,
  onImpactFinished,
  onTectonicJumpFinished,
  onAttackFinished,
  onLeapFinished,
  onThrowAnimFinished,
}: BossGlbModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const lastTectonicTriggerRef = useRef(0);
  const lastAttackTriggerRef = useRef(0);
  const lastThrowTriggerRef = useRef(0);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(BOSS_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(BOSS_DEFERRED_PATHS);
    void Promise.all(
      entries.map(async ([name, path]) => {
        const clips = await loadGltfAnimationClips(path);
        return [name, clips] as const;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;
        setExtraAnims(Object.fromEntries(loaded));
      })
      .catch((error) => {
        console.warn('Failed to load boss animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, BOSS_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: true,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const idleClips = renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ);
    const hasAllDeferred = Object.keys(BOSS_DEFERRED_PATHS).every((key) => extraAnims[key]?.length);
    if (!hasAllDeferred) {
      return filterAnimationClipsForRoot(clonedScene, idleClips);
    }
    return filterAnimationClipsForRoot(clonedScene, [
      ...idleClips,
      ...renameAnimationClips(extraAnims.Walk, 'Walk').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Attack0, 'Attack0').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Attack1, 'Attack1').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Throw, 'Throw').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Leap, 'Leap').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.TectonicJump, 'TectonicJump').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Impact, 'Impact').map(stripRootMotionXZ),
      ...renameAnimationClips(extraAnims.Death, 'Death').map(stripRootMotionXZ),
    ]);
  }, [idleAnims, extraAnims, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: string): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    if (isDying) {
      playEnemyAction(getAction('Death'), currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.12,
        fadeOut: 0.15,
      });
      return;
    }
    if (tectonicJumpTrigger > 0 && tectonicJumpTrigger !== lastTectonicTriggerRef.current) {
      lastTectonicTriggerRef.current = tectonicJumpTrigger;
      playEnemyAction(getAction('TectonicJump'), currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.12,
        fadeOut: 0.1,
      });
      return;
    }
    if (isLeaping) {
      playEnemyAction(getAction('Leap'), currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.1,
        fadeOut: 0.08,
      });
      return;
    }
    if (isImpacting) {
      const retrigger = impactPlayKey !== lastImpactPlayKeyRef.current;
      if (retrigger || currentActionRef.current !== getAction('Impact')) {
        lastImpactPlayKeyRef.current = impactPlayKey;
        playEnemyAction(getAction('Impact'), currentActionRef, mixer, {
          loopOnce: true,
          clampWhenFinished: true,
          fadeIn: 0.12,
          fadeOut: 0.1,
          forceRestart: retrigger,
        });
        return;
      }
    } else {
      lastImpactPlayKeyRef.current = -1;
    }
    if (throwTrigger > 0 && throwTrigger !== lastThrowTriggerRef.current) {
      lastThrowTriggerRef.current = throwTrigger;
      playEnemyAction(getAction('Throw'), currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.1,
        fadeOut: 0.08,
        forceRestart: true,
      });
      return;
    }
    if (attackTrigger > 0 && attackTrigger !== lastAttackTriggerRef.current) {
      lastAttackTriggerRef.current = attackTrigger;
      const key = `Attack${meleeIndex}` as 'Attack0' | 'Attack1';
      playEnemyAction(getAction(key), currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.1,
        fadeOut: 0.08,
        forceRestart: true,
      });
      return;
    }
    const next = isWalking ? getAction('Walk') : getAction('Idle');
    playEnemyAction(next, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.12 });
  }, [isDying, isWalking, isLeaping, isImpacting, tectonicJumpTrigger, attackTrigger, meleeIndex, throwTrigger, impactPlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToIdleOrWalk = () => {
      if (isDying) return;
      const next = isWalking ? getAction('Walk') : getAction('Idle');
      playEnemyAction(next, currentActionRef, mixer, { fadeIn: 0.12, fadeOut: 0.12 });
    };

    const onFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const clipName = e.action.getClip().name;
      if (clipName === 'Death') return;
      if (clipName === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        blendToIdleOrWalk();
        return;
      }
      if (clipName === 'TectonicJump') {
        onTectonicJumpFinished?.();
        blendToIdleOrWalk();
        return;
      }
      if (clipName === 'Leap') {
        onLeapFinished?.();
        blendToIdleOrWalk();
        return;
      }
      if (clipName === 'Throw') {
        onThrowAnimFinished?.();
        blendToIdleOrWalk();
        return;
      }
      if (clipName === 'Attack0' || clipName === 'Attack1') {
        onAttackFinished?.();
        blendToIdleOrWalk();
        return;
      }
    };

    mixer.addEventListener('finished', onFinish);
    return () => mixer.removeEventListener('finished', onFinish);
  }, [mixer, isDying, isWalking, onImpactFinished, onTectonicJumpFinished, onAttackFinished, onLeapFinished, onThrowAnimFinished, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <BossLightRig isDying={isDying} />
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
