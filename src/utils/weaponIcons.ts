import { WeaponType } from '@/components/dragon/weapons';

/** Public URL for weapon HUD icons (`public/icons/*.svg`). */
export function getWeaponHudIconSrc(weapon: WeaponType): string | null {
  switch (weapon) {
    case WeaponType.SABRES:
      return '/icons/sabres.svg';
    case WeaponType.RUNEBLADE:
      return '/icons/runeblade.svg';
    case WeaponType.SCYTHE:
      return '/icons/scythe.svg';
    case WeaponType.BOW:
      return '/icons/bow.svg';
    default:
      return null;
  }
}
