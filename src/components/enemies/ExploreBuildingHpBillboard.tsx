'use client';

import React, { useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { Mesh } from 'three';
import {
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import { isExploreZoomClose } from '@/utils/exploreZoomLod';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

/** Planes only — tighter than before to cut transparent overdraw. */
const BAR_DISTANCE = 14;
/** Troika text is expensive; only when damaged and nearby. */
const TEXT_DISTANCE = 12;
const BAR_R2 = BAR_DISTANCE * BAR_DISTANCE;
const TEXT_R2 = TEXT_DISTANCE * TEXT_DISTANCE;
const TEXT_UNMOUNT_R2 = (TEXT_DISTANCE + 2) * (TEXT_DISTANCE + 2);
const _world = new Vector3();

export function syncExploreBuildingHpIfVisible(
  barVisibleRef: MutableRefObject<boolean>,
  fillRef: RefObject<Mesh | null>,
  numericRef: RefObject<{ text?: string; sync?: () => void } | null>,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
): void {
  if (!barVisibleRef.current) return;
  syncEnemyHealthBarFillFromRef(fillRef, enemiesRef, enemyId, fallbackHealth, maxHealth);
  syncEnemyHealthBarNumericTextFromRef(numericRef, enemiesRef, enemyId, fallbackHealth, maxHealth);
}

export function ExploreBuildingHpBillboard({
  y,
  health,
  maxHealth,
  fillRef,
  numericRef,
  backgroundColor,
  fillColor,
  textColor,
  fontSize = 0.16,
  hidden,
  barVisibleRef,
}: {
  y: number;
  health: number;
  maxHealth: number;
  fillRef: RefObject<Mesh | null>;
  numericRef: RefObject<{ text?: string; sync?: () => void } | null>;
  backgroundColor: string;
  fillColor: string;
  textColor: string;
  fontSize?: number;
  hidden?: boolean;
  barVisibleRef?: MutableRefObject<boolean>;
}) {
  const barRef = useRef<Group>(null);
  const textOnRef = useRef(false);
  const [textOn, setTextOn] = useState(false);
  const damaged = health < maxHealth;

  useFrame(({ camera }) => {
    const g = barRef.current;
    if (!g) return;
    g.getWorldPosition(_world);
    const d2 = camera.position.distanceToSquared(_world);
    const barOn = !hidden && d2 <= BAR_R2;
    g.visible = barOn;
    if (barVisibleRef) barVisibleRef.current = barOn;

    // Troika Text only when damaged and in range (not zoom-close — fill-rate).
    let wantText = textOnRef.current;
    if (isExploreZoomClose() || !barOn || !damaged || d2 > TEXT_UNMOUNT_R2) wantText = false;
    else if (barOn && damaged && d2 <= TEXT_R2) wantText = true;
    if (wantText !== textOnRef.current) {
      textOnRef.current = wantText;
      setTextOn(wantText);
    }
  });

  if (hidden || health <= 0) return null;

  return (
    <group ref={barRef} position={[0, y, 0]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <EnemyHpBarPlanes
          fillRef={fillRef}
          backgroundColor={backgroundColor}
          fillColor={fillColor}
        />
        {textOn && (
          <EnemyHealthBarTextLabel
            leading="HP"
            numericRef={numericRef}
            health={health}
            maxHealth={maxHealth}
            fontSize={fontSize}
            color={textColor}
          />
        )}
      </Billboard>
    </group>
  );
}
