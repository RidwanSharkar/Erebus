'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import SpectreModel, { type SpectreAbilityClip } from './SpectreModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyAbilityChargeTelegraph from './EnemyAbilityChargeTelegraph';
import { registerSpectreAnimationHandlers } from '@/utils/spectreAnimationDispatch';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';

interface SpectreRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const SPIN_CHARGE_DURATION = 500;
const SPIN_DURATION = 2267;
const LERP_SPEED = 12;
const DASH_LERP_SPEED = 24;
const WALK_STOP_DELAY = 250;
const FADE_DURATION = 1.5;
const SPIN_CHARGE_COLOR = '#42b7ff';

export default function SpectreRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: SpectreRendererProps) {
  const theme = campHpTheme(campType);
  const { enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [abilityClip, setAbilityClip] = useState<SpectreAbilityClip | null>(null);
  const [isSpinCharging, setIsSpinCharging] = useState(false);
  const [isDashing, setIsDashing] = useState(false);

  const isWalkingRef = useRef(false);
  const isAbilityRef = useRef(false);
  const isDashingRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinChargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTravelRef = useRef<{ start: Vector3; end: Vector3; startedAt: number; duration: number } | null>(null);
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
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isLocked = isAbilityRef.current || isDashingRef.current;
    if (!isLocked) targetPosition.current.set(position.x, position.y, position.z);
    if (dist > 5.0 && groupRef.current && !isLocked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return registerSpectreAnimationHandlers(id, {
      onSpinCharge: (data) => {
        if (dashTimer.current) clearTimeout(dashTimer.current);
        if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
        spinTravelRef.current = null;
        const chargeMs = data.chargeMs ?? SPIN_CHARGE_DURATION;
        isWalkingRef.current = false;
        setIsWalking(false);
        setAbilityClip(null);
        setIsSpinCharging(true);
        setIsDashing(false);
        isDashingRef.current = false;
        isAbilityRef.current = true;
        targetRotation.current = data.rotation;
        if (data.position && groupRef.current) {
          const chargePos = new Vector3(data.position.x, data.position.y, data.position.z);
          targetPosition.current.copy(chargePos);
          groupRef.current.position.copy(chargePos);
          groupRef.current.rotation.y = data.rotation;
        }
        spinChargeTimer.current = setTimeout(() => setIsSpinCharging(false), chargeMs);
      },
      onSpinDash: (data) => {
        const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
        const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
        const duration = data.durationMs ?? SPIN_DURATION;
        if (dashTimer.current) clearTimeout(dashTimer.current);
        if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
        isWalkingRef.current = false;
        setIsWalking(false);
        setIsSpinCharging(false);
        setAbilityClip('Spin');
        setIsDashing(true);
        isAbilityRef.current = true;
        isDashingRef.current = true;
        targetPosition.current.copy(endPos);
        targetRotation.current = data.rotation;
        spinTravelRef.current = { start: startPos.clone(), end: endPos.clone(), startedAt: performance.now(), duration };
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
      },
    });
  }, [id]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isAbilityRef.current || isDashingRef.current;
    updateEnemyWalkStateFromMoveDist(dist, isLocked, isDying, WALK_STOP_DELAY, lastMoveTimeRef, isWalkingRef, setIsWalking);

    const spinTravel = spinTravelRef.current;
    if (spinTravel) {
      const t = Math.min(1, (performance.now() - spinTravel.startedAt) / spinTravel.duration);
      group.position.copy(spinTravel.start).lerp(spinTravel.end, t);
    } else {
      group.position.lerp(targetPosition.current, Math.min(1, delta * (isDashingRef.current ? DASH_LERP_SPEED : LERP_SPEED)));
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
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => { mat.transparent = true; collected.push(mat); });
          }
        });
        cachedDeathMats.current = collected;
        deathCacheBuilt.current = true;
      }
      cachedDeathMats.current.forEach((mat) => { mat.opacity = opacity.current; });
    }
  });

  return (
    <>
      <GhostTrail
        parentRef={groupRef as React.RefObject<Group>}
        weaponType={WeaponType.NONE}
        fixedTrailColor={SPIN_CHARGE_COLOR}
        isTrailMotionRef={isDashingRef}
        yOffset={1.0}
      />

      <group ref={setGroupRef}>
        <SpectreModel isWalking={isWalking} abilityClip={abilityClip} isDying={isDying} />
        {isSpinCharging && (
          <EnemyAbilityChargeTelegraph active primaryColor={SPIN_CHARGE_COLOR} />
        )}
        <Billboard position={[0, 2.4, 0]}>
          {health > 0 && !isDying && (
            <>
              <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
              <EnemyHealthBarTextLabel
                leading="HP"
                numericRef={hpTextRef}
                health={health}
                maxHealth={maxHealth}
                fontSize={0.16}
                color={theme.text}
              />
              <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}
