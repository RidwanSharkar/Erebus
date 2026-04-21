import React, { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, MeshBasicMaterial, Vector3 } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import StylizedGrass from './StylizedGrass';
import StoneGround from './StoneGround';
import Pillar from './Pillar';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import EtherealBow from '@/components/weapons/EtherBow';
import Scythe from '@/components/weapons/Scythe';
import Sabres from '@/components/weapons/Sabres';
import Runeblade from '@/components/weapons/Runeblade';
import SpearComponent from '@/components/weapons/Spear';

export const COOP_THRONE_ROOM_RADIUS = 16;


/** XZ radius for movement physics, sword charge, and ECS `PillarCollision` cylinders on these pillars. */
export const THRONE_PILLAR_HULL_RADIUS = 0.55;

export type ThronePillarDef = {
  position: [number, number, number];
  orbColorHex: string;
};

/** Five pillars in a ring — orb colours: green, yellow, red, blue, silver. */
export const THRONE_PILLAR_DEFS: ThronePillarDef[] = [
  { position: [-6.0, 0, 1], orbColorHex: '#22c55e' },
  { position: [-3.25, 0, -1.5], orbColorHex: '#eab308' },
  { position: [0, 0, -3], orbColorHex: '#ef4444' },
  { position: [3.25, 0, -1.5], orbColorHex: '#3b82f6' },
  { position: [6.0, 0, 1], orbColorHex: '#d1d5db' },
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

export type ThroneMainRoomCamp = 'purple' | 'blue' | 'red' | 'green';

const THRONE_PORTAL_COLOR_HEX: Record<ThroneMainRoomCamp, string> = {
  purple: '#6c3dff',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
};

function normalizeThroneCamp(s: string | undefined): ThroneMainRoomCamp {
  const k = String(s || '').toLowerCase();
  if (k === 'purple' || k === 'blue' || k === 'red' || k === 'green') return k;
  return 'purple';
}

/** Stable server + client id for the co-op throne training dummy. */
export const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

/**
 * North of center (portal is on the south rim). Slightly inside the north rim
 * (`COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET`) so it stays on playable grass.
 * Keep in sync with backend/gameRoom.js `THRONE_TRAINING_DUMMY_Z`.
 */
export const THRONE_TRAINING_DUMMY_SPAWN_Z = COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - 1;

/** World-space foot position (XZ). */
export const THRONE_TRAINING_DUMMY_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: THRONE_TRAINING_DUMMY_SPAWN_Z,
});

/** Faces toward the portal (-Z). */
export const THRONE_TRAINING_DUMMY_ROTATION = Math.PI;

/** Distance from pillar base toward room center — weapon sits in front of the pillar (toward center). */
export const THRONE_WEAPON_INSET = -0.25;

/** Proximity radius (XZ) for “press X to equip” at each floating weapon replica. */
export const THRONE_WEAPON_INTERACT_RADIUS = 2.35;

/** East rim — plain stone pillar for ability loadout (press X). XZ foot position. */
export const THRONE_ABILITY_PEDESTAL_POSITION = Object.freeze({
  x: COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - 0.65,
  y: 0,
  z: 0,
});

export const THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS = THRONE_WEAPON_INTERACT_RADIUS;

/** East rim — beside ability pillar; talent loadout (press X). Same X, offset Z. */
export const THRONE_TALENT_PEDESTAL_POSITION = Object.freeze({
  x: THRONE_ABILITY_PEDESTAL_POSITION.x,
  y: 0,
  z: THRONE_ABILITY_PEDESTAL_POSITION.z + 2.85,
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
 * Order: runeblade, sabres, scythe, spear, bow — pillar indices [1,2,3,4,0].
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
    mk(THRONE_PILLAR_DEFS[4]!.position, WeaponType.SPEAR),
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
      // SPEAR — silver
      { pillar: THRONE_PILLAR_DEFS[4]!.position, key: 'spear' as const, phase: 0.7 },
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
            <group scale={1.05} rotation={[1.08, 4.5, -0.2]} position={[1.25, 2, -1.20]}>
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
            <group scale={1.12} rotation={[-0.3, 0.55, -0.05]} position={[0, 1.65, 0.25]}>
              <group ref={scytheParentRef} />
              <Scythe
                parentRef={scytheParentRef}
                currentSubclass={WeaponSubclass.CHAOS}
                isSpinning={false}
              />
            </group>
          )}
          {slot.key === 'sabres' && (
            <group scale={1.05} rotation={[0.06, -0, 0.04]} position={[0, 1.5, 0.5]}>
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
          {slot.key === 'spear' && (
            <group scale={1.08} rotation={[4.875, 0.25, 0.25]} position={[0.5, 1.75, 0.75]}>
              <SpearComponent
                isSwinging={false}
                isWhirlwinding={false}
                currentSubclass={WeaponSubclass.STORM}
                isThrowSpearCharging={false}
                throwSpearChargeProgress={0}
                isThrowSpearReleasing={false}
                isSpearThrown={false}
                isWhirlwindCharging={false}
                whirlwindChargeProgress={0}
              />
            </group>
          )}
          {slot.key === 'runeblade' && (
            <group ref={runebladeAnchorRef} scale={1.05} rotation={[1, 11.5, 1.25]} position={[0.75, 1.45, 1.75]}>
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
                onDeflectComplete={() => {}}
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

function ThronePortalRing({ campType }: { campType: ThroneMainRoomCamp }) {
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
  /** Match main arena grass when camp archetype is blue (snow). */
  isSnowTheme?: boolean;
  /**
   * Two distinct main-room archetypes for the side-by-side portals (west = index 0, east = index 1).
   * From server `thronePortalOffer`; defaults used only for visuals if omitted or short.
   */
  thronePortalOffer?: readonly string[];
}

/**
 * Pre-combat staging space: same grass + stone language as the main map, smaller radius.
 */
export default function ThroneRoom({ isSnowTheme, thronePortalOffer }: ThroneRoomProps) {
  const keyColor = isSnowTheme ? new Color('#9fc2f0') : new Color('#4a2d6e');

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeThroneCamp(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeThroneCamp(o[1]) : 'red';

  return (
    <group name="throne-room">
      <CustomSky />
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
        isSnowTheme={isSnowTheme}
      />
      <StoneGround variant="throne" />
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
    </group>
  );
}
