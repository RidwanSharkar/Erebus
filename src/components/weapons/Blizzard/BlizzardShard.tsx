import { useRef } from 'react';
import { Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { sharedGeometries, sharedMaterials } from './Blizzard';

interface BlizzardShardProps {
  initialPosition: Vector3;
  onComplete: () => void;
  type: 'orbital' | 'falling';
}

export default function BlizzardShard({ initialPosition, onComplete, type }: BlizzardShardProps) {
  const meshRef = useRef<Mesh>(null);
  const fallSpeed = useRef(Math.random() * 1.5 + 3.65);
  const rotationSpeed = useRef({
    x: Math.random() * 1.5,
    y: Math.random() * 0.25,
    z: Math.random() * 1
  });
  const orbitRadius = useRef(Math.min(initialPosition.length(), 2)); // More compact orbit
  const orbitAngle = useRef(Math.atan2(initialPosition.z, initialPosition.x));

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (type === 'falling') {
      meshRef.current.position.y -= fallSpeed.current * delta;

      if (meshRef.current.position.y < 0) {
        onComplete();
      }
    } else {
      // Orbital movement
      orbitAngle.current += delta;
      meshRef.current.position.x = Math.cos(orbitAngle.current) * orbitRadius.current;
      meshRef.current.position.z = Math.sin(orbitAngle.current) * orbitRadius.current;

      // Remove after a few rotations
      if (orbitAngle.current > Math.PI * 2) {
        onComplete();
      }
    }

    // Common rotation for both types
    meshRef.current.rotation.x += rotationSpeed.current.x;
    meshRef.current.rotation.y += rotationSpeed.current.y;
    meshRef.current.rotation.z += rotationSpeed.current.z;
  });

  return (
    <mesh
      ref={meshRef}
      position={initialPosition}
      geometry={sharedGeometries.tetrahedron}
      material={sharedMaterials.shard}
    />
  );
}
