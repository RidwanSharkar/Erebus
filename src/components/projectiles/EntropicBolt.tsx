import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Color,
  Quaternion,
  AdditiveBlending,
  DoubleSide,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail, { ENTROPIC_TRAIL_FADE_OUT_DURATION } from './EntropicBoltTrail';
import {
  ENTROPIC_CORE_CONE_GEO,
  ENTROPIC_GLOW_SPHERE_GEO,
  ENTROPIC_SHAFT_CYL_GEO,
  ENTROPIC_SHARD_BOX_A_GEO,
  ENTROPIC_SHARD_BOX_B_GEO,
  ENTROPIC_SHARD_CONE_GEO,
  ENTROPIC_SHARD_TETRA_GEO,
} from './sharedProjectileGeometry';
import { getEntropicColorTheme } from '@/utils/entropicColorThemes';
import {
  computeEntropicChaosOffset,
  entropicChaosSeedFromId,
} from '@/utils/entropicBoltChaos';

interface EntropicBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  isCryoflame?: boolean;
  colorVariant?: string;
  /** When true (default), position/direction follow authoritative ECS updates each frame. */
  ecsDriven?: boolean;
  /** R3F clock time when ECS despawn trail fade began; visual-only. */
  trailFadeOutStartElapsed?: number;
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const ORBIT_SPEED = 8;
const ORBIT_SHARD_ANGLES = [0, Math.PI * 2 / 3, Math.PI * 4 / 3, Math.PI] as const;
const _dir = new Vector3();
const _quat = new Quaternion();
const _flightDir = new Vector3();
const _basePos = new Vector3();
const _chaosOffset = new Vector3();
const WOBBLE_ROLL = 0.1;

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

