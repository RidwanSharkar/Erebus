'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import {
  ALLY_CHOICE_ENTRY_POSITIONS,
  ALLY_CHOICE_EXIT_POSITIONS,
  ALLY_CHOICE_INTERACT_RADIUS,
  ALLY_CHOICE_MEET_POSITIONS,
  ALLY_CHOICE_WALK_SPEED,
  getAllyChoiceCard,
  getAllyChoiceTooltipDescription,
  type AllyChoiceEncounterCandidateSnapshot,
  type IntroAllyChoiceEncounterRef,
} from '@/utils/coopAllyChoice';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';
import KnightModel from '@/components/enemies/KnightModel';
import GhoulModel from '@/components/enemies/GhoulModel';
import ShadeModel from '@/components/enemies/ShadeModel';
import GreedModel from '@/components/enemies/GreedModel';
import ViperModel from '@/components/enemies/ViperModel';
import SoulGroundRing from '@/components/enemies/SoulGroundRing';

const TOOLTIP_WORLD_OFFSET = new Vector3(0, 1.35, 0);
const _projectScratch = new Vector3();
const ARRIVAL_EPSILON = 0.08;

type CandidatePhase = 'entering' | 'idle' | 'leaving' | 'gone';

function rotationToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function AllyChoicePreviewModel({
  kind,
  isWalking,
}: {
  kind: CoopAllyKind;
  isWalking: boolean;
}) {
  switch (kind) {
    case 'knight':
      return (
        <KnightModel
          isWalking={isWalking}
          isAttacking={false}
          attackVariant={1}
          isDying={false}
        />
      );
    case 'demon':
      return (
        <GhoulModel
          isWalking={isWalking}
          isAttacking={false}
          attackVariant={1}
          isSummoning={false}
          isDying={false}
        />
      );
    case 'phantom':
      return (
        <ShadeModel
          isWalking={isWalking}
          isAttacking={false}
          isBlinking={false}
          isDying={false}
        />
      );
    case 'enchantress':
      return <GreedModel isDying={false} isWalking={isWalking} />;
    case 'huntress':
      return (
        <ViperModel
          isWalking={isWalking}
          attackKey={0}
          isDying={false}
        />
      );
    default:
      return null;
  }
}

interface CandidateMotionSnapshot {
  kind: CoopAllyKind;
  x: number;
  z: number;
  phase: CandidatePhase;
}

