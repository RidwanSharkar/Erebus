import { WeaponType } from '@/components/dragon/weapons';

export interface AegisShieldPalette {
  main: number;
  emissive: number;
  emissiveDeep: number;
  accent: number;
}

/** Class-colored Aegis / Wraith Guard plasma (RUNEBLADE_Q can be taken on any weapon). */
export function getAegisShieldPalette(weapon: WeaponType): AegisShieldPalette {
  switch (weapon) {
    case WeaponType.NONE:
      return {
        main: 0x8a2be2,
        emissive: 0x9370db,
        emissiveDeep: 0x6b21a8,
        accent: 0xda70d6,
      };
    case WeaponType.RUNEBLADE:
    case WeaponType.SWORD:
      return {
        main: 0xffcc00,
        emissive: 0xffaa00,
        emissiveDeep: 0xff6f00,
        accent: 0xffffff,
      };
    case WeaponType.SCYTHE:
      return {
        main: 0x87ceeb,
        emissive: 0x5cadff,
        emissiveDeep: 0x3a8cff,
        accent: 0xe0f4ff,
      };
    case WeaponType.BOW:
      return {
        main: 0x44dd66,
        emissive: 0x22aa44,
        emissiveDeep: 0x118833,
        accent: 0xccffdd,
      };
    case WeaponType.SPEAR:
    case WeaponType.KNIGHT:
      return {
        main: 0xc0c0c0,
        emissive: 0xe8e8e8,
        emissiveDeep: 0x909090,
        accent: 0xffffff,
      };
    case WeaponType.SABRES:
      return {
        main: 0xff4444,
        emissive: 0xcc0000,
        emissiveDeep: 0x990000,
        accent: 0xffcccc,
      };
    default:
      return getAegisShieldPalette(WeaponType.RUNEBLADE);
  }
}
