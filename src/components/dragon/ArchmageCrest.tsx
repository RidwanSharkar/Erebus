import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import { Shape, ExtrudeGeometry, Group, MeshStandardMaterial, SphereGeometry, DoubleSide } from 'three';
import { WeaponType, WeaponSubclass } from './weapons';

interface ArchmageCrestProps {
  position?: [number, number, number];
  scale?: number;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
}

export default function ArchmageCrest({
  position = [0, 0, 0],
  scale = 1,
  weaponType,
  weaponSubclass
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
          return { main: '#3FAEFC', emissive: '#3FAEFC', glow: '#3FAEFC', secondary: '#3FAEFC' };
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

        // Bow subclasses
        case WeaponSubclass.ELEMENTAL:
          return { main: '#17CE54', emissive: '#00CED1', glow: '#AFEEEE', secondary: '#87CEEB' };
        case WeaponSubclass.VENOM:
          return { main: '#17CC93', emissive: '#20B2AA', glow: '#87CEEB', secondary: '#48D1CC' };

        // Spear subclasses
        case WeaponSubclass.STORM:
          return { main: '#B8B8B8', emissive: '#C0C0C0', glow: '#E0E0E0', secondary: '#A8A8A8' };
        case WeaponSubclass.VALOR:
          return { main: '#A8A8A8', emissive: '#B0B0B0', glow: '#D0D0D0', secondary: '#909090' };
      }
    }

    // Fallback to weapon type colors
    switch (weaponType) {
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
      opacity: 1,
      transparent: true,
      side: DoubleSide
    }),
    bladeCore: new MeshStandardMaterial({
      color: colors.emissive,
      emissive: colors.main,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9
    }),
    bladeGlow: new MeshStandardMaterial({
      color: colors.glow,
      emissive: colors.secondary,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.6
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
    bevelEnabled: true,
    bevelThickness: 0.030,
    bevelSize: 0.035,
    bevelSegments: 1,
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

  const createWingHalf = (isLeft: boolean) => (
    <group
      ref={isLeft ? leftWingRef : rightWingRef}
      position={[isLeft ? 0.45 : -0.45, 0.15, 0.15]}
      rotation={[Math.PI / 3, 0, isLeft ? Math.PI / 1.25 : -Math.PI / 1.25]}
    >
      {/* Main blade wing - large primary blade */}
      <group
        position={[isLeft ? 1.225 : -1.225, -0.1, 0.15]}
        rotation={[
          isLeft ? Math.PI : Math.PI,
          isLeft ? Math.PI/2 + 0.375  : Math.PI/2 - 0.375,
          isLeft ? -Math.PI / 8 + 0.25 : -Math.PI / 8 + 0.25
        ]}
        scale={[0.7, 0.35, 0.35]}
      >
        <mesh geometry={geometries.blade} material={materials.bladeCore}>

        </mesh>
      </group>



    </group>
  );

  return (
    <group
      ref={groupRef}
      position={position}
      scale={[scale, scale, scale]}
    >


      {/* Left wing half */}
      {createWingHalf(true)}

      {/* Right wing half */}
      {createWingHalf(false)}

    </group>
  );
}
