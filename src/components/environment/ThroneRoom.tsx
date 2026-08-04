import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Group, MathUtils, MeshBasicMaterial, SphereGeometry, TorusGeometry, Vector3 } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import ThroneCenterSeal, { THRONE_CENTER_SEAL_RADIUS } from './ThroneCenterSeal';
import ThroneOuterFloor from './ThroneOuterFloor';
import SanctumIncinerationRuneDisc, {
  sanctumRuneDiscScaleForBandInner,
} from './SanctumIncinerationRuneDisc';
import StylizedGrass, { resolveGrassPresetByIndex } from './StylizedGrass';
import ThroneNatureProps from './ThroneNatureProps';
import ThroneTurretProps from './ThroneTurretProps';
import VoidPortal from './VoidPortal';
import Pillar from './Pillar';
import { ArenaRewardPedestalBase } from './CombatArenaPedestal';
import ThronePedestalAura from './ThronePedestalAura';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import EtherealBow from '@/components/weapons/EtherBow';
import Scythe from '@/components/weapons/Scythe';
import Sabres from '@/components/weapons/Sabres';
import Runeblade from '@/components/weapons/Runeblade';
import type { WeaponAspectByWeapon } from '@/utils/weaponAspects';
import {
  getShowcaseWeaponAspect,
  getWeaponAspectTooltipData,
  resolvePedestalWeaponAspect,
} from '@/utils/weaponAspects';
import PortalSymbol from './PortalSymbols';
import ArcaneRitualCircle from './ArcaneRitualCircle';
import { RITUAL_WORLD_SCALE } from './ritualCircleGeometries';
import {
  COOP_MAIN_COMBAT_PEDESTAL_X,
  COOP_MAIN_COMBAT_PEDESTAL_Z,
  COOP_MAIN_COMBAT_PORTAL_HALF_SPACING_X,
} from '@/utils/coopArenaLayout';
import {
  ARCHETYPE_DISPLAY,
  ARCHETYPE_PEDESTAL_GLOW,
  getArchetypePedestalCapGlow,
  type Archetype,
  type ThroneArchetype,
} from '@/utils/archetypes';
import ArchetypeTrinketMeshVisual from '@/components/environment/ArchetypeTrinketMeshVisual';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';
import { CASTLE_ROOM_HALF_SIZE } from '@/utils/mapConstants';
import ThroneSkyRayDecor from './ThroneSkyRayDecor';
import ThroneStatueDecor from './ThroneStatueDecor';
import ThronePerimeterPylonDecor from './ThronePerimeterPylonDecor';
import ThroneCenterDecor from './ThroneCenterDecor';
import CloudSeaOcean from './CloudSeaOcean';
import ThroneIslandUnderside from './ThroneIslandUnderside';
import ThroneRimMistfall from './ThroneRimMistfall';
import ThroneVoidMotes from './ThroneVoidMotes';

/** Shared portal ring geometry — reused across all ThronePortalRing instances. */
const THRONE_PORTAL_RING_TORUS_GEO = new TorusGeometry(2.1, 0.12, 10, 48);
const THRONE_PORTAL_INNER_SPHERE_GEO = new SphereGeometry(1.35, 24, 24);

/** Original throne staging layout (portals, pedestals, inner pavers); unchanged when expanding grass. */
export const COOP_THRONE_LAYOUT_RADIUS = 15;

/** Grass, VFX, physics clamp, outer perimeter — 2× the legacy 16m playable disk. */
export const COOP_THRONE_ROOM_RADIUS = 15;

/** Align grass with ThroneOuterFloor / ThroneCenterSeal (default floor Z offset). */
const THRONE_GRASS_POSITION: [number, number, number] = [0, 0.0, 0.];
/** Matches `StylizedGrass` `radius` prop below — grass ends inset from COOP_THRONE_ROOM_RADIUS. */
const THRONE_GRASS_OUTER_RADIUS = COOP_THRONE_ROOM_RADIUS * 0.9375;
/** Inner rune band edge meets grass perimeter; center + Y aligned with grass soil disc. */
const THRONE_RUNE_DISC_SCALE = sanctumRuneDiscScaleForBandInner(THRONE_GRASS_OUTER_RADIUS);
const THRONE_RUNE_DISC_SPIN_SCALE = 0.45;
const THRONE_RUNE_DISC_POSITION: [number, number, number] = [
  THRONE_GRASS_POSITION[0],
  THRONE_GRASS_POSITION[1] + 0.01,
  THRONE_GRASS_POSITION[2],
];
/** Annulus area ≈ 66% of full disc — denser than a linear ratio would suggest, still lighter than 80k. */
const THRONE_GRASS_COUNT = 35_000;


/** XZ radius for movement physics, sword charge, and ECS `PillarCollision` cylinders on weapon pillars. */
export const THRONE_PILLAR_HULL_RADIUS = 0.55;

/** Smaller XZ hull for compact archetype pedestals (`ArenaRewardPedestalBase`). */
export const THRONE_ARCHETYPE_PEDESTAL_HULL_RADIUS = 0.35;

export type ThronePillarDef = {
  position: [number, number, number];
  orbColorHex: string;
};

/** Four pillars in a ring — orb colours: green, blue, red, light purple. */
export const THRONE_PILLAR_DEFS: ThronePillarDef[] = [
  { position: [-5.76, 0.15, -4.2], orbColorHex: '#00B7FF' }, // BOW
  { position: [5.76, 0.15, -4.2], orbColorHex: '#E879F9' }, // RUNEBLADE
  { position: [-2.1, 0.15, -6.5], orbColorHex: '#ef4444' }, // SABRES
  { position: [2.1, 0.15, -6.5], orbColorHex: '#22c55e' }, // SCYTHE 8667E5
];

/** Stable reference for `PillarCollision` (avoid new array identity every React render). */
export const THRONE_PILLAR_POSITIONS: Array<[number, number, number]> = THRONE_PILLAR_DEFS.map(
  (d) => d.position,
);

export function getThronePillarPhysicsObstacles(): Array<{ x: number; z: number; radius: number }> {
  return THRONE_PILLAR_DEFS.map((d) => ({
    x: d.position[0],
    z: d.position[2],
    radius: THRONE_PILLAR_HULL_RADIUS,
  }));
}

/** Inset from grass radius so portal / dummy sit just inside the rim. */
export const THRONE_RIM_INSET = 1.25;

const THRONE_PORTAL_Y = 1.15;
const THRONE_PORTAL_Z = -(COOP_THRONE_LAYOUT_RADIUS - THRONE_RIM_INSET);

/** World-space center between the two portal rings (XZ). South rim of prep circle. */
export const THRONE_PORTAL_POSITION = Object.freeze({
  x: 0,
  y: THRONE_PORTAL_Y,
  z: THRONE_PORTAL_Z,
});

