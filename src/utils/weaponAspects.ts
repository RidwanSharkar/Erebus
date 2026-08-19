import { WeaponType } from '@/components/dragon/weapons';

/** Per-weapon visual/gameplay aspect chosen in the throne room. */
export type WeaponAspect =
  | 'LEGIONNAIRE'
  | 'BLADEMASTER'
  | 'DEATHDEALER'
  | 'ROYAL_GUARD'
  | 'ARCHMAGE'
  | 'NECROMANCER'
  | 'DRACONIC'
  | 'FIRE_AFFINITY'
  | 'FROST_AFFINITY'
  | 'WARLORD'
  | 'SNIPER'
  | 'DRUID'
  | 'BEASTMASTER';

export const ASPECT_LEGIONNAIRE: WeaponAspect = 'LEGIONNAIRE';
export const ASPECT_BLADEMASTER: WeaponAspect = 'BLADEMASTER';
export const ASPECT_DEATHDEALER: WeaponAspect = 'DEATHDEALER';
export const ASPECT_ROYAL_GUARD: WeaponAspect = 'ROYAL_GUARD';
export const ASPECT_ARCHMAGE: WeaponAspect = 'ARCHMAGE';
export const ASPECT_NECROMANCER: WeaponAspect = 'NECROMANCER';
export const ASPECT_DRACONIC: WeaponAspect = 'DRACONIC';
export const ASPECT_FIRE_AFFINITY: WeaponAspect = 'FIRE_AFFINITY';
export const ASPECT_FROST_AFFINITY: WeaponAspect = 'FROST_AFFINITY';
export const ASPECT_WARLORD: WeaponAspect = 'WARLORD';
export const ASPECT_SNIPER: WeaponAspect = 'SNIPER';
export const ASPECT_DRUID: WeaponAspect = 'DRUID';
export const ASPECT_BEASTMASTER: WeaponAspect = 'BEASTMASTER';

/** All valid aspect IDs (backend allow-list should match). */
export const ALL_WEAPON_ASPECTS: readonly WeaponAspect[] = [
  ASPECT_LEGIONNAIRE,
  ASPECT_BLADEMASTER,
  ASPECT_DEATHDEALER,
  ASPECT_ROYAL_GUARD,
  ASPECT_ARCHMAGE,
  ASPECT_NECROMANCER,
  ASPECT_DRACONIC,
  ASPECT_FIRE_AFFINITY,
  ASPECT_FROST_AFFINITY,
  ASPECT_WARLORD,
  ASPECT_SNIPER,
  ASPECT_DRUID,
  ASPECT_BEASTMASTER,
] as const;

/** Aspects available per throne weapon (order = cycle order; index 0 = default). */
export const WEAPON_ASPECTS_BY_WEAPON: Partial<
  Record<WeaponType, readonly WeaponAspect[]>
> = {
  [WeaponType.RUNEBLADE]: [
    ASPECT_BLADEMASTER,
    ASPECT_LEGIONNAIRE,
    ASPECT_ROYAL_GUARD,
    ASPECT_DEATHDEALER,
  ],
  [WeaponType.SCYTHE]: [ASPECT_NECROMANCER, ASPECT_ARCHMAGE, ASPECT_DRACONIC],
  [WeaponType.SABRES]: [ASPECT_FIRE_AFFINITY, ASPECT_FROST_AFFINITY, ASPECT_WARLORD],
  [WeaponType.BOW]: [ASPECT_SNIPER, ASPECT_BEASTMASTER, ASPECT_DRUID],
};

export interface WeaponAspectDisplayMeta {
  readonly id: WeaponAspect;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
}

