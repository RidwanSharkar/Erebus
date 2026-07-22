'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Group, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  MathUtils,
  MeshBasicMaterial,
  Vector3 as ThreeVector3,
} from '@/utils/three-exports';
import Pillar from '@/components/environment/Pillar';
import {
  DREAM_LAYER_SHOP_INTERACT_DEFS,
  DREAM_LAYER_SHOP_INTERACT_RADIUS,
  DREAM_LAYER_SHOP_PEDESTAL_POSITIONS,
  type DreamLayerShopSlotKind,
} from '@/components/environment/ThroneRoom';
import type { DreamLayerPurchaseState, DreamLayerStockItem } from '@/contexts/MultiplayerContext';
import { ITEM_RARITY_COLORS } from '@/utils/itemRarity';
import {
  getDreamLayerShopTooltipData,
  isDreamLayerSlotTaken,
} from '@/utils/dreamLayerShopUtils';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';

const FADE_OUT_SPEED = 10;
const FADE_IN_SPEED = 5;
const TOOLTIP_WORLD_OFFSET = new ThreeVector3(0, 1.35, 0);
const _projectScratch = new ThreeVector3();

function DreamLayerFloatingDisplay({
  xz,
  phase,
  isTaken,
  children,
}: {
  xz: [number, number];
  phase: number;
  isTaken: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<Group>(null);
  const visualRef = useRef<Group>(null);
  const visibilityRef = useRef(1);
  const targetRef = useRef(isTaken ? 0 : 1);
  const [qx, qz] = xz;

  useEffect(() => {
    targetRef.current = isTaken ? 0 : 1;
  }, [isTaken]);

  useFrame((state, delta) => {
    const g = rootRef.current;
    const visual = visualRef.current;
    if (!g) return;

    const target = targetRef.current;
    const fadeSpeed = target < visibilityRef.current ? FADE_OUT_SPEED : FADE_IN_SPEED;
    visibilityRef.current = MathUtils.lerp(
      visibilityRef.current,
      target,
      Math.min(1, delta * fadeSpeed),
    );

    const v = visibilityRef.current;
    if (visual) {
      visual.scale.setScalar(v);
      visual.visible = v > 0.02;
    }

    const t = state.clock.elapsedTime + phase;
    g.position.x = qx + Math.sin(t * 0.55) * 0.035 * v;
    g.position.y = 0.92 + Math.sin(t * 1.15) * 0.085 * v;
    g.position.z = qz + Math.cos(t * 0.48) * 0.03 * v;
    g.rotation.y = Math.sin(t * 0.42) * 0.045 * v;
  });

  return (
    <group ref={rootRef} position={[qx, 0.92, qz]}>
      <group ref={visualRef}>{children}</group>
    </group>
  );
}

function HealSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#60a5fa',
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  return (
    <group>
      <mesh material={mat} rotation={[0, 0, Math.PI / 4]} scale={[0.22, 0.22, 0.08]}>
        <boxGeometry args={[1, 1, 0.25]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, -Math.PI / 4]} scale={[0.22, 0.22, 0.08]}>
        <boxGeometry args={[1, 1, 0.25]} />
      </mesh>
    </group>
  );
}

function WardingSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#93c5fd',
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={mat} scale={[0.28, 0.28, 0.28]}>
      <octahedronGeometry args={[1, 0]} />
    </mesh>
  );
}

function ExodiaSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: ITEM_RARITY_COLORS.legendary,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={mat} scale={[0.24, 0.24, 0.24]}>
      <dodecahedronGeometry args={[1, 0]} />
    </mesh>
  );
}

function RingSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#a855f7',
        transparent: true,
        opacity: 0.88,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} scale={[0.3, 0.3, 0.3]}>
      <torusGeometry args={[1, 0.28, 8, 24]} />
    </mesh>
  );
}

function slotSymbol(slot: DreamLayerShopSlotKind) {
  switch (slot) {
    case 'heal':
      return <HealSymbol />;
    case 'warding_pendant':
      return <WardingSymbol />;
    case 'exodia':
      return <ExodiaSymbol />;
    case 'ring':
      return <RingSymbol />;
    default:
      return null;
  }
}

interface DreamLayerPedestalsProps {
  inventory: DreamLayerStockItem[];
  purchaseState: DreamLayerPurchaseState;
  playerPositionRef: React.MutableRefObject<Vector3>;
}

