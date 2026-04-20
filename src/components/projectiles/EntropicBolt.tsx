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
  isCryoflame?: boolean;
  colorVariant?: string;
}

type BoltColorTheme = {
  primary: string;
  secondary: string;
  light: string;
};

function getBoltColorTheme(colorVariant: string | undefined, isCryoflame: boolean): BoltColorTheme {
  if (isCryoflame) return { primary: '#1e40af', secondary: '#3b82f6', light: '#1e40af' };
  switch (colorVariant) {
    case 'blue':   return { primary: '#3b82f6', secondary: '#93c5fd', light: '#3b82f6' };
    case 'red':    return { primary: '#ef4444', secondary: '#fca5a5', light: '#ef4444' };
    case 'green':  return { primary: '#22c55e', secondary: '#86efac', light: '#22c55e' };
    case 'purple':
    default:       return { primary: '#9333ea', secondary: '#c084fc', light: '#9333ea' };
  }
}

export default function EntropicBolt({
  id,
  position,
  direction,
  onImpact,
  checkCollisions,
  isCryoflame = false,
  colorVariant
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const boltMeshRef = useRef<Mesh>(null);
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactPosition, setImpactPosition] = useState<Vector3 | null>(null);

  const targetPosition = useRef(position.clone().add(direction.clone().multiplyScalar(12)));
  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());

  const theme = getBoltColorTheme(colorVariant, isCryoflame);
  const trailColor = new Color(theme.primary);

  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
    }
  }, [position]);

  useFrame((_, delta) => {
    if (!boltRef.current || hasCollided.current) return;

    timeElapsed.current += delta;
    const totalDistance = 15;
    const progress = Math.min(timeElapsed.current * (15 / totalDistance), 1);

    const idealPosition = startPosition.current.clone().lerp(targetPosition.current, progress);

    let finalPosition = idealPosition;

    if (!isCryoflame) {
      const time = timeElapsed.current;
      const seed = randomSeed.current;

      // Subtle chaotic movement — reduced amplitude for cleaner look
      const chaoticX = Math.sin(time * 6 + seed) * 0.12 * Math.sin(time * 2.5 + seed * 0.5);
      const chaoticY = Math.cos(time * 5 + seed * 1.5) * 0.12 * Math.sin(time * 3 + seed * 0.8);
      const chaoticZ = Math.sin(time * 5.5 + seed * 2) * 0.1 * Math.cos(time * 4 + seed * 1.2);

      const jitterIntensity = (1 - progress) * 0.04;
      const jitterX = (Math.random() - 0.5) * jitterIntensity;
      const jitterY = (Math.random() - 0.5) * jitterIntensity;
      const jitterZ = (Math.random() - 0.5) * jitterIntensity;

      chaoticOffset.current.set(
        chaoticX + jitterX,
        chaoticY + jitterY,
        chaoticZ + jitterZ
      );

      finalPosition = idealPosition.clone().add(chaoticOffset.current);
    }

    boltRef.current.position.copy(finalPosition);

    if (checkCollisions) {
      const currentPos = boltRef.current.position.clone();
      const hitSomething = checkCollisions(id, currentPos);

      if (hitSomething) {
        hasCollided.current = true;
        setImpactPosition(currentPos);
        setShowImpact(true);
        if (onImpact) onImpact(currentPos);
        return;
      }
    }

    if (progress >= 1) {
      if (!hasCollided.current) {
        hasCollided.current = true;
        setImpactPosition(targetPosition.current.clone());
        setShowImpact(true);
        if (onImpact) onImpact(targetPosition.current.clone());
      }
    }
  });

  const handleImpactComplete = () => {
    setTimeout(() => {
      if (onImpact) onImpact();
    }, 200);
  };

  return (
    <group>
      {!hasCollided.current && (
        <>
          <EntropicBoltTrail
            color={trailColor}
            size={0.3}
            meshRef={boltRef}
            opacity={1}
            isCryoflame={isCryoflame}
          />

          <group ref={boltRef} position={position.toArray()}>
            <group
              rotation={[
                0,
                Math.atan2(direction.x, direction.z),
                0
              ]}
            >
              <pointLight
                color={theme.light}
                intensity={3}
                distance={4}
                decay={2}
              />
            </group>
          </group>
        </>
      )}


    </group>
  );
}

interface EntropicBoltImpactProps {
  position: Vector3;
  onComplete?: () => void;
  isCryoflame?: boolean;
  theme: BoltColorTheme;
}

function EntropicBoltImpact({ position, onComplete, isCryoflame = false, theme }: EntropicBoltImpactProps) {
  const startTime = useRef(Date.now());
  const [, forceUpdate] = useState({});
  const IMPACT_DURATION = 0.7;

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
      <mesh>
        <sphereGeometry args={[0.675 * (1 + elapsed * 1.5), 12, 12]} />
        <meshStandardMaterial
          color={theme.primary}
          emissive={theme.secondary}
          emissiveIntensity={2.0 * fade}
          transparent
          opacity={0.6 * fade}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.45 * (1 + elapsed * 2), 8, 8]} />
        <meshStandardMaterial
          color={theme.secondary}
          emissive={theme.primary}
          emissiveIntensity={2.0 * fade}
          transparent
          opacity={0.7 * fade}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1 * (1 + elapsed * 1.2);

        return (
          <mesh
            key={i}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius * 0.2,
              Math.cos(angle + Math.PI / 3) * radius * 0.4
            ]}
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          >
            <coneGeometry args={[0.08, 0.4, 4]} />
            <meshStandardMaterial
              color={theme.secondary}
              emissive={theme.secondary}
              emissiveIntensity={3.0 * fade}
              transparent
              opacity={0.8 * fade}
            />
          </mesh>
        );
      })}

      {[...Array(2)].map((_, i) => (
        <mesh
          key={`energy-ring-${i}`}
          rotation={[-Math.PI / 2, 0, i * Math.PI / 2]}
        >
          <torusGeometry args={[1 * (1 + elapsed * 1.5) + i * 0.2, 0.08, 6, 16]} />
          <meshStandardMaterial
            color={theme.primary}
            emissive={theme.secondary}
            emissiveIntensity={3.0 * fade}
            transparent
            opacity={0.5 * fade * (1 - i * 0.3)}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      <pointLight
        color={theme.light}
        intensity={8 * fade}
        distance={4}
        decay={2}
      />
    </group>
  );
}
