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
  MERCHANT_SHOP_INTERACT_DEFS,
  MERCHANT_SHOP_INTERACT_RADIUS,
  MERCHANT_SHOP_PEDESTAL_POSITIONS,
  type MerchantShopSlotKind,
} from '@/components/environment/ThroneRoom';
import type { MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import { ITEM_RARITY_COLORS, isItemRarity } from '@/utils/itemRarity';
import { StatSystem } from '@/utils/StatSystem';
import {
  getMerchantShopTooltipData,
  getUtilityStock,
  isMerchantSlotTaken,
  MERCHANT_HEAL_COST,
} from '@/utils/merchantShopUtils';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';

const FADE_OUT_SPEED = 10;
const FADE_IN_SPEED = 5;
const COOP_MERCHANT_HINT_FALLBACK = "Press 'x' to buy";
const TOOLTIP_WORLD_OFFSET = new ThreeVector3(0, 1.35, 0);
const _projectScratch = new ThreeVector3();

function MerchantFloatingDisplay({
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

function DashChargeSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const accentMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.75,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh material={mat} position={[0, 0, 0.18]}>
        <boxGeometry args={[0.5, 0.12, 0.12]} />
      </mesh>
      <mesh material={mat} position={[0, 0, -0.18]}>
        <boxGeometry args={[0.5, 0.12, 0.12]} />
      </mesh>
      <mesh material={accentMat}>
        <octahedronGeometry args={[0.22, 0]} />
      </mesh>
    </group>
  );
}

function TalentShardSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#c084fc',
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const ringRef = useRef<Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.elapsedTime * 0.9;
    }
  });

  return (
    <group>
      <group ref={ringRef}>
        <mesh material={mat} rotation={[0.4, 0.3, 0.6]}>
          <icosahedronGeometry args={[0.32, 0]} />
        </mesh>
      </group>
      <mesh material={mat}>
        <torusGeometry args={[0.55, 0.04, 8, 20]} />
      </mesh>
    </group>
  );
}

function HeartHealSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#f472b6',
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const glowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ec4899',
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  return (
    <group>
      <mesh material={glowMat} scale={1.35}>
        <sphereGeometry args={[0.28, 10, 10]} />
      </mesh>
      <mesh material={mat} position={[-0.14, 0.08, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
      </mesh>
      <mesh material={mat} position={[0.14, 0.08, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
      </mesh>
      <mesh material={mat} position={[0, -0.12, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.22, 0.22, 0.12]} />
      </mesh>
    </group>
  );
}

function OxygenSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const glowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#0891b2',
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const bubbleRef = useRef<Group>(null);

  useFrame((state) => {
    if (bubbleRef.current) {
      bubbleRef.current.rotation.y = state.clock.elapsedTime * 0.65;
    }
  });

  return (
    <group>
      <mesh material={glowMat} scale={1.2}>
        <sphereGeometry args={[0.34, 12, 12]} />
      </mesh>
      <group ref={bubbleRef}>
        <mesh material={mat}>
          <sphereGeometry args={[0.24, 12, 12]} />
        </mesh>
        <mesh material={mat} position={[0.1, 0.12, 0.08]} scale={0.45}>
          <sphereGeometry args={[0.24, 8, 8]} />
        </mesh>
        <mesh material={mat} position={[-0.12, -0.08, 0.06]} scale={0.32}>
          <sphereGeometry args={[0.24, 8, 8]} />
        </mesh>
      </group>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.035, 8, 20]} />
      </mesh>
    </group>
  );
}

function WarpdriveSymbol() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trailMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh material={trailMat} position={[0, 0, -0.28]} rotation={[0.35, 0, 0]}>
        <coneGeometry args={[0.2, 0.55, 4]} />
      </mesh>
      <mesh material={trailMat} position={[0, 0, -0.12]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.26, 0.45, 4]} />
      </mesh>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <octahedronGeometry args={[0.28, 0]} />
      </mesh>
      <mesh material={mat} position={[0, 0, 0.22]} rotation={[-0.45, 0, 0]}>
        <coneGeometry args={[0.18, 0.42, 4]} />
      </mesh>
    </group>
  );
}

function BossDropSymbol({ stock }: { stock?: MerchantStockItem }) {
  const rarity = stock?.item?.rarity;
  const stat = stock?.item?.stat;
  const primaryColor =
    rarity && isItemRarity(rarity)
      ? ITEM_RARITY_COLORS[rarity]
      : stat
        ? StatSystem.getStatColor(stat)
        : '#eab308';
  const accentColor = stat ? StatSystem.getStatColor(stat) : primaryColor;

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [primaryColor],
  );
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [accentColor],
  );
  const ringRef = useRef<Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 1.1;
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.7) * 0.2;
    }
  });

  return (
    <group>
      <group ref={ringRef}>
        <mesh material={ringMat}>
          <torusGeometry args={[0.62, 0.05, 8, 24]} />
        </mesh>
      </group>
      <mesh material={coreMat}>
        <dodecahedronGeometry args={[0.26, 0]} />
      </mesh>
    </group>
  );
}

