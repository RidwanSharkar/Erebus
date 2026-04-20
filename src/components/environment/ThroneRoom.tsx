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

export const COOP_THRONE_ROOM_RADIUS = 15;

/** Cylinder radius for movement / charge (aligned with `PillarCollision` ~0.7). */
export const THRONE_PILLAR_HULL_RADIUS = 0.72;

export type ThronePillarDef = {
  position: [number, number, number];
  orbColorHex: string;
};

/** Five pillars in a ring — orb colours: green, yellow, red, blue, silver. */
export const THRONE_PILLAR_DEFS: ThronePillarDef[] = [
  { position: [5.2, 0, 0], orbColorHex: '#22c55e' },
  { position: [1.61, 0, 4.95], orbColorHex: '#eab308' },
  { position: [-4.21, 0, 3.06], orbColorHex: '#ef4444' },
  { position: [-4.21, 0, -3.06], orbColorHex: '#3b82f6' },
  { position: [1.61, 0, -4.95], orbColorHex: '#d1d5db' },
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

/** World-space center of the portal ring (XZ). South rim of prep circle. Y is visual anchor only. */
export const THRONE_PORTAL_POSITION = Object.freeze({
  x: 0,
  y: 1.15,
  z: -(COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET),
});

/** Stable server + client id for the co-op throne training dummy. */
export const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

/**
 * North of center (portal is on the south rim). Z is pulled inward from the far rim
 * so melee and projectiles reliably register from the throne spawn ring.
 * Keep in sync with backend/gameRoom.js `THRONE_TRAINING_DUMMY_Z`.
 */
export const THRONE_TRAINING_DUMMY_SPAWN_Z = 7;

/** World-space foot position (XZ). */
export const THRONE_TRAINING_DUMMY_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: THRONE_TRAINING_DUMMY_SPAWN_Z,
});

/** Faces toward the portal (-Z). */
export const THRONE_TRAINING_DUMMY_ROTATION = Math.PI;

/** Distance from pillar base toward room center — weapon sits in front of the pillar (toward center). */
export const THRONE_WEAPON_INSET = 1.38;

/** Proximity radius (XZ) for “press X to equip” at each floating weapon replica. */
export const THRONE_WEAPON_INTERACT_RADIUS = 2.35;

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
            <group scale={1.05} rotation={[0.08, 0, -0.06]}>
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
            <group scale={1.12} rotation={[0.1, 0.35, -0.05]}>
              <group ref={scytheParentRef} />
              <Scythe
                parentRef={scytheParentRef}
                currentSubclass={WeaponSubclass.CHAOS}
                isSpinning={false}
              />
            </group>
          )}
          {slot.key === 'sabres' && (
            <group scale={1.05} rotation={[0.06, -0.2, 0.04]}>
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
            <group scale={1.08} rotation={[0.05, 0.25, -0.03]}>
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
            <group ref={runebladeAnchorRef} scale={1.05} rotation={[0.07, 0.15, -0.05]}>
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

function ThronePortal() {
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

  const portalColor = '#6c3dff';

  return (
    <group position={[THRONE_PORTAL_POSITION.x, THRONE_PORTAL_POSITION.y, THRONE_PORTAL_POSITION.z]}>
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
}

/**
 * Pre-combat staging space: same grass + stone language as the main map, smaller radius.
 */
export default function ThroneRoom({ isSnowTheme }: ThroneRoomProps) {
  const keyColor = isSnowTheme ? new Color('#9fc2f0') : new Color('#4a2d6e');

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
      <ThroneWeaponPedestals />
      <ThronePortal />
    </group>
  );
}