export const WEAPON_ASPECT_DISPLAY: Record<WeaponAspect, WeaponAspectDisplayMeta> = {
  LEGIONNAIRE: {
    id: 'LEGIONNAIRE',
    label: 'Aspect of Mania',
    shortLabel: 'Legionnaire',
    description:
      'Reduces the cooldown of Colossus Smite (E) by 2 seconds and triples its base heal. Death Grasp (R) pulls and taunts target.',
  },
  BLADEMASTER: {
    id: 'BLADEMASTER',
    label: 'Aspect of Envy',
    shortLabel: 'Blademaster',
    description:
      'Increases attack speed by 20%. Wraith Strike applies Shadowflame (ignites for 60% of hit damage over 2.5s).',
  },
  DEATHDEALER: {
    id: 'DEATHDEALER',
    label: 'Aspect of Regret',
    shortLabel: 'Deathdealer',
    description:
      'Higher base damage, slower swings. Third combo hit has a 50% chance to immediately trigger a Stagger Lightning Bolt on the target.',
  },
  ROYAL_GUARD: {
    id: 'ROYAL_GUARD',
    label: 'Aspect of Pride',
    shortLabel: 'Royal Guard',
    description:
      'Tempest Sweep: Charging R for at least 1.5s Ignites hit enemies for 80% of impact damage over 4 seconds.',
  },
  ARCHMAGE: {
    id: 'ARCHMAGE',
    label: 'Aspect of Arrogance',
    shortLabel: 'Archmage',
    description:
      'Every third Entropic Bolt Ignites the enemy for 200% of that bolt\'s damage over 4 seconds. Crossentropy hits on Ignited enemies create a pillar of fire dealing 125 + 5 damage per Intellect.',
  },
  NECROMANCER: {
    id: 'NECROMANCER',
    label: 'Aspect of Madness',
    shortLabel: 'Necromancer',
    description:
      'Vengeful Spirit: Crossentropy hits summon a stationary apparition that attacks nearby enemies. Binding Totem: Mantra totems Entangle the closest enemy within 4.5 every 2s.',
  },
  DRACONIC: {
    id: 'DRACONIC',
    label: 'Aspect of Vanity',
    shortLabel: 'Draconic',
    description:
      'Entropic Bolts fire 20% faster. After each dash, release 3 Locusts that seek enemies. Grants +1 dash charge.',
  },
  FIRE_AFFINITY: {
    id: 'FIRE_AFFINITY',
    label: 'Aspect of Havoc',
    shortLabel: 'Fire',
    description:
      'Reduces the cooldown of Divebomb by 2 seconds, increasing its damage and it now applies Ignite (80% of impact damage over 3s). Starts with +25 Energy.',
  },
  FROST_AFFINITY: {
    id: 'FROST_AFFINITY',
    label: 'Aspect of Apathy',
    shortLabel: 'Frost',
    description:
      'Primary attacks apply Avalanche on hit enemies — Arctic Blizzard damage and chill every 0.5s for 6s. Shatter: Flourish (and Fan of Knives, if talented) on a frozen enemy consumes Freeze and deals 100 + 10 per AGILITY + 10% of the target\'s maximum health as ice-spike damage.',
  },
  WARLORD: {
    id: 'WARLORD',
    label: 'Aspect of Cruelty',
    shortLabel: 'Warlord',
    description:
      'Poison Dart: after each dash, the next primary attack fires a dart dealing 20 + 5 per AGILITY and applying 1 stack of Concentrated Venom. Backstab (Q) applies 1 stack ofConcentrated Venom. Dash distance is doubled.',
  },
  SNIPER: {
    id: 'SNIPER',
    label: 'Aspect of Vengeance',
    shortLabel: 'Sniper',
    description:
      "Hunter's Mark: Barrage marks enemies for 5s. A Perfect Shot or Tempest Rounds hit on a marked enemy creates a lightning bolt at the enemy location. Terminal Velocity: Perfect Shot and Reaping Talons (forward and return) deal +20 + 2 per AGILITY bonus damage when the target is hit from over 10 meters away. Tempest Rounds fired from over 10 meters away deal +1 damage per AGILITY.",
  },
  DRUID: {
    id: 'DRUID',
    label: 'Aspect of Resent',
    shortLabel: 'Druid',
    description:
      'Rejuvenating Shot: heals allies, or Entangles enemies hit.',
  },
  BEASTMASTER: {
    id: 'BEASTMASTER',
    label: 'Aspect of Infamy',
    shortLabel: 'Beastmaster',
    description:
      'Always accompanied by a loyal tiger companion.',
  },
};

export function isWeaponAspect(value: unknown): value is WeaponAspect {
  return (
    value === 'LEGIONNAIRE' ||
    value === 'BLADEMASTER' ||
    value === 'DEATHDEALER' ||
    value === 'ROYAL_GUARD' ||
    value === 'ARCHMAGE' ||
    value === 'NECROMANCER' ||
    value === 'DRACONIC' ||
    value === 'FIRE_AFFINITY' ||
    value === 'FROST_AFFINITY' ||
    value === 'WARLORD' ||
    value === 'SNIPER' ||
    value === 'DRUID' ||
    value === 'BEASTMASTER'
  );
}

export function getAspectsForWeapon(weapon: WeaponType): readonly WeaponAspect[] {
  return WEAPON_ASPECTS_BY_WEAPON[weapon] ?? [];
}

export function defaultWeaponAspect(weapon: WeaponType): WeaponAspect {
  const aspects = getAspectsForWeapon(weapon);
  return aspects[0] ?? ASPECT_LEGIONNAIRE;
}

/** Interval for throne pedestal aspect showcase rotation. */
export const THRONE_ASPECT_SHOWCASE_INTERVAL_MS = 10_000;

/** Pedestal showcase aspect for a rotating display tick (index 0 = default). */
export function getShowcaseWeaponAspect(weapon: WeaponType, tick: number): WeaponAspect {
  const aspects = getAspectsForWeapon(weapon);
  if (aspects.length === 0) return defaultWeaponAspect(weapon);
  return aspects[((tick % aspects.length) + aspects.length) % aspects.length]!;
}

/** Per-weapon last-chosen aspect map (throne pedestal memory). */
export type WeaponAspectByWeapon = Partial<Record<WeaponType, WeaponAspect>>;

/** Resolve the aspect to show on a throne pedestal for a given weapon. */
export function resolvePedestalWeaponAspect(
  weapon: WeaponType,
  map: WeaponAspectByWeapon | null | undefined,
): WeaponAspect {
  return normalizeWeaponAspect(map?.[weapon], weapon);
}

/**
 * Normalize an aspect value for a weapon. Falls back to that weapon's default
 * if missing/invalid; if weapon has no aspects, returns LEGIONNAIRE.
 */
export function normalizeWeaponAspect(
  value: unknown,
  weapon: WeaponType = WeaponType.NONE,
): WeaponAspect {
  const aspects = getAspectsForWeapon(weapon);
  const fallback = aspects[0] ?? ASPECT_LEGIONNAIRE;
  if (typeof value !== 'string') return fallback;
  const upper = value.toUpperCase();
  if (!isWeaponAspect(upper)) return fallback;
  if (aspects.length > 0 && !aspects.includes(upper)) return fallback;
  return upper;
}

