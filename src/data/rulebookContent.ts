import { WeaponType } from '@/components/dragon/weapons';
import type { TalentId } from '@/utils/talents';
import {
  TALENT_TRINITY,
  TALENT_VENGEANCE,
  TALENT_CRUSADER,
  TALENT_WINDFURY,
  TALENT_BLIZZARD,
  TALENT_DOUBLE_STRIKE,
  TALENT_SPELLBLADE,
  TALENT_CYCLONE_RUSH,
  TALENT_BREATH_WEAPON,
  TALENT_MORTAL_STRIKE,
  TALENT_EXECUTIONER,
  TALENT_TITANS_GRIP,
  TALENT_RELENTLESS,
  TALENT_KILLSTREAK,
  TALENT_CRESCENT_BLADES,
  TALENT_VORPAL_GUST,
  TALENT_FAN_OF_KNIVES,
  TALENT_PARRY,
  TALENT_WIND_SHEAR,
  TALENT_DOUBLE_STAB,
  TALENT_PSIONIC_BLADES,
  TALENT_FIRE_AFFINITY,
  TALENT_TEMPEST_ROUNDS,
  TALENT_DUAL_COIL,
  TALENT_EXECUTE,
  TALENT_CONCENTRATED_VOLLEY,
  TALENT_EXPLOSIVE_TALONS,
  TALENT_GIANTKILLER,
  TALENT_HIGH_CALIBER,
  TALENT_TRIGGER_FINGER,
  TALENT_ENTANGLEMENT,
  TALENT_CLOUDKILL,
  TALENT_WYVERN_STING,
  TALENT_DOUBLE_TALONS,
  TALENT_ICEBEAM,
  TALENT_REAPER,
  TALENT_SHAMAN,
  TALENT_FROSTPATH,
  TALENT_SOLAR_RECHARGE,
  TALENT_SUPERCONDUCTOR,
  TALENT_ACCELERATOR,
  TALENT_HEALING_STREAM,
  TALENT_METEOR,
  TALENT_FRAGMENTATION,
  TALENT_ARCANE_SYNERGY,
  TALENT_STAGGER_SHOT,
  TALENT_ARCTIC_STING,
  TALENT_WRATHFUL_SHOTS,
  TALENT_WYVERN_BITE,
  TALENT_WRATHFUL_BITE,
  TALENT_STAGGERING_BITE,
  TALENT_GLACIAL_BITE,
  TALENT_WYVERN_TALONS,
  TALENT_WRATHFUL_TALONS,
  TALENT_STAGGERING_TALONS,
  TALENT_GLACIAL_TALONS,
  TALENT_INFESTED_COMBO,
  TALENT_WRATHFUL_COMBO,
  TALENT_STAGGERING_COMBO,
  TALENT_GUARD_COMBO,
  TALENT_INFESTED_STRIKE,
  TALENT_WRATH_STRIKE,
  TALENT_STAGGERING_STRIKE,
  TALENT_WRAITH_GUARD,
  TALENT_INFESTED_SMITE,
  TALENT_INFERNAL_SMITE,
  TALENT_STAGGERING_SMITE,
  TALENT_COLOSSUS_GUARD,
  TALENT_WRATHFUL_ENTROPIC,
  TALENT_STAGGERING_ENTROPIC,
  TALENT_INFESTING_ENTROPIC,
  TALENT_ARCTIC_SHARDS,
  TALENT_WRATHFUL_TOTEM,
  TALENT_STAGGERING_TOTEM,
  TALENT_INFESTING_TOTEM,
  TALENT_FROST_TOTEM,
  TALENT_CROSSENTROPY_TEMPEST,
  TALENT_CROSSENTROPY_PLAGUE,
  TALENT_INFERNO,
  TALENT_GLACIAL_STORM,
  TALENT_STAGGERING_SWIPES,
  TALENT_WRATHFUL_SABRES_SWIPES,
  TALENT_INFESTING_SABRES_SWIPES,
  TALENT_GUARD_SABRES_SWIPES,
  TALENT_STAGGERING_STAB,
  TALENT_WRATHFUL_STAB,
  TALENT_INFESTED_BACKSTAB,
  TALENT_GUARD_SABRES_STAB,
  TALENT_STAGGERING_FLOURISH,
  TALENT_WRATHFUL_FLOURISH,
  TALENT_INFESTED_FLOURISH,
  TALENT_GUARD_SABRES_FLOURISH,
  TALENT_DASH_GUARD,
  TALENT_INFERNAL_DASH,
  TALENT_GLACIAL_DASH,
  TALENT_MENDING_DASH,
  TALENT_STAGGERING_DASH,
  TALENT_RAISE_DEAD,
  TALENT_ORB_SHIELD,
  TALENT_JUGGERNAUT_STRAIN,
  TALENT_BERSERKER_STRAIN,
  TALENT_EXPLODER_STRAIN,
  TALENT_PACK_HUNTER,
  TALENT_NECROS_INITIATE,
  TALENT_LIGHTNING_BOLT_ROOM,
  TALENT_OVERSHOCK,
  TALENT_GUARDBREAK,
  TALENT_UNSTABLE_ENERGY,
  TALENT_TEMPEST_INITIATE,
  TALENT_OVERCLOCK,
  TALENT_OVERRIDE,
  TALENT_COLDSNAP_ROOM,
  TALENT_AEGIS_ROOM,
  TALENT_MOMENTUM_RIFT,
  TALENT_MANA_SHIELD,
  TALENT_HAILSTORM,
  TALENT_ABYSSAL_INITIATE,
  TALENT_AWAKENED_EYE,
  TALENT_METEOR_STRIKE,
  TALENT_REBUKE,
  TALENT_BLOODLEECH,
  TALENT_INFERNAL_INITIATE,
  TALENT_FISSION,
  TALENT_BLOOD_ORBS,
  TALENT_BLOODMAGE,
  TALENT_DEATHWISH,
  TALENT_MAGMA_CURRENT,
  TALENT_TYRANTS_CLOAK,
  TALENT_LEGION,
  TALENT_HELLFIRE_VENOM,
  TALENT_FORCE_OF_NATURE,
  TALENT_STORM_WITCH,
  TALENT_FROST_QUEEN,
  TALENT_DUALITY,
  TALENT_FATEBREAKER,
  TALENT_ACID_RAIN,
  TALENT_MONSOON,
  TALENT_SPELL_THIEF,
  TALENT_DIVINE_COLD,
  TALENT_PYROMANIA,
  TALENT_STORM_SHIELD,
  TALENT_LETHAL_INJECTION,
} from '@/utils/talents';