function EntropicBolt({
  id,
  position,
  direction,
  isCryoflame = false,
  colorVariant,
  ecsDriven = true,
  trailFadeOutStartElapsed,
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const wobbleRef = useRef<Group>(null);
  const orbitRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const lastPosition = useRef(position.clone());
  const flightDirectionRef = useRef(_flightDir.copy(direction));
  const timeRef = useRef(0);
  const chaosSeed = useMemo(() => entropicChaosSeedFromId(id), [id]);

  const theme = getEntropicColorTheme(colorVariant, isCryoflame);
  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const primaryColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const secondaryColor = useMemo(() => new Color(theme.secondary), [theme.secondary]);
  const lightColor = useMemo(() => new Color(theme.light), [theme.light]);

  const boltLight = useDynamicLight({ color: theme.light, distance: 7, decay: 2, priority: 2 });

  const isTrailFading = trailFadeOutStartElapsed !== undefined;
  const hideBoltBody = isTrailFading;

  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
      lastPosition.current.copy(position);
    }
  }, [position]);

  useFrame((state, delta) => {
    if (!boltRef.current) return;

    if (isTrailFading) {
      const fadeElapsed = state.clock.elapsedTime - trailFadeOutStartElapsed!;
      if (fadeElapsed >= ENTROPIC_TRAIL_FADE_OUT_DURATION) {
        boltLight.current?.setIntensity(0);
        return;
      }
    }

    if (hideBoltBody) {
      boltLight.current?.setIntensity(0);
      return;
    }

    timeRef.current += delta;
    const pulse = 1 + Math.sin(timeRef.current * 14) * 0.06;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * ORBIT_SPEED;
    }

    if (ecsDriven) {
      _basePos.copy(position);

      flightDirectionRef.current.copy(direction);
      if (direction.lengthSq() > 1e-8) {
        lastPosition.current.copy(position);
      } else {
        const deltaPos = position.clone().sub(lastPosition.current);
        if (deltaPos.lengthSq() > 1e-8) {
          flightDirectionRef.current.copy(deltaPos.normalize());
        }
        lastPosition.current.copy(position);
      }

      computeEntropicChaosOffset(
        flightDirectionRef.current,
        timeRef.current,
        chaosSeed,
        _chaosOffset,
      );
      boltRef.current.position.copy(_basePos).add(_chaosOffset);

      const visual = boltRef.current.position;
      boltLight.current?.setPosition(visual.x, visual.y + 0.15, visual.z);
      boltLight.current?.setIntensity(5.5);

      if (orientRef.current) {
        alignBoltToDirection(orientRef.current, flightDirectionRef.current);
      }
      if (wobbleRef.current) {
        const t = timeRef.current;
        const s = chaosSeed * 17.3;
        wobbleRef.current.rotation.x = Math.sin(t * 9.1 + s) * WOBBLE_ROLL;
        wobbleRef.current.rotation.z = Math.cos(t * 7.4 + s * 1.4) * WOBBLE_ROLL;
      }
    }
  });

  return (
    <group>


      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailColor}
        size={0.07}
        meshRef={boltRef}
        opacity={1}
        isCryoflame={isCryoflame}
        flightDirectionRef={flightDirectionRef}
        trailFadeOutStartElapsed={trailFadeOutStartElapsed ?? null}
        trailFadeOutDuration={ENTROPIC_TRAIL_FADE_OUT_DURATION}
      />

      <group ref={boltRef} position={position.toArray()}>
        {!hideBoltBody ? (
          <group ref={orientRef}>
            <group ref={wobbleRef}>
            <group ref={coreRef}>
              {/* Jagged core bolt */}
              <mesh position={[0, 0.18, 0]} geometry={ENTROPIC_CORE_CONE_GEO}>
                <meshStandardMaterial
                  color={primaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={2.6}
                  transparent
                  opacity={0.94}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              {/* Fractured shaft shards */}
              <mesh position={[0.028, 0.08, 0.012]} rotation={[0.15, 0.4, 0.25]} geometry={ENTROPIC_SHARD_BOX_A_GEO}>
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={primaryColor}
                  emissiveIntensity={1.8}
                  transparent
                  opacity={0.82}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh position={[-0.022, 0.12, -0.01]} rotation={[-0.2, -0.35, 0.18]} geometry={ENTROPIC_SHARD_BOX_B_GEO}>
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={primaryColor}
                  emissiveIntensity={1.6}
                  transparent
                  opacity={0.78}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh position={[0.01, 0.22, -0.024]} rotation={[0.35, 0.1, -0.3]} geometry={ENTROPIC_SHARD_CONE_GEO}>
                <meshStandardMaterial
                  color={primaryColor}
                  emissive={lightColor}
                  emissiveIntensity={2.2}
                  transparent
                  opacity={0.75}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              {/* Outer corona shell */}
              <mesh position={[0, 0.16, 0]} geometry={ENTROPIC_SHAFT_CYL_GEO}>
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={primaryColor}
                  emissiveIntensity={1.1}
                  transparent
                  opacity={0.18}
                  blending={AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>
            </group>

            {/* Perpendicular orbiting shards */}
            <group ref={orbitRef} position={[0, 0.14, 0]}>
              {ORBIT_SHARD_ANGLES.map((angle, i) => (
                <group key={i} rotation={[0, angle, 0]}>
                  <mesh position={[0.11, 0, 0]} rotation={[0.5, 0.8, 0.3]} geometry={ENTROPIC_SHARD_TETRA_GEO}>
                    <meshStandardMaterial
                      color={i % 2 === 0 ? secondaryColor : primaryColor}
                      emissive={lightColor}
                      emissiveIntensity={2.8}
                      transparent
                      opacity={0.88}
                      blending={AdditiveBlending}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              ))}
            </group>

            {/* Tip emissive glow */}
            <mesh position={[0, 0.3, 0]} geometry={ENTROPIC_GLOW_SPHERE_GEO}>
              <meshStandardMaterial
                color={lightColor}
                emissive={lightColor}
                emissiveIntensity={4.2}
                transparent
                opacity={0.92}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            </group>
          </group>
        ) : null}
      </group>
    </group>
  );
}

export default React.memo(EntropicBolt);
