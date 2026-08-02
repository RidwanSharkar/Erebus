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
import { isEventOverGameUi } from '@/utils/gameUiInput';
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
import PhoenixTrinketWings from './PhoenixTrinketWings';
import ShoulderTrinketPlates from './ShoulderTrinketPlates';
import SpellCastingAura from '../weapons/SpellCastingAura';
import PrimeMateriaAura from '../weapons/PrimeMateriaAura';
import IncinerationChargeAura from '../weapons/IncinerationChargeAura';
import SpellCastingHalos from '../weapons/SpellCastingHalos';
import DeflectShield from '../weapons/DeflectShield';
import type { AegisPaletteVariant } from '@/utils/aegisShieldPalette';
import { isShiftEnergyHaloActive, type VorpalGustStabBoonBeamTheme, type TalentLoadout } from '@/utils/talents';
import type { WeaponAspect } from '@/utils/weaponAspects';

interface DragonUnitProps {
  position?: Vector3;
  movementDirection?: Vector3;
  isDashing?: boolean;
  entityId?: number; // Player's entity ID
  dashCharges?: Array<DashChargeStatus>;
  dashRechargeDurationSec?: number;
  chargeDirection?: Vector3;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  isSpinning?: boolean;
  purchasedItems?: string[]; // Purchased cosmetic items
  /** Co-op duo boon (green + purple) — attaches an AscendantBoneWings back cosmetic. */
  hasFatebreaker?: boolean;
  /** Co-op duo boon (red + purple) — attaches a small BoneWings back cosmetic. */
  hasFrostQueen?: boolean;
  /** Co-op / progression level — crest layer at 2+, shoulder plates at 3+, phoenix wings at 4+. */
  playerLevel?: number;
  /** Cyclone Rush — Runeblade Charge spin + damage. */
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
  /** Local: Titan's Grip — permanent red blade palette. */
  titansGripBladeThemeActive?: boolean;
  /** Local: Psionic Blades — permanent purple blade palette. */
  psionicBladesBladeThemeActive?: boolean;
  /** Throne weapon aspect — visual variant for blade colors/shape. */
  weaponAspect?: WeaponAspect;
  /** Local: Blizzard talent — storm visibility from ControlSystem (omit when talent not taken). */
  getRunebladeBlizzardTalentActive?: () => boolean;
  /** Local: Runeblade Blizzard — stat-scaled tick damage. */
  getRunebladeBlizzardDamagePerTick?: () => number;
  /** Local: Awakened Eye — scaled Runeblade Blizzard storm hit radius. */
  getRunebladeBlizzardStormHitRadius?: () => number;
  /** Local: Awakened Eye — denser Runeblade Blizzard frost particles. */
  getRunebladeBlizzardParticleSpawnMultiplier?: () => number;
  /** Local: Titan's Grip — flat STR-scaled LMB damage per combo strike. */
  getRunebladeTitansGripLmbFlatBonus?: () => number;
  /** Local: Vicegrip (Exodia Gauntlets) — +50 flat on each Runeblade combo hit. */
  getVicegripRunebladeComboFlatBonus?: () => number;
  /** Local: Titan's Grip — 25% per-hit stun proc on Runeblade LMB hits. */
  onRunebladeTitansGripHit?: (targetId: string) => void;
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
  deflectShieldPaletteVariant?: AegisPaletteVariant;
  /** Shift-tap Deflect-Block — independent gold shield instance, unrelated to Q-Aegis `isDeflecting`. */
  isBlockingDeflect?: boolean;
  blockingDeflectDurationSec?: number;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  /** Alchemist Prime Materia — toggle Shift red aura ring. */
  isPrimeMateriaActive?: boolean;
  /** Sorceress Incineration — hold Shift fiery charge aura. */
  isIncinerationCharging?: boolean;
  /** Sorceress Incineration — shift released, charge armed for LMB detonate. */
  isIncinerationArmed?: boolean;
  /** Acolyte Locusts — hold Shift volley channel. */
  isLocustChanneling?: boolean;
  /** Hold-Shift sprint (Rogue / legacy PvP). */
  isSprinting?: boolean;
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  onChargeComplete?: () => void;
  onChargeSpinStart?: () => void;
  onChargeSpinEnd?: () => void;
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
  /** Local player talent loadout — drives scythe handle trail colors. */
  talentLoadout?: TalentLoadout | null;
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
  dashRechargeDurationSec = 8,
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
  deflectShieldPaletteVariant = 'default',
  isBlockingDeflect = false,
  blockingDeflectDurationSec = 1,
  isSmiting = false,
  isColossusStriking = false,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCorruptedAuraActive = false,
  isPrimeMateriaActive = false,
  isIncinerationCharging = false,
  isIncinerationArmed = false,
  isLocustChanneling = false,
  isSprinting = false,
  crusaderBladeThemeActive = false,
  titansGripBladeThemeActive = false,
  psionicBladesBladeThemeActive = false,
  weaponAspect,
  getRunebladeBlizzardTalentActive,
  getRunebladeBlizzardDamagePerTick,
  getRunebladeBlizzardStormHitRadius,
  getRunebladeBlizzardParticleSpawnMultiplier,
  getRunebladeTitansGripLmbFlatBonus,
  getVicegripRunebladeComboFlatBonus,
  onRunebladeTitansGripHit,
  onSmiteComplete = () => {},
  onColossusStrikeComplete = () => {},
  onDeathGraspComplete = () => {},
  onWraithStrikeComplete = () => {},
  onCorruptedAuraToggle = () => {},
  onChargeComplete = () => {},
  onChargeSpinStart,
  onChargeSpinEnd,
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
  talentLoadout = null,
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
  hasFatebreaker = false,
  hasFrostQueen = false,
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
    if (!isLocalPlayer) return;

