import React, { useMemo } from 'react';
import type { RoomBorderTheme } from './SimpleBorderEffects';
import CustomSky from './CustomSky';
import PillarCollision from './PillarCollision';
import InstancedForest from './InstancedForest';
import ArenaFallingSnow from './ArenaFallingSnow';
import InstancedMountains from './InstancedMountains';
import InstancedEmbers from './InstancedEmbers';
import InstancedDebris from './InstancedDebris';
import ThroneOuterFloor from './ThroneOuterFloor';
import SanctumIncinerationRuneDisc from './SanctumIncinerationRuneDisc';
import { generateBorderMountains } from '@/utils/MountainGenerator';
import {
  CASTLE_ROOM_HALF_SIZE,
  MAIN_ARENA_FLOOR_RADIUS,
  MAIN_ARENA_HEX_RADIUS,
} from '@/utils/mapConstants';
import { World } from '@/ecs/World';
import { PerspectiveCamera } from '@/utils/three-exports';

const MAIN_ARENA_RUNE_DISC_SCALE =
  MAIN_ARENA_HEX_RADIUS / (CASTLE_ROOM_HALF_SIZE + 0.55);

const SEAL_TEXTURE_BY_THEME: Record<RoomBorderTheme, string> = {
  red: '/center_infernal.png',
  purple: '/center_abyssal.png',
  green: '/center_eldritch.png',
  blue: '/center_tempest.png',
};

const OUTER_TEXTURE_BY_THEME: Record<RoomBorderTheme, string> = {
  purple: '/outer0.png',
  red: '/outer1.png',
  green: '/outer2.png',
  blue: '/outer3.png',
};

interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
  enableGrass?: boolean; // Legacy prop — floor always uses seal stack
  enableForest?: boolean; // Enable instanced forest ring
  world?: World; // Optional world for collision system
  camera?: PerspectiveCamera; // Optional camera for LOD calculations
  enableLargeTree?: boolean; // Enable large tree rendering
  isPVP?: boolean; // Enable PVP-specific pillar positioning
  pvpPillarPositions?: Array<[number, number, number]>; // PVP pillar positions
  campTypes?: string[]; // Assigned archetype per camp ('blue'|'green'|'red'|'purple')
  /** Co-op act terrain, independent from the selected room color. */
  coopTerrainTheme?: RoomBorderTheme;
  /** When set to `delirium_gate`, forces yellow-red grass + warm red sky. */
  coopCurrentRoomKind?: string | null;
  /** When false, sky cloud FBM stops updating (combat LOD). */
  animateClouds?: boolean;
  /** Server-authoritative random CustomSky preset index. */
  skyPresetIndex?: number;
}

/**
 * Environment wrapper component that manages all environmental elements
 * Provides a complete atmospheric backdrop for the game world
 */
const Environment: React.FC<EnvironmentProps> = ({
  level = 1,
  enableMountains = true,
  enablePlanet = true,
  enableSky = true,
  enableGrass = true,
  enableForest = true,
  world,
  camera,
  enableLargeTree = false,
  isPVP = false,
  pvpPillarPositions,
  campTypes = [],
  coopTerrainTheme,
  coopCurrentRoomKind,
  animateClouds = true,
  skyPresetIndex,
}) => {
  // Define pillar positions - use PVP positions if provided, otherwise default triangle
  const pillarPositions: Array<[number, number, number]> = useMemo(() => {
    if (isPVP && pvpPillarPositions) {
      return pvpPillarPositions;
    }
    // Default triangle formation for regular gameplay
    return [

    ];
  }, [isPVP, pvpPillarPositions]);

  /** Server camp archetype — embers and identity; terrain may be overridden by act progression. */
  const roomArchetype: RoomBorderTheme = useMemo(() => {
    const key = campTypes[0]?.toLowerCase();
    if (key === 'blue' || key === 'green' || key === 'red' || key === 'purple') return key;
    return 'red';
  }, [campTypes]);

  const visualRoomTheme: RoomBorderTheme =
    coopCurrentRoomKind === 'delirium_gate'
      ? 'red'
      : (coopTerrainTheme ?? (roomArchetype === 'red' ? 'purple' : roomArchetype));

  const sealTheme: RoomBorderTheme =
    coopCurrentRoomKind === 'delirium_gate' ? 'red' : roomArchetype;

  const centerSealTexture = SEAL_TEXTURE_BY_THEME[sealTheme];
  const outerFloorTexture =
    coopCurrentRoomKind === 'delirium_gate'
      ? '/outer2.png'
      : OUTER_TEXTURE_BY_THEME[sealTheme];

  // Instanced mountain range that surrounds the playable disc (replaces castle
  // walls in the colored combat rooms). Seeded per room so each color gets a
  // stable, slightly different silhouette without re-randomizing on re-render.
  const borderMountains = useMemo(() => {
    const themeSeed: Record<RoomBorderTheme, number> = {
      red: 1301,
      blue: 2027,
      green: 3119,
      purple: 4231,
    };
    return generateBorderMountains({
      arenaRadius: MAIN_ARENA_HEX_RADIUS,
      seed: themeSeed[visualRoomTheme] ?? 1337,
    });
  }, [visualRoomTheme]);

  return (
    <group name="environment">

      {enableSky && (
        <CustomSky
          skyPresetIndex={skyPresetIndex}
          animateClouds={animateClouds}
        />
      )}

      <ThroneOuterFloor
        radius={MAIN_ARENA_FLOOR_RADIUS}
        texturePath={outerFloorTexture}
        position={[0, 0.12, 0]}
        rotateSpeed={roomArchetype === 'green' || 'purple' ? 0.04 : undefined}
      />

      <SanctumIncinerationRuneDisc
        scale={MAIN_ARENA_RUNE_DISC_SCALE}
        innerSpinScale={0.45}
        outerSpinScale={0.45}
        position={[0, -0.0, 0]}
      />

   

      {visualRoomTheme === 'blue' && <ArenaFallingSnow />}



      {/* Collision entities for pillars only (only if world is provided) */}
      {world && (
        <PillarCollision world={world} positions={pillarPositions} />
      )}



      {/* ── Doodads & scene props ──────────────────────────────────────── */}

      {/* Rising fire embers at the centre — colour matches room (campTypes[0]) */}
      <InstancedEmbers campTypes={campTypes} />

      {/* Scattered rubble, rocks and stone chunks across the arena       <InstancedDebris /> */}
      {/* Surrounding mountain range — instanced bases + snow peaks (replaces the
          castle walls in colored combat rooms). Fixed handful of draw calls. */}

      {/* Procedural crack decals on stone paths LOOKS MESSY */}

      {/* Glowing arcane runes on ground near pillars and camp centers */}

    </group>
  );
};

export default React.memo(Environment);
