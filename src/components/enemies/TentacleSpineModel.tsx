'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, LoopOnce, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import {
  filterAnimationTracksForRoot,
  invalidateProcessedClipCache,
  stripRootMotionXZ,
} from '@/utils/enemyAnimationClipCache';
import {
  TENTACLE_SPINE_ATTACK_CLIP_MS,
  TENTACLE_SPINE_WINDUP_MS,
} from '@/utils/tentacleSpineClientConstants';

interface TentacleSpineModelProps {
  isAttacking: boolean;
  /** Client-resolved timestamp (ms) when windup started — drives clock-synced attack playback. */
  attackStartedAt: number | null;
  /** Server timestamp (ms) when slam fires — snaps attack to 50% if client is behind. */
  slamAt: number | null;
  isDying: boolean;
}

/**
 * Mesh + Death from tentacle_death.glb; Idle Stand from tentacle_idle.glb.
 * AttackUnarmed timing donor: tentacle_attack.glb (MassiveTentacle mesh unused —
 * death GLB AttackUnarmed var0 has corrupt ~825s duration).
 */
const ATTACK_MODEL_PATH = '/models/spine/tentacle_attack.glb';
const DEATH_MODEL_PATH = '/models/spine/tentacle_death.glb';
const IDLE_MODEL_PATH = '/models/spine/tentacle_idle.glb';

export function preloadTentacleSpineModels(): void {
  useGLTF.preload(ATTACK_MODEL_PATH);
  useGLTF.preload(DEATH_MODEL_PATH);
  useGLTF.preload(IDLE_MODEL_PATH);
}

/** Bind height from JadeTentacle mesh bbox (~18.92). */
const BIND_HEIGHT = 22.92;
const TARGET_HEIGHT = 13;
const SCALE = TARGET_HEIGHT / BIND_HEIGHT;
/** Horizontal slim-down; Y (height) stays at SCALE. */
const WIDTH_SCALE = 0.65;
/** JadeTentacle bind pose min Y ≈ -2.80. */
const MODEL_Y_OFFSET = 2.80 * SCALE - 0.75;

const ATTACK_CLIP_S = TENTACLE_SPINE_ATTACK_CLIP_MS / 1000;
const ATTACK_STRIKE_S = TENTACLE_SPINE_WINDUP_MS / 1000;

/** Exact WoW clip names — never fall back to clips[0]. */
const IDLE_CLIP_NAME = 'Stand (ID 0 variation 0)';
const ATTACK_CLIP_NAME = 'AttackUnarmed (ID 16 variation 0)';
const DEATH_CLIP_NAME = 'Death (ID 1 variation 0)';

/**
 * AttackUnarmed var0 ≈ 1.666s / ~23 tracks on MassiveTentacle donor.
 * After retarget onto JadeTentacle (~17 shared bones), track count drops — allow both.
 */
const ATTACK_DURATION_MIN = 1.5;
const ATTACK_DURATION_MAX = 1.9;
const ATTACK_TRACK_COUNT_MIN = 15;
const ATTACK_TRACK_COUNT_MAX = 26;

function pickWowClipExact(clips: AnimationClip[], ...names: string[]): AnimationClip | null {
  for (const name of names) {
    const match = clips.find((c) => c.name === name || c.name.startsWith(name));
    if (match) return match;
  }
  return null;
}

function renameClip(clip: AnimationClip, name: string): AnimationClip {
  const renamed = clip.clone();
  renamed.name = name;
  (renamed as AnimationClip & { userData: Record<string, unknown> }).userData = {
    ...(clip as AnimationClip & { userData?: Record<string, unknown> }).userData,
    wowName: clip.name,
  };
  return renamed;
}

function getWowName(clip: AnimationClip): string {
  const fromData = (clip as AnimationClip & { userData?: { wowName?: string } }).userData?.wowName;
  return String(fromData ?? clip.name);
}

function isValidAttackUnarmed(clip: AnimationClip, expectedWowName?: string | null): boolean {
  const wowName = expectedWowName || getWowName(clip);
  const durationOk = clip.duration >= ATTACK_DURATION_MIN && clip.duration <= ATTACK_DURATION_MAX;
  const tracksOk =
    clip.tracks.length >= ATTACK_TRACK_COUNT_MIN && clip.tracks.length <= ATTACK_TRACK_COUNT_MAX;
  const nameOk =
    wowName.includes('AttackUnarmed') || (clip.name === 'Attack' && durationOk && tracksOk);
  return durationOk && tracksOk && nameOk;
}

// Bust any poisoned Attack cache from earlier Custom1 / MassiveTentacle scene picks.
invalidateProcessedClipCache('tentacle-spine-attack');
invalidateProcessedClipCache('tentacle-spine-death');
invalidateProcessedClipCache('tentacle-spine-idle');

let didLogClips = false;

