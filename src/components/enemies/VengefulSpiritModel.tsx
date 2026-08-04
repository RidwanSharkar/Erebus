'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import {
  filterAnimationTracksForRoot,
  getCachedProcessedClips,
} from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';
import { pickWowClip } from '@/utils/wowAnimationClips';

interface VengefulSpiritModelProps {
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isSummoning: boolean;
  isExpiring: boolean;
  scaleMultiplier?: number;
  /** Fired when the Summon clip finishes while isSummoning (animation-driven unlock). */
  onSummonFinished?: () => void;
}

const SPIRIT_IDLE_PATH = '/models/demonspawn/Abysslick_idle.glb';

const SPIRIT_MODEL_PATHS = [
  SPIRIT_IDLE_PATH,
  '/models/demonspawn/Abysslick_summon.glb',
  '/models/demonspawn/Abysslick_attack1.glb',
  '/models/demonspawn/Abysslick_attack2.glb',
];

const SPIRIT_DEFERRED_PATHS = {
  Summon: '/models/demonspawn/Abysslick_summon.glb',
  Attack: '/models/demonspawn/Abysslick_attack1.glb',
  Attack2: '/models/demonspawn/Abysslick_attack2.glb',
} as const;

export function preloadVengefulSpiritModels(): void {
  preloadSkinnedIdleAndAnimationClips(SPIRIT_IDLE_PATH, SPIRIT_MODEL_PATHS, useGLTF.preload);
}

/** Prefer filtered tracks when they survive; keep unfiltered if filter zeros everything. */
function bindClipToRoot(root: Group, clip: AnimationClip): AnimationClip {
  const filtered = filterAnimationTracksForRoot(root, clip);
  return filtered.tracks.length > 0 ? filtered : clip;
}

const TARGET_HEIGHT = 1.35;
const SPIRIT_BIND_HEIGHT = 2.0;
const SCALE = TARGET_HEIGHT / SPIRIT_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

export default React.memo(function VengefulSpiritModel({
  isAttacking,
  attackVariant,
  isSummoning,
  isExpiring,
  scaleMultiplier = 1,
  onSummonFinished,
}: VengefulSpiritModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const hasForcedSummonRef = useRef(false);
  const onSummonFinishedRef = useRef(onSummonFinished);
  onSummonFinishedRef.current = onSummonFinished;
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SPIRIT_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SPIRIT_DEFERRED_PATHS);
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
        console.warn('Failed to load vengeful spirit animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, SPIRIT_IDLE_PATH, {
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
    () => pickWowClip(idleAnims, 'Stand', 'Idle', 'Stand '),
    [idleAnims],
  );
  // Abysslick_summon.glb holds Emerge (spawn) and Submerge (despawn) — not SpellCastDirected.
  const summonSource = useMemo(
    () => pickWowClip(extraAnims.Summon ?? [], 'Emerge', 'Birth', 'Spawn', 'Summon'),
    [extraAnims.Summon],
  );
  const expireSource = useMemo(
    () => pickWowClip(extraAnims.Summon ?? [], 'Submerge', 'Death', 'Despawn'),
    [extraAnims.Summon],
  );
  const attackSource = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attack ?? [],
        'AttackUnarmed (ID 16 variation 0)',
        'AttackUnarmed',
        'Attack',
        'Combat',
      ),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () =>
      pickWowClip(
        extraAnims.Attack2 ?? [],
        'AttackUnarmed (ID 16 variation 1)',
        'AttackUnarmed (ID 16 variation 0)',
        'AttackUnarmed',
        'Attack',
        'Combat',
      ),
    [extraAnims.Attack2],
  );

  const hasAllDeferred = useMemo(
    () =>
      Object.keys(SPIRIT_DEFERRED_PATHS).every((key) => (extraAnims[key]?.length ?? 0) > 0),
    [extraAnims],
  );

  const animations = useMemo(() => {
    // Mirror ZombieModel: wait for all deferred clips before registering Summon/Attack.
    const idleClips = getCachedProcessedClips('vengeful-spirit-idle', idleSource, {
      stripRootMotion: true,
      renameTo: 'Idle',
    }).map((clip) => bindClipToRoot(clonedScene, clip));

    if (!hasAllDeferred) return idleClips;

    // Prefer unfiltered deferred clips when bind would strip all tracks (bone name mismatch).
    // Cache keys busted so old SpellCastDirected / wrong-attack picks are not reused.
    return [
      ...idleClips,
      ...getCachedProcessedClips('vengeful-spirit-summon-emerge-v2', summonSource, {
        stripRootMotion: true,
        renameTo: 'Summon',
      }).map((clip) => bindClipToRoot(clonedScene, clip)),
      ...getCachedProcessedClips('vengeful-spirit-expire-submerge-v2', expireSource, {
        stripRootMotion: true,
        renameTo: 'Expire',
      }).map((clip) => bindClipToRoot(clonedScene, clip)),
      ...getCachedProcessedClips('vengeful-spirit-attack1-v2', attackSource, {
        renameTo: 'Attack',
      }).map((clip) => bindClipToRoot(clonedScene, clip)),
      ...getCachedProcessedClips('vengeful-spirit-attack2-v2', attack2Source, {
        renameTo: 'Attack2',
      }).map((clip) => bindClipToRoot(clonedScene, clip)),
    ];
  }, [idleSource, summonSource, expireSource, attackSource, attack2Source, clonedScene, hasAllDeferred]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Summon' | 'Expire' | 'Attack' | 'Attack2',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Force Summon the moment deferred clips become available while still summoning.
  useEffect(() => {
    if (!hasAllDeferred || !isSummoning || hasForcedSummonRef.current) return;
    const summon = getAction('Summon');
    if (!summon) return;
    hasForcedSummonRef.current = true;
    playEnemyAction(summon, currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.05,
      fadeOut: 0.05,
    });
  }, [hasAllDeferred, isSummoning, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Priority: Expire > Attack > Summon > Idle (Attack must win so late summon flag cannot override).
  useEffect(() => {
    if (!actions || !hasAllDeferred) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isExpiring
      ? getAction('Expire') ?? getAction('Summon')
      : isAttacking
        ? getAction(attackClip)
        : isSummoning
          ? getAction('Summon')
          : getAction('Idle');

    if (!nextAction) return;

    // Re-trigger Expire / attack variants only — never restart Summon because of isAttacking.
    const nextName = nextAction.getClip().name;
    const forceRestart =
      nextAction === currentActionRef.current &&
      (nextName === 'Expire' || nextName === 'Attack' || nextName === 'Attack2');
    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isSummoning || isExpiring || isAttacking),
      clampWhenFinished: !!(isSummoning || isExpiring || isAttacking),
      fadeIn: isSummoning || isExpiring || isAttacking ? 0.1 : 0.15,
      fadeOut: isSummoning || isExpiring || isAttacking ? 0.1 : 0.15,
      forceRestart,
    });
  }, [isAttacking, attackVariant, isSummoning, isExpiring, actions, hasAllDeferred, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isExpiring) return;

    const blendToIdle = () => {
      if (isExpiring || isSummoning) return;
      playEnemyAction(getAction('Idle'), currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isExpiring) return;
      const name = e.action.getClip().name;
      if (name === 'Summon' && isSummoning) {
        onSummonFinishedRef.current?.();
        return;
      }
      if (name === 'Attack' || name === 'Attack2') {
        blendToIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isExpiring, isSummoning, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
