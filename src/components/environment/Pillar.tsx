import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderGeometry, SphereGeometry, MeshStandardMaterial, Mesh } from '../../utils/three-exports';

/** Shared stone meshes — one geometry set for all pillar instances (never disposed). */
export const PILLAR_SHARED_GEOMETRIES = {
  base: new CylinderGeometry(2, 2.2, 1, 8),
  column: new CylinderGeometry(1.5, 1.5, 8, 8),
  top: new CylinderGeometry(2.2, 2, 1, 8),
  orb: new SphereGeometry(1, 32, 32),
};

export const PILLAR_STONE_MATERIAL = new MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.7,
  metalness: 0.2,
});

interface PillarProps {
  position?: [number, number, number];
  /** Hex color for the floating orb and its point light (default: ice blue). */
  orbColorHex?: string;
  /** When false, render only the stone column (e.g. throne ability pedestal). */
  showOrb?: boolean;
}

const Pillar: React.FC<PillarProps> = ({ position = [0, 0, 0], orbColorHex = '#5DADE2', showOrb = true }) => {
  const orbMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: orbColorHex,
        emissive: orbColorHex,
        metalness: 1,
        roughness: 0.2,
      }),
    [orbColorHex],
  );

  const orbRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!showOrb || !orbRef.current) return;
    orbRef.current.rotation.x += 0.02;
    orbRef.current.rotation.y += 0.02;
  });

  React.useEffect(
    () => () => {
      orbMaterial.dispose();
    },
    [orbMaterial],
  );

  return (
    <group position={position} scale={[0.35, 0.35, 0.35]}>
      {/* Base */}
      <mesh
        geometry={PILLAR_SHARED_GEOMETRIES.base}
        material={PILLAR_STONE_MATERIAL}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      />

      {/* Main column */}
      <mesh
        geometry={PILLAR_SHARED_GEOMETRIES.column}
        material={PILLAR_STONE_MATERIAL}
        position={[0, 0.25, 0]}
        castShadow
        receiveShadow
      />

      {/* Top */}
      <mesh
        geometry={PILLAR_SHARED_GEOMETRIES.top}
        material={PILLAR_STONE_MATERIAL}
        position={[0, 3, 0]}
        castShadow
        receiveShadow
      />

      {showOrb && (
        <mesh
          ref={orbRef}
          geometry={PILLAR_SHARED_GEOMETRIES.orb}
          material={orbMaterial}
          position={[0, 5, 0]}
        >
          <pointLight color={orbColorHex} intensity={1} distance={5} />
        </mesh>
      )}
    </group>
  );
};

export default React.memo(Pillar);
