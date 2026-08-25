'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

interface WyrmModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isCastingSpell: boolean;
  /** Server spell cast lock (ms) — stretch/compress Spell clip to match. */
  spellDurationMs?: number;
  isDying: boolean;
  scaleMultiplier?: number;
}

const WYRM_IDLE_PATH = '/models/wyrm/wyrmIdle_Stand.glb';

const WYRM_MODEL_PATHS = [
  WYRM_IDLE_PATH,
  '/models/wyrm/wyrmRun.glb',
  '/models/wyrm/wyrmClaws.glb',
  '/models/wyrm/wyrmBite.glb',
  '/models/wyrm/wyrmSpell.glb',
  '/models/wyrm/wyrmDeath.glb',
];

const WYRM_DEFERRED_PATHS = {
  Run: '/models/wyrm/wyrmRun.glb',
  Attack: '/models/wyrm/wyrmClaws.glb',
  Attack2: '/models/wyrm/wyrmBite.glb',
  Spell: '/models/wyrm/wyrmSpell.glb',
  Death: '/models/wyrm/wyrmDeath.glb',
} as const;

export function preloadWyrmModels(): void {
  preloadSkinnedIdleAndAnimationClips(WYRM_IDLE_PATH, WYRM_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** WoW wyrm — native bind height ~8.2; target near wyvern scale. */
const TARGET_HEIGHT = 3.8;
const WYRM_BIND_HEIGHT = 8.215;
const SCALE = TARGET_HEIGHT / WYRM_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.47 * SCALE;

/** Native SpellCastOmni length — keep in sync with backend WYRM_SPELL_CAST_LOCK_MS stretch. */
const SPELL_CLIP_SEC = 1.0;
const DEFAULT_SPELL_DURATION_MS = 2000;

export default React.memo(function WyrmModel({
  isWalking,
  isAttacking,
  attackVariant,
  isCastingSpell,
  spellDurationMs = DEFAULT_SPELL_DURATION_MS,
  isDying,
  scaleMultiplier = 1,
}: WyrmModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(WYRM_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WYRM_DEFERRED_PATHS);
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
        console.warn('Failed to load wyrm animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, WYRM_IDLE_PATH, {
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
    () => pickWowClip(idleAnims, 'Stand (ID 0 variation 0)', 'Stand'),
    [idleAnims],
  );
  const runSource = useMemo(
    () => pickWowClip(extraAnims.Run ?? [], 'Run (ID 5 variation 0)', 'Run', 'Walk'),
    [extraAnims.Run],
  );
  const attackSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attack ?? [],
        'AttackUnarmed (ID 16 variation 0)',
        'AttackUnarmed',
      ),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attack2 ?? [],
        'AttackUnarmed (ID 16 variation 1)',
        'AttackUnarmed',
      ),
    [extraAnims.Attack2],
  );
  const spellSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.Spell ?? [],
        'SpellCastOmni (ID 54 variation 0)',
        'SpellCastOmni',
        'SpellCastDirected',
        'ChannelCastOmni',
      ),
    [extraAnims.Spell],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death (ID 1 variation 0)', 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('wyrm-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('wyrm-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('wyrm-attack1', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('wyrm-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('wyrm-spell', spellSource, {
        stripRootMotion: true,
        renameTo: 'Spell',
      }),
      ...getCachedProcessedClips('wyrm-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    runSource,
    attackSource,
    attack2Source,
    spellSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Spell' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Spell > Attack > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isCastingSpell
        ? getAction('Spell')
        : isAttacking
          ? getAction(attackClip)
          : isWalking
            ? getAction('Run')
            : getAction('Idle');

    if (!nextAction) return;

    const spellTimeScale = isCastingSpell
      ? SPELL_CLIP_SEC / Math.max(0.25, spellDurationMs / 1000)
      : 1;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isCastingSpell || isAttacking,
      clampWhenFinished: isDying || isCastingSpell || isAttacking,
      fadeIn: isDying || isCastingSpell || isAttacking ? 0.15 : 0.2,
      timeScale: spellTimeScale,
    });
  }, [
    isWalking,
    isAttacking,
    attackVariant,
    isCastingSpell,
    spellDurationMs,
    isDying,
    actions,
    mixer,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death' || name === 'Spell') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isCastingSpell, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
