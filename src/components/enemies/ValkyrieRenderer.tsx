'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import ValkyrieModel, { type ValkyrieAbilityClip } from './ValkyrieModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyAbilityChargeTelegraph from './EnemyAbilityChargeTelegraph';
import { registerValkyrieAnimationHandlers } from '@/utils/valkyrieAnimationDispatch';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
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
import GhostTrail from '../dragon/GhostTrail';
import AscendantBoneWings from '../dragon/AscendantBoneWings';
import { WeaponType } from '../dragon/weapons';
import ChargedOrbitals, { DashChargeStatus } from '../dragon/ChargedOrbitals';

interface ValkyrieRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const LUNGE_CHARGE_DURATION = 500;
const LUNGE_DURATION = 400;
const JUDGMENT_CAST_MS = 1000;
const DASH_LERP_SPEED = 24;
const LUNGE_CHARGE_COLOR = '#fff2a8';
const FADE_DURATION = 1.5;
const VALKYRIE_ORBITAL_ACTIVE = '#facc15';
const VALKYRIE_ORBITAL_INACTIVE = '#3a2a09';
const VALKYRIE_ORBITAL_Y_OFFSET = 2.1;

function ValkyrieRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: ValkyrieRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [abilityClip, setAbilityClip] = useState<ValkyrieAbilityClip | null>(null);
  const [isLungeCharging, setIsLungeCharging] = useState(false);
  const [isDashing, setIsDashing] = useState(false);

  const isAbilityRef = useRef(false);
  const isDashingRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lungeChargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lungeTravelRef = useRef<{ start: Vector3; end: Vector3; startedAt: number; duration: number } | null>(null);
  const judgmentCastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const orbitalCharges = useMemo<DashChargeStatus[]>(
    () => [0, 1, 2].map(() => ({ isAvailable: true, cooldownRemaining: 0 })),
    [],
  );

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const isLocked = isAbilityRef.current || isDashingRef.current;
    if (!isLocked) targetPosition.current.set(position.x, position.y, position.z);
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return registerValkyrieAnimationHandlers(id, {
      onLungeCharge: (data) => {
        if (dashTimer.current) clearTimeout(dashTimer.current);
        if (lungeChargeTimer.current) clearTimeout(lungeChargeTimer.current);
        lungeTravelRef.current = null;
        const chargeMs = data.chargeMs ?? LUNGE_CHARGE_DURATION;
        setAbilityClip(null);
        setIsLungeCharging(true);
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
        lungeChargeTimer.current = setTimeout(() => setIsLungeCharging(false), chargeMs);
      },
      onLungeDash: (data) => {
        const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
        const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
        const duration = data.durationMs ?? LUNGE_DURATION;
        if (dashTimer.current) clearTimeout(dashTimer.current);
        if (lungeChargeTimer.current) clearTimeout(lungeChargeTimer.current);
        setIsLungeCharging(false);
        setAbilityClip(data.variant === 2 ? 'Attack2' : 'Attack');
        setIsDashing(true);
        isAbilityRef.current = true;
        isDashingRef.current = true;
        targetPosition.current.copy(endPos);
        targetRotation.current = data.rotation;
        lungeTravelRef.current = { start: startPos.clone(), end: endPos.clone(), startedAt: performance.now(), duration };
        if (groupRef.current) {
          groupRef.current.position.copy(startPos);
          groupRef.current.rotation.y = data.rotation;
        }
        // Spin-dash whoosh (swordMiss2) while dashing
        window.audioSystem?.playRunebladeMissSound?.(3, startPos);
        dashTimer.current = setTimeout(() => {
          setAbilityClip(null);
          setIsDashing(false);
          isAbilityRef.current = false;
          isDashingRef.current = false;
          lungeTravelRef.current = null;
          if (groupRef.current) {
            groupRef.current.position.copy(endPos);
            groupRef.current.rotation.y = data.rotation;
          }
        }, duration);
      },
    });
  }, [id]);

  useEffect(() => {
    if (!socket) return;

    const handleJudgmentCast = (data: {
      valkyrieId: string;
      rotation: number;
      castMs?: number;
      targetPosition?: { x: number; y: number; z: number };
    }) => {
      if (data.valkyrieId !== id) return;
      if (data.targetPosition) return;
      if (judgmentCastTimer.current) clearTimeout(judgmentCastTimer.current);
      setAbilityClip('Cast');
      isAbilityRef.current = true;
      targetRotation.current = data.rotation;
      if (groupRef.current) {
        groupRef.current.rotation.y = data.rotation;
      }
      const castMs = data.castMs ?? JUDGMENT_CAST_MS;
      judgmentCastTimer.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, castMs);
    };

    socket.on('valkyrie-judgment-cast', handleJudgmentCast);
    return () => {
      socket.off('valkyrie-judgment-cast', handleJudgmentCast);
      if (judgmentCastTimer.current) clearTimeout(judgmentCastTimer.current);
    };
  }, [id, socket]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    const lungeTravel = lungeTravelRef.current;
    if (lungeTravel) {
      const t = Math.min(1, (performance.now() - lungeTravel.startedAt) / lungeTravel.duration);
      group.position.copy(lungeTravel.start).lerp(lungeTravel.end, t);
    } else if (!isDashingRef.current) {
      group.position.copy(targetPosition.current);
    }

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * DASH_LERP_SPEED);
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
        fixedTrailColor={LUNGE_CHARGE_COLOR}
        isTrailMotionRef={isDashingRef}
        yOffset={2.75}
      />

      {!isDying && (
        <ChargedOrbitals
          parentRef={groupRef as React.RefObject<Group>}
          dashCharges={orbitalCharges}
          weaponType={WeaponType.NONE}
          yOffset={VALKYRIE_ORBITAL_Y_OFFSET}
          customActiveColor={VALKYRIE_ORBITAL_ACTIVE}
          customInactiveColor={VALKYRIE_ORBITAL_INACTIVE}
        />
      )}

      <group ref={setGroupRef}>
        <ValkyrieModel abilityClip={abilityClip} isDying={isDying} />
        {!isDying && (
          <group position={[0, 2.00, -0.18]} scale={[1.12, 1.12, 1.12]}>
            <AscendantBoneWings
              isLeftWing
              parentRef={groupRef as React.RefObject<Group>}
              isDashing={isDashing}
              omitLights
            />
            <AscendantBoneWings
              isLeftWing={false}
              parentRef={groupRef as React.RefObject<Group>}
              isDashing={isDashing}
              omitLights
            />
          </group>
        )}
        {isLungeCharging && <EnemyAbilityChargeTelegraph active primaryColor={LUNGE_CHARGE_COLOR} />}
        <Billboard position={[0, 4.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
          {health > 0 && !isDying && (
            <>
              <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
              <EnemyHealthBarTextLabel
                name={getEnemyDisplayName('valkyrie')}
                numericRef={hpTextRef}
                health={health}
                maxHealth={maxHealth}
                fontSize={0.16}
                color={theme.text}
              />
              <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} width={ENEMY_HP_BAR_WIDTH * 1.1} />
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}

export default React.memo(ValkyrieRenderer);
