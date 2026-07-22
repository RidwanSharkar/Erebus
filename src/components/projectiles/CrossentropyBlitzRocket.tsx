import React, { useRef, useMemo } from 'react';
import { AdditiveBlending, ConeGeometry, CylinderGeometry } from '@/utils/three-exports';
import { Mesh, Vector3, Color, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { CrossentropyVisualTheme } from '@/utils/talents';
import BlitzFireTrail from './BlitzFireTrail';

const ROCKET_SCALE = 2.1;
const ROCKET_BODY_GEO = new CylinderGeometry(0.08, 0.14, 0.55, 8);
const ROCKET_NOSE_GEO = new ConeGeometry(0.14, 0.28, 8);

interface CrossentropyBlitzRocketProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  visualTheme?: CrossentropyVisualTheme;
  reaperEcsDriven?: boolean;
}

function themeColors(theme: CrossentropyVisualTheme, reaper: boolean) {
  if (reaper) {
    return {
      body: '#6B2FA0',
      emissive: '#B866FF',
      trail: new Color('#9944FF'),
      light: new Color('#AA55FF'),
    };
  }
  if (theme === 'inferno') {
    return {
      body: '#CC2200',
      emissive: '#FF4400',
      trail: new Color('#FF3300'),
      light: new Color('#FF5500'),
    };
  }
  if (theme === 'glacial') {
    return {
      body: '#0a4a8a',
      emissive: '#40a0f0',
      trail: new Color('#1188DD'),
      light: new Color('#66CCFF'),
    };
  }
  if (theme === 'tempest') {
    return {
      body: '#1E6EEB',
      emissive: '#88DDFF',
      trail: new Color('#44AAFF'),
      light: new Color('#66BBFF'),
    };
  }
  if (theme === 'plague') {
    return {
      body: '#1E8B4A',
      emissive: '#66FFAA',
      trail: new Color('#44FF88'),
      light: new Color('#55FF99'),
    };
  }
  return {
    body: '#CC3300',
    emissive: '#FF6600',
    trail: new Color('#FF4500'),
    light: new Color('#FF5500'),
  };
}

export default function CrossentropyBlitzRocket({
  position,
  direction,
  visualTheme = 'default',
  reaperEcsDriven = false,
}: CrossentropyBlitzRocketProps) {
  const outerGroupRef = useRef<Group>(null);
  const rocketGroupRef = useRef<Group>(null);
  const exhaustRef = useRef<Mesh>(null);
  const currentPosition = useRef(position.clone());
  const directionRef = useRef(direction.clone());
  const time = useRef(0);

  const _scratchRight = useRef(new Vector3());
  const _scratchUp = useRef(new Vector3());
  const _scratchFwd = useRef(new Vector3());

  const { body, emissive, trail, light } = useMemo(
    () => themeColors(visualTheme, reaperEcsDriven),
    [visualTheme, reaperEcsDriven],
  );

  const rocketLight = useDynamicLight({ color: light, distance: 10, priority: 2 });

  useFrame((_, delta) => {
    if (!outerGroupRef.current || !rocketGroupRef.current) return;
    time.current += delta;
    currentPosition.current.copy(position);
    directionRef.current.copy(direction);

    const pos = currentPosition.current;
    outerGroupRef.current.position.copy(pos);

    _scratchFwd.current.copy(direction).normalize();
    _scratchUp.current.set(0, 1, 0);
    _scratchRight.current.crossVectors(_scratchUp.current, _scratchFwd.current).normalize();
    _scratchUp.current.crossVectors(_scratchFwd.current, _scratchRight.current).normalize();
    rocketGroupRef.current.lookAt(
      pos.x + _scratchFwd.current.x,
      pos.y + _scratchFwd.current.y,
      pos.z + _scratchFwd.current.z,
    );
    rocketGroupRef.current.rotateX(Math.PI / 2);

    const pulse = 0.85 + Math.sin(time.current * 24) * 0.15;
    if (exhaustRef.current) {
      exhaustRef.current.scale.set(1, 0.6 + pulse * 0.5, 1);
    }

    rocketLight.current?.setPosition(pos.x, pos.y, pos.z);
    rocketLight.current?.setIntensity(4.5);
  });

  return (
    <>
      <BlitzFireTrail
        worldPositionRef={currentPosition}
        directionRef={directionRef}
        visualTheme={visualTheme}
        reaperPurple={reaperEcsDriven}
      />
      <group ref={outerGroupRef}>
        <group ref={rocketGroupRef} scale={[ROCKET_SCALE, ROCKET_SCALE, ROCKET_SCALE]}>
        <mesh geometry={ROCKET_BODY_GEO} position={[0, -0.08, 0]}>
          <meshStandardMaterial
            color={body}
            emissive={emissive}
            emissiveIntensity={2.2}
            transparent
            opacity={0.92}
          />
        </mesh>
        <mesh geometry={ROCKET_NOSE_GEO} position={[0, 0.36, 1]}>
          <meshStandardMaterial
            color={body}
            emissive={emissive}
            emissiveIntensity={2.5}
            transparent
            opacity={0.95}
          />
        </mesh>
        <mesh ref={exhaustRef} position={[0, -0.42, 0]}>
          <coneGeometry args={[0.12, 0.42, 6]} />
          <meshStandardMaterial
            color={trail.getHexString()}
            emissive={emissive}
            emissiveIntensity={3}
            transparent
            opacity={0.75}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, -0.65, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.072, 0.6, 6]} />
          <meshStandardMaterial
            color={trail.getHexString()}
            emissive={emissive}
            emissiveIntensity={2}
            transparent
            opacity={0.55}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        </group>
      </group>
    </>
  );
}