/** Cycle to the next aspect for this weapon (wraps). */
export function cycleWeaponAspect(
  weapon: WeaponType,
  current: WeaponAspect | null | undefined,
): WeaponAspect {
  const aspects = getAspectsForWeapon(weapon);
  if (aspects.length === 0) return defaultWeaponAspect(weapon);
  const cur = normalizeWeaponAspect(current, weapon);
  const idx = aspects.indexOf(cur);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % aspects.length;
  return aspects[nextIdx]!;
}

export function getWeaponAspectLabel(aspect: WeaponAspect): string {
  return WEAPON_ASPECT_DISPLAY[aspect]?.label ?? aspect;
}

export interface WeaponAspectTooltipData {
  name: string;
  description: string;
}

/** Pedestal / announcement tooltip copy for a weapon aspect. */
export function getWeaponAspectTooltipData(
  aspect: WeaponAspect,
): WeaponAspectTooltipData {
  const meta = WEAPON_ASPECT_DISPLAY[aspect];
  return {
    name: meta?.label ?? aspect,
    description: meta?.description ?? '',
  };
}

// ── Dragon cosmetic colors (GhostTrail / ArchmageCrest / ChargedOrbitals) ───

export interface AspectCrestPalette {
  main: string;
  emissive: string;
  glow: string;
  secondary: string;
}

export interface AspectDragonVisualOverrides {
  trailColor?: string;
  crest?: AspectCrestPalette;
  orbitalColor?: string;
}

/** Only aspects that differ from weapon-type defaults are listed. */
const ASPECT_DRAGON_VISUAL_OVERRIDES: Partial<
  Record<WeaponAspect, AspectDragonVisualOverrides>
> = {
  FROST_AFFINITY: {
    trailColor: '#7dd3fc',
    crest: {
      main: '#7dd3fc',
      emissive: '#38bdf8',
      glow: '#bae6fd',
      secondary: '#0ea5e9',
    },
    orbitalColor: '#7dd3fc',
  },
  DRUID: {
    orbitalColor: '#86efac',
  },
  BEASTMASTER: {
    orbitalColor: '#a16207',
  },
  ARCHMAGE: {
    trailColor: '#7dd3fc',
    crest: {
      main: '#38AECC',
      emissive: '#87CEEB',
      glow: '#A5F3FC',
      secondary: '#3EB0FC',
    },
    orbitalColor: '#FFC278',
  },
  DRACONIC: {
    trailColor: '#7dd3fc',
    crest: {
      main: '#7dd3fc',
      emissive: '#38bdf8',
      glow: '#bae6fd',
      secondary: '#0ea5e9',
    },
    orbitalColor: '#7dd3fc',
  },
  NECROMANCER: {
    trailColor: '#22c55e',
    crest: {
      main: '#22c55e',
      emissive: '#16a34a',
      glow: '#86efac',
      secondary: '#4ade80',
    },
    orbitalColor: '#22c55e',
  },
  BLADEMASTER: {
    trailColor: '#C4B5FD',
    crest: {
      main: '#C4B5FD',
      emissive: '#A78BFA',
      glow: '#DDD6FE',
      secondary: '#8B5CF6',
    },
    orbitalColor: '#C4B5FD',
  },
};

export function getAspectDragonVisualOverrides(
  aspect: WeaponAspect | null | undefined,
): AspectDragonVisualOverrides | undefined {
  if (!aspect) return undefined;
  return ASPECT_DRAGON_VISUAL_OVERRIDES[aspect];
}

// ── Runeblade aspect combat (LMB damage / fire rate / R ability) ───────────

export type RunebladeRAbility = 'colossus_smite' | 'tempest_sweep';

export interface RunebladeAspectCombat {
  readonly comboDamage: readonly [number, number, number];
  readonly fireRateSec: number;
  readonly rAbility: RunebladeRAbility;
  /** Combo step reset window (seconds since last LMB). Default 1 when omitted. */
  readonly comboResetSec?: number;
  /** Colossus Smite cooldown override (seconds). Default 8 when omitted. */
  readonly smiteCooldownSec?: number;
  /** Colossus Smite base heal override. Default 10 when omitted. */
  readonly smiteBaseHeal?: number;
}

/** Default Runeblade combo reset when aspect does not override. */
export const RUNEBLADE_DEFAULT_COMBO_RESET_SEC = 1;

/** Default Colossus Smite cooldown when aspect does not override. */
export const RUNEBLADE_SMITE_DEFAULT_COOLDOWN_SEC = 8;
/** Default Colossus Smite base heal when aspect does not override. */
export const RUNEBLADE_SMITE_DEFAULT_BASE_HEAL = 10;

const RUNEBLADE_ASPECT_COMBAT: Record<
  'LEGIONNAIRE' | 'BLADEMASTER' | 'DEATHDEALER' | 'ROYAL_GUARD',
  RunebladeAspectCombat
> = {
  LEGIONNAIRE: {
    comboDamage: [50, 60, 70],
    fireRateSec: 0.875,
    rAbility: 'colossus_smite',
    smiteCooldownSec: 6,
    smiteBaseHeal: 30,
  },
  BLADEMASTER: {
    comboDamage: [50, 60, 70],
    fireRateSec: 0.725,
    rAbility: 'colossus_smite',
  },
  DEATHDEALER: {
    comboDamage: [80, 100, 150],
    fireRateSec: 1.1725,
    comboResetSec: 2.5,
    rAbility: 'colossus_smite',
  },
  ROYAL_GUARD: {
    comboDamage: [50, 60, 70],
    fireRateSec: 0.875,
    rAbility: 'tempest_sweep',
  },
};

