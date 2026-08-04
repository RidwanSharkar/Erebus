'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

interface SerpentModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  scaleMultiplier?: number;
}

const SERPENT_IDLE_PATH = '/models/serpent/serpent_idle.glb';

const SERPENT_MODEL_PATHS = [
  SERPENT_IDLE_PATH,
  '/models/serpent/serpent_slither.glb',
  '/models/serpent/serpent_attack.glb',
  '/models/serpent/serpent_attack2.glb',
  '/models/serpent/serpent_death.glb',
  '/models/serpent/serpent_impact.glb',
];

const SERPENT_DEFERRED_PATHS = {
  Slither: '/models/serpent/serpent_slither.glb',
  Attack: '/models/serpent/serpent_attack.glb',
  Attack2: '/models/serpent/serpent_attack2.glb',
  Death: '/models/serpent/serpent_death.glb',
  Impact: '/models/serpent/serpent_impact.glb',
} as const;

export function preloadSerpentModels(): void {
  preloadSkinnedIdleAndAnimationClips(SERPENT_IDLE_PATH, SERPENT_MODEL_PATHS, useGLTF.preload);
}

const TARGET_HEIGHT = 1.85;
const SERPENT_BIND_HEIGHT = 2.02;
const SCALE = TARGET_HEIGHT / SERPENT_BIND_HEIGHT;

const MODEL_Y_OFFSET = 0.706 * SCALE;

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

export default React.memo(function SerpentModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  scaleMultiplier = 1,
}: SerpentModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SERPENT_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SERPENT_DEFERRED_PATHS);
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
        console.warn('Failed to load serpent animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, SERPENT_IDLE_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: false,
      receiveShadow: false,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand (ID 0 variation 0)', 'Stand'),
    [idleAnims],
  );
  const slitherSource = useMemo(
    () => pickWowClip(extraAnims.Slither ?? [], 'Walk (ID 4 variation 0)', 'Walk', 'Run'),
    [extraAnims.Slither],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'AttackUnarmed (ID 16 variation 0)', 'AttackUnarmed'),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () => pickWowClip(extraAnims.Attack2 ?? [], 'AttackUnarmed (ID 16 variation 1)', 'AttackUnarmed'),
    [extraAnims.Attack2],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death (ID 1 variation 0)', 'Death'),
    [extraAnims.Death],
  );
  const impactSource = useMemo(
    () => pickWowClip(extraAnims.Impact ?? [], 'CombatWound (ID 9 variation 0)', 'CombatWound'),
    [extraAnims.Impact],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('serpent-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('serpent-slither', slitherSource, {
        stripRootMotion: true,
        renameTo: 'Slither',
      }),
      ...getCachedProcessedClips('serpent-attack', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('serpent-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('serpent-death', deathSource, { renameTo: 'Death' }),
      ...getCachedProcessedClips('serpent-impact', impactSource, { renameTo: 'Impact' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    slitherSource,
    attackSource,
    attack2Source,
    deathSource,
    impactSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Slither' | 'Attack' | 'Attack2' | 'Death' | 'Impact',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Attack > Impact > Slither > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : isImpacting
          ? getAction('Impact')
          : isWalking
            ? getAction('Slither')
            : getAction('Idle');

    if (!nextAction) return;

    const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
    if (isImpacting) lastImpactPlayKeyRef.current = impactPlayKey;
    else lastImpactPlayKeyRef.current = -1;

    // playEnemyAction skips only when same action is still running at positive weight;
    // after drei stopAllAction() it restarts instead of stranding bind pose.
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking || isImpacting,
      clampWhenFinished: isDying || isAttacking || isImpacting,
      fadeIn: isDying ? 0.15 : 0.2,
      forceRestart: retriggerImpact,
    });
  }, [isWalking, isAttacking, attackVariant, isDying, isImpacting, impactPlayKey, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        const fallback = isWalking ? getAction('Slither') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Slither') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE * scaleMultiplier} position={[0, MODEL_Y_OFFSET * scaleMultiplier, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
