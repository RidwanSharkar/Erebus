'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import type { TerrorhawkPhase } from '@/utils/terrorhawkCoopConstants';

export type TerrorhawkAnimState =
  | 'toHover'
  | 'flyIdle'
  | 'flight'
  | 'fall'
  | 'jumpEnd'
  | 'bite'
  | 'death';

interface TerrorhawkModelProps {
  phase: TerrorhawkPhase;
  isAttacking: boolean;
  isDying: boolean;
}

const TERRORHAWK_IDLE_PATH = '/models/birdofprey/dreadsquall_flyIdle.glb';

const TERRORHAWK_MODEL_PATHS = [
  TERRORHAWK_IDLE_PATH,
  '/models/birdofprey/dreadsquall_toHover.glb',
  '/models/birdofprey/dreadsquall_flight.glb',
  '/models/birdofprey/dreadsquall_fall.glb',
  '/models/birdofprey/dreadsquall_jumpEnd.glb',
  '/models/birdofprey/dreadsquall_bite.glb',
  '/models/birdofprey/dreadsquall_death.glb',
];

const TERRORHAWK_DEFERRED_PATHS = {
  ToHover: '/models/birdofprey/dreadsquall_toHover.glb',
  Flight: '/models/birdofprey/dreadsquall_flight.glb',
  Fall: '/models/birdofprey/dreadsquall_fall.glb',
  JumpEnd: '/models/birdofprey/dreadsquall_jumpEnd.glb',
  Bite: '/models/birdofprey/dreadsquall_bite.glb',
  Death: '/models/birdofprey/dreadsquall_death.glb',
} as const;

export function preloadTerrorhawkModels(): void {
  preloadSkinnedIdleAndAnimationClips(TERRORHAWK_IDLE_PATH, TERRORHAWK_MODEL_PATHS, useGLTF.preload);
}

const TARGET_HEIGHT = 0.902;
const TERRORHAWK_BIND_HEIGHT = 3.2;
const SCALE = TARGET_HEIGHT / TERRORHAWK_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.15 * SCALE;

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

function phaseToAnim(
  phase: TerrorhawkPhase,
  isAttacking: boolean,
  isDying: boolean,
): TerrorhawkAnimState {
  if (isDying) return 'death';
  if (isAttacking) return 'bite';
  switch (phase) {
    case 'takeoff':
      return 'toHover';
    case 'hover':
      return 'flyIdle';
    case 'approach':
      return 'flight';
    case 'dive':
      return 'fall';
    case 'land':
      return 'jumpEnd';
    case 'ground_melee':
    default:
      return 'flyIdle';
  }
}

export default React.memo(function TerrorhawkModel({
  phase,
  isAttacking,
  isDying,
}: TerrorhawkModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(TERRORHAWK_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(TERRORHAWK_DEFERRED_PATHS);
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
        console.warn('Failed to load terrorhawk animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const flyIdleSource = useMemo(
    () => pickWowClip(idleAnims, 'Fly', 'SwimIdle', 'Stand', 'Hover'),
    [idleAnims],
  );
  const toHoverSource = useMemo(
    () => pickWowClip(extraAnims.ToHover ?? [], 'ToHover', 'Fly', 'Hover', 'Stand'),
    [extraAnims.ToHover],
  );
  const flightSource = useMemo(
    () => pickWowClip(extraAnims.Flight ?? [], 'Fly', 'Run', 'Swim'),
    [extraAnims.Flight],
  );
  const fallSource = useMemo(
    () => pickWowClip(extraAnims.Fall ?? [], 'Fall', 'Fly', 'Swim'),
    [extraAnims.Fall],
  );
  const jumpEndSource = useMemo(
    () => pickWowClip(extraAnims.JumpEnd ?? [], 'JumpEnd', 'Jump', 'Land', 'Stand'),
    [extraAnims.JumpEnd],
  );
  const biteSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.Bite ?? [],
        // variation 0 is a claw swipe; bite/peck is a later AttackUnarmed variant in this rig
        'AttackUnarmed (ID 16 variation 1)',
        'AttackUnarmed (ID 16 variation 2)',
        'AttackUnarmed (ID 16 variation 0)',
      ),
    [extraAnims.Bite],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('terrorhawk-flyIdle', flyIdleSource, {
        stripRootMotion: true,
        renameTo: 'FlyIdle',
      }),
      ...getCachedProcessedClips('terrorhawk-toHover', toHoverSource, {
        stripRootMotion: true,
        renameTo: 'ToHover',
      }),
      ...getCachedProcessedClips('terrorhawk-flight', flightSource, {
        stripRootMotion: true,
        renameTo: 'Flight',
      }),
      ...getCachedProcessedClips('terrorhawk-fall', fallSource, {
        stripRootMotion: true,
        renameTo: 'Fall',
      }),
      ...getCachedProcessedClips('terrorhawk-jumpEnd', jumpEndSource, {
        stripRootMotion: true,
        renameTo: 'JumpEnd',
      }),
      ...getCachedProcessedClips('terrorhawk-bite', biteSource, { renameTo: 'Bite' }),
      ...getCachedProcessedClips('terrorhawk-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    flyIdleSource,
    toHoverSource,
    flightSource,
    fallSource,
    jumpEndSource,
    biteSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'FlyIdle' | 'ToHover' | 'Flight' | 'Fall' | 'JumpEnd' | 'Bite' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const animToAction = (state: TerrorhawkAnimState): AnimationAction | null => {
    switch (state) {
      case 'toHover':
        return getAction('ToHover');
      case 'flight':
        return getAction('Flight');
      case 'fall':
        return getAction('Fall');
      case 'jumpEnd':
        return getAction('JumpEnd');
      case 'bite':
        return getAction('Bite');
      case 'death':
        return getAction('Death');
      case 'flyIdle':
      default:
        return getAction('FlyIdle');
    }
  };

  const posed = useEnemyIdlePose({
    actions,
    mixer,
    currentActionRef,
    idleClipName: 'FlyIdle',
  });

  // Priority: Death > Bite > JumpEnd > Fall > Flight > ToHover > FlyIdle
  useEffect(() => {
    if (!actions) return;

    const nextState = phaseToAnim(phase, isAttacking, isDying);
    const nextAction = animToAction(nextState);
    if (!nextAction) return;

    const once =
      nextState === 'death' ||
      nextState === 'bite' ||
      nextState === 'jumpEnd' ||
      nextState === 'toHover';

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: once,
      clampWhenFinished: once,
      fadeIn: 0.15,
      fadeOut: 0.15,
    });
  }, [phase, isAttacking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToPhaseIdle = () => {
      if (isDying) return;
      const fallback = animToAction(phaseToAnim(phase, false, false));
      if (!fallback) return;
      const once = phase === 'takeoff' || phase === 'land';
      playEnemyAction(fallback, currentActionRef, mixer, {
        loopOnce: once,
        clampWhenFinished: once,
        fadeIn: 0.12,
        fadeOut: 0.12,
      });
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Bite') {
        blendToPhaseIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, phase, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