/** Half-distance on X between the two throne portal centers (portals sit side by side on the south rim). */
export const THRONE_PORTAL_HALF_SPACING_X = 5.25;

/** Left portal [0] = west (−X), right portal [1] = east (+X). Order matches `thronePortalOffer` indices. */
export const THRONE_PORTAL_POSITIONS: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }> =
  Object.freeze([
    Object.freeze({ x: -THRONE_PORTAL_HALF_SPACING_X, y: THRONE_PORTAL_Y, z: THRONE_PORTAL_Z }),
    Object.freeze({ x: THRONE_PORTAL_HALF_SPACING_X, y: THRONE_PORTAL_Y, z: THRONE_PORTAL_Z }),
  ]);

/** Main map: reward pedestal at the far end of the arena (opposite the player entry). */
export const MAIN_COMBAT_PEDESTAL_POSITION = Object.freeze({
  x: COOP_MAIN_COMBAT_PEDESTAL_X,
  y: 0,
  z: COOP_MAIN_COMBAT_PEDESTAL_Z,
});

/** XZ interaction radius for the combat arena pedestal. */
export const MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS = 3.0;

/** Merchant room NPC — stands behind the reward pedestal (toward +Z). */
export const MERCHANT_NPC_POSITION = Object.freeze({ x: 0, y: 0, z: 15.5 });

/** Default yaw: faces toward player entry (-Z). */
export const MERCHANT_NPC_DEFAULT_ROTATION_Y = Math.PI;

/** XZ distance within which the merchant rotates to track the local player. */
export const MERCHANT_NPC_FACE_RANGE = 7;

export type MerchantShopSlotKind =
  | 'dash_charge'
  | 'weapon_talent'
  | 'utility'
  | 'heal'
  | 'boss_drop';

/** Five shop pedestals in a row in front of the merchant NPC (toward arena center). */
export const MERCHANT_SHOP_PEDESTAL_POSITIONS: ReadonlyArray<{
  readonly slot: MerchantShopSlotKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({ slot: 'dash_charge' as const, x: -6.75, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'weapon_talent' as const, x: -3.375, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'utility' as const, x: 0, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'heal' as const, x: 3.375, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'boss_drop' as const, x: 6.75, y: 0, z: 12.5 }),
]);

export const MERCHANT_SHOP_INTERACT_RADIUS = 2.35;

export type MerchantShopInteractDef = {
  slot: MerchantShopSlotKind;
  x: number;
  z: number;
};

export const MERCHANT_SHOP_INTERACT_DEFS: MerchantShopInteractDef[] =
  MERCHANT_SHOP_PEDESTAL_POSITIONS.map((p) => ({
    slot: p.slot,
    x: p.x,
    z: p.z,
  }));

/** Dream Layer secret shop NPC — same layout shell as merchant. */
export const ARCHITECT_NPC_POSITION = Object.freeze({ x: 0, y: 0, z: 15.5 });
export const ARCHITECT_NPC_DEFAULT_ROTATION_Y = Math.PI;
export const ARCHITECT_NPC_FACE_RANGE = 7;

export type DreamLayerShopSlotKind =
  | 'heal'
  | 'warding_pendant'
  | 'legendary_a'
  | 'legendary_b'
  | 'ring';

/** Five shop pedestals matching merchant spacing (toward arena center). */
export const DREAM_LAYER_SHOP_PEDESTAL_POSITIONS: ReadonlyArray<{
  readonly slot: DreamLayerShopSlotKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({ slot: 'heal' as const, x: -6.75, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'warding_pendant' as const, x: -3.375, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'legendary_a' as const, x: 0, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'legendary_b' as const, x: 3.375, y: 0, z: 12.5 }),
  Object.freeze({ slot: 'ring' as const, x: 6.75, y: 0, z: 12.5 }),
]);

export const DREAM_LAYER_SHOP_INTERACT_RADIUS = 2.35;

export type DreamLayerShopInteractDef = {
  slot: DreamLayerShopSlotKind;
  x: number;
  z: number;
};

export const DREAM_LAYER_SHOP_INTERACT_DEFS: DreamLayerShopInteractDef[] =
  DREAM_LAYER_SHOP_PEDESTAL_POSITIONS.map((p) => ({
    slot: p.slot,
    x: p.x,
    z: p.z,
  }));

/** Half-distance on X between the two main-arena choice portals flanking the combat pedestal. */
export const MAIN_COMBAT_PORTAL_HALF_SPACING_X = COOP_MAIN_COMBAT_PORTAL_HALF_SPACING_X;

/** Main co-op combat map: choice portals flanking the reward pedestal (left = offer[0], right = offer[1]). */
export const MAIN_COMBAT_CHOICE_PORTAL_POSITIONS: ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({
    x: -MAIN_COMBAT_PORTAL_HALF_SPACING_X,
    y: THRONE_PORTAL_Y,
    z: MAIN_COMBAT_PEDESTAL_POSITION.z,
  }),
  Object.freeze({
    x: MAIN_COMBAT_PORTAL_HALF_SPACING_X,
    y: THRONE_PORTAL_Y,
    z: MAIN_COMBAT_PEDESTAL_POSITION.z,
  }),
]);

/**
 * Inner Sanctum / Sunken Temple fountain-phase choice portals — inset toward map center
 * (castle/sunken floors are radius 14; main-arena uses COOP_MAIN_COMBAT_PEDESTAL_Z).
 */
export const CASTLE_ROOM_PORTAL_HALF_SPACING_X = 4;
export const CASTLE_ROOM_CHOICE_PORTAL_Z = 6;

export const CASTLE_ROOM_CHOICE_PORTAL_POSITIONS: ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({
    x: -CASTLE_ROOM_PORTAL_HALF_SPACING_X,
    y: THRONE_PORTAL_Y,
    z: CASTLE_ROOM_CHOICE_PORTAL_Z,
  }),
  Object.freeze({
    x: CASTLE_ROOM_PORTAL_HALF_SPACING_X,
    y: THRONE_PORTAL_Y,
    z: CASTLE_ROOM_CHOICE_PORTAL_Z,
  }),
]);

/** Main map: boss-gate ring after wave 2. */
export const MAIN_COMBAT_BOSS_PORTAL_POSITION = Object.freeze({
  x: 0,
  y: THRONE_PORTAL_Y,
  z: 0,
});

export type ThroneMainRoomCamp = 'purple' | 'blue' | 'red' | 'green';
export type CoopPortalKind = ThroneMainRoomCamp | 'stat' | 'trial' | 'merchant' | 'boss';

