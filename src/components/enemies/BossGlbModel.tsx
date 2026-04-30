'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  Group,
  LoopOnce,
  LoopRepeat,
  AnimationAction,
  AnimationClip,
  VectorKeyframeTrack,
  PointLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Target ≈ 2+ units — tune if asset scale differs
const SCALE = 0.0205;

const BOSS_CORE_GLOW = '#BA55D3';
const BOSS_TECTONIC_ACCENT = '#ff8c42';

const KEY_LIGHT_INTENSITY = 3.2;
const KEY_LIGHT_DISTANCE = 20;
const RIM_LIGHT_INTENSITY = 1.1;
const RIM_LIGHT_DISTANCE = 12;

const ORBIT_RADIUS = 2.55;
const ORBIT_Y = 2.15;
const ORBIT_ROT_SPEED = 0.62;
const ORB_LIGHT_INTENSITY = 1.7;
const ORB_LIGHT_DISTANCE = 7.5;
const ORB_EMISSIVE_INTENSITY = 2.8;
const ORB_ICOSAHEDRON_RADIUS = 0.35;
const ORB_COUNT = 6;

/** Broad, uniform fill so the GLB isn’t only lit from one side (moves with boss). */
const FILL_LIGHT_INTENSITY = 2.6;
const FILL_LIGHT_DISTANCE = 26;
const FILL_LIGHT_COLOR = '#ddd8e8';

function BossLightRig({ isDying }: { isDying: boolean }) {
  const orbitRef = useRef<Group>(null);
  const fadeRef = useRef(1);
  const keyLightRef = useRef<PointLight>(null);
  const rimLightRef = useRef<PointLight>(null);
  const fillLightRef = useRef<PointLight>(null);
  const orbLightRefs = useRef<(PointLight | null)[]>([]);
  const orbMeshRefs = useRef<(Mesh | null)[]>([]);

  const orbPhases = useMemo(
    () => Array.from({ length: ORB_COUNT }, (_, i) => (i / ORB_COUNT) * Math.PI * 2),
    []
  );

  useFrame((_, delta) => {
    const target = isDying ? 0 : 1;
    fadeRef.current += (target - fadeRef.current) * Math.min(1, delta * 5);

    const f = fadeRef.current;
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * ORBIT_ROT_SPEED;
    }

    if (keyLightRef.current) {
      keyLightRef.current.intensity = KEY_LIGHT_INTENSITY * f;
    }
    if (rimLightRef.current) {
      rimLightRef.current.intensity = RIM_LIGHT_INTENSITY * f;
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = FILL_LIGHT_INTENSITY * f;
    }

    for (let i = 0; i < ORB_COUNT; i++) {
      const L = orbLightRefs.current[i];
      if (L) L.intensity = ORB_LIGHT_INTENSITY * f;
      const mesh = orbMeshRefs.current[i];
      if (mesh?.material && !Array.isArray(mesh.material)) {
        (mesh.material as MeshStandardMaterial).emissiveIntensity = ORB_EMISSIVE_INTENSITY * f;
      }
    }
  });

  return (
    <>
      <pointLight
        ref={fillLightRef}
        color={FILL_LIGHT_COLOR}
        intensity={FILL_LIGHT_INTENSITY}
        distance={FILL_LIGHT_DISTANCE}
        decay={2}
        position={[0, 1.95, 0]}
      />
      <pointLight
        ref={keyLightRef}
        color={BOSS_CORE_GLOW}
        intensity={KEY_LIGHT_INTENSITY}
        distance={KEY_LIGHT_DISTANCE}
        decay={2}
        position={[0, 2.2, 0]}
      />
      <pointLight
        ref={rimLightRef}
        color={BOSS_TECTONIC_ACCENT}
        intensity={RIM_LIGHT_INTENSITY}
        distance={RIM_LIGHT_DISTANCE}
        decay={2}
        position={[-0.55, 1.95, 0.45]}
      />

      <group ref={orbitRef} position={[0, ORBIT_Y, 0]}>
        {orbPhases.map((phase, i) => {
          const accent = i % 2 === 1;
          const color = accent ? BOSS_TECTONIC_ACCENT : BOSS_CORE_GLOW;
          const x = Math.cos(phase) * ORBIT_RADIUS;
          const z = Math.sin(phase) * ORBIT_RADIUS;
          return (
            <group key={i} position={[x, 0, z]}>
              <mesh
                ref={(el) => {
                  orbMeshRefs.current[i] = el;
                }}
              >
                <icosahedronGeometry args={[ORB_ICOSAHEDRON_RADIUS, 0]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={ORB_EMISSIVE_INTENSITY}
                  transparent
                  opacity={0.92}
                />
              </mesh>
              <pointLight
                ref={(el) => {
                  orbLightRefs.current[i] = el;
                }}
                color={color}
                intensity={ORB_LIGHT_INTENSITY *10}
                distance={ORB_LIGHT_DISTANCE}
                decay={6}
              />
            </group>
          );
        })}
      </group>
    </>
  );
}

const BOSS_MODEL_PATHS = [
  '/models/boss_idle.glb',
  '/models/boss_walk.glb',
  '/models/boss_attack1.glb',
  '/models/boss_attack2.glb',
  '/models/boss_throw.glb',
  '/models/boss_leap.glb',
  '/models/boss_jump.glb',
  '/models/boss_impact.glb',
  '/models/boss_death.glb',
];

