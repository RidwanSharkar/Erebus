'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

interface WyvernModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isBreathing: boolean;
  breathVariant: 1 | 2;
  isDying: boolean;
}

const WYVERN_IDLE_PATH = '/models/wyvern/drake_idle.glb';

const WYVERN_MODEL_PATHS = [
  WYVERN_IDLE_PATH,
  '/models/wyvern/drake_run.glb',
  '/models/wyvern/drake_attack.glb',
  '/models/wyvern/drake_attack2.glb',
  '/models/wyvern/drake_roar.glb',
  '/models/wyvern/drake_death.glb',
];

const WYVERN_DEFERRED_PATHS = {
  Run: '/models/wyvern/drake_run.glb',
  Attack: '/models/wyvern/drake_attack.glb',
  Breath1: '/models/wyvern/drake_attack2.glb',
  Breath2: '/models/wyvern/drake_roar.glb',
  Death: '/models/wyvern/drake_death.glb',
} as const;

export function preloadWyvernModels(): void {
  preloadSkinnedIdleAndAnimationClips(WYVERN_IDLE_PATH, WYVERN_MODEL_PATHS, useGLTF.preload);
}

const TARGET_HEIGHT = 3.65;
const WYVERN_BIND_HEIGHT = 5.15;
const SCALE = TARGET_HEIGHT / WYVERN_BIND_HEIGHT;

const MODEL_Y_OFFSET = 0.042 * SCALE;

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

export default React.memo(function WyvernModel({
  isWalking,
  isAttacking,
  isBreathing,
  breathVariant,
  isDying,
}: WyvernModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(WYVERN_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WYVERN_DEFERRED_PATHS);
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
        console.warn('Failed to load wyvern animations:', error);
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

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand (ID 0 variation 0)', 'Stand'),
    [idleAnims],
  );
  const runSource = useMemo(
    () => pickWowClip(extraAnims.Run ?? [], 'Run (ID 5 variation 0)', 'Run', 'Walk'),
    [extraAnims.Run],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'AttackUnarmed (ID 16 variation 0)', 'AttackUnarmed'),
    [extraAnims.Attack],
  );
  const breathAttack2Source = useMemo(
    () => pickWowClip(extraAnims.Breath1 ?? [], 'AttackUnarmed (ID 16 variation 1)', 'AttackUnarmed', 'DragonSpit'),
    [extraAnims.Breath1],
  );
  const breathRoarSource = useMemo(
    () => pickWowClip(extraAnims.Breath2 ?? [], 'BattleRoar (ID 55 variation 0)', 'BattleRoar', 'EmoteRoar', 'DragonSpit'),
    [extraAnims.Breath2],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death (ID 1 variation 0)', 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('wyvern-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('wyvern-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('wyvern-attack', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('wyvern-breath-attack2', breathAttack2Source, { renameTo: 'Breath1' }),
      ...getCachedProcessedClips('wyvern-breath-roar', breathRoarSource, { renameTo: 'Breath2' }),
      ...getCachedProcessedClips('wyvern-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    runSource,
    attackSource,
    breathAttack2Source,
    breathRoarSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Run' | 'Attack' | 'Breath1' | 'Breath2' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Breath > Melee Attack > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const breathClip = breathVariant === 2 ? 'Breath2' : 'Breath1';
    const nextAction = isDying
      ? getAction('Death')
      : isBreathing
        ? getAction(breathClip)
        : isAttacking
          ? getAction('Attack')
          : isWalking
            ? getAction('Run')
            : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking || isBreathing,
      clampWhenFinished: isDying || isAttacking || isBreathing,
    });
  }, [isWalking, isAttacking, isBreathing, breathVariant, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack' || name === 'Breath1' || name === 'Breath2') {
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