const THRONE_PORTAL_COLOR_HEX: Record<CoopPortalKind, string> = {
  purple: '#6c3dff',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  stat: '#f97316',
  trial: '#eab308',
  merchant: '#ec4899',
  boss: '#dc2626',
};

const PORTAL_RITUAL_COLORS: Record<CoopPortalKind, { base: string; glow: string }> = {
  purple: { base: '#4c1d95', glow: '#c4b5fd' },
  blue: { base: '#1e3a8a', glow: '#93c5fd' },
  red: { base: '#991b1b', glow: '#fca5a5' },
  green: { base: '#166534', glow: '#86efac' },
  stat: { base: '#c2410c', glow: '#fdba74' },
  trial: { base: '#a16207', glow: '#fde047' },
  merchant: { base: '#be185d', glow: '#f9a8d4' },
  boss: { base: '#991b1b', glow: '#fca5a5' },
};

export function normalizeThroneCamp(s: string | undefined): ThroneMainRoomCamp {
  const k = String(s || '').toLowerCase();
  if (k === 'purple' || k === 'blue' || k === 'red' || k === 'green') return k;
  return 'purple';
}

export function normalizeCoopPortalKind(s: string | undefined): CoopPortalKind {
  const k = String(s || '').toLowerCase();
  if (k === 'healing') return 'merchant';
  if (
    k === 'purple' ||
    k === 'blue' ||
    k === 'red' ||
    k === 'green' ||
    k === 'stat' ||
    k === 'trial' ||
    k === 'merchant' ||
    k === 'boss'
  ) {
    return k;
  }
  return 'purple';
}

/** Title-only labels for colored portal choice tooltips. */
export const COOP_PORTAL_TOOLTIP_LABEL: Partial<Record<CoopPortalKind, string>> = {
  trial: 'GOLD',
  stat: 'STATS',
  red: 'INFERNAL GATE',
  green: 'ELDRITCH GATE',
  blue: 'TEMPEST GATE',
  purple: 'ABYSSAL GATE',
  merchant: 'MERCHANT',
};

export function getCoopPortalTooltipData(
  kind: CoopPortalKind,
): { name: string; description: string } | null {
  const name = COOP_PORTAL_TOOLTIP_LABEL[kind];
  if (!name) return null;
  return { name, description: '' };
}

/** Proximity radius for portal choice tooltips (matches portal interact distance). */
export const COOP_PORTAL_TOOLTIP_INTERACT_RADIUS = 3.3;

const COOP_PORTAL_TOOLTIP_WORLD_OFFSET = new Vector3(0, 2.2, 0);
const _coopPortalProjectScratch = new Vector3();

export type CoopPortalTooltipEntry = {
  key: string;
  kind: CoopPortalKind;
  x: number;
  y: number;
  z: number;
};

/**
 * Publishes merchant-style floating tooltips above colored portal choices
 * (proximity or mesh hover). Title-only labels like GOLD / INFERNAL GATE.
 */
export function CoopPortalOfferTooltips({
  portals,
  playerPositionRef,
  locked = false,
  symbolRefs,
  hoveredKey,
}: {
  portals: ReadonlyArray<CoopPortalTooltipEntry>;
  playerPositionRef: React.MutableRefObject<Vector3>;
  locked?: boolean;
  symbolRefs: React.MutableRefObject<Partial<Record<string, Group | null>>>;
  hoveredKey: string | null;
}) {
  const { camera, size } = useThree();
  const [proximityKey, setProximityKey] = useState<string | null>(null);
  const lastPublishedTooltipRef = useRef<{
    key: string;
    x: number;
    y: number;
    name: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      lastPublishedTooltipRef.current = null;
      clearMerchantShopTooltip();
    };
  }, []);

  useFrame(() => {
    if (locked || portals.length === 0) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      if (proximityKey !== null) setProximityKey(null);
      return;
    }

    const playerPos = playerPositionRef.current;
    const interactRadiusSq =
      COOP_PORTAL_TOOLTIP_INTERACT_RADIUS * COOP_PORTAL_TOOLTIP_INTERACT_RADIUS;
    let nearest: { key: string; d2: number } | null = null;

    for (const portal of portals) {
      const dx = playerPos.x - portal.x;
      const dz = playerPos.z - portal.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= interactRadiusSq && (!nearest || d2 < nearest.d2)) {
        nearest = { key: portal.key, d2 };
      }
    }

    const nextProximity = nearest?.key ?? null;
    if (nextProximity !== proximityKey) {
      setProximityKey(nextProximity);
    }

    const keyForTooltip = hoveredKey ?? nextProximity;
    if (!keyForTooltip) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const portal = portals.find((entry) => entry.key === keyForTooltip);
    if (!portal) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const tooltipData = getCoopPortalTooltipData(portal.kind);
    if (!tooltipData) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const symbolGroup = symbolRefs.current[keyForTooltip];
    if (!symbolGroup || size.width <= 0 || size.height <= 0) return;

    symbolGroup.getWorldPosition(_coopPortalProjectScratch);
    _coopPortalProjectScratch.add(COOP_PORTAL_TOOLTIP_WORLD_OFFSET);
    _coopPortalProjectScratch.project(camera);

    const x = (_coopPortalProjectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_coopPortalProjectScratch.y * -0.5 + 0.5) * size.height;

    const last = lastPublishedTooltipRef.current;
    const shouldPublish =
      !last
      || last.key !== keyForTooltip
      || last.name !== tooltipData.name
      || last.description !== tooltipData.description
      || Math.abs(last.x - x) > 1.5
      || Math.abs(last.y - y) > 1.5;

    if (shouldPublish) {
      lastPublishedTooltipRef.current = {
        key: keyForTooltip,
        x,
        y,
        name: tooltipData.name,
        description: tooltipData.description,
      };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: tooltipData.name,
        description: tooltipData.description,
      });
    }
  });

  return null;
}

/** Renders portal rings with proximity + hover tooltips. */
export function CoopPortalRingsWithTooltips({
  portals,
  playerPositionRef,
  locked = false,
}: {
  portals: ReadonlyArray<CoopPortalTooltipEntry>;
  playerPositionRef: React.MutableRefObject<Vector3>;
  locked?: boolean;
}) {
  const symbolRefs = useRef<Partial<Record<string, Group | null>>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const handleHoverChange = useCallback((key: string | null) => {
    setHoveredKey(key);
  }, []);

  return (
    <>
      <CoopPortalOfferTooltips
        portals={portals}
        playerPositionRef={playerPositionRef}
        locked={locked}
        symbolRefs={symbolRefs}
        hoveredKey={hoveredKey}
      />
      {portals.map((portal) => (
        <group
          key={portal.key}
          position={[portal.x, portal.y, portal.z]}
          ref={(node) => {
            symbolRefs.current[portal.key] = node;
          }}
        >
          <ThronePortalRing
            campType={portal.kind}
            locked={locked}
            hoverKey={portal.key}
            onHoverChange={locked ? undefined : handleHoverChange}
          />
        </group>
      ))}
    </>
  );
}