export function preloadBossModels(): void {
  BOSS_MODEL_PATHS.forEach(path => useGLTF.preload(path));
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

  const { scene, animations: idleAnims } = useGLTF('/models/boss_idle.glb');
  const { animations: walkAnims } = useGLTF('/models/boss_walk.glb');
  const { animations: atk1 } = useGLTF('/models/boss_attack1.glb');
  const { animations: atk2 } = useGLTF('/models/boss_attack2.glb');
  const { animations: throwAnims } = useGLTF('/models/boss_throw.glb');
  const { animations: leapAnims } = useGLTF('/models/boss_leap.glb');
  const { animations: jumpAnims } = useGLTF('/models/boss_jump.glb');
  const { animations: impactAnims } = useGLTF('/models/boss_impact.glb');
  const { animations: deathAnims } = useGLTF('/models/boss_death.glb');

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean; material?: unknown }) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const m = child.material;
        if (m && !Array.isArray(m) && typeof m === 'object' && m !== null && 'clone' in m) {
          child.material = (m as { clone: () => unknown }).clone();
        } else if (Array.isArray(m)) {
          child.material = m.map((x) => (typeof x === 'object' && x !== null && 'clone' in x ? (x as { clone: () => unknown }).clone() : x));
        }
      }
    });
    return clone;
  }, [scene]);

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) => clips.map((c) => {
      const r = c.clone();
      r.name = name;
      return r;
    });
    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map((track) => {
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
      ...rename(walkAnims, 'Walk').map(stripRootMotionXZ),
      ...rename(atk1, 'Attack0').map(stripRootMotionXZ),
      ...rename(atk2, 'Attack1').map(stripRootMotionXZ),
      ...rename(throwAnims, 'Throw').map(stripRootMotionXZ),
      ...rename(leapAnims, 'Leap').map(stripRootMotionXZ),
      ...rename(jumpAnims, 'TectonicJump').map(stripRootMotionXZ),
      ...rename(impactAnims, 'Impact').map(stripRootMotionXZ),
      ...rename(deathAnims, 'Death').map(stripRootMotionXZ),
    ];
  }, [idleAnims, walkAnims, atk1, atk2, throwAnims, leapAnims, jumpAnims, impactAnims, deathAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: string): AnimationAction | null => actions[name] ?? null;

  useEffect(() => {
    if (!actions) return;
    if (isDying) {
      const a = getAction('Death');
      if (!a) return;
      currentActionRef.current?.fadeOut(0.15);
      a.setLoop(LoopOnce, 1);
      a.clampWhenFinished = true;
      a.reset().fadeIn(0.12).play();
      currentActionRef.current = a;
      return;
    }
    if (tectonicJumpTrigger > 0 && tectonicJumpTrigger !== lastTectonicTriggerRef.current) {
      lastTectonicTriggerRef.current = tectonicJumpTrigger;
      const a = getAction('TectonicJump');
      if (a) {
        currentActionRef.current?.fadeOut(0.1);
        a.setLoop(LoopOnce, 1);
        a.clampWhenFinished = true;
        a.reset().fadeIn(0.12).play();
        currentActionRef.current = a;
        return;
      }
    }
    if (isLeaping) {
      const a = getAction('Leap');
      if (a) {
        if (currentActionRef.current !== a) {
          currentActionRef.current?.fadeOut(0.08);
          a.setLoop(LoopOnce, 1);
          a.clampWhenFinished = true;
          a.reset().fadeIn(0.1).play();
          currentActionRef.current = a;
        }
        return;
      }
    }
    if (isImpacting) {
      const a = getAction('Impact');
      if (!a) return;
      const retrigger = impactPlayKey !== lastImpactPlayKeyRef.current;
      if (retrigger || currentActionRef.current !== a) {
        lastImpactPlayKeyRef.current = impactPlayKey;
        currentActionRef.current?.fadeOut(0.1);
        a.setLoop(LoopOnce, 1);
        a.clampWhenFinished = true;
        a.reset().fadeIn(0.12).play();
        currentActionRef.current = a;
        return;
      }
    } else {
      lastImpactPlayKeyRef.current = -1;
    }
    if (throwTrigger > 0 && throwTrigger !== lastThrowTriggerRef.current) {
      lastThrowTriggerRef.current = throwTrigger;
      const a = getAction('Throw');
      if (a) {
        currentActionRef.current?.fadeOut(0.08);
        a.setLoop(LoopOnce, 1);
        a.clampWhenFinished = true;
        a.reset().fadeIn(0.1).play();
        currentActionRef.current = a;
        return;
      }
    }
    if (attackTrigger > 0 && attackTrigger !== lastAttackTriggerRef.current) {
      lastAttackTriggerRef.current = attackTrigger;
      const key = `Attack${meleeIndex}` as 'Attack0' | 'Attack1';
      const a = getAction(key);
      if (a) {
        currentActionRef.current?.fadeOut(0.08);
        a.setLoop(LoopOnce, 1);
        a.clampWhenFinished = true;
        a.reset().fadeIn(0.1).play();
        currentActionRef.current = a;
        return;
      }
    }
    const next = isWalking ? getAction('Walk') : getAction('Idle');
    if (next) {
      if (currentActionRef.current !== next) {
        currentActionRef.current?.fadeOut(0.12);
        next.setLoop(LoopRepeat, Infinity);
        next.reset().fadeIn(0.15).play();
        currentActionRef.current = next;
      }
    }
  }, [isDying, isWalking, isLeaping, isImpacting, tectonicJumpTrigger, attackTrigger, meleeIndex, throwTrigger, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToIdleOrWalk = () => {
      if (isDying) return;
      const next = isWalking ? getAction('Walk') : getAction('Idle');
      if (next) {
        next.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.12);
        next.reset().fadeIn(0.12).play();
        currentActionRef.current = next;
      }
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
  }, [mixer, isDying, isWalking, onImpactFinished, onTectonicJumpFinished, onAttackFinished, onLeapFinished, onThrowAnimFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <BossLightRig isDying={isDying} />
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
