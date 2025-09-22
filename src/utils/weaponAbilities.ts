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
      name: 'Reckless Abandon',
      key: 'E',
      cooldown: 8.0,
      description: 'Dash forward, instantly gaining 25 rage, damaging enemies in your path.'
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
      description: '{10 RAGE} Throws your sword forward in a gust of wind, dealing 80 piercing damage to enemies hit within 15 units. Hitting an enemy player reduces the cooldown of Reckless Abandon by 4 seconds.'
    },
    {
      name: 'Titan\'s Breath',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Increases maximum health by 350 and health regeneration to 30 HP/s outside of combat.',
      isPassive: true
    }
  ],
  [WeaponType.BOW]: [
    {
      name: 'Frost Bite',
      key: 'Q',
      cooldown: 5.0,
      description: '{50 ENERGY} Fires 5 frost arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds.'
    },
    {
      name: 'Cobra Shot',
      key: 'E',
      cooldown: 2.0,
      description: '{60 ENERGY} Fires a venomous shot that applies VENOM damage over time to the target.'
    },
    {
      name: 'Hydra Sting',
      key: 'R',
      cooldown: 2.0,
      description: '{60 ENERGY} Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 20 HP each when returned.'
    },
    {
      name: 'Cloud Fang',
      key: 'F',
      cooldown: 4.0,
      description: '{40 ENERGY} Summons green arrows from the sky that rain down on enemy locations.'
    },
    {
      name: 'Tempest Rounds',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Replaces charge shots with a 3-round burst attack. Each arrow deals 30 damage with 1 second cooldown between bursts.',
      isPassive: true
    }
  ],
  [WeaponType.SCYTHE]: [
    {
      name: 'Sunwell',
      key: 'Q',
      cooldown: 1.0,
      description: '{20 MANA} Transmutes mana to heal you for 60 HP.'
    },
    {
      name: 'Coldsnap',
      key: 'E',
      cooldown: 12.0,
      description: '{50 MANA} Conjures a ice vortex that applies FREEZE to enemy players around you, immobilizing them for 6 seconds.'
    },
    {
      name: 'Crossentropy',
      key: 'R',
      cooldown: 2.0,
      description: '{40 MANA} Charges for 1 second to fire a devastating accelerating flaming bolt that deals 20 additional damage per stack of BURNING.'
    },
    {
      name: 'Mantra',
      key: 'F',
      cooldown: 5.0,
      description: '{75 MANA} Summons a totem that heals you for 20 HP per second and attacks nearby enemy players for 25 damage every 0.5 seconds. Lasts 8 seconds.'
    },
    {
      name: 'Cryoflame',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Modifies Entropic Bolts to deal increased damage but no longer apply the BURNING effect. Cryoflame Bolts deal double damage to enemies afflicted with FREEZE.',
      isPassive: true
    }
  ],
  [WeaponType.SABRES]: [
    {
      name: 'Backstab',
      key: 'Q',
      cooldown: 2.0,
      description: '{60 ENERGY} Strikes the target with both sabres, dealing 75 damage or 175 damage if attacking the target from behind. Refunds 45 energy if target isstunned.'
    },
    {
      name: 'Flourish',
      key: 'E',
      cooldown: 1.5,
      description: '{35 ENERGY} Unleash a flurry of slashes that deals increased damage with successive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.'
    },
    {
      name: 'Divebomb',
      key: 'R',
      cooldown: 6.0,
      description: '{40 ENERGY} Leap high into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies below.'
    },
    {
      name: 'Shadow Step',
      key: 'F',
      cooldown: 10.0,
      description: 'Fade into the shadows, becoming INVISIBLE for 5 seconds after a brief delay.'
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
      name: 'Void Grasp',
      key: 'Q',
      cooldown: 5.0,
      description: '{35 MANA} Fires a twisting nether that pulls the first enemy hit towards you.'
    },
    {
      name: 'Wraithblade',
      key: 'E',
      cooldown: 3.0,
      description: '{35 MANA} Unleashes a powerful strike that inflicts CORRUPTED debuff to the target, reducing their movement speed by 90%, regaining 10% movement speed per second.'
    },
    {
      name: 'Hexed Smite',
      key: 'R',
      cooldown: 3.0,
      description: '{45 MANA} Calls down unholy energy, dealing damage to enemies in a small area and healing you for 80 HP.'
    },
    {
      name: 'Heartbreak',
      key: 'F',
      cooldown: 0, // No cooldown, it's a toggle ability
      description: '{24 MANA/S} Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.'
    },
    {
      name: 'Bloodpact',
      key: 'P',
      cooldown: 0,
      description: '{PASSIVE} Reduces mana costs by 10% and heals for 10% of basic attack damage (including crits) while equipped.',
      isPassive: true
    }
  ]
};

// Ability icons mapping
export const abilityIcons: Record<WeaponType, Partial<Record<'Q' | 'E' | 'R' | 'F' | 'P', string>>> = {
  [WeaponType.SWORD]: {
    Q: '🛡️', // Aegis
    E: '🔱', // Charge
    R: '⚡️', // Colossus Strike
    F: '🗡️', // Wind Shear
    P: '⚜️' // Titan's Breath
  },
  [WeaponType.BOW]: {
    Q: '🎯', // Barrage
    E: '🐍', // Cobra Shot
    R: '🪶', // Viper Sting
    F: '🍃', // Cloudkill
    P: '🐉' // Tempest Rounds 

  },
  [WeaponType.SCYTHE]: {
    Q: '🔆', // Sunwell
    E: '❄️', // Coldsnap
    R: '☄️', // Crossentropy
    F: '🪬', // Totem
    P: '💠' // Cryoflame
  },
  [WeaponType.SABRES]: {
    Q: '🔪', // Backstab
    E: '💥', // Flourish
    R: '🐦‍🔥', // Divebomb
    F: '🌒', // Shadow Step
    P: '💀' // Lethality
  },
  [WeaponType.RUNEBLADE]: {
    Q: '⛓️', // Void Grasp
    E: '🪝', // Wraithblade
    R: '👻', // Haunting Smite
    F: '💔', // Heartbreak
    P: '🩸' // Bloodpact
  },
};

// Helper function to get ability iconxw
export function getAbilityIcon(weapon: WeaponType, key: 'Q' | 'E' | 'R' | 'F' | 'P'): string {
  return abilityIcons[weapon]?.[key] || '❓';
}
