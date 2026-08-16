/**
 * Shared melee swing profiles for EnemyAI.performMeleeSwing.
 * Weight-class defaults drive arc, lunge, knockback, and hit-stop feel.
 */

const MELEE_COMMIT_FRAC = 0.6;
const MELEE_CLOSE_INSET = 0.35;

const WEIGHT_CLASS_DEFAULTS = {
  beast: {
    arcDeg: 110,
    lunge: { distance: 0.35, atMs: 400 },
    knockback: null,
    hitStopMs: 0,
  },
  'large-beast': {
    arcDeg: 140,
    lunge: { distance: 0.45, atMs: 500 },
    knockback: { distance: 2.5, duration: 0.25 },
    hitStopMs: 40,
  },
  humanoid: {
    arcDeg: 100,
    lunge: { distance: 0.3, atMs: 450 },
    knockback: null,
    hitStopMs: 0,
  },
  giant: {
    arcDeg: 160,
    lunge: { distance: 0.4, atMs: 500 },
    knockback: { distance: 5, duration: 0.4 },
    hitStopMs: 80,
  },
};

function buildProfile(overrides) {
  const wc = overrides.weightClass || 'humanoid';
  const defaults = WEIGHT_CLASS_DEFAULTS[wc] || WEIGHT_CLASS_DEFAULTS.humanoid;
  return {
    cooldownMapKey: 'bossAttackCooldown',
    variants: 1,
    emitBeastHitSfx: false,
    useMeleeIndex: false,
    requireFacingToStart: false,
    aoeSwing: false,
    ...defaults,
    ...overrides,
    // Allow explicit null knockback / lunge to override weight-class defaults
    knockback: Object.prototype.hasOwnProperty.call(overrides, 'knockback')
      ? overrides.knockback
      : defaults.knockback,
    lunge: Object.prototype.hasOwnProperty.call(overrides, 'lunge')
      ? overrides.lunge
      : defaults.lunge,
    hitStopMs: Object.prototype.hasOwnProperty.call(overrides, 'hitStopMs')
      ? overrides.hitStopMs
      : defaults.hitStopMs,
    arcDeg: overrides.arcDeg ?? defaults.arcDeg,
  };
}

