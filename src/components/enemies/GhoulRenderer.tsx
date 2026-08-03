'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import GhoulModel from './GhoulModel';
import KnightSoulEffect from './KnightSoulEffect';
import EnemyMeleeAttackRangeRing, { GHOUL_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import EnemyStaggerBar from './EnemyStaggerBar';
import { applyEnemyHealthBarFill, syncEnemyHealthBarFillFromRef, syncEnemyHealthBarNumericTextFromRef } from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getUnitNameplateName } from '@/utils/enemyDisplayNames';
import { campHpTheme } from '@/utils/campHpTheme';

const GHOUL_HP_BAR_WIDTH = 1.8;
const GHOUL_HP_BAR_HEIGHT = 0.22;
const GHOUL_HP_BAR_FILL_HEIGHT = 0.20;

interface GhoulRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
  campType?: string;
  skipSummon?: boolean;
  /** Compact ground soul ring + orb (e.g. allied demon yellow). */
  soulType?: 'yellow' | 'green' | 'red' | 'blue' | 'purple' | 'orange';
  /** When false, hides the red melee telegraph ring (e.g. allied demon). */
  showMeleeRangeRing?: boolean;
}

const ATTACK_DURATION  = 1200; // ms — matches ghoul attack clip; backend `meleeLockUntil` uses the same window
const SUMMON_DURATION  = 2500; // ms — ghoul_summon clip plays on first spawn
const FADE_DURATION    = 1.5;  // seconds
const LERP_SPEED       = 14;
const WALK_STOP_DELAY  = 250;  // ms

function GhoulRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 1,
  campType,
  skipSummon = false,
  soulType,
  showMeleeRangeRing = true,
}: GhoulRendererProps) {
  const hpTheme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking,    setIsAttacking]    = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWalking,      setIsWalking]      = useState(false);
  const [isSummoning,    setIsSummoning]    = useState(!skipSummon);
  const [attackVariant,  setAttackVariant]  = useState<1 | 2>(1);
  const [isImpacting,    setIsImpacting]    = useState(false);
  const [impactPlayKey,  setImpactPlayKey]  = useState(0);
  const [isLeaping,      setIsLeaping]      = useState(false);

  const targetPosition  = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation  = useRef(rotation);
  const isAttackingRef  = useRef(false);
  const isSummoningRef  = useRef(!skipSummon);
  const isLeapingRef    = useRef(false);
  const isWalkingRef    = useRef(false);
  const prevHealthRef   = useRef(health);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, GHOUL_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  const lastMoveTimeRef = useRef(0);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  // Callback ref — positions the group at server spawn location immediately.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Play the spawn summon animation once on mount, then switch to Idle.
  useEffect(() => {
    if (skipSummon) return undefined;
    const t = setTimeout(() => {
      setIsSummoning(false);
      isSummoningRef.current = false;
    }, SUMMON_DURATION);
    return () => clearTimeout(t);
  }, [skipSummon]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    targetPosition.current.set(position.x, position.y, position.z);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while idle (not walk / attack / summon).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isAttacking &&
      !isSummoning
    ) {
      setIsImpacting(true);
      setImpactPlayKey(k => k + 1);
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isAttacking, isSummoning]);

  useEffect(() => {
    if (isWalking || isAttacking || isSummoning) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking, isSummoning]);

  // Ghoul melee attack telegraph
  useEffect(() => {
    if (!socket) return;

    const handleGhoulTelegraph = (data: {
      ghoulId: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.ghoulId !== id) return;
      if (isSummoningRef.current) return;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      setAttackVariant(prev => (prev === 1 ? 2 : 1));
      const visual = parseMeleeTelegraphPayload(data, GHOUL_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, duration);
    };

    const handleGhoulWhiff = (data: { ghoulId: string }) => {
      if (data.ghoulId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    socket.on('ghoul-attack-telegraph', handleGhoulTelegraph);
    socket.on('ghoul-attack-whiff', handleGhoulWhiff);
    const onLeapStart = (data: { ghoulId: string }) => {
      if (data.ghoulId !== id) return;
      setIsLeaping(true);
      isLeapingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
    };
    const onLeapLand = (data: { ghoulId: string }) => {
      if (data.ghoulId !== id) return;
      setIsLeaping(false);
      isLeapingRef.current = false;
    };
    socket.on('ghoul-leap-start', onLeapStart);
    socket.on('ghoul-leap-land', onLeapLand);
    return () => {
      socket.off('ghoul-attack-telegraph', handleGhoulTelegraph);
      socket.off('ghoul-attack-whiff', handleGhoulWhiff);
      socket.off('ghoul-leap-start', onLeapStart);
      socket.off('ghoul-leap-land', onLeapLand);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isAttackingRef.current || isSummoningRef.current || isLeapingRef.current;
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
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, GHOUL_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              collected.push(mat);
            });
          }
        });
        cachedDeathMats.current = collected;
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
      <GhoulModel
        isWalking={isWalking && !isLeaping}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isSummoning={isSummoning}
        isDying={isDying}
        isLeaping={isLeaping}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
        scaleMultiplier={visualScale}
      />

      {showMeleeRangeRing && isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? GHOUL_MELEE_ATTACK_RANGE}
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

      {!isDying && soulType && <KnightSoulEffect soulType={soulType} compact />}

      <Billboard position={[0, 2.8 * visualScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isSummoning && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[GHOUL_HP_BAR_WIDTH, GHOUL_HP_BAR_HEIGHT]} />
              <meshBasicMaterial color={campType ? hpTheme.background : '#1a0a0a'} opacity={0.9} transparent />
            </mesh>

            <mesh
              ref={hpFillRef}
              position={[-GHOUL_HP_BAR_WIDTH / 2, 0, 0.001]}
              scale={[1, 1, 1]}
            >
              <planeGeometry args={[GHOUL_HP_BAR_WIDTH, GHOUL_HP_BAR_FILL_HEIGHT]} />
              <meshBasicMaterial color={campType ? hpTheme.fill : '#aa3300'} opacity={0.95} transparent />
            </mesh>

            <EnemyHealthBarTextLabel
              name={getUnitNameplateName('ghoul', campType)}
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

export default React.memo(GhoulRenderer);
