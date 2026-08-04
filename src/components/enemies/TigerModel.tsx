'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

interface TigerModelProps {
  isWalking: boolean;
  /** When walking + running locomotion, prefer run clip over walk. */
  isRunning?: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isPouncing?: boolean;
  /** Server pounce flight duration (ms) — stretch/compress clip to match. */
  pounceDurationMs?: number;
  scaleMultiplier?: number;
}

const TIGER_IDLE_PATH = '/models/tiger/Tiger_idle.glb';

const TIGER_MODEL_PATHS = [
  TIGER_IDLE_PATH,
  '/models/tiger/Tiger_walk.glb',
  '/models/tiger/Tiger_run.glb',
  '/models/tiger/Tiger_attack1.glb',
  '/models/tiger/Tiger_attack2.glb',
  '/models/tiger/Tiger_pounce.glb',
  '/models/tiger/Tiger_death.glb',
];

const TIGER_DEFERRED_PATHS = {
  Walk: '/models/tiger/Tiger_walk.glb',
  Run: '/models/tiger/Tiger_run.glb',
  Attack: '/models/tiger/Tiger_attack1.glb',
  Attack2: '/models/tiger/Tiger_attack2.glb',
  Pounce: '/models/tiger/Tiger_pounce.glb',
  Death: '/models/tiger/Tiger_death.glb',
} as const;

export function preloadTigerModels(): void {
  preloadSkinnedIdleAndAnimationClips(TIGER_IDLE_PATH, TIGER_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** WoW ApexTiger — native bind height ~2.95; companion target ~waist-high. */
const TARGET_HEIGHT = 3.1;
const TIGER_BIND_HEIGHT = 2.952;
const SCALE = TARGET_HEIGHT / TIGER_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

const DEFAULT_POUNCE_DURATION_MS = 850;

export default React.memo(function TigerModel({
  isWalking,
  isRunning = false,
  isAttacking,
  attackVariant,
  isDying,
  isPouncing = false,
  pounceDurationMs = DEFAULT_POUNCE_DURATION_MS,
  scaleMultiplier = 1,
}: TigerModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(TIGER_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(TIGER_DEFERRED_PATHS);
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
        console.warn('Failed to load tiger animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, TIGER_IDLE_PATH, {
      selfIlluminationIntensity: null,
      castShadow: false,
      receiveShadow: false,
    });
    hideStrayGlowShellMeshes(clone);
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand', 'Stand '),
    [idleAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  const runSource = useMemo(
    () => pickWowClip(extraAnims.Run ?? [], 'Run', 'Sprint', 'Walk'),
    [extraAnims.Run],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'AttackUnarmed', 'Attack', 'DruidCatClaw'),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () => pickWowClip(extraAnims.Attack2 ?? [], 'AttackUnarmed', 'Attack', 'DruidCatRip'),
    [extraAnims.Attack2],
  );
  const pounceSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.Pounce ?? [],
        // Exact first — bare 'Attack' matches AttackUnarmed before DruidCatPounce.
        'DruidCatPounce (ID 170 variation 0)',
        'DruidCatPounce',
        'Jump (ID 38 variation 0)',
      ),
    [extraAnims.Pounce],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('tiger-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('tiger-walk', walkSource, {
        stripRootMotion: true,
        renameTo: 'Walk',
      }),
      ...getCachedProcessedClips('tiger-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('tiger-attack1', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('tiger-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('tiger-pounce', pounceSource, {
        stripRootMotion: true,
        renameTo: 'Pounce',
      }),
      ...getCachedProcessedClips('tiger-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    walkSource,
    runSource,
    attackSource,
    attack2Source,
    pounceSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Run' | 'Attack' | 'Attack2' | 'Pounce' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Pounce > Attack > Walk/Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const locomoteClip = isRunning ? 'Run' : 'Walk';
    const nextAction = isDying
      ? getAction('Death')
      : isPouncing
        ? getAction('Pounce')
        : isAttacking
          ? getAction(attackClip)
          : isWalking
            ? getAction(locomoteClip)
            : getAction('Idle');

    if (!nextAction) return;

    const pounceTimeScale = isPouncing
      ? Math.max(1, nextAction.getClip().duration * 1000) / Math.max(1, pounceDurationMs)
      : 1;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isPouncing || isAttacking,
      clampWhenFinished: isDying || isPouncing || isAttacking,
      fadeIn: isDying || isPouncing || isAttacking ? 0.15 : 0.2,
      timeScale: pounceTimeScale,
    });
  }, [isWalking, isRunning, isAttacking, attackVariant, isDying, isPouncing, pounceDurationMs, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death' || name === 'Pounce') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking
          ? getAction(isRunning ? 'Run' : 'Walk')
          : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isRunning, isPouncing, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalScale = SCALE * scaleMultiplier;

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group
        scale={[finalScale, finalScale, finalScale]}
        position={[0, MODEL_Y_OFFSET, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
