'use client';

import React, { useMemo } from 'react';
import { Vector3 } from 'three';
import { DoubleSide } from 'three';

const DEFAULT_LINE_WIDTH = 0.35;
const LINE_THICK = 0.04;
const EPS_Y = 0.03;
const DEFAULT_COLOR = '#c94a3a';
const OPACITY = 0.62;

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
}

/**
 * Red flat strip on the ground — matches co-op Viper 20m shot danger zone in XZ.
 */
export default function ViperShotTelegraphLine({
  start,
  end,
  lineWidth = DEFAULT_LINE_WIDTH,
  color = DEFAULT_COLOR,
  yOffset = 0,
}: ViperShotTelegraphLineProps) {
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

  return (
    <mesh
      position={[center.x, center.y, center.z]}
      rotation={[0, rotY, 0]}
      renderOrder={2}
      frustumCulled={false}
    >
      <boxGeometry args={[width, LINE_THICK, length]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={OPACITY}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
