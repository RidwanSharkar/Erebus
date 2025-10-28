import { WeaponType } from '@/components/dragon/weapons';

export interface AbilityData {
  name: string;
  key: 'Q' | 'E' | 'R' | 'F' | 'P';
  cooldown: number;
  description: string;
  isPassive?: boolean;
}

// Weapon abilities data - extracted from HotkeyPanel for reuse
export const weaponAbilities: Record<WeaponType, AbilityData[]> = {
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
      description: 'Dash forward, instantly generating 25 rage and damaging enemies in your path.'
    },
    {
      name: 'Colossus Strike',
      key: 'R',
      cooldown: 5.0,
      description: '{25+ RAGE} Consumes all rage to execute an enemy player, calling down a lightning bolt that deals increasing damage based on the amount of rage consumed.'
    },
    {
      name: 'Divine Wind',
      key: 'F',
      cooldown: 1.5,
      description: '{10 RAGE} Charges a gust of wind that launches your sword forward, dealing 120 piercing damage to enemies hit. Hitting an enemy player reduces the cooldown of Charge by 4 seconds.'
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
      description: '{50 ENERGY} Fires 5 arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds. An enemy can be hit by multiple arrows at close range.'
    },
    {
      name: 'Viper Sting',
      key: 'E',
      cooldown: 2.0,
      description: '{60 ENERGY} Fires a laced arrow that applies VENOM damage over time to the target, preventing shield regeneration for 6 seconds.'
    },
    {
      name: 'Reaping Talons',
      key: 'R',
      cooldown: 2.0,
      description: '{60 ENERGY} Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 20 HP each when returned.'
    },
    {
      name: 'Rejuvenating Shot',
      key: 'F',
      cooldown: 4.0,
      description: '{40 ENERGY} Fires a healing projectile that restores 80 HP to the first allied player it hits.'
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
      cooldown: 1.0,
      description: '{30 MANA} Transmutes mana to heal you and nearby allies for 60 HP.'
    },
    {
      name: 'Coldsnap',
      key: 'E',
      cooldown: 12.0,
      description: '{50 MANA} Conjures an explosive ice vortex that applies FREEZE to enemies, immobilizing them for 6 seconds.'
    },
    {
      name: 'Crossentropy',
      key: 'R',
      cooldown: 2.0,
      description: '{30 MANA} Charges for 1 second to fire an accelerating plasma bolt that deals 200 damage.'
    },
    {
      name: 'Mantra',
      key: 'F',
      cooldown: 5.0,
      description: '{75 MANA} Summons a totem that heals you and allies for 40 HP per second while within its range. Lasts 8 seconds.'
    },
    {
      name: 'Cryoflame',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Modifies primary attack to deal increased damage. Cryoflame Bolts deal double damage to enemies afflicted by FREEZE.',
      isPassive: true
    }
  ],
  [WeaponType.SABRES]: [
    {
      name: 'Backstab',
      key: 'Q',
      cooldown: 2.0,
      description: '{60 ENERGY} Strikes the target with both sabres, dealing 75 damage or triple damage if attacking the target from behind. Refund all energy spent if the target is stunned.'
    },
    {
      name: 'Flourish',
      key: 'E',
      cooldown: 1.5,
      description: '{35 ENERGY} Unleash a flurry of slashes that regenerates 45 SHIELD and deals increased damage with successive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.'
    },
    {
      name: 'Divebomb',
      key: 'R',
      cooldown: 6.0,
      description: '{40 ENERGY} Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below.'
    },
    {
      name: 'Event Horizon',
      key: 'F',
      cooldown: 10.0,
      description: '{20 ENERGY} Doubles the damage of your primary attack for 5 seconds while applying TAUNT to enemies, forcing them to attack you.'
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
      description: '{35 MANA} A swift strike that applies SLOW and TAUNT to enemies hit, forcing them to attack you for up to 10 seconds.'
    },
    {
      name: 'Colossus Smite',
      key: 'R',
      cooldown: 3.0,
      description: '{45 MANA} Calls down a pillar of radiant energy, dealing damage to enemy players in a small area, healing you for the same amount of damage dealt.'
    },
    {
      name: 'Titan\'s Grip',
      key: 'F',
      cooldown: 0, 
      description: '{20 MANA/S} Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.'
    },
    {
      name: 'Bloodpact',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Reduces mana costs by 10% and heals for 15% of all attack damage dealt.',
      isPassive: true
    }
  ],
  [WeaponType.SPEAR]: [
    {
      name: 'Wind Shear',
      key: 'Q',
      cooldown: 4.0,
      description: 'Hold to charge for up to 2 seconds, then release to throw your spear. The spear flies forward, damaging all enemies it passes through, then returns to you, damaging enemies again. Distance and damage scale from 50 to 200 based on charge time. Generates 5 - 20 Charge.'
    },
    {
      name: 'Tempest Sweep',
      key: 'E',
      cooldown: 3.0,
      description: 'Hold to charge for up to 2 seconds, then release to damage all nearby enemies around you for 50 to 400 based on charge time. Generates 1- 20 Charge. Increases attack speed by 1% for each Charge possessed.'
    },
    {
      name: 'Lightning Bolt',
      key: 'R',
      cooldown: 1.0,
      description: '{15 CHARGE} Calls down a lightning bolt on the highest priority enemy in the map, dealing 117 damage.'
    },
    {
      name: 'Storm Shroud',
      key: 'F',
      cooldown: 10.0,
      description: '{40 CHARGE} Enter a frenzied state for 5 seconds, doubling your attack speed. Each successful hit heals you for 15 HP.'
    },
    {
      name: 'Tempest',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Increases movement speed by 10% and attack speed by 5%.',
      isPassive: true
    }
  ]
};

// Ability icons mapping
export const abilityIcons: Record<WeaponType, Partial<Record<'Q' | 'E' | 'R' | 'F' | 'P', string>>> = {
  [WeaponType.SWORD]: {
    Q: '🛡️', // Fullguard
    E: '🔱', // Charge
    R: '⚡️', // Colossus Strike
    F: '🌪', // Divine Wind
    P: '⚜️' // Titan's Breath
  },
  [WeaponType.BOW]: {
    Q: '🎯', // Barrage
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
    P: '💠' // Cryoflame
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
    R: '⚡️', // Hexed Smite
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
};

// Helper function to get ability iconxw
export function getAbilityIcon(weapon: WeaponType, key: 'Q' | 'E' | 'R' | 'F' | 'P'): string {
  return abilityIcons[weapon]?.[key] || '❓';
}