function slotSymbol(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  bossDropStock?: MerchantStockItem,
) {
  switch (slot) {
    case 'dash_charge':
      return <DashChargeSymbol />;
    case 'weapon_talent':
      return <TalentShardSymbol />;
    case 'heal':
      return <HeartHealSymbol />;
    case 'utility': {
      const utilityStock = getUtilityStock(inventory);
      if (utilityStock?.kind === 'warpdrive') return <WarpdriveSymbol />;
      return <OxygenSymbol />;
    }
    case 'boss_drop':
      return <BossDropSymbol stock={bossDropStock} />;
    default:
      return null;
  }
}

export function getMerchantShopStockId(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
): string | null {
  if (slot === 'heal') return null;
  if (slot === 'boss_drop') {
    return inventory.find((s) => s.kind === 'boss_drop')?.id ?? null;
  }
  if (slot === 'utility') {
    return getUtilityStock(inventory)?.id ?? null;
  }
  return inventory.find((s) => s.kind === slot)?.id ?? null;
}

export function getMerchantShopHintLabel(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
): string {
  switch (slot) {
    case 'dash_charge':
      return `Dash Charge — ${inventory.find((s) => s.kind === 'dash_charge')?.cost ?? 1000}g`;
    case 'weapon_talent':
      return `Class Talent — ${inventory.find((s) => s.kind === 'weapon_talent')?.cost ?? 600}g`;
    case 'heal':
      return `Heart Heal — ${MERCHANT_HEAL_COST}g`;
    case 'utility': {
      const entry = getUtilityStock(inventory);
      const label = entry?.label ?? (entry?.kind === 'warpdrive' ? 'Warpdrive' : 'Oxygen');
      return `${label} — ${entry?.cost ?? 300}g`;
    }
    case 'boss_drop': {
      const entry = inventory.find((s) => s.kind === 'boss_drop');
      const label = entry?.item?.label ?? entry?.label ?? 'Mystery Item';
      return `${label} — ${entry?.cost ?? '?'}g`;
    }
    default:
      return COOP_MERCHANT_HINT_FALLBACK;
  }
}

interface MerchantShopPedestalsProps {
  inventory: MerchantStockItem[];
  purchaseState: MerchantPurchaseState;
  playerPositionRef: React.MutableRefObject<Vector3>;
}

export default function MerchantShopPedestals({
  inventory,
  purchaseState,
  playerPositionRef,
}: MerchantShopPedestalsProps) {
  const { camera, size } = useThree();
  const symbolRefs = useRef<Partial<Record<MerchantShopSlotKind, Group | null>>>({});
  const [hoveredSlot, setHoveredSlot] = useState<MerchantShopSlotKind | null>(null);
  const [proximitySlot, setProximitySlot] = useState<MerchantShopSlotKind | null>(null);
  const lastPublishedTooltipRef = useRef<{
    slot: MerchantShopSlotKind;
    x: number;
    y: number;
    name: string;
    cost: number;
    description: string;
    limitLabel?: string;
  } | null>(null);

  const bossDropStock = useMemo(
    () => inventory.find((s) => s.kind === 'boss_drop'),
    [inventory],
  );

  const slots = useMemo(
    () =>
      MERCHANT_SHOP_PEDESTAL_POSITIONS.map((pedestal, index) => ({
        ...pedestal,
        phase: index * 1.35,
      })),
    [],
  );

  useEffect(() => () => clearMerchantShopTooltip(), []);

  const handleHoverChange = useCallback((slot: MerchantShopSlotKind | null) => {
    setHoveredSlot(slot);
  }, []);

  useFrame(() => {
    const playerPos = playerPositionRef.current;
    const interactRadiusSq = MERCHANT_SHOP_INTERACT_RADIUS * MERCHANT_SHOP_INTERACT_RADIUS;
    let nearest: { slot: MerchantShopSlotKind; d2: number } | null = null;

    for (const def of MERCHANT_SHOP_INTERACT_DEFS) {
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

    const taken = isMerchantSlotTaken(slotForTooltip, inventory, purchaseState);
    if (taken) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const tooltipData = getMerchantShopTooltipData(slotForTooltip, inventory, purchaseState);
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
      || last.limitLabel !== tooltipData.limitLabel
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
        limitLabel: tooltipData.limitLabel,
      };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: tooltipData.name,
        cost: tooltipData.cost,
        description: tooltipData.description,
        limitLabel: tooltipData.limitLabel,
      });
    }
  });

  return (
    <group name="merchant-shop-pedestals">
        {slots.map((slot) => {
          const taken = isMerchantSlotTaken(slot.slot, inventory, purchaseState);
          return (
            <group key={`merchant-shop-${slot.slot}`}>
              <Pillar position={[slot.x, slot.y, slot.z]} showOrb={false} />
              <MerchantFloatingDisplay
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
                  {slotSymbol(slot.slot, inventory, bossDropStock)}
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
                      <sphereGeometry args={[0.62, 10, 10]} />
                      <meshBasicMaterial visible={false} />
                    </mesh>
                  ) : null}
                </group>
              </MerchantFloatingDisplay>
            </group>
          );
        })}
    </group>
  );
}