function IntroAllyChoiceCandidate({
  kind,
  slotIndex,
  allyChoiceMade,
  chosenKind,
  hovered,
  onHoverChange,
  onMotionUpdate,
  anchorRef,
}: {
  kind: CoopAllyKind;
  slotIndex: number;
  allyChoiceMade: boolean;
  chosenKind: CoopAllyKind | null;
  hovered: boolean;
  onHoverChange: (kind: CoopAllyKind | null) => void;
  onMotionUpdate: (snapshot: CandidateMotionSnapshot) => void;
  anchorRef: (node: Group | null) => void;
}) {
  const groupRef = useRef<Group | null>(null);
  const phaseRef = useRef<CandidatePhase>('entering');
  const posRef = useRef({
    x: ALLY_CHOICE_ENTRY_POSITIONS[slotIndex]?.x ?? 0,
    z: ALLY_CHOICE_ENTRY_POSITIONS[slotIndex]?.z ?? 0,
  });
  const [isWalking, setIsWalking] = useState(true);
  const [visible, setVisible] = useState(true);
  const rotationRef = useRef(
    rotationToward(posRef.current.x, posRef.current.z, 0, 0),
  );

  useEffect(() => {
    const entry = ALLY_CHOICE_ENTRY_POSITIONS[slotIndex] ?? ALLY_CHOICE_ENTRY_POSITIONS[0]!;
    const meet = ALLY_CHOICE_MEET_POSITIONS[slotIndex] ?? ALLY_CHOICE_MEET_POSITIONS[0]!;
    const startAtMeet = allyChoiceMade && chosenKind === kind;
    const rejectedAfterPick = allyChoiceMade && chosenKind != null && chosenKind !== kind;

    if (rejectedAfterPick) {
      phaseRef.current = 'gone';
      setVisible(false);
      setIsWalking(false);
      return;
    }

    if (startAtMeet) {
      phaseRef.current = 'idle';
      posRef.current = { x: meet.x, z: meet.z };
      rotationRef.current = rotationToward(meet.x, meet.z, 0, 0);
      setIsWalking(false);
      setVisible(true);
      return;
    }

    phaseRef.current = 'entering';
    posRef.current = { x: entry.x, z: entry.z };
    rotationRef.current = rotationToward(entry.x, entry.z, meet.x, meet.z);
    setIsWalking(true);
    setVisible(true);
  }, [kind, slotIndex, allyChoiceMade, chosenKind]);

  useFrame((_, delta) => {
    if (!visible || phaseRef.current === 'gone') {
      onMotionUpdate({ kind, x: posRef.current.x, z: posRef.current.z, phase: 'gone' });
      return;
    }

    if (allyChoiceMade && chosenKind != null && kind !== chosenKind && phaseRef.current !== 'leaving') {
      phaseRef.current = 'leaving';
    }

    let nextWalking = false;

    if (phaseRef.current === 'entering') {
      const meet = ALLY_CHOICE_MEET_POSITIONS[slotIndex] ?? ALLY_CHOICE_MEET_POSITIONS[0]!;
      const dx = meet.x - posRef.current.x;
      const dz = meet.z - posRef.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVAL_EPSILON) {
        posRef.current = { x: meet.x, z: meet.z };
        phaseRef.current = 'idle';
        rotationRef.current = rotationToward(meet.x, meet.z, 0, 0);
      } else {
        const step = Math.min(dist, ALLY_CHOICE_WALK_SPEED * delta);
        posRef.current = {
          x: posRef.current.x + (dx / dist) * step,
          z: posRef.current.z + (dz / dist) * step,
        };
        rotationRef.current = rotationToward(
          posRef.current.x,
          posRef.current.z,
          meet.x,
          meet.z,
        );
        nextWalking = true;
      }
    } else if (phaseRef.current === 'leaving') {
      const exit = ALLY_CHOICE_EXIT_POSITIONS[slotIndex] ?? ALLY_CHOICE_EXIT_POSITIONS[0]!;
      const dx = exit.x - posRef.current.x;
      const dz = exit.z - posRef.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVAL_EPSILON) {
        phaseRef.current = 'gone';
        setVisible(false);
      } else {
        const step = Math.min(dist, ALLY_CHOICE_WALK_SPEED * delta);
        posRef.current = {
          x: posRef.current.x + (dx / dist) * step,
          z: posRef.current.z + (dz / dist) * step,
        };
        rotationRef.current = rotationToward(
          posRef.current.x,
          posRef.current.z,
          exit.x,
          exit.z,
        );
        nextWalking = true;
      }
    }

    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, 0, posRef.current.z);
      groupRef.current.rotation.y = rotationRef.current;
    }

    setIsWalking((prev) => (prev === nextWalking ? prev : nextWalking));
    onMotionUpdate({
      kind,
      x: posRef.current.x,
      z: posRef.current.z,
      phase: phaseRef.current,
    });
  });

  const setGroupRef = useCallback(
    (node: Group | null) => {
      groupRef.current = node;
      anchorRef(node);
    },
    [anchorRef],
  );

  if (!visible) return null;

  return (
    <group ref={setGroupRef}>
      <Suspense fallback={null}>
        <AllyChoicePreviewModel kind={kind} isWalking={isWalking} />
      </Suspense>
      {!allyChoiceMade ? <SoulGroundRing soulType="yellow" /> : null}
      {!allyChoiceMade ? (
        <mesh
          position={[0, 1.2, 0]}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange(kind);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onHoverChange(null);
          }}
        >
          <sphereGeometry args={[0.85, 10, 10]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}
      {hovered ? (
        <pointLight color="#c4b5fd" intensity={0.35} distance={3} position={[0, 1.4, 0]} />
      ) : null}
    </group>
  );
}

export interface IntroAllyChoiceEncounterProps {
  offer: readonly CoopAllyKind[];
  allyChoiceMade: boolean;
  chosenKind: CoopAllyKind | null;
  playerPositionRef: React.MutableRefObject<Vector3>;
  encounterRef: React.MutableRefObject<IntroAllyChoiceEncounterRef | null>;
}

