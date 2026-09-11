'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WyrmModel from './WyrmModel';
import EnemyMeleeAttackRangeRing, { WYRM_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { collectDeathFadeMaterials } from '@/utils/sharedEnemyMaterials';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface WyrmRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  visualScale?: number;
}

/** Match meleeProfiles.js wyrm swingLockMs / attackCooldown feel */
const ATTACK_DURATION = 850;
/** Keep in sync with backend WYRM_SPELL_CAST_LOCK_MS */
const SPELL_DURATION_MS = 2000;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

function WyrmRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  visualScale = 1,
}: WyrmRendererProps) {
  const hpTheme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [isCastingSpell, setIsCastingSpell] = useState(false);
  const [spellDurationMs, setSpellDurationMs] = useState(SPELL_DURATION_MS);

  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isCastingSpellRef = useRef(false);
  const isDyingRef = useRef(isDying);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spellFailsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  const clearSpellFailsafe = () => {
    if (spellFailsafeTimer.current) {
      clearTimeout(spellFailsafeTimer.current);
      spellFailsafeTimer.current = null;
    }
  };

  const restoreWalkIfUnlocked = () => {
    if (!isAttackingRef.current && !isCastingSpellRef.current && !isDyingRef.current) {
      isWalkingRef.current = true;
      setIsWalking(true);
    }
  };

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const locked = isAttackingRef.current || isCastingSpellRef.current;
    if (!locked) targetPosition.current.set(position.x, position.y, position.z);
    if (dist > 8.0 && groupRef.current && !locked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (attackTimer.current) clearTimeout(attackTimer.current);
      clearSpellFailsafe();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleTelegraph = (data: {
      wyrmId: string;
      attackVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.wyrmId !== id) return;
      if (isCastingSpellRef.current) return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      if (data.attackVariant === 1 || data.attackVariant === 2) {
        setAttackVariant(data.attackVariant);
      } else {
        setAttackVariant((prev) => (prev === 1 ? 2 : 1));
      }
      const visual = parseMeleeTelegraphPayload(data, WYRM_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimer.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackTimer.current = null;
      }, duration);
    };

    const handleWhiff = (data: { wyrmId: string }) => {
      if (data.wyrmId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const handleSpellTelegraph = (data: {
      wyrmId?: string;
      durationMs?: number;
    }) => {
      if (data.wyrmId !== id) return;
      if (attackTimer.current) {
        clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isAttackingRef.current = false;
      if (typeof data.durationMs === 'number' && data.durationMs > 0) {
        setSpellDurationMs(data.durationMs);
      }
      setIsCastingSpell(true);
      isCastingSpellRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      clearSpellFailsafe();
      const duration = data.durationMs ?? SPELL_DURATION_MS;
      spellFailsafeTimer.current = setTimeout(() => {
        setIsCastingSpell(false);
        isCastingSpellRef.current = false;
        restoreWalkIfUnlocked();
      }, duration + 250);
    };

    const handleSpellEnd = (data: { wyrmId?: string }) => {
      if (data.wyrmId !== id) return;
      clearSpellFailsafe();
      setIsCastingSpell(false);
      isCastingSpellRef.current = false;
      restoreWalkIfUnlocked();
    };

    socket.on('wyrm-attack-telegraph', handleTelegraph);
    socket.on('wyrm-attack-whiff', handleWhiff);
    socket.on('wyrm-spell-telegraph', handleSpellTelegraph);
    socket.on('wyrm-spell-end', handleSpellEnd);

    return () => {
      socket.off('wyrm-attack-telegraph', handleTelegraph);
      socket.off('wyrm-attack-whiff', handleWhiff);
      socket.off('wyrm-spell-telegraph', handleSpellTelegraph);
      socket.off('wyrm-spell-end', handleSpellEnd);
      if (attackTimer.current) clearTimeout(attackTimer.current);
      clearSpellFailsafe();
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isAttackingRef.current || isCastingSpellRef.current;
    updateEnemyWalkStateFromMoveDist(
      dist,
      isLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        cachedDeathMats.current = collectDeathFadeMaterials(group);
        deathCacheBuilt.current = true;
      }

      const op = opacity.current;
      for (let i = 0; i < cachedDeathMats.current.length; i++) {
        cachedDeathMats.current[i].opacity = op;
      }
    }
  });

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <WyrmModel
        isWalking={isWalking && !isCastingSpell}
        isAttacking={isAttacking && !isCastingSpell}
        attackVariant={attackVariant}
        isCastingSpell={isCastingSpell}
        spellDurationMs={spellDurationMs}
        isDying={isDying}
        scaleMultiplier={visualScale}
      />

      {isAttacking && !isDying && !isCastingSpell && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? WYRM_MELEE_ATTACK_RANGE}
          hitDelayMs={meleeTelegraph?.hitDelayMs}
          swingLockMs={meleeTelegraph?.swingLockMs}
          arcDeg={meleeTelegraph?.arcDeg}
          facing={meleeTelegraph?.facing}
          weightClass={meleeTelegraph?.weightClass}
          whiffed={meleeTelegraph?.whiffed}
          startedAtMs={meleeTelegraph?.startedAtMs}
          commitAtMs={meleeTelegraph?.commitAtMs}
        />
      )}

      <Billboard position={[0, 2.8 * visualScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={campType ? hpTheme.background : '#1a0a0a'}
              fillColor={campType ? hpTheme.fill : '#aa7700'}
            />

            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('wyrm')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={campType ? hpTheme.text : '#ffccaa'}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(WyrmRenderer);
