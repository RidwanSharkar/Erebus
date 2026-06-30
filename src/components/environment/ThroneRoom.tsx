import React, { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, MathUtils, MeshBasicMaterial, Vector3 } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import type { RoomBorderTheme, SimpleBorderColorTheme } from './SimpleBorderEffects';
import SimpleBorderEffects from './SimpleBorderEffects';
import PerimeterCloudSystem from './PerimeterCloudSystem';
import StylizedGrass from './StylizedGrass';
import StoneGround from './StoneGround';
import Pillar from './Pillar';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import EtherealBow from '@/components/weapons/EtherBow';
import Scythe from '@/components/weapons/Scythe';
import Sabres from '@/components/weapons/Sabres';
import Runeblade from '@/components/weapons/Runeblade';
import PortalSymbol from './PortalSymbols';
import ArcaneRitualCircle from './ArcaneRitualCircle';
import { RITUAL_WORLD_SCALE } from './ritualCircleGeometries';
import { ThroneCircularCastleWalls } from './CastleWalls';

/** Original throne staging layout (portals, pedestals, inner pavers); unchanged when expanding grass. */
export const COOP_THRONE_LAYOUT_RADIUS = 16;

/** Grass, VFX, physics clamp, outer perimeter — 2× the legacy 16m playable disk. */
export const COOP_THRONE_ROOM_RADIUS = 24;


/** XZ radius for movement physics, sword charge, and ECS `PillarCollision` cylinders on these pillars. */
export const THRONE_PILLAR_HULL_RADIUS = 0.55;

export type ThronePillarDef = {
  position: [number, number, number];
  orbColorHex: string;
};

/** Four pillars in a ring — orb colours: green, yellow, red, blue. */
export const THRONE_PILLAR_DEFS: ThronePillarDef[] = [
  { position: [-5.5, 0, 1], orbColorHex: '#22c55e' }, // BOW
  { position: [5.5, 0, 1], orbColorHex: '#eab308' }, // SWORD
  { position: [-3.25, 0, -2], orbColorHex: '#ef4444' }, // SABRES
  { position: [3.25, 0, -2], orbColorHex: '#3b82f6' }, // SCYTHE
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

/**
 * Small extra inset so hostile knight feet stay on playable grass inside the castle wall ring.
 * Keep in sync with `backend/gameRoom.js` throne knight spawn helpers.
 */
export const THRONE_HOSTILE_KNIGHT_FOOT_MARGIN = 0.3;

/** Max simultaneous timed hostile knights in co-op prep; must match `THRONE_KNIGHT_MAX_LIVE` in `backend/gameRoom.js`. */
export const THRONE_HOSTILE_KNIGHT_MAX_LIVE = 3;

/** XZ radial distance from room center for timed hostile knight spawns along the throne perimeter. */
export const THRONE_HOSTILE_KNIGHT_PERIMETER_RADIUS =
  COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - THRONE_HOSTILE_KNIGHT_FOOT_MARGIN;

/** Gap from grass rim to tangential paver tile centers (matches `StoneGround` throne ring). */
export const THRONE_PERIMETER_RING_INSET = 1.35;

/** Inner ring: legacy rim near portals; outer ring: expanded grass edge. */
export const THRONE_PERIMETER_RING_RADII: readonly number[] = [
  COOP_THRONE_LAYOUT_RADIUS - THRONE_PERIMETER_RING_INSET,
  COOP_THRONE_ROOM_RADIUS - THRONE_PERIMETER_RING_INSET,
];

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
export const MAIN_COMBAT_PEDESTAL_POSITION = Object.freeze({ x: 0, y: 0, z: 13 });

/** XZ interaction radius for the combat arena pedestal. */
export const MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS = 3.0;

/** Half-distance on X between the two main-arena choice portals flanking the combat pedestal. */
export const MAIN_COMBAT_PORTAL_HALF_SPACING_X = THRONE_PORTAL_HALF_SPACING_X;

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
  boss: '#6c3dff',
};

