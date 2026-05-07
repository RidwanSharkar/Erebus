import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import React from 'react';
import { useFrame } from '@react-three/fiber';
import BonePlate from './BonePlate';
import BoneWings from './BoneWings';
import AscendantBoneWings from './AscendantBoneWings';
import { DragonHorns } from './DragonHorns';
import ChargedOrbitals, { DashChargeStatus } from './ChargedOrbitals';
import BoneAura from './BoneAura';
import { WeaponType, WeaponSubclass } from './weapons';
import DraconicWingJets from './DraconicWingJets';
import EtherealBow from '../weapons/EtherBow';
import Scythe from '../weapons/Scythe';
import Sword from '../weapons/Sword';
import Sabres from '../weapons/Sabres';
import VorpalGustVfx from '../weapons/VorpalGustVfx';
import Runeblade from '../weapons/Runeblade';
import SpearComponent from '../weapons/Spear';
import Reanimate, { ReanimateRef } from '../weapons/Reanimate';
import BoneTail from './BoneTail';
import ArchmageCrest from './ArchmageCrest';
import SpellCastingAura from '../weapons/SpellCastingAura';
import SpellCastingHalos from '../weapons/SpellCastingHalos';
import DeflectShield from '../weapons/DeflectShield';
import type { VorpalGustStabBoonBeamTheme } from '@/utils/talents';

interface DragonUnitProps {
  position?: Vector3;
  movementDirection?: Vector3;
  isDashing?: boolean;
  entityId?: number; // Player's entity ID
  dashCharges?: Array<DashChargeStatus>;
  chargeDirection?: Vector3;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  isSpinning?: boolean;
  purchasedItems?: string[]; // Purchased cosmetic items
  /** Co-op / progression level — crest gains an outer layer at 2+. */
  playerLevel?: number;
  /** STORED CHARGE talent — Runeblade Charge spin + damage. */
  runebladeStoredCharge?: boolean;
  /** Local: Windfury proc + Flurry heal after Runeblade LMB swing resolves hits. */
  onRunebladePrimaryHits?: (enemiesHit: number) => void;
  /** Local: live combo step from ControlSystem for Runeblade swings. */
  runebladeComboStepResolver?: () => 1 | 2 | 3;
  /** Local: EXECUTIONER additive base damage (consumed in Runeblade performSwingDamage). */
  getRunebladeExecutionerFlatBonus?: () => number;
  /** Local: Crusader talent — flat additive LMB damage while buff is active. */
  getRunebladeCrusaderLmbFlatBonus?: () => number;
  /** Local: Crusader — corrupted palette on Runeblade meshes (F aura VFX separate). */
  crusaderBladeThemeActive?: boolean;
  /** Local: Blizzard talent — storm visibility from ControlSystem (omit when talent not taken). */
  getRunebladeBlizzardTalentActive?: () => boolean;
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onRunebladeSwingComplete?: () => void;
  onSpearSwingComplete?: () => void;
  onSabresLeftSwingStart?: () => void;
  onSabresRightSwingStart?: () => void;
  onBackstabComplete?: () => void;
  onSunderComplete?: () => void;
  swordComboStep?: 1 | 2 | 3;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  showVorpalGustBeam?: boolean;
  vorpalGustStabBoonBeamTheme?: VorpalGustStabBoonBeamTheme;
  isSundering?: boolean;
  isStealthing?: boolean;
  isInvisible?: boolean;
  isSwordCharging?: boolean;
  isDeflecting?: boolean;
  deflectShieldActive?: boolean;
  deflectShieldDurationSec?: number;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth?: number;
    isBoss?: boolean;
  }>;
  mushroomTargets?: Array<{ index: number; position: Vector3 }>;
  onMushroomHit?: (index: number, baseDamage: number) => void;
  onHit?: (
    targetId: string,
    damage: number,
    isCritical?: boolean,
    position?: Vector3,
    isBlizzard?: boolean,
    viperPhase?: 'forward' | 'return' | 'explosion',
  ) => void;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  realTimePositionRef?: React.RefObject<Vector3>;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  /** Scythe Crossentropy — charge phase (HUD / remote sync). */
  isCrossentropyCharging?: boolean;
  /** Scythe Mantra — Summon Totem charge (HUD / remote sync). */
  isSummonTotemCharging?: boolean;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  /** Tempest Rounds: monotonic per-arrow id for EtherBow muzzle VFX. */
  tempestBurstShotSeq?: number;
  isRejuvenatingShotCharging?: boolean;
  rejuvenatingShotChargeProgress?: number;
  isWhirlwindCharging?: boolean;
  whirlwindChargeProgress?: number;
  isWhirlwinding?: boolean;
  isThrowSpearCharging?: boolean;
  throwSpearChargeProgress?: number;
  isThrowSpearReleasing?: boolean;
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
  // PVP-specific props
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  rageSpent?: number;
  collectedBones?: number;
  isWingJetsActive?: boolean;
  combatSystem?: any; // CombatSystem for  Strike damage numbers
  hideBody?: boolean; // When true, only the weapon is rendered (no dragon body/wings/orbitals)
  isLocalPlayer?: boolean;
}

