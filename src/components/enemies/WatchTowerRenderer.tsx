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
import { DEFENSE_TOWER_IMPACT_Y } from '@/utils/defenseLayout';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import WatchTower, { WATCH_TOWER_HP_BAR_Y, WATCH_TOWER_MUZZLE_Y } from '@/components/environment/WatchTower';
import ViperArrowProjectile from './ViperArrowProjectile';
import type { Position3 } from '@/utils/position3';

interface WatchTowerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  powered?: boolean;
}

interface WatchTowerAttackEvent {
  towerId: string;
  kind: 'bolt' | 'arrow';
  origin?: { x: number; y: number; z: number };
  impact?: { x: number; y: number; z: number };
  targetId?: string;
  damage?: number;
}

type WatchTowerArrowShot = {
  seq: number;
  from: Vector3;
  to: Vector3;
  damage: number;
  maxRange: number;
};

const FADE_DURATION = 1.4;

function WatchTowerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  powered = true,
}: WatchTowerRendererProps) {
  const theme = campHpTheme('ally-green');
  const { socket, enemiesRef, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const opacity = useRef(1);
  const fadeTimer = useRef(0);
  const targetRotation = useRef(rotation);
  const seqRef = useRef(0);
  const [arrowShot, setArrowShot] = useState<WatchTowerArrowShot | null>(null);

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
    const onAttack = (data: WatchTowerAttackEvent) => {
      if (!powered) return;
      if (data.towerId !== id || data.kind !== 'arrow') return;
      const origin = data.origin;
      const impact = data.impact;
      if (!origin || !impact) return;
      const from = new Vector3(origin.x, origin.y ?? WATCH_TOWER_MUZZLE_Y, origin.z);
      const to = new Vector3(impact.x, impact.y ?? DEFENSE_TOWER_IMPACT_Y, impact.z);
      const seq = ++seqRef.current;
      setArrowShot({
        seq,
        from,
        to,
        damage: data.damage ?? 50,
        maxRange: Math.max(0.5, from.distanceTo(to)),
      });
    };
    socket.on('defense-tower-attack', onAttack);
    return () => {
      socket.off('defense-tower-attack', onAttack);
    };
  }, [socket, id, powered]);

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
      {arrowShot && (
        <ViperArrowProjectile
          key={arrowShot.seq}
          startPosition={arrowShot.from}
          targetPosition={arrowShot.to}
          damage={arrowShot.damage}
          maxRange={arrowShot.maxRange}
          getPlayerPosition={() => null}
          onHitPlayer={() => {}}
          onComplete={() => setArrowShot(null)}
        />
      )}
      <group ref={setGroupRef} visible={!isDying || opacity.current > 0.02}>
        <WatchTower />
        {!powered && !isDying && (
          <mesh position={[0, 2.15, 0]}>
            <cylinderGeometry args={[1.55, 1.75, 4.3, 10]} />
            <meshBasicMaterial color="#0b1220" transparent opacity={0.38} depthWrite={false} />
          </mesh>
        )}
        <Billboard position={[0, WATCH_TOWER_HP_BAR_Y, 0]} follow lockX={false} lockY={false} lockZ={false}>
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

export default React.memo(WatchTowerRenderer);