export type StatBadge = 'STR' | 'STA' | 'AGI' | 'INT';

export interface RulebookTalentEntry {
  id: TalentId;
  /** Optional passive marker shown next to the name (e.g. replaces LMB). */
  passive?: boolean;
  /** Optional scaling badge. */
  stat?: StatBadge;
  /** Optional note for R-hotkey spell boons. */
  rSpell?: boolean;
}

export interface RulebookTocItem {
  id: string;
  label: string;
}

export const RULEBOOK_TOC: readonly RulebookTocItem[] = [
  { id: 'basics', label: '1. Basics' },
  { id: 'stats', label: '2. Stats' },
  { id: 'weapons', label: '3. Weapons' },
  { id: 'archetypes', label: '4. Archetypes' },
  { id: 'ancestors', label: '5. Ancestors' },
  { id: 'talents', label: '6. Talents' },
  { id: 'primary-boons', label: '7. Primary Boons' },
  { id: 'secondary-boons', label: '8. Secondary Boons' },
  { id: 'duo-ultimate', label: '9. Duo & Ultimate' },
  { id: 'portals', label: '10. Portal Colors' },
];

export const RULEBOOK_BASICS = {
  health: {
    title: 'Health',
    body:
      'You start with 200 HP. Each level grants +20 max HP. Each point of STAMINA grants +10 max HP. Health is depleted after your shield is broken.',
  },
  shields: {
    title: 'Shields',
    body:
      'Base max shield is 25. Each point of INTELLECT grants +3 max shield. Shields absorb damage before health and regenerate after a short delay when you stop taking damage.',
  },
  dashCharge: {
    title: 'Dash Charge',
    body:
      'You have 3 dash charges. Each charge recharges in 8 seconds. Double-tap W, A, S, or D to dash in that direction. Some talents and boons consume or restore dash charges.',
  },
  energy: {
    title: 'Energy',
    body:
      'Energy starts at 100. It drains while sprinting or channeling archetype powers (Shift), then regenerates after about 2 seconds of idle. Without energy, sprint and energy-gated Shift abilities stop.',
  },
  controls: {
    title: 'Controls',
    items: [
      'WASD — Move',
      'Double-tap WASD — Dash (consumes a dash charge)',
      'Left click — Primary attack',
      'Right click — Camera',
      'Space — Jump',
      'Q / E / R / F — Abilities (loadout-dependent)',
      'Shift — Archetype power (sprint, deflect, channel, etc.)',
      'X — Interact (weapons, pillars, pedestals, allies, runes)',
      '1 / 2 — Swap primary / secondary weapon when slots differ',
    ],
  },
} as const;

