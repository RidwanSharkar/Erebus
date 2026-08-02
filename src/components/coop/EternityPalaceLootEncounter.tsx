'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import SentinelModel, { preloadSentinelModels } from '@/components/enemies/SentinelModel';
import KnightSoulEffect from '@/components/enemies/KnightSoulEffect';
import {
  ETERNITY_ENCOUNTER_ENTRY,
  ETERNITY_ENCOUNTER_INTERACT_RADIUS,
  ETERNITY_ENCOUNTER_MEET,
  ETERNITY_ENCOUNTER_WALK_SPEED,
  ETERNITY_ENCOUNTER_WAYPOINTS,
  type EternityPalaceEncounterRef,
  type EternityPalaceEncounterSnapshot,
} from '@/utils/eternityPalaceEncounter';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';

preloadSentinelModels();

const ARRIVAL_EPSILON = 0.08;
const TOOLTIP_WORLD_OFFSET = new Vector3(0, 1.55, 0);
const _projectScratch = new Vector3();
const ARCHITECT_TOOLTIP_NAME = 'The Architect';
const ARCHITECT_TOOLTIP_DESCRIPTION =
  'A relic keeper from beyond the veil. Speak with her to empower your spirit animal.';

type EncounterPhase = 'entering' | 'idle' | 'gone';

function rotationToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

export interface EternityPalaceLootEncounterProps {
  lootPhaseComplete: boolean;
  playerPositionRef: React.MutableRefObject<Vector3>;
  encounterRef: React.MutableRefObject<EternityPalaceEncounterRef | null>;
}