export default function DreamLayerPedestals({
  inventory,
  purchaseState,
  playerPositionRef,
}: DreamLayerPedestalsProps) {
  const { camera, size } = useThree();
  const symbolRefs = useRef<Partial<Record<DreamLayerShopSlotKind, Group | null>>>({});
  const [hoveredSlot, setHoveredSlot] = useState<DreamLayerShopSlotKind | null>(null);
  const [proximitySlot, setProximitySlot] = useState<DreamLayerShopSlotKind | null>(null);
  const lastPublishedTooltipRef = useRef<{
    slot: DreamLayerShopSlotKind;
    x: number;
    y: number;
    name: string;
    cost: number;
    description: string;
  } | null>(null);

  const slots = useMemo(
    () =>
      DREAM_LAYER_SHOP_PEDESTAL_POSITIONS.map((pedestal, index) => ({
        ...pedestal,
        phase: index * 1.35,
      })),
    [],
  );

  useEffect(() => () => clearMerchantShopTooltip(), []);

  const handleHoverChange = useCallback((slot: DreamLayerShopSlotKind | null) => {
    setHoveredSlot(slot);
  }, []);

  useFrame(() => {
    const playerPos = playerPositionRef.current;
    const interactRadiusSq = DREAM_LAYER_SHOP_INTERACT_RADIUS * DREAM_LAYER_SHOP_INTERACT_RADIUS;
    let nearest: { slot: DreamLayerShopSlotKind; d2: number } | null = null;

    for (const def of DREAM_LAYER_SHOP_INTERACT_DEFS) {
      const dx = playerPos.x - def.x;
      const dz = playerPos.z - def.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= interactRadiusSq && (!nearest || d2 < nearest.d2)) {
        nearest = { slot: def.slot, d2 };
      }
    }

    const nextProximity = nearest?.slot ?? null;
    if (nextProximity !== proximitySlot) {
      setProximitySlot(nextProximity);
    }

    const slotForTooltip = hoveredSlot ?? nextProximity;
    if (!slotForTooltip) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const taken = isDreamLayerSlotTaken(slotForTooltip, inventory, purchaseState);
    if (taken) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const tooltipData = getDreamLayerShopTooltipData(slotForTooltip, inventory, purchaseState);
    if (!tooltipData) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const symbolGroup = symbolRefs.current[slotForTooltip];
    if (!symbolGroup || size.width <= 0 || size.height <= 0) return;

    symbolGroup.getWorldPosition(_projectScratch);
    _projectScratch.add(TOOLTIP_WORLD_OFFSET);
    _projectScratch.project(camera);

    const x = (_projectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_projectScratch.y * -0.5 + 0.5) * size.height;

    const last = lastPublishedTooltipRef.current;
    const shouldPublish =
      !last
      || last.slot !== slotForTooltip
      || last.name !== tooltipData.name
      || last.cost !== tooltipData.cost
      || last.description !== tooltipData.description
      || Math.abs(last.x - x) > 1.5
      || Math.abs(last.y - y) > 1.5;

    if (shouldPublish) {
      lastPublishedTooltipRef.current = {
        slot: slotForTooltip,
        x,
        y,
        name: tooltipData.name,
        cost: tooltipData.cost,
        description: tooltipData.description,
      };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: tooltipData.name,
        cost: tooltipData.cost,
        costSuffix: ' FLOW',
        description: tooltipData.description,
      });
    }
  });

  return (
    <group name="dream-layer-shop-pedestals">
      {slots.map((slot) => {
        const taken = isDreamLayerSlotTaken(slot.slot, inventory, purchaseState);
        return (
          <group key={`dream-layer-shop-${slot.slot}`}>
            <Pillar position={[slot.x, slot.y, slot.z]} showOrb={false} />
            <DreamLayerFloatingDisplay
              xz={[slot.x + 0.55, slot.z]}
              phase={slot.phase}
              isTaken={taken}
            >
              <group
                ref={(node) => {
                  symbolRefs.current[slot.slot] = node;
                }}
                scale={0.75}
                position={[-0.5, 1.25, 0]}
              >
                {slotSymbol(slot.slot)}
                {!taken ? (
                  <mesh
                    onPointerOver={(event) => {
                      event.stopPropagation();
                      handleHoverChange(slot.slot);
                    }}
                    onPointerOut={(event) => {
                      event.stopPropagation();
                      handleHoverChange(null);
                    }}
                  >
                    <sphereGeometry args={[0.75, 8, 8]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                ) : null}
              </group>
            </DreamLayerFloatingDisplay>
          </group>
        );
      })}
    </group>
  );
}