function isRunebladeAspectKey(
  aspect: WeaponAspect,
): aspect is 'LEGIONNAIRE' | 'BLADEMASTER' | 'DEATHDEALER' | 'ROYAL_GUARD' {
  return (
    aspect === ASPECT_LEGIONNAIRE ||
    aspect === ASPECT_BLADEMASTER ||
    aspect === ASPECT_DEATHDEALER ||
    aspect === ASPECT_ROYAL_GUARD
  );
}

/** Resolve Runeblade combat stats for an aspect (falls back to Legionnaire). */
export function getRunebladeAspectCombat(
  aspect: WeaponAspect | null | undefined,
): RunebladeAspectCombat {
  if (aspect && isRunebladeAspectKey(aspect)) {
    return RUNEBLADE_ASPECT_COMBAT[aspect];
  }
  return RUNEBLADE_ASPECT_COMBAT.LEGIONNAIRE;
}

export function getRunebladeAspectComboDamage(
  aspect: WeaponAspect | null | undefined,
  comboStep: 1 | 2 | 3,
): number {
  const combat = getRunebladeAspectCombat(aspect);
  return combat.comboDamage[comboStep - 1] ?? combat.comboDamage[0];
}

export function getRunebladeAspectFireRateSec(
  aspect: WeaponAspect | null | undefined,
): number {
  return getRunebladeAspectCombat(aspect).fireRateSec;
}

export function getRunebladeAspectComboResetSec(
  aspect: WeaponAspect | null | undefined,
): number {
  return (
    getRunebladeAspectCombat(aspect).comboResetSec ??
    RUNEBLADE_DEFAULT_COMBO_RESET_SEC
  );
}

export function isRunebladeDeathdealerAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_DEATHDEALER;
}

/** Deathdealer warhammer — chance for third combo hit to fire an immediate Stagger Lightning Bolt. */
export const DEATHDEALER_THIRD_HIT_STAGGER_PROC_CHANCE = 0.50;

export function isRunebladeBlademasterAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_BLADEMASTER;
}

/** Blademaster Wraith Strike — Shadowflame DoT (keep in sync with backend/gameRoom.js). */
export const BLADEMASTER_SHADOWFLAME_DOT_FRACTION = 0.7;
export const BLADEMASTER_SHADOWFLAME_DURATION_MS = 2500;
export const BLADEMASTER_SHADOWFLAME_TICKS = 5;

export function getRunebladeSmiteCooldownSec(
  aspect: WeaponAspect | null | undefined,
): number {
  return (
    getRunebladeAspectCombat(aspect).smiteCooldownSec ??
    RUNEBLADE_SMITE_DEFAULT_COOLDOWN_SEC
  );
}

export function getRunebladeSmiteBaseHeal(
  aspect: WeaponAspect | null | undefined,
): number {
  return (
    getRunebladeAspectCombat(aspect).smiteBaseHeal ??
    RUNEBLADE_SMITE_DEFAULT_BASE_HEAL
  );
}

export function isRunebladeTempestSweepAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return getRunebladeAspectCombat(aspect).rAbility === 'tempest_sweep';
}

// ── Tempest Sweep (Spear E / Royal Guard R) — keep in sync with backend/gameRoom.js ─

export const TEMPEST_SWEEP_MIN_DAMAGE = 100;
export const TEMPEST_SWEEP_MAX_DAMAGE = 320;
/** Royal Guard R: charge this long (seconds) to apply Ignite on hit. */
export const TEMPEST_SWEEP_IGNITE_CHARGE_SEC = 1.5;
export const TEMPEST_SWEEP_IGNITE_DOT_FRACTION = 0.8;
export const TEMPEST_SWEEP_IGNITE_DURATION_MS = 4000;
export const TEMPEST_SWEEP_IGNITE_TICKS = 4;

// ── Sabres Fire Affinity — Divebomb / Skyfall (keep in sync with backend/gameRoom.js) ─

export const FIRE_AFFINITY_SKYFALL_BASE_DAMAGE = 125;
export const FIRE_AFFINITY_SKYFALL_DAMAGE_PER_STAT_POINT = 1;
export const FIRE_AFFINITY_SKYFALL_IGNITE_DOT_FRACTION = 0.8;
export const FIRE_AFFINITY_SKYFALL_IGNITE_DURATION_MS = 3000;
export const FIRE_AFFINITY_SKYFALL_IGNITE_TICKS = 3;

/** Default Sabres Divebomb / Skyfall cooldown when aspect does not override. */
export const SABRES_SKYFALL_DEFAULT_COOLDOWN_SEC = 9.25;
/** Fire Affinity — Divebomb cooldown reduced by 2s. */
export const FIRE_AFFINITY_SKYFALL_COOLDOWN_SEC = 6.75;
/** Fire Affinity — +25 max energy at start (stacks with Oxygen / Exodia). */
export const FIRE_AFFINITY_MAX_ENERGY_BONUS = 25;

export function isSabresFireAffinityAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_FIRE_AFFINITY;
}

/** Fire Affinity max-energy bonus (0 for other aspects). */
export function getFireAffinityMaxEnergyBonus(
  aspect: WeaponAspect | null | undefined,
): number {
  return isSabresFireAffinityAspect(aspect) ? FIRE_AFFINITY_MAX_ENERGY_BONUS : 0;
}

