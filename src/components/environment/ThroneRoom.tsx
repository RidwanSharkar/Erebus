import React, { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, MeshBasicMaterial, Vector3 } from '@/utils/three-exports';
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

export const COOP_THRONE_ROOM_RADIUS = 16;


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

/** Tile centers for outer cobble ring: half radial slab depth (~1) + gap inside fence. */
const THRONE_PERIMETER_RING_CENTER_R = COOP_THRONE_ROOM_RADIUS - 1.35;

const THRONE_PORTAL_Y = 1.15;
const THRONE_PORTAL_Z = -(COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET);

/** World-space center between the two portal rings (XZ). South rim of prep circle. */
export const THRONE_PORTAL_POSITION = Object.freeze({
  x: 0,
  y: THRONE_PORTAL_Y,
  z: THRONE_PORTAL_Z,
});

/** Half-distance on X between the two throne portal centers (portals sit side by side on the south rim). */
export const THRONE_PORTAL_HALF_SPACING_X = 2.85;

/** Left portal [0] = west (−X), right portal [1] = east (+X). Order matches `thronePortalOffer` indices. */
export const THRONE_PORTAL_POSITIONS: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }> =
  Object.freeze([
    Object.freeze({ x: -THRONE_PORTAL_HALF_SPACING_X, y: THRONE_PORTAL_Y, z: THRONE_PORTAL_Z }),
    Object.freeze({ x: THRONE_PORTAL_HALF_SPACING_X, y: THRONE_PORTAL_Y, z: THRONE_PORTAL_Z }),
  ]);

/** Main co-op combat map: wave-2 choice portals (north-ish; keep in sync with co-op layout). */
export const MAIN_COMBAT_CHOICE_PORTAL_POSITIONS: ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly z: number;
}> = Object.freeze([
  Object.freeze({ x: -14, y: THRONE_PORTAL_Y, z: 7 }),
  Object.freeze({ x: 14, y: THRONE_PORTAL_Y, z: 7 }),
]);

/** Main map: boss-gate ring after wave 2. */
export const MAIN_COMBAT_BOSS_PORTAL_POSITION = Object.freeze({
  x: 0,
  y: THRONE_PORTAL_Y,
  z: 0,
});

export type ThroneMainRoomCamp = 'purple' | 'blue' | 'red' | 'green';

const THRONE_PORTAL_COLOR_HEX: Record<ThroneMainRoomCamp, string> = {
  purple: '#6c3dff',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
};

export function normalizeThroneCamp(s: string | undefined): ThroneMainRoomCamp {
  const k = String(s || '').toLowerCase();
  if (k === 'purple' || k === 'blue' || k === 'red' || k === 'green') return k;
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
  x: COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - 2.75,
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

/** Pillars + ability + talent pedestal hulls for movement / charge collision in the prep room. */
export function getThronePrepPhysicsObstacles(): Array<{ x: number; z: number; radius: number }> {
  return [
    ...getThronePillarPhysicsObstacles(),
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
  ];
}

/** Area scales ~r²; keep blade density similar when expanding grass radius. */
const THRONE_GRASS_COUNT = Math.round(18000 * (COOP_THRONE_ROOM_RADIUS / 10) ** 2);

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

/**
 * Idle weapon replicas with a gentle float — uses the same weapon meshes as gameplay (Runeblade = “Sword”).
 */
function ThroneWeaponPedestals() {
  const bowPos = useMemo(() => new Vector3(0, 0, 0), []);
  const bowDir = useMemo(() => new Vector3(0, 0, -1), []);
  const scytheParentRef = useRef<Group>(null);
  const runebladeAnchorRef = useRef<Group>(null);

  const slots = useMemo(
    () => [
      // SWORD (primary pick / Runeblade) — yellow orb pillar
      { pillar: THRONE_PILLAR_DEFS[1]!.position, key: 'runeblade' as const, phase: 0.0 },
      // SABRES — red
      { pillar: THRONE_PILLAR_DEFS[2]!.position, key: 'sabres' as const, phase: 1.1 },
      // SCYTHE — blue
      { pillar: THRONE_PILLAR_DEFS[3]!.position, key: 'scythe' as const, phase: 2.2 },
      // BOW — green
      { pillar: THRONE_PILLAR_DEFS[0]!.position, key: 'bow' as const, phase: 1.8 },
    ],
    [],
  );

  return (
    <group name="throne-weapon-pedestals">
      {slots.map((slot) => (
        <ThroneFloatingWeapon key={slot.key} xz={xzTowardRoomCenter(slot.pillar, THRONE_WEAPON_INSET)} phase={slot.phase}>
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
      ))}
    </group>
  );
}

function ThroneFloatingWeapon({
  xz,
  phase,
  children,
}: {
  xz: [number, number];
  phase: number;
  children: ReactNode;
}) {
  const rootRef = useRef<Group>(null);
  const [qx, qz] = xz;

  useFrame((state) => {
    const g = rootRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime + phase;
    g.position.x = qx + Math.sin(t * 0.55) * 0.035;
    g.position.y = 0.92 + Math.sin(t * 1.15) * 0.085;
    g.position.z = qz + Math.cos(t * 0.48) * 0.03;
    g.rotation.y = Math.sin(t * 0.42) * 0.045;
  });

  return (
    <group ref={rootRef} position={[qx, 0.92, qz]}>
      {children}
    </group>
  );
}

export function ThronePortalRing({ campType }: { campType: ThroneMainRoomCamp }) {
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
      m.opacity = 0.35 + Math.sin(t * 3) * 0.12;
    }
  });

  const portalColor = THRONE_PORTAL_COLOR_HEX[campType];

  return (
    <group>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.12, 10, 48]} />
        <meshBasicMaterial color={portalColor} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[1.35, 24, 24]} />
        <meshBasicMaterial
          color={portalColor}
          transparent
          opacity={0.4}
          depthWrite={false}
          side={BackSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <pointLight color={portalColor} intensity={2.2} distance={14} position={[0, 0.4, 0]} />
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
}

