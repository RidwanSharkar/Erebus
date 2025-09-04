import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, AdditiveBlending } from '@/utils/three-exports';

interface DivineStormShardProps {
  initialPosition: Vector3;
  type: 'orbital' | 'falling';
  centerPosition: Vector3;
  onComplete: () => void;
}

export default function DivineStormShard({ 
  initialPosition, 
  type, 
  centerPosition, 
  onComplete 
}: DivineStormShardProps) {
  const shardRef = useRef<Group>(null);
  const lifeTime = useRef(0);
  const maxLifeTime = type === 'orbital' ? 3.0 : 2.0; // Orbital shards last longer
  
  useFrame((_, delta) => {
    if (!shardRef.current) return;
    
    lifeTime.current += delta;
    
    // Remove shard when lifetime expires
    if (lifeTime.current >= maxLifeTime) {
      onComplete();
      return;
    }
    
    if (type === 'orbital') {
      // Orbital shards rotate around the center
      const angle = lifeTime.current * 2; // Rotation speed
      const radius = 1.5;
      const height = -2.0 + Math.sin(lifeTime.current * 3) * 0.3; // Slight vertical oscillation
      
      shardRef.current.position.set(
        centerPosition.x + Math.cos(angle) * radius,
        centerPosition.y + height,
        centerPosition.z + Math.sin(angle) * radius
      );
      
      // Rotate the shard itself
      shardRef.current.rotation.y += delta * 4;
      shardRef.current.rotation.x += delta * 2;
    } else {
      // Falling shards fall down and fade
      const fallSpeed = 2.0;
      shardRef.current.position.y -= fallSpeed * delta;
      
      // Add slight horizontal drift
      shardRef.current.position.x += Math.sin(lifeTime.current * 2) * delta * 0.5;
      shardRef.current.position.z += Math.cos(lifeTime.current * 2) * delta * 0.5;
      
      // Rotate while falling
      shardRef.current.rotation.y += delta * 6;
      shardRef.current.rotation.z += delta * 3;
    }
  });
  
  // Calculate opacity based on lifetime
  const opacity = Math.max(0, 1 - (lifeTime.current / maxLifeTime));
  
  return (
    <group ref={shardRef} position={initialPosition.toArray()}>
      {/* Main shard crystal */}
      <mesh>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial
          color={new Color(0xFFD700)}
          emissive={new Color(0xFFD700)}
          emissiveIntensity={2}
          transparent
          opacity={opacity * 0.8}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Inner glow */}
      <mesh>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial
          color={new Color(0xFFF8DC)}
          emissive={new Color(0xFFD700)}
          emissiveIntensity={4}
          transparent
          opacity={opacity * 0.6}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Outer aura */}
      <mesh>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color={new Color(0xFFD700)}
          emissive={new Color(0xFFD700)}
          emissiveIntensity={1}
          transparent
          opacity={opacity * 0.3}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