export default function IntroAllyChoiceEncounter({
  offer,
  allyChoiceMade,
  chosenKind,
  playerPositionRef,
  encounterRef,
}: IntroAllyChoiceEncounterProps) {
  const { camera, size } = useThree();
  const [hoveredKind, setHoveredKind] = useState<CoopAllyKind | null>(null);
  const groupRefs = useRef<Partial<Record<CoopAllyKind, Group | null>>>({});
  const motionByKindRef = useRef<Partial<Record<CoopAllyKind, CandidateMotionSnapshot>>>({});
  const lastPublishedTooltipRef = useRef<{
    kind: CoopAllyKind;
    x: number;
    y: number;
    name: string;
    description: string;
  } | null>(null);
  const snapshotRef = useRef<AllyChoiceEncounterCandidateSnapshot[]>([]);

  const offeredSlots = useMemo(
    () => offer.slice(0, 2).map((kind, slotIndex) => ({ kind, slotIndex })),
    [offer],
  );

  useEffect(() => {
    encounterRef.current = {
      getCandidates: () => snapshotRef.current,
    };
    return () => {
      encounterRef.current = null;
    };
  }, [encounterRef]);

  useEffect(() => () => clearMerchantShopTooltip(), []);

  const handleHoverChange = useCallback((kind: CoopAllyKind | null) => {
    setHoveredKind(kind);
  }, []);

  const handleMotionUpdate = useCallback((snapshot: CandidateMotionSnapshot) => {
    motionByKindRef.current[snapshot.kind] = snapshot;
  }, []);

  const makeAnchorRef = useCallback(
    (kind: CoopAllyKind) => (node: Group | null) => {
      groupRefs.current[kind] = node;
    },
    [],
  );

  useFrame(() => {
    const nextSnapshot: AllyChoiceEncounterCandidateSnapshot[] = [];
    for (const { kind } of offeredSlots) {
      const motion = motionByKindRef.current[kind];
      if (!motion || motion.phase === 'gone') continue;
      nextSnapshot.push({
        kind,
        x: motion.x,
        z: motion.z,
        selectable: motion.phase === 'idle' && !allyChoiceMade,
      });
    }
    snapshotRef.current = nextSnapshot;

    const playerPos = playerPositionRef.current;
    const interactRadiusSq = ALLY_CHOICE_INTERACT_RADIUS * ALLY_CHOICE_INTERACT_RADIUS;
    let nearest: { kind: CoopAllyKind; d2: number } | null = null;
    for (const candidate of nextSnapshot) {
      if (!candidate.selectable) continue;
      const dx = playerPos.x - candidate.x;
      const dz = playerPos.z - candidate.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= interactRadiusSq && (!nearest || d2 < nearest.d2)) {
        nearest = { kind: candidate.kind, d2 };
      }
    }

    const kindForTooltip = hoveredKind ?? nearest?.kind ?? null;
    if (!kindForTooltip) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const tooltipCandidate = nextSnapshot.find((entry) => entry.kind === kindForTooltip);
    if (!tooltipCandidate?.selectable) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const card = getAllyChoiceCard(kindForTooltip);
    if (!card) return;

    const symbolGroup = groupRefs.current[kindForTooltip];
    if (!symbolGroup || size.width <= 0 || size.height <= 0) return;

    symbolGroup.getWorldPosition(_projectScratch);
    _projectScratch.add(TOOLTIP_WORLD_OFFSET);
    _projectScratch.project(camera);

    const x = (_projectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_projectScratch.y * -0.5 + 0.5) * size.height;
    const description = getAllyChoiceTooltipDescription(kindForTooltip);

    const last = lastPublishedTooltipRef.current;
    const shouldPublish =
      !last
      || last.kind !== kindForTooltip
      || last.name !== card.title
      || last.description !== description
      || Math.abs(last.x - x) > 1.5
      || Math.abs(last.y - y) > 1.5;

    if (shouldPublish) {
      lastPublishedTooltipRef.current = {
        kind: kindForTooltip,
        x,
        y,
        name: card.title,
        description,
      };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: card.title,
        description,
      });
    }
  });

  if (offeredSlots.length === 0) return null;

  return (
    <group name="intro-ally-choice-encounter">
      {offeredSlots.map(({ kind, slotIndex }) => (
        <IntroAllyChoiceCandidate
          key={kind}
          kind={kind}
          slotIndex={slotIndex}
          allyChoiceMade={allyChoiceMade}
          chosenKind={chosenKind}
          hovered={hoveredKind === kind}
          onHoverChange={handleHoverChange}
          onMotionUpdate={handleMotionUpdate}
          anchorRef={makeAnchorRef(kind)}
        />
      ))}
    </group>
  );
}