export default function DragonUnit({
  position = new Vector3(0, 0, 0),
  movementDirection = new Vector3(0, 0, 0),
  isDashing = false,
  entityId,
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
  onRunebladeSwingComplete = () => {},
  onSpearSwingComplete = () => {},
  onSabresLeftSwingStart = () => {},
  onSabresRightSwingStart = () => {},
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  swordComboStep = 1,
  isSkyfalling = false,
  isBackstabbing = false,
  showVorpalGustBeam = false,
  vorpalGustStabBoonBeamTheme = 'default',
  isSundering = false,
  isStealthing = false,
  isInvisible = false,
  isSwordCharging = false,
  isDeflecting = false,
  deflectShieldActive: deflectShieldActiveProp,
  deflectShieldDurationSec = 3,
  isSmiting = false,
  isColossusStriking = false,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCorruptedAuraActive = false,
  crusaderBladeThemeActive = false,
  getRunebladeBlizzardTalentActive,
  onSmiteComplete = () => {},
  onColossusStrikeComplete = () => {},
  onDeathGraspComplete = () => {},
  onWraithStrikeComplete = () => {},
  onCorruptedAuraToggle = () => {},
  onChargeComplete = () => {},
  onDeflectComplete = () => {},
  enemyData = [],
  mushroomTargets,
  onMushroomHit,
  onHit = () => {},
  setDamageNumbers = () => {},
  nextDamageNumberId = { current: 0 },
  playerPosition,
  playerRotation = new Vector3(0, 0, 0),
  realTimePositionRef,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCrossentropyCharging = false,
  isSummonTotemCharging = false,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  tempestBurstShotSeq = 0,
  isRejuvenatingShotCharging = false,
  rejuvenatingShotChargeProgress = 0,
  isWhirlwindCharging = false,
  whirlwindChargeProgress = 0,
  isWhirlwinding = false,
  isThrowSpearCharging = false,
  throwSpearChargeProgress = 0,
  isThrowSpearReleasing = false,
  reanimateRef,
  setActiveEffects = () => {},
  targetPlayerData,
  rageSpent,
  collectedBones = 0,
  isWingJetsActive = false,
  combatSystem,
  purchasedItems = [],
  hideBody = false,
  playerLevel = 1,
  runebladeStoredCharge = false,
  onRunebladePrimaryHits,
  runebladeComboStepResolver,
  getRunebladeExecutionerFlatBonus,
  getRunebladeCrusaderLmbFlatBonus,
  isLocalPlayer = false,
}: DragonUnitProps) {
  const effectiveDeflectShield = deflectShieldActiveProp ?? isDeflecting;

  const groupRef = useRef<Group>(null);

  // Track left mouse button state directly via DOM events so the aura works
  // regardless of which weapon-specific charging prop is active.
  const isLeftMouseHeldRef = useRef(false);
  const spellAuraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSpellAura, setShowSpellAura] = useState(false);

  useEffect(() => {
    const AURA_WEAPONS = new Set([
      WeaponType.BOW,
      WeaponType.SWORD,
      WeaponType.SABRES,
      WeaponType.SCYTHE,
      WeaponType.SPEAR,
      WeaponType.RUNEBLADE,
    ]);

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!AURA_WEAPONS.has(currentWeapon)) return;
      isLeftMouseHeldRef.current = true;
      spellAuraTimerRef.current = setTimeout(() => {
        if (isLeftMouseHeldRef.current) setShowSpellAura(true);
      }, 250);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isLeftMouseHeldRef.current = false;
      if (spellAuraTimerRef.current) {
        clearTimeout(spellAuraTimerRef.current);
        spellAuraTimerRef.current = null;
      }
      setShowSpellAura(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    // Also cancel aura if focus is lost (e.g. alt-tab)
    document.addEventListener('visibilitychange', onMouseUp as any);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('visibilitychange', onMouseUp as any);
      if (spellAuraTimerRef.current) clearTimeout(spellAuraTimerRef.current);
    };
  // Re-register whenever the active weapon changes so AURA_WEAPONS check is fresh
  }, [currentWeapon]);

  const ABILITY_PULSE_MS = 1000;
  const LONG_CAST_CAP_MS = 2000;

  const [abilityPulseActive, setAbilityPulseActive] = useState(false);
  const abilityPulseClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAbilityPulse = useCallback(() => {
    setAbilityPulseActive(true);
    if (abilityPulseClearRef.current) clearTimeout(abilityPulseClearRef.current);
    abilityPulseClearRef.current = setTimeout(() => {
      setAbilityPulseActive(false);
      abilityPulseClearRef.current = null;
    }, ABILITY_PULSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (abilityPulseClearRef.current) clearTimeout(abilityPulseClearRef.current);
    },
    [],
  );

  const prevAbilityPulseRef = useRef<{
    isWraithStriking: boolean;
    isBarrageCharging: boolean;
    isViperStingCharging: boolean;
    isSummonTotemCharging: boolean;
    isBackstabbing: boolean;
    isSundering: boolean;
  } | null>(null);

  useEffect(() => {
    const p = prevAbilityPulseRef.current;
    if (p !== null) {
      if (currentWeapon === WeaponType.RUNEBLADE && p.isWraithStriking && !isWraithStriking) {
        scheduleAbilityPulse();
      }
      if (currentWeapon === WeaponType.BOW && p.isBarrageCharging && !isBarrageCharging) {
        scheduleAbilityPulse();
      }
      if (currentWeapon === WeaponType.BOW && p.isViperStingCharging && !isViperStingCharging) {
        scheduleAbilityPulse();
      }
      if (currentWeapon === WeaponType.SCYTHE && p.isSummonTotemCharging && !isSummonTotemCharging) {
        scheduleAbilityPulse();
      }
      if (currentWeapon === WeaponType.SABRES && p.isBackstabbing && !isBackstabbing) {
        scheduleAbilityPulse();
      }
      if (currentWeapon === WeaponType.SABRES && p.isSundering && !isSundering) {
        scheduleAbilityPulse();
      }
    }
    prevAbilityPulseRef.current = {
      isWraithStriking,
      isBarrageCharging,
      isViperStingCharging,
      isSummonTotemCharging,
      isBackstabbing,
      isSundering,
    };
  }, [
    currentWeapon,
    isWraithStriking,
    isBarrageCharging,
    isViperStingCharging,
    isSummonTotemCharging,
    isBackstabbing,
    isSundering,
    scheduleAbilityPulse,
  ]);

  const longCastStartRef = useRef<number | null>(null);
  const cappedLongCastAuraRef = useRef(false);
  const [cappedLongCastAura, setCappedLongCastAura] = useState(false);

  useFrame(() => {
    const inRunebladeSmite = currentWeapon === WeaponType.RUNEBLADE && isSmiting;
    const inScytheCrossentropy = currentWeapon === WeaponType.SCYTHE && isCrossentropyCharging;
    const inCast = inRunebladeSmite || inScytheCrossentropy;

    if (!inCast) {
      if (longCastStartRef.current !== null) {
        longCastStartRef.current = null;
        if (cappedLongCastAuraRef.current) {
          cappedLongCastAuraRef.current = false;
          setCappedLongCastAura(false);
        }
      }
      return;
    }

    if (longCastStartRef.current === null) {
      longCastStartRef.current = performance.now();
      cappedLongCastAuraRef.current = true;
      setCappedLongCastAura(true);
      return;
    }

    const elapsed = performance.now() - longCastStartRef.current;
    const next = elapsed < LONG_CAST_CAP_MS;
    if (next !== cappedLongCastAuraRef.current) {
      cappedLongCastAuraRef.current = next;
      setCappedLongCastAura(next);
    }
  });

  const spellAuraVisible =
    showSpellAura || abilityPulseActive || cappedLongCastAura;

  // Weapon rendering logic
  const renderWeapon = () => {
    if (currentWeapon === WeaponType.NONE || currentWeapon == null) {
      return null;
    }
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
          tempestBurstShotSeq={tempestBurstShotSeq}
          isRejuvenatingShotCharging={isRejuvenatingShotCharging}
          rejuvenatingShotChargeProgress={rejuvenatingShotChargeProgress}
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
          isColossusStriking={isColossusStriking}
          isOathstriking={false}
          isCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          chargeDirectionProp={chargeDirection}
          onSwingComplete={onSwordSwingComplete}
          onSmiteComplete={() => {}}
          onColossusStrikeComplete={onColossusStrikeComplete}
          onOathstrikeComplete={() => {}}
          onChargeComplete={onChargeComplete}
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
          playerEntityId={entityId}
          realTimePositionRef={realTimePositionRef}
          mushroomTargets={mushroomTargets}
          onMushroomHit={onMushroomHit}
        />
      );
    } else if (currentWeapon === WeaponType.SABRES) {
      return (
        <>
          <Sabres
            isSwinging={isSwinging}
            onSwingComplete={onSabresSwingComplete || (() => {})}
            onLeftSwingStart={onSabresLeftSwingStart || (() => {})}
            onRightSwingStart={onSabresRightSwingStart || (() => {})}
            isCharging={isCharging}
            isSkyfalling={isSkyfalling}
            isBackstabbing={isBackstabbing}
            isSundering={isSundering}
            isStealthing={isStealthing}
            isInvisible={isInvisible}
            onBackstabComplete={onBackstabComplete}
            onSunderComplete={onSunderComplete}
            subclass={currentSubclass}
            enemyData={enemyData}
            onHit={onHit}
          />
          {isBackstabbing && showVorpalGustBeam ? (
            <VorpalGustVfx
              active={isBackstabbing && showVorpalGustBeam}
              stabBoonTheme={vorpalGustStabBoonBeamTheme}
            />
          ) : null}
        </>
      );
    } else if (currentWeapon === WeaponType.RUNEBLADE) {
      return (
        <Runeblade
          isSwinging={isSwinging}
          isSmiting={isSmiting}
          isDeathGrasping={isDeathGrasping}
          isWraithStriking={isWraithStriking}
          isCorruptedAuraActive={isCorruptedAuraActive}
          crusaderBladeThemeActive={crusaderBladeThemeActive}
          isOathstriking={false}
          isCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          chargeDirectionProp={chargeDirection}
          onSwingComplete={onRunebladeSwingComplete}
          onSmiteComplete={onSmiteComplete}
          onDeathGraspComplete={onDeathGraspComplete}
          onWraithStrikeComplete={onWraithStrikeComplete}
          onCorruptedAuraToggle={onCorruptedAuraToggle}
          onOathstrikeComplete={() => {}}
          onChargeComplete={onChargeComplete}
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
          playerEntityId={entityId}
          realTimePositionRef={realTimePositionRef}
          storedCharge={runebladeStoredCharge}
          onPrimaryHitsResolved={onRunebladePrimaryHits}
          comboStepResolver={runebladeComboStepResolver}
          getExecutionerFlatBonus={getRunebladeExecutionerFlatBonus}
          getCrusaderLmbFlatBonus={getRunebladeCrusaderLmbFlatBonus}
          getBlizzardTalentActive={getRunebladeBlizzardTalentActive}
          mushroomTargets={mushroomTargets}
          onMushroomHit={onMushroomHit}
        />
      );
    } else if (currentWeapon === WeaponType.SPEAR) {
      return (
        <SpearComponent
          isSwinging={isSwinging || false}
          onSwingComplete={onSpearSwingComplete || (() => {})}
          isWhirlwinding={isWhirlwinding || false}
          fireballCharges={[]} // Basic implementation for now
          currentSubclass={currentSubclass}
          isThrowSpearCharging={isThrowSpearCharging || false}
          throwSpearChargeProgress={throwSpearChargeProgress || 0}
          isThrowSpearReleasing={isThrowSpearReleasing || false}
          isSpearThrown={false}
          isWhirlwindCharging={isWhirlwindCharging || false}
          whirlwindChargeProgress={whirlwindChargeProgress || 0}
        />
      );
    }
    return null;
  };

  // Memoize components for performance optimization
  const bonePlate = useMemo(() => (
    <group scale={[0.95, 0.7, 0.95]} position={[0, 0.04, -0.015]} rotation={[0.4, 0, 0]}>
      <BonePlate />
    </group>
  ), []);

  const boneTail = useMemo(() => (
    <group scale={[0.85, 0.85, 0.85]} position={[0, 0.05, +0.1]}>
      <BoneTail movementDirection={movementDirection} isDashing={isDashing} />
    </group>
  ), [movementDirection, isDashing]);

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

  const hasAscendantWings = purchasedItems.includes('ascendant_wings');

  const wings = useMemo(() => (
    <group position={[0, 0.2, -0.15]}>
      {/* Left Wing */}
      <group rotation={[0, Math.PI / 5.5, 0]}>
        {hasAscendantWings ? (
          <AscendantBoneWings
            isLeftWing={true}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        ) : (
          <BoneWings
            isLeftWing={true}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        )}
      </group>

      {/* Right Wing */}
      <group rotation={[0, -Math.PI / 5.5, 0]}>
        {hasAscendantWings ? (
          <AscendantBoneWings
            isLeftWing={false}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        ) : (
          <BoneWings
            isLeftWing={false}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        )}
      </group>
    </group>
  ), [isDashing, hasAscendantWings]);

  const crestPosition: [number, number, number] = hideBody ? [0, 1.8, 0.15] : [0, 0.5, 0.15];

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.2, position.z]}>

      {!hideBody && (<>
        {/* BONE PLATE (TORSO) */}
        {bonePlate}

        {/* WINGS */}
        {wings}

        {/* DRACONIC WING JETS */}
        <DraconicWingJets
          isActive={isWingJetsActive || isDashing || collectedBones > 0}
          collectedBones={collectedBones}
          isLeftWing={true}
          parentRef={groupRef}
          weaponType={currentWeapon}
          weaponSubclass={currentSubclass}
        />
        <DraconicWingJets
          isActive={isWingJetsActive || isDashing || collectedBones > 0}
          collectedBones={collectedBones}
          isLeftWing={false}
          parentRef={groupRef}
          weaponType={currentWeapon}
          weaponSubclass={currentSubclass}
        />

        {/* BONE AURA */}
        <BoneAura
          parentRef={groupRef}
        />
      </>)}

      {/* CREST — visible with or without dragon body, raised higher on character model */}
      <ArchmageCrest
        position={crestPosition}
        scale={-0.625}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
      />
      {playerLevel >= 2 && (
        <ArchmageCrest
          position={[crestPosition[0], crestPosition[1] - 0.05, crestPosition[2]]}
          scale={-0.525}
          weaponType={currentWeapon}
          weaponSubclass={currentSubclass}
          wingSpread={1.425}
          rotation={[0.00, 0.00, 0.0]}
        />
      )}

      {/* SPELL CASTING AURA — shown after 1 s of left-click hold on any weapon */}
      <SpellCastingAura
        parentRef={groupRef}
        isActive={spellAuraVisible}
      />

      {/* Rising cast halos — Reanimate-style rings, ~50% scale; torso-height on humanoid weapon rig */}
      <group position={[0, hideBody ? 1.05 : 0.55, 0]}>
        <SpellCastingHalos isActive={spellAuraVisible} />
      </group>

      {/* CHARGED ORBITALS — visible with or without dragon body, raised to hip level on character model */}
      <ChargedOrbitals
        parentRef={groupRef}
        dashCharges={dashCharges}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        isCorruptedAuraActive={isCorruptedAuraActive}
        yOffset={hideBody ? 1.1 : 0}
      />

      {/* WEAPON */}
      {renderWeapon()}

      {/* REANIMATE ABILITY */}
      {currentWeapon === WeaponType.SCYTHE && (
        <Reanimate
          parentRef={groupRef}
          ref={reanimateRef}
        />
      )}

      {effectiveDeflectShield && (
        <DeflectShield
          isActive={effectiveDeflectShield}
          duration={deflectShieldDurationSec}
          onComplete={onDeflectComplete}
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          dragonGroupRef={groupRef}
          weaponType={currentWeapon}
          enableBlockFlash={isLocalPlayer}
        />
      )}

    </group>
  );
}
