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



    if (!boltRef.current || hasCollided.current) return;

    timeElapsed.current += delta;
    const totalDistance = 15;
    const progress = Math.min(timeElapsed.current * (15 / totalDistance), 0);

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



  return (
    <group>
      {flightActive && (
        <>
          <EntropicBoltTrail
            color={trailColor}
            accentColor={trailColor}
            size={0.25}
            meshRef={boltRef}
            opacity={1}
            isCryoflame={isCryoflame}
          />

          <group ref={boltRef} position={position.toArray()}>
            <group ref={orientRef}>
   



   

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



      <pointLight
        color={theme.light}
        intensity={8 * fade}
        distance={4}
        decay={2}
      />
    </group>
  );
}