export default function EternityPalaceLootEncounter({
  lootPhaseComplete,
  playerPositionRef,
  encounterRef,
}: EternityPalaceLootEncounterProps) {
  const { camera, size } = useThree();
  const groupRef = useRef<Group | null>(null);
  const phaseRef = useRef<EncounterPhase>('entering');
  const waypointIndexRef = useRef(0);
  const posRef = useRef<{ x: number; z: number }>({
    x: ETERNITY_ENCOUNTER_ENTRY.x,
    z: ETERNITY_ENCOUNTER_ENTRY.z,
  });
  const [isWalking, setIsWalking] = useState(true);
  const [visible, setVisible] = useState(true);
  const firstWaypoint = ETERNITY_ENCOUNTER_WAYPOINTS[0] ?? ETERNITY_ENCOUNTER_MEET;
  const rotationRef = useRef(
    rotationToward(
      ETERNITY_ENCOUNTER_ENTRY.x,
      ETERNITY_ENCOUNTER_ENTRY.z,
      firstWaypoint.x,
      firstWaypoint.z,
    ),
  );
  const snapshotRef = useRef<EternityPalaceEncounterSnapshot | null>(null);
  const lastPublishedTooltipRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (lootPhaseComplete) {
      phaseRef.current = 'gone';
      setVisible(false);
      setIsWalking(false);
      snapshotRef.current = null;
      return;
    }
    phaseRef.current = 'entering';
    waypointIndexRef.current = 0;
    posRef.current = { x: ETERNITY_ENCOUNTER_ENTRY.x, z: ETERNITY_ENCOUNTER_ENTRY.z };
    const next = ETERNITY_ENCOUNTER_WAYPOINTS[0] ?? ETERNITY_ENCOUNTER_MEET;
    rotationRef.current = rotationToward(
      ETERNITY_ENCOUNTER_ENTRY.x,
      ETERNITY_ENCOUNTER_ENTRY.z,
      next.x,
      next.z,
    );
    setIsWalking(true);
    setVisible(true);
  }, [lootPhaseComplete]);

  useEffect(() => {
    encounterRef.current = {
      getSnapshot: () => snapshotRef.current,
    };
    return () => {
      encounterRef.current = null;
    };
  }, [encounterRef]);

  useEffect(() => () => clearMerchantShopTooltip(), []);

  useFrame((_, delta) => {
    if (!visible || phaseRef.current === 'gone') {
      snapshotRef.current = null;
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    let nextWalking = false;

    if (phaseRef.current === 'entering') {
      const target =
        ETERNITY_ENCOUNTER_WAYPOINTS[waypointIndexRef.current] ?? ETERNITY_ENCOUNTER_MEET;
      const dx = target.x - posRef.current.x;
      const dz = target.z - posRef.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVAL_EPSILON) {
        posRef.current = { x: target.x, z: target.z };
        if (waypointIndexRef.current < ETERNITY_ENCOUNTER_WAYPOINTS.length - 1) {
          waypointIndexRef.current += 1;
          const next =
            ETERNITY_ENCOUNTER_WAYPOINTS[waypointIndexRef.current] ?? ETERNITY_ENCOUNTER_MEET;
          rotationRef.current = rotationToward(
            posRef.current.x,
            posRef.current.z,
            next.x,
            next.z,
          );
          nextWalking = true;
        } else {
          phaseRef.current = 'idle';
          rotationRef.current = rotationToward(
            ETERNITY_ENCOUNTER_MEET.x,
            ETERNITY_ENCOUNTER_MEET.z,
            0,
            0,
          );
        }
      } else {
        const step = Math.min(dist, ETERNITY_ENCOUNTER_WALK_SPEED * delta);
        posRef.current = {
          x: posRef.current.x + (dx / dist) * step,
          z: posRef.current.z + (dz / dist) * step,
        };
        rotationRef.current = rotationToward(
          posRef.current.x,
          posRef.current.z,
          target.x,
          target.z,
        );
        nextWalking = true;
      }
    } else if (phaseRef.current === 'idle') {
      const playerPos = playerPositionRef.current;
      const faceDx = playerPos.x - posRef.current.x;
      const faceDz = playerPos.z - posRef.current.z;
      rotationRef.current = Math.atan2(faceDx, faceDz);
    }

    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, 0, posRef.current.z);
      groupRef.current.rotation.y = rotationRef.current;
    }

    setIsWalking((prev) => (prev === nextWalking ? prev : nextWalking));

    const selectable = phaseRef.current === 'idle' && !lootPhaseComplete;
    snapshotRef.current = selectable
      ? { x: posRef.current.x, z: posRef.current.z, selectable: true }
      : null;

    if (!selectable || !groupRef.current) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const playerPos = playerPositionRef.current;
    const dx = playerPos.x - posRef.current.x;
    const dz = playerPos.z - posRef.current.z;
    const interactRadiusSq = ETERNITY_ENCOUNTER_INTERACT_RADIUS * ETERNITY_ENCOUNTER_INTERACT_RADIUS;
    const inRange = dx * dx + dz * dz <= interactRadiusSq;

    if (!inRange) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    if (!size.width || !size.height) return;

    groupRef.current.getWorldPosition(_projectScratch);
    _projectScratch.add(TOOLTIP_WORLD_OFFSET);
    _projectScratch.project(camera);

    const x = (_projectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_projectScratch.y * -0.5 + 0.5) * size.height;
    const last = lastPublishedTooltipRef.current;
    const shouldPublish =
      !last || Math.abs(last.x - x) > 1.5 || Math.abs(last.y - y) > 1.5;

    if (shouldPublish) {
      lastPublishedTooltipRef.current = { x, y };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: ARCHITECT_TOOLTIP_NAME,
        description: ARCHITECT_TOOLTIP_DESCRIPTION,
      });
    }
  });

  const setGroupRef = useCallback((node: Group | null) => {
    groupRef.current = node;
  }, []);

  if (!visible) return null;

  return (
    <group name="eternity-palace-loot-encounter" ref={setGroupRef}>
      <Suspense fallback={null}>
        <SentinelModel
          isWalking={isWalking}
          abilityClip={null}
          isDying={false}
        />
      </Suspense>
      <KnightSoulEffect soulType="red" />
    </group>
  );
}
