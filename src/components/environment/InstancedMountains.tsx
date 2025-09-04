import React, { useRef, useEffect, useMemo } from 'react';
import { InstancedMesh, MeshStandardMaterial, ConeGeometry, Matrix4, Euler } from '@/utils/three-exports';
import { MountainData, createPeakGeometry } from '@/utils/MountainGenerator';

interface InstancedMountainsProps {
  mountains: MountainData[];
}

/**
 * High-performance mountain renderer using instanced meshes
 * Creates a natural mountain border around the game world
 */
const InstancedMountains: React.FC<InstancedMountainsProps> = ({ mountains }) => {
  const baseRef = useRef<InstancedMesh>(null);
  const secondaryRef = useRef<InstancedMesh>(null);

  // Create varied peak geometries for natural snowtop variation
  const peakGeometries = useMemo(() => {
    return mountains.map((_, index) => createPeakGeometry(index));
  }, [mountains]);

  // Memoize materials for better performance
  const baseMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#8B7355", // Brown-gray mountain color
    roughness: 0.8,
    metalness: 0.1,
  }), []);

  const secondaryMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#6B5B47", // Darker brown for background mountains
    roughness: 0.9,
    metalness: 0.05,
  }), []);

  const peakMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#f0f0f0", // Light gray-white for snow peaks
    roughness: 0.3,
    metalness: 0.0,
  }), []);

  // Memoize geometries
  const baseGeometry = useMemo(() => new ConeGeometry(23, 34.5, 24, 6), []);
  const secondaryGeometry = useMemo(() => new ConeGeometry(24, 29, 25, 5), []);

  useEffect(() => {
    if (!baseRef.current || !secondaryRef.current) return;

    const matrix = new Matrix4();

    // Handle base mountains
    mountains.forEach((mountain, i) => {
      matrix.makeTranslation(
        mountain.position.x,
        mountain.position.y,
        mountain.position.z
      );
      const scaleMatrix = new Matrix4().makeScale(
        mountain.scale,
        mountain.scale,
        mountain.scale
      );
      matrix.multiply(scaleMatrix);
      baseRef.current?.setMatrixAt(i, matrix);
    });

    // Handle secondary mountains with offset and rotation
    mountains.forEach((mountain, i) => {
      const rotationMatrix = new Matrix4().makeRotationFromEuler(
        new Euler(0, 0.5, 0.1)
      );
      
      // Calculate offset based on mountain scale
      const offsetX = -4 * mountain.scale;
      const offsetY = -5 * mountain.scale;
      const offsetZ = -2 * mountain.scale;
      
      matrix.makeTranslation(
        mountain.position.x + offsetX,
        mountain.position.y + offsetY,
        mountain.position.z + offsetZ
      );
      
      const scaleMatrix = new Matrix4().makeScale(
        mountain.scale,
        mountain.scale,
        mountain.scale
      );
      
      matrix.multiply(rotationMatrix).multiply(scaleMatrix);
      secondaryRef.current?.setMatrixAt(i, matrix);
    });

    // Update matrices
    baseRef.current.instanceMatrix.needsUpdate = true;
    secondaryRef.current.instanceMatrix.needsUpdate = true;
  }, [mountains]);

  return (
    <group>
      {/* Base mountain layer */}
      <instancedMesh
        args={[baseGeometry, baseMaterial, mountains.length]}
        ref={baseRef}
        castShadow
        receiveShadow
      />

      {/* Secondary mountain layer for depth */}
      <instancedMesh
        args={[secondaryGeometry, secondaryMaterial, mountains.length]}
        ref={secondaryRef}
        castShadow
      />

      {/* Individual peak meshes with varied geometries */}
      {mountains.map((mountain, index) => (
        <mesh
          key={`peak-${index}`}
          geometry={peakGeometries[index]}
          material={peakMaterial}
          position={[
            mountain.position.x,
            mountain.position.y + (14 * mountain.scale),
            mountain.position.z
          ]}
          scale={[
            mountain.scale * 0.9,
            mountain.scale,
            mountain.scale * 0.9
          ]}
          castShadow
        />
      ))}
    </group>
  );
};

export default InstancedMountains;
