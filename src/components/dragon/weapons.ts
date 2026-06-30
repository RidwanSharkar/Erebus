export enum WeaponType {
    NONE = 'NONE',
    SCYTHE = 'SCYTHE',
    SWORD = 'SWORD',
    SABRES = 'SABRES',
    RUNEBLADE = 'RUNEBLADE',
    BOW = 'BOW',
    SPEAR = 'SPEAR',
    KNIGHT = 'KNIGHT'
  }

/** Throne room weapon pedestals — keep in sync with `COOP_THRONE_WEAPONS` in gameRoom.js */
export const COOP_THRONE_WEAPON_TYPES = [
  WeaponType.RUNEBLADE,
  WeaponType.SABRES,
  WeaponType.SCYTHE,
  WeaponType.BOW,
] as const;

export enum WeaponSubclass {
    // Scythe subclasses
    CHAOS = 'CHAOS',
    ABYSSAL = 'ABYSSAL',

    // Sword subclasses
    DIVINITY = 'DIVINITY',
    VENGEANCE = 'VENGEANCE',

    // Sabres subclasses
    FROST = 'FROST',
    ASSASSIN = 'ASSASSIN',

    // Runeblade subclasses
    ARCANE = 'ARCANE',
    NATURE = 'NATURE',

    // Bow subclasses
    ELEMENTAL = 'ELEMENTAL',
    VENOM = 'VENOM',

    // Spear subclasses
    STORM = 'STORM',
    VALOR = 'VALOR'
  }