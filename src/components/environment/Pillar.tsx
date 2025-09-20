import React, { useMemo } from 'react';
import { CylinderGeometry, SphereGeometry, MeshStandardMaterial, PointLight, Color } from '../../utils/three-exports';
import { useColorCycle } from '../../utils/hooks/useColorCycle';

interface PillarProps {
  position?: [number, number, number];
  level?: number;
}

const Pillar: React.FC<PillarProps> = ({ position = [0, 0, 0], level = 1 }) => {
  // Use time-based color cycling
  const { getPrimaryColors } = useColorCycle();

  // Create static geometries only once using useMemo
  const pillarGeometries = useMemo(() => {
    return {
      base: new CylinderGeometry(2, 2.2, 1, 8),
      column: new CylinderGeometry(1.5, 1.5, 8, 8),
      top: new CylinderGeometry(2.2, 2, 1, 8),
      orb: new SphereGeometry(1, 32, 32),
    };
  }, []);

  // Shared stone material (static)
  const stoneMaterial = useMemo(() => new MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.7,
    metalness: 0.2,
  }), []);

  // Dynamic orb material that updates with colors
  const orbMaterial = useMemo(() => {
    const colors = getPrimaryColors();
    return new MeshStandardMaterial({
      color: new Color(colors.color),
      emissive: new Color(colors.emissive),
      metalness: 1,
      roughness: 0.2,
    });
  }, [getPrimaryColors]);

  // Group materials for cleanup
  const materials = useMemo(() => ({
    stone: stoneMaterial,
    orb: orbMaterial,
  }), [stoneMaterial, orbMaterial]);

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

  // Cleanup geometries and materials
  React.useEffect(() => {
    return () => {
      Object.values(pillarGeometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [pillarGeometries, materials]);

  // Get current colors for the light
  const currentColors = getPrimaryColors();
  const lightColor = useMemo(() => new Color(currentColors.color), [currentColors.color]);

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
        <pointLight color={lightColor} intensity={0.5} distance={5} />
      </mesh>
    </group>
  );
};

export default React.memo(Pillar);
