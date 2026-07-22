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

/** Full-art weapon portrait for hotkey HUD (`public/icons/*.png`). */
export function getWeaponPortraitIconSrc(weapon: WeaponType): string | null {
  switch (weapon) {
    case WeaponType.SABRES:
      return '/icons/sabres.png';
    case WeaponType.RUNEBLADE:
      return '/icons/runeblade.png';
    case WeaponType.SCYTHE:
      return '/icons/scythe.png';
    case WeaponType.BOW:
      return '/icons/bow.png';
    default:
      return null;
  }
}

export function getWeaponDisplayName(weapon: WeaponType): string {
  switch (weapon) {
    case WeaponType.NONE:
      return 'Unarmed';
    case WeaponType.SWORD:
      return 'Sword';
    case WeaponType.BOW:
      return 'Bow';
    case WeaponType.SCYTHE:
      return 'Scythe';
    case WeaponType.SABRES:
      return 'Sabres';
    case WeaponType.RUNEBLADE:
      return 'Runeblade';
    case WeaponType.SPEAR:
      return 'Spear';
    case WeaponType.KNIGHT:
      return 'Knight';
    default:
      return 'Unknown';
  }
}

export interface ThroneWeaponTooltipData {
  name: string;
  description: string;
}

/** Short identity blurbs for throne-room weapon pedestals. */
export function getThroneWeaponTooltipData(weapon: WeaponType): ThroneWeaponTooltipData | null {
  switch (weapon) {
    case WeaponType.RUNEBLADE:
      return {
        name: getWeaponDisplayName(weapon),
        description: 'Arcane runeblade — combo melee with smite and void grasp.',
      };
    case WeaponType.SABRES:
      return {
        name: getWeaponDisplayName(weapon),
        description: 'Frost dual blades — flurries, shadow step, and skyfall.',
      };
    case WeaponType.SCYTHE:
      return {
        name: getWeaponDisplayName(weapon),
        description: 'Chaos scythe — mantra, sunwell, and cryoflame.',
      };
    case WeaponType.BOW:
      return {
        name: getWeaponDisplayName(weapon),
        description: 'Elemental bow — charged shots and ethereal volleys.',
      };
    default:
      return null;
  }
}
