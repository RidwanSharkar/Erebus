'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';
import AlliedHealerModel from './AlliedHealerModel';
import AlliedHealerProjectile from './AlliedHealerProjectile';
import ChargedOrbitals, { DashChargeStatus } from '../dragon/ChargedOrbitals';
import { WeaponType } from '../dragon/weapons';

interface AlliedHealerRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  alliedOrbSlots?: boolean[];
}

interface GreaterHealEvent {
  healerId: string;
  targetPosition?: { x: number; y: number; z: number };
  castMs?: number;
  healcastMs?: number;
}

interface AttackEvent {
  healerId: string;
  healerPosition: { x: number; y: number; z: number };
  impactPosition: { x: number; y: number; z: number };
  castMs: number;
  travelMs: number;
}

interface ActiveProjectile {
  id: number;
  startPosition: Vector3;
  targetPosition: Vector3;
}

const LERP_SPEED = 12;
const WALK_STOP_DELAY = 250;
const FADE_DURATION = 1.5;
const DEFAULT_CAST_MS = 900;
const DEFAULT_HEALCAST_MS = 1100;

function AlliedHealerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  alliedOrbSlots,
}: AlliedHealerRendererProps) {
  const theme = campHpTheme('ally-green');
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAbilityRef = useRef(false);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const [isWalking, setIsWalking] = useState(false);
  const [abilityClip, setAbilityClip] = useState<'Cast' | 'HealCast' | 'Launch' | null>(null);
  const [activeProjectiles, setActiveProjectiles] = useState<ActiveProjectile[]>([]);
  const projectileIdRef = useRef(0);
  const orbitalCharges = useMemo<DashChargeStatus[]>(() => {
    const slots = alliedOrbSlots?.length === 3 ? alliedOrbSlots : [true, true, true];
    return slots.map(isAvailable => ({ isAvailable, cooldownRemaining: 0 }));
  }, [alliedOrbSlots]);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    if (!isAbilityRef.current) {
      targetPosition.current.copy(position);
    }
    if (dist > 5.0 && groupRef.current && !isAbilityRef.current) {
      groupRef.current.position.copy(position);
    }
    if (dist > 0.01 && !isAbilityRef.current && !isDying) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (castTimer.current) clearTimeout(castTimer.current);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleGreaterHeal = (data: GreaterHealEvent) => {
      if (data.healerId !== id) return;
      const castMs = data.castMs ?? DEFAULT_CAST_MS;
      const healcastMs = data.healcastMs ?? DEFAULT_HEALCAST_MS;

      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (castTimer.current) clearTimeout(castTimer.current);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);

      setIsWalking(false);
      isAbilityRef.current = true;
      setAbilityClip('Cast');

      if (data.targetPosition) {
        const current = groupRef.current?.position ?? targetPosition.current;
        const dx = data.targetPosition.x - current.x;
        const dz = data.targetPosition.z - current.z;
        if (dx !== 0 || dz !== 0) {
          targetRotation.current = Math.atan2(dx, dz);
        }
      }

      castTimer.current = setTimeout(() => {
        setAbilityClip('HealCast');
      }, castMs);
      unlockTimer.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, castMs + healcastMs);
    };

    const handleAttack = (data: AttackEvent) => {
      if (data.healerId !== id) return;
      const castMs = data.castMs;

      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (castTimer.current) clearTimeout(castTimer.current);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);

      setIsWalking(false);
      isAbilityRef.current = true;
      setAbilityClip('Launch');

      const startPos = new Vector3(data.healerPosition.x, data.healerPosition.y, data.healerPosition.z);
      const targetPos = new Vector3(data.impactPosition.x, data.impactPosition.y, data.impactPosition.z);

      if (data.impactPosition) {
        const current = groupRef.current?.position ?? targetPosition.current;
        const dx = data.impactPosition.x - current.x;
        const dz = data.impactPosition.z - current.z;
        if (dx !== 0 || dz !== 0) {
          targetRotation.current = Math.atan2(dx, dz);
        }
      }

      castTimer.current = setTimeout(() => {
        setAbilityClip(null);
        const projId = ++projectileIdRef.current;
        setActiveProjectiles(prev => [
          ...prev,
          { id: projId, startPosition: startPos, targetPosition: targetPos },
        ]);
      }, castMs);

      unlockTimer.current = setTimeout(() => {
        isAbilityRef.current = false;
      }, castMs + data.travelMs);
    };

    socket.on('allied-healer-greater-heal', handleGreaterHeal);
    socket.on('allied-healer-attack', handleAttack);
    return () => {
      socket.off('allied-healer-greater-heal', handleGreaterHeal);
      socket.off('allied-healer-attack', handleAttack);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

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
    <>
      {activeProjectiles.map((proj) => (
        <AlliedHealerProjectile
          key={proj.id}
          startPosition={proj.startPosition}
          targetPosition={proj.targetPosition}
          onComplete={() => {
            setActiveProjectiles(prev => prev.filter(p => p.id !== proj.id));
          }}
        />
      ))}

      {orbitalCharges.length > 0 && !isDying && (
        <ChargedOrbitals
          parentRef={groupRef as React.RefObject<Group>}
          dashCharges={orbitalCharges}
          weaponType={WeaponType.NONE}
          yOffset={2.1}
          customActiveColor="#facc15"
          customInactiveColor="#3a2a09"
        />
      )}

      <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
        <AlliedHealerModel isWalking={isWalking} isDying={isDying} abilityClip={abilityClip} />

        <Billboard position={[0, 2.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
          {health > 0 && !isDying && (
            <>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[1.8, 0.23]} />
                <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
              </mesh>

              <mesh position={[-0.9 + (health / maxHealth) * 0.9, 0, 0.001]}>
                <planeGeometry args={[(health / maxHealth) * 1.8, 0.21]} />
                <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
              </mesh>

              <Text
                position={[0, 0, 0.002]}
                fontSize={0.16}
                color={theme.text}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {`HP ${Math.ceil(health)}/${maxHealth}`}
              </Text>
              <EnemyStaggerBar stagger={staggerBuildup} />
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}

export default React.memo(AlliedHealerRenderer);
