import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group, } from 'three';
import { MeshStandardMaterial, AdditiveBlending } from '@/utils/three-exports';
import { WeaponType, WeaponSubclass } from './weapons';
 

interface BoneVortexProps {
  parentRef: React.RefObject<Group>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
}

const getVortexColor = (weaponType: WeaponType, weaponSubclass?: WeaponSubclass) => {
  if (weaponSubclass) {
    switch (weaponSubclass) {
      // Scythe subclasses
      case WeaponSubclass.CHAOS:
        return '#00FF37'; // Keep original chaos color
      case WeaponSubclass.ABYSSAL:
        return '#17CE54'; // lifegreen malachite
      
      // Sword subclasses
      case WeaponSubclass.DIVINITY:
        return '#FF9748'; // Keep original divinity color
      case WeaponSubclass.VENGEANCE:
        return '#FF9748'; // More orange for vengeance
      
      // Sabres subclasses
      case WeaponSubclass.FROST:
        return '#00AAFF'; // Keep original frost color
      case WeaponSubclass.ASSASSIN:
        return '#3A98F7'; // Dark purple for assassin
      
      // Spear subclasses
      case WeaponSubclass.PYRO:
        return '#FF544E'; // Keep original pyro color
      case WeaponSubclass.STORM:
        return '#FF544E'; // Grey for storm
      
      // Bow subclasses
      case WeaponSubclass.ELEMENTAL:
        return '#FF6F16'; // Keep original elemental color
      case WeaponSubclass.VENOM:
        return '#17CC93'; // Green/purple for venom
    }
  }
  
  // Fallback to weapon type colors
  switch (weaponType) {
    case WeaponType.SCYTHE:
      return '#5EFF00';
    case WeaponType.SWORD:
      return '#FF9748';
    case WeaponType.SABRES:
      return '#00AAFF';
    case WeaponType.SPEAR:
      return '#FF544E';
    case WeaponType.BOW:
      return '#17CC93';
    default:
      return '#00ff44';
  }
};

const createVortexPiece = (weaponType: WeaponType, weaponSubclass?: WeaponSubclass) => {
  const color = getVortexColor(weaponType, weaponSubclass);
  return (
    <group>
      {/* Main vortex fragment */}
      <mesh>
        <boxGeometry args={[0.1075, 0.02, 0.025]} />
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={0.6}
          emissive={color}
          emissiveIntensity={0.55}
        />
      </mesh>
      
      {/* Glowing core */}
      <mesh>
        <sphereGeometry args={[0.035, 9, 9]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={.7}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
};

export default function BoneVortex({ parentRef, weaponType, weaponSubclass }: BoneVortexProps) {
  const vortexPiecesRef = useRef<(Group | null)[]>([]);
  const pieceCount = 32;
  const baseRadius = 0.45;
  const groupRef = useRef<Group>(null);
  
  useFrame(({ clock }) => {
    if (!parentRef.current || !groupRef.current) return;
    
    const parentPosition = parentRef.current.position;
    groupRef.current.position.set(parentPosition.x, 0.0, parentPosition.z);
    
    vortexPiecesRef.current.forEach((piece, i) => {
      if (!piece) return;
      
      const time = clock.getElapsedTime();
      const heightOffset = ((i / pieceCount) * 0.625);
      const radiusMultiplier = 1 - (heightOffset * 0.875);
      
      const angle = (i / pieceCount) * Math.PI * 4 + time * 2;
      const radius = baseRadius * radiusMultiplier;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = heightOffset;
      
      piece.position.set(x, y, z);
      piece.rotation.y = angle + Math.PI / 2;
      piece.rotation.x = Math.PI / 6;
      piece.rotation.z = Math.sin(time * 3 + i) * 0.1;
      
      // Update material opacity
      const meshChild = piece.children[0] as Mesh;
      if (meshChild && meshChild.material) {
        const material = meshChild.material as MeshStandardMaterial;
        material.opacity = Math.max(0.1, 1 - (heightOffset * 2));
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Base glow sphere
      <mesh position={[0, -0.40, 0]}>
        <sphereGeometry args={[0.675, 16, 16]} />
        <meshBasicMaterial
          color={getVortexColor(weaponType, weaponSubclass)}
          transparent
          opacity={0.15}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
 */}
      {/* outer  fade glow
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial
          color={getVortexColor(weaponType, weaponSubclass)}
          transparent
          opacity={0.06}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
       */}

      {/* Point lights */}
      <pointLight 
        color={getVortexColor(weaponType, weaponSubclass)}
        intensity={2}
        distance={1.3}
        position={[0, 0.15, 0]}
      />
      
      <pointLight 
        color={getVortexColor(weaponType, weaponSubclass)}
        intensity={1}
        distance={2}
        position={[0, 0.1, 0]}
        decay={2}
      />

      {/* Existing vortex pieces */}
      {Array.from({ length: pieceCount }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) vortexPiecesRef.current[i] = el;
          }}
        >
          {createVortexPiece(weaponType, weaponSubclass)}
        </group>
      ))}
    </group>
  );
}
