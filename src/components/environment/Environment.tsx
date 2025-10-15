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

import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';
import { Vector3, Color, PerspectiveCamera } from '@/utils/three-exports';

interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
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
      [0, 0, -5],        // Front pillar
      [-4.25, 0, 2.5],   // Left pillar
      [4.25, 0, 2.5]     // Right pillar
    ];
  }, [isPVP, pvpPillarPositions]);

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  // Define tree positions for natural forest arrangement (reduced by half, removed inner trees)
  const treePositions: DetailedTree[] = useMemo(() => [
    // Outer ring trees (kept all - furthest from center, near map boundary)
    { position: new Vector3(18, 0, 10), scale: 1.5, height: 2.5, trunkRadius: 0.275, trunkColor: new Color(0xC69049) },
    { position: new Vector3(13, 0, 10), scale: 1.35, height: 1.5, trunkRadius: 0.225, trunkColor: new Color(0xC69049) },
    { position: new Vector3(17, 0, 3), scale: 1.35, height: 2, trunkRadius: 0.255, trunkColor: new Color(0xA3773D) },

  ], []);

  // Define merchant position near the tree
  const merchantPosition: [number, number, number] = useMemo(() => [16, 0, 8], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky />}

      {/* Enhanced ground with procedural textures */}
      <EnhancedGround level={level} />


      <Planet />

      <DetailedTrees trees={treePositions} />

      {/* Merchant positioned near the tree edge - only render when player is nearby for performance */}
      {showMerchant && <CustomSkeleton position={merchantPosition} rotation={merchantRotation} />}

      {/* Mountain border around the map */}
      {enableMountains && <InstancedMountains mountains={mountains} />}

      {/* Border effects - particles and glows around map perimeter */}
      {enableBorderEffects && (
        <SimpleBorderEffects
          radius={22}
          count={64}
          enableParticles={true}
          particleCount={100}
        />
      )}

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

      {/* Collision entities for tree trunks (only if world is provided) */}
      {world && (
        <TreeCollision world={world} trees={treePositions} />
      )}
    </group>
  );
};

export default Environment;
