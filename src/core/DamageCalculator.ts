// Core damage calculation system with critical hit mechanics
// Placed in core/ for performance and shared access across all systems

import { WeaponType } from '@/components/dragon/weapons';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

// Global references
let globalCriticalRuneCount = 0;
let globalCritDamageRuneCount = 0;
let globalControlSystem: any = null; // Reference to control system for passive ability checks
let globalAgilityStatPoints = 0; // Agility stat: +1% crit chance and +0.10x crit damage per point

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

export function calculateDamage(baseAmount: number, weaponType?: WeaponType): DamageResult {
  // Base crit chance is 11%, each rune adds 3%, each Agility point adds 1%
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03) + (globalAgilityStatPoints * 0.01);

  // Add Bow passive: TEMPEST ROUNDS (+5% crit chance)
  if (weaponType === WeaponType.BOW && globalControlSystem) {
    // Check if Bow passive is unlocked
    const weaponSlot = globalControlSystem.selectedWeapons?.primary === WeaponType.BOW ? 'primary' : 'secondary';
    if (weaponSlot && globalControlSystem.isPassiveAbilityUnlocked &&
        globalControlSystem.isPassiveAbilityUnlocked('P', WeaponType.BOW, weaponSlot)) {
      criticalChance += 0.10; // +5% crit chance
    }
  }

  const isCritical = Math.random() < criticalChance;

  // Base crit damage multiplier is 2x, each crit damage rune adds 0.15x, each Agility point adds 0.10x
  const criticalDamageMultiplier = 2.0 + (globalCritDamageRuneCount * 0.15) + (globalAgilityStatPoints * 0.10);
  const rawDamage = isCritical ? baseAmount * criticalDamageMultiplier : baseAmount;

  // Round down to integer to avoid floating point precision issues
  const damage = Math.floor(rawDamage);



  return { damage, isCritical };
}

// Utility functions for debugging and testing
export function getCriticalChance(weaponType?: WeaponType): number {
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03) + (globalAgilityStatPoints * 0.01);

  // Add Bow passive: TEMPEST ROUNDS (+5% crit chance)
  if (weaponType === WeaponType.BOW && globalControlSystem) {
    // Check if Bow passive is unlocked
    const weaponSlot = globalControlSystem.selectedWeapons?.primary === WeaponType.BOW ? 'primary' : 'secondary';
    if (weaponSlot && globalControlSystem.isPassiveAbilityUnlocked &&
        globalControlSystem.isPassiveAbilityUnlocked('P', WeaponType.BOW, weaponSlot)) {
      criticalChance += 0.05; // +5% crit chance
    }
  }

  return criticalChance;
}

export function getCriticalDamageMultiplier(): number {
  return 2.0 + (globalCritDamageRuneCount * 0.15) + (globalAgilityStatPoints * 0.10);
}

export function getGlobalRuneCounts(): { criticalRunes: number; critDamageRunes: number } {
  return {
    criticalRunes: globalCriticalRuneCount,
    critDamageRunes: globalCritDamageRuneCount
  };
}
