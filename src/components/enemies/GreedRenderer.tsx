'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';
import GreedModel, { GreedAbilityClip } from './GreedModel';
import ChargedOrbitals, { DashChargeStatus } from '../dragon/ChargedOrbitals';
import { WeaponType } from '../dragon/weapons';

export type GreedSoulType = 'green' | 'red' | 'blue' | 'purple';

interface GreedRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  soulType?: GreedSoulType;
}

interface AbilityTelegraphEvent {
  greedId: string;
  ability: 'cast' | 'healcast' | 'launch';
  durationMs: number;
}

const LERP_SPEED = 12;
const FADE_DURATION = 1.5;

const ORB_COLORS: Record<GreedSoulType, { active: string; inactive: string }> = {
  green:  { active: '#22c55e', inactive: '#0d3b1c' },
  red:    { active: '#ef4444', inactive: '#3b0d0d' },
  blue:   { active: '#38bdf8', inactive: '#0a2a3b' },
  purple: { active: '#a855f7', inactive: '#2c0d3b' },
};

const ABILITY_TO_CLIP: Record<AbilityTelegraphEvent['ability'], GreedAbilityClip> = {
  cast: 'Cast',
  healcast: 'HealCast',
  launch: 'Launch',
};

function GreedRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  soulType = 'green',
}: GreedRendererProps) {
  const theme = campHpTheme(soulType);
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const abilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const [abilityClip, setAbilityClip] = useState<GreedAbilityClip | null>(null);
  const orbColors = ORB_COLORS[soulType] ?? ORB_COLORS.green;
  const orbitalCharges = useMemo<DashChargeStatus[]>(
    () => [{ isAvailable: true, cooldownRemaining: 0 }],
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
    targetPosition.current.copy(position);
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (abilityTimer.current) clearTimeout(abilityTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAbilityTelegraph = (data: AbilityTelegraphEvent) => {
      if (data.greedId !== id) return;
      const clip = ABILITY_TO_CLIP[data.ability];
      if (!clip) return;

      if (abilityTimer.current) clearTimeout(abilityTimer.current);
      setAbilityClip(clip);
      abilityTimer.current = setTimeout(() => {
        setAbilityClip(null);
      }, Math.max(0, data.durationMs || 0));
    };

    socket.on('greed-ability-telegraph', handleAbilityTelegraph);
    return () => {
      socket.off('greed-ability-telegraph', handleAbilityTelegraph);
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
      {!isDying && (
        <ChargedOrbitals
          parentRef={groupRef as React.RefObject<Group>}
          dashCharges={orbitalCharges}
          weaponType={WeaponType.NONE}
          yOffset={2.1}
          customActiveColor={orbColors.active}
          customInactiveColor={orbColors.inactive}
        />
      )}

      <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
        <GreedModel isDying={!!isDying} abilityClip={abilityClip} />

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

export default React.memo(GreedRenderer);