export const RULEBOOK_STATS = [
  {
    key: 'strength' as const,
    label: 'STRENGTH',
    color: 'text-red-400',
    effect: '+4% critical strike damage per point',
  },
  {
    key: 'stamina' as const,
    label: 'STAMINA',
    color: 'text-green-400',
    effect: '+10 maximum health per point',
  },
  {
    key: 'agility' as const,
    label: 'AGILITY',
    color: 'text-blue-400',
    effect: '+1% critical strike chance per point',
  },
  {
    key: 'intellect' as const,
    label: 'INTELLECT',
    color: 'text-purple-400',
    effect: '+3 maximum shield per point',
  },
] as const;

export const RULEBOOK_STATS_NOTE =
  'Base critical chance is 11%. Base critical damage multiplier is 2.0×. Leveling grants +5 STAT points each level. Spend them in the Stats panel. Enemies may drop STAT runes (press X to collect).';

export type CoopRulebookWeapon =
  | typeof WeaponType.RUNEBLADE
  | typeof WeaponType.SABRES
  | typeof WeaponType.BOW
  | typeof WeaponType.SCYTHE;

export const RULEBOOK_WEAPONS: readonly {
  weapon: CoopRulebookWeapon;
  lmbSummary: string;
}[] = [
  {
    weapon: WeaponType.RUNEBLADE,
    lmbSummary: 'Melee combo chain — three hits that escalate in power.',
  },
  {
    weapon: WeaponType.SABRES,
    lmbSummary: 'Fast dual-blade flurry with stacking pressure on the same target.',
  },
  {
    weapon: WeaponType.BOW,
    lmbSummary:
      'Hold left-click to charge a shot. Release while the bow flashes for a Perfect Shot.',
  },
  {
    weapon: WeaponType.SCYTHE,
    lmbSummary: 'Hold left-click to fire Entropic Bolts in a stream (or Icebeam if that talent is active).',
  },
];

export const RULEBOOK_WEAPONS_NOTE =
  'In the throne room, stand by a floating weapon and press X to equip it. Use the ability pillar (X) to assign Q, E, and R from the shared ability pool. Boons you pick stack for the rest of the run.';

/** Class talents in display order (matches player-facing rulebook). */
export const RULEBOOK_CLASS_TALENTS: Record<
  CoopRulebookWeapon,
  readonly RulebookTalentEntry[]
