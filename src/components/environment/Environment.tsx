import React, { useMemo } from 'react';
import type { RoomBorderTheme } from './SimpleBorderEffects';
import CustomSky from './CustomSky';
import Planet from './Planet';
import Pillar from './Pillar';
import PillarCollision from './PillarCollision';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';
import InstancedForest from './InstancedForest';
import StoneGround from './StoneGround';
import ArenaFallingSnow from './ArenaFallingSnow';
import InstancedMountains from './InstancedMountains';
import InstancedEmbers from './InstancedEmbers';
import InstancedDebris from './InstancedDebris';
import InstancedMushrooms from './InstancedMushrooms';
import GroundCracks from './GroundCracks';
import VolumetricMoonRays from './VolumetricMoonRays';
import { generateBorderMountains } from '@/utils/MountainGenerator';
import { MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';

import { World } from '@/ecs/World';
import { PerspectiveCamera } from '@/utils/three-exports';
interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
  enableGrass?: boolean; // Enable stylized instanced grass
  enableForest?: boolean; // Enable instanced forest ring
  world?: World; // Optional world for collision system
  camera?: PerspectiveCamera; // Optional camera for LOD calculations
  enableLargeTree?: boolean; // Enable large tree rendering
  isPVP?: boolean; // Enable PVP-specific pillar positioning
  pvpPillarPositions?: Array<[number, number, number]>; // PVP pillar positions
  campTypes?: string[]; // Assigned archetype per camp ('blue'|'green'|'red'|'purple')
  /** Co-op act terrain, independent from the selected room color. */
  coopTerrainTheme?: RoomBorderTheme;
  /** Co-op: destroyed mushroom instance indices (hide instanced meshes). */
  mushroomHiddenIndices?: ReadonlySet<number>;
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
  mushroomHiddenIndices,
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

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  /** Server camp archetype — embers and identity; terrain may be overridden by act progression. */
  const roomArchetype: RoomBorderTheme = useMemo(() => {
    const key = campTypes[0]?.toLowerCase();
    if (key === 'blue' || key === 'green' || key === 'red' || key === 'purple') return key;
    return 'red';
  }, [campTypes]);

  const visualRoomTheme: RoomBorderTheme =
    coopTerrainTheme ?? (roomArchetype === 'red' ? 'purple' : roomArchetype);

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
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky roomTheme={visualRoomTheme} />}

      {/* Instanced grass field — density per room (purple sparse), GPU-animated wind */}
      {enableGrass && (
        <StylizedGrass fieldShape="disc" radius={35} roomTheme={visualRoomTheme} />
      )}

      {/* Stone road + branch connectors + combat platforms — single draw call */}
      <StoneGround roomTheme={visualRoomTheme} />

      {visualRoomTheme === 'blue' && <ArenaFallingSnow />}

      {/* Instanced forest ring — 220 trees, 4 draw calls, GPU wind */}
      {enableForest && <InstancedForest />}

      <Planet />

      {/* Three pillars in triangle formation */}
      {pillarPositions.map((pillarPos, index) => (
        <group key={`pillar-group-${index}`}>
          <Pillar position={pillarPos} />
          {/* Particles around each pillar */}
        </group>
      ))}

      {/* Collision entities for pillars only (only if world is provided) */}
      {world && (
        <PillarCollision world={world} positions={pillarPositions} />
      )}

      {/* Surrounding mountain range — instanced bases + snow peaks (replaces the
          castle walls in colored combat rooms). Fixed handful of draw calls. */}
      <InstancedMountains mountains={borderMountains} />

      {/* ── Doodads & scene props ──────────────────────────────────────── */}

      {/* Rising fire embers at the centre — colour matches room (campTypes[0]) */}
      <InstancedEmbers campTypes={campTypes} />

      {/* Scattered rubble, rocks and stone chunks across the arena */}
      <InstancedDebris />

      {/* Bioluminescent mushrooms near the forest ring */}
      <InstancedMushrooms hiddenIndices={mushroomHiddenIndices} />

      {/* Procedural crack decals on stone paths LOOKS MESSY */}
 

      {/* Glowing arcane runes on ground near pillars and camp centers */}
    
      {/* Volumetric god-ray shafts descending from the blood moon */}
      <VolumetricMoonRays />



    </group>
  );
};

export default Environment;