    const AURA_WEAPONS = new Set([
      WeaponType.BOW,
      WeaponType.SWORD,
      WeaponType.SABRES,
      WeaponType.SCYTHE,
      WeaponType.SPEAR,
      WeaponType.RUNEBLADE,
    ]);

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isEventOverGameUi(e)) return;
      if (!AURA_WEAPONS.has(currentWeapon)) return;
      isLeftMouseHeldRef.current = true;
      spellAuraTimerRef.current = setTimeout(() => {
        if (isLeftMouseHeldRef.current) setShowSpellAura(true);
      }, 250);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0 || isEventOverGameUi(e)) return;
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
  }, [currentWeapon, isLocalPlayer]);

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
    if (!isLocalPlayer) return;

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
    isLocalPlayer,
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
    if (!isLocalPlayer) return;

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
    isLocalPlayer &&
    (showSpellAura || abilityPulseActive || cappedLongCastAura);

  const [shiftHaloPulseActive, setShiftHaloPulseActive] = useState(false);
  const shiftHaloPulseClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleShiftHaloPulse = useCallback((durationMs: number) => {
    setShiftHaloPulseActive(true);
    if (shiftHaloPulseClearRef.current) clearTimeout(shiftHaloPulseClearRef.current);
    shiftHaloPulseClearRef.current = setTimeout(() => {
      setShiftHaloPulseActive(false);
      shiftHaloPulseClearRef.current = null;
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (shiftHaloPulseClearRef.current) clearTimeout(shiftHaloPulseClearRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isLocalPlayer) return;

    const onShiftEnergyHaloPulse = (event: Event) => {
      const detail = (event as CustomEvent<{ durationMs?: number }>).detail;
      scheduleShiftHaloPulse(detail?.durationMs ?? 1000);
    };

    window.addEventListener('shift-energy-halo-pulse', onShiftEnergyHaloPulse);
    return () => window.removeEventListener('shift-energy-halo-pulse', onShiftEnergyHaloPulse);
  }, [isLocalPlayer, scheduleShiftHaloPulse]);

  const shiftEnergyHaloVisible =
    isLocalPlayer &&
    isShiftEnergyHaloActive({
      isSprinting,
      isPrimeMateriaActive,
      isIncinerationCharging,
      isIncinerationArmed,
      isLocustChanneling,
      isBlockingDeflect,
      pulseActive: shiftHaloPulseActive,
    });

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
          isLocalPlayer={isLocalPlayer}
          weaponAspect={weaponAspect}
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
          talentLoadout={talentLoadout}
          isCrossentropyCharging={isCrossentropyCharging}
          weaponAspect={weaponAspect}
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
            psionicBladesBladeThemeActive={psionicBladesBladeThemeActive}
            weaponAspect={weaponAspect}
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
          titansGripBladeThemeActive={titansGripBladeThemeActive}
          weaponAspect={weaponAspect}
          isWhirlwindCharging={isWhirlwindCharging || false}
          whirlwindChargeProgress={whirlwindChargeProgress || 0}
          isWhirlwinding={isWhirlwinding || false}
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
          onChargeSpinStart={onChargeSpinStart}
          onChargeSpinEnd={onChargeSpinEnd}
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
          getTitansGripLmbFlatBonus={getRunebladeTitansGripLmbFlatBonus}
          getVicegripFlatBonus={getVicegripRunebladeComboFlatBonus}
          getBlizzardTalentActive={getRunebladeBlizzardTalentActive}
          getBlizzardDamagePerTick={getRunebladeBlizzardDamagePerTick}
          getBlizzardStormHitRadius={getRunebladeBlizzardStormHitRadius}
          getBlizzardParticleSpawnMultiplier={getRunebladeBlizzardParticleSpawnMultiplier}
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

  const hasAscendantWings = purchasedItems.includes('ascendant_wings'); //OUTDATED

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

  const crestPosition: [number, number, number] = hideBody ? [0, 1.7, 0.15] : [0, 0.5, 0.15];

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
      

      {/* Phoenix wings — hover behind crest at level 4+ */}
      {playerLevel >= 4 && (
        <PhoenixTrinketWings
          anchorPosition={crestPosition}
          hideBody={hideBody}
        />
      )}

      {/* Shoulder pauldrons — hover left/right of crest at level 3+ */}
      {playerLevel >= 3 && (
        <ShoulderTrinketPlates
          anchorPosition={crestPosition}
          hideBody={hideBody}
        />
      )}

      {/* CREST — visible with or without dragon body, raised higher on character model */}
      <ArchmageCrest
        position={crestPosition}
        rotation={[0.2, 0.00, 0.0]}
        scale={-0.6}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        weaponAspect={weaponAspect}
      />
      {playerLevel >= 2 && (
        <ArchmageCrest
          position={[crestPosition[0], crestPosition[1] - 0.6, crestPosition[2]-0.3]}
          scale={-0.425}
          weaponType={currentWeapon}
          weaponSubclass={currentSubclass}
          weaponAspect={weaponAspect}
          wingSpread={-.025}
          rotation={[0.00, 0.00, 0.0]}
        />
      )}

      {/* FATEBREAKER (duo: green + purple) — small AscendantBoneWings back cosmetic, scaled like the crest */}
      {hasFatebreaker && (
        <group position={[crestPosition[0], crestPosition[1] - 0.4, crestPosition[2] - 1]} scale={[0.7, 0.7, 0.7]}>
          <group rotation={[0, Math.PI / 5.5, 0]}>
            <AscendantBoneWings isLeftWing={true} parentRef={groupRef} isDashing={isDashing} />
          </group>
          <group rotation={[0, -Math.PI / 5.5, 0]}>
            <AscendantBoneWings isLeftWing={false} parentRef={groupRef} isDashing={isDashing} />
          </group>
        </group>
      )}

      {/* FROST QUEEN (duo: red + purple) — small BoneWings back cosmetic, scaled like the crest */}
      {hasFrostQueen && (
        <group position={[crestPosition[0], crestPosition[1] - 0.1, crestPosition[2] - 0.6]} scale={[0.4, 0.4, 0.4]}>
          <group rotation={[0, Math.PI / 5.5, 0]}>
            <BoneWings isLeftWing={true} parentRef={groupRef} isDashing={isDashing} />
          </group>
          <group rotation={[0, -Math.PI / 5.5, 0]}>
            <BoneWings isLeftWing={false} parentRef={groupRef} isDashing={isDashing} />
          </group>
        </group>
      )}

      {/* SPELL CASTING AURA — local player only; shown after LMB hold on any weapon */}
      {isLocalPlayer && (
        <>
          <SpellCastingAura
            parentRef={groupRef}
            isActive={spellAuraVisible}
          />

          {/* Rising cast halos — Shift-energy spend only; LMB/Q/E casts use SpellCastingAura */}
          <group position={[0, hideBody ? 1.05 : 0.55, 0]}>
            <SpellCastingHalos isActive={shiftEnergyHaloVisible} />
          </group>

          <PrimeMateriaAura
            parentRef={groupRef}
            isActive={isPrimeMateriaActive}
          />

          <IncinerationChargeAura
            parentRef={groupRef}
            isActive={isIncinerationCharging}
          />
        </>
      )}

      {/* CHARGED ORBITALS — visible with or without dragon body, raised to hip level on character model */}
      <ChargedOrbitals
        parentRef={groupRef}
        dashCharges={dashCharges}
        rechargeDurationSec={dashRechargeDurationSec}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        weaponAspect={weaponAspect}
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
          paletteVariant={deflectShieldPaletteVariant}
          enableBlockFlash={isLocalPlayer}
        />
      )}

      {isBlockingDeflect && (
        <DeflectShield
          isActive={isBlockingDeflect}
          duration={blockingDeflectDurationSec}
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          dragonGroupRef={groupRef}
          weaponType={WeaponType.RUNEBLADE}
          paletteVariant="default"
          enableBlockFlash={isLocalPlayer}
          blockEventName="deflect-block"
          onBlockFlash={() => window.audioSystem?.playDeflectBoltSound?.()}
        />
      )}

    </group>
  );
}
