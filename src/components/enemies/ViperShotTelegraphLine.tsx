'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CircleGeometry, Group, Vector3 } from 'three';
import {
  createGroundLineCapMaterial,
  createGroundLineTelegraphBaseMaterial,
  createGroundLineTelegraphMaterial,
  GROUND_LINE_TELEGRAPH_PRESETS,
  type GroundLineTelegraphVariant,
} from '@/utils/groundLineTelegraphShader';

const DEFAULT_LINE_WIDTH = 0.35;
/** Lift above ground geometry so strips read clearly over terrain/tiles. */
const EPS_Y = 0.32;
const DEFAULT_COLOR = '#c94a3a';

export interface ViperShotTelegraphLineProps {
  /** World-space start of the strip (e.g. Viper foot XZ, ground Y). */
  start: Vector3;
  /** World-space end of the ground strip (20m horizontal in co-op Viper). */
  end: Vector3;
  /** XZ width of the box (Viper: narrow; tentacle: wide to match line hit half-width). */
  lineWidth?: number;
  color?: string;
  /** Extra lift above the ground pad (m); does not retarget start/end in XZ. */
  yOffset?: number;
  variant?: GroundLineTelegraphVariant;
  /** Unix ms when the strike/impact lands. */
  endAt?: number;
  /** Unix ms when the telegraph started (defaults to mount time). */
  startedAt?: number;
  /** Show a pulsing cap at the line origin (archon beams with length > 2m). */
  showStartCap?: boolean;
}

/**
 * Modern ground danger strip — dim full lane base plus animated charge fill on top.
 */
export default function ViperShotTelegraphLine({
  start,
  end,
  lineWidth = DEFAULT_LINE_WIDTH,
  color = DEFAULT_COLOR,
  yOffset = 0,
  variant = 'viper',
  endAt,
  startedAt,
  showStartCap = true,
}: ViperShotTelegraphLineProps) {
  const groupRef = useRef<Group>(null);
  const mountTimeRef = useRef(Date.now());
  const preset = GROUND_LINE_TELEGRAPH_PRESETS[variant];

  const { center, rotY, length, width } = useMemo(() => {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    const safeLen = len > 1e-4 ? len : 0.01;
    return {
      center: new Vector3(
        (start.x + end.x) * 0.5,
        Math.max(start.y, end.y) + EPS_Y + yOffset,
        (start.z + end.z) * 0.5
      ),
      rotY: Math.atan2(dx, dz),
      length: safeLen,
      width: lineWidth,
    };
  }, [start, end, lineWidth, yOffset]);

  const baseCoreMat = useMemo(
    () => createGroundLineTelegraphBaseMaterial(preset, color, false),
    [preset, color]
  );
  const baseGlowMat = useMemo(
    () => createGroundLineTelegraphBaseMaterial(preset, color, true),
    [preset, color]
  );
  const chargeCoreMat = useMemo(
    () => createGroundLineTelegraphMaterial(preset, color, false),
    [preset, color]
  );
  const chargeGlowMat = useMemo(
    () => createGroundLineTelegraphMaterial(preset, color, true),
    [preset, color]
  );
  const capMat = useMemo(
    () => createGroundLineCapMaterial(preset, color),
    [preset, color]
  );

  const capGeometry = useMemo(() => new CircleGeometry(0.85, 32), []);

  const showCaps = preset.showEndpointCaps;

  useFrame((_, delta) => {
    const now = Date.now();
    const startMs = startedAt ?? mountTimeRef.current;
    let progress = 0.5;
    if (endAt !== undefined && endAt > startMs) {
      progress = Math.min(1, Math.max(0, (now - startMs) / (endAt - startMs)));
    } else {
      progress = 0.45 + 0.1 * Math.sin(now * 0.004 * preset.pulseSpeed);
    }

    const pulse = 0.85 + preset.flickerAmount * Math.sin(now * 0.001 * preset.pulseSpeed * 60);
    const urgencyPulse =
      progress > 0.8 ? 1 + 0.2 * Math.sin(now * 0.012 * preset.pulseSpeed) : 1;
    const pulseValue = pulse * urgencyPulse;
    const basePulse = 0.9 + 0.1 * Math.sin(now * 0.002 * preset.pulseSpeed * 40);

    baseCoreMat.uniforms.uTime.value += delta;
    baseCoreMat.uniforms.uPulse.value = basePulse;
    baseGlowMat.uniforms.uTime.value += delta;
    baseGlowMat.uniforms.uPulse.value = basePulse;

    chargeCoreMat.uniforms.uTime.value += delta;
    chargeCoreMat.uniforms.uProgress.value = progress;
    chargeCoreMat.uniforms.uPulse.value = pulseValue;
    chargeGlowMat.uniforms.uTime.value += delta;
    chargeGlowMat.uniforms.uProgress.value = progress;
    chargeGlowMat.uniforms.uPulse.value = pulseValue;

    capMat.uniforms.uTime.value += delta;
    capMat.uniforms.uProgress.value = progress;
    capMat.uniforms.uPulse.value = pulseValue;
  });

  return (
    <group ref={groupRef} position={[center.x, center.y, center.z]} rotation={[0, rotY, 0]}>
      {/* Full-length dim lane — always visible for the whole danger zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false} material={baseGlowMat}>
        <planeGeometry args={[width * 1.12, length]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} frustumCulled={false} material={baseCoreMat}>
        <planeGeometry args={[width, length]} />
      </mesh>

      {/* Animated charge fill that grows along the lane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={3}
        frustumCulled={false}
        material={chargeGlowMat}
        scale={[1.08, 1.08, 1]}
      >
        <planeGeometry args={[width, length]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={4} frustumCulled={false} material={chargeCoreMat}>
        <planeGeometry args={[width, length]} />
      </mesh>

      {showCaps && showStartCap && (
        <mesh
          position={[0, 0.02, -length * 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={5}
          frustumCulled={false}
          geometry={capGeometry}
          material={capMat}
          scale={[0.95, 0.95, 1]}
        />
      )}
      {showCaps && (
        <mesh
          position={[0, 0.02, length * 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={5}
          frustumCulled={false}
          geometry={capGeometry}
          material={capMat}
          scale={[1.15, 1.15, 1]}
        />
      )}
    </group>
  );
}
