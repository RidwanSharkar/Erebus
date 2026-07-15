'use client';

import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  MathUtils,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import Pillar from '@/components/environment/Pillar';
import {
  MERCHANT_SHOP_PEDESTAL_POSITIONS,
  type MerchantShopSlotKind,
} from '@/components/environment/ThroneRoom';
import type { MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import { ITEM_RARITY_COLORS, isItemRarity } from '@/utils/itemRarity';
import { StatSystem } from '@/utils/StatSystem';

const MERCHANT_WEAPON_TALENT_MAX = 3;
const MERCHANT_HEAL_COST = 50;
const FADE_OUT_SPEED = 10;
const FADE_IN_SPEED = 5;
const COOP_MERCHANT_HINT_FALLBACK = "Press 'x' to buy";

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

function slotSymbol(slot: MerchantShopSlotKind, bossDropStock?: MerchantStockItem) {
  switch (slot) {
    case 'dash_charge':
      return <DashChargeSymbol />;
    case 'weapon_talent':
      return <TalentShardSymbol />;
    case 'heal':
      return <HeartHealSymbol />;
    case 'boss_drop':
      return <BossDropSymbol stock={bossDropStock} />;
    default:
      return null;
  }
}

function isSlotTaken(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState: MerchantPurchaseState,
): boolean {
  switch (slot) {
    case 'dash_charge':
      return purchaseState.dashChargePurchased;
    case 'weapon_talent':
      return purchaseState.weaponTalentPurchases >= MERCHANT_WEAPON_TALENT_MAX;
    case 'heal':
      return false;
    case 'boss_drop': {
      const entry = inventory.find((s) => s.kind === 'boss_drop');
      return !!entry?.sold;
    }
    default:
      return false;
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
}

export default function MerchantShopPedestals({
  inventory,
  purchaseState,
}: MerchantShopPedestalsProps) {
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

  return (
    <group name="merchant-shop-pedestals">
      {slots.map((slot) => {
        const taken = isSlotTaken(slot.slot, inventory, purchaseState);
        return (
          <group key={`merchant-shop-${slot.slot}`}>
            <Pillar position={[slot.x, slot.y, slot.z]} showOrb={false} />
            <MerchantFloatingDisplay
              xz={[slot.x + 0.55, slot.z]}
              phase={slot.phase}
              isTaken={taken}
            >
              <group scale={0.75} position={[-0.5, 1.25, 0]}>
                {slotSymbol(slot.slot, bossDropStock)}
              </group>
            </MerchantFloatingDisplay>
          </group>
        );
      })}
    </group>
  );
}
