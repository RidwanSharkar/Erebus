import React, { useRef, useMemo } from 'react';
import { Group, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, BackSide, Matrix4, Vector3, Frustum, Sphere } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

/**
 * Blood moon planet component with atmospheric glow effects
 * Creates a distant celestial body to enhance the game's atmosphere
 */
const Planet: React.FC = () => {
  const groupRef = useRef<Group>(null);

  // Memoize geometries with reduced segments for better performance
  const sphereGeometry = useMemo(() => new SphereGeometry(1, 24, 24), []);
  
  // Memoize materials for performance
  const planetMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#DC143C", // Crimson red for the planet body
    roughness: 0.7,
    metalness: 0.2,
    emissive: "#DC143C",
    emissiveIntensity: 0.4
  }), []);

  const glowMaterial = useMemo(() => new MeshBasicMaterial({
    color: "#DC5E77", // Fire brick red for inner glow
    transparent: true,
    opacity: 0.4
  }), []);

  const outerGlowMaterial = useMemo(() => new MeshBasicMaterial({
    color: "#8B0000", // Dark red for outer glow
    transparent: true,
    opacity: 0.2,
    side: BackSide
  }), []);


  // Cache frustum and matrices to reduce garbage collection
  const frustum = useMemo(() => new Frustum(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const sphere = useMemo(() => new Sphere(new Vector3(), 12 * Math.sqrt(3)), []);

  // Apply frustum culling for performance
  useFrame((state) => {
    if (groupRef.current) {
      // Update frustum check with cached objects
      matrix.multiplyMatrices(
        state.camera.projectionMatrix,
        state.camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(matrix);

      sphere.center.copy(groupRef.current.position);
      groupRef.current.visible = frustum.intersectsSphere(sphere);
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={[100, 60, -150]} 
      scale={[12, 12, 12]} 
      rotation={[1.0, 0.1, 0.1]}
    >
      {/* Main planet sphere */}
      <mesh geometry={sphereGeometry} material={planetMaterial} />

      {/* Inner glow */}
      <mesh 
        scale={[1.05, 1.05, 1.05]} 
        geometry={sphereGeometry} 
        material={glowMaterial} 
      />

      {/* Outer glow */}
      <mesh 
        scale={[1.1, 1.1, 1.1]} 
        geometry={sphereGeometry}
        material={outerGlowMaterial}
      />
    </group>
  );
};

export default Planet;
