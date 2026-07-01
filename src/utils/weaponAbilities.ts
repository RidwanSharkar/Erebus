import { WeaponType } from '@/components/dragon/weapons';
import { REANIMATE_SUNWELL_COOLDOWN_SEC, LIGHTNING_BOLT_ROOM_DAMAGE, LIGHTNING_BOLT_ROOM_DAMAGE_PER_AGILITY, LIGHTNING_BOLT_ROOM_STAGGER } from '@/utils/talents';

export interface AbilityData {
  name: string;
  key: 'Q' | 'E' | 'R' | 'F' | 'P';
  cooldown: number;
  description: string;
  isPassive?: boolean;
}

// --- Universal Ability System ---

export interface UniversalAbility {
  id: string;            // e.g. 'RUNEBLADE_Q'
  sourceWeapon: WeaponType;
  sourceKey: 'Q' | 'E' | 'R' | 'F' | 'P';
  name: string;
  cooldown: number;
  description: string;
  icon: string;
  /** Weapons that are allowed to equip this ability in their universal loadout */
  allowedWeapons: WeaponType[];
}

export interface AbilityLoadout {
  Q: string | null;   // universal ability id
  E: string | null;
  R: string | null;
  passive?: string | null; // selected passive ability id (sourceKey === 'P')
}

const ALL_WEAPONS: WeaponType[] = [
  WeaponType.BOW,
  WeaponType.SCYTHE,
  WeaponType.SABRES,
  WeaponType.RUNEBLADE,
  WeaponType.SPEAR,
];

