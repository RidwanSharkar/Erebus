import React, { useMemo } from 'react';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import Pedestal from './Pedestal';
import PillarCollision from './PillarCollision';
import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';

interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
  world?: World; // Optional world for collision system
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
  world
}) => {
  // Generate mountains once and memoize for performance
  const mountains = useMemo(() => generateMountains(), []);

  // Define pillar positions in triangle formation
  const pillarPositions: Array<[number, number, number]> = useMemo(() => [
    [0, 0, -5],        // Front pillar
    [-4.25, 0, 2.5],   // Left pillar
    [4.25, 0, 2.5]     // Right pillar
  ], []);

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky level={level} />}
      
      {/* Distant planet with rings */}
      {enablePlanet && <Planet />}
      
      {/* Mountain border around the map */}
      {enableMountains && <InstancedMountains mountains={mountains} />}
      
      {/* Central Pedestal */}
      <Pedestal position={pedestalPosition} scale={0.4} level={level} />
      
      {/* Three pillars in triangle formation */}
      <Pillar position={pillarPositions[0]} level={level} />
      <Pillar position={pillarPositions[1]} level={level} />
      <Pillar position={pillarPositions[2]} level={level} />
      
      {/* Collision entities for pillars only (only if world is provided) */}
      {world && (
        <PillarCollision world={world} positions={pillarPositions} />
      )}
    </group>
  );
};

export default Environment;
