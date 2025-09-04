import { useRef, useMemo } from 'react';
import { Group, Vector3 } from 'three';
import React from 'react';

import BonePlate from './BonePlate';
import BoneTail from './BoneTail';
import BoneWings from './BoneWings';
import { DragonHorns } from './DragonHorns';
import GhostTrail from './GhostTrail';
import ChargedOrbitals, { DashChargeStatus } from './ChargedOrbitals';
import BoneVortex from './BoneVortex';
import BoneAura from './BoneAura';
import { WeaponType, WeaponSubclass } from './weapons';
import EtherealBow from '../weapons/EtherBow';
import Scythe from '../weapons/Scythe';
import Sword from '../weapons/Sword';
import Sabres from '../weapons/Sabres';
import DivineStorm from '../weapons/DivineStorm';
import Reanimate, { ReanimateRef } from '../weapons/Reanimate';

interface DragonUnitProps {
  position?: Vector3;
  movementDirection?: Vector3;
  isDashing?: boolean;
  dashCharges?: Array<DashChargeStatus>;
  chargeDirection?: Vector3;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  isSpinning?: boolean;
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onSabresLeftSwingStart?: () => void;
  onSabresRightSwingStart?: () => void;
  swordComboStep?: 1 | 2 | 3;
  isDivineStorming?: boolean;
  isSwordCharging?: boolean;
  isDeflecting?: boolean;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  onHit?: (targetId: string, damage: number) => void;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  // Reanimate ability props
  reanimateRef?: React.RefObject<ReanimateRef>;
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
}

