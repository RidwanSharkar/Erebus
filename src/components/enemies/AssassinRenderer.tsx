'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import AssassinModel, { type AssassinAbilityClip } from './AssassinModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyAbilityChargeTelegraph from './EnemyAbilityChargeTelegraph';
import { registerAssassinAnimationHandlers } from '@/utils/assassinAnimationDispatch';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { detachSharedMaterialsForMutation } from '@/utils/sharedEnemyMaterials';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface AssassinRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const BOW_ATTACK_DURATION = 3000;
const SPIN_CHARGE_DURATION = 750;
const SPIN_DURATION = 1033;
const EVADE_DURATION = 600;
const FADE_DURATION = 1.5;
const LERP_SPEED = 12;
const DASH_LERP_SPEED = 24;
const WALK_STOP_DELAY = 250;
const SPIN_CHARGE_COLOR = '#ff6b6b';

function AssassinRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: AssassinRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [attackKey, setAttackKey] = useState(0);
  const [isBowAttacking, setIsBowAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isInvisible, setIsInvisible] = useState(false);
  const isWalkingRef = useRef(false);
  const [abilityClip, setAbilityClip] = useState<AssassinAbilityClip | null>(null);
  const [abilityPlayKey, setAbilityPlayKey] = useState(0);
  const [isDashing, setIsDashing] = useState(false);
  const [isSpinCharging, setIsSpinCharging] = useState(false);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isBowAttackingRef = useRef(false);
  const isAbilityRef = useRef(false);
  const isDashingRef = useRef(false);
  const lastMoveTimeRef = useRef(0);
  const bowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinChargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTravelRef = useRef<{
    start: Vector3;
    end: Vector3;
    startedAt: number;
    duration: number;
  } | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isLocked = isBowAttackingRef.current || isAbilityRef.current || isDashingRef.current;
    if (!isLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 5.0 && groupRef.current && !isLocked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (bowTimerRef.current) clearTimeout(bowTimerRef.current);
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
    };
  }, []);

  // Bowshot: reuse viper-attack-telegraph (server emits with assassin id as viperId)
  useEffect(() => {
    if (!socket) return;

    const handleViperTelegraph = (data: { viperId: string }) => {
      if (data.viperId !== id) return;
      if (bowTimerRef.current) clearTimeout(bowTimerRef.current);
      setAttackKey((k) => k + 1);
      setIsBowAttacking(true);
      isBowAttackingRef.current = true;
      bowTimerRef.current = setTimeout(() => {
        setIsBowAttacking(false);
        isBowAttackingRef.current = false;
        bowTimerRef.current = null;
      }, BOW_ATTACK_DURATION);
    };

    const handleDreamshroudCloak = (data: { assassinId: string }) => {
      if (data.assassinId !== id) return;
      // Brief Backflip cue, then hide mesh (mist VFX is spawned centrally in CoopGameScene).
      setAbilityClip('Backflip');
      setAbilityPlayKey((k) => k + 1);
      isAbilityRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        setIsInvisible(true);
      }, 350);
    };

    const handleDreamshroudReveal = (data: { assassinId: string }) => {
      if (data.assassinId !== id) return;
      setIsInvisible(false);
    };

    socket.on('viper-attack-telegraph', handleViperTelegraph);
    socket.on('assassin-dreamshroud-cloak', handleDreamshroudCloak);
    socket.on('assassin-dreamshroud-reveal', handleDreamshroudReveal);
    return () => {
      socket.off('viper-attack-telegraph', handleViperTelegraph);
      socket.off('assassin-dreamshroud-cloak', handleDreamshroudCloak);
      socket.off('assassin-dreamshroud-reveal', handleDreamshroudReveal);
      if (bowTimerRef.current) clearTimeout(bowTimerRef.current);
    };
  }, [id, socket]);

  // Spin + evade via assassin animation dispatch
  useEffect(() => {
    const handleSpinCharge = (data: {
      position?: { x: number; y: number; z: number };
      rotation: number;
      chargeMs?: number;
    }) => {
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      spinTravelRef.current = null;

      const chargeMs = data.chargeMs ?? SPIN_CHARGE_DURATION;
      isWalkingRef.current = false;
      setIsWalking(false);
      setIsDashing(false);
      setAbilityClip(null);
      setIsSpinCharging(true);
      isDashingRef.current = false;
      isAbilityRef.current = true;
      targetRotation.current = data.rotation;

      if (data.position && groupRef.current) {
        const chargePos = new Vector3(data.position.x, data.position.y, data.position.z);
        targetPosition.current.copy(chargePos);
        groupRef.current.position.copy(chargePos);
        groupRef.current.rotation.y = data.rotation;
      }

      spinChargeTimer.current = setTimeout(() => {
        setIsSpinCharging(false);
      }, chargeMs);
    };

    const handleSpinDash = (data: {
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? SPIN_DURATION;

      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);

      isWalkingRef.current = false;
      setIsWalking(false);
      setIsSpinCharging(false);
      setAbilityClip('Spin');
      setAbilityPlayKey((k) => k + 1);
      setIsDashing(true);
      isAbilityRef.current = true;
      isDashingRef.current = true;
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;
      spinTravelRef.current = {
        start: startPos.clone(),
        end: endPos.clone(),
        startedAt: performance.now(),
        duration,
      };

      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      dashTimer.current = setTimeout(() => {
        setAbilityClip(null);
        setIsDashing(false);
        isAbilityRef.current = false;
        isDashingRef.current = false;
        spinTravelRef.current = null;
        if (groupRef.current) {
          groupRef.current.position.copy(endPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, duration);
    };

    const handleEvade = (data: {
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? EVADE_DURATION;

      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);

      isWalkingRef.current = false;
      setIsWalking(false);
      setIsSpinCharging(false);
      setAbilityClip('Backflip');
      setAbilityPlayKey((k) => k + 1);
      setIsDashing(true);
      isAbilityRef.current = true;
      isDashingRef.current = true;
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;
      spinTravelRef.current = {
        start: startPos.clone(),
        end: endPos.clone(),
        startedAt: performance.now(),
        duration,
      };

      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      dashTimer.current = setTimeout(() => {
        setAbilityClip(null);
        setIsDashing(false);
        isAbilityRef.current = false;
        isDashingRef.current = false;
        spinTravelRef.current = null;
        if (groupRef.current) {
          groupRef.current.position.copy(endPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, duration);
    };

    return registerAssassinAnimationHandlers(id, {
      onSpinCharge: handleSpinCharge,
      onSpinDash: handleSpinDash,
      onEvade: handleEvade,
    });
  }, [id]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isBowAttackingRef.current || isAbilityRef.current || isDashingRef.current;
    if (dist > 5.0 && !isLocked) {
      group.position.copy(targetPosition.current);
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      isLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    const spinTravel = spinTravelRef.current;
    if (spinTravel) {
      const t = Math.min(1, (performance.now() - spinTravel.startedAt) / spinTravel.duration);
      group.position.copy(spinTravel.start).lerp(spinTravel.end, t);
    } else {
      group.position.lerp(
        targetPosition.current,
        Math.min(1, delta * (isDashingRef.current ? DASH_LERP_SPEED : LERP_SPEED)),
      );
    }

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        detachSharedMaterialsForMutation(group);
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

  const showBody = !isInvisible && (!isDying || opacity.current > 0);

  return (
    <group ref={setGroupRef} visible={showBody}>
      <EnemyAbilityChargeTelegraph
        active={isSpinCharging && !isDying && !isInvisible}
        primaryColor={SPIN_CHARGE_COLOR}
      />
      <AssassinModel
        isWalking={isWalking && !isBowAttacking && !isDashing}
        attackKey={attackKey}
        abilityClip={abilityClip}
        abilityPlayKey={abilityPlayKey}
        isDying={isDying}
      />

      <Billboard position={[0, 3.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isInvisible && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('assassin')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(AssassinRenderer);