/** Must match `gameRoom.js` throne training dummy id. */
export const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

export type ThroneTrainingDummyVisual = 'knight';

/**
 * North rim, centered on X (mirrors portal pair on south rim). Keep in sync with `backend/gameRoom.js` `THRONE_TRAINING_DUMMY_*`.
 */
export const THRONE_TRAINING_DUMMY_SPAWN_Z = 14;

/** Server spawn list: stable id, foot XZ, and which model the client draws. */
export const THRONE_TRAINING_DUMMY_SPAWNS: ReadonlyArray<{
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly dummyVisual: ThroneTrainingDummyVisual;
}> = Object.freeze([
  { id: THRONE_TRAINING_DUMMY_ID, x: 0, z: THRONE_TRAINING_DUMMY_SPAWN_Z, dummyVisual: 'knight' },
]);

/** World-space foot position of the training dummy. */
export const THRONE_TRAINING_DUMMY_POSITION = Object.freeze({
  x: THRONE_TRAINING_DUMMY_SPAWNS[0]!.x,
  y: 0,
  z: THRONE_TRAINING_DUMMY_SPAWNS[0]!.z,
});

/** Faces toward the portal (-Z). */
export const THRONE_TRAINING_DUMMY_ROTATION = Math.PI;

/** Distance from pillar base toward room center — weapon sits in front of the pillar (toward center). */
export const THRONE_WEAPON_INSET = -0.25;

/** Proximity radius (XZ) for “press X to equip” at each floating weapon replica. */
export const THRONE_WEAPON_INTERACT_RADIUS = 2.35;

/** East rim — plain stone pillar for ability loadout (press X). XZ foot position. */
export const THRONE_ABILITY_PEDESTAL_POSITION = Object.freeze({
  x: COOP_THRONE_LAYOUT_RADIUS - THRONE_RIM_INSET - 2.75,
  y: 0,
  z: -1,
});

export const THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS = THRONE_WEAPON_INTERACT_RADIUS;

/** East rim — beside ability pillar; talent loadout (press X). Same X, offset Z. */
export const THRONE_TALENT_PEDESTAL_POSITION = Object.freeze({
  x: THRONE_ABILITY_PEDESTAL_POSITION.x,
  y: 0,
  z: THRONE_ABILITY_PEDESTAL_POSITION.z + 2,
});

export const THRONE_TALENT_PEDESTAL_INTERACT_RADIUS = THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS;

/** West rim — three plain stone pillars for archetype selection (press X). */
export const THRONE_ARCHETYPE_PEDESTAL_EDGE_X = -(COOP_THRONE_LAYOUT_RADIUS - THRONE_RIM_INSET);

export const THRONE_ARCHETYPE_PEDESTAL_POSITIONS: ReadonlyArray<{
  readonly archetype: ThroneArchetype;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({ archetype: 'ROGUE' as const, x: THRONE_ARCHETYPE_PEDESTAL_EDGE_X+13.75, y: 0, z: 7.65 }),
  Object.freeze({ archetype: 'GLADIATOR' as const, x: THRONE_ARCHETYPE_PEDESTAL_EDGE_X+19.625, y: 0, z: 5.205 }),
  Object.freeze({ archetype: 'ACOLYTE' as const, x: THRONE_ARCHETYPE_PEDESTAL_EDGE_X+21.412, y: 0, z: -0.04 }),
  Object.freeze({ archetype: 'ALCHEMIST' as const, x: THRONE_ARCHETYPE_PEDESTAL_EDGE_X+7.9, y: 0, z: 5.215 }),
  Object.freeze({ archetype: 'SORCERESS' as const, x: THRONE_ARCHETYPE_PEDESTAL_EDGE_X+6.105, y: 0, z: -0.14 }),
]);

export const THRONE_ARCHETYPE_INTERACT_RADIUS = THRONE_WEAPON_INTERACT_RADIUS;

export type ThroneArchetypeInteractDef = {
  archetype: ThroneArchetype;
  x: number;
  z: number;
};

export const THRONE_ARCHETYPE_INTERACT_DEFS: ThroneArchetypeInteractDef[] =
  THRONE_ARCHETYPE_PEDESTAL_POSITIONS.map((p) => ({
    archetype: p.archetype,
    x: p.x,
    z: p.z,
  }));

/** Local dev / non-production builds — ability/talent pedestals and chat room/boss shortcuts. */
export const COOP_DEV_LOCALHOST_FEATURES = process.env.NODE_ENV !== 'production';

/** Pillars + archetype pedestal hulls for movement / charge collision in the prep room. */
export function getThronePrepPhysicsObstacles(): Array<{ x: number; z: number; radius: number }> {
  const obstacles = [...getThronePillarPhysicsObstacles()];
  for (const pedestal of THRONE_ARCHETYPE_PEDESTAL_POSITIONS) {
    obstacles.push({
      x: pedestal.x,
      z: pedestal.z,
      radius: THRONE_ARCHETYPE_PEDESTAL_HULL_RADIUS,
    });
  }
  return obstacles;
}

export function xzTowardRoomCenter(pillar: [number, number, number], inset: number): [number, number] {
  const [px, , pz] = pillar;
  const r = Math.hypot(px, pz);
  if (r < 1e-5) return [0, 0];
  const nx = px / r;
  const nz = pz / r;
  return [px - nx * inset, pz - nz * inset];
}

export type ThroneWeaponInteractDef = {
  weapon: WeaponType;
  x: number;
  z: number;
};

/**
 * World XZ of each throne weapon pedestal (same construction as `ThroneWeaponPedestals` slots).
 * Order: runeblade, sabres, scythe, bow — pillar indices [1,2,3,0].
 */
export const THRONE_WEAPON_INTERACT_DEFS: ThroneWeaponInteractDef[] = (() => {
  const mk = (pillar: [number, number, number], weapon: WeaponType) => {
    const [x, z] = xzTowardRoomCenter(pillar, THRONE_WEAPON_INSET);
    return { weapon, x, z };
  };
  return [
    mk(THRONE_PILLAR_DEFS[1]!.position, WeaponType.RUNEBLADE),
    mk(THRONE_PILLAR_DEFS[2]!.position, WeaponType.SABRES),
    mk(THRONE_PILLAR_DEFS[3]!.position, WeaponType.SCYTHE),
    mk(THRONE_PILLAR_DEFS[0]!.position, WeaponType.BOW),
  ];
})();

const THRONE_WEAPON_FADE_OUT_SPEED = 10;
const THRONE_WEAPON_FADE_IN_SPEED = 5;

