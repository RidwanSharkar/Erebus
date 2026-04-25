import React, { useMemo } from 'react';
import type { RoomBorderTheme } from './SimpleBorderEffects';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import EnhancedGround from './EnhancedGround';
import PillarCollision from './PillarCollision';
import DetailedTrees, { DetailedTree } from './DetailedTrees';
import TreeCollision from './TreeCollision';
import AtmosphericParticles from './AtmosphericParticles';
import CustomSkeleton from './CustomSkeleton';
import StylizedGrass from './StylizedGrass';
import InstancedForest from './InstancedForest';
import StoneGround from './StoneGround';
import ArenaFallingSnow from './ArenaFallingSnow';
import CastleWalls from './CastleWalls';
import CampThemeLights from './CampThemeLights';
import GroundFogSystem from './GroundFogSystem';
import InstancedEmbers from './InstancedEmbers';
import InstancedDebris from './InstancedDebris';
import InstancedMushrooms from './InstancedMushrooms';
import InstancedBones from './InstancedBones';
import GroundCracks from './GroundCracks';
import InstancedRunes from './InstancedRunes';
import VolumetricMoonRays from './VolumetricMoonRays';

import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';
import { Vector3, Color, PerspectiveCamera } from '@/utils/three-exports';
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
  merchantRotation?: [number, number, number]; // Merchant rotation for interactions
  showMerchant?: boolean; // Whether to render the merchant (for performance optimization)
  campTypes?: string[]; // Assigned archetype per camp ('blue'|'green'|'red'|'purple')
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
  merchantRotation = [0, 0, 0],
  showMerchant = false,
  campTypes = [],
}) => {
  // Generate mountains once and memoize for performance
  const mountains = useMemo(() => generateMountains(), []);

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

  // Define merchant position near the tree
  const merchantPosition: [number, number, number] = useMemo(() => [13.1, 0, 6.6], []);

  /** Server camp archetype for this session — drives grass + perimeter fence colours */
  const roomArchetype: RoomBorderTheme = useMemo(() => {
    const key = campTypes[0]?.toLowerCase();
    if (key === 'blue' || key === 'green' || key === 'red' || key === 'purple') return key;
    return 'red';
  }, [campTypes]);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky roomTheme={roomArchetype} />}

      {/* Instanced grass field — density per room (purple sparse), GPU-animated wind */}
      {enableGrass && (
        <StylizedGrass fieldShape="square" roomTheme={roomArchetype} />
      )}

      {/* Stone road + branch connectors + combat platforms — single draw call */}
      <StoneGround roomTheme={roomArchetype} />

      {roomArchetype === 'blue' && <ArenaFallingSnow />}

      {/* Instanced forest ring — 220 trees, 4 draw calls, GPU wind */}
      {enableForest && <InstancedForest />}

      <Planet />

      {/* Merchant positioned near the tree edge - only render when player is nearby for performance */}
      {showMerchant && <CustomSkeleton position={merchantPosition} rotation={merchantRotation} />}

      {/* Atmospheric particles around central area */}
      <AtmosphericParticles
        position={pedestalPosition}
        count={30}
        radius={8}
        color="#ffffff"
        speed={0.3}
        size={0.02}
      />

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

      {/* Castle walls — perimeter ring (closed square), single draw call */}
      <CastleWalls />

      {/* Coloured theme lights inside each camp based on randomly assigned archetype */}
      {campTypes.length > 0 && <CampThemeLights campTypes={campTypes} />}

      {/* ── Doodads & scene props ──────────────────────────────────────── */}

 

      {/* Rising fire embers at the centre — colour matches room (campTypes[0]) */}
      <InstancedEmbers campTypes={campTypes} />

      {/* Scattered rubble, rocks and stone chunks across the arena */}
      <InstancedDebris />

      {/* Bioluminescent mushrooms near the forest ring */}
      <InstancedMushrooms />

      {/* Aged bones and crude skulls near camp areas */}
      <InstancedBones />

      {/* Procedural crack decals on stone paths */}
      <GroundCracks />


      {/* Glowing arcane runes on ground near pillars and camp centers */}
    

      {/* Volumetric god-ray shafts descending from the blood moon */}
      <VolumetricMoonRays />


    </group>
  );
};

export default Environment;