export default React.memo(function TentacleSpineModel({
  isAttacking,
  attackStartedAt,
  slamAt,
  isDying,
}: TentacleSpineModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const isDyingRef = useRef(isDying);
  const isAttackingRef = useRef(isAttacking);
  const attackStartedAtRef = useRef(attackStartedAt);
  const slamAtRef = useRef(slamAt);
  const slamSnappedRef = useRef(false);
  const lastAttackStartedAtRef = useRef<number | null>(null);
  const attackFinishedRef = useRef(false);
  const attackOriginalNameRef = useRef<string | null>(null);

  // Mesh + Death clips from death GLB; Idle Stand from idle GLB.
  const { scene, animations: deathAnims } = useGLTF(DEATH_MODEL_PATH);
  const { animations: idleAnims } = useGLTF(IDLE_MODEL_PATH);
  // AttackUnarmed timing donor only (MassiveTentacle scene unused).
  const { animations: attackAnims } = useGLTF(ATTACK_MODEL_PATH);

  // Layout so useFrame sees death before the next attack scrub tick.
  useLayoutEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);
  useEffect(() => {
    isAttackingRef.current = isAttacking;
  }, [isAttacking]);
  useEffect(() => {
    attackStartedAtRef.current = attackStartedAt;
  }, [attackStartedAt]);
  useEffect(() => {
    slamAtRef.current = slamAt;
  }, [slamAt]);

  const clonedScene = useMemo(() => {
    return cloneEnemySceneWithSharedMaterials(scene, ATTACK_MODEL_PATH, {
      selfIlluminationIntensity: UNIT_SELF_ILLUMINATION_INTENSITY,
      castShadow: true,
      receiveShadow: true,
    });
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleRaw = useMemo(
    () => pickWowClipExact(idleAnims, IDLE_CLIP_NAME, 'Stand'),
    [idleAnims],
  );
  // Attack from MassiveTentacle donor — keep ~1.666s timing; never death GLB var0 (~825s).
  const attackRaw = useMemo(
    () => pickWowClipExact(attackAnims, ATTACK_CLIP_NAME, 'AttackUnarmed (ID 16 variation 0)'),
    [attackAnims],
  );
  const deathRaw = useMemo(
    () => pickWowClipExact(deathAnims, DEATH_CLIP_NAME, 'Death'),
    [deathAnims],
  );

  const animations = useMemo(() => {
    if (!didLogClips && (idleRaw || attackRaw || deathRaw)) {
      didLogClips = true;
      console.warn('[TentacleSpine] clips', {
        idle: idleRaw?.name,
        idleSource: IDLE_MODEL_PATH,
        attack: attackRaw?.name,
        death: deathRaw?.name,
        deathSource: DEATH_MODEL_PATH,
        attackDuration: attackRaw?.duration,
        attackTrackCount: attackRaw?.tracks.length,
        deathDuration: deathRaw?.duration,
        deathTrackCount: deathRaw?.tracks.length,
      });
    }
    if (!idleRaw) {
      console.warn(
        `[TentacleSpine] Idle clip not found in idle GLB (wanted ${IDLE_CLIP_NAME} | Stand); refusing clips[0] fallback`,
      );
    }
    if (!attackRaw) {
      console.warn(
        `[TentacleSpine] Attack clip not found in attack donor (wanted ${ATTACK_CLIP_NAME}); refusing clips[0] fallback`,
      );
    } else if (!isValidAttackUnarmed(attackRaw)) {
      console.error('[TentacleSpine] Attack clip failed AttackUnarmed assert', {
        name: attackRaw.name,
        duration: attackRaw.duration,
        trackCount: attackRaw.tracks.length,
      });
    }
    if (!deathRaw) {
      console.warn(
        `[TentacleSpine] Death clip not found in death GLB (wanted ${DEATH_CLIP_NAME}); refusing clips[0] fallback`,
      );
    }

    const built: AnimationClip[] = [];
    if (idleRaw) {
      built.push(stripRootMotionXZ(renameClip(idleRaw, 'Idle')));
    }
    if (attackRaw) {
      built.push(renameClip(attackRaw, 'Attack'));
    }
    if (deathRaw) {
      built.push(renameClip(deathRaw, 'Death'));
    }
    return built.map((clip) => {
      // Retarget MassiveTentacle attack tracks onto JadeTentacle bones (drops unmatched).
      const filtered = filterAnimationTracksForRoot(clonedScene, clip);
      const wowName = getWowName(clip);
      (filtered as AnimationClip & { userData: Record<string, unknown> }).userData = {
        ...(filtered as AnimationClip & { userData?: Record<string, unknown> }).userData,
        wowName,
      };
      return filtered;
    });
  }, [idleRaw, attackRaw, deathRaw, clonedScene]);

  useEffect(() => {
    attackOriginalNameRef.current = attackRaw?.name ?? null;
  }, [attackRaw]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Attack' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  const stopDeathHard = () => {
    const death = getAction('Death');
    if (!death) return;
    death.stop();
    death.enabled = false;
    death.weight = 0;
  };

  const stopAttackHard = () => {
    const attack = getAction('Attack');
    if (!attack) return;
    attack.paused = false;
    attack.stop();
    attack.enabled = false;
    attack.weight = 0;
  };

  const stopIdleHard = () => {
    const idle = getAction('Idle');
    if (!idle) return;
    idle.stop();
    idle.enabled = false;
    idle.weight = 0;
  };

  const blendToIdle = () => {
    if (isDyingRef.current) return;
    stopDeathHard();
    playEnemyAction(getAction('Idle'), currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
  };

  // Dying-aware: never re-kick Stand over Death (LoopOnce ends with isRunning() === false).
  const posed = useEnemyIdlePose({
    actions,
    mixer,
    currentActionRef,
    resolveIdle: () => (isDyingRef.current ? null : actions?.Idle ?? null),
  });

  // Dedicated death path — hard-cut Attack + Idle so bind/Stand cannot cover Death.
  useEffect(() => {
    if (!actions || !isDying) return;
    attackFinishedRef.current = true;
    stopAttackHard();
    stopIdleHard();
    const death = getAction('Death');
    if (!death) {
      console.warn('[TentacleSpine] isDying but Death action missing after clips loaded');
      return;
    }
    playEnemyAction(death, currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      forceRestart: true,
      instant: true,
    });
  }, [isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attack > Idle (death handled above).
  useEffect(() => {
    if (!actions || isDying) return;

    if (isAttacking) {
      const attack = getAction('Attack');
      if (!attack) {
        console.warn('[TentacleSpine] isAttacking but Attack action missing after clips loaded');
        return;
      }

      const clip = attack.getClip();
      if (!isValidAttackUnarmed(clip, attackOriginalNameRef.current ?? attackRaw?.name)) {
        const fresh = pickWowClipExact(attackAnims, ATTACK_CLIP_NAME);
        console.error('[TentacleSpine] refusing Attack — not AttackUnarmed', {
          boundName: clip.name,
          wowName: getWowName(clip),
          duration: clip.duration,
          trackCount: clip.tracks.length,
          freshName: fresh?.name,
          freshDuration: fresh?.duration,
        });
        return;
      }

      const isNewAttack =
        attackStartedAt != null && attackStartedAt !== lastAttackStartedAtRef.current;
      if (attack === currentActionRef.current && !isNewAttack) return;

      if (attackStartedAt != null) lastAttackStartedAtRef.current = attackStartedAt;
      slamSnappedRef.current = false;
      attackFinishedRef.current = false;

      stopDeathHard();
      currentActionRef.current?.fadeOut(0.15);
      attack.setLoop(LoopOnce, 1);
      attack.clampWhenFinished = true;
      // Paused + manual time so wall-clock sync does not fight mixer delta.
      attack.reset();
      attack.paused = true;
      attack.enabled = true;
      attack.weight = 1;
      attack.fadeIn(0.1).play();
      if (attackStartedAt != null) {
        const elapsed = Math.max(0, (Date.now() - attackStartedAt) / 1000);
        attack.time = Math.min(elapsed, Math.min(attack.getClip().duration, ATTACK_CLIP_S));
      }
      currentActionRef.current = attack;
      return;
    }

    if (currentActionRef.current?.getClip().name === 'Idle') return;
    if (currentActionRef.current?.getClip().name === 'Death') return;
    blendToIdle();
  }, [isAttacking, attackStartedAt, isDying, actions, attackAnims]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDyingRef.current) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack') {
        attackFinishedRef.current = true;
        blendToIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (isDyingRef.current) return;
    const attack = getAction('Attack');
    if (!attack || currentActionRef.current !== attack) return;
    if (!isAttackingRef.current || attackStartedAtRef.current == null) return;
    if (attackFinishedRef.current) return;

    const startedAt = attackStartedAtRef.current;
    const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
    const clipDur = Math.min(attack.getClip().duration, ATTACK_CLIP_S);
    let t = Math.min(elapsed, clipDur);

    // Late / lagged clients: snap to strike midpoint when slam fires.
    const slam = slamAtRef.current;
    if (slam != null && !slamSnappedRef.current) {
      if (t < ATTACK_STRIKE_S) t = ATTACK_STRIKE_S;
      slamSnappedRef.current = true;
    }

    attack.paused = true;
    attack.enabled = true;
    attack.time = t;

    if (t >= clipDur - 1e-3) {
      attackFinishedRef.current = true;
      blendToIdle();
    }
  });

  return (
    <group ref={sceneGroupRef} visible={posed}>
      {/* WoW spine faces +X; game yaw (atan2 dx,dz) assumes +Z forward. */}
      <group
        scale={[SCALE * WIDTH_SCALE, SCALE, SCALE * WIDTH_SCALE]}
        position={[0, MODEL_Y_OFFSET, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