/** Flat pool of every ability available for the universal loadout (Q/E/R slots) */
export const universalAbilityPool: UniversalAbility[] = [

  // ── RUNEBLADE (Sword) ──────────────────────────────────────────────────
  {
    id: 'RUNEBLADE_Q', sourceWeapon: WeaponType.RUNEBLADE, sourceKey: 'Q',
    name: 'Aegis', cooldown: 7.0, icon: '🛡️',
    description: 'Creates a protective barrier that blocks all incoming damage for 3 seconds.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'DEATH_GRASP', sourceWeapon: WeaponType.RUNEBLADE, sourceKey: 'Q',
    name: 'Death Grasp', cooldown: 5.0, icon: '💀',
    description: 'Launch a spectral claw that grabs the nearest enemy unit, pulling them towards you and dealing 80 damage.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'RUNEBLADE_E', sourceWeapon: WeaponType.RUNEBLADE, sourceKey: 'E',
    name: 'Wraith Strike', cooldown: 3.0, icon: '🗡️',
    description: 'A swift strike that briefly applies SLOW and TAUNT to enemies hit. 5 second cooldown.',
    allowedWeapons: [WeaponType.SABRES, WeaponType.SPEAR, WeaponType.RUNEBLADE],
  },
  {
    id: 'RUNEBLADE_R', sourceWeapon: WeaponType.RUNEBLADE, sourceKey: 'R',
    name: 'Colossus Strike', cooldown: 3.0, icon: '⚡️',
    description: 'Calls down a pillar of radiant energy, dealing damage to enemy players in a small area, healing you for 10 HP. 8 second cooldown.',
    allowedWeapons: [WeaponType.SPEAR, WeaponType.RUNEBLADE],
  },
  {
    id: 'RUNEBLADE_F', sourceWeapon: WeaponType.RUNEBLADE, sourceKey: 'F',
    name: 'Aura', cooldown: 0, icon: '💠',
    description: 'Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.',
    allowedWeapons: [WeaponType.SABRES, WeaponType.SPEAR, WeaponType.RUNEBLADE],
  },

  // ── SWORD (Classic) — shared mechanics (e.g. Charge) usable on Runeblade ─
  {
    id: 'SWORD_E', sourceWeapon: WeaponType.SWORD, sourceKey: 'E',
    name: 'Charge', cooldown: 8.0, icon: '🔱',
    description: 'Dash forward, damaging enemies in your path.',
    allowedWeapons: [WeaponType.SWORD, WeaponType.RUNEBLADE],
  },

  // ── BOW ───────────────────────────────────────────────────────────────
  {
    id: 'BOW_Q', sourceWeapon: WeaponType.BOW, sourceKey: 'Q',
    name: 'Frostbite', cooldown: 5.0, icon: '🎯',
    description: 'Fires 5 arrows in an arc. An enemy can be hit by multiple arrows at close range. 8 second cooldown.',
    allowedWeapons: [WeaponType.BOW, WeaponType.SCYTHE, WeaponType.RUNEBLADE],
  },
  {
    id: 'BOW_E', sourceWeapon: WeaponType.BOW, sourceKey: 'E',
    name: 'Viper Sting', cooldown: 2.0, icon: '🐉',
    description: 'Fires a laced arrow that applies VENOM damage over time to the target, preventing shield regeneration for 6 seconds.',
    allowedWeapons: [WeaponType.BOW, WeaponType.SCYTHE],
  },
  {
    id: 'BOW_R', sourceWeapon: WeaponType.BOW, sourceKey: 'R',
    name: 'Reaping Talons', cooldown: 2.0, icon: '🪶',
    description: 'Fires a powerful piercing arrow that returns to you. Each hit heals you for 2 HP each when orbs are returned. 7 second cooldown.',
    allowedWeapons: [WeaponType.BOW],
  },
  {
    id: 'BOW_F', sourceWeapon: WeaponType.BOW, sourceKey: 'F',
    name: 'Rejuvenating Shot', cooldown: 4.0, icon: '🍃',
    description: 'Fires a healing projectile that restores 80 HP to the first allied player it hits.',
    allowedWeapons: [WeaponType.SCYTHE, WeaponType.BOW],
  },
  {
    id: 'BOW_P', sourceWeapon: WeaponType.BOW, sourceKey: 'P',
    name: 'Tempest Rounds', cooldown: 0, icon: '🏹',
    description: ' Replaces primary attack with a 3-round burst attack. Each arrow deals 30 damage.',
    allowedWeapons: [WeaponType.BOW],
  },

  // ── SCYTHE ────────────────────────────────────────────────────────────
  {
    id: 'SCYTHE_Q', sourceWeapon: WeaponType.SCYTHE, sourceKey: 'Q',
    name: 'Sunwell', cooldown: REANIMATE_SUNWELL_COOLDOWN_SEC, icon: '🔆',
    description: 'Heals you and nearby allies for 15 HP.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'SCYTHE_E', sourceWeapon: WeaponType.SCYTHE, sourceKey: 'E',
    name: 'Coldsnap', cooldown: 12.0, icon: '❄️',
    description: 'Conjures an explosive ice vortex that applies FREEZE to enemies, immobilizing them for 6 seconds.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'SCYTHE_R', sourceWeapon: WeaponType.SCYTHE, sourceKey: 'R',
    name: 'Crossentropy', cooldown: 2.0, icon: '🔥',
    description: 'Charges for 1 second to fire an accelerating plasma bolt that explodes on impact. 8 second cooldown.',
    allowedWeapons: [WeaponType.SCYTHE],
  },
  {
    id: 'SCYTHE_F', sourceWeapon: WeaponType.SCYTHE, sourceKey: 'F',
    name: 'Mantra', cooldown: 5.0, icon: '🪬',
    description: 'Summons a totem that lasts for 8 seconds that blasts nearby enemies within range. 7 second cooldown',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'SCYTHE_P', sourceWeapon: WeaponType.SCYTHE, sourceKey: 'P',
    name: 'Icebeam', cooldown: 0, icon: '🧊',
    description: 'Replaces your primary attack with Icebeam, a channeled beam that ramps up damage the longer it is maintained.',
    allowedWeapons: [WeaponType.SCYTHE],
  },

  // ── SABRES ────────────────────────────────────────────────────────────
  {
    id: 'SABRES_Q', sourceWeapon: WeaponType.SABRES, sourceKey: 'Q',
    name: 'Backstab', cooldown: 2.0, icon: '🔪',
    description: 'Strikes through enemies, dealing massive bonus damage if attacking the target from behind. 4 second cooldown.',
    allowedWeapons: [WeaponType.SABRES],
  },
  {
    id: 'SABRES_E', sourceWeapon: WeaponType.SABRES, sourceKey: 'E',
    name: 'Flourish', cooldown: 1.5, icon: '💥',
    description: 'Unleash a flurry of close-range slashes. Applies a 4 second STUN to enemies that are hit by this ability a third time. 1.5 second cooldown.',
    allowedWeapons: [WeaponType.SABRES, WeaponType.RUNEBLADE],
  },
  {
    id: 'SABRES_R', sourceWeapon: WeaponType.SABRES, sourceKey: 'R',
    name: 'Divebomb', cooldown: 6.0, icon: '🐦‍🔥',
    description: 'Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below. 8 second cooldown.',
    allowedWeapons: [WeaponType.SABRES, WeaponType.RUNEBLADE],
  },
  {
    id: 'SABRES_F', sourceWeapon: WeaponType.SABRES, sourceKey: 'F',
    name: 'Accretion', cooldown: 10.0, icon: '🌑',
    description: 'Enter stealth, becoming invisible to enemies for 5 seconds. Breaking stealth with an attack deals double damage and cannot be blocked.',
    allowedWeapons: [WeaponType.SABRES],
  },

  // ── SPEAR ─────────────────────────────────────────────────────────────
  {
    id: 'SPEAR_Q', sourceWeapon: WeaponType.SPEAR, sourceKey: 'Q',
    name: 'Wind Shear', cooldown: 4.0, icon: '💨',
    description: 'Hold to charge for up to 2 seconds, then release to throw your spear. The spear flies forward, damaging all enemies it passes through, then returns to you, damaging enemies again.',
    allowedWeapons: [WeaponType.SPEAR],
  },
  {
    id: 'SPEAR_E', sourceWeapon: WeaponType.SPEAR, sourceKey: 'E',
    name: 'Tempest Sweep', cooldown: 3.0, icon: '🌪️',
    description: 'Hold to charge for up to 2 seconds, then release to damage all nearby enemies around you for 50 to 400 based on charge time.',
    allowedWeapons: [WeaponType.SPEAR, WeaponType.RUNEBLADE],
  },
  {
    id: 'SPEAR_R', sourceWeapon: WeaponType.SPEAR, sourceKey: 'R',
    name: 'Lightning Bolt', cooldown: 3.0, icon: '⚡',
    description: `Calls down a lightning bolt on a random enemy within range, dealing ${LIGHTNING_BOLT_ROOM_DAMAGE} + ${LIGHTNING_BOLT_ROOM_DAMAGE_PER_AGILITY} damage per point of AGILITY and applying ${LIGHTNING_BOLT_ROOM_STAGGER} stagger.`,
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'SPEAR_F', sourceWeapon: WeaponType.SPEAR, sourceKey: 'F',
    name: 'Storm Shroud', cooldown: 10.0, icon: '🌩️',
    description: 'Enter a frenzied state for 5 seconds, doubling your attack speed. Each successful hit heals you for 15 HP.',
    allowedWeapons: [WeaponType.SPEAR, WeaponType.RUNEBLADE, WeaponType.SABRES],
  },

  // ── ROOM ACTIVE BOON ABILITIES ────────────────────────────────────────
  {
    id: 'RAISE_DEAD', sourceWeapon: WeaponType.NONE, sourceKey: 'R',
    name: 'Raise Dead', cooldown: 15.0, icon: '💀',
    description: 'Instantly summons one allied zombie at your position. Subject to the 3-zombie cap; benefits from all owned zombie boons.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'METEOR_STRIKE', sourceWeapon: WeaponType.NONE, sourceKey: 'R',
    name: 'Meteor', cooldown: 8.0, icon: '☄️',
    description: 'Calls down 1 meteor on the nearest enemy within range, with a 15% chance to call a second and a 5% chance to call a third. Meteors deal 240 AoE damage.',
    allowedWeapons: ALL_WEAPONS,
  },
  {
    id: 'AEGIS_ROOM', sourceWeapon: WeaponType.NONE, sourceKey: 'R',
    name: 'Aegis', cooldown: 8.0, icon: '🛡️',
    description: 'Creates a protective barrier that blocks all incoming damage for 3 seconds.',
    allowedWeapons: ALL_WEAPONS,
  },
];