export default function DragonUnit({ 
  position = new Vector3(0, 0, 0),
  movementDirection = new Vector3(0, 0, 0),
  isDashing = false,
  dashCharges = [
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 }
  ],
  chargeDirection,
  currentWeapon = WeaponType.BOW,
  currentSubclass = WeaponSubclass.ELEMENTAL,
  isCharging = false,
  chargeProgress = 0,
  isSwinging = false,
  isSpinning = false,
  onBowRelease = () => {},
  onScytheSwingComplete = () => {},
  onSwordSwingComplete = () => {},
  onSabresSwingComplete = () => {},
  onSabresLeftSwingStart = () => {},
  onSabresRightSwingStart = () => {},
  swordComboStep = 1,
  isDivineStorming = false,
  isSwordCharging = false,
  isDeflecting = false,
  onChargeComplete = () => {},
  onDeflectComplete = () => {},
  enemyData = [],
  onHit = () => {},
  setDamageNumbers = () => {},
  nextDamageNumberId = { current: 0 },
  playerPosition,
  playerRotation = new Vector3(0, 0, 0),
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  reanimateRef,
  setActiveEffects = () => {}
}: DragonUnitProps) {
  
  const groupRef = useRef<Group>(null);

  // Weapon rendering logic
  const renderWeapon = () => {
    if (currentWeapon === WeaponType.BOW) {
      return (
        <EtherealBow
          position={position}
          direction={movementDirection}
          chargeProgress={chargeProgress}
          isCharging={isCharging}
          onRelease={onBowRelease}
          currentSubclass={currentSubclass}
          hasInstantPowershot={false}
          isAbilityBowAnimation={false}
          isViperStingCharging={isViperStingCharging}
          viperStingChargeProgress={viperStingChargeProgress}
          isBarrageCharging={isBarrageCharging}
          barrageChargeProgress={barrageChargeProgress}
          isCobraShotCharging={isCobraShotCharging}
          cobraShotChargeProgress={cobraShotChargeProgress}
        />
      );
    } else if (currentWeapon === WeaponType.SCYTHE) {
      return (
        <Scythe
          parentRef={groupRef}
          currentSubclass={currentSubclass}
          level={1}
          isEmpowered={false}
          isSpinning={isSpinning}
        />
      );
    } else if (currentWeapon === WeaponType.SWORD) {
      return (
        <Sword
          isSwinging={isSwinging}
          isSmiting={false}
          isOathstriking={false}
          isDivineStorming={isDivineStorming}
          isColossusStriking={false}
          isCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          chargeDirectionProp={chargeDirection}
          onSwingComplete={onSwordSwingComplete}
          onSmiteComplete={() => {}}
          onOathstrikeComplete={() => {}}
          onDivineStormComplete={() => {}}
          onColossusStrikeComplete={() => {}}
          onChargeComplete={onChargeComplete}
          onDeflectComplete={onDeflectComplete}
          hasChainLightning={false}
          comboStep={swordComboStep}
          currentSubclass={currentSubclass}
          enemyData={enemyData}
          onHit={onHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          setActiveEffects={setActiveEffects}
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          dragonGroupRef={groupRef}
        />
      );
    } else if (currentWeapon === WeaponType.SABRES) {
      return (
        <Sabres
          isSwinging={isSwinging}
          onSwingComplete={onSabresSwingComplete || (() => {})}
          onLeftSwingStart={onSabresLeftSwingStart || (() => {})}
          onRightSwingStart={onSabresRightSwingStart || (() => {})}
          isCharging={isCharging}
          subclass={currentSubclass}
        />
      );
    }
    return null;
  };

  // Memoize components for performance optimization
  const bonePlate = useMemo(() => (
    <group scale={[0.8, 0.55, 0.8]} position={[0, 0.04, -0.015]} rotation={[0.4, 0, 0]}>
      <BonePlate />
    </group>
  ), []);

  const boneTail = useMemo(() => (
    <group scale={[0.85, 0.85, 0.85]} position={[0, 0.05, +0.1]}>
      <BoneTail movementDirection={movementDirection} />
    </group>
  ), [movementDirection]);

  const leftHorn = useMemo(() => (
    <group scale={[0.235, 0.335, 0.235]} position={[-0.05, 0.215, 0.35]} rotation={[+0.15, 0, -5]}>
      <DragonHorns isLeft={true} />
    </group>
  ), []);

  const rightHorn = useMemo(() => (
    <group scale={[0.235, 0.335, 0.235]} position={[0.05, 0.215, 0.35]} rotation={[+0.15, 0, 5]}>
      <DragonHorns isLeft={false} />
    </group>
  ), []);

  const wings = useMemo(() => (
    <group position={[0, 0.2, -0.15]}>
      {/* Left Wing */}
      <group rotation={[0, Math.PI / 5.5, 0]}>
        <BoneWings 
          isLeftWing={true}
          parentRef={groupRef}
          isDashing={isDashing}
        />
      </group>
      
      {/* Right Wing */}
      <group rotation={[0, -Math.PI / 5.5, 0]}>
        <BoneWings 
          isLeftWing={false}
          parentRef={groupRef}
          isDashing={isDashing}
        />
      </group>
    </group>
  ), [isDashing]);

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.2, position.z]}>
      {/* DRAGON HORNS */}
      {leftHorn}
      {rightHorn}

      {/* BONE PLATE (TORSO) */}
      {bonePlate}

      {/* BONE TAIL */}
      {boneTail}

      {/* WINGS */}
      {wings}

      {/* CHARGED ORBITALS */}
      <ChargedOrbitals 
        parentRef={groupRef} 
        dashCharges={dashCharges}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
      />

      {/* BONE AURA */}
      <BoneAura 
        parentRef={groupRef}
      />

      {/* WEAPON */}
      {renderWeapon()}

      {/* DIVINE STORM ABILITY */}
      {isDivineStorming && currentWeapon === WeaponType.SWORD && (
        <DivineStorm
          position={position}
          onComplete={() => {}}
          parentRef={groupRef}
          isActive={isDivineStorming}
          enemyData={enemyData}
          onHitTarget={(targetId, damage, isCritical, position, isDivineStorm) => {
            onHit?.(targetId, damage);
            if (setDamageNumbers && nextDamageNumberId) {
              setDamageNumbers(prev => [...prev, {
                id: nextDamageNumberId.current++,
                damage,
                position: position.clone(),
                isCritical,
                isDivineStorm
              }]);
            }
          }}
        />
      )}

      {/* REANIMATE ABILITY */}
      {currentWeapon === WeaponType.SCYTHE && (
        <Reanimate
          parentRef={groupRef}
          ref={reanimateRef}
        />
      )}

    </group>
  );
}
