// Core damage calculation system with critical hit mechanics
// Placed in core/ for performance and shared access across all systems

import { WeaponType } from '@/components/dragon/weapons';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

/** Optional crit modifiers (additive on top of runes / stats / passives). */
export interface DamageCalcOptions {
  critChanceAdd?: number;
  critDamageMultAdd?: number;
}

// Global references
let globalCriticalRuneCount = 0;
let globalCritDamageRuneCount = 0;
let globalControlSystem: any = null; // Reference to control system for passive ability checks
let globalAgilityStatPoints = 0; // +1% crit chance per point
let globalStrengthStatPoints = 0; // +0.05 crit damage multiplier per point

export function setControlSystem(controlSystem: any) {
  globalControlSystem = controlSystem;
}

export function setGlobalCriticalRuneCount(count: number) {
  globalCriticalRuneCount = count;
}

export function setGlobalCritDamageRuneCount(count: number) {
  globalCritDamageRuneCount = count;
}

export function setGlobalAgilityStatPoints(points: number) {
  globalAgilityStatPoints = points;
}

export function setGlobalStrengthStatPoints(points: number) {
  globalStrengthStatPoints = points;
}

export function getGlobalStrengthStatPoints(): number {
  return globalStrengthStatPoints;
}

export function calculateDamage(
  baseAmount: number,
  weaponType?: WeaponType,
  opts?: DamageCalcOptions,
): DamageResult {
  // Base crit chance is 11%, each rune adds 3%, each Agility point adds 1%
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03) + (globalAgilityStatPoints * 0.01);

  // Add Bow passive / talent: TEMPEST ROUNDS (+10% crit chance; matches legacy P unlock)
  if (weaponType === WeaponType.BOW && globalControlSystem?.isBowTempestRoundsActive?.()) {
    criticalChance += 0.1;
  }

  if (opts?.critChanceAdd) {
    criticalChance += opts.critChanceAdd;
  }

  const isCritical = Math.random() < criticalChance;

  // Base crit damage multiplier is 2x, each crit damage rune adds 0.15x, each Strength point adds 0.05x
  let criticalDamageMultiplier = 2.0 + (globalCritDamageRuneCount * 0.15) + (globalStrengthStatPoints * 0.05);
  if (opts?.critDamageMultAdd) {
    criticalDamageMultiplier += opts.critDamageMultAdd;
  }
  const rawDamage = isCritical ? baseAmount * criticalDamageMultiplier : baseAmount;

  // Round down to integer to avoid floating point precision issues
  const damage = Math.floor(rawDamage);



  return { damage, isCritical };
}

// Utility functions for debugging and testing
export function getCriticalChance(weaponType?: WeaponType): number {
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03) + (globalAgilityStatPoints * 0.01);

  if (weaponType === WeaponType.BOW && globalControlSystem?.isBowTempestRoundsActive?.()) {
    criticalChance += 0.1;
  }

  return criticalChance;
}

export function getCriticalDamageMultiplier(): number {
  return 2.0 + (globalCritDamageRuneCount * 0.15) + (globalStrengthStatPoints * 0.05);
}

export function getGlobalRuneCounts(): { criticalRunes: number; critDamageRunes: number } {
  return {
    criticalRunes: globalCriticalRuneCount,
    critDamageRunes: globalCritDamageRuneCount
  };
}