/** Look up a universal ability by its id. Returns undefined if not found. */
export function getUniversalAbilityById(id: string): UniversalAbility | undefined {
  return universalAbilityPool.find(a => a.id === id);
}

/** Returns an empty loadout (no abilities selected) */
export function getDefaultLoadout(): AbilityLoadout {
  return { Q: null, E: null, R: null };
}

/** Returns the pre-selected default loadout for a given weapon */
export function getDefaultLoadoutForWeapon(weapon: WeaponType): AbilityLoadout {
  switch (weapon) {
    case WeaponType.NONE:
      return getDefaultLoadout();
    case WeaponType.RUNEBLADE:
      return { Q: 'RUNEBLADE_E', E: 'RUNEBLADE_R', R: null }; // Wraith Strike / Colossus Smite / (R unlocks later)
    case WeaponType.SCYTHE:
      return { Q: 'SCYTHE_F', E: 'SCYTHE_R', R: null }; // Mantra / Crossentropy / (R unlocks later)
    case WeaponType.SPEAR:
      return { Q: 'SPEAR_Q', E: 'SPEAR_E', R: 'SPEAR_F' }; // Wind Shear / Tempest Sweep / Storm Shroud
    case WeaponType.BOW:
      return { Q: 'BOW_Q', E: 'BOW_R', R: null }; // Frostbite / Reaping Talons / (R unlocks later)
    case WeaponType.SABRES:
      return { Q: 'SABRES_Q', E: 'SABRES_E', R: 'SABRES_R' }; // Backstab / Flourish / Divebomb
    default:
      return { Q: null, E: null, R: null };
  }
}