> = {
  [WeaponType.RUNEBLADE]: [
    { id: TALENT_TRINITY },
    { id: TALENT_VENGEANCE },
    { id: TALENT_CRUSADER },
    { id: TALENT_WINDFURY },
    { id: TALENT_BLIZZARD },
    { id: TALENT_DOUBLE_STRIKE },
    { id: TALENT_SPELLBLADE, stat: 'INT' },
    { id: TALENT_CYCLONE_RUSH },
    { id: TALENT_BREATH_WEAPON },
    { id: TALENT_MORTAL_STRIKE },
    { id: TALENT_EXECUTIONER, stat: 'STR' },
    { id: TALENT_TITANS_GRIP },
  ],
  [WeaponType.SABRES]: [
    { id: TALENT_RELENTLESS, stat: 'STA' },
    { id: TALENT_KILLSTREAK },
    { id: TALENT_CRESCENT_BLADES },
    { id: TALENT_VORPAL_GUST },
    { id: TALENT_FAN_OF_KNIVES, stat: 'AGI' },
    { id: TALENT_PARRY },
    { id: TALENT_WIND_SHEAR, stat: 'STR' },
    { id: TALENT_DOUBLE_STAB },
    { id: TALENT_PSIONIC_BLADES, stat: 'INT' },
    { id: TALENT_FIRE_AFFINITY },
  ],
  [WeaponType.BOW]: [
    { id: TALENT_TEMPEST_ROUNDS, passive: true },
    { id: TALENT_DUAL_COIL },
    { id: TALENT_EXECUTE },
    { id: TALENT_CONCENTRATED_VOLLEY },
    { id: TALENT_EXPLOSIVE_TALONS },
    { id: TALENT_GIANTKILLER },
    { id: TALENT_HIGH_CALIBER },
    { id: TALENT_TRIGGER_FINGER },
    { id: TALENT_ENTANGLEMENT },
    { id: TALENT_CLOUDKILL },
    { id: TALENT_WYVERN_STING, stat: 'INT' },
    { id: TALENT_DOUBLE_TALONS },
  ],
  [WeaponType.SCYTHE]: [
    { id: TALENT_ICEBEAM, passive: true },
    { id: TALENT_REAPER },
    { id: TALENT_SHAMAN },
    { id: TALENT_FROSTPATH },
    { id: TALENT_SOLAR_RECHARGE },
    { id: TALENT_SUPERCONDUCTOR },
    { id: TALENT_ACCELERATOR },
    { id: TALENT_HEALING_STREAM },
    { id: TALENT_METEOR, stat: 'STR' },
    { id: TALENT_FRAGMENTATION },
    { id: TALENT_ARCANE_SYNERGY, stat: 'INT' },
  ],
};

export const RULEBOOK_CLASS_TALENTS_NOTE =
  'Class talents are offered as 1-of-3 picks when you equip a weapon in the throne room, after clearing a boss (red void portal), from some merchant purchases, and certain deep sanctum rewards. You get one throne class-boon pick per weapon equipped that run.';

export type PrimaryBoonSlotKey = 'lmb' | 'q' | 'e';

export interface PrimaryBoonSlot {
  key: PrimaryBoonSlotKey;
  label: string;
  abilityHint: string;
  variants: readonly TalentId[];
}

export const RULEBOOK_PRIMARY_BOONS_INTRO =
  'Each run has four mutually exclusive primary slots: Left-Click, Q, E, and Dash. Picking one colored variant for a slot locks out the other variants of that slot for the rest of the run. Primary ability-branch boons come from colored combat rooms (red / blue / green / purple).';

export const RULEBOOK_PRIMARY_BY_WEAPON: Record<
  CoopRulebookWeapon,
  readonly PrimaryBoonSlot[]
