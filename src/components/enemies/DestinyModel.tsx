'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import {
  DESTINY_BREATH_ROAR_CAST_LOCK_MS,
  DESTINY_FLY_ATTACK_CAST_MS,
  DESTINY_FLY_LAND_MS,
  DESTINY_FLY_TAKEOFF_MS,
  DESTINY_WING_CAST_LOCK_MS,
  isDestinyAirPhase,
  type DestinyPhase,
} from '@/utils/destinyCoopConstants';

export type DestinyAnimState =
  | 'idle'
  | 'walk'
  | 'leftSwipe'
  | 'rightSwipe'
  | 'breath'
  | 'wingAttack'
  | 'flyTakeoff'
  | 'flyIdle'
  | 'fly'
  | 'flyIdleAttack'
  | 'flyLand'
  | 'death';

interface DestinyModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  swipeVariant: 1 | 2;
  isBreathing: boolean;
  isWingAttacking: boolean;
  isFlyAttacking: boolean;
  phase: DestinyPhase;
  isDying: boolean;
}

/** EmoteRoar clip length (seconds) — used to stretch breath into the cast window. */
const EMOTE_ROAR_CLIP_SEC = 5.333;
/** SpecialUnarmed (wing buffet) clip length (seconds). */
const SPECIAL_UNARMED_CLIP_SEC = 5.333;
/** DragonSpitHover clip length (seconds). */
const DRAGON_SPIT_HOVER_CLIP_SEC = 1.0;
/** LiftOff / Land clip length (seconds). */
const LIFTOFF_LAND_CLIP_SEC = 3.0;

const DESTINY_IDLE_PATH = '/models/dragon/azugeros_idle.glb';

const DESTINY_MODEL_PATHS = [
  DESTINY_IDLE_PATH,
  '/models/dragon/azugeros_walk.glb',
  '/models/dragon/azugeros_leftSwipe.glb',
  '/models/dragon/azugeros_rightSwipe.glb',
  '/models/dragon/azugeros_roar.glb',
  '/models/dragon/azugeros_wingAttack.glb',
  '/models/dragon/azugeros_flyTakeoff.glb',
  '/models/dragon/azugeros_flyIdle.glb',
  '/models/dragon/azugeros_fly.glb',
  '/models/dragon/azugeros_flyIdleAttack.glb',
  '/models/dragon/azugeros_flyLand.glb',
  '/models/dragon/azugeros_death.glb',
];

const DESTINY_DEFERRED_PATHS = {
  Walk: '/models/dragon/azugeros_walk.glb',
  LeftSwipe: '/models/dragon/azugeros_leftSwipe.glb',
  RightSwipe: '/models/dragon/azugeros_rightSwipe.glb',
  Breath: '/models/dragon/azugeros_roar.glb',
  WingAttack: '/models/dragon/azugeros_wingAttack.glb',
  FlyTakeoff: '/models/dragon/azugeros_flyTakeoff.glb',
  FlyIdle: '/models/dragon/azugeros_flyIdle.glb',
  Fly: '/models/dragon/azugeros_fly.glb',
  FlyIdleAttack: '/models/dragon/azugeros_flyIdleAttack.glb',
  FlyLand: '/models/dragon/azugeros_flyLand.glb',
  Death: '/models/dragon/azugeros_death.glb',
} as const;

export function preloadDestinyModels(): void {
  preloadSkinnedIdleAndAnimationClips(DESTINY_IDLE_PATH, DESTINY_MODEL_PATHS, useGLTF.preload);
}

const TARGET_HEIGHT = 1.35;
const DESTINY_BIND_HEIGHT = 5.15;
const SCALE = TARGET_HEIGHT / DESTINY_BIND_HEIGHT;

const MODEL_Y_OFFSET = 0.042 * SCALE;

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

function phaseToAnim(
  phase: DestinyPhase,
  isWalking: boolean,
  isAttacking: boolean,
  swipeVariant: 1 | 2,
  isBreathing: boolean,
  isWingAttacking: boolean,
  _isFlyAttacking: boolean,
  isDying: boolean,
): DestinyAnimState {
  if (isDying) return 'death';

  // Air phases never use ground Breath (azugeros_roar).
  if (isDestinyAirPhase(phase)) {
    switch (phase) {
      case 'takeoff':
        return 'flyTakeoff';
      case 'fly_idle':
        return 'flyIdle';
      case 'fly_approach':
      case 'fly_return':
        return 'fly';
      case 'fly_attack':
        // Prefer flyIdleAttack for the whole fly_attack window (avoids roar / idle flash).
        return 'flyIdleAttack';
      case 'land':
        return 'flyLand';
      default:
        return 'flyIdle';
    }
  }

  if (isWingAttacking) return 'wingAttack';
  if (isBreathing) return 'breath';
  if (isAttacking) return swipeVariant === 2 ? 'rightSwipe' : 'leftSwipe';
  return isWalking ? 'walk' : 'idle';
}

