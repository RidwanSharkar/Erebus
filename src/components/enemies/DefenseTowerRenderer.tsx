'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import { syncEnemyRotationFromRef } from '@/utils/enemyLiveTransform';
import {
  DEFENSE_TOWER_BOLT_THEMES,
  DEFENSE_TOWER_IMPACT_Y,
  DEFENSE_TOWER_MUZZLE_Y,
  getDefenseTowerSlot,
} from '@/utils/defenseLayout';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import DefenseTower, { DEFENSE_TOWER_HP_BAR_Y } from '@/components/environment/DefenseTower';
import DefenseTowerBolt, { type DefenseTowerBoltShot } from './DefenseTowerBolt';
import type { Position3 } from '@/utils/position3';

interface DefenseTowerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  powered?: boolean;
}

interface DefenseTowerAttackEvent {
  towerId: string;
  kind: 'bolt';
  origin?: { x: number; y: number; z: number };
  impact?: { x: number; y: number; z: number };
  targetId?: string;
}

const FADE_DURATION = 1.4;

function DefenseTowerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  powered = true,
}: DefenseTowerRendererProps) {
  const theme = campHpTheme('ally-green');
  const { socket, enemiesRef, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const opacity = useRef(1);
  const fadeTimer = useRef(0);
  const targetRotation = useRef(rotation);
  const seqRef = useRef(0);
  const slot = getDefenseTowerSlot(id);
  const [boltShot, setBoltShot] = useState<DefenseTowerBoltShot | null>(null);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.set(position.x, position.y, position.z);
      group.rotation.y = targetRotation.current;
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
    if (!groupRef.current) return;
    groupRef.current.position.set(position.x, position.y, position.z);
    groupRef.current.rotation.y = rotation;
  }, [position.x, position.y, position.z, rotation]);

  useEffect(() => {
    if (!socket) return;
    const onAttack = (data: DefenseTowerAttackEvent) => {
      if (!powered) return;
      if (data.towerId !== id || data.kind !== 'bolt') return;
      const origin = data.origin;
      const impact = data.impact;
      if (!origin || !impact) return;
      const boltTheme = slot ? DEFENSE_TOWER_BOLT_THEMES[slot] : DEFENSE_TOWER_BOLT_THEMES.n;
      const seq = ++seqRef.current;
      setBoltShot({
        seq,
        from: new Vector3(origin.x, origin.y ?? DEFENSE_TOWER_MUZZLE_Y, origin.z),
        to: new Vector3(impact.x, impact.y ?? DEFENSE_TOWER_IMPACT_Y, impact.z),
        theme: boltTheme,
      });
    };
    socket.on('defense-tower-attack', onAttack);
    return () => {
      socket.off('defense-tower-attack', onAttack);
    };
  }, [socket, id, slot, powered]);

  useFrame((_, delta) => {
    if (enemyTransformsRef) {
      syncEnemyRotationFromRef(id, enemyTransformsRef, targetRotation);
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = targetRotation.current;
    }
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      if (groupRef.current) groupRef.current.visible = opacity.current > 0.02;
    }
  });

  return (
    <>
      {boltShot && (
        <DefenseTowerBolt
          key={boltShot.seq}
          shot={boltShot}
          onComplete={() => setBoltShot(null)}
        />
      )}
      <group ref={setGroupRef} visible={!isDying || opacity.current > 0.02}>
        <DefenseTower />
        {!powered && !isDying && (
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[1.55, 1.75, 6.4, 10]} />
            <meshBasicMaterial color="#0b1220" transparent opacity={0.38} depthWrite={false} />
          </mesh>
        )}
        <Billboard position={[0, DEFENSE_TOWER_HP_BAR_Y, 0]} follow lockX={false} lockY={false} lockZ={false}>
          {health > 0 && !isDying && (
            <>
              <EnemyHpBarPlanes
                fillRef={hpFillRef}
                backgroundColor={theme.background}
                fillColor={theme.fill}
              />
              <EnemyHealthBarTextLabel
                leading="HP"
                numericRef={hpTextRef}
                health={health}
                maxHealth={maxHealth}
                fontSize={0.16}
                color={theme.text}
              />
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}

export default React.memo(DefenseTowerRenderer);
