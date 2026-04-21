import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Color,
  AdditiveBlending,
  Quaternion,
  DoubleSide,
} from '@/utils/three-exports';
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
  if (isCryoflame) return { primary: '#1e40af', secondary: '#3b82f6', light: '#60a5fa' };
  switch (colorVariant) {
    case 'blue':   return { primary: '#3b82f6', secondary: '#93c5fd', light: '#93c5fd' };
    case 'red':    return { primary: '#ef4444', secondary: '#fca5a5', light: '#fecaca' };
    case 'green':  return { primary: '#22c55e', secondary: '#86efac', light: '#bbf7d0' };
    case 'purple':
    default:       return { primary: '#9333ea', secondary: '#c084fc', light: '#e9d5ff' };
  }
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const _dir = new Vector3();
const _quat = new Quaternion();

function alignBoltToDirection(group: Group | null, direction: Vector3) {
  if (!group) return;
  _dir.copy(direction).normalize();
  if (Math.abs(_dir.dot(AXIS_Y)) > 0.985) {
    _quat.setFromUnitVectors(FALLBACK_UP, _dir);
  } else {
    _quat.setFromUnitVectors(AXIS_Y, _dir);
  }
  group.quaternion.copy(_quat);
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
  const orientRef = useRef<Group>(null);
  const coronaRef = useRef<Mesh>(null);
  const tipRingRef = useRef<Mesh>(null);
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const [flightActive, setFlightActive] = useState(true);
  const [showImpact, setShowImpact] = useState(false);
  const [impactPosition, setImpactPosition] = useState<Vector3 | null>(null);

  const targetPosition = useRef(position.clone().add(direction.clone().multiplyScalar(12)));
  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());

  const theme = getBoltColorTheme(colorVariant, isCryoflame);
  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const trailAccent = useMemo(() => {
    const c = new Color(theme.secondary);
    c.lerp(new Color('#ffffff'), isCryoflame ? 0.2 : 0.38);
    return c;
  }, [theme.secondary, isCryoflame]);

  const primaryColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const secondaryColor = useMemo(() => new Color(theme.secondary), [theme.secondary]);

  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
    }
  }, [position]);

  useEffect(() => {
    alignBoltToDirection(orientRef.current, direction);
  }, [direction]);

  useFrame((_, delta) => {
    if (orientRef.current) {
      alignBoltToDirection(orientRef.current, direction);
    }

    const t = timeElapsed.current;
    const pulse = 1 + Math.sin(t * 16) * 0.07 + Math.sin(t * 7.3) * 0.04;
    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(pulse);
    }
    if (tipRingRef.current) {
      tipRingRef.current.rotation.z += delta * 5.5;
    }

    if (!boltRef.current || hasCollided.current) return;

    timeElapsed.current += delta;
    const totalDistance = 15;
    const progress = Math.min(timeElapsed.current * (15 / totalDistance), 1);

    const idealPosition = startPosition.current.clone().lerp(targetPosition.current, progress);

    let finalPosition = idealPosition;

   

    boltRef.current.position.copy(finalPosition);

    if (checkCollisions) {
      const currentPos = boltRef.current.position.clone();
      const hitSomething = checkCollisions(id, currentPos);

      if (hitSomething) {
        hasCollided.current = true;
        setFlightActive(false);
        setImpactPosition(currentPos);
        setShowImpact(true);
        if (onImpact) onImpact(currentPos);
        return;
      }
    }

    if (progress >= 1) {
      if (!hasCollided.current) {
        hasCollided.current = true;
        setFlightActive(false);
        setImpactPosition(targetPosition.current.clone());
        setShowImpact(true);
        if (onImpact) onImpact(targetPosition.current.clone());
      }
    }
  });

  const handleImpactComplete = () => {
    setShowImpact(false);
    setTimeout(() => {
      if (onImpact) onImpact();
    }, 200);
  };

  return (
    <group>
      {flightActive && (
        <>
          <EntropicBoltTrail
            color={trailColor}
            accentColor={trailAccent}
            size={0.325}
            meshRef={boltRef}
            opacity={1}
            isCryoflame={isCryoflame}
          />

          <group ref={boltRef} position={position.toArray()}>
            <group ref={orientRef}>
              <mesh ref={boltMeshRef}>
                <cylinderGeometry args={[0.048, 0.028, 0.78, 10, 1, false]} />
                <meshStandardMaterial
                  color={primaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={2.8}
                  transparent
                  opacity={0.95}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <mesh ref={coronaRef}>
                <cylinderGeometry args={[0.088, 0.055, 0.86, 12, 1, true]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={primaryColor}
                  emissiveIntensity={1.35}
                  transparent
                  opacity={0.22}
                  blending={AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              <mesh position={[0, 0.42, 0]} ref={tipRingRef}>
                <torusGeometry args={[0.09, 0.012, 8, 20]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={3.2}
                  transparent
                  opacity={0.55}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <mesh position={[0, -0.36, 0]} rotation={[0, 0, Math.PI / 5]}>
                <torusGeometry args={[0.065, 0.008, 6, 16]} />
                <meshStandardMaterial
                  color={primaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={2.0}
                  transparent
                  opacity={0.35}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <mesh position={[0, 0.46, 0]}>
                <sphereGeometry args={[0.06, 10, 10]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={4.5}
                  transparent
                  opacity={0.9}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <pointLight
                color={theme.light}
                intensity={5.5}
                distance={7}
                decay={2}
                position={[0, 0.15, 0]}
              />
            </group>
          </group>
        </>
      )}

      {showImpact && impactPosition && (
        <EntropicBoltImpact
          position={impactPosition}
          theme={theme}
          isCryoflame={isCryoflame}
          onComplete={handleImpactComplete}
        />
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
