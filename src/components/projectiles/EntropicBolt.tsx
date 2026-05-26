import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Color,
  Quaternion,
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
  /** When true (default), position/direction follow authoritative ECS updates each frame. */
  ecsDriven?: boolean;
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
const _dir = new Vector3();
const _quat = new Quaternion();
const _flightDir = new Vector3();

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
  curveDirection: _curveDirection,
  ecsDriven = true,
  trailFadeOutStartElapsed,
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const lastPosition = useRef(position.clone());
  const flightDirectionRef = useRef(_flightDir.copy(direction));
  const collisionFadeStartRef = useRef<number | null>(null);
  const [collisionTrailFadeStart, setCollisionTrailFadeStart] = useState<number | undefined>(undefined);
  const [collisionFadeDone, setCollisionFadeDone] = useState(false);
  const collisionFadeNotifiedRef = useRef(false);

  const theme = getBoltColorTheme(colorVariant, isCryoflame);
  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);

  const trailFadeStart =
    trailFadeOutStartElapsed !== undefined
      ? trailFadeOutStartElapsed
      : collisionFadeStartRef.current ?? collisionTrailFadeStart;
  const isEcsTrailFade = trailFadeOutStartElapsed !== undefined;
  const hideBoltBody =
    trailFadeOutStartElapsed !== undefined ||
    collisionFadeStartRef.current != null ||
    collisionTrailFadeStart !== undefined;

  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
      lastPosition.current.copy(position);
    }
  }, [position]);

  useFrame((state) => {
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
      return;
    }

    if (ecsDriven) {
      boltRef.current.position.copy(position);

      flightDirectionRef.current.copy(direction);
      if (direction.lengthSq() > 1e-8) {
        lastPosition.current.copy(position);
      } else {
        const delta = position.clone().sub(lastPosition.current);
        if (delta.lengthSq() > 1e-8) {
          flightDirectionRef.current.copy(delta.normalize());
        }
        lastPosition.current.copy(position);
      }

      if (orientRef.current) {
        alignBoltToDirection(orientRef.current, flightDirectionRef.current);
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
        flightDirectionRef={flightDirectionRef}
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