const THRONE_PEDESTAL_TOOLTIP_WORLD_OFFSET = new Vector3(0, 1.35, 0);
const _thronePedestalProjectScratch = new Vector3();

type ThronePedestalTooltipKey = string;

function thronePedestalTooltipKey(
  kind: 'weapon' | 'archetype',
  id: WeaponType | ThroneArchetype,
): ThronePedestalTooltipKey {
  return `${kind}:${id}`;
}

function getThroneArchetypeTooltipData(archetype: ThroneArchetype): {
  name: string;
  description: string;
} {
  const meta = ARCHETYPE_DISPLAY[archetype];
  return { name: meta.label, description: meta.description };
}

/** Maps each THRONE_PILLAR_DEFS index to its weapon: [0]=BOW, [1]=RUNEBLADE, [2]=SABRES, [3]=SCYTHE */
const THRONE_PILLAR_WEAPONS: WeaponType[] = [
  WeaponType.BOW,
  WeaponType.RUNEBLADE,
  WeaponType.SABRES,
  WeaponType.SCYTHE,
];

/**
 * Publishes merchant-style floating tooltips for throne weapon + archetype pedestals.
 * Weapon tooltips stay eligible after equip so aspect info remains visible while nearby.
 */
function ThronePrepPedestalTooltips({
  playerPositionRef,
  selectedArchetype,
  equippedWeapon = WeaponType.NONE,
  weaponAspectByWeapon,
  showcaseTick,
  symbolRefs,
  hoveredKey,
}: {
  playerPositionRef: React.MutableRefObject<Vector3>;
  selectedArchetype: Archetype;
  equippedWeapon?: WeaponType;
  weaponAspectByWeapon?: WeaponAspectByWeapon;
  showcaseTick: number;
  symbolRefs: React.MutableRefObject<Partial<Record<ThronePedestalTooltipKey, Group | null>>>;
  hoveredKey: ThronePedestalTooltipKey | null;
}) {
  const { camera, size } = useThree();
  const [proximityKey, setProximityKey] = useState<ThronePedestalTooltipKey | null>(null);
  const lastPublishedTooltipRef = useRef<{
    key: ThronePedestalTooltipKey;
    x: number;
    y: number;
    name: string;
    description: string;
  } | null>(null);

  const slots = useMemo(
    () => [
      ...THRONE_WEAPON_INTERACT_DEFS.map((def) => ({
        key: thronePedestalTooltipKey('weapon', def.weapon),
        kind: 'weapon' as const,
        weapon: def.weapon,
        x: def.x,
        z: def.z,
        // Weapons remain tooltip-eligible after equip (aspect cycling).
        taken: false,
      })),
      ...THRONE_ARCHETYPE_INTERACT_DEFS.map((def) => ({
        key: thronePedestalTooltipKey('archetype', def.archetype),
        kind: 'archetype' as const,
        archetype: def.archetype,
        x: def.x,
        z: def.z,
        taken:
          selectedArchetype !== 'NONE' && selectedArchetype === def.archetype,
      })),
    ],
    [selectedArchetype],
  );

  useEffect(() => () => clearMerchantShopTooltip(), []);

  useFrame(() => {
    const playerPos = playerPositionRef.current;
    const interactRadiusSq =
      THRONE_WEAPON_INTERACT_RADIUS * THRONE_WEAPON_INTERACT_RADIUS;
    let nearest: { key: ThronePedestalTooltipKey; d2: number } | null = null;

    for (const slot of slots) {
      if (slot.taken) continue;
      const dx = playerPos.x - slot.x;
      const dz = playerPos.z - slot.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= interactRadiusSq && (!nearest || d2 < nearest.d2)) {
        nearest = { key: slot.key, d2 };
      }
    }

    const nextProximity = nearest?.key ?? null;
    if (nextProximity !== proximityKey) {
      setProximityKey(nextProximity);
    }

    const keyForTooltip = hoveredKey ?? nextProximity;
    if (!keyForTooltip) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const slot = slots.find((entry) => entry.key === keyForTooltip);
    if (!slot || slot.taken) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const tooltipData =
      slot.kind === 'weapon'
        ? getWeaponAspectTooltipData(
            slot.weapon === equippedWeapon
              ? resolvePedestalWeaponAspect(slot.weapon, weaponAspectByWeapon)
              : getShowcaseWeaponAspect(slot.weapon, showcaseTick),
          )
        : getThroneArchetypeTooltipData(slot.archetype);
    if (!tooltipData) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const symbolGroup = symbolRefs.current[keyForTooltip];
    if (!symbolGroup || size.width <= 0 || size.height <= 0) return;

    symbolGroup.getWorldPosition(_thronePedestalProjectScratch);
    _thronePedestalProjectScratch.add(THRONE_PEDESTAL_TOOLTIP_WORLD_OFFSET);
    _thronePedestalProjectScratch.project(camera);

    const x = (_thronePedestalProjectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_thronePedestalProjectScratch.y * -0.5 + 0.5) * size.height;

    const last = lastPublishedTooltipRef.current;
    const shouldPublish =
      !last
      || last.key !== keyForTooltip
      || last.name !== tooltipData.name
      || last.description !== tooltipData.description
      || Math.abs(last.x - x) > 1.5
      || Math.abs(last.y - y) > 1.5;

    if (shouldPublish) {
      lastPublishedTooltipRef.current = {
        key: keyForTooltip,
        x,
        y,
        name: tooltipData.name,
        description: tooltipData.description,
      };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: tooltipData.name,
        description: tooltipData.description,
      });
    }
  });

  return null;
}

function ThronePrepSelectionPedestals({
  playerPositionRef,
  equippedWeapon = WeaponType.NONE,
  selectedArchetype = 'NONE',
  weaponAspectByWeapon,
  showcaseTick = 0,
}: {
  playerPositionRef: React.MutableRefObject<Vector3>;
  equippedWeapon?: WeaponType;
  selectedArchetype?: Archetype;
  weaponAspectByWeapon?: WeaponAspectByWeapon;
  showcaseTick?: number;
}) {
  const symbolRefs = useRef<Partial<Record<ThronePedestalTooltipKey, Group | null>>>({});
  const [hoveredKey, setHoveredKey] = useState<ThronePedestalTooltipKey | null>(null);

  const handleHoverChange = useCallback((key: ThronePedestalTooltipKey | null) => {
    setHoveredKey(key);
  }, []);

  return (
    <>
      <ThronePrepPedestalTooltips
        playerPositionRef={playerPositionRef}
        selectedArchetype={selectedArchetype}
        equippedWeapon={equippedWeapon}
        weaponAspectByWeapon={weaponAspectByWeapon}
        showcaseTick={showcaseTick}
        symbolRefs={symbolRefs}
        hoveredKey={hoveredKey}
      />
      <ThroneWeaponPedestals
        equippedWeapon={equippedWeapon}
        showcaseTick={showcaseTick}
        symbolRefs={symbolRefs}
        onHoverChange={handleHoverChange}
      />
      <ThroneArchetypePedestals
        selectedArchetype={selectedArchetype}
        symbolRefs={symbolRefs}
        onHoverChange={handleHoverChange}
      />
    </>
  );
}

