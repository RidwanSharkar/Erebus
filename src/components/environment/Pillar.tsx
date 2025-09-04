import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PillarProps {
  position?: [number, number, number];
  level?: number;
}

const Pillar: React.FC<PillarProps> = ({ position = [0, 0, 0], level = 1 }) => {
  // Get level-based colors
  const getLevelColors = (level: number) => {
    switch (level) {
      case 1: return { color: '#FF6E6E', emissive: '#FF6E6E' }; // Green  00ff00 006600
      case 2: return { color: '#ffa500', emissive: '#cc8400' }; // Orange
      case 3: return { color: '#87ceeb', emissive: '#4682b4' }; // Light Blue
      case 4: return { color: '#dda0dd', emissive: '#9370db' }; // Light Purple
      case 5: return { color: '#ff0000', emissive: '#600000' }; // Red
      default: return { color: '#00ff00', emissive: '#006600' }; // Default to green
    }
  };

  // Create geometries and materials only once using useMemo
  const { pillarGeometries, materials } = useMemo(() => {
    // Base geometry
    const baseGeometry = new THREE.CylinderGeometry(2, 2.2, 1, 8);
    
    // Main column geometry
    const columnGeometry = new THREE.CylinderGeometry(1.5, 1.5, 8, 8);
    
    // Top geometry (decorative cap)
    const topGeometry = new THREE.CylinderGeometry(2.2, 2, 1, 8);

    // Shared material for all parts
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.2,
    });

    // Add sphere geometry for the orb
    const orbGeometry = new THREE.SphereGeometry(1, 32, 32);

    // Get level-based colors
    const levelColors = getLevelColors(level);

    // Add glowing material for the orb with level-based colors
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: levelColors.color,
      emissive: levelColors.emissive,
      metalness: 1,
      roughness: 0.2,
    });

    return {
      pillarGeometries: {
        base: baseGeometry,
        column: columnGeometry,
        top: topGeometry,
        orb: orbGeometry,
      },
      materials: {
        stone: stoneMaterial,
        orb: orbMaterial,
      }
    };
  }, [level]);

  // rotation animation for the orb
  const [rotation, setRotation] = React.useState(0);
  
  React.useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      setRotation(prev => (prev + 0.02) % (Math.PI * 2));
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  //  cleanup 
  React.useEffect(() => {
    return () => {
      Object.values(pillarGeometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [pillarGeometries, materials]);

  // Get level-based light color
  const levelColors = getLevelColors(level);

  return (
    <group position={position} scale={[0.35, 0.35, 0.35]}>
      {/* Base */}
      <mesh
        geometry={pillarGeometries.base}
        material={materials.stone}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      />
      
      {/* Main column */}
      <mesh
        geometry={pillarGeometries.column}
        material={materials.stone}
        position={[0, 0.25, 0]}
        castShadow
        receiveShadow
      />
      
      {/* Top */}
      <mesh
        geometry={pillarGeometries.top}
        material={materials.stone}
        position={[0, 3, 0]}
        castShadow
        receiveShadow
      />
      
      {/* Floating orb */}
      <mesh
        geometry={pillarGeometries.orb}
        material={materials.orb}
        position={[0, 5, 0]}
        rotation={[rotation, rotation, 0]}
      >
        <pointLight color={levelColors.color} intensity={0.5} distance={5} />
      </mesh>
    </group>
  );
};

export default React.memo(Pillar);
