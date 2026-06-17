import { useFrame } from '@react-three/fiber';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { useRef, useMemo } from 'react';
import { Shape, ExtrudeGeometry, Group, MeshStandardMaterial, SphereGeometry, DoubleSide } from 'three';
import { WeaponType, WeaponSubclass } from './weapons';

/** Euler [x, y, z] in radians */
export type WingEuler = [number, number, number];

export interface WingRotationSpec {
  /** Added to the shoulder / wing anchor group base rotation */
  anchor?: WingEuler;
  /** Added to the inner blade group base rotation */
  blade?: WingEuler;
}

/** Mirror an Euler offset across the character sagittal plane (flip X and Z, keep Y). */
export function mirrorWingEuler(e: WingEuler): WingEuler {
  return [-e[0], e[1], -e[2]];
}

function addEuler(a: WingEuler, b: WingEuler): WingEuler {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

interface ArchmageCrestProps {
  position?: [number, number, number];
  scale?: number;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
  /** Multiplier for horizontal wing separation (>1 pushes blades further apart). */
  wingSpread?: number;
  /** Root Euler rotation in radians [x, y, z]; offsets the whole crest from default orientation. */
  rotation?: WingEuler;
  /** Extra rotation for the left wing (anchor + blade groups). */
  leftWing?: WingRotationSpec;
  /** Extra rotation for the right wing. If omitted and `mirrorRightWingFromLeft` is true, derived from `leftWing`. */
  rightWing?: WingRotationSpec;
  /** When true and `rightWing` is omitted, right anchor/blade offsets mirror `leftWing` across X/Z flip. */
  mirrorRightWingFromLeft?: boolean;
}

export default function ArchmageCrest({
  position = [0, 0, 0],
  scale = 1,
  weaponType,
  weaponSubclass,
  wingSpread = 1,
  rotation = [0, 0, 0],
  leftWing,
  rightWing,
  mirrorRightWingFromLeft = false
}: ArchmageCrestProps) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);

  // Get color based on weapon type/subclass (matching GhostTrail)
  const getCrestColor = () => {
    if (weaponSubclass) {
      switch (weaponSubclass) {
        // Scythe subclasses
        case WeaponSubclass.CHAOS:
          return { main: '#3EB0FC', emissive: '#87CEEB', glow: '#E0F6FF', secondary: '#A5F3FC' };
        case WeaponSubclass.ABYSSAL:
          return { main: '#17CE54', emissive: '#4A90E2', glow: '#A5F3FC', secondary: '#87CEEB' };

        // Sword subclasses
        case WeaponSubclass.DIVINITY:
          return { main: '#3FD3FC', emissive: '#87CEEB', glow: '#E0F6FF', secondary: '#B0E0E6' };
        case WeaponSubclass.VENGEANCE:
          return { main: '#4682B4', emissive: '#5F9EA0', glow: '#B0E0E6', secondary: '#87CEEB' };

        // Sabres subclasses
        case WeaponSubclass.FROST:
          return { main: '#FF544E', emissive: '#FF6B6B', glow: '#FFB3B3', secondary: '#FF9999' };
        case WeaponSubclass.ASSASSIN:
          return { main: '#FF544E', emissive: '#FF6B6B', glow: '#FFB3B3', secondary: '#FF9999' };

        // Runeblade subclasses
        case WeaponSubclass.ARCANE:
          return { main: '#E8CD57', emissive: '#E8CD57', glow: '#E8CD57', secondary: '#B0E0E6' };
        case WeaponSubclass.NATURE:
          return { main: '#00FF88', emissive: '#32CD32', glow: '#90EE90', secondary: '#66CDAA' };

          case WeaponSubclass.ELEMENTAL:
            return { main: '#F2992D', emissive: '#FFC278', glow: '#FFC278', secondary: '#FFC278' };
          case WeaponSubclass.VENOM:
            return { main: '#17CC93', emissive: '#20B2AA', glow: '#87CEEB', secondary: '#48D1CC' };
        // Spear subclasses
        case WeaponSubclass.STORM:
          return { main: '#E8CD57', emissive: '#E8CD57', glow: '#E8CD57', secondary: '#B0E0E6' };
        case WeaponSubclass.VALOR:
          return { main: '#A8A8A8', emissive: '#B0B0B0', glow: '#D0D0D0', secondary: '#909090' };
      }
    }

    // Fallback to weapon type colors
    switch (weaponType) {
      case WeaponType.NONE:
        return { main: '#8A2BE2', emissive: '#9370DB', glow: '#DA70D6', secondary: '#BA55D3' };
      case WeaponType.SCYTHE:
        return { main: '#17CE54', emissive: '#00CED1', glow: '#AFEEEE', secondary: '#87CEEB' };
      case WeaponType.SWORD:
        return { main: '#6DFF9E', emissive: '#87CEEB', glow: '#E0F6FF', secondary: '#B0E0E6' };
      case WeaponType.SABRES:
        return { main: '#FF544E', emissive: '#FF6B6B', glow: '#FFB3B3', secondary: '#FF9999' };
      case WeaponType.RUNEBLADE:
        return { main: '#00FF88', emissive: '#32CD32', glow: '#90EE90', secondary: '#66CDAA' };
      case WeaponType.BOW:
        return { main: '#3A905E', emissive: '#228B22', glow: '#32CD32', secondary: '#00FF7F' };
      case WeaponType.SPEAR:
        return { main: '#C0C0C0', emissive: '#C0C0C0', glow: '#E0E0E0', secondary: '#A8A8A8' };
    }

    return { main: '#8A2BE2', emissive: '#9370DB', glow: '#DA70D6', secondary: '#BA55D3' }; // Default purple
  };

  const colors = getCrestColor();

  // Cached materials for performance - weapon themed
  const materials = useMemo(() => ({
    blade: new MeshStandardMaterial({
      color: colors.main,
      emissive: colors.emissive,
      emissiveIntensity: 1.3,
      metalness: 0.8,
      roughness: 0.1,
      opacity: 0.825,
      transparent: true,
      side: DoubleSide
    }),
    bladeCore: new MeshStandardMaterial({
      color: colors.emissive,
      emissive: colors.main,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.825
    }),
    bladeGlow: new MeshStandardMaterial({
      color: colors.glow,
      emissive: colors.secondary,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.825
    })
  }), [colors]);

  // Blade shape matching Abomination's design
  const bladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(
      0.8, 0.22,
      1.33, 0.5,
      1.6, 0.515
    );
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(
      0.5, 0.2,
      0.225, 0.0,
      0.1, 0.7
    );
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const bladeExtrudeSettings = useMemo(() => ({
    steps: 1,
    depth: 0.00010,
    bevelEnabled: false,
    curveSegments: 16
  }), []);

  // Cached geometries
  const geometries = useMemo(() => ({
    blade: new ExtrudeGeometry(bladeShape, bladeExtrudeSettings),
    centerCore: new SphereGeometry(0.12, 12, 12),
    energyWisp: new SphereGeometry(0.04, 6, 6)
  }), [bladeShape, bladeExtrudeSettings]);

  // Animation - disabled for static appearance
  useFrame((state) => {
    if (!groupRef.current || !leftWingRef.current || !rightWingRef.current) return;

    // All animations disabled for static appearance
    // const time = state.clock.getElapsedTime();

    // Gentle floating motion - disabled
    // groupRef.current.position.y = position[1] + Math.sin(time * 1.2) * 0.05;

    // Subtle rotation - disabled
    // groupRef.current.rotation.y = Math.sin(time * 0.8) * 0.1;

    // Wing pulsing animation - disabled
    // const pulseScale = 1 + Math.sin(time * 2) * 0.08;
    // leftWingRef.current.scale.setScalar(pulseScale);
    // rightWingRef.current.scale.setScalar(pulseScale);

    // Wing slight oscillation - disabled
    // leftWingRef.current.rotation.z = Math.sin(time * 1.5) * 0.05;
    // rightWingRef.current.rotation.z = -Math.sin(time * 1.5) * 0.05;
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
        <PooledEffectLight color={colors.glow} intensity={0.5} position={[0, -1, 0]} />
      </group>
    );
  };

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
    >


      {/* Left wing half */}
      {createWingHalf(true)}

      {/* Right wing half */}
      {createWingHalf(false)}

    </group>
  );
}
