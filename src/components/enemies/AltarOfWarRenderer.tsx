'use client';

import React, { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import { ExploreBuildingHpBillboard, syncExploreBuildingHpIfVisible } from './ExploreBuildingHpBillboard';
import AltarOfWar, { ALTAR_OF_WAR_HP_BAR_Y } from '@/components/environment/AltarOfWar';
import type { Position3 } from '@/utils/position3';

interface AltarOfWarRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  powered?: boolean;
}

const FADE_DURATION = 1.4;

function AltarOfWarRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  powered = true,
}: AltarOfWarRendererProps) {
  const theme = campHpTheme('ally-green');
  const { enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const hpBarVisibleRef = useRef(false);
  const opacity = useRef(1);
  const fadeTimer = useRef(0);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.set(position.x, position.y, position.z);
      group.rotation.y = rotation;
    }
  }, [position.x, position.y, position.z, rotation]);

  useFrame((_, delta) => {
    syncExploreBuildingHpIfVisible(
      hpBarVisibleRef, hpFillRef, hpTextRef, enemiesRef, id, health, maxHealth,
    );
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      if (groupRef.current) groupRef.current.visible = opacity.current > 0.02;
    }
  });

  const dimmed = !powered && !isDying;

  return (
    <group ref={setGroupRef} rotation={[0, rotation, 0]} visible={!isDying || opacity.current > 0.02}>
      <AltarOfWar />
      {dimmed && (
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.7, 0.82, 3.2, 10]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.38} depthWrite={false} />
        </mesh>
      )}
      <ExploreBuildingHpBillboard
        y={ALTAR_OF_WAR_HP_BAR_Y}
        health={health}
        maxHealth={maxHealth}
        fillRef={hpFillRef}
        numericRef={hpTextRef}
        backgroundColor={theme.background}
        fillColor={theme.fill}
        textColor={theme.text}
        fontSize={0.14}
        hidden={isDying}
        barVisibleRef={hpBarVisibleRef}
      />
    </group>
  );
}

export default React.memo(AltarOfWarRenderer);