const PORTAL_RITUAL_COLORS: Record<CoopPortalKind, { base: string; glow: string }> = {
  purple: { base: '#4c1d95', glow: '#c4b5fd' },
  blue: { base: '#1e3a8a', glow: '#93c5fd' },
  red: { base: '#991b1b', glow: '#fca5a5' },
  green: { base: '#166534', glow: '#86efac' },
  stat: { base: '#c2410c', glow: '#fdba74' },
  trial: { base: '#a16207', glow: '#fde047' },
  merchant: { base: '#be185d', glow: '#f9a8d4' },
  boss: { base: '#4c1d95', glow: '#c4b5fd' },
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

/** Must match `gameRoom.js` throne training dummy id. */
export const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

export type ThroneTrainingDummyVisual = 'knight';

/**
 * North rim, centered on X (mirrors portal pair on south rim). Keep in sync with `backend/gameRoom.js` `THRONE_TRAINING_DUMMY_*`.
 */
export const THRONE_TRAINING_DUMMY_SPAWN_Z = 10.75;

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

/** West rim X (opposite east ability/talent pedestals), just inside grass border — matches south-rim inset. */
export const THRONE_DEV_BOSS_EDGE_X = -(COOP_THRONE_LAYOUT_RADIUS - THRONE_RIM_INSET);

/**
 * Development-only: three boss shortcut portals on the west rim, spaced on Z (`dev_boss` / `dev_boss2` / `dev_boss3` in `enter-combat-arena`).
 */
export const THRONE_DEV_BOSS_PORTAL_POSITION = Object.freeze({
  x: THRONE_DEV_BOSS_EDGE_X,
  y: THRONE_PORTAL_Y,
  z: -THRONE_PORTAL_HALF_SPACING_X,
});

export const THRONE_DEV_BOSS2_PORTAL_POSITION = Object.freeze({
  x: THRONE_DEV_BOSS_EDGE_X,
  y: THRONE_PORTAL_Y,
  z: 0,
});

export const THRONE_DEV_BOSS3_PORTAL_POSITION = Object.freeze({
  x: THRONE_DEV_BOSS_EDGE_X,
  y: THRONE_PORTAL_Y,
  z: THRONE_PORTAL_HALF_SPACING_X,
});

export const THRONE_DEV_BOSS_PORTAL_INTERACT_RADIUS = 1.25;

/** Local dev / non-production builds — ability/talent pedestals and dev boss portals. */
export const COOP_DEV_LOCALHOST_FEATURES = process.env.NODE_ENV !== 'production';

/** Pillars + ability + talent pedestal hulls for movement / charge collision in the prep room. */
export function getThronePrepPhysicsObstacles(): Array<{ x: number; z: number; radius: number }> {
  const obstacles = [...getThronePillarPhysicsObstacles()];
  if (COOP_DEV_LOCALHOST_FEATURES) {
    obstacles.push(
      {
        x: THRONE_ABILITY_PEDESTAL_POSITION.x,
        z: THRONE_ABILITY_PEDESTAL_POSITION.z,
        radius: THRONE_PILLAR_HULL_RADIUS,
      },
      {
        x: THRONE_TALENT_PEDESTAL_POSITION.x,
        z: THRONE_TALENT_PEDESTAL_POSITION.z,
        radius: THRONE_PILLAR_HULL_RADIUS,
      },
    );
  }
  return obstacles;
}

/** Area scales ~r²; keep blade density similar when expanding grass radius. */
const THRONE_GRASS_COUNT = Math.round(18000 * (COOP_THRONE_ROOM_RADIUS / 10) ** 2);
/** Match main-map purple sparsity vs green (`StylizedGrass` THEME_COUNTS). */
const THRONE_PURPLE_GRASS_COUNT = Math.round(THRONE_GRASS_COUNT * (16000 / 80000));

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

/**
 * Idle weapon replicas with a gentle float — uses the same weapon meshes as gameplay (Runeblade = “Sword”).
 */
function ThroneWeaponPedestals({ equippedWeapon = WeaponType.NONE }: { equippedWeapon?: WeaponType }) {
  const bowPos = useMemo(() => new Vector3(0, 0, 0), []);
  const bowDir = useMemo(() => new Vector3(0, 0, -1), []);
  const scytheParentRef = useRef<Group>(null);
  const runebladeAnchorRef = useRef<Group>(null);

  const slots = useMemo(
    () => [
      // SWORD (primary pick / Runeblade) — yellow orb pillar
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
      // SCYTHE — blue
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
        return (
        <ThroneFloatingWeapon
          key={slot.key}
          xz={xzTowardRoomCenter(slot.pillar, THRONE_WEAPON_INSET)}
          phase={slot.phase}
          isTaken={isTaken}
        >
          {slot.key === 'bow' && (
            <group scale={1.05} rotation={[1.28, 4.75, -0.25]} position={[0.75, 2.2, -1.0]}>
              <EtherealBow
                position={bowPos}
                direction={bowDir}
                chargeProgress={0}
                isCharging={false}
                onRelease={() => {}}
                currentSubclass={WeaponSubclass.ELEMENTAL}
              />
            </group>
          )}
          {slot.key === 'scythe' && (
            <group scale={1.12} rotation={[-0.3, 0.55, -0.05]} position={[-0, 1, -0]}>
              <group ref={scytheParentRef} />
              <Scythe
                parentRef={scytheParentRef}
                currentSubclass={WeaponSubclass.CHAOS}
                isSpinning={false}
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
      <group ref={visualRef}>{children}</group>
    </group>
  );
}

export function ThronePortalRing({
  campType,
  locked = false,
}: {
  campType: CoopPortalKind;
  /** When true the portal renders grey and dimmed to signal it is not yet usable. */
  locked?: boolean;
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

  return (
    <group>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.12, 10, 48]} />
        <meshBasicMaterial
          color={portalColor}
          transparent
          opacity={locked ? 0.45 : 0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[1.35, 24, 24]} />
        <meshBasicMaterial
          color={portalColor}
          transparent
          opacity={locked ? 0.15 : 0.4}
          depthWrite={false}
          side={BackSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <pointLight
        color={portalColor}
        intensity={locked ? 0.5 : 2.2}
        distance={locked ? 6 : 14}
        position={[0, 0.4, 0]}
      />
      {!locked && <PortalSymbol campType={campType} portalColor={portalColor} />}
      {!locked && (
        <ArcaneRitualCircle
          position={[0, -THRONE_PORTAL_Y + 0.25, 0]}
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
}

/**
 * Pre-combat staging space: same grass + stone language as the main map; expanded grass disc (`COOP_THRONE_ROOM_RADIUS`)
 * with legacy pillar/portal layout (`COOP_THRONE_LAYOUT_RADIUS`).
 */
export default function ThroneRoom({
  isSnowTheme,
  layout = 'prep',
  thronePortalOffer,
  campTypes = [],
  coopClearedRoomColor = null,
  thronePortalsLocked = false,
  equippedWeapon = WeaponType.NONE,
}: ThroneRoomProps) {
  /** All co-op boss tiers + post-boss intermission share the same purple shell (legacy Boss 2 / Archon look). */
  const usePurpleBossArenaShell = layout === 'bossArena';
  const keyColor = usePurpleBossArenaShell
    ? new Color('#c4a8e8')
    : isSnowTheme
      ? new Color('#9fc2f0')
      : new Color('#4a2d6e');
  const isPrep = layout === 'prep';

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeCoopPortalKind(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeCoopPortalKind(o[1]) : 'red';

  const borderTheme: RoomBorderTheme = useMemo(() => {
    const candidates =
      layout === 'bossArena' ? [coopClearedRoomColor, campTypes[0]] : [campTypes[0]];
    for (const raw of candidates) {
      if (raw == null || raw === '') continue;
      const key = String(raw).toLowerCase();
      if (key === 'blue' || key === 'green' || key === 'red' || key === 'purple') return key;
    }
    return 'red';
  }, [layout, coopClearedRoomColor, campTypes]);

  const simpleBorderColorTheme: SimpleBorderColorTheme =
    borderTheme === 'red' ? 'gold' : borderTheme;

  const groundRoomTheme: RoomBorderTheme = usePurpleBossArenaShell ? 'purple' : borderTheme;
  const borderEffectsTheme: SimpleBorderColorTheme = usePurpleBossArenaShell ? 'red' : simpleBorderColorTheme;

  return (
    <group name="throne-room">
      {usePurpleBossArenaShell ? <CustomSky roomTheme="purple" /> : <CustomSky skyPreset="throneBlue" />}
      <PerimeterCloudSystem
        radius={COOP_THRONE_ROOM_RADIUS}
        cloudTheme={usePurpleBossArenaShell ? 'red' : 'gold'}
      />
      <ambientLight intensity={usePurpleBossArenaShell ? 0.1 : 0.14} />
      <hemisphereLight
        color={keyColor}
        groundColor={usePurpleBossArenaShell ? '#0a0612' : '#1a1020'}
        intensity={usePurpleBossArenaShell ? 0.32 : 0.35}
      />
      <directionalLight
        position={[8, 16, 6]}
        intensity={usePurpleBossArenaShell ? 0.38 : 0.42}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={88}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <StylizedGrass
        radius={COOP_THRONE_ROOM_RADIUS}
        count={usePurpleBossArenaShell ? THRONE_PURPLE_GRASS_COUNT : THRONE_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={0.2}
        isSnowTheme={false}
        roomTheme={usePurpleBossArenaShell ? 'purple' : undefined}
      />
      <StoneGround
        variant="throne"
        roomTheme={groundRoomTheme}
        thronePerimeterRingRadius={THRONE_PERIMETER_RING_RADII}
      />
    
      <ThroneCircularCastleWalls innerRadius={COOP_THRONE_ROOM_RADIUS} />
      <SimpleBorderEffects
        radius={COOP_THRONE_ROOM_RADIUS}
        count={30}
        enableParticles
        particleCount={60}
        borderTheme={borderEffectsTheme}
      />
      {isPrep && (
        <>
          {THRONE_PILLAR_DEFS.map((def, i) => (
            <Pillar key={`throne-pillar-${i}`} position={def.position} orbColorHex={def.orbColorHex} />
          ))}
          {COOP_DEV_LOCALHOST_FEATURES && (
            <>
              <Pillar
                position={[THRONE_ABILITY_PEDESTAL_POSITION.x, THRONE_ABILITY_PEDESTAL_POSITION.y, THRONE_ABILITY_PEDESTAL_POSITION.z]}
                showOrb={false}
              />
              <Pillar
                position={[THRONE_TALENT_PEDESTAL_POSITION.x, THRONE_TALENT_PEDESTAL_POSITION.y, THRONE_TALENT_PEDESTAL_POSITION.z]}
                showOrb={false}
              />
            </>
          )}
          <ThroneWeaponPedestals equippedWeapon={equippedWeapon} />
          <group>
            {THRONE_PORTAL_POSITIONS.map((pos, i) => (
              <group key={`throne-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
                <ThronePortalRing campType={i === 0 ? leftCamp : rightCamp} locked={thronePortalsLocked} />
              </group>
            ))}
          </group>
          {COOP_DEV_LOCALHOST_FEATURES && (
            <>
              <group
                position={[
                  THRONE_DEV_BOSS_PORTAL_POSITION.x,
                  THRONE_DEV_BOSS_PORTAL_POSITION.y,
                  THRONE_DEV_BOSS_PORTAL_POSITION.z,
                ]}
                scale={0.34}
              >
                <ThronePortalRing campType="boss" locked />
              </group>
              <group
                position={[
                  THRONE_DEV_BOSS2_PORTAL_POSITION.x,
                  THRONE_DEV_BOSS2_PORTAL_POSITION.y,
                  THRONE_DEV_BOSS2_PORTAL_POSITION.z,
                ]}
                scale={0.34}
              >
                <ThronePortalRing campType="red" locked />
              </group>
              <group
                position={[
                  THRONE_DEV_BOSS3_PORTAL_POSITION.x,
                  THRONE_DEV_BOSS3_PORTAL_POSITION.y,
                  THRONE_DEV_BOSS3_PORTAL_POSITION.z,
                ]}
                scale={0.34}
              >
                <ThronePortalRing campType="green" locked />
              </group>
            </>
          )}
        </>
      )}
    </group>
  );
}