/**
 * Idle weapon replicas with a gentle float — uses the same weapon meshes as gameplay (Runeblade = “Sword”).
 */
function ThroneWeaponPedestals({
  equippedWeapon = WeaponType.NONE,
  showcaseTick,
  symbolRefs,
  onHoverChange,
}: {
  equippedWeapon?: WeaponType;
  showcaseTick: number;
  symbolRefs: React.MutableRefObject<Partial<Record<ThronePedestalTooltipKey, Group | null>>>;
  onHoverChange: (key: ThronePedestalTooltipKey | null) => void;
}) {
  const bowPos = useMemo(() => new Vector3(0, 0, 0), []);
  const bowDir = useMemo(() => new Vector3(0, 0, -1), []);
  const scytheParentRef = useRef<Group>(null);
  const runebladeAnchorRef = useRef<Group>(null);

  const slots = useMemo(
    () => [
      // RUNEBLADE — light purplish-pink orb pillar
      {
        pillar: THRONE_PILLAR_DEFS[1]!.position,
        key: 'runeblade' as const,
        weapon: WeaponType.RUNEBLADE,
        phase: 0.0,
      },
      // SABRES — red
      {
        pillar: THRONE_PILLAR_DEFS[2]!.position,
        key: 'sabres' as const,
        weapon: WeaponType.SABRES,
        phase: 1.1,
      },
      // SCYTHE — light purple
      {
        pillar: THRONE_PILLAR_DEFS[3]!.position,
        key: 'scythe' as const,
        weapon: WeaponType.SCYTHE,
        phase: 2.2,
      },
      // BOW — green
      {
        pillar: THRONE_PILLAR_DEFS[0]!.position,
        key: 'bow' as const,
        weapon: WeaponType.BOW,
        phase: 1.8,
      },
    ],
    [],
  );

  return (
    <group name="throne-weapon-pedestals">
      {slots.map((slot) => {
        const isTaken =
          equippedWeapon !== WeaponType.NONE && equippedWeapon === slot.weapon;
        const slotAspect = getShowcaseWeaponAspect(slot.weapon, showcaseTick);
        return (
        <ThroneFloatingWeapon
          key={slot.key}
          xz={xzTowardRoomCenter(slot.pillar, THRONE_WEAPON_INSET)}
          phase={slot.phase}
          isTaken={isTaken}
          hoverWhenTaken
          symbolRef={(node) => {
            symbolRefs.current[thronePedestalTooltipKey('weapon', slot.weapon)] = node;
          }}
          onHoverChange={(hovered) => {
            onHoverChange(
              hovered ? thronePedestalTooltipKey('weapon', slot.weapon) : null,
            );
          }}
        >
          {slot.key === 'bow' && (
            <group scale={1.05} rotation={[1.28, 4.75, -0.25]} position={[1.25, 2.2, -0.25]}>
              <EtherealBow
                position={bowPos}
                direction={bowDir}
                chargeProgress={0}
                isCharging={false}
                onRelease={() => {}}
                currentSubclass={WeaponSubclass.ELEMENTAL}
                weaponAspect={slotAspect}
              />
            </group>
          )}
          {slot.key === 'scythe' && (
            <group scale={1.12} rotation={[-0.3, 0.55, -0.15]} position={[0.45, 1, -0]}>
              <group ref={scytheParentRef} />
              <Scythe
                parentRef={scytheParentRef}
                currentSubclass={WeaponSubclass.CHAOS}
                isSpinning={false}
                weaponAspect={slotAspect}
              />
            </group>
          )}
          {slot.key === 'sabres' && (
            <group scale={1.05} rotation={[0.5, 0.5, -0.25]} position={[0, 1.35, -0]}>
              <Sabres
                isSwinging={false}
                onSwingComplete={() => {}}
                onLeftSwingStart={() => {}}
                onRightSwingStart={() => {}}
                isCharging={false}
                isStealthing={false}
                isInvisible={false}
                subclass={WeaponSubclass.FROST}
                weaponAspect={slotAspect}
                enemyData={[]}
              />
            </group>
          )}
          {slot.key === 'runeblade' && (
            <group ref={runebladeAnchorRef} scale={1.05} rotation={[0, 0, 5.5]} position={[-0.5, 0.35, 0.75]}>
              <Runeblade
                isSwinging={false}
                isSmiting={false}
                isOathstriking={false}
                isDeathGrasping={false}
                isWraithStriking={false}
                isCharging={false}
                isDeflecting={false}
                isCorruptedAuraActive={false}
                weaponAspect={slotAspect}
                onSwingComplete={() => {}}
                onSmiteComplete={() => {}}
                onDeathGraspComplete={() => {}}
                onWraithStrikeComplete={() => {}}
                onOathstrikeComplete={() => {}}
                onChargeComplete={() => {}}
                onCorruptedAuraToggle={() => {}}
                comboStep={1}
                currentSubclass={WeaponSubclass.ARCANE}
                enemyData={[]}
                dragonGroupRef={runebladeAnchorRef}
              />
            </group>
          )}
        </ThroneFloatingWeapon>
        );
      })}
    </group>
  );
}