/** Resolve Sabres Divebomb / Skyfall cooldown for an aspect. */
export function getSabresSkyfallCooldownSec(
  aspect: WeaponAspect | null | undefined,
): number {
  return isSabresFireAffinityAspect(aspect)
    ? FIRE_AFFINITY_SKYFALL_COOLDOWN_SEC
    : SABRES_SKYFALL_DEFAULT_COOLDOWN_SEC;
}

/** Warlord Backstab — Concentrated Venom stacks per hit (stacks with Infested Stab). */
export const WARLORD_BACKSTAB_CONCENTRATED_VENOM_STACKS = 1;

/**
 * Warlord dash distance by Warpdrive purchase count (0–3).
 * Same relative steps as the default table, +2.0 on each tier.
 */
export const WARLORD_WARPDRIVE_DASH_DISTANCES = [7.125, 8.125, 9.125, 10.125] as const;

export function isSabresWarlordAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_WARLORD;
}

export function isSabresFrostAffinityAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_FROST_AFFINITY;
}

// ── Frost Affinity Shatter (Flourish on frozen → consume freeze + ice spike) ─

/** Flat base damage when Shatter consumes Freeze on a Flourish hit. */
export const FROST_AFFINITY_SHATTER_BASE_DAMAGE = 100;
/** Bonus Shatter damage per point of effective AGILITY. */
export const FROST_AFFINITY_SHATTER_DAMAGE_PER_AGILITY = 10;
/** Fraction of target max health added to Shatter damage. */
export const FROST_AFFINITY_SHATTER_MAX_HP_FRAC = 0.1;

/** Shatter damage: 100 + 10 × AGI + floor(maxHP × 10%). */
export function getFrostAffinityShatterDamage(
  agility: number,
  maxHealth: number,
): number {
  const agiBonus =
    FROST_AFFINITY_SHATTER_DAMAGE_PER_AGILITY * Math.max(0, agility);
  const hpBonus =
    typeof maxHealth === 'number' && maxHealth > 0
      ? Math.floor(maxHealth * FROST_AFFINITY_SHATTER_MAX_HP_FRAC)
      : 0;
  return FROST_AFFINITY_SHATTER_BASE_DAMAGE + agiBonus + hpBonus;
}

// ── Warlord Poison Dart (keep in sync with backend/gameRoom.js / ControlSystem) ─

/** Flat base damage on the post-dash Poison Dart projectile. */
export const POISON_DART_BASE_DAMAGE = 20;
/** Bonus damage per point of effective AGILITY. */
export const POISON_DART_AGI_PER_POINT = 5;
/** Max travel distance (Scorpion Lance 7 + 4). */
export const POISON_DART_RANGE = 11;
/** Seconds the next primary can consume the armed dart after a dash. */
export const POISON_DART_WINDOW_SEC = 2;
/** Concentrated Venom stacks applied on Poison Dart hit. */
export const POISON_DART_CONCENTRATED_VENOM_STACKS = 1;

/** Poison Dart damage: 20 + 5 × AGI. */
export function getPoisonDartDamage(agility: number): number {
  return POISON_DART_BASE_DAMAGE + POISON_DART_AGI_PER_POINT * Math.max(0, agility);
}

/**
 * Physical R hotkey ability for Sabres aspects (`SABRES_R` Divebomb, or none on Warlord / Frost Affinity).
 */
export function resolveSabresRAbilityId(
  aspect: WeaponAspect | null | undefined,
): 'SABRES_R' | null {
  if (isSabresWarlordAspect(aspect) || isSabresFrostAffinityAspect(aspect)) {
    return null;
  }
  return 'SABRES_R';
}

// ── Scythe aspect combat (Entropic Bolt fire rate + default colors) ────────

/** Archmage — every Nth Entropic Bolt applies Ignite. */
export const ARCHMAGE_ENTROPIC_IGNITE_INTERVAL = 3;
/** Archmage — Ignite DoT as fraction of final bolt hit damage (200%). */
export const ARCHMAGE_ENTROPIC_IGNITE_DOT_FRACTION = 2.0;
export const ARCHMAGE_ENTROPIC_IGNITE_DURATION_MS = 4000;
export const ARCHMAGE_ENTROPIC_IGNITE_TICKS = 4;

/** Archmage — Crossentropy hit on an already-Ignited enemy → flame pillar. */
export const ARCHMAGE_FLAME_PILLAR_BASE_DAMAGE = 125;
export const ARCHMAGE_FLAME_PILLAR_DAMAGE_PER_INTELLECT = 5;

export function getArchmageFlamePillarDamage(intellect: number): number {
  return (
    ARCHMAGE_FLAME_PILLAR_BASE_DAMAGE +
    ARCHMAGE_FLAME_PILLAR_DAMAGE_PER_INTELLECT * Math.max(0, intellect)
  );
}

export function isScytheArchmageAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_ARCHMAGE;
}

/** Draconic — subtract from Entropic Bolt fire interval (seconds). Stacks with Arcane Synergy. */
export const DRACONIC_ENTROPIC_BOLT_FIRE_RATE_REDUCTION_SEC = 0.125;

export function getDraconicEntropicBoltFireRateReductionSec(
  aspect: WeaponAspect | null | undefined,
): number {
  return aspect === ASPECT_DRACONIC ? DRACONIC_ENTROPIC_BOLT_FIRE_RATE_REDUCTION_SEC : 0;
}

export function isScytheDraconicAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_DRACONIC;
}

export function isScytheNecromancerAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_NECROMANCER;
}

