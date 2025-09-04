import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group } from 'three';
import { MeshStandardMaterial } from '@/utils/three-exports';

interface BossBoneVortexProps {
  parentRef: React.RefObject<Group>;
}

const createVortexPiece = () => (
  <group>
    {/* Main vortex fragment - larger for Boss */}
    <mesh>
      <boxGeometry args={[0.06, 0.016, 0.016]} />
      <meshStandardMaterial 
        color="#aa0000"
        transparent
        opacity={0.45}
        emissive="#aa0000"
        emissiveIntensity={0.5}
      />
    </mesh>
    
    {/* Glowing core - larger for Boss */}
    <mesh>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshStandardMaterial 
        color="#aa0000"
        emissive="#aa0000"
        emissiveIntensity={1.1}
        transparent
        opacity={0.7}
      />
    </mesh>
  </group>
);

export default function BossBoneVortex({ parentRef }: BossBoneVortexProps) {
  const vortexPiecesRef = useRef<(Group | null)[]>([]);
  const pieceCount = 28; // More pieces than Ascendant for Boss
  const baseRadius = 0.5; // Larger radius than Ascendant
  const groupRef = useRef<Group>(null);
  
  useFrame(({ clock }) => {
    if (!parentRef.current || !groupRef.current) return;
    
    const parentPosition = parentRef.current.position;
    groupRef.current.position.set(parentPosition.x, 0, parentPosition.z);
    
    vortexPiecesRef.current.forEach((piece, i) => {
      if (!piece) return;
      
      const time = clock.getElapsedTime();
      const heightOffset = ((i / pieceCount) * 0.75); // Taller vortex for Boss
      const radiusMultiplier = 1.2 - (heightOffset * 1.1);
      
      const angle = (i / pieceCount) * Math.PI * 4 + time * 1.8; // Slightly slower than Ascendant for majesty
      const radius = baseRadius * radiusMultiplier;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = heightOffset;
      
      piece.position.set(x, y, z);
      piece.rotation.y = angle + Math.PI / 2;
      piece.rotation.x = Math.PI / 5;
      piece.rotation.z = Math.sin(time * 2.5 + i) * 0.12;
      
      // Update material opacity
      const meshChild = piece.children[0] as Mesh;
      if (meshChild && meshChild.material) {
        const material = meshChild.material as MeshStandardMaterial;
        material.opacity = Math.max(0.15, 1 - (heightOffset * 1.8));
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: pieceCount }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) vortexPiecesRef.current[i] = el;
          }}
        >
          {createVortexPiece()}
        </group>
      ))}
      
      <pointLight 
        color="#aa0000"
        intensity={0.8}
        distance={3}
        decay={2}
        position={[0, 0.6, 0]}
      />
    </group>
  );
}
