import React, { useMemo } from 'react';
import { CylinderGeometry, SphereGeometry, MeshStandardMaterial, PointLight } from '../../utils/three-exports';

interface PillarProps {
  position?: [number, number, number];
  /** Hex color for the floating orb and its point light (default: ice blue). */
  orbColorHex?: string;
  /** When false, render only the stone column (e.g. throne ability pedestal). */
  showOrb?: boolean;
}

const Pillar: React.FC<PillarProps> = ({ position = [0, 0, 0], orbColorHex = '#5DADE2', showOrb = true }) => {

  // Create geometries and materials only once using useMemo
  const { pillarGeometries, materials } = useMemo(() => {
    // Base geometry
    const baseGeometry = new CylinderGeometry(2, 2.2, 1, 8);

    // Main column geometry
    const columnGeometry = new CylinderGeometry(1.5, 1.5, 8, 8);

    // Top geometry (decorative cap)
    const topGeometry = new CylinderGeometry(2.2, 2, 1, 8);

    // Shared material for all parts
    const stoneMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.2,
    });

    // Add sphere geometry for the orb
    const orbGeometry = new SphereGeometry(1, 32, 32);

    const orbMaterial = new MeshStandardMaterial({
      color: orbColorHex,
      emissive: orbColorHex,
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
  }, [orbColorHex]);

  // rotation animation for the orb
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    if (!showOrb) return;
    let animationFrameId: number;

    const animate = () => {
      setRotation((prev) => (prev + 0.02) % (Math.PI * 2));
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [showOrb]);

  //  cleanup 
  React.useEffect(() => {
    return () => {
      Object.values(pillarGeometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [pillarGeometries, materials]);


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
      
      {showOrb && (
        <mesh
          geometry={pillarGeometries.orb}
          material={materials.orb}
          position={[0, 5, 0]}
          rotation={[rotation, rotation, 0]}
        >
          <pointLight color={orbColorHex} intensity={1} distance={5} />
        </mesh>
      )}
    </group>
  );
};

export default React.memo(Pillar);