/** True when Q and E are filled, and R is filled if this weapon’s baseline default includes R. */
export function isAbilityLoadoutCompleteForWeapon(weapon: WeaponType, loadout: AbilityLoadout): boolean {
  if (loadout.Q == null || loadout.E == null) return false;
  const baselineR = getDefaultLoadoutForWeapon(weapon).R;
  if (baselineR === null) return true;
  return loadout.R != null;
}

// Weapon abilities data - extracted from HotkeyPanel for reuse
export const weaponAbilities: Record<WeaponType, AbilityData[]> = {
  [WeaponType.NONE]: [],
  [WeaponType.SWORD]: [
    {
      name: 'Fullguard',
      key: 'Q',
      cooldown: 7.0,
      description: 'Creates a protective barrier that blocks all incoming damage for 3 seconds. Cannot attack while shielded.'
    },
    {
      name: 'Charge',
      key: 'E',
      cooldown: 8.0,
      description: 'Dash forward, damaging enemies in your path.'
    },
    {
      name: 'Colossus Strike',
      key: 'R',
      cooldown: 5.0,
      description: 'Calls down a lightning bolt that deals massive damage to the nearest enemy.'
    },
    {
      name: 'Divine Wind',
      key: 'F',
      cooldown: 1.5,
      description: 'Charges a gust of wind that launches your sword forward, dealing 120 piercing damage to enemies hit. Hitting an enemy player reduces the cooldown of Charge by 4 seconds.'
    },
    {
      name: 'Titan\'s Breath',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Increases maximum health by 350 and health regeneration to 30 HP per second outside of combat.',
      isPassive: true
    }
  ],
  [WeaponType.BOW]: [
    {
      name: 'Frost Bite',
      key: 'Q',
      cooldown: 5.0,
      description: 'Fires 5 arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds. An enemy can be hit by multiple arrows at close range.'
    },
    {
      name: 'Viper Sting',
      key: 'E',
      cooldown: 2.0,
      description: 'Fires a laced arrow that applies VENOM damage over time to the target, preventing shield regeneration for 6 seconds.'
    },
    {
      name: 'Reaping Talons',
      key: 'R',
      cooldown: 2.0,
      description: 'Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 4 HP each when returned.'
    },
    {
      name: 'Rejuvenating Shot',
      key: 'F',
      cooldown: 4.0,
      description: 'Fires a healing projectile that restores 80 HP to the first allied player it hits.'
    },
    {
      name: 'Tempest Rounds',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Replaces primary attack with a 3-round burst attack. Each arrow deals 30 damage.',
      isPassive: true
    }
  ],
  [WeaponType.SCYTHE]: [
    {
      name: 'Sunwell',
      key: 'Q',
      cooldown: REANIMATE_SUNWELL_COOLDOWN_SEC,
      description: 'Heals you and nearby allies for 60 HP.'
    },
    {
      name: 'Coldsnap',
      key: 'E',
      cooldown: 12.0,
      description: 'Conjures an explosive ice vortex that applies FREEZE to enemies, immobilizing them for 6 seconds.'
    },
    {
      name: 'Crossentropy',
      key: 'R',
      cooldown: 2.0,
      description: 'Charges for 1 second to fire an accelerating plasma bolt that deals 200 damage.'
    },
    {
      name: 'Mantra',
      key: 'F',
      cooldown: 5.0,
      description: 'Summons a totem that attacks nearby enemies and enemy players within range for 8 seconds.'
    },
    {
      name: 'Icebeam',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Replaces your primary attack with Icebeam, a channeled beam that ramps up damage the longer it is maintained.',
      isPassive: true
    }
  ],
  [WeaponType.SABRES]: [
    {
      name: 'Backstab',
      key: 'Q',
      cooldown: 2.0,
      description: 'Strikes the target with both sabres, dealing 75 damage or triple damage if attacking the target from behind.'
    },
    {
      name: 'Flourish',
      key: 'E',
      cooldown: 1.5,
      description: 'Unleash a flurry of slashes that regenerates 45 SHIELD and deals increased damage with successive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.'
    },
    {
      name: 'Divebomb',
      key: 'R',
      cooldown: 6.0,
      description: 'Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below.'
    },
    {
      name: 'Event Horizon',
      key: 'F',
      cooldown: 10.0,
      description: 'Doubles the damage of your primary attack for 5 seconds while applying TAUNT to enemies, forcing them to attack you.'
    },
    {
      name: 'Cutthroat Oath',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Permanently increases critical strike chance by 30%.',
      isPassive: true
    }
  ],
  [WeaponType.RUNEBLADE]: [
    {
      name: 'Aegis',
      key: 'Q',
      cooldown: 7.0,
      description: 'Creates a protective barrier that blocks all incoming damage for 3 seconds.'
    },
    {
      name: 'Oathblade',
      key: 'E',
      cooldown: 3.0,
      description: 'A swift strike that applies SLOW and TAUNT to enemies hit, forcing them to attack you for up to 10 seconds.'
    },
    {
      name: 'Colossus Smite',
      key: 'R',
      cooldown: 3.0,
      description: 'Calls down a pillar of radiant energy, dealing damage to enemy players in a small area, healing you for the same amount of damage dealt.'
    },
    {
      name: 'Titan\'s Grip',
      key: 'F',
      cooldown: 0, 
      description: 'Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.'
    },
    {
      name: 'Bloodpact',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Heals for 15% of all attack damage dealt.',
      isPassive: true
    }
  ],
  [WeaponType.SPEAR]: [
    {
      name: 'Wind Shear',
      key: 'Q',
      cooldown: 4.0,
      description: 'Hold to charge for up to 2 seconds, then release to throw your spear. The spear flies forward, damaging all enemies it passes through, then returns to you, damaging enemies again. Distance and damage scale from 50 to 200 based on charge time.'
    },
    {
      name: 'Tempest Sweep',
      key: 'E',
      cooldown: 3.0,
      description: 'Hold to charge for up to 2 seconds, then release to damage all nearby enemies around you for 50 to 400 based on charge time.'
    },
    {
      name: 'Lightning Bolt',
      key: 'R',
      cooldown: 1.0,
      description: `Calls down a lightning bolt on the highest priority enemy in the map, dealing ${LIGHTNING_BOLT_ROOM_DAMAGE} + ${LIGHTNING_BOLT_ROOM_DAMAGE_PER_AGILITY} damage per point of AGILITY and applying ${LIGHTNING_BOLT_ROOM_STAGGER} stagger.`
    },
    {
      name: 'Storm Shroud',
      key: 'F',
      cooldown: 10.0,
      description: 'Enter a frenzied state for 5 seconds, doubling your attack speed. Each successful hit heals you for 15 HP.'
    },
    {
      name: 'Tempest',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Increases movement speed by 10% and attack speed by 5%.',
      isPassive: true
    }
  ],
  [WeaponType.KNIGHT]: []
};