export default React.memo(function DestinyModel({
  isWalking,
  isAttacking,
  swipeVariant,
  isBreathing,
  isWingAttacking,
  isFlyAttacking,
  phase,
  isDying,
}: DestinyModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(DESTINY_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(DESTINY_DEFERRED_PATHS);
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
        console.warn('Failed to load destiny animations:', error);
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

  // Every azugeros_*.glb ships the full WoW clip table — use exact names (wyvern pattern)
  // so loose prefixes cannot resolve flyIdleAttack → AttackUnarmed, etc.
  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand (ID 0 variation 0)', 'Stand'),
    [idleAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Run (ID 5 variation 0)', 'Walk (ID 4 variation 0)', 'Run', 'Walk'),
    [extraAnims.Walk],
  );
  const leftSwipeSource = useMemo(
    () => pickWowClip(extraAnims.LeftSwipe ?? [], 'AttackUnarmed (ID 16 variation 0)', 'AttackUnarmed'),
    [extraAnims.LeftSwipe],
  );
  const rightSwipeSource = useMemo(
    () => pickWowClip(extraAnims.RightSwipe ?? [], 'AttackUnarmed (ID 16 variation 1)', 'AttackUnarmed'),
    [extraAnims.RightSwipe],
  );
  const breathSource = useMemo(
    () => pickWowClip(extraAnims.Breath ?? [], 'EmoteRoar (ID 74 variation 0)', 'EmoteRoar', 'BattleRoar'),
    [extraAnims.Breath],
  );
  const wingAttackSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.WingAttack ?? [],
        'SpecialUnarmed (ID 118 variation 0)',
        'SpecialUnarmed',
      ),
    [extraAnims.WingAttack],
  );
  const flyTakeoffSource = useMemo(
    () => pickWowClip(extraAnims.FlyTakeoff ?? [], 'LiftOff (ID 192 variation 0)', 'LiftOff'),
    [extraAnims.FlyTakeoff],
  );
  const flyIdleSource = useMemo(
    () => pickWowClip(extraAnims.FlyIdle ?? [], 'Hover (ID 193 variation 0)', 'Hover'),
    [extraAnims.FlyIdle],
  );
  const flySource = useMemo(
    () => pickWowClip(extraAnims.Fly ?? [], 'Fly (ID 135 variation 0)', 'Fly'),
    [extraAnims.Fly],
  );
  const flyIdleAttackSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.FlyIdleAttack ?? [],
        'DragonSpitHover (ID 183 variation 0)',
        'DragonSpitHover',
        'DragonSpit',
      ),
    [extraAnims.FlyIdleAttack],
  );
  const flyLandSource = useMemo(
    () => pickWowClip(extraAnims.FlyLand ?? [], 'Land (ID 200 variation 0)', 'Land'),
    [extraAnims.FlyLand],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death (ID 1 variation 0)', 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('destiny-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('destiny-walk', walkSource, {
        stripRootMotion: true,
        renameTo: 'Walk',
      }),
      ...getCachedProcessedClips('destiny-left-swipe', leftSwipeSource, { renameTo: 'LeftSwipe' }),
      ...getCachedProcessedClips('destiny-right-swipe', rightSwipeSource, { renameTo: 'RightSwipe' }),
      ...getCachedProcessedClips('destiny-breath-roar', breathSource, { renameTo: 'Breath' }),
      ...getCachedProcessedClips('destiny-wing-attack', wingAttackSource, { renameTo: 'WingAttack' }),
      ...getCachedProcessedClips('destiny-fly-takeoff', flyTakeoffSource, {
        stripRootMotion: true,
        renameTo: 'FlyTakeoff',
      }),
      ...getCachedProcessedClips('destiny-fly-idle', flyIdleSource, {
        stripRootMotion: true,
        renameTo: 'FlyIdle',
      }),
      ...getCachedProcessedClips('destiny-fly', flySource, {
        stripRootMotion: true,
        renameTo: 'Fly',
      }),
      ...getCachedProcessedClips('destiny-fly-idle-attack', flyIdleAttackSource, {
        stripRootMotion: true,
        renameTo: 'FlyIdleAttack',
      }),
      ...getCachedProcessedClips('destiny-fly-land', flyLandSource, {
        stripRootMotion: true,
        renameTo: 'FlyLand',
      }),
      ...getCachedProcessedClips('destiny-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    walkSource,
    leftSwipeSource,
    rightSwipeSource,
    breathSource,
    wingAttackSource,
    flyTakeoffSource,
    flyIdleSource,
    flySource,
    flyIdleAttackSource,
    flyLandSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  type DestinyActionName =
    | 'Idle'
    | 'Walk'
    | 'LeftSwipe'
    | 'RightSwipe'
    | 'Breath'
    | 'WingAttack'
    | 'FlyTakeoff'
    | 'FlyIdle'
    | 'Fly'
    | 'FlyIdleAttack'
    | 'FlyLand'
    | 'Death';

  const getAction = (name: DestinyActionName): AnimationAction | null => actions[name] ?? null;

  const animToAction = (state: DestinyAnimState): AnimationAction | null => {
    switch (state) {
      case 'walk':
        return getAction('Walk');
      case 'leftSwipe':
        return getAction('LeftSwipe');
      case 'rightSwipe':
        return getAction('RightSwipe');
      case 'breath':
        return getAction('Breath');
      case 'wingAttack':
        return getAction('WingAttack');
      case 'flyTakeoff':
        return getAction('FlyTakeoff');
      case 'flyIdle':
        return getAction('FlyIdle');
      case 'fly':
        return getAction('Fly');
      case 'flyIdleAttack':
        return getAction('FlyIdleAttack');
      case 'flyLand':
        return getAction('FlyLand');
      case 'death':
        return getAction('Death');
      case 'idle':
      default:
        return getAction('Idle');
    }
  };

  /** Stretch / speed clips so they fill their gameplay windows (and walk matches move speed). */
  const timeScaleFor = (state: DestinyAnimState): number => {
    switch (state) {
      case 'walk':
        return 1.6;
      case 'breath':
        return EMOTE_ROAR_CLIP_SEC / (DESTINY_BREATH_ROAR_CAST_LOCK_MS / 1000);
      case 'wingAttack':
        return SPECIAL_UNARMED_CLIP_SEC / (DESTINY_WING_CAST_LOCK_MS / 1000);
      case 'flyIdleAttack':
        return DRAGON_SPIT_HOVER_CLIP_SEC / (DESTINY_FLY_ATTACK_CAST_MS / 1000);
      case 'flyTakeoff':
        return LIFTOFF_LAND_CLIP_SEC / (DESTINY_FLY_TAKEOFF_MS / 1000);
      case 'flyLand':
        return LIFTOFF_LAND_CLIP_SEC / (DESTINY_FLY_LAND_MS / 1000);
      default:
        return 1;
    }
  };

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > FlyAttack > WingAttack > Breath > Melee > phase locomotion
  useEffect(() => {
    if (!actions) return;

    const nextState = phaseToAnim(
      phase,
      isWalking,
      isAttacking,
      swipeVariant,
      isBreathing,
      isWingAttacking,
      isFlyAttacking,
      isDying,
    );
    const nextAction = animToAction(nextState);
    if (!nextAction) return;

    const once =
      nextState === 'death' ||
      nextState === 'leftSwipe' ||
      nextState === 'rightSwipe' ||
      nextState === 'breath' ||
      nextState === 'wingAttack' ||
      nextState === 'flyTakeoff' ||
      nextState === 'flyIdleAttack' ||
      nextState === 'flyLand';

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: once,
      clampWhenFinished: once,
      timeScale: timeScaleFor(nextState),
    });
  }, [phase, isWalking, isAttacking, swipeVariant, isBreathing, isWingAttacking, isFlyAttacking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToPhaseIdle = () => {
      if (isDying) return;
      // Keep flyIdleAttack clamped for the remainder of the cast window.
      if (phase === 'fly_attack') return;
      // Do not clobber an in-progress ground special / melee with locomotion.
      if (isWingAttacking || isBreathing || isAttacking) return;
      const fallbackState = phaseToAnim(
        phase,
        isWalking,
        isAttacking,
        swipeVariant,
        isBreathing,
        isWingAttacking,
        isFlyAttacking,
        false,
      );
      const fallback = animToAction(fallbackState);
      if (!fallback) return;
      const once = phase === 'takeoff' || phase === 'land';
      playEnemyAction(fallback, currentActionRef, mixer, {
        loopOnce: once,
        clampWhenFinished: once,
        fadeIn: 0.15,
        fadeOut: 0.15,
        timeScale: timeScaleFor(fallbackState),
      });
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      if (isWingAttacking || isBreathing) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (
        name === 'LeftSwipe' ||
        name === 'RightSwipe' ||
        name === 'Breath' ||
        name === 'WingAttack' ||
        name === 'FlyIdleAttack'
      ) {
        blendToPhaseIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, phase, isWalking, isAttacking, swipeVariant, isBreathing, isWingAttacking, isFlyAttacking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