> = {
  [WeaponType.BOW]: [
    {
      key: 'lmb',
      label: 'Left-Click',
      abilityHint: 'Primary shot modifiers (+ Wyvern Sting from green rooms)',
      variants: [
        TALENT_STAGGER_SHOT,
        TALENT_ARCTIC_STING,
        TALENT_WRATHFUL_SHOTS,
        TALENT_WYVERN_STING,
      ],
    },
    {
      key: 'q',
      label: 'Q — Frostbite',
      abilityHint: 'Bite modifiers (requires Frostbite on Q)',
      variants: [
        TALENT_WYVERN_BITE,
        TALENT_WRATHFUL_BITE,
        TALENT_STAGGERING_BITE,
        TALENT_GLACIAL_BITE,
      ],
    },
    {
      key: 'e',
      label: 'E — Reaping Talons',
      abilityHint: 'Talons modifiers (requires Reaping Talons)',
      variants: [
        TALENT_WYVERN_TALONS,
        TALENT_WRATHFUL_TALONS,
        TALENT_STAGGERING_TALONS,
        TALENT_GLACIAL_TALONS,
      ],
    },
  ],
  [WeaponType.RUNEBLADE]: [
    {
      key: 'lmb',
      label: 'Left-Click — Combo',
      abilityHint: 'Basic attack combo branch',
      variants: [
        TALENT_INFESTED_COMBO,
        TALENT_WRATHFUL_COMBO,
        TALENT_STAGGERING_COMBO,
        TALENT_GUARD_COMBO,
      ],
    },
    {
      key: 'q',
      label: 'Q — Wraith Strike',
      abilityHint: 'Strike modifiers (requires Wraith Strike)',
      variants: [
        TALENT_INFESTED_STRIKE,
        TALENT_WRATH_STRIKE,
        TALENT_STAGGERING_STRIKE,
        TALENT_WRAITH_GUARD,
      ],
    },
    {
      key: 'e',
      label: 'E — Colossus Smite',
      abilityHint: 'Smite modifiers (requires Colossus Smite)',
      variants: [
        TALENT_INFESTED_SMITE,
        TALENT_INFERNAL_SMITE,
        TALENT_STAGGERING_SMITE,
        TALENT_COLOSSUS_GUARD,
      ],
    },
  ],
  [WeaponType.SCYTHE]: [
    {
      key: 'lmb',
      label: 'Left-Click — Entropic',
      abilityHint: 'Entropic bolt / beam branch',
      variants: [
        TALENT_WRATHFUL_ENTROPIC,
        TALENT_STAGGERING_ENTROPIC,
        TALENT_INFESTING_ENTROPIC,
        TALENT_ARCTIC_SHARDS,
      ],
    },
    {
      key: 'q',
      label: 'Q — Mantra (Totem)',
      abilityHint: 'Totem modifiers (requires Mantra)',
      variants: [
        TALENT_WRATHFUL_TOTEM,
        TALENT_STAGGERING_TOTEM,
        TALENT_INFESTING_TOTEM,
        TALENT_FROST_TOTEM,
      ],
    },
    {
      key: 'e',
      label: 'E — Crossentropy',
      abilityHint: 'Crossentropy modifiers (requires Crossentropy)',
      variants: [
        TALENT_CROSSENTROPY_TEMPEST,
        TALENT_CROSSENTROPY_PLAGUE,
        TALENT_INFERNO,
        TALENT_GLACIAL_STORM,
      ],
    },
  ],
  [WeaponType.SABRES]: [
    {
      key: 'lmb',
      label: 'Left-Click — Swipes',
      abilityHint: 'Basic attack blades branch',
      variants: [
        TALENT_STAGGERING_SWIPES,
        TALENT_WRATHFUL_SABRES_SWIPES,
        TALENT_INFESTING_SABRES_SWIPES,
        TALENT_GUARD_SABRES_SWIPES,
      ],
    },
    {
      key: 'q',
      label: 'Q — Backstab',
      abilityHint: 'Backstab modifiers (requires Backstab on Q)',
      variants: [
        TALENT_STAGGERING_STAB,
        TALENT_WRATHFUL_STAB,
        TALENT_INFESTED_BACKSTAB,
        TALENT_GUARD_SABRES_STAB,
      ],
    },
    {
      key: 'e',
      label: 'E — Flourish',
      abilityHint: 'Flourish modifiers (requires Flourish)',
      variants: [
        TALENT_STAGGERING_FLOURISH,
        TALENT_WRATHFUL_FLOURISH,
        TALENT_INFESTED_FLOURISH,
        TALENT_GUARD_SABRES_FLOURISH,
      ],
    },
  ],
};