function ThroneFloatingWeapon({
  xz,
  phase,
  isTaken,
  children,
  symbolRef,
  onHoverChange,
  /** When true, keep the invisible hover target after the pedestal is taken (weapon aspects). */
  hoverWhenTaken = false,
}: {
  xz: [number, number];
  phase: number;
  isTaken: boolean;
  children: ReactNode;
  symbolRef?: (node: Group | null) => void;
  onHoverChange?: (hovered: boolean) => void;
  hoverWhenTaken?: boolean;
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
    const fadeSpeed =
      target < visibilityRef.current ? THRONE_WEAPON_FADE_OUT_SPEED : THRONE_WEAPON_FADE_IN_SPEED;
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

    const floatAmp = v;
    const t = state.clock.elapsedTime + phase;
    g.position.x = qx + Math.sin(t * 0.55) * 0.035 * floatAmp;
    g.position.y = 0.92 + Math.sin(t * 1.15) * 0.085 * floatAmp;
    g.position.z = qz + Math.cos(t * 0.48) * 0.03 * floatAmp;
    g.rotation.y = Math.sin(t * 0.42) * 0.045 * floatAmp;
  });

  return (
    <group ref={rootRef} position={[qx, 0.92, qz]}>
      <group ref={visualRef}>
        <group ref={symbolRef}>{children}</group>
      </group>
      {onHoverChange && (!isTaken || hoverWhenTaken) ? (
        <mesh
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange(true);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onHoverChange(false);
          }}
        >
          <sphereGeometry args={[0.85, 10, 10]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Per-archetype torus outline (radius, tube) — preserved from procedural symbols. */
const ARCHETYPE_HALO_TORUS: Record<ThroneArchetype, readonly [number, number]> = {
  ROGUE: [0.8, 0.05],
  GLADIATOR: [0.8, 0.05],
  ACOLYTE: [0.8, 0.05],
  ALCHEMIST: [0.8, 0.05],
  SORCERESS: [0.8, 0.05],
};

/** Idle vs selected archetype pedestal glow multipliers (base values already toned down). */
const ARCHETYPE_PEDESTAL_GLOW_IDLE = 0.215;
const ARCHETYPE_PEDESTAL_GLOW_SELECTED = 1;

function ThroneArchetypeSymbol({
  archetype,
  glowIntensity = 1,
}: {
  archetype: ThroneArchetype;
  glowIntensity?: number;
}) {
  const glow = ARCHETYPE_PEDESTAL_GLOW[archetype];
  const modelRef = useRef<Group>(null);
  const [haloRadius, haloTube] = ARCHETYPE_HALO_TORUS[archetype];
  const g = Math.max(0, Math.min(1, glowIntensity));

  const haloMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: glow.halo,
        transparent: true,
        opacity: 0.825 * g,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [glow.halo, g],
  );

  useEffect(() => {
    return () => {
      haloMat.dispose();
    };
  }, [haloMat]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!modelRef.current) return;
    modelRef.current.rotation.y = t * 0.65;
    modelRef.current.rotation.x = Math.sin(t * 0.8) * 0.12;
    modelRef.current.rotation.z = Math.sin(t * 1.2) * 0.08;
  });

  return (
    <group>
      <group ref={modelRef}>
        <ArchetypeTrinketMeshVisual archetype={archetype} />
        <PooledEffectLight
          color={glow.light}
          intensity={1.1 * g}
          distance={2.5}
          decay={2}
        />
      </group>
      <mesh material={haloMat}>
        <torusGeometry args={[haloRadius, haloTube, 8, 24]} />
      </mesh>
    </group>
  );
}

function ThroneArchetypePedestals({
  selectedArchetype = 'NONE',
  symbolRefs,
  onHoverChange,
}: {
  selectedArchetype?: Archetype;
  symbolRefs: React.MutableRefObject<Partial<Record<ThronePedestalTooltipKey, Group | null>>>;
  onHoverChange: (key: ThronePedestalTooltipKey | null) => void;
}) {
  const slots = useMemo(
    () =>
      THRONE_ARCHETYPE_PEDESTAL_POSITIONS.map((pedestal, index) => ({
        ...pedestal,
        phase: index * 1.35,
      })),
    [],
  );

  return (
    <group name="throne-archetype-pedestals">
      {slots.map((slot) => {
        const isTaken = selectedArchetype !== 'NONE' && selectedArchetype === slot.archetype;
        const glowIntensity = isTaken
          ? ARCHETYPE_PEDESTAL_GLOW_SELECTED
          : ARCHETYPE_PEDESTAL_GLOW_IDLE;
        return (
          <group key={`archetype-pedestal-${slot.archetype}`}>
            <ArenaRewardPedestalBase
              position={[slot.x, slot.y, slot.z]}
              glowColor={getArchetypePedestalCapGlow(slot.archetype)}
              glowIntensity={glowIntensity}
              stoneFinish="archetype"
            />
            <ThroneFloatingWeapon
              xz={[slot.x, slot.z]}
              phase={slot.phase}
              isTaken={isTaken}
              symbolRef={(node) => {
                symbolRefs.current[thronePedestalTooltipKey('archetype', slot.archetype)] = node;
              }}
              onHoverChange={(hovered) => {
                onHoverChange(
                  hovered ? thronePedestalTooltipKey('archetype', slot.archetype) : null,
                );
              }}
            >
              <group scale={0.75} position={[0, 1.0, 0]}>
                <ThroneArchetypeSymbol
                  archetype={slot.archetype}
                  glowIntensity={glowIntensity}
                />
              </group>
            </ThroneFloatingWeapon>
          </group>
        );
      })}
    </group>
  );
}

export function ThronePortalRing({
  campType,
  locked = false,
  hoverKey,
  onHoverChange,
}: {
  campType: CoopPortalKind;
  /** When true the portal renders grey and dimmed to signal it is not yet usable. */
  locked?: boolean;
  /** Key passed to onHoverChange for portal choice tooltips. */
  hoverKey?: string;
  onHoverChange?: (key: string | null) => void;
}) {
  const ringRef = useRef<any>(null);
  const innerRef = useRef<any>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.7;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 1.2;
      const m = innerRef.current.material as MeshBasicMaterial;
      m.opacity = locked
        ? 0.15 + Math.sin(t * 2) * 0.05
        : 0.35 + Math.sin(t * 3) * 0.12;
    }
  });

  const portalColor = locked ? '#888888' : THRONE_PORTAL_COLOR_HEX[campType];

  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: portalColor,
        transparent: true,
        opacity: locked ? 0.45 : 0.85,
        depthWrite: false,
      }),
    [portalColor, locked],
  );

  const innerMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: portalColor,
        transparent: true,
        opacity: locked ? 0.15 : 0.4,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending,
      }),
    [portalColor, locked],
  );

  useEffect(() => {
    return () => {
      ringMaterial.dispose();
      innerMaterial.dispose();
    };
  }, [ringMaterial, innerMaterial]);

  const canHover = !locked && !!onHoverChange && hoverKey != null;

  return (
    <group>
      <mesh
        ref={ringRef}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={THRONE_PORTAL_RING_TORUS_GEO}
        material={ringMaterial}
      />
      <mesh ref={innerRef} geometry={THRONE_PORTAL_INNER_SPHERE_GEO} material={innerMaterial} />
      {canHover ? (
        <mesh
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverChange?.(hoverKey!);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHoverChange?.(null);
          }}
        >
          <sphereGeometry args={[2.4, 12, 12]} />
        </mesh>
      ) : null}
      <pointLight
        color={portalColor}
        intensity={locked ? 0.5 : 2.2}
        distance={locked ? 6 : 14}
        position={[0, 0.4, 0]}
      />
      {!locked && <PortalSymbol campType={campType} portalColor={portalColor} />}
      {!locked && (
        <ArcaneRitualCircle
          position={[0, -THRONE_PORTAL_Y + 0.275, 0]}
          baseColor={PORTAL_RITUAL_COLORS[campType].base}
          glowColor={PORTAL_RITUAL_COLORS[campType].glow}
          worldScale={RITUAL_WORLD_SCALE * 1.2}
          persistent
        />
      )}
    </group>
  );
}