/**
 * Pre-combat staging space: same grass + stone language as the main map, smaller radius.
 */
export default function ThroneRoom({
  isSnowTheme,
  layout = 'prep',
  thronePortalOffer,
  campTypes = [],
  coopClearedRoomColor = null,
}: ThroneRoomProps) {
  const keyColor = isSnowTheme ? new Color('#9fc2f0') : new Color('#4a2d6e');
  const isPrep = layout === 'prep';

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeThroneCamp(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeThroneCamp(o[1]) : 'red';

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

  return (
    <group name="throne-room">
      <CustomSky skyPreset="throneBlue" />
      <PerimeterCloudSystem radius={COOP_THRONE_ROOM_RADIUS} />
      <ambientLight intensity={0.14} />
      <hemisphereLight color={keyColor} groundColor="#1a1020" intensity={0.35} />
      <directionalLight
        position={[8, 16, 6]}
        intensity={0.42}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={44}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <StylizedGrass
        radius={COOP_THRONE_ROOM_RADIUS}
        count={THRONE_GRASS_COUNT}
        bladeHeight={0.42}
        windStrength={0.2}
        isSnowTheme={false}
      />
      <StoneGround
        variant="throne"
        roomTheme={borderTheme}
        thronePerimeterRingRadius={THRONE_PERIMETER_RING_CENTER_R}
      />
      <SimpleBorderEffects
        radius={COOP_THRONE_ROOM_RADIUS}
        count={30}
        enableParticles
        particleCount={60}
        borderTheme={simpleBorderColorTheme}
      />
      {isPrep && (
        <>
          {THRONE_PILLAR_DEFS.map((def, i) => (
            <Pillar key={`throne-pillar-${i}`} position={def.position} orbColorHex={def.orbColorHex} />
          ))}
          <Pillar
            position={[THRONE_ABILITY_PEDESTAL_POSITION.x, THRONE_ABILITY_PEDESTAL_POSITION.y, THRONE_ABILITY_PEDESTAL_POSITION.z]}
            showOrb={false}
          />
          <Pillar
            position={[THRONE_TALENT_PEDESTAL_POSITION.x, THRONE_TALENT_PEDESTAL_POSITION.y, THRONE_TALENT_PEDESTAL_POSITION.z]}
            showOrb={false}
          />
          <ThroneWeaponPedestals />
          <group>
            {THRONE_PORTAL_POSITIONS.map((pos, i) => (
              <group key={`throne-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
                <ThronePortalRing campType={i === 0 ? leftCamp : rightCamp} />
              </group>
            ))}
          </group>
        </>
      )}
    </group>
  );
}