/** Shared dash mutex slot — one colored dash per run. */
export const RULEBOOK_DASH_BOONS: readonly TalentId[] = [
  TALENT_DASH_GUARD,
  TALENT_INFERNAL_DASH,
  TALENT_GLACIAL_DASH,
  TALENT_MENDING_DASH,
  TALENT_STAGGERING_DASH,
];

export type SecondaryBoonColor = 'green' | 'blue' | 'purple' | 'red';

export interface SecondaryBoonGroup {
  color: SecondaryBoonColor;
  title: string;
  headerClass: string;
  entries: readonly RulebookTalentEntry[];
}

export const RULEBOOK_SECONDARY_BOONS: readonly SecondaryBoonGroup[] = [
  {
    color: 'green',
    title: 'Shared Green (Eldritch)',
    headerClass: 'text-emerald-400',
    entries: [
      { id: TALENT_RAISE_DEAD, rSpell: true },
      { id: TALENT_ORB_SHIELD },
      { id: TALENT_JUGGERNAUT_STRAIN },
      { id: TALENT_BERSERKER_STRAIN },
      { id: TALENT_EXPLODER_STRAIN },
      { id: TALENT_PACK_HUNTER },
      { id: TALENT_NECROS_INITIATE },
    ],
  },
  {
    color: 'blue',
    title: 'Shared Blue (Tempest)',
    headerClass: 'text-blue-400',
    entries: [
      { id: TALENT_LIGHTNING_BOLT_ROOM, rSpell: true },
      { id: TALENT_OVERSHOCK },
      { id: TALENT_GUARDBREAK },
      { id: TALENT_UNSTABLE_ENERGY },
      { id: TALENT_TEMPEST_INITIATE },
      { id: TALENT_OVERCLOCK },
      { id: TALENT_OVERRIDE },
    ],
  },
  {
    color: 'purple',
    title: 'Shared Purple (Abyssal)',
    headerClass: 'text-violet-400',
    entries: [
      { id: TALENT_COLDSNAP_ROOM, rSpell: true },
      { id: TALENT_AEGIS_ROOM, rSpell: true },
      { id: TALENT_MOMENTUM_RIFT },
      { id: TALENT_MANA_SHIELD, stat: 'INT' },
      { id: TALENT_HAILSTORM, stat: 'INT' },
      { id: TALENT_ABYSSAL_INITIATE },
      { id: TALENT_AWAKENED_EYE },
    ],
  },
  {
    color: 'red',
    title: 'Shared Red (Infernal)',
    headerClass: 'text-red-400',
    entries: [
      { id: TALENT_METEOR_STRIKE, rSpell: true },
      { id: TALENT_REBUKE },
      { id: TALENT_BLOODLEECH },
      { id: TALENT_INFERNAL_INITIATE },
      { id: TALENT_FISSION },
      { id: TALENT_BLOOD_ORBS },
      { id: TALENT_BLOODMAGE },
      { id: TALENT_DEATHWISH },
    ],
  },
];

export const RULEBOOK_SECONDARY_NOTE =
  'Secondary boons appear in matching colored room reward pools alongside primary ability-branch picks. R-spell boons assign that ability to your R hotkey when picked.';

export interface DuoBoonPair {
  colorsLabel: string;
  colorA: SecondaryBoonColor;
  colorB: SecondaryBoonColor;
  ids: readonly [TalentId, TalentId];
}

export const RULEBOOK_DUO_PAIRS: readonly DuoBoonPair[] = [
  {
    colorsLabel: 'Red + Blue',
    colorA: 'red',
    colorB: 'blue',
    ids: [TALENT_MAGMA_CURRENT, TALENT_TYRANTS_CLOAK],
  },
  {
    colorsLabel: 'Red + Green',
    colorA: 'red',
    colorB: 'green',
    ids: [TALENT_LEGION, TALENT_HELLFIRE_VENOM],
  },
  {
    colorsLabel: 'Green + Blue',
    colorA: 'green',
    colorB: 'blue',
    ids: [TALENT_FORCE_OF_NATURE, TALENT_STORM_WITCH],
  },
  {
    colorsLabel: 'Red + Purple',
    colorA: 'red',
    colorB: 'purple',
    ids: [TALENT_FROST_QUEEN, TALENT_DUALITY],
  },
  {
    colorsLabel: 'Green + Purple',
    colorA: 'green',
    colorB: 'purple',
    ids: [TALENT_FATEBREAKER, TALENT_ACID_RAIN],
  },
  {
    colorsLabel: 'Blue + Purple',
    colorA: 'blue',
    colorB: 'purple',
    ids: [TALENT_MONSOON, TALENT_SPELL_THIEF],
  },
];