/** Necromancer Mantra totem — Entangle pulse radius (units). */
export const NECROMANCER_TOTEM_ENTANGLE_RADIUS = 4.5;
/** Necromancer Mantra totem — Entangle pulse interval (ms). */
export const NECROMANCER_TOTEM_ENTANGLE_INTERVAL_MS = 2000;

// ── Necromancer Vengeful Spirit (keep in sync with backend/gameRoom.js / enemyAI.js) ─

export const VENGEFUL_SPIRIT_BASE_DAMAGE = 50;
export const VENGEFUL_SPIRIT_DAMAGE_PER_STAT_POINT = 1;
export const VENGEFUL_SPIRIT_ATTACK_RANGE = 3.8;
export const VENGEFUL_SPIRIT_MOVE_SPEED = 0;
export const VENGEFUL_SPIRIT_ATTACK_COOLDOWN_MS = 1050;
export const VENGEFUL_SPIRIT_DURATION_MS = 12000;
/** Match Abysslick Emerge clip (~3s). */
export const VENGEFUL_SPIRIT_SUMMON_LOCK_MS = 2400;
/** Submerge + fade window before enemy-removed (full Submerge is ~5s). */
export const VENGEFUL_SPIRIT_EXPIRE_ANIM_MS = 2200;
export const VENGEFUL_SPIRIT_MAX_ACTIVE = 4;

/** Necromancer — Vengeful Spirit melee: 15 + 1 per STR/STA/INT/AGI. */
export function getVengefulSpiritDamage(stats: {
  strength: number;
  stamina: number;
  intellect: number;
  agility: number;
}): number {
  const total =
    Math.max(0, stats.strength) +
    Math.max(0, stats.stamina) +
    Math.max(0, stats.intellect) +
    Math.max(0, stats.agility);
  return (
    VENGEFUL_SPIRIT_BASE_DAMAGE +
    VENGEFUL_SPIRIT_DAMAGE_PER_STAT_POINT * total
  );
}

/** Base dash charge slots (Movement default). */
export const BASE_DASH_CHARGES = 3;
/** Draconic Scythe — +1 dash charge orb. */
export const DRACONIC_BONUS_DASH_CHARGES = 1;
/** Merchant dash-charge purchase — +1 dash charge orb. */
export const MERCHANT_BONUS_DASH_CHARGES = 1;

/**
 * Resolve max dash charges from weapon/aspect + merchant purchase + item bonuses.
 * Default 3; Draconic Scythe +1; merchant +1; Hexmetal 3pc +1 (additive).
 */
export function resolveMaxDashCharges(
  weapon: WeaponType,
  aspect: WeaponAspect | null | undefined,
  extraDashChargePurchased: boolean,
  bonusDashCharges: number = 0,
): number {
  let max = BASE_DASH_CHARGES;
  if (weapon === WeaponType.SCYTHE && isScytheDraconicAspect(aspect)) {
    max += DRACONIC_BONUS_DASH_CHARGES;
  }
  if (extraDashChargePurchased) {
    max += MERCHANT_BONUS_DASH_CHARGES;
  }
  if (bonusDashCharges > 0) {
    max += Math.floor(bonusDashCharges);
  }
  return max;
}

/**
 * Talent / room-boon entropic color keys that map to EntropicColorVariant.
 * When present, these override aspect defaults.
 */
export type ScytheEntropicTalentColorKey =
  | 'wrathful'
  | 'staggering'
  | 'infesting'
  | 'arctic'
  | 'red'
  | 'blue'
  | 'green';

/** Handle-trail hex colors when no entropic room boon is active. */
export const SCYTHE_ASPECT_TRAIL_COLORS: Partial<Record<WeaponAspect, string>> = {
  [ASPECT_DRACONIC]: '#7dd3fc',
  [ASPECT_NECROMANCER]: '#22c55e',
};

const SCYTHE_ASPECT_DEFAULT_ENTROPIC_VARIANT: Partial<
  Record<WeaponAspect, 'arctic' | 'green' | 'rosegold'>
> = {
  [ASPECT_DRACONIC]: 'arctic',
  [ASPECT_NECROMANCER]: 'green',
  [ASPECT_ARCHMAGE]: 'rosegold',
};

/**
 * Resolve Entropic Bolt / Scythe trail palette.
 * Room boons (wrathful / staggering / infesting / arctic) override aspect defaults.
 */
export function resolveScytheEntropicColorVariant(
  aspect: WeaponAspect | null | undefined,
  talentVariant?: ScytheEntropicTalentColorKey | string | null,
): 'rosegold' | 'purple' | 'blue' | 'red' | 'green' | 'arctic' {
  if (talentVariant) {
    switch (talentVariant) {
      case 'wrathful':
      case 'red':
        return 'red';
      case 'staggering':
      case 'blue':
        return 'blue';
      case 'infesting':
      case 'green':
        return 'green';
      case 'arctic':
        return 'arctic';
      default:
        break;
    }
  }
  if (aspect && SCYTHE_ASPECT_DEFAULT_ENTROPIC_VARIANT[aspect]) {
    return SCYTHE_ASPECT_DEFAULT_ENTROPIC_VARIANT[aspect]!;
  }
  return 'rosegold';
}

/** Scythe handle trail hex when no room-boon talent variant is active. */
export function resolveScytheAspectTrailColor(
  aspect: WeaponAspect | null | undefined,
): string {
  if (aspect && SCYTHE_ASPECT_TRAIL_COLORS[aspect]) {
    return SCYTHE_ASPECT_TRAIL_COLORS[aspect]!;
  }
  return '#FF6A00'; // Archmage / default rosegold
}