/** @type {Record<string, ReturnType<typeof buildProfile>>} */
const MELEE_PROFILES = {
  tiger: buildProfile({
    type: 'tiger',
    eventPrefix: 'tiger',
    idField: 'tigerId',
    weightClass: 'beast',
    range: 2.6,
    cooldownMs: 875, // was 850 — compensate for arc dodge window
    swingLockMs: 1250,
    hitDelayMs: 750,
    variants: 2,
    baseDamage: 19,
    damageType: 'tiger_melee',
    alliedDiskRadius: 2.5,
    emitBeastHitSfx: true,
  }),
  'boss-tiger': null, // aliased below
  wolf: buildProfile({
    type: 'wolf',
    eventPrefix: 'wolf',
    idField: 'wolfId',
    weightClass: 'beast',
    range: 2.6,
    cooldownMs: 875, // was 850
    swingLockMs: 1100,
    hitDelayMs: 650,
    variants: 2,
    baseDamage: 14,
    damageType: 'wolf_melee',
    alliedDiskRadius: 2.5,
    emitBeastHitSfx: true,
  }),
  bear: buildProfile({
    type: 'bear',
    eventPrefix: 'bear',
    idField: 'bearId',
    weightClass: 'beast',
    range: 2.75,
    cooldownMs: 1450, // was 1500
    swingLockMs: 1500,
    hitDelayMs: 750,
    variants: 2,
    baseDamage: 33,
    damageType: 'bear_melee',
    alliedDiskRadius: 2.6,
    emitBeastHitSfx: true,
  }),
  serpent: buildProfile({
    type: 'serpent',
    eventPrefix: 'serpent',
    idField: 'serpentId',
    weightClass: 'beast',
    range: 2.75,
    cooldownMs: 1100, // was 1000
    swingLockMs: 2250,
    hitDelayMs: 750,
    variants: 2,
    baseDamage: 21,
    damageType: 'serpent_melee',
    alliedDiskRadius: 2.6,
    emitBeastHitSfx: true,
  }),
  'bone-spider': buildProfile({
    type: 'bone-spider',
    eventPrefix: 'bone-spider',
    idField: 'boneSpiderId',
    weightClass: 'beast',
    range: 3.0,
    cooldownMs: 2100,
    swingLockMs: 900,
    hitDelayMs: 700,
    variants: 2,
    baseDamage: 53,
    damageType: 'bone_spider_melee',
    alliedDiskRadius: 2.8,
    emitBeastHitSfx: true,
  }),
  skyray: buildProfile({
    type: 'skyray',
    eventPrefix: 'skyray',
    idField: 'skyrayId',
    weightClass: 'beast',
    range: 2.5,
    cooldownMs: 1200,
    swingLockMs: 1200, // matches SkyRayRenderer ATTACK_DURATION / bite clip
    hitDelayMs: 750,
    variants: 2,
    baseDamage: 27,
    damageType: 'skyray_melee',
    alliedDiskRadius: 2.4,
    // Swimming unit — a ground lunge looks odd mid-bite
    lunge: null,
  }),
  wyvern: buildProfile({
    type: 'wyvern',
    eventPrefix: 'wyvern',
    idField: 'wyvernId',
    weightClass: 'large-beast',
    range: 3.075,
    cooldownMs: 2100,
    swingLockMs: 1500, // matches WyvernRenderer ATTACK_DURATION / attack clip
    hitDelayMs: 775,
    variants: 1,
    baseDamage: 42,
    damageType: 'wyvern_melee',
    alliedDiskRadius: 2.9,
    emitBeastHitSfx: true,
    lunge: null, // flying unit — ground lunge would feel disconnected
  }),
  terrorhawk: buildProfile({
    type: 'terrorhawk',
    eventPrefix: 'terrorhawk',
    idField: 'terrorhawkId',
    weightClass: 'large-beast',
    range: 3.0,
    cooldownMs: 2200,
    swingLockMs: 2100,
    hitDelayMs: 750,
    variants: 1,
    baseDamage: 23,
    damageType: 'terrorhawk_melee',
    alliedDiskRadius: 2.8,
    emitBeastHitSfx: true,
  }),
  destiny: buildProfile({
    type: 'destiny',
    eventPrefix: 'destiny',
    idField: 'destinyId',
    weightClass: 'large-beast',
    range: 4.1,
    cooldownMs: 2200,
    swingLockMs: 1500,
    hitDelayMs: 1200,
    variants: 1,
    baseDamage: 71,
    damageType: 'destiny_melee',
    alliedDiskRadius: 3.5,
    aoeSwing: true,
    knockback: { distance: 3.5, duration: 0.3 },
    hitStopMs: 50,
    lunge: null,
  }),
  knight: buildProfile({
    type: 'knight',
    eventPrefix: 'knight',
    idField: 'knightId',
    weightClass: 'humanoid',
    range: 2.6,
    cooldownMs: 2100, // was 2500
    swingLockMs: 900,
    hitDelayMs: 795,
    variants: 1,
    baseDamage: 25,
    damageType: 'knight_melee',
    alliedDiskRadius: 2.6,
  }),
  templar: buildProfile({
    type: 'templar',
    eventPrefix: 'templar',
    idField: 'templarId',
    weightClass: 'humanoid',
    range: 2.725,
    cooldownMs: 1800, // was 2000
    swingLockMs: 1200,
    hitDelayMs: 725,
    variants: 1,
    baseDamage: 48,
    damageType: 'templar_melee',
    alliedDiskRadius: 2.6,
  }),
  spectre: buildProfile({
    type: 'spectre',
    eventPrefix: 'spectre',
    idField: 'spectreId',
    weightClass: 'humanoid',
    range: 2.725,
    cooldownMs: 1500, // was 1600
    swingLockMs: 1200,
    hitDelayMs: 775,
    variants: 2,
    baseDamage: 44,
    damageType: 'spectre_melee',
    alliedDiskRadius: 2.6,
  }),
  'death-knight': buildProfile({
    type: 'death-knight',
    eventPrefix: 'death-knight',
    idField: 'deathKnightId',
    weightClass: 'humanoid',
    range: 2.725,
    cooldownMs: 1500, // was 1600
    swingLockMs: 1000,
    hitDelayMs: 750,
    variants: 2,
    baseDamage: 49,
    damageType: 'death_knight_melee',
    alliedDiskRadius: 2.6,
  }),
  shaman: buildProfile({
    type: 'shaman',
    eventPrefix: 'shaman',
    idField: 'shamanId',
    weightClass: 'humanoid',
    range: 2.725,
    cooldownMs: 1350, // was 950
    swingLockMs: 950,
    hitDelayMs: 725,
    variants: 1,
    baseDamage: 32,
    damageType: 'shaman_melee',
    alliedDiskRadius: 2.6,
  }),
  ghoul: buildProfile({
    type: 'ghoul',
    eventPrefix: 'ghoul',
    idField: 'ghoulId',
    weightClass: 'humanoid',
    range: 2.4,
    cooldownMs: 2000,
    swingLockMs: 900,
    hitDelayMs: 700,
    variants: 1,
    baseDamage: 28,
    damageType: 'ghoul_melee',
    alliedDiskRadius: 2.4,
    cooldownMapKey: 'ghoulAttackCooldown',
  }),
  titan: buildProfile({
    type: 'titan',
    eventPrefix: 'titan',
    idField: 'titanId',
    weightClass: 'giant',
    range: 3.0,
    cooldownMs: 2500,
    swingLockMs: 1500,
    hitDelayMs: 700,
    variants: 1,
    baseDamage: 100,
    damageType: 'titan_melee',
    alliedDiskRadius: 3.0,
    aoeSwing: true,
    knockback: { distance: 7, duration: 0.5 },
    hitStopMs: 90,
    cooldownMapKey: 'titanAttackCooldown',
  }),
  nemesis: buildProfile({
    type: 'nemesis',
    eventPrefix: 'nemesis',
    idField: 'nemesisId',
    weightClass: 'giant',
    range: 3.0,
    cooldownMs: 1750,
    swingLockMs: 950,
    hitDelayMs: 750, // pre-overhaul NEMESIS_HIT_DELAY_MS
    variants: 2,
    baseDamage: 80,
    damageType: 'nemesis_melee',
    alliedDiskRadius: 3.0,
    aoeSwing: true,
    knockback: { distance: 5, duration: 0.4 },
    hitStopMs: 70,
    cooldownMapKey: 'nemesisAttackCooldown',
    lunge: null, // long commit — tracking only
  }),
  'stone-giant': buildProfile({
    type: 'stone-giant',
    eventPrefix: 'stone-giant',
    idField: 'stoneGiantId',
    weightClass: 'giant',
    range: 3.0,
    cooldownMs: 2100,
    swingLockMs: 1940,
    hitDelayMs: 825,
    variants: 2,
    baseDamage: 100,
    damageType: 'stone_giant_melee',
    alliedDiskRadius: 3.0,
    aoeSwing: true,
    knockback: { distance: 7, duration: 0.5 },
    hitStopMs: 90,
    cooldownMapKey: 'palaceHeavyAttackCooldown',
  }),
  'eternal-oak': buildProfile({
    type: 'eternal-oak',
    eventPrefix: 'eternal-oak',
    idField: 'eternalOakId',
    weightClass: 'giant',
    range: 3.0,
    cooldownMs: 2100,
    swingLockMs: 2240,
    hitDelayMs: 825,
    variants: 2,
    baseDamage: 100,
    damageType: 'eternal_oak_melee',
    alliedDiskRadius: 3.0,
    aoeSwing: true,
    knockback: { distance: 7, duration: 0.5 },
    hitStopMs: 90,
    cooldownMapKey: 'palaceHeavyAttackCooldown',
  }),
  colossus: buildProfile({
    type: 'colossus',
    eventPrefix: 'colossus',
    idField: 'colossusId',
    weightClass: 'giant',
    range: 3.0,
    cooldownMs: 1900,
    swingLockMs: 1650,
    hitDelayMs: 735,
    variants: 2,
    baseDamage: 100,
    damageType: 'colossus_melee',
    alliedDiskRadius: 3.0,
    aoeSwing: true,
    knockback: { distance: 7, duration: 0.5 },
    hitStopMs: 90,
    cooldownMapKey: 'palaceHeavyAttackCooldown',
  }),
  boss: buildProfile({
    type: 'boss',
    eventPrefix: 'boss',
    idField: 'bossId',
    weightClass: 'giant',
    range: 2.9,
    cooldownMs: 2150,
    swingLockMs: 1200,
    hitDelayMs: 875,
    variants: 1,
    useMeleeIndex: true,
    requireFacingToStart: true,
    baseDamage: 23,
    damageType: 'boss_melee',
    alliedDiskRadius: 2.9,
    knockback: { distance: 3, duration: 0.3 },
    hitStopMs: 70,
    lunge: { distance: 0.3, atMs: 450 },
  }),
};

// Boss-scaled beast aliases share timings with base type
MELEE_PROFILES['boss-tiger'] = { ...MELEE_PROFILES.tiger, type: 'boss-tiger' };
MELEE_PROFILES['boss-wolf'] = { ...MELEE_PROFILES.wolf, type: 'boss-wolf' };
MELEE_PROFILES['boss-bear'] = { ...MELEE_PROFILES.bear, type: 'boss-bear' };
MELEE_PROFILES['boss-serpent'] = { ...MELEE_PROFILES.serpent, type: 'boss-serpent' };

function getMeleeProfile(type) {
  return MELEE_PROFILES[type] || null;
}

function getMeleeHalfArcRad(profile) {
  const deg = profile?.arcDeg ?? 100;
  return (deg * Math.PI) / 180 / 2;
}

function getMeleeCommitAtMs(profile) {
  return Math.floor((profile?.hitDelayMs ?? 800) * MELEE_COMMIT_FRAC);
}

module.exports = {
  MELEE_PROFILES,
  MELEE_COMMIT_FRAC,
  MELEE_CLOSE_INSET,
  WEIGHT_CLASS_DEFAULTS,
  getMeleeProfile,
  getMeleeHalfArcRad,
  getMeleeCommitAtMs,
  buildProfile,
};
