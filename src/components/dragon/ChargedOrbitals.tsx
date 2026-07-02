import { useRef, useMemo } from 'react';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { useFrame } from '@react-three/fiber';
import { Group, Color, DoubleSide, AdditiveBlending } from '@/utils/three-exports';
import { WeaponType, WeaponSubclass } from './weapons';
import React from 'react';

export interface DashChargeStatus {
  isAvailable: boolean;
  cooldownRemaining: number;
}

interface ChargedOrbitalsProps {
  parentRef: React.RefObject<Group>;
  dashCharges: Array<DashChargeStatus>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
  isCorruptedAuraActive?: boolean;
  yOffset?: number;
  customActiveColor?: string;
  customInactiveColor?: string;
  /** Per-charge recharge duration in seconds (default 8; 6.4 with Overclock). */
  rechargeDurationSec?: number;
}

const ChargedOrbitals = React.memo(({ parentRef, dashCharges, weaponType, weaponSubclass, isCorruptedAuraActive, yOffset = 0, customActiveColor, customInactiveColor = '#333333', rechargeDurationSec = 8 }: ChargedOrbitalsProps) => {
  const orbitalsRef = useRef<Group>(null);

  const activeColor = useMemo(() => {
    if (customActiveColor) {
      return customActiveColor;
    }

    // Check for corrupted aura on Runeblade first
    if (isCorruptedAuraActive && weaponType === WeaponType.RUNEBLADE) {
      return '#ff8800';
    }

    if (weaponSubclass) {
      switch (weaponSubclass) {
        // Scythe subclasses
        case WeaponSubclass.CHAOS:
          return '#7ADEFF'; //
        case WeaponSubclass.ABYSSAL:
          return '#17CE54';
        
        // Sword subclasses
        case WeaponSubclass.DIVINITY:
          return '#E8CD57';
        case WeaponSubclass.VENGEANCE:
          return '#4682B4';
        
        // Sabres subclasses
        case WeaponSubclass.FROST:
          return '#E38D80';
        case WeaponSubclass.ASSASSIN:
          return '#FF544E';
        
        // Runeblade subclasses
        case WeaponSubclass.ARCANE:
          return '#E8CD57';
        case WeaponSubclass.NATURE:
          return '#00AA44';

        // Bow subclasses
        case WeaponSubclass.ELEMENTAL:
          return '#FFC278';
        case WeaponSubclass.VENOM:
          return '#17CC93';
      }
    }
    
    // Fallback to weapon type colors
    switch (weaponType) {
      case WeaponType.NONE:
        return '#9370DB';
      case WeaponType.SCYTHE:
        return '#17CE54';
      case WeaponType.SWORD:
        return '#87CEEB';
      case WeaponType.SABRES:
        return '#FF544E';
      case WeaponType.RUNEBLADE:
        return '#00FF88';
      case WeaponType.BOW:
        return '#3A905E';
      case WeaponType.SPEAR:
        return '#E8CD57'; // Light blue/teal for Spear
    }
  }, [customActiveColor, isCorruptedAuraActive, weaponType, weaponSubclass]);

  const activeColorObj = useMemo(() => new Color(activeColor), [activeColor]);
  const inactiveColorObj = useMemo(() => new Color(customInactiveColor), [customInactiveColor]);

  const centralLightIntensity = useMemo(() => {
    return dashCharges.reduce((sum, charge) => {
      const isAvailable = charge.isAvailable;
      const rechargeProgress = isAvailable || rechargeDurationSec <= 0
        ? 1
        : Math.max(0, Math.min(1, 1 - charge.cooldownRemaining / rechargeDurationSec));
      return sum + (isAvailable ? 1 : 0.1 + rechargeProgress * 0.9);
    }, 0);
  }, [dashCharges, rechargeDurationSec]);

  const centralLightColor = centralLightIntensity > dashCharges.length * 0.5
    ? activeColor
    : customInactiveColor;

  useFrame(({ clock }) => {
    if (!orbitalsRef.current || !parentRef.current) return;
    
    const time = clock.getElapsedTime();
    
    // Position orbitals around the parent in a normal circular orbit
    orbitalsRef.current.children.forEach((orbital, index) => {
      const angle = (index / dashCharges.length) * Math.PI * 2 + time * 1;
      const radius = 0.627; // Fixed radius for circular orbit
      const height = -0.65; // Fixed height above parent
      
      orbital.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      
      // Add some rotation to each orbital
      orbital.rotation.x = time * 2 + index;
      orbital.rotation.y = time * 1.5 + index * 0.7;
    });
    
    // Position the entire orbital group relative to parent
    orbitalsRef.current.position.copy(parentRef.current.position);
    orbitalsRef.current.position.y += yOffset;
  });

  return (
    <group ref={orbitalsRef}>
      <PooledEffectLight
        position={[0, -0.65, 0]}
        color={centralLightColor}
        intensity={centralLightIntensity}
        distance={2.3}
        decay={3}
      />
      {dashCharges.map((charge, index) => {
        const isAvailable = charge.isAvailable;
        const rechargeProgress = isAvailable || rechargeDurationSec <= 0
          ? 1
          : Math.max(0, Math.min(1, 1 - charge.cooldownRemaining / rechargeDurationSec));
        const emissiveIntensity = isAvailable ? 0.3 : 0.1 + rechargeProgress * 0.2;
        const outerEmissiveIntensity = isAvailable ? 0.5 : 0.1 + rechargeProgress * 0.4;
        const opacity = isAvailable ? 0.8 : 0.4 + rechargeProgress * 0.4;
        const outerOpacity = isAvailable ? 0.4 : 0.15 + rechargeProgress * 0.25;
        const meshColor = isAvailable ? activeColorObj : inactiveColorObj;
        
        return (
          <group key={index}>
            <mesh>
              <sphereGeometry args={[0.1025, 8, 8]} />
              <meshStandardMaterial
                color={meshColor}
                emissive={meshColor}
                emissiveIntensity={emissiveIntensity}
                transparent
                opacity={opacity}
              />
            </mesh>

            <mesh>
              <sphereGeometry args={[0.10*1.225, 16, 16]} />
              <meshStandardMaterial
                color={isAvailable ? activeColor : customInactiveColor}
                emissive={isAvailable ? activeColor : customInactiveColor}
                emissiveIntensity={outerEmissiveIntensity}
                transparent
                opacity={outerOpacity}
                depthWrite={false}
                side={DoubleSide}
                blending={AdditiveBlending}
              />
            </mesh>

          </group>
        );
      })}
    </group>
  );
});

ChargedOrbitals.displayName = 'ChargedOrbitals';

export default ChargedOrbitals;