// ── Crossentropy Blitz Cannon aspect default palettes ─────────────────────

/** Aspect key for Blitz rocket / trail / explosion when no talent theme is active. */
export type CrossentropyBlitzAspectKey = 'archmage' | 'necromancer' | 'draconic';

/** Shared hex palette for Blitz Cannon VFX (rocket, trail, explosion). */
export interface CrossentropyBlitzAspectPalette {
  /** Rocket body / core. */
  body: string;
  /** Rocket / trail emissive. */
  emissive: string;
  /** Trail particle color. */
  trail: string;
  /** Trail particle emissive. */
  trailEmissive: string;
  /** Dynamic light. */
  light: string;
  /** Explosion core. */
  c1: string;
  c1e: string;
  c2: string;
  c2e: string;
  ringC: string;
  ringE: string;
  sparkMain: string;
  sparkMainE: string;
  pl1: string;
}

const BLITZ_ASPECT_PALETTES: Record<CrossentropyBlitzAspectKey, CrossentropyBlitzAspectPalette> = {
  archmage: {
    body: '#CC3300',
    emissive: '#FF6600',
    trail: '#FF4500',
    trailEmissive: '#FF8833',
    light: '#FF5500',
    c1: '#FF4500',
    c1e: '#FF6600',
    c2: '#FF6600',
    c2e: '#FFA500',
    ringC: '#FF4500',
    ringE: '#FF8833',
    sparkMain: '#FFCC66',
    sparkMainE: '#FFD700',
    pl1: '#FF5500',
  },
  necromancer: {
    body: '#15803d',
    emissive: '#4ade80',
    trail: '#22c55e',
    trailEmissive: '#86efac',
    light: '#4ade80',
    c1: '#166534',
    c1e: '#22c55e',
    c2: '#15803d',
    c2e: '#4ade80',
    ringC: '#16a34a',
    ringE: '#86efac',
    sparkMain: '#86efac',
    sparkMainE: '#bbf7d0',
    pl1: '#22c55e',
  },
  draconic: {
    body: '#7e22ce',
    emissive: '#c084fc',
    trail: '#9333ea',
    trailEmissive: '#c084fc',
    light: '#a855f7',
    c1: '#6b21a8',
    c1e: '#9333ea',
    c2: '#7e22ce',
    c2e: '#c084fc',
    ringC: '#7e22ce',
    ringE: '#c084fc',
    sparkMain: '#c084fc',
    sparkMainE: '#e9d5ff',
    pl1: '#a855f7',
  },
};

export function resolveCrossentropyBlitzAspectKey(
  aspect: WeaponAspect | null | undefined,
): CrossentropyBlitzAspectKey {
  if (aspect === ASPECT_NECROMANCER) return 'necromancer';
  if (aspect === ASPECT_DRACONIC) return 'draconic';
  return 'archmage';
}

export function getCrossentropyBlitzAspectPalette(
  aspectKey: CrossentropyBlitzAspectKey | null | undefined,
): CrossentropyBlitzAspectPalette {
  return BLITZ_ASPECT_PALETTES[aspectKey ?? 'archmage'] ?? BLITZ_ASPECT_PALETTES.archmage;
}

// ── Colossus Smite (E) default beam colors by Runeblade aspect ─────────────
// Talent themes (Infernal / Infested / Staggering / Deflect / Corrupted) override these.

export interface SmiteAspectColorPair {
  primary: string;
  secondary: string;
}

/** Default orange pair used by Blademaster / Royal Guard (and unknown aspects). */
const SMITE_DEFAULT_COLOR_PAIR: SmiteAspectColorPair = {
  primary: '#ff8c00',
  secondary: '#ffe033',
};

const SMITE_ASPECT_DEFAULT_COLOR_PAIRS: Partial<Record<WeaponAspect, SmiteAspectColorPair>> = {
  [ASPECT_LEGIONNAIRE]: {
    primary: '#8efaf6',
    secondary: '#c4fef9',
  },
  [ASPECT_DEATHDEALER]: {
    primary: '#ff7700',
    secondary: '#ffb347',
  },
  // BLADEMASTER / ROYAL_GUARD intentionally omit — fall through to SMITE_DEFAULT_COLOR_PAIR
};

/** Resolve Colossus Smite beam colors when no talent/corruption theme is active. */
export function getSmiteAspectDefaultColorPair(
  aspect: WeaponAspect | null | undefined,
): SmiteAspectColorPair {
  if (aspect && SMITE_ASPECT_DEFAULT_COLOR_PAIRS[aspect]) {
    return SMITE_ASPECT_DEFAULT_COLOR_PAIRS[aspect]!;
  }
  return SMITE_DEFAULT_COLOR_PAIR;
}

// ── Crescent Blades special slash colors by Sabres aspect ──────────────────

export interface CrescentSlashAspectPalette {
  core: string;
  edge: string;
  flash: string;
  ring: string;
}

const CRESCENT_SLASH_DEFAULT_PALETTE: CrescentSlashAspectPalette = {
  core: '#ffe4a0',
  edge: '#ff6a5c',
  flash: '#ffffff',
  ring: '#ffe8c0',
};

const CRESCENT_SLASH_ASPECT_PALETTES: Partial<
  Record<WeaponAspect, CrescentSlashAspectPalette>
