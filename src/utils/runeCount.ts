import { WeaponType } from '@/components/dragon/weapons';

/** Bow, Sword, and Sabres gain 1 critical chance and 1 critical damage rune per level. */
export function getRuneCountForWeapon(weaponType: WeaponType, level: number): number {
  if (weaponType === WeaponType.BOW || weaponType === WeaponType.SWORD || weaponType === WeaponType.SABRES) {
    return Math.max(0, level - 1);
  }
  return 0;
}

/** Total rune count from primary + secondary weapon slots. */
export function getTotalRuneCountForWeapons(
  primary: WeaponType,
  secondary: WeaponType,
  level: number,
): number {
  return getRuneCountForWeapon(primary, level) + getRuneCountForWeapon(secondary, level);
}