export const RULEBOOK_DUO_UNLOCK =
  'To unlock a duo boon, own at least one primary weapon-ability room boon (Left-Click / Q / E mutex slot) of each color in the pair. Eligible duos then appear in matching colored room reward pools.';

export interface UltimateBoonEntry {
  color: SecondaryBoonColor;
  colorLabel: string;
  id: TalentId;
}

export const RULEBOOK_ULTIMATES: readonly UltimateBoonEntry[] = [
  { color: 'purple', colorLabel: 'Purple', id: TALENT_DIVINE_COLD },
  { color: 'red', colorLabel: 'Red', id: TALENT_PYROMANIA },
  { color: 'blue', colorLabel: 'Blue', id: TALENT_STORM_SHIELD },
  { color: 'green', colorLabel: 'Green', id: TALENT_LETHAL_INJECTION },
];

export const RULEBOOK_ULTIMATE_UNLOCK =
  'To unlock an ultimate, own 2 or more primary mutex-group room boons of that same color (ability-branch and/or dash). The ultimate then appears in that color\'s room reward pool.';

export interface PortalColorEntry {
  colorLabel: string;
  name: string;
  reward: string;
  swatchClass: string;
}

export const RULEBOOK_PORTALS: readonly PortalColorEntry[] = [
  {
    colorLabel: 'Red',
    name: 'Infernal Gate',
    reward: 'Red (Infernal) boons — generally the hardest combat rooms.',
    swatchClass: 'bg-red-500',
  },
  {
    colorLabel: 'Blue',
    name: 'Tempest Gate',
    reward: 'Blue (Tempest) boons.',
    swatchClass: 'bg-blue-500',
  },
  {
    colorLabel: 'Green',
    name: 'Eldritch Gate',
    reward: 'Green (Eldritch) boons — zombie / necromancy themes.',
    swatchClass: 'bg-emerald-500',
  },
  {
    colorLabel: 'Purple',
    name: 'Abyssal Gate',
    reward: 'Purple (Abyssal) boons — frost / aegis themes.',
    swatchClass: 'bg-violet-500',
  },
  {
    colorLabel: 'Yellow',
    name: 'Trial Room',
    reward: '+250 GOLD from the pedestal.',
    swatchClass: 'bg-yellow-400',
  },
  {
    colorLabel: 'Orange',
    name: 'Stat Room',
    reward: '+5 STAT points from the pedestal.',
    swatchClass: 'bg-orange-500',
  },
  {
    colorLabel: 'Pink',
    name: 'Merchant',
    reward: 'Buy heal, dash charge, weapon talent, and items with GOLD.',
    swatchClass: 'bg-pink-500',
  },
  {
    colorLabel: 'Red Void',
    name: 'Boss Room',
    reward: 'Defeat the boss, then pick a CLASS TALENT from your weapon pool.',
    swatchClass: 'bg-red-800',
  },
];

export const RULEBOOK_PORTALS_FLOW =
  'After clearing a combat room: approach the pedestal and press X → choose a reward / boon → portals unlock so you can choose the next gateway. Reward choices can be rerolled for 1 Fate in combat (free in the throne room).';

export const RULEBOOK_WEAPON_LABELS: Record<CoopRulebookWeapon, string> = {
  [WeaponType.RUNEBLADE]: 'Runeblade',
  [WeaponType.SABRES]: 'Sabres',
  [WeaponType.BOW]: 'Bow',
  [WeaponType.SCYTHE]: 'Scythe',
};
