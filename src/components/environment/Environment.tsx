import React, { useMemo } from 'react';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import EnhancedGround from './EnhancedGround';
import PillarCollision from './PillarCollision';
import DetailedTrees, { DetailedTree } from './DetailedTrees';
import TreeCollision from './TreeCollision';
import AtmosphericParticles from './AtmosphericParticles';
import SimpleBorderEffects from './SimpleBorderEffects';
import CustomSkeleton from './CustomSkeleton';
import StylizedGrass from './StylizedGrass';
import InstancedForest from './InstancedForest';

import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';
import { Vector3, Color, PerspectiveCamera } from '@/utils/three-exports';
import PerimeterCloudSystem from './PerimeterCloudSystem';

interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
  enableGrass?: boolean; // Enable stylized instanced grass
  enableForest?: boolean; // Enable instanced forest ring
  enableBorderEffects?: boolean; // Enable border particle and glow effects
  world?: World; // Optional world for collision system
  camera?: PerspectiveCamera; // Optional camera for LOD calculations
  enableLargeTree?: boolean; // Enable large tree rendering
  isPVP?: boolean; // Enable PVP-specific pillar positioning
  pvpPillarPositions?: Array<[number, number, number]>; // PVP pillar positions
  merchantRotation?: [number, number, number]; // Merchant rotation for interactions
  showMerchant?: boolean; // Whether to render the merchant (for performance optimization)
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
  enableBorderEffects = true,
  world,
  camera,
  enableLargeTree = false,
  isPVP = false,
  pvpPillarPositions,
  merchantRotation = [0, 0, 0],
  showMerchant = false
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
      [0, 0, 22.5],        // Front pillar
      [-7.25, 0, 21],   // Left pillar
    ];
  }, [isPVP, pvpPillarPositions]);

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  // Define merchant position near the tree
  const merchantPosition: [number, number, number] = useMemo(() => [18.4, 0, 9.2], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky />}

      {/* Perimeter clouds - red atmospheric clouds around map boundary */}
      <PerimeterCloudSystem radius={31} />

      {/* Instanced grass field — 80k blades, GPU-animated wind */}
      {enableGrass && <StylizedGrass />}

      {/* Instanced forest ring — 220 trees, 4 draw calls, GPU wind */}
      {enableForest && <InstancedForest />}

      <Planet />

            {/* Border effects - particles and glows around map perimeter */}
            {enableBorderEffects && (
        <SimpleBorderEffects
          radius={31}
          count={48}
          enableParticles={true}
          particleCount={100}
        />
      )}


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

 
    </group>
  );
};

export default Environment;