interface ThroneRoomProps {
  /** Cooler fill light when the session is snow/blue; grass in this room stays green. */
  isSnowTheme?: boolean;
  /**
   * `prep`: full staging room (pillars, pedestals, weapons, south-rim portals).
   * `bossArena`: same shell only — used for co-op boss fight + post-boss portals (`CoopMainArenaPortals`).
   */
  layout?: 'prep' | 'bossArena';
  /**
   * Two distinct main-room archetypes for the side-by-side portals on the south rim.
   * From server `thronePortalOffer` (initial prep only).
   */
  thronePortalOffer?: readonly string[];
  /** Session camp archetype — drives perimeter border colours (same as main `Environment`). */
  campTypes?: string[];
  /**
   * Wave colour from server intermission (`coopClearedRoomColor`). Used in `bossArena` so borders match
   * prep throne SimpleBorderEffects when `campTypes` is empty after gate transitions.
   */
  coopClearedRoomColor?: string | null;
  /** When true, the south-rim portals render grey — prevents entry before a weapon is chosen. */
  thronePortalsLocked?: boolean;
  /** Local player's equipped weapon — hides that weapon's floating replica on its pedestal. */
  equippedWeapon?: WeaponType;
  /** Local player's selected archetype — hides that archetype symbol on its pedestal. */
  selectedArchetype?: Archetype;
  /** Per-weapon last-chosen aspects — drives unequipped pedestal replica visuals. */
  weaponAspectByWeapon?: WeaponAspectByWeapon;
  /** Shared 10s aspect showcase tick from CoopGameScene (drives pedestal meshes + equip). */
  showcaseTick?: number;
  /** Local player foot position — drives pedestal proximity tooltips. */
  playerPositionRef?: React.MutableRefObject<Vector3>;
  /** Co-op intro: center void portal opens after weapon selection delay. */
  voidPortalOpen?: boolean;
  voidPortalOpenProgress?: number;
  /** Server-authoritative random CustomSky preset index. */
  skyPresetIndex?: number;
  /** Server-authoritative random StylizedGrass preset index (prep only). */
  grassPresetIndex?: number;
  /** When true, strips heavy ambient orbit decor (boss fight LOD). */
  combatActive?: boolean;
}

/**
 * Pre-combat staging space: textured outer floor (`outer.webp`) + center seal;
 * legacy pillar/portal layout (`COOP_THRONE_LAYOUT_RADIUS`).
 */
function ThroneRoom({
  layout = 'prep',
  equippedWeapon = WeaponType.NONE,
  selectedArchetype = 'NONE',
  weaponAspectByWeapon,
  showcaseTick = 0,
  playerPositionRef,
  voidPortalOpen = false,
  voidPortalOpenProgress = 0,
  skyPresetIndex,
  grassPresetIndex,
  combatActive = false,
}: ThroneRoomProps) {
  /** All co-op boss tiers + post-boss intermission share the same purple shell (legacy Boss 2 / Archon look). */
  const usePurpleBossArenaShell = layout === 'bossArena';
  const isPrep = layout === 'prep';
  const prepGrassPalette = resolveGrassPresetByIndex(grassPresetIndex);

  return (
    <group name="throne-room">
      {usePurpleBossArenaShell ? (
        <CustomSky skyPresetIndex={skyPresetIndex} roomTheme="red" animateClouds={false} />
      ) : (
        <CustomSky skyPresetIndex={skyPresetIndex} skyPreset="throneBlue" />
      )}
      {!combatActive && <ThroneSkyRayDecor />}
      <ThroneStatueDecor />
      <ThronePerimeterPylonDecor />

      {/* Celestial cloud sea + floating-island shell — prep only 
      {isPrep && (
        <>
          <CloudSeaOcean animateClouds />
          <ThroneIslandUnderside />
          <ThroneRimMistfall animateClouds />
          <ThroneVoidMotes animateClouds />
        </>
      )}  (bossArena keeps red sky). */}

      <group position={THRONE_GRASS_POSITION}>
        <StylizedGrass
          fieldShape="disc"
          radius={THRONE_GRASS_OUTER_RADIUS}
          excludeInnerRadius={usePurpleBossArenaShell ? 0 : THRONE_CENTER_SEAL_RADIUS}
          count={THRONE_GRASS_COUNT}
          roomTheme={usePurpleBossArenaShell ? undefined : 'green'}
          grassPalette={usePurpleBossArenaShell ? 'purple' : prepGrassPalette}
          bladeHeight={0.42}
          windStrength={combatActive ? 0 : 0.22}
          densityScale={combatActive ? 0.5 : 1}
        />
        <ThroneNatureProps />
        {/* <ThroneTurretProps /> */}
      </group>
      <SanctumIncinerationRuneDisc
        scale={THRONE_RUNE_DISC_SCALE}
        innerSpinScale={THRONE_RUNE_DISC_SPIN_SCALE}
        outerSpinScale={THRONE_RUNE_DISC_SPIN_SCALE}
        position={THRONE_RUNE_DISC_POSITION}
      />
      {isPrep && <ThroneCenterSeal />}


      {isPrep && (
        <>
          {THRONE_PILLAR_DEFS.map((def, i) => {
            const pillarWeapon = THRONE_PILLAR_WEAPONS[i]!;
            return (
              <group key={`throne-pillar-${i}`}>
                <Pillar position={def.position} orbColorHex={def.orbColorHex} />
                <ThronePedestalAura
                  position={def.position}
                  weapon={pillarWeapon}
                  equippedWeapon={equippedWeapon}
                  weaponAspect={resolvePedestalWeaponAspect(
                    pillarWeapon,
                    weaponAspectByWeapon,
                  )}
                />
              </group>
            );
          })}
          {playerPositionRef ? (
            <ThronePrepSelectionPedestals
              playerPositionRef={playerPositionRef}
              equippedWeapon={equippedWeapon}
              selectedArchetype={selectedArchetype}
              weaponAspectByWeapon={weaponAspectByWeapon}
              showcaseTick={showcaseTick}
            />
          ) : null}
          <VoidPortal
            position={[0, 0.005, 0]}
            open={voidPortalOpenProgress}
            visible={voidPortalOpen || voidPortalOpenProgress > 0.01}
            effectHeightOffset={0.3}
          />
          {/* // <ThroneCenterDecor /> */}
        </>
      )}
    </group>
  );
}

export default React.memo(ThroneRoom);
