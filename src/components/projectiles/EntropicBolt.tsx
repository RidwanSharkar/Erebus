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
import EntropicBoltTrail, { ENTROPIC_TRAIL_FADE_OUT_DURATION } from './EntropicBoltTrail';

interface EntropicBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  onImpact?: (position?: Vector3) => void;
  checkCollisions?: (boltId: number, position: Vector3) => boolean;
  isCryoflame?: boolean;
  colorVariant?: string;
  curveDirection?: 'left' | 'right';
  /** R3F clock time when ECS despawn trail fade began; visual-only. */
  trailFadeOutStartElapsed?: number;
}

type BoltColorTheme = {
  primary: string;
  secondary: string;
  light: string;
};

function getBoltColorTheme(colorVariant: string | undefined, isCryoflame: boolean): BoltColorTheme {
  if (isCryoflame) return { primary: '#1e40af', secondary: '#3b82f6', light: '#60a5fa' };
  switch (colorVariant) {
    case 'arctic':
      return { primary: '#0c4a6e', secondary: '#0284c7', light: '#7dd3fc' };
    case 'blue':   return { primary: '#3b82f6', secondary: '#93c5fd', light: '#93c5fd' };
    case 'red':    return { primary: '#ef4444', secondary: '#fca5a5', light: '#fecaca' };
    case 'green':  return { primary: '#22c55e', secondary: '#86efac', light: '#bbf7d0' };
    case 'purple':
    default:       return { primary: '#9333ea', secondary: '#c084fc', light: '#e9d5ff' };
  }
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const CURVE_WIDTH = 2.125;
const FORWARD_SCALE = 12.25;
const VISUAL_DURATION = 0.675;
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
  colorVariant,
  curveDirection,
  trailFadeOutStartElapsed,
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const boltMeshRef = useRef<Mesh>(null);
  const orientRef = useRef<Group>(null);
  const coronaRef = useRef<Mesh>(null);
  const tipRingRef = useRef<Mesh>(null);
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const collisionFadeStartRef = useRef<number | null>(null);
  const [collisionTrailFadeStart, setCollisionTrailFadeStart] = useState<number | undefined>(undefined);
  const [collisionFadeDone, setCollisionFadeDone] = useState(false);
  const collisionFadeNotifiedRef = useRef(false);
  const [showImpact, setShowImpact] = useState(false);
  const [impactPosition, setImpactPosition] = useState<Vector3 | null>(null);

  const targetPosition = useRef(position.clone().add(direction.clone().multiplyScalar(FORWARD_SCALE)));
  const controlPosition = useRef<Vector3>((() => {
    const forward = direction.clone().normalize();
    const right = new Vector3().crossVectors(forward, AXIS_Y);
    if (right.lengthSq() < 1e-8) {
      right.copy(FALLBACK_UP).cross(forward);
    }
    right.normalize();

    const side = curveDirection === 'right' ? 1 : curveDirection === 'left' ? -1 : 0;
    return position
      .clone()
      .add(forward.multiplyScalar(FORWARD_SCALE * 0.5))
      .add(right.multiplyScalar(CURVE_WIDTH * side));
  })());
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

  const trailFadeStart =
    trailFadeOutStartElapsed !== undefined
      ? trailFadeOutStartElapsed
      : collisionFadeStartRef.current ?? collisionTrailFadeStart;
  const isEcsTrailFade = trailFadeOutStartElapsed !== undefined;
  const hideBoltBody =
    trailFadeOutStartElapsed !== undefined ||
    collisionFadeStartRef.current != null ||
    collisionTrailFadeStart !== undefined;

  useFrame((state, delta) => {
    if (orientRef.current && !hideBoltBody) {
      alignBoltToDirection(orientRef.current, direction);
    }

    if (!boltRef.current) return;

    if (
      trailFadeStart !== undefined &&
      trailFadeStart !== null &&
      !isEcsTrailFade &&
      !collisionFadeNotifiedRef.current &&
      state.clock.elapsedTime - trailFadeStart >= ENTROPIC_TRAIL_FADE_OUT_DURATION
    ) {
      collisionFadeNotifiedRef.current = true;
      setCollisionFadeDone(true);
    }

    if (hideBoltBody || collisionFadeDone) {
      // Position follows last ECS/prop sync; trail reads meshRef world position in its own frame.
      return;
    }

    if (hasCollided.current) return;

    timeElapsed.current += delta;
    const progress = Math.min(timeElapsed.current / VISUAL_DURATION, 1);

    const invProgress = 1 - progress;
    const idealPosition = startPosition.current
      .clone()
      .multiplyScalar(invProgress * invProgress)
      .add(controlPosition.current.clone().multiplyScalar(2 * invProgress * progress))
      .add(targetPosition.current.clone().multiplyScalar(progress * progress));

    const finalPosition = idealPosition;

    boltRef.current.position.copy(finalPosition);

    if (checkCollisions) {
      const currentPos = boltRef.current.position.clone();
      const hitSomething = checkCollisions(id, currentPos);

      if (hitSomething) {
        hasCollided.current = true;
        const tHit = state.clock.elapsedTime;
        collisionFadeStartRef.current = tHit;
        setCollisionTrailFadeStart(tHit);
        setImpactPosition(currentPos);
        setShowImpact(true);
        if (onImpact) onImpact(currentPos);
        return;
      }
    }

    if (progress >= 1) {
      if (!hasCollided.current) {
        hasCollided.current = true;
        const tHit = state.clock.elapsedTime;
        collisionFadeStartRef.current = tHit;
        setCollisionTrailFadeStart(tHit);
        setImpactPosition(targetPosition.current.clone());
        setShowImpact(true);
        if (onImpact) onImpact(targetPosition.current.clone());
      }
    }
  });



  if (!isEcsTrailFade && collisionFadeDone) {
    return null;
  }

  return (
    <group>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailColor}
        size={0.11}
        meshRef={boltRef}
        opacity={1}
        isCryoflame={isCryoflame}
        trailFadeOutStartElapsed={trailFadeStart ?? null}
        trailFadeOutDuration={ENTROPIC_TRAIL_FADE_OUT_DURATION}
      />

      <group ref={boltRef} position={position.toArray()}>
        {!hideBoltBody ? (
          <group ref={orientRef}>
            <pointLight
              color={theme.light}
              intensity={5.5}
              distance={7}
              decay={2}
              position={[0, 0.15, 0]}
            />
          </group>
        ) : null}
      </group>
    </group>
  );
}
