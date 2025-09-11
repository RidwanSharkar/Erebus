import React, { useMemo } from 'react';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import Pedestal from './Pedestal';
import EnhancedGround from './EnhancedGround';
import PillarCollision from './PillarCollision';
import DetailedTrees, { DetailedTree } from './DetailedTrees';
import TreeCollision from './TreeCollision';
import AtmosphericParticles from './AtmosphericParticles';
import VolumetricLighting from './VolumetricLighting';
import { LODWrapper } from './LODManager';
import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';
import { Vector3, Color } from '@/utils/three-exports';

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

  // Define tree positions for natural forest arrangement
  const treePositions: DetailedTree[] = useMemo(() => [
    // Inner ring trees (closer to center)
    { position: new Vector3(8, 0, 8), scale: 0.8, height: 4, trunkRadius: 0.2, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-8, 0, 8), scale: 0.9, height: 4.2, trunkRadius: 0.22, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(8, 0, -8), scale: 0.85, height: 3.8, trunkRadius: 0.18, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-8, 0, -8), scale: 0.95, height: 4.5, trunkRadius: 0.25, trunkColor: new Color(0x2d2418) },

    // Middle ring trees
    { position: new Vector3(15, 0, 5), scale: 1.0, height: 4.8, trunkRadius: 0.24, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-15, 0, 5), scale: 0.9, height: 4.2, trunkRadius: 0.20, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(15, 0, -5), scale: 0.85, height: 3.9, trunkRadius: 0.19, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-15, 0, -5), scale: 0.95, height: 4.3, trunkRadius: 0.23, trunkColor: new Color(0x2d2418) },
    { position: new Vector3(5, 0, 15), scale: 0.9, height: 4.1, trunkRadius: 0.21, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-5, 0, 15), scale: 1.0, height: 4.7, trunkRadius: 0.24, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(5, 0, -15), scale: 0.85, height: 3.8, trunkRadius: 0.18, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-5, 0, -15), scale: 0.9, height: 4.4, trunkRadius: 0.22, trunkColor: new Color(0x2d2418) },

    // Outer ring trees (near map boundary but within collision radius)
    { position: new Vector3(20, 0, 10), scale: 1.1, height: 5.0, trunkRadius: 0.26, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-20, 0, 10), scale: 0.95, height: 4.5, trunkRadius: 0.23, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(20, 0, -10), scale: 0.9, height: 4.2, trunkRadius: 0.20, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-20, 0, -10), scale: 1.0, height: 4.8, trunkRadius: 0.25, trunkColor: new Color(0x2d2418) },
    { position: new Vector3(10, 0, 20), scale: 0.85, height: 3.9, trunkRadius: 0.19, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-10, 0, 20), scale: 1.05, height: 4.6, trunkRadius: 0.24, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(10, 0, -20), scale: 0.95, height: 4.3, trunkRadius: 0.22, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-10, 0, -20), scale: 0.9, height: 4.0, trunkRadius: 0.20, trunkColor: new Color(0x2d2418) },

    // Additional scattered trees for natural look
    { position: new Vector3(12, 0, 12), scale: 0.8, height: 3.7, trunkRadius: 0.17, trunkColor: new Color(0x4a3c28) },
    { position: new Vector3(-12, 0, 12), scale: 0.95, height: 4.4, trunkRadius: 0.23, trunkColor: new Color(0x3d301f) },
    { position: new Vector3(12, 0, -12), scale: 1.0, height: 4.7, trunkRadius: 0.25, trunkColor: new Color(0x5a4a35) },
    { position: new Vector3(-12, 0, -12), scale: 0.85, height: 3.8, trunkRadius: 0.18, trunkColor: new Color(0x2d2418) },
  ], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky level={level} />}

      {/* Enhanced ground with procedural textures */}
      <EnhancedGround level={level} />

      {/* Distant planet with rings - using LOD for performance */}
      {enablePlanet && (
        <LODWrapper
          position={[100, 80, -150]}
          highDetailDistance={200}
          mediumDetailDistance={400}
          lowDetailDistance={600}
          highDetail={<Planet />}
          mediumDetail={
            <group position={[100, 80, -150]} scale={[12, 12, 12]}>
              <mesh>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color="#B8E0D2" emissive="#B8E0D2" emissiveIntensity={0.5} />
              </mesh>
            </group>
          }
          lowDetail={
            <group position={[100, 80, -150]} scale={[8, 8, 8]}>
              <mesh>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="#4dff90" />
              </mesh>
            </group>
          }
        />
      )}

      {/* Volumetric lighting from the distant planet */}
      {enablePlanet && (
        <VolumetricLighting
          lightPosition={[100, 80, -150]}
          cameraPosition={[0, 2, 0]}
          intensity={0.2}
          color="#4dff90"
        />
      )}

      {/* Mountain border around the map */}
      {enableMountains && <InstancedMountains mountains={mountains} />}

      {/* Forest of detailed trees */}
      <DetailedTrees trees={treePositions} />

      {/* Central Pedestal */}
      <Pedestal position={pedestalPosition} scale={0.4} level={level} />


      {/* Atmospheric particles around central area */}
      <AtmosphericParticles
        position={pedestalPosition}
        count={30}
        radius={8}
        color="#ffffff"
        speed={0.3}
        size={0.025}
      />

      {/* Three pillars in triangle formation */}
      {pillarPositions.map((pillarPos, index) => (
        <group key={`pillar-group-${index}`}>
          <Pillar position={pillarPos} level={level} />
          {/* Particles around each pillar */}
          <AtmosphericParticles
            position={pillarPos}
            count={15}
            radius={2}
            color={level === 1 ? '#FF6E6E' : level === 2 ? '#FFA500' : level === 3 ? '#87CEEB' : '#DDA0DD'}
            speed={0.4}
            size={0.015}
          />
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
