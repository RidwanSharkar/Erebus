import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, Color, AdditiveBlending } from '@/utils/three-exports';
import EntropicBoltTrail from './EntropicBoltTrail';

interface EntropicBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  onImpact?: (position?: Vector3) => void;
  checkCollisions?: (boltId: number, position: Vector3) => boolean;
  isCryoflame?: boolean; // Whether this bolt is enhanced with Cryoflame
}

export default function EntropicBolt({
  id,
  position,
  direction,
  onImpact,
  checkCollisions,
  isCryoflame = false
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const boltMeshRef = useRef<Mesh>(null);
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactPosition, setImpactPosition] = useState<Vector3 | null>(null);
  
  // Chaotic movement variables
  const targetPosition = useRef(position.clone().add(direction.clone().multiplyScalar(25)));
  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());

  // Initialize position on mount
  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
    }
  }, [position]);

  useFrame((_, delta) => { 
    if (!boltRef.current || hasCollided.current) return;

    timeElapsed.current += delta;
    const totalDistance = 30; // Max travel distance
    const progress = Math.min(timeElapsed.current * (30 / totalDistance), 1); // Progress from 0 to 1

    // Calculate the ideal straight-line position
    const idealPosition = startPosition.current.clone().lerp(targetPosition.current, progress);

    let finalPosition = idealPosition;

    // Only add chaotic movement if NOT Cryoflame (Cryoflame bolts move in straight lines)
    if (!isCryoflame) {
      // Add chaotic movement with multiple sine waves for entropic effect
      const time = timeElapsed.current;
      const seed = randomSeed.current;

      // Multiple overlapping sine waves for chaotic movement
      const chaoticX = Math.sin(time * 8 + seed) * 0.3 * Math.sin(time * 3 + seed * 0.5) * 3.5;
      const chaoticY = Math.cos(time * 6 + seed * 1.5) * 0.4 * Math.sin(time * 4 + seed * 0.8) * 3.6;
      const chaoticZ = Math.sin(time * 7 + seed * 2) * 0.25 * Math.cos(time * 5 + seed * 1.2) * 3.4;

      // Add some random jitter that decreases as we get closer to target
      const jitterIntensity = (1 - progress) * 0.15;
      const jitterX = (Math.random() - 0.5) * jitterIntensity;
      const jitterY = (Math.random() - 0.5) * jitterIntensity;
      const jitterZ = (Math.random() - 0.5) * jitterIntensity;

      // Combine chaotic movement with jitter
      chaoticOffset.current.set(
        chaoticX + jitterX,
        chaoticY + jitterY,
        chaoticZ + jitterZ
      );

      // Apply the chaotic offset to the ideal position
      finalPosition = idealPosition.clone().add(chaoticOffset.current);
    }

    boltRef.current.position.copy(finalPosition);

    // Check collisions each frame
    if (checkCollisions) {
      const currentPos = boltRef.current.position.clone();
      const hitSomething = checkCollisions(id, currentPos);
      
      if (hitSomething) {
        hasCollided.current = true;
        setImpactPosition(currentPos);
        setShowImpact(true);
        if (onImpact) {
          onImpact(currentPos);
        }
        return;
      }
    }

    // Check if we've reached the target (progress >= 1)
    if (progress >= 1) {
      if (!hasCollided.current) {
        hasCollided.current = true;
        setImpactPosition(targetPosition.current.clone());
        setShowImpact(true);
        if (onImpact) {
          onImpact(targetPosition.current.clone());
        }
      }
    }
  });

  // Handle impact completion
  const handleImpactComplete = () => {
    setTimeout(() => {
      if (onImpact) {
        onImpact();
      }
    }, 200);
  };

  return (
    <group>
      {!hasCollided.current && (
        <>
          {/* Entropic trail effect */}
          <EntropicBoltTrail
            color={new Color("#1e40af")} // Deep cobalt blue (always use Cryoflame visuals)
            size={0.3}
            meshRef={boltRef}
            opacity={1}
            isCryoflame={true}
          />
          
          <group ref={boltRef} position={position.toArray()}>
            <group
              rotation={[
                0,
                Math.atan2(direction.x, direction.z),
                0
              ]}
            >

              {/* Light source */}
              <pointLight
                color="#1e40af"
                intensity={3}
                distance={4}
                decay={2}
              />
            </group>
          </group>
        </>
      )}

      {/* Impact effect */}
      {showImpact && impactPosition && (
        <EntropicBoltImpact
          position={impactPosition}
          onComplete={handleImpactComplete}
          isCryoflame={isCryoflame}
        />
      )}
    </group>
  );
}

// Impact effect component
interface EntropicBoltImpactProps {
  position: Vector3;
  onComplete?: () => void;
  isCryoflame?: boolean;
}

function EntropicBoltImpact({ position, onComplete, isCryoflame = false }: EntropicBoltImpactProps) {
  const startTime = useRef(Date.now());
  const [, forceUpdate] = useState({});
  const IMPACT_DURATION = 0.7; // Shorter duration than GlacialShard
  
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
      
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed > IMPACT_DURATION) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 16);
    
    const timer = setTimeout(() => {
      clearInterval(interval);
      if (onComplete) onComplete();
    }, IMPACT_DURATION * 1000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  const elapsed = (Date.now() - startTime.current) / 1000;
  const fade = Math.max(0, 1 - (elapsed / IMPACT_DURATION));
  
  if (fade <= 0) return null;

  return (
    <group position={position}>
      {/* Main entropic explosion effect */}
      <mesh>
        <sphereGeometry args={[0.675 * (1 + elapsed * 1.5), 12, 12]} />
        <meshStandardMaterial
          color="#1e40af"
          emissive="#3b82f6"
          emissiveIntensity={2.0 * fade}
          transparent
          opacity={0.6 * fade}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary explosion ring */}
      <mesh>
        <sphereGeometry args={[0.45 * (1 + elapsed * 2), 8, 8]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#60a5fa"
          emissiveIntensity={2.0 * fade}
          transparent
          opacity={0.7 * fade}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Energy shards burst */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1 * (1 + elapsed * 1.2);
        
        return (
          <mesh
            key={i}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius * 0.2,
              Math.cos(angle + Math.PI/3) * radius * 0.4
            ]}
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          >
            <coneGeometry args={[0.08, 0.4, 4]} />
            <meshStandardMaterial
              color="#dbeafe"
              emissive="#bfdbfe"
              emissiveIntensity={3.0 * fade}
              transparent
              opacity={0.8 * fade}
            />
          </mesh>
        );
      })}

      {/* Expanding energy rings */}
      {[...Array(2)].map((_, i) => (
        <mesh
          key={`energy-ring-${i}`}
          rotation={[-Math.PI/2, 0, i * Math.PI/2]}
        >
          <torusGeometry args={[1 * (1 + elapsed * 1.5) + i * 0.2, 0.08, 6, 16]} />
          <meshStandardMaterial
            color="#1e40af"
            emissive="#3b82f6"
            emissiveIntensity={3.0 * fade}
            transparent
            opacity={0.5 * fade * (1 - i * 0.3)}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Bright flash */}
      <pointLight
        color="#1e40af"
        intensity={8 * fade}
        distance={4}
        decay={2}
      />
    </group>
  );
}
