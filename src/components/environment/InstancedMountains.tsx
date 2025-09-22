import React, { useRef, useEffect, useMemo } from 'react';
import { InstancedMesh, MeshStandardMaterial, ConeGeometry, Matrix4 } from '@/utils/three-exports';
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

  const peakMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#f0f0f0", // Light gray-white for snow peaks
    roughness: 0.3,
    metalness: 0.0,
  }), []);

  // Memoize geometries
  const baseGeometry = useMemo(() => new ConeGeometry(22, 34.5, 24, 6), []);

  useEffect(() => {
    if (!baseRef.current) return;

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

    // Update matrices
    baseRef.current.instanceMatrix.needsUpdate = true;
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
            mountain.scale * 0.915,
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