> = {
  [ASPECT_FIRE_AFFINITY]: {
    core: '#ffb380',
    edge: '#ff5533',
    flash: '#ffffff',
    ring: '#ffd4a0',
  },
  [ASPECT_FROST_AFFINITY]: {
    core: '#bae6fd',
    edge: '#38bdf8',
    flash: '#e0f2fe',
    ring: '#7dd3fc',
  },
  [ASPECT_WARLORD]: {
    core: '#bbf7d0',
    edge: '#4ade80',
    flash: '#f0fdf4',
    ring: '#86efac',
  },
};

/** Resolve Crescent Blades slash VFX palette from Sabres aspect. */
export function getCrescentSlashAspectPalette(
  aspect: WeaponAspect | null | undefined,
): CrescentSlashAspectPalette {
  if (aspect && CRESCENT_SLASH_ASPECT_PALETTES[aspect]) {
    return CRESCENT_SLASH_ASPECT_PALETTES[aspect]!;
  }
  return CRESCENT_SLASH_DEFAULT_PALETTE;
}

// ── Runeblade aspect combat (R ability) ───────────────────────────────────

export function isLegionnaireRunebladeAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_LEGIONNAIRE;
}

/** Alias — Death Grasp is only unlocked on Legionnaire aspect Runeblade. */
export function isRunebladeDeathGraspAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return isLegionnaireRunebladeAspect(aspect);
}

/** Physical R hotkey ability for Runeblade aspects (`DEATH_GRASP` or none). */
export function resolveRunebladeRAbilityId(
  aspect: WeaponAspect | null | undefined,
): 'DEATH_GRASP' | null {
  return isLegionnaireRunebladeAspect(aspect) ? 'DEATH_GRASP' : null;
}

// ── Bow aspect combat (R ability) ─────────────────────────────────────────

export function isDruidBowAspect(aspect: WeaponAspect | null | undefined): boolean {
  return aspect === ASPECT_DRUID;
}

export function isSniperBowAspect(aspect: WeaponAspect | null | undefined): boolean {
  return aspect === ASPECT_SNIPER;
}

/** Sniper Hunter's Mark duration from Barrage hits (keep in sync with backend/gameRoom.js). */
export const SNIPER_HUNTERS_MARK_DURATION_MS = 5000;

// ── Sniper Terminal Velocity (keep in sync with ControlSystem / ProjectileSystem / useViperSting) ─

export const TERMINAL_VELOCITY_BASE_DAMAGE = 20;
export const TERMINAL_VELOCITY_DAMAGE_PER_AGILITY = 2;
/** Horizontal distance (shot origin → target) must exceed this for the bonus. */
export const TERMINAL_VELOCITY_MIN_RANGE = 10;

export function qualifiesForTerminalVelocityRange(horizontalDistance: number): boolean {
  return horizontalDistance > TERMINAL_VELOCITY_MIN_RANGE;
}

/** Flat bonus damage: 20 + 2 × AGI. Caller must gate on Sniper aspect + range. */
export function getTerminalVelocityBonusDamage(agility: number): number {
  return (
    TERMINAL_VELOCITY_BASE_DAMAGE +
    TERMINAL_VELOCITY_DAMAGE_PER_AGILITY * Math.max(0, agility)
  );
}

// ── Beastmaster tiger companion (keep in sync with backend/gameRoom.js) ─────

export const BEASTMASTER_TIGER_MAX_HP = 600;
export const BEASTMASTER_TIGER_DAMAGE = 29;
export const BEASTMASTER_TIGER_AGGRO_RADIUS = 10;
export const BEASTMASTER_TIGER_FOLLOW_DISTANCE = 3.0;
export const BEASTMASTER_TIGER_ATTACK_RANGE = 2.6;
export const BEASTMASTER_TIGER_WALK_SPEED = 2.85;
export const BEASTMASTER_TIGER_RUN_SPEED = 4.2;
export const BEASTMASTER_TIGER_ATTACK_COOLDOWN_MS = 1100;
/** Explorer only: Beastmaster tiger auto-revives beside its owner after this delay. */
export const BEASTMASTER_TIGER_EXPLORE_REVIVE_MS = 30000;
/** Throne prep: tiger stops attacking the training dummy if owner has not hit it for this long. */
export const THRONE_DUMMY_TIGER_DISENGAGE_MS = 5000;

export function isBeastmasterBowAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return aspect === ASPECT_BEASTMASTER;
}

/** Fixed server enemy id for a player's Beastmaster tiger companion. */
export function resolveBeastmasterTigerId(playerId: string): string {
  return `beastmaster-tiger-${playerId}`;
}

/** Alias — Rejuvenating Shot is only unlocked on Druid aspect bow. */
export function isBowRejuvenatingShotAspect(
  aspect: WeaponAspect | null | undefined,
): boolean {
  return isDruidBowAspect(aspect);
}

/** Physical R hotkey ability for bow aspects (`BOW_F` or none). */
export function resolveBowRAbilityId(
  aspect: WeaponAspect | null | undefined,
): 'BOW_F' | null {
  return isDruidBowAspect(aspect) ? 'BOW_F' : null;
}

/**
 * HUD / loadout display name for an ability, with aspect-aware overrides.
 * Royal Guard Tempest Sweep is bound to the physical R hotkey slot, not RUNEBLADE_R.
 */
export function resolveAbilityDisplayName(
  abilityId: string,
  fallbackName: string,
  aspect?: WeaponAspect | null,
  slot?: 'Q' | 'E' | 'R',
): string {
  if (slot === 'R' && isRunebladeTempestSweepAspect(aspect)) {
    return 'Tempest Sweep';
  }
  return fallbackName;
}
