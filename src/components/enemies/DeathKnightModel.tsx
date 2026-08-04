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

interface DeathKnightModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isHeartstriking: boolean;
  heartstrikeVariant: 1 | 2;
  isCasting: boolean;
  isDying: boolean;
}

const DEATH_KNIGHT_IDLE_PATH = '/models/deathknight/deathknight_idle.glb';
/** attack0–3 GLBs are byte-identical WoW bundles — load once and pick distinct 2H clips. */
const DEATH_KNIGHT_ATTACK_BUNDLE_PATH = '/models/deathknight/deathknight_attack0.glb';
const DEATH_KNIGHT_CAST_PATH = '/models/deathknight/deathknight_cast.glb';

const DEATH_KNIGHT_MODEL_PATHS = [
  DEATH_KNIGHT_IDLE_PATH,
  '/models/deathknight/deathknight_walk.glb',
  DEATH_KNIGHT_ATTACK_BUNDLE_PATH,
  DEATH_KNIGHT_CAST_PATH,
  '/models/deathknight/deathKnight_death.glb',
];

const DEATH_KNIGHT_DEFERRED_PATHS = {
  Walk: '/models/deathknight/deathknight_walk.glb',
  Attacks: DEATH_KNIGHT_ATTACK_BUNDLE_PATH,
  Cast: DEATH_KNIGHT_CAST_PATH,
  Death: '/models/deathknight/deathKnight_death.glb',
} as const;

export function preloadDeathKnightModels(): void {
  preloadSkinnedIdleAndAnimationClips(DEATH_KNIGHT_IDLE_PATH, DEATH_KNIGHT_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

const TARGET_HEIGHT = 2.95;
const DEATH_KNIGHT_BIND_HEIGHT = 2.43;
const SCALE = TARGET_HEIGHT / DEATH_KNIGHT_BIND_HEIGHT;

const MODEL_Y_OFFSET = 0.4 * SCALE;

export default React.memo(function DeathKnightModel({
  isWalking,
  isAttacking,
  attackVariant,
  isHeartstriking,
  heartstrikeVariant,
  isCasting,
  isDying,
}: DeathKnightModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(DEATH_KNIGHT_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(DEATH_KNIGHT_DEFERRED_PATHS);
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
        console.warn('Failed to load death knight animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, DEATH_KNIGHT_IDLE_PATH, {
      selfIlluminationIntensity: null,
      castShadow: true,
      receiveShadow: true,
    });
    // Arthas export embeds helm/sword/shoulders as skinned geosets — do not call
    // bindWowAttachmentItems (its hideStrayGlowShellMeshes keeps only the largest geoset).
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Ready2H', 'Stand'),
    [idleAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  // Bare 'Attack' picks Attack1H for every slot — use exact 2H variants from the shared bundle.
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attacks ?? [], 'Attack2H (ID 18 variation 0)', 'Attack2H'),
    [extraAnims.Attacks],
  );
  const attack2Source = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attacks ?? [],
        'Attack2H (ID 18 variation 1)',
        'Attack2H (ID 18 variation 0)',
      ),
    [extraAnims.Attacks],
  );
  const heartstrikeSource = useMemo(
    () => pickWowClip(extraAnims.Attacks ?? [], 'Attack2HL (ID 19 variation 0)', 'Attack2HL'),
    [extraAnims.Attacks],
  );
  const heartstrike2Source = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attacks ?? [],
        'Attack2HL (ID 19 variation 1)',
        'Attack2HL (ID 19 variation 0)',
      ),
    [extraAnims.Attacks],
  );
  const castSource = useMemo(
    () => pickWowClip(extraAnims.Cast ?? [], 'Spell', 'Cast', 'Ready', 'Attack'),
    [extraAnims.Cast],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(
    () => {
      const clips = [
        ...getCachedProcessedClips('death-knight-idle', idleSource, {
          stripRootMotion: true,
          renameTo: 'Idle',
        }),
        ...getCachedProcessedClips('death-knight-walk', walkSource, {
          stripRootMotion: true,
          renameTo: 'Walk',
        }),
        ...getCachedProcessedClips('death-knight-attack0', attackSource, { renameTo: 'Attack' }),
        ...getCachedProcessedClips('death-knight-attack1', attack2Source, { renameTo: 'Attack2' }),
        ...getCachedProcessedClips('death-knight-attack2', heartstrikeSource, {
          renameTo: 'Heartstrike',
        }),
        ...getCachedProcessedClips('death-knight-attack3', heartstrike2Source, {
          renameTo: 'Heartstrike2',
        }),
        ...getCachedProcessedClips('death-knight-cast', castSource, { renameTo: 'Cast' }),
        ...getCachedProcessedClips('death-knight-death', deathSource, { renameTo: 'Death' }),
      ];
      return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
    },
    [
      idleSource,
      walkSource,
      attackSource,
      attack2Source,
      heartstrikeSource,
      heartstrike2Source,
      castSource,
      deathSource,
      clonedScene,
    ],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Heartstrike' | 'Heartstrike2' | 'Cast' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Cast > Heartstrike > Attack > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const heartstrikeClip = heartstrikeVariant === 2 ? 'Heartstrike2' : 'Heartstrike';
    const nextAction = isDying
      ? getAction('Death')
      : isCasting
        ? getAction('Cast')
        : isHeartstriking
          ? getAction(heartstrikeClip)
          : isAttacking
            ? getAction(attackClip)
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking || isHeartstriking || isCasting,
      clampWhenFinished: isDying || isAttacking || isHeartstriking || isCasting,
    });
  }, [isWalking, isAttacking, isHeartstriking, isCasting, isDying, attackVariant, heartstrikeVariant, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (
        name === 'Attack' ||
        name === 'Attack2' ||
        name === 'Heartstrike' ||
        name === 'Heartstrike2' ||
        name === 'Cast'
      ) {
        // Hold Cast while isCasting remains true; otherwise fall back to walk/idle.
        if (name === 'Cast' && isCasting) return;
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isCasting, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
