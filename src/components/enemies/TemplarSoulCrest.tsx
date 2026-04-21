'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import { Shape, ExtrudeGeometry, Group, MeshStandardMaterial, DoubleSide } from 'three';
import {
  mirrorWingEuler,
  type WingEuler,
  type WingRotationSpec,
} from '@/components/dragon/ArchmageCrest';

function addEuler(a: WingEuler, b: WingEuler): WingEuler {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

const TEMPLAR_CREST_COLORS = {
  main: '#c41e3a',
  emissive: '#ff2a3c',
} as const;

interface TemplarSoulCrestProps {
  position?: [number, number, number];
  scale?: number;
  wingSpread?: number;
  rotation?: WingEuler;
  leftWing?: WingRotationSpec;
  rightWing?: WingRotationSpec;
  mirrorRightWingFromLeft?: boolean;
}

export default function TemplarSoulCrest({
  position = [0, 2.35, 0],
  scale = -0.58,
  wingSpread = 1,
  rotation = [0, 0, 0],
  leftWing,
  rightWing,
  mirrorRightWingFromLeft = false,
}: TemplarSoulCrestProps) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const materials = useMemo(
    () => ({
      bladeCore: new MeshStandardMaterial({
        color: TEMPLAR_CREST_COLORS.emissive,
        emissive: TEMPLAR_CREST_COLORS.main,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.88,
        side: DoubleSide,
      }),
    }),
    []
  );

  // Templar variant: slightly longer tip, sharper inner sweep vs ArchmageCrest
  const bladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.38, -0.145);
    shape.bezierCurveTo(0.72, 0.18, 1.22, 0.46, 1.72, 0.52);
    shape.lineTo(1.18, 0.78);
    shape.bezierCurveTo(0.48, 0.22, 0.2, -0.04, 0.12, 0.62);
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const bladeExtrudeSettings = useMemo(
    () => ({
      steps: 1,
      depth: 0.0001,
      bevelEnabled: true,
      bevelThickness: 0.026,
      bevelSize: 0.032,
      bevelSegments: 1,
      curveSegments: 16,
    }),
    []
  );

  const geometries = useMemo(
    () => ({
      blade: new ExtrudeGeometry(bladeShape, bladeExtrudeSettings),
    }),
    [bladeShape, bladeExtrudeSettings]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phaseOffset;
    if (!groupRef.current || !leftWingRef.current || !rightWingRef.current) return;

    groupRef.current.position.y = Math.sin(t * 1.25) * 0.032;
    groupRef.current.rotation.y = Math.sin(t * 0.42) * 0.085;

    const pulse = 1 + Math.sin(t * 2.2) * 0.045;
    leftWingRef.current.scale.setScalar(pulse);
    rightWingRef.current.scale.setScalar(pulse);
  });

  const zero: WingEuler = [0, 0, 0];
  const leftAnchorOff = leftWing?.anchor ?? zero;
  const leftBladeOff = leftWing?.blade ?? zero;

  let rightAnchorOff = rightWing?.anchor ?? zero;
  let rightBladeOff = rightWing?.blade ?? zero;
  if (mirrorRightWingFromLeft && leftWing && rightWing === undefined) {
    rightAnchorOff = mirrorWingEuler(leftAnchorOff);
    rightBladeOff = mirrorWingEuler(leftBladeOff);
  }

  const baseLeftAnchor: WingEuler = [Math.PI / 3.5, 0, Math.PI / 1.25];
  const baseRightAnchor: WingEuler = [Math.PI / 3.5, 0, -Math.PI / 1.25];
  const baseLeftBlade: WingEuler = [Math.PI, Math.PI / 1.85 + 0.375, -Math.PI / 8 + 0.25];
  const baseRightBlade: WingEuler = [Math.PI, Math.PI / 2.15 - 0.375, -Math.PI / 8 + 0.25];

  const createWingHalf = (isLeft: boolean) => {
    const anchorOff = isLeft ? leftAnchorOff : rightAnchorOff;
    const bladeOff = isLeft ? leftBladeOff : rightBladeOff;
    const anchorRot = addEuler(isLeft ? baseLeftAnchor : baseRightAnchor, anchorOff);
    const bladeRot = addEuler(isLeft ? baseLeftBlade : baseRightBlade, bladeOff);

    return (
      <group
        ref={isLeft ? leftWingRef : rightWingRef}
        position={[isLeft ? 0.25 * wingSpread : -0.25 * wingSpread, 0.675, 0.155]}
        rotation={anchorRot}
      >
        <group
          position={[isLeft ? 1.125 * wingSpread : -1.125 * wingSpread, -0.1, 0.15]}
          rotation={bladeRot}
          scale={[0.75, 0.375, 0.375]}
        >
          <mesh geometry={geometries.blade} material={materials.bladeCore} />
        </group>
      </group>
    );
  };

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <group ref={groupRef}>
        {createWingHalf(true)}
        {createWingHalf(false)}
      </group>
    </group>
  );
}