// Ability icons mapping
export const abilityIcons: Record<WeaponType, Partial<Record<'Q' | 'E' | 'R' | 'F' | 'P', string>>> = {
  [WeaponType.NONE]: {},
  [WeaponType.SWORD]: {
    Q: '🛡️', // Fullguard
    E: '🔱', // Charge
    R: '⚜️', // Colossus Strike
    F: '🌪', // Divine Wind
    P: '⚜️' // Titan's Breath
  },
  [WeaponType.BOW]: {
    Q: '🐉', // Barrage
    E: '🐉', // Cobra Shot
    R: '🪶', // Viper Sting
    F: '🍃', // Rejuvenating Shot
    P: '🍃' // Tempest Rounds 
  },
  [WeaponType.SCYTHE]: {
    Q: '🔆', // Sunwell
    E: '❄️', // Coldsnap
    R: '🔥', // Crossentropy
    F: '🪬', // Totem
    P: '🧊' // Icebeam
  },
  [WeaponType.SABRES]: {
    Q: '🔪', // Backstab
    E: '💥', // Flourish
    R: '🐦‍🔥', // Divebomb
    F: '🌑', // Shadow Step
    P: '☠️' // Lethality
  },
  [WeaponType.RUNEBLADE]: {
    Q: '🛡️', // Fullguard
    E: '🗡️', // Wraithblade
    R: '⚜️', // Hexed Smite
    F: '💠', // Heartrend
    P: '🩸' // Bloodpact
  },
  [WeaponType.SPEAR]: {
    Q: '💨', // Throw Spear
    E: '🌪️', // Whirlwind
    R: '⚡️', // Lightning Storm
    F: '🌩️', // Flurry
    P: '🌩️' // Tempest
  },
  [WeaponType.KNIGHT]: {},
};

// Helper function to get ability iconxw
export function getAbilityIcon(weapon: WeaponType, key: 'Q' | 'E' | 'R' | 'F' | 'P'): string {
  return abilityIcons[weapon]?.[key] || '❓';
}
