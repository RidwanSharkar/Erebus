// Audio System for managing game sound effects and music
import { Howl, Howler } from 'howler';
import { System } from '@/ecs/System';
import { Vector3 } from 'three';
import { WeaponType } from '@/components/dragon/weapons';
import { EREBUS_STRIKE_INDICATOR_EVENT } from '@/utils/strikeIndicatorEvent';
import { isTabHidden } from '@/utils/tabVisibility';

export interface SoundConfig {
  volume?: number;
  loop?: boolean;
  rate?: number;
}

type CoopBgmMode = 'hub' | 'combat' | 'chaos' | 'none';

/** Large music files: HTML5 Audio streams instead of full Web Audio decode (lower memory). */
const LARGE_BGM_HTML5 = true;

/** Named co-op BGM cache keys (room-specific tracks under /audio/sfx/ui/tracks/). */
const COOP_NAMED_BGM_CACHE_IDS = Object.freeze([
  'coop_bgm_throne',
  'coop_bgm_delirium_gate',
  'coop_bgm_eden',
  'coop_bgm_erebus_gate',
  'coop_bgm_sunken_temple',
  'coop_bgm_eternity_palace',
  'coop_bgm_merchant',
  'coop_bgm_boss',
] as const);

type CoopNamedBgmTrack = { cacheId: string; src: string };

/**
 * Map combat room kind → fixed track. Returns 'random' for halls / intro / deep_sanctum / etc.
 * Accepts string | null to avoid coupling AudioSystem to CoopRoomKind.
 */
function resolveCoopCombatBgm(
  roomKind: string | null,
  opts: { bossThroneArena: boolean },
): CoopNamedBgmTrack | 'random' {
  if (roomKind === 'delirium_gate') {
    return { cacheId: 'coop_bgm_delirium_gate', src: '/audio/sfx/ui/tracks/deliriumGate.mp3' };
  }
  if (roomKind === 'eden' || roomKind === 'false_eden' || roomKind === 'dream_layer' || roomKind === 'fae_realm' || roomKind === 'eden_finale') {
    return { cacheId: 'coop_bgm_eden', src: '/audio/sfx/ui/tracks/eden.mp3' };
  }
  if (roomKind === 'erebus_gate') {
    return { cacheId: 'coop_bgm_erebus_gate', src: '/audio/sfx/ui/tracks/erebusGate.mp3' };
  }
  if (roomKind === 'sunken_temple') {
    return { cacheId: 'coop_bgm_sunken_temple', src: '/audio/sfx/ui/tracks/sunkenTemple.MP3' };
  }
  if (roomKind === 'eternity_palace') {
    return { cacheId: 'coop_bgm_eternity_palace', src: '/audio/sfx/ui/tracks/throne.MP3' };
  }
  if (roomKind === 'merchant') {
    return { cacheId: 'coop_bgm_merchant', src: '/audio/sfx/ui/tracks/merchant.mp3' };
  }
  if (roomKind === 'boss' && opts.bossThroneArena) {
    return { cacheId: 'coop_bgm_boss', src: '/audio/sfx/ui/tracks/bossBattle.mp3' };
  }
  return 'random';
}

type SfxAsset = { id: string; file: string; html5?: boolean };

const WEAPON_SOUND_ASSETS: SfxAsset[] = [
  { id: 'bow_draw', file: 'bow/draw.mp3' },
  { id: 'bow_release', file: 'bow/release.mp3' },
  { id: 'bow_power_release', file: 'bow/powerRelease.mp3' },
  { id: 'bow_high_caliber', file: 'bow/high_caliber.mp3' },
  { id: 'bow_viper_sting_release', file: 'bow/viper_sting_release.mp3' },
  { id: 'bow_barrage_release', file: 'bow/barrage_release.mp3' },
  { id: 'bow_cobra_shot_release', file: 'bow/cobra_shot_release.mp3' },
  { id: 'bow_explosive_talons', file: 'bow/exposiveTalons.mp3' },
  { id: 'bow_explosion', file: 'bow/explosion.mp3' },
  { id: 'sabres_swing', file: 'sabres/sabres_swing.mp3' },
  { id: 'sabres_backstab', file: 'sabres/backstab.mp3' },
  { id: 'sabres_flourish', file: 'sabres/flourish.mp3' },
  { id: 'sabres_flourish_miss', file: 'sabres/flourish_miss.mp3' },
  { id: 'sabres_shadow_step', file: 'sabres/shadow_step.mp3' },
  { id: 'sabres_skyfall', file: 'sabres/skyfall.mp3' },
  { id: 'sabres_shatter', file: 'sabres/1SHATTER.mp3' },
  { id: 'entropic_bolt', file: 'scythe/entropic_bolts.mp3' },
  { id: 'crossentropy', file: 'scythe/crossentropy.mp3' },
  { id: 'blitz_cannon', file: 'scythe/blitzCannon.mp3' },
  { id: 'crossentropy_impact', file: 'scythe/crossentropy2.mp3' },
  { id: 'frost_nova', file: 'scythe/frost_nova.mp3' },
  { id: 'scythe_mantra', file: 'scythe/mantra.mp3' },
  { id: 'scythe_sunwell', file: 'scythe/sunwell.mp3' },
  { id: 'scythe_cryoflame', file: 'scythe/cryoflame.mp3' },
  { id: 'aftershock', file: 'scythe/aftershock.mp3' },
  { id: 'scythe_meteor', file: 'scythe/meteor.mp3' },
  { id: 'scythe_meteorite', file: 'scythe/meteorite.mp3' },
  { id: 'scythe_totem_bolt', file: 'scythe/totembolt.mp3' },
  { id: 'scythe_superconductor', file: 'scythe/superconductor.mp3' },
  { id: 'sword_swing_1', file: 'sword/swing_1.mp3' },
  { id: 'sword_swing_2', file: 'sword/swing_2.mp3' },
  { id: 'sword_swing_3', file: 'sword/swing_3.mp3' },
  { id: 'sword_charge', file: 'sword/charge.mp3' },
  { id: 'sword_deflect', file: 'sword/deflect.mp3' },
  { id: 'sword_crusader', file: 'sword/crusader.mp3' },
  { id: 'windshear', file: 'sword/windshear.mp3' },
  { id: 'colossus_strike', file: 'sword/colossus_strike.mp3' },
  { id: 'runeblade_heartrend', file: 'versus/heartrend.mp3' },
  { id: 'runeblade_smite', file: 'sword/smite.mp3' },
  { id: 'runeblade_wraithblade', file: 'runeblade/wraithblade.mp3' },
  { id: 'runeblade_void_grasp', file: 'runeblade/void_grasp.mp3' },
  { id: 'runeblade_swing_hit', file: 'runeblade/runeblade_swing.mp3' },
  { id: 'runeblade_whirlwind', file: 'runeblade/whirlwind.mp3' },
  { id: 'sword_miss_1', file: 'runeblade/swordMiss1.mp3' },
  { id: 'sword_miss_2', file: 'runeblade/swordMiss2.mp3' },
  { id: 'knight_miss', file: 'sabres/sabreMiss3.mp3' },
  { id: 'knight_damage_1', file: 'versus/knightDamage1.mp3' },
  { id: 'knight_damage_2', file: 'versus/knightDamage2.mp3' },
  { id: 'templar_damage_1', file: 'versus/templarDamage1.mp3' },
  { id: 'templar_damage_2', file: 'versus/templarDamage2.mp3' },
  { id: 'viper_impact', file: 'versus/viperimpact.mp3' },
  { id: 'viper_miss', file: 'versus/vipermiss.mp3' },
  { id: 'knight_aggro', file: 'versus/knightAggro.mp3' },
  { id: 'boss1_quake', file: 'versus/boss1quake.mp3' },
  { id: 'boss1_ability', file: 'versus/boss1.mp3' },
  { id: 'boss3_telegraph', file: 'versus/boss3telegraph.mp3' },
  { id: 'boss3_disc', file: 'versus/boss3disc.mp3' },
  { id: 'templar_telegraph', file: 'versus/templartelegraph.mp3' },
  { id: 'enemy_blink', file: 'versus/blink.mp3' },
  { id: 'wraith_buzzsaw', file: 'versus/buzzsaw.mp3' },
  { id: 'enemy_death', file: 'versus/deathSFX.mp3' },
  { id: 'enemy_death_ghoul', file: 'versus/1beastdeath.mp3' },
  { id: 'enemy_death_heavy', file: 'versus/1GOODDEATHSOUND.mp3' },
  { id: 'enemy_death_warlock', file: 'versus/warlockdeath.mp3' },
  { id: 'enemy_death_shade', file: 'versus/shadedeath.mp3' },
  { id: 'enemy_death_viper', file: 'versus/viperdeath.mp3' },
  { id: 'enemy_death_templar', file: 'versus/templardeath.mp3' },
  { id: 'enemy_death_martyr', file: 'versus/martyrdeath.mp3' },
  { id: 'enemy_death_boss2', file: 'versus/boss2death.mp3' },
  { id: 'enemy_death_tentacle_spine', file: 'versus/spinedeath.mp3' },
  { id: 'beast_tiger_aggro', file: 'versus/beasts/tiger_aggro.mp3' },
  { id: 'beast_tiger_attack', file: 'versus/beasts/tiger_attack.mp3' },
  { id: 'beast_wolf_attack1', file: 'versus/beasts/wolf_attack1.mp3' },
  { id: 'beast_wolf_attack2', file: 'versus/beasts/wolf_attack2.mp3' },
  { id: 'beast_wolf_howls', file: 'versus/beasts/wolf_howls.mp3' },
  { id: 'beast_wolf_death', file: 'versus/beasts/wolf_death.mp3' },
  { id: 'beast_serpent_aggro', file: 'versus/beasts/serpent_aggro.mp3' },
  { id: 'beast_serpent_attack', file: 'versus/beasts/serpent_attack.mp3' },
  { id: 'beast_wyvern_aggro', file: 'versus/beasts/wyvern_aggro.mp3' },
  { id: 'beast_wyvern_attack', file: 'versus/beasts/wyvern_attack.mp3' },
  { id: 'beast_wyvern_roar', file: 'versus/beasts/wyvern_roar.mp3' },
  { id: 'beast_death_wyverntiger', file: 'versus/beasts/wyverntiger_death.mp3' },
  { id: 'beast_bear_aggro', file: 'versus/beasts/bear_aggro.mp3' },
  { id: 'beast_bear_attack1', file: 'versus/beasts/bear_attack1.mp3' },
  { id: 'beast_bear_death', file: 'versus/beasts/bear_death.mp3' },
  { id: 'enemy_knight_smite', file: 'versus/smite.mp3' },
  { id: 'enemy_templar_smite', file: 'sword/smite.mp3' },
  { id: 'weaver_ghoul_summon', file: 'versus/summon.mp3' },
  { id: 'weaver_thunder', file: 'versus/weaver_thunder.mp3' },
  { id: 'knight_block', file: 'versus/knightBlock.mp3' },
  { id: 'enemy_spawn_summon', file: 'ui/summon.mp3' },
  { id: 'ui_summon_zombie', file: 'ui/summonZombie.mp3' },
  { id: 'shade_throw', file: 'versus/shadeThrow.mp3' },
  { id: 'shade_damage_1', file: 'versus/shadeDamage1.mp3' },
  { id: 'shade_damage_2', file: 'versus/shadeDamage2.mp3' },
  { id: 'shade_damage_3', file: 'versus/shadeDamage3.mp3' },
  { id: 'warlock_immolate', file: 'versus/immolate.mp3' },
  { id: 'warlock_voidbolt', file: 'versus/voidbolt.mp3' },
  { id: 'warlock_zap', file: 'versus/warlockzap.mp3' },
  { id: 'enemy_titan_stomp', file: 'versus/titanstomp.mp3' },
  { id: 'warhammer_impact', file: 'versus/titanHit.mp3' },
  { id: 'enemy_titan_bladestorm', file: 'runeblade/whirwind2.mp3' },
  { id: 'enemy_frost_ray', file: 'versus/frostRay.mp3' },
  { id: 'enemy_telegraph', file: 'versus/telegraph.mp3' },
  { id: 'versus_arming', file: 'versus/arming.mp3' },
  { id: 'whisper_infernal', file: 'versus/whisperInfernal.mp3' },
  { id: 'whisper_tempest', file: 'versus/whisperTempest.mp3' },
  { id: 'whisper_abyssal', file: 'versus/whisperAbyssal.mp3' },
  { id: 'whisper_eldritch', file: 'versus/whisperEldritch.mp3' },
  { id: 'spear_swing', file: 'spear/spear_swing.mp3' },
  { id: 'whirlwind_charge', file: 'spear/whirlwind_charge.mp3' },
  { id: 'whirlwind_release', file: 'spear/whirlwind_release.mp3' },
  { id: 'throw_spear_charge', file: 'spear/throw_spear_charge.mp3' },
  { id: 'throw_spear_release', file: 'spear/throw_spear_release.mp3' },
  { id: 'lightning_bolt', file: 'spear/Lightning_bolt.mp3' },
  { id: 'flurry', file: 'spear/flurry.mp3' },
  { id: 'icebeam', file: 'scythe/icebeam.mp3' },
  { id: 'ui_selection', file: 'ui/selection.mp3' },
  { id: 'ui_interface', file: 'ui/interface1.mp3' },
  { id: 'ui_interface_2', file: 'ui/interface2.mp3' },
  { id: 'ui_interface_3', file: 'ui/interface3.mp3' },
  { id: 'ui_dash', file: 'ui/dash.mp3' },
  { id: 'ui_breath_1', file: 'ui/breath1.mp3' },
  { id: 'ui_breath_2', file: 'ui/breath2.mp3' },
  { id: 'ui_breath_3', file: 'ui/breath3.mp3' },
  { id: 'ui_breath_4', file: 'ui/breath4.mp3' },
  { id: 'ui_breath_5', file: 'ui/breath5.mp3' },
  { id: 'ui_hover', file: 'ui/hover.mp3' },
  { id: 'ui_reroll', file: 'ui/reroll.mp3' },
  { id: 'ui_interface_4', file: 'ui/interface4.mp3' },
  { id: 'ui_hitbox_bow', file: 'ui/bowHitbox.mp3' },
  { id: 'ui_hitbox_sabres', file: 'ui/sabresHitbox.mp3' },
  { id: 'ui_hitbox_scythe_1', file: 'ui/scythe_impact1.mp3' },
  { id: 'ui_hitbox_scythe_2', file: 'ui/scythe_impact2.mp3' },
  { id: 'ui_hitbox_scythe_3', file: 'ui/scythe_impact3.mp3' },
  { id: 'ui_hitbox_spear', file: 'ui/spearHitbox.mp3' },
  { id: 'ui_hitbox_sword', file: 'ui/swordHitbox.mp3' },
  { id: 'ui_room_start_1', file: 'ui/start1.mp3' },
  { id: 'ui_room_start_2', file: 'ui/start2.mp3' },
  { id: 'ui_room_finish', file: 'ui/finish.mp3' },
  { id: 'ui_footsteps', file: 'ui/footsteps.mp3' },
  { id: 'ui_defeat', file: 'ui/defeat.mp3' },
  { id: 'ui_gold_pickup', file: 'ui/gold.mp3' },
  { id: 'ui_tome_pickup', file: 'ui/tome.mp3' },
  { id: 'ui_frozen', file: 'ui/frozen.mp3' },
  { id: 'ui_ignite', file: 'ui/ignite.mp3' },
  { id: 'ui_entangle', file: 'ui/entangle.mp3' },
  { id: 'ui_acid', file: 'ui/acid.mp3' },
  { id: 'ui_lesser_heal', file: 'ui/lesserHeal.mp3' },
  { id: 'ui_greater_heal', file: 'ui/greaterHeal.mp3' },
  { id: 'ui_level', file: 'ui/1LEVEL.mp3' },
  { id: 'ui_aegis', file: 'ui/aegis.mp3' },
  { id: 'ui_deflect_bolt', file: 'ui/Deflect.mp3' },
  { id: 'ui_deflect_cast', file: 'ui/Deflect_cast.mp3' },
  { id: 'ui_locusts', file: 'ui/locusts.mp3' },
  { id: 'ui_locust_impact', file: 'ui/locust_impact.mp3' },
  { id: 'valkyrie_judgment_cast', file: 'versus/valykrie_cast.mp3' },
  { id: 'runeblade_swing1', file: 'runeblade/runeblade_swing1.mp3' },
  { id: 'judgment_corruption', file: 'versus/judgment_corruption.mp3' },
  { id: 'ui_devouring_circle', file: 'ui/devouringCircle.mp3' },
  { id: 'ui_prime_materia', file: 'ui/primemateria.mp3' },
  { id: 'ui_alchemy', file: 'ui/alchemy.mp3' },
  { id: 'enemy_firebolt', file: 'ui/firebolt.mp3' },
  { id: 'firebolt_impact', file: 'versus/fireboltImpact.mp3' },
  { id: 'incinerate_charge', file: 'ui/IncinerateCharge.mp3' },
  { id: 'incinerate_armed', file: 'ui/incinerateArmed.mp3' },
  { id: 'ui_shield_break', file: 'ui/1shieldBreak.mp3' },
  { id: 'ui_shield_regen', file: 'ui/1shieldRegen.mp3' },
  { id: 'merchant_greet_arrival', file: 'ui/merchantGreetArrival.mp3' },
  { id: 'merchant_greet_purchase', file: 'ui/merchantGreetPurchase.mp3' },
  { id: 'merchant_greet_exit', file: 'ui/merchantGreetExit.mp3' },
  { id: 'ui_pedestal', file: 'ui/pedestal.mp3' },
  { id: 'ui_fountain', file: 'ui/fountain.mp3' },
  { id: 'ui_void', file: 'ui/void.mp3' },
  { id: 'ui_warcrack', file: 'ui/WARCRACK.mp3' },
];

const STARTUP_SOUND_IDS = new Set([
  'ui_selection',
  'ui_interface',
  'ui_dash',
  'ui_breath_1',
  'ui_breath_2',
  'ui_breath_3',
  'ui_breath_4',
  'ui_room_start_1',
  'ui_room_start_2',
]);

/** Weapon-owned SFX loaded eagerly for the equipped weapon; other weapons lazy-load on first play. */
const WEAPON_SPECIFIC_SOUND_IDS: Partial<Record<WeaponType, readonly string[]>> = {
  [WeaponType.BOW]: [
    'bow_draw',
    'bow_release',
    'bow_power_release',
    'bow_high_caliber',
    'bow_viper_sting_release',
    'bow_barrage_release',
    'bow_cobra_shot_release',
    'bow_explosive_talons',
    'bow_explosion',
    'ui_hitbox_bow',
  ],
  [WeaponType.SABRES]: [
    'sabres_swing',
    'sabres_backstab',
    'sabres_flourish',
    'sabres_flourish_miss',
    'sabres_shadow_step',
    'sabres_skyfall',
    'knight_miss',
    'ui_hitbox_sabres',
  ],
  [WeaponType.SCYTHE]: [
    'entropic_bolt',
    'crossentropy',
    'blitz_cannon',
    'crossentropy_impact',
    'frost_nova',
    'scythe_mantra',
    'scythe_sunwell',
    'scythe_cryoflame',
    'aftershock',
    'scythe_meteor',
    'scythe_meteorite',
    'scythe_totem_bolt',
    'scythe_superconductor',
    'icebeam',
    'ui_hitbox_scythe_1',
    'ui_hitbox_scythe_2',
    'ui_hitbox_scythe_3',
  ],
  [WeaponType.SPEAR]: [
    'spear_swing',
    'whirlwind_charge',
    'whirlwind_release',
    'throw_spear_charge',
    'throw_spear_release',
    'lightning_bolt',
    'flurry',
    'ui_hitbox_spear',
  ],
  [WeaponType.SWORD]: [
    'sword_swing_1',
    'sword_swing_2',
    'sword_swing_3',
    'sword_charge',
    'sword_deflect',
    'sword_crusader',
    'windshear',
    'colossus_strike',
    'sword_miss_1',
    'sword_miss_2',
    'ui_hitbox_sword',
  ],
  [WeaponType.RUNEBLADE]: [
    'sword_swing_1',
    'sword_swing_2',
    'sword_swing_3',
    'sword_charge',
    'sword_deflect',
    'sword_crusader',
    'windshear',
    'colossus_strike',
    'runeblade_heartrend',
    'runeblade_smite',
    'runeblade_wraithblade',
    'runeblade_void_grasp',
    'runeblade_swing_hit',
    'warhammer_impact',
    'runeblade_whirlwind',
    'sword_miss_1',
    'sword_miss_2',
    'ui_hitbox_sword',
  ],
  [WeaponType.KNIGHT]: [
    'sword_swing_1',
    'sword_swing_2',
    'sword_swing_3',
    'knight_miss',
    'knight_damage_1',
    'knight_damage_2',
    'ui_hitbox_sword',
  ],
  [WeaponType.NONE]: ['ui_hitbox_sword'],
};

const ALL_WEAPON_SPECIFIC_SOUND_IDS = new Set(
  Object.values(WEAPON_SPECIFIC_SOUND_IDS).flat(),
);

const COMMON_GAMEPLAY_PRELOAD_IDS = new Set([
  ...WEAPON_SOUND_ASSETS.map(asset => asset.id).filter(id => !ALL_WEAPON_SPECIFIC_SOUND_IDS.has(id)),
  'icebeam', // Boss3 green beam loop — required even when player is not on Scythe
  'ui_warcrack',
  'incinerate_charge',
  'incinerate_armed',
]);

function getGameplayPreloadAssets(weapon?: WeaponType): SfxAsset[] {
  const weaponIds = WEAPON_SPECIFIC_SOUND_IDS[weapon ?? WeaponType.BOW] ?? WEAPON_SPECIFIC_SOUND_IDS[WeaponType.BOW]!;
  const preloadIds = new Set([...Array.from(COMMON_GAMEPLAY_PRELOAD_IDS), ...weaponIds]);
  return WEAPON_SOUND_ASSETS.filter(asset => preloadIds.has(asset.id));
}

export class AudioSystem extends System {
  public readonly requiredComponents = []; // Audio system doesn't require specific components

  /** Shared origin for non-positional UI SFX (Howler skips 3D positioning anyway). */
  private static readonly UI_ORIGIN = new Vector3(0, 0, 0);

  private static readonly DASH_BREATH_SOUND_IDS = [
    'ui_breath_1',
    'ui_breath_2',
    'ui_breath_3',
    'ui_breath_4',
  ] as const;

  /** Layered on dash SFX — louder so breath clips remain audible over dash.mp3. */
  private static readonly DASH_BREATH_VOLUME = 1.5;

  private soundCache = new Map<string, Howl>();
  private soundLoadPromises = new Map<string, Promise<Howl | null>>();
  private weaponPreloadPromise: Promise<void> | null = null;
  private startupPreloadPromise: Promise<void> | null = null;
  private readonly sfxById = new Map(WEAPON_SOUND_ASSETS.map(asset => [asset.id, asset]));
  private masterVolume = 0.725;
  private sfxVolume = 0.66;
  private listenerPosition = new Vector3(0, 0, 0);
  private coopBgmMode: CoopBgmMode = 'none';
  private coopChaosInstance: number | null = null;
  private coopRoomInstance: number | null = null;
  private currentCoopRoomTrackId: string | null = null;
  private footstepsLoopInstance: number | null = null;
  private footstepsShouldPlay = false;
  private footstepsRate = 1;
  private lastDamageBreathAtMs = 0;
  private shieldRegenLoopInstance: number | null = null;
  private shieldRegenShouldPlay = false;
  private soundLastPlayedAt = new Map<string, number>();
  /** Active looped gameplay SFX instances — one per soundId (stop-before-play). */
  private loopingSfxInstances = new Map<string, number>();
  /** Cycles scythe hit-confirm SFX across scythe_impact1/2/3. */
  private scytheHitboxVariant: 1 | 2 | 3 = 1;

  constructor() {
    super();
    this.setupAudioContext();
  }

  private setupAudioContext() {
    // Configure Howler for 3D spatial audio
    Howler.orientation(0, 0, -1, 0, 1, 0); // Forward direction
    Howler.volume(this.masterVolume);
  }

  public updateListenerPosition(position: Vector3) {
    this.listenerPosition.copy(position);
    Howler.pos(position.x, position.y, position.z);
  }

  private async loadSfx({ id, file, html5 }: SfxAsset): Promise<Howl | null> {
    const cached = this.soundCache.get(id);
    if (cached) return cached;

    const existingPromise = this.soundLoadPromises.get(id);
    if (existingPromise) return existingPromise;

    const loadPromise = new Promise<Howl | null>((resolve) => {
      const sound = new Howl({
        src: [`/audio/sfx/${file}`],
        volume: this.sfxVolume * this.masterVolume,
        preload: true,
        html5: html5 ?? false,
      });

      sound.once('load', () => {
        this.soundCache.set(id, sound);
        this.soundLoadPromises.delete(id);
        resolve(sound);
      });
      sound.once('loaderror', (_soundId, error) => {
        this.soundLoadPromises.delete(id);
        sound.unload();
        console.warn(`Failed to load sound ${id}:`, error);
        resolve(null);
      });
    });

    this.soundLoadPromises.set(id, loadPromise);
    return loadPromise;
  }

  private async preloadSfxAssets(assets: SfxAsset[]): Promise<void> {
    await Promise.all(assets.map(asset => this.loadSfx(asset)));
  }

  /** Preload only the small UI sounds needed before the first playable frame. */
  public preloadStartupSounds(): Promise<void> {
    if (!this.startupPreloadPromise) {
      const startupAssets = WEAPON_SOUND_ASSETS.filter(asset => STARTUP_SOUND_IDS.has(asset.id));
      this.startupPreloadPromise = this.preloadSfxAssets(startupAssets);
    }
    return this.startupPreloadPromise;
  }

  // Preload common combat SFX plus the equipped weapon subset; other weapons lazy-load on first play.
  public preloadWeaponSounds(weapon?: WeaponType): Promise<void> {
    if (!this.weaponPreloadPromise) {
      const resolvedWeapon = weapon ?? this.getCurrentWeaponFromControl();
      this.weaponPreloadPromise = this.preloadSfxAssets(getGameplayPreloadAssets(resolvedWeapon));
    }
    return this.weaponPreloadPromise;
  }

  /** Preload SFX for a newly equipped weapon (no-op if already cached). */
  public preloadWeaponSoundsForWeapon(weapon: WeaponType): Promise<void> {
    const assets = (WEAPON_SPECIFIC_SOUND_IDS[weapon] ?? [])
      .map(id => this.sfxById.get(id))
      .filter((asset): asset is SfxAsset => asset != null);
    return this.preloadSfxAssets(assets);
  }

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public async preloadBackgroundMusic(): Promise<void> {
    return Promise.resolve();
  }

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public startBackgroundMusicStreaming(): void {}

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public stopBackgroundMusicStreaming(): void {}

  private static readonly MULTI_TARGET_STATUS_COOLDOWN_MS = 500;
  private static readonly MELEE_HITBOX_SOUND_COOLDOWN_MS = 50;

  /** Plays `soundId` only if it hasn't been played within `cooldownMs`. */
  private playWeaponSoundWithCooldown(
    soundId: string,
    position: Vector3,
    config: SoundConfig | undefined,
    cooldownMs: number,
  ): number | null {
    const now = Date.now();
    const last = this.soundLastPlayedAt.get(soundId) ?? 0;
    if (now - last < cooldownMs) return null;
    this.soundLastPlayedAt.set(soundId, now);
    return this.playWeaponSound(soundId, position, config);
  }

  // Play weapon sound effect (local only)
  public playWeaponSound(soundId: string, position: Vector3, config?: SoundConfig) {
    if (isTabHidden()) return null;

    const sound = this.soundCache.get(soundId);
    if (!sound) {
      const asset = this.sfxById.get(soundId);
      if (asset) {
        void this.loadSfx(asset).then((loaded) => {
          if (loaded) this.playWeaponSound(soundId, position, config);
        });
      }
      return null;
    }

    const soundInstance = sound.play();

    // Skip 3D positioning to ensure sounds play at max volume regardless of distance

    // Apply custom config
    if (config) {
      if (config.volume !== undefined) {
        sound.volume(config.volume * this.sfxVolume * this.masterVolume, soundInstance);
      }
      if (config.rate !== undefined) {
        sound.rate(config.rate, soundInstance);
      }
      if (config.loop !== undefined) {
        sound.loop(config.loop, soundInstance);
      }
    }

    return soundInstance;
  }

  public playPlayerHurtSound(damage = 0, damageType?: string) {
    const type = (damageType ?? '').toLowerCase();
    const isHeavy = damage >= 65 || type.includes('boss') || type.includes('meteor');
    const isMagic = type.includes('magic') || type.includes('void') || type.includes('frost') || type.includes('fire');
    const soundId = isHeavy ? 'templar_damage_2' : isMagic ? 'warlock_voidbolt' : 'shade_damage_3';
    const volume = Math.min(0.52, 0.22 + damage / 260);
    const rate = isHeavy ? 0.86 : 0.96 + Math.random() * 0.08;

    return this.playWeaponSound(soundId, this.listenerPosition, { volume, rate });
  }

  // Play bow draw sound (called when charging starts)
  public playBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.6 });
  }

  // Play bow release sound (called when arrow is fired)
  public playBowReleaseSound(
    position: Vector3,
    chargeProgress?: number,
    isPerfectShot?: boolean,
    highCaliber?: boolean,
  ) {
    // Adjust volume/pitch based on charge level
    const volume = 0.7 + (chargeProgress || 0) * 0.3; // 0.7 to 1.0
    const rate = 0.9 + (chargeProgress || 0) * 0.2; // 0.9 to 1.1
    const soundId =
      isPerfectShot === true && highCaliber === true
        ? 'bow_high_caliber'
        : isPerfectShot === true
          ? 'bow_power_release'
          : 'bow_release';

    return this.playWeaponSound(soundId, position, {
      volume,
      rate
    });
  }

  // Play viper sting release sound (called when viper sting is fired)
  public playViperStingReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_viper_sting_release', position, { volume: 0.9 });
  }

  // Play barrage release sound (called when barrage is fired)
  public playBarrageReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_barrage_release', position, { volume: 0.9 });
  }

  // Play cobra shot release sound (called when cobra shot is fired)
  public playCobraShotReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_cobra_shot_release', position, { volume: 0.9 });
  }

  // Play bow ability release sound (called when bow abilities are fired)
  public playBowAbilityReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_release', position, { volume: 0.9 });
  }

  // Play sabres swing sound
  public playSabresSwingSound(position: Vector3) {
    return this.playWeaponSound('sabres_swing', position, { volume: 0.6 });
  }

  // Play sabres flourish sound (Sunder ability)
  public playSabresFlourishSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish', position, { volume: 0.9 });
  }

  // Play sabres flourish miss sound (Sunder whiff)
  public playSabresFlourishMissSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish_miss', position, { volume: 0.9 });
  }

  // Play sabres shadow step sound (Stealth ability)
  public playSabresShadowStepSound(position: Vector3) {
    return this.playWeaponSound('sabres_shadow_step', position, { volume: 0.8 });
  }

  // Play sabres skyfall sound
  public playSabresSkyfallSound(position: Vector3) {
    return this.playWeaponSound('sabres_skyfall', position, { volume: 1.0 });
  }

  public playSabresShatterSound(position: Vector3, volumeScale = 1) {
    return this.playWeaponSound('sabres_shatter', position, { volume: 1.05 * volumeScale });
  }

  /** Sabres Q/E impact — layered connect tick (separate from ability wind-up / backstab cue). */
  public playSabresAbilityImpactSound(position: Vector3) {
    return this.playWeaponSound('runeblade_swing_hit', position, {
      volume: 0.42,
      rate: 1.08,
    });
  }

  // Play entropic bolt sound
  public playEntropicBoltSound(position: Vector3) {
    return this.playWeaponSound('entropic_bolt', position, { volume: 0.8 });
  }

  // Play crossentropy sound
  public playCrossentropySound(position: Vector3) {
    return this.playWeaponSound('crossentropy', position, { volume: 0.9 });
  }

  // Play Blitz Cannon Crossentropy cast sound
  public playBlitzCannonSound(position: Vector3) {
    return this.playWeaponSound('blitz_cannon', position, { volume: 0.9 });
  }

  // Play crossentropy explosion impact sound (distinct from cast sound)
  public playCrossentropyImpactSound() {
    return this.playWeaponSound('crossentropy_impact', AudioSystem.UI_ORIGIN, { volume: 0.825 });
  }

  // Play sword swing sounds (combo steps 1-3)
  public playSwordSwingSound(comboStep: 1 | 2 | 3, position: Vector3) {
    const soundId = `sword_swing_${comboStep}`;
    return this.playWeaponSound(soundId, position, { volume: 0.8 });
  }

  // Play sword deflect sound (Q ability)
  public playSwordDeflectSound(position: Vector3) {
    return this.playWeaponSound('sword_deflect', position, { volume: 0.9 });
  }

  // Play sword charge sound (E ability)
  public playSwordChargeSound(position: Vector3) {
    return this.playWeaponSound('sword_charge', position, { volume: 0.9 });
  }

  public playCrusaderProcSound(position: Vector3) {
    return this.playWeaponSound('sword_crusader', position, { volume: 0.9 });
  }

  // Play windshear sound
  public playWindshearSound(position: Vector3) {
    return this.playWeaponSound('windshear', position, { volume: 0.9 });
  }

  // Play colossus strike sound
  public playColossusStrikeSound(position: Vector3) {
    return this.playWeaponSound('colossus_strike', position, { volume: 1.0 });
  }

  // Play frost nova sound
  public playFrostNovaSound(position: Vector3) {
    return this.playWeaponSound('frost_nova', position, { volume: 0.9 });
  }

  // Play backstab sound
  public playBackstabSound(position: Vector3) {
    return this.playWeaponSound('sabres_backstab', position, { volume: 0.8 });
  }

  // ===== ENEMY SOUND EFFECTS (25% volume) =====

  // Play enemy bow draw sound
  public playEnemyBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.125 }); // 0.6 * 0.25
  }

  // Play enemy bow release sound
  public playEnemyBowReleaseSound(position: Vector3, chargeProgress?: number, isPerfectShot?: boolean) {
    const volume = (0.7 + (chargeProgress || 0) * 0.3) * 0.25; // 25% of original volume
    const rate = 0.9 + (chargeProgress || 0) * 0.2;
    const soundId = isPerfectShot === true ? 'bow_power_release' : 'bow_release';
    return this.playWeaponSound(soundId, position, { volume, rate });
  }

  // Play enemy viper sting release sound
  public playEnemyViperStingReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_viper_sting_release', position, { volume: 0.225 }); // 0.9 * 0.25
  }

  // Play enemy sabres swing sound
  public playEnemySabresSwingSound(position: Vector3) {
    return this.playWeaponSound('sabres_swing', position, { volume: 0.2 }); // 0.8 * 0.25
  }

  // Play enemy sabres flourish sound
  public playEnemySabresFlourishSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish', position, { volume: 0.225 }); // 0.9 * 0.25
  }

  // Play enemy sabres shadow step sound
  public playEnemySabresShadowStepSound(position: Vector3) {
    return this.playWeaponSound('sabres_shadow_step', position, { volume: 0.65 }); // 0.8 * 0.5
  }

  // Play enemy sabres skyfall sound
  public playEnemySabresSkyfallSound(position: Vector3) {
    return this.playWeaponSound('sabres_skyfall', position, { volume: 0.5 }); // 1.0 * 0.5
  }

  // Play enemy entropic bolt sound
  public playEnemyEntropicBoltSound(position: Vector3) {
    return this.playWeaponSound('entropic_bolt', position, { volume: 0.2 }); // 0.8 * 0.25
  }

  // Play enemy crossentropy sound
  public playEnemyCrossentropySound(position: Vector3) {
    return this.playWeaponSound('crossentropy', position, { volume: 0.3 }); // 0.9 * 0.25
  }

  // Play enemy sword swing sounds
  public playEnemySwordSwingSound(comboStep: 1 | 2 | 3, position: Vector3) {
    const soundId = `sword_swing_${comboStep}`;
    return this.playWeaponSound(soundId, position, { volume: 0.1 }); // 0.8 * 0.25
  }

  /** Remote player Runeblade LMB — same asset as local connect at enemy volume. */
  public playEnemyRunebladeSwingHitSound(position: Vector3, useWarhammerImpact = false) {
    const soundId = useWarhammerImpact ? 'warhammer_impact' : 'runeblade_swing_hit';
    const volume = useWarhammerImpact ? 0.25 : 0.2;
    return this.playWeaponSound(soundId, position, { volume });
  }

  // Play enemy sword deflect sound
  public playEnemySwordDeflectSound(position: Vector3) {
    return this.playWeaponSound('sword_deflect', position, { volume: 0.75 }); // 0.9 * 0.5
  }

  // Play enemy sword charge sound
  public playEnemySwordChargeSound(position: Vector3) {
    return this.playWeaponSound('sword_charge', position, { volume: 0.225 }); // 0.9 * 0.25
  }

  // Play enemy windshear sound
  public playEnemyWindshearSound(position: Vector3) {
    return this.playWeaponSound('windshear', position, { volume: 0.45 }); // 0.9 * 0.5
  }

  // Play enemy colossus strike sound
  public playEnemyColossusStrikeSound(position: Vector3) {
    return this.playWeaponSound('colossus_strike', position, { volume: 0.8 }); // 1.0 * 0.5
  }

  // Play enemy frost nova sound
  public playEnemyFrostNovaSound(position: Vector3) {
    return this.playWeaponSound('frost_nova', position, { volume: 0.75 }); // 0.9 * 0.5
  }

  // Play enemy backstab sound
  public playEnemyBackstabSound(position: Vector3) {
    return this.playWeaponSound('sabres_backstab', position, { volume: 0.4 }); // 0.8 * 0.5
  }

  // Play enemy runeblade sounds
  public playEnemyRunebladeHeartrendSound(position: Vector3) {
    return this.playWeaponSound('runeblade_heartrend', position, { volume: 0.4 }); // Assuming 0.8 base volume
  }

  public playEnemyRunebladeSmiteSound(position: Vector3) {
    return this.playWeaponSound('runeblade_smite', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyRunebladeWraithbladeSound(position: Vector3) {
    return this.playWeaponSound('runeblade_wraithblade', position, { volume: 0.4 }); // Assuming 0.8 base volume
  }

  public playEnemyRunebladeVoidGraspSound(position: Vector3) {
    return this.playWeaponSound('runeblade_void_grasp', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyFrostRaySound(position: Vector3) {
    return this.playWeaponSound('enemy_frost_ray', position, { volume: 0.9 });
  }

  /** Valkyrie Judgment — cast wind-up (first `valkyrie-judgment-cast` payload). */
  public playValkyrieJudgmentCastSound(position: Vector3) {
    return this.playWeaponSound('valkyrie_judgment_cast', position, { volume: 0.9 });
  }

  /** Valkyrie Judgment — sword fall (synced to fall start). */
  public playValkyrieJudgmentFallSound(position: Vector3) {
    return this.playWeaponSound('runeblade_swing1', position, { volume: 0.85 });
  }

  /** Valkyrie Judgment corruption — loop while local player has the debuff. */
  public setJudgmentCorruptionPlaying(active: boolean): void {
    if (active) {
      this.playLoopingWeaponSound('judgment_corruption', this.listenerPosition, { volume: 0.75 });
    } else {
      this.stopLoopingWeaponSound('judgment_corruption');
    }
  }

  public playEnemyFireboltSound(position: Vector3) {
    return this.playWeaponSound('enemy_firebolt', position, { volume: 1.0 });
  }

  /** Firebolt / frost-ray impact — mirrors warlock voidbolt impact timing. */
  public playFireboltImpactSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('firebolt_impact', position, { volume: 0.9, ...config });
  }

  // Play enemy throw spear release sound
  public playEnemyThrowSpearReleaseSound(position: Vector3) {
    return this.playWeaponSound('throw_spear_release', position, { volume: 0.225 }); // 0.9 * 0.25
  }

  // Play enemy scythe sounds
  public playEnemyScytheMantraSound(position: Vector3) {
    return this.playWeaponSound('scythe_mantra', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyScytheSunwellSound(position: Vector3) {
    return this.playWeaponSound('scythe_sunwell', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyScytheCryoflameSound(position: Vector3) {
    return this.playWeaponSound('scythe_cryoflame', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  // Stop a specific sound instance
  public stopSound(soundId: string, soundInstance?: number) {
    const sound = this.soundCache.get(soundId);
    if (sound) {
      if (soundInstance !== undefined) {
        sound.stop(soundInstance);
        const tracked = this.loopingSfxInstances.get(soundId);
        if (tracked === soundInstance) {
          this.loopingSfxInstances.delete(soundId);
        }
      } else {
        sound.stop();
        this.loopingSfxInstances.delete(soundId);
      }
    }
  }

  /** Stop the tracked loop instance for `soundId`, if any. */
  public stopLoopingWeaponSound(soundId: string): void {
    const instance = this.loopingSfxInstances.get(soundId);
    if (instance !== undefined) {
      this.stopSound(soundId, instance);
    }
  }

  /** Play a looping weapon SFX — stops any prior loop of the same id before starting. */
  public playLoopingWeaponSound(
    soundId: string,
    position: Vector3,
    config?: SoundConfig,
  ): number | null {
    this.stopLoopingWeaponSound(soundId);

    if (!this.soundCache.has(soundId)) {
      const asset = this.sfxById.get(soundId);
      if (asset) {
        void this.loadSfx(asset).then((loaded) => {
          if (loaded) {
            this.playLoopingWeaponSound(soundId, position, config);
          }
        });
      }
      return null;
    }

    const instance = this.playWeaponSound(soundId, position, { ...config, loop: true });
    if (instance != null) {
      this.loopingSfxInstances.set(soundId, instance);
    }
    return instance;
  }

  /** Stop Cyclone Rush whirlwind — by instance ref and/or tracked loop map entry. */
  public stopRunebladeWhirlwindSound(instance?: number): void {
    if (instance !== undefined) {
      this.stopSound('runeblade_whirlwind', instance);
    }
    this.stopLoopingWeaponSound('runeblade_whirlwind');
  }

  // Set master volume (0.0 to 1.0)
  public setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  // Set SFX volume (0.0 to 1.0)
  public setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    // Update all cached sounds
    this.soundCache.forEach(sound => {
      sound.volume(volume * this.masterVolume);
    });
  }

  // Get current volumes
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  // Mute/unmute all audio
  public setMuted(muted: boolean) {
    Howler.mute(muted);
  }

  public isMuted(): boolean {
    return Howler.volume() === 0;
  }

  // Play runeblade heartrend sound (Corrupted Aura toggle)
  public playRunebladeHeartrendSound(position: Vector3) {
    return this.playWeaponSound('runeblade_heartrend', position, { volume: 0.8 });
  }

  // Play runeblade smite sound
  public playRunebladeSmiteSound(position: Vector3) {
    return this.playWeaponSound('runeblade_smite', position, { volume: 0.9 });
  }

  // Play runeblade wraithblade sound
  public playRunebladeWraithbladeSound(position: Vector3) {
    return this.playWeaponSound('runeblade_wraithblade', position, { volume: 0.9 });
  }

  // Play runeblade void grasp sound (death grasp Q ability)
  public playRunebladeVoidGraspSound(position: Vector3) {
    return this.playWeaponSound('runeblade_void_grasp', position, { volume: 0.9 });
  }

  /** Runeblade LMB connect — non-crit default; Deathdealer crits/non-crits use warhammer impact instead. */
  public playRunebladeSwingHitSound(position: Vector3) {
    return this.playWeaponSound('runeblade_swing_hit', position, { volume: 0.8 });
  }

  /** Deathdealer warhammer LMB connect (crit and non-crit) — heavy titan impact. */
  public playWarhammerImpactSound(position: Vector3) {
    return this.playWeaponSound('warhammer_impact', position, { volume: 0.85 });
  }

  /** Runeblade LMB impact — routes to warhammer or default connect by aspect. */
  public playRunebladeLmbImpactSound(position: Vector3, useWarhammerImpact: boolean) {
    return useWarhammerImpact
      ? this.playWarhammerImpactSound(position)
      : this.playRunebladeSwingHitSound(position);
  }

  /** Cyclone Rush post-charge blade spin — loop until stopped via `stopSound` / `stopLoopingWeaponSound`. */
  public playRunebladeWhirlwindSound(position: Vector3) {
    return this.playLoopingWeaponSound('runeblade_whirlwind', position, { volume: 0.9 });
  }

  // Play runeblade miss sound (swing into empty air, combo-step aware)
  public playRunebladeMissSound(comboStep: 1 | 2 | 3, position: Vector3) {
    const soundId = comboStep === 3 ? 'sword_miss_2' : 'sword_miss_1';
    return this.playWeaponSound(soundId, position, { volume: 0.75 });
  }

  // Play generic weapon miss sound for spear and sabres
  public playWeaponMissSound(position: Vector3) {
    return this.playWeaponSound('sword_miss_1', position, { volume: 0.75 });
  }

  // Play knight swing-miss sound (sabreMiss3)
  public playKnightMissSound(position: Vector3) {
    return this.playWeaponSound('knight_miss', position, { volume: 0.85 });
  }

  // Play knight hit-damage sound (alternates between 1 and 2)
  public playKnightDamageSound(position: Vector3, variant: 1 | 2) {
    return this.playWeaponSound(`knight_damage_${variant}`, position, { volume: 0.9 });
  }

  // Play templar swing-miss sound (swordMiss1)
  public playTemplarMissSound(position: Vector3) {
    return this.playWeaponSound('sword_miss_1', position, { volume: 0.85 });
  }

  // Play templar hit-damage sound (alternates between 1 and 2)
  public playTemplarDamageSound(position: Vector3, variant: 1 | 2) {
    return this.playWeaponSound(`templar_damage_${variant}`, position, { volume: 0.9 });
  }

  /**
   * Incoming enemy melee impact routed by weight class.
   * beast → beast attack clips / scythe impacts
   * humanoid → knight/templar damage
   * giant / large-beast → heavier scythe + stomp-like volume
   */
  public playMeleeImpactByWeightClass(
    weightClass: 'beast' | 'large-beast' | 'humanoid' | 'giant',
    position: Vector3,
  ) {
    if (weightClass === 'beast') {
      const soundId = `ui_hitbox_scythe_${this.scytheHitboxVariant}`;
      this.scytheHitboxVariant = ((this.scytheHitboxVariant % 3) + 1) as 1 | 2 | 3;
      return this.playWeaponSound(soundId, position, { volume: 0.8, rate: 1.05 });
    }
    if (weightClass === 'large-beast') {
      const soundId = `ui_hitbox_scythe_${this.scytheHitboxVariant}`;
      this.scytheHitboxVariant = ((this.scytheHitboxVariant % 3) + 1) as 1 | 2 | 3;
      return this.playWeaponSound(soundId, position, { volume: 0.95, rate: 0.92 });
    }
    if (weightClass === 'giant') {
      const soundId = `ui_hitbox_scythe_${this.scytheHitboxVariant}`;
      this.scytheHitboxVariant = ((this.scytheHitboxVariant % 3) + 1) as 1 | 2 | 3;
      this.playWeaponSound(soundId, position, { volume: 1.0, rate: 0.82 });
      return this.playWeaponSound('enemy_titan_stomp', position, { volume: 0.45, rate: 1.15 });
    }
    // humanoid
    const variant = (Math.random() < 0.5 ? 1 : 2) as 1 | 2;
    return this.playWeaponSound(`templar_damage_${variant}`, position, { volume: 0.9 });
  }

  /** Whoosh when an enemy melee swing whiffs (player dodged). */
  public playMeleeWhiffSound(position: Vector3) {
    return this.playWeaponSound('sword_miss_1', position, { volume: 0.7, rate: 1.1 });
  }

  public playEnemyKnightSmiteSound(position: Vector3) {
    return this.playWeaponSound('enemy_knight_smite', position, { volume: 0.85 });
  }

  public playEnemyTemplarSmiteSound(position: Vector3) {
    return this.playWeaponSound('enemy_templar_smite', position, { volume: 0.85 });
  }

  public playEnemyTitanStompSound(position: Vector3) {
    return this.playWeaponSound('enemy_titan_stomp', position, { volume: 0.9 });
  }

  /** Titan bladestorm tick — one-shot whirwind (caller throttles to ~1/sec). */
  public playTitanBladestormDamageSound(position: Vector3) {
    return this.playWeaponSound('enemy_titan_bladestorm', position, { volume: 0.85 });
  }

  public playWeaverGhoulSummonSound(position: Vector3) {
    return this.playWeaponSound('weaver_ghoul_summon', position, { volume: 0.85 });
  }

  public playWeaverLightningTelegraphSound(position: Vector3) {
    return this.playWeaponSound('weaver_thunder', position, { volume: 0.9 });
  }

  public playKnightBlockSound(position: Vector3) {
    return this.playWeaponSound('knight_block', position, { volume: 0.85 });
  }

  public playSummonZombieSound(position: Vector3) {
    return this.playWeaponSound('ui_summon_zombie', position, { volume: 0.85 });
  }

  // Play the flame-summon spawn cue when an enemy emerges into an enemy room.
  public playEnemySummonSpawnSound(position: Vector3) {
    return this.playWeaponSound('enemy_spawn_summon', position, { volume: 0.7 });
  }

  // Play enemy blink sound (Shade and Warlock teleport)
  public playEnemyBlinkSound(position: Vector3) {
    return this.playWeaponSound('enemy_blink', position, { volume: 0.9 });
  }

  // Play Wraith buzzsaw channel sound
  public playEnemyBuzzsawSound(position: Vector3) {
    return this.playWeaponSound('wraith_buzzsaw', position, { volume: 0.95 });
  }

  // Play enemy death sound — accepts a plain object so callers outside Three.js contexts
  // don't need to import Vector3. `deathSFX.mp3` is used for knight, weaver, boss3, wraith, and destiny.
  public playEnemyDeathSound(position: { x: number; y: number; z: number }, enemyType?: string) {
    const soundId = this.resolveEnemyDeathSoundId(enemyType);
    return this.playWeaponSound(soundId, new Vector3(position.x, position.y, position.z), { volume: 0.95 });
  }

  /** Kill sting (WARCRACK) + diegetic death SFX + red strike indicator at corpse position. */
  public playEnemyKillFeedback(
    position: { x: number; y: number; z: number },
    enemyType?: string,
  ) {
    this.playWeaponSound('ui_warcrack', AudioSystem.UI_ORIGIN, { volume: 1.1 });
    this.playEnemyDeathSound(position, enemyType);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EREBUS_STRIKE_INDICATOR_EVENT, {
          detail: {
            variant: 'kill',
            position: {
              x: position.x,
              y: position.y + 1.5,
              z: position.z,
            },
          },
        }),
      );
    }
  }

  private resolveEnemyDeathSoundId(enemyType?: string): string {
    if (enemyType === undefined) {
      return 'enemy_death';
    }
    switch (enemyType) {
      case 'knight':
      case 'allied-knight':
      case 'weaver':
      case 'wraith':
      case 'boss3':
      case 'destiny':
        return 'enemy_death';
      case 'colossus':
      case 'stone-giant':
      case 'eternal-oak':
      case 'titan':
        return 'enemy_death_heavy';
      case 'ghoul':
      case 'allied-demon':
      case 'boss-skeleton':
      case 'player-zombie':
      case 'boss':
      case 'nemesis':
        return 'enemy_death_ghoul';
      case 'tiger':
      case 'boss-tiger':
      case 'allied-tiger':
      case 'wyvern':
      case 'terrorhawk':
      case 'skyray':
        return 'beast_death_wyverntiger';
      case 'wolf':
      case 'boss-wolf':
      case 'allied-wolf':
        return 'beast_wolf_death';
      case 'bear':
      case 'boss-bear':
      case 'allied-bear':
        return 'beast_bear_death';
      case 'serpent':
      case 'boss-serpent':
      case 'allied-serpent':
      case 'bone-spider':
      case 'allied-spider':
      case 'tentacle-spine':
        return 'enemy_death_tentacle_spine';
      case 'martyr':
        return 'enemy_death_martyr';
      case 'warlock':
        return 'enemy_death_warlock';
      case 'shade':
      case 'greed':
      case 'spectre':
      case 'sentinel':
      case 'death-knight':
      case 'shaman':
      case 'assassin':
      case 'frost-queen':
        return 'enemy_death_shade';
      case 'viper':
      case 'allied-huntress':
      case 'allied-enchantress':
        return 'enemy_death_viper';
      case 'templar':
      case 'valkyrie':
        return 'enemy_death_templar';
      case 'boss2':
        return 'enemy_death_boss2';
      default:
        return 'enemy_death_templar';
    }
  }

  // Play Shade dart throw sound (one call per dart, staggered by the caller)
  public playShadeThrowSound(position: Vector3) {
    return this.playWeaponSound('shade_throw', position, { volume: 0.75 });
  }

  // Play Shade dart hit-damage sound (variant matches which dart hit: 1, 2, or 3)
  public playShadeDamageSound(position: Vector3, variant: 1 | 2 | 3) {
    return this.playWeaponSound(`shade_damage_${variant}`, position, { volume: 0.9 });
  }

  // Play Viper enemy bow draw sound (when the Viper starts drawing its bow)
  public playViperBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.65 });
  }

  // Play Viper enemy bow release sound (when the Viper fires its arrow)
  public playViperBowReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_release', position, { volume: 0.65 });
  }

  /** @deprecated Use authoritative hit/miss outcome sounds from the server. */
  public playViperArrowHitSound(position: Vector3) {
    return this.playViperImpactSound(position);
  }

  public playViperImpactSound(position: Vector3) {
    return this.playWeaponSound('viper_impact', position, { volume: 0.9 });
  }

  public playViperMissSound(position: Vector3) {
    return this.playWeaponSound('viper_miss', position, { volume: 0.8 });
  }

  public playKnightAggroSound(position: Vector3) {
    return this.playWeaponSound('knight_aggro', position, { volume: 0.75 });
  }

  public playBeastAggroSound(kind: 'tiger' | 'serpent' | 'wyvern' | 'bear', position: Vector3) {
    const soundId =
      kind === 'tiger'
        ? 'beast_tiger_aggro'
        : kind === 'serpent'
          ? 'beast_serpent_aggro'
          : kind === 'bear'
            ? 'beast_bear_aggro'
            : 'beast_wyvern_aggro';
    return this.playWeaponSound(soundId, position, { volume: 0.8 });
  }

  public playBeastAttackSound(soundId: string, position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound(soundId, position, { volume: 0.85, ...config });
  }

  public playWolfPackHowlsSound(position: Vector3) {
    return this.playWeaponSound('beast_wolf_howls', position, { volume: 0.9 });
  }

  public playBeastWyvernAttackSound(position: Vector3) {
    return this.playWeaponSound('beast_wyvern_attack', position, { volume: 0.85 });
  }

  public playBeastWyvernRoarSound(position: Vector3) {
    return this.playWeaponSound('beast_wyvern_roar', position, { volume: 0.9 });
  }

  public playBossTectonicQuakeWarnSound(position: Vector3) {
    return this.playWeaponSound('boss1_quake', position, { volume: 0.95 });
  }

  public playBoss1AbilitySound(position: Vector3) {
    return this.playWeaponSound('boss1_ability', position, { volume: 0.75 });
  }

  public playEnemyAttackTelegraphSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('enemy_telegraph', position, { volume: 0.95, ...config });
  }

  public playBoss3DiscSound(position: Vector3) {
    return this.playWeaponSound('boss3_disc', position, { volume: 0.9 });
  }

  public playBoss3BeamTelegraphSound(position: Vector3) {
    return this.playWeaponSound('boss3_telegraph', position, { volume: 0.9 });
  }

  public playTemplarBlinkTelegraphSound(position: Vector3) {
    return this.playWeaponSound('templar_telegraph', position, { volume: 0.9 });
  }

  public playExplosiveTalonsDetonationSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('bow_explosive_talons', position, { volume: 1.1, ...config });
  }

  public playMartyrArmingSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('versus_arming', position, { volume: 1.2, ...config });
  }

  public playExplosionSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('bow_explosion', position, { volume: 1.4, ...config });
  }

  // Play Warlock flame-strike (immolate) sound — fires when the pillars erupt
  public playWarlockImmolateSound(position: Vector3) {
    return this.playWeaponSound('warlock_immolate', position, { volume: 0.9 });
  }

  // Play Warlock void-bolt hit sound — fires when the chaos orb impacts
  public playWarlockVoidboltSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('warlock_voidbolt', position, { volume: 0.9, ...config });
  }

  // Play archon bolt release sound — Boss2 and Warlock horizontal lightning
  public playWarlockZapSound(position: Vector3, config?: SoundConfig) {
    return this.playWeaponSound('warlock_zap', position, { volume: 0.9, ...config });
  }

  // Play scythe mantra sound (totem summon)
  public playScytheMantraSound(position: Vector3) {
    return this.playWeaponSound('scythe_mantra', position, { volume: 0.8 });
  }

  // Play scythe sunwell sound (reanimate ability)
  public playScytheSunwellSound(position: Vector3) {
    return this.playWeaponSound('scythe_sunwell', position, { volume: 0.8 });
  }

  // Play scythe cryoflame sound (entropic bolt with passive)
  public playScytheCryoflameSound(position: Vector3) {
    return this.playWeaponSound('scythe_cryoflame', position, { volume: 0.7 });
  }

  public playMeteorIndicatorSound(position: Vector3) {
    return this.playWeaponSound('scythe_meteor', position, { volume: 0.6 });
  }

  public playCrossentropyMeteoriteFallSound(position: Vector3) {
    setTimeout(() => {
      this.playWeaponSound('scythe_meteorite', position, { volume: 0.9 });
    }, 500);
  }

  public playTotemBoltLaunchSound(position: Vector3) {
    return this.playWeaponSound('scythe_totem_bolt', position, { volume: 0.65 });
  }

  public playTotemSuperconductorSound(position: Vector3) {
    return this.playWeaponSound('scythe_superconductor', position, { volume: 0.825 });
  }

  // Play Aftershock eruption sound when the delayed ground strip detonates
  public playAftershockSound(position: Vector3) {
    return this.playWeaponSound('aftershock', position, { volume: 0.95 });
  }

  // Play UI selection sound
  public playUISelectionSound() {
    return this.playWeaponSound('ui_selection', AudioSystem.UI_ORIGIN, { volume: 0.7 });
  }

  public playUIGoldPickupSound() {
    return this.playWeaponSound('ui_gold_pickup', AudioSystem.UI_ORIGIN, { volume: 0.72 });
  }

  public playUITomePickupSound() {
    return this.playWeaponSound('ui_tome_pickup', AudioSystem.UI_ORIGIN, { volume: 0.72 });
  }

  // Play UI interface sound (for navigation buttons)
  public playUIInterfaceSound() {
    return this.playWeaponSound('ui_interface', AudioSystem.UI_ORIGIN, { volume: 0.7 });
  }

  public playUIInterface2Sound() {
    return this.playWeaponSound('ui_interface_2', AudioSystem.UI_ORIGIN, { volume: 0.7 });
  }

  public playUIInterface3Sound() {
    return this.playWeaponSound('ui_interface_3', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  public playUIInterface4Sound() {
    return this.playWeaponSound('ui_interface_4', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  /** Co-op boon picker: option card hover. */
  public playBoonHoverSound() {
    return this.playWeaponSound('ui_hover', AudioSystem.UI_ORIGIN, { volume: 0.7 });
  }

  /** Co-op boon picker: successful reroll purchase. */
  public playBoonRerollSound() {
    return this.playWeaponSound('ui_reroll', AudioSystem.UI_ORIGIN, { volume: 0.85 });
  }

  /** Enemy hit grunt — 70% chance, 1s internal cooldown, louder than dash breath clips. */
  public playDamageBreathSound(): void {
    const now = performance.now();
    if (now - this.lastDamageBreathAtMs < 1000) return;
    if (Math.random() >= 0.7) return;
    this.lastDamageBreathAtMs = now;
    this.playWeaponSound('ui_breath_5', AudioSystem.UI_ORIGIN, { volume: AudioSystem.DASH_BREATH_VOLUME });
  }

  /** Local player defeated — short UI sting. */
  public playDefeatSound() {
    return this.playWeaponSound('ui_defeat', AudioSystem.UI_ORIGIN, { volume: 1.0 });
  }

  public playLevelUpSound() {
    return this.playWeaponSound('ui_level', AudioSystem.UI_ORIGIN, { volume: 0.9 });
  }

  public playAegisBlockSound() {
    return this.playWeaponSound('ui_aegis', AudioSystem.UI_ORIGIN, { volume: 1.33 });
  }

  /** Shift-Deflect — first negated hit fires the homing bolt; fired once, not on repeat blocks. */
  public playDeflectBoltSound() {
    return this.playWeaponSound('ui_deflect_bolt', AudioSystem.UI_ORIGIN, { volume: 1.2 });
  }

  /** Gladiator Deflect — played when Shift initiates the block window. */
  public playDeflectCastSound() {
    return this.playWeaponSound('ui_deflect_cast', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  /** Acolyte Locust — one shot per missile released from the shift channel. */
  public playLocustSound() {
    return this.playWeaponSound('ui_locusts', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  /** Acolyte Locust — played when a missile impacts an enemy. */
  public playLocustImpactSound(position: Vector3) {
    return this.playWeaponSound('ui_locust_impact', position, { volume: 0.85 });
  }

  /** Alchemist Prime Materia — played when the aura is toggled on. */
  public playDevouringCircleSound() {
    return this.playWeaponSound('ui_devouring_circle', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  /** Alchemist Prime Materia — played when the aura is toggled off. */
  public playPrimeMateriaSound() {
    return this.playWeaponSound('ui_prime_materia', AudioSystem.UI_ORIGIN, { volume: 1.1 });
  }

  /** Alchemist Prime Materia — played each time an enemy takes aura damage. */
  public playAlchemySound(position: Vector3) {
    return this.playWeaponSound('ui_alchemy', position, { volume: 0.85 });
  }

  /** Sorceress Incineration — charge channel oneshot (stopped early if shift released). */
  public playIncinerateChargeSound(position: Vector3) {
    this.stopIncinerateChargeSound();
    return this.playWeaponSound('incinerate_charge', position, { volume: 0.92 });
  }

  public stopIncinerateChargeSound(): void {
    this.stopSound('incinerate_charge');
  }

  /** Sorceress Incineration — shift released with charge held. */
  public playIncinerateArmedSound(position: Vector3) {
    return this.playWeaponSound('incinerate_armed', position, { volume: 0.95 });
  }

  /** Sorceress Incineration — beam fire oneshot. */
  public playIncinerateFireSound(position: Vector3) {
    return this.playWeaponSound('wraith_buzzsaw', position, { volume: 0.95 });
  }

  public playFrozenStatusSound(position: Vector3) {
    return this.playWeaponSoundWithCooldown('ui_frozen', position, { volume: 0.65 }, AudioSystem.MULTI_TARGET_STATUS_COOLDOWN_MS);
  }

  public playIgniteStatusSound(position: Vector3) {
    return this.playWeaponSoundWithCooldown('ui_ignite', position, { volume: 0.725 }, AudioSystem.MULTI_TARGET_STATUS_COOLDOWN_MS);
  }

  public playEntangleStatusSound(position: Vector3) {
    return this.playWeaponSoundWithCooldown('ui_entangle', position, { volume: 0.675 }, AudioSystem.MULTI_TARGET_STATUS_COOLDOWN_MS);
  }

  public playAcidSound(position: Vector3) {
    return this.playWeaponSoundWithCooldown('ui_acid', position, { volume: 0.75 }, AudioSystem.MULTI_TARGET_STATUS_COOLDOWN_MS);
  }

  public playLesserHealSound(position?: Vector3) {
    return this.playWeaponSound('ui_lesser_heal', position ?? this.listenerPosition, { volume: 0.74 });
  }

  public playGreaterHealSound(position?: Vector3) {
    return this.playWeaponSound('ui_greater_heal', position ?? this.listenerPosition, { volume: 0.82 });
  }

  // Play spear swing sound
  public playSpearSwingSound(position: Vector3) {
    return this.playWeaponSound('spear_swing', position, { volume: 0.8 });
  }

  // Play whirlwind charge sound
  public playWhirlwindChargeSound(position: Vector3) {
    return this.playWeaponSound('whirlwind_charge', position, { volume: 0.9 });
  }

  // Play whirlwind release sound
  public playWhirlwindReleaseSound(position: Vector3) {
    return this.playWeaponSound('whirlwind_release', position, { volume: 0.9 });
  }

  // Play throw spear charge sound
  public playThrowSpearChargeSound(position: Vector3) {
    return this.playWeaponSound('throw_spear_charge', position, { volume: 0.9 });
  }

  // Play throw spear release sound
  public playThrowSpearReleaseSound(position: Vector3) {
    return this.playWeaponSound('throw_spear_release', position, { volume: 0.9 });
  }

  // Play lightning bolt sound
  public playLightningBoltSound(position: Vector3) {
    return this.playWeaponSound('lightning_bolt', position, { volume: 0.9 });
  }

  // Play flurry sound
  public playFlurrySound(position: Vector3) {
    return this.playWeaponSound('flurry', position, { volume: 0.85 });
  }

  // Play icebeam sound (loops while active)
  public playIcebeamSound(position: Vector3) {
    return this.playWeaponSound('icebeam', position, { volume: 0.8, loop: true });
  }

  // Play UI dash sound (when dashing); 70% chance to layer a random breath clip
  public playUIDashSound(): void {
    this.playWeaponSound('ui_dash', AudioSystem.UI_ORIGIN, { volume: 0.8 });

    if (Math.random() < 0.7) {
      const breathId =
        AudioSystem.DASH_BREATH_SOUND_IDS[
          Math.floor(Math.random() * AudioSystem.DASH_BREATH_SOUND_IDS.length)
        ];
      this.playWeaponSound(breathId, AudioSystem.UI_ORIGIN, { volume: AudioSystem.DASH_BREATH_VOLUME });
    }
  }

  /** Co-op combat room entry: random start chime alongside combat BGM. */
  public playCoopRoomEnterStinger(): void {
    const id = Math.random() < 0.5 ? 'ui_room_start_1' : 'ui_room_start_2';
    this.playWeaponSound(id, AudioSystem.UI_ORIGIN, { volume: 0.85 });
  }

  /** Co-op room clear: pedestal / portal unlock. */
  public playCoopRoomClearFinish(): void {
    this.playWeaponSound('ui_room_finish', AudioSystem.UI_ORIGIN, { volume: 0.85 });
  }

  /** Merchant room: greeting when the party arrives. */
  public playMerchantArrivalGreet(): void {
    this.playWeaponSound('merchant_greet_arrival', AudioSystem.UI_ORIGIN, { volume: 0.8 });
  }

  /** Merchant room: thank-you line after a successful purchase (buyer only). */
  public playMerchantPurchaseGreet(): void {
    this.playWeaponSound('merchant_greet_purchase', AudioSystem.UI_ORIGIN, { volume: 0.8 });
  }

  /** Merchant room: farewell when closing the shop UI. */
  public playMerchantExitGreet(): void {
    this.playWeaponSound('merchant_greet_exit', AudioSystem.UI_ORIGIN, { volume: 0.8 });
  }

  /** Co-op combat pedestal: interact before reward reveal. */
  public playPedestalSound(): void {
    this.playWeaponSound('ui_pedestal', AudioSystem.UI_ORIGIN, { volume: 1.2 });
  }

  /** Merchant room: healing purchase. */
  public playFountainSound(): void {
    this.playWeaponSound('ui_fountain', AudioSystem.UI_ORIGIN, { volume: 1.25 });
  }

  /** Void portal: plays once when the maw first opens. */
  public playVoidPortalOpenSound(): void {
    this.playWeaponSound('ui_void', AudioSystem.UI_ORIGIN, { volume: 0.92 });
  }

  /** Co-op colored room: first combat engagement whisper (once per room visit). */
  public playCoopRoomWhisperSound(roomColor: 'red' | 'blue' | 'green' | 'purple'): void {
    const soundId = {
      red: 'whisper_infernal',
      blue: 'whisper_tempest',
      purple: 'whisper_abyssal',
      green: 'whisper_eldritch',
    }[roomColor];
    if (!soundId) return;
    this.playWeaponSound(soundId, AudioSystem.UI_ORIGIN, { volume: 1.6 });
  }

  /** Looped locomotion footsteps (local player run); mirrors Run vs slow-walk in CharacterRenderer. */
  public setFootstepsPlaying(active: boolean, rate = 1): void {
    this.footstepsShouldPlay = active;
    this.footstepsRate = rate;
    const sound = this.soundCache.get('ui_footsteps');
    if (!sound) {
      if (active) {
        const asset = this.sfxById.get('ui_footsteps');
        if (asset) {
          void this.loadSfx(asset).then(loadedSound => {
            if (loadedSound && this.footstepsShouldPlay) {
              this.startFootstepsLoop(loadedSound, this.footstepsRate);
            }
          });
        }
      }
      return;
    }

    if (!active) {
      if (this.footstepsLoopInstance !== null) {
        sound.stop(this.footstepsLoopInstance);
        this.footstepsLoopInstance = null;
      }
      return;
    }

    this.startFootstepsLoop(sound, rate);
  }

  private startFootstepsLoop(sound: Howl, rate: number): void {
    if (this.footstepsLoopInstance !== null) {
      sound.rate(rate, this.footstepsLoopInstance);
      return;
    }
    const vol = 2.0 * this.sfxVolume * this.masterVolume;
    this.footstepsLoopInstance = sound.play();
    if (this.footstepsLoopInstance !== undefined) {
      sound.loop(true, this.footstepsLoopInstance);
      sound.volume(vol, this.footstepsLoopInstance);
      sound.rate(rate, this.footstepsLoopInstance);
    }
  }

  public playShieldBreakSound(): number | null {
    return this.playWeaponSound('ui_shield_break', this.listenerPosition, { volume: 1.0 });
  }

  public setShieldRegenPlaying(active: boolean): void {
    this.shieldRegenShouldPlay = active;
    const sound = this.soundCache.get('ui_shield_regen');
    if (!sound) {
      if (active) {
        const asset = this.sfxById.get('ui_shield_regen');
        if (asset) {
          void this.loadSfx(asset).then(loadedSound => {
            if (loadedSound && this.shieldRegenShouldPlay) {
              this.startShieldRegenLoop(loadedSound);
            }
          });
        }
      }
      return;
    }

    if (!active) {
      if (this.shieldRegenLoopInstance !== null) {
        sound.stop(this.shieldRegenLoopInstance);
        this.shieldRegenLoopInstance = null;
      }
      return;
    }

    this.startShieldRegenLoop(sound);
  }

  private startShieldRegenLoop(sound: Howl): void {
    if (this.shieldRegenLoopInstance !== null) return;
    const vol = 0.85 * this.sfxVolume * this.masterVolume;
    this.shieldRegenLoopInstance = sound.play();
    if (this.shieldRegenLoopInstance !== undefined) {
      sound.loop(true, this.shieldRegenLoopInstance);
      sound.volume(vol, this.shieldRegenLoopInstance);
    }
  }

  private getCurrentWeaponFromControl(): WeaponType | undefined {
    const controlSystemRef = (window as any).controlSystemRef;
    if (controlSystemRef?.current?.getCurrentWeapon) {
      return controlSystemRef.current.getCurrentWeapon();
    }
    return undefined;
  }

  private hitboxSoundIdForWeapon(weapon?: WeaponType): string {
    switch (weapon) {
      case WeaponType.NONE:
        return 'ui_hitbox_sword';
      case WeaponType.BOW:
        return 'ui_hitbox_bow';
      case WeaponType.SABRES:
        return 'ui_hitbox_sabres';
      case WeaponType.SPEAR:
        return 'ui_hitbox_spear';
      case WeaponType.SWORD:
      case WeaponType.RUNEBLADE:
      case WeaponType.KNIGHT:
        return 'ui_hitbox_sword';
      default:
        return 'ui_hitbox_sword';
    }
  }

  private nextScytheHitboxSoundId(): string {
    const soundId = `ui_hitbox_scythe_${this.scytheHitboxVariant}`;
    this.scytheHitboxVariant =
      this.scytheHitboxVariant === 3 ? 1 : ((this.scytheHitboxVariant + 1) as 1 | 2 | 3);
    return soundId;
  }

  // Play enemy-hit confirmation sound (per equipped weapon)
  public playUIHitboxSound(
    weapon?: WeaponType,
    damageDealt?: number,
    hitWorldPosition?: { x: number; y: number; z: number },
  ) {
    const resolved = weapon ?? this.getCurrentWeaponFromControl();
    const soundId =
      resolved === WeaponType.SCYTHE
        ? this.nextScytheHitboxSoundId()
        : this.hitboxSoundIdForWeapon(resolved);
    const isMeleeMultiTarget = soundId === 'ui_hitbox_sabres' || soundId === 'ui_hitbox_sword';
    const playResult = isMeleeMultiTarget
      ? this.playWeaponSoundWithCooldown(soundId, AudioSystem.UI_ORIGIN, { volume: 0.65 }, AudioSystem.MELEE_HITBOX_SOUND_COOLDOWN_MS)
      : this.playWeaponSound(soundId, AudioSystem.UI_ORIGIN, { volume: 0.65 });

    const showStrikeFlash =
      resolved === WeaponType.BOW || resolved === WeaponType.SCYTHE;
    const strikeOk = damageDealt === undefined || damageDealt > 0;
    if (
      showStrikeFlash &&
      strikeOk &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(
        new CustomEvent(EREBUS_STRIKE_INDICATOR_EVENT, {
          detail: {
            variant: 'weapon-hit',
            weapon: resolved,
            ...(hitWorldPosition ? { position: hitWorldPosition } : {}),
          },
        }),
      );
    }

    return playResult;
  }

  private getCoopBgmVolume(): number {
    return 0.666 * this.sfxVolume * this.masterVolume;
  }

  private stopAllCoopRoomTracks(): void {
    for (let n = 1; n <= 7; n++) {
      const id = `coop_room_${n}`;
      const h = this.soundCache.get(id);
      if (h) {
        h.stop();
      }
    }
    for (const id of COOP_NAMED_BGM_CACHE_IDS) {
      const h = this.soundCache.get(id);
      if (h) {
        h.stop();
      }
    }
    this.coopRoomInstance = null;
    this.currentCoopRoomTrackId = null;
  }

  /** Remove all coop room Howls from memory (large files). Call after stop. */
  private unloadCoopRoomHowlsFromCache(): void {
    for (let n = 1; n <= 7; n++) {
      const id = `coop_room_${n}`;
      const h = this.soundCache.get(id);
      if (h) {
        h.stop();
        h.unload();
        this.soundCache.delete(id);
      }
    }
    for (const id of COOP_NAMED_BGM_CACHE_IDS) {
      const h = this.soundCache.get(id);
      if (h) {
        h.stop();
        h.unload();
        this.soundCache.delete(id);
      }
    }
  }

  private unloadCoopChaosFromCache(): void {
    const chaos = this.soundCache.get('coop_chaos');
    if (chaos) {
      chaos.stop();
      chaos.unload();
      this.soundCache.delete('coop_chaos');
    }
  }

  /** No default hub BGM; co-op path never loads `background_music` into the cache. */
  private evictHubMusicFromMemory(): void {
    this.stopBackgroundMusic();
  }

  private stopCoopChaosOnly(): void {
    const chaos = this.soundCache.get('coop_chaos');
    if (chaos && this.coopChaosInstance !== null) {
      chaos.stop(this.coopChaosInstance);
    } else if (chaos) {
      chaos.stop();
    }
    this.coopChaosInstance = null;
  }

  /**
   * Load (if needed) and play a looping co-op BGM track. Race-safe against mode changes.
   */
  private async _loadAndPlayCoopBgm(
    cacheId: string,
    src: string,
    mode: CoopBgmMode,
  ): Promise<void> {
    this.coopBgmMode = mode;
    this.currentCoopRoomTrackId = cacheId;

    if (!this.soundCache.has(cacheId)) {
      const sound = new Howl({
        src: [src],
        volume: this.getCoopBgmVolume(),
        loop: true,
        preload: true,
        html5: LARGE_BGM_HTML5,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          sound.on('load', () => resolve());
          sound.on('loaderror', (_id, err) => reject(new Error(String(err))));
        });
        this.soundCache.set(cacheId, sound);
      } catch (e) {
        console.warn(`Failed to load ${src}:`, e);
        this.coopBgmMode = 'none';
        this.currentCoopRoomTrackId = null;
        return;
      }
    }
    if (this.coopBgmMode !== mode || this.currentCoopRoomTrackId !== cacheId) {
      return;
    }
    const h = this.soundCache.get(cacheId);
    if (!h) return;
    h.volume(this.getCoopBgmVolume());
    this.coopRoomInstance = h.play();
  }

  /**
   * Co-op throne prep at run start: loop throne.MP3. Idempotent if already playing.
   */
  public async coopEnterThronePrepMusic(): Promise<void> {
    if (
      this.coopBgmMode === 'hub' &&
      this.currentCoopRoomTrackId === 'coop_bgm_throne' &&
      this.coopRoomInstance !== null
    ) {
      return;
    }
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.evictHubMusicFromMemory();
    await this._loadAndPlayCoopBgm(
      'coop_bgm_throne',
      '/audio/sfx/ui/tracks/throne.MP3',
      'hub',
    );
  }

  /**
   * Co-op throne prep (no intro pending): silence. Idempotent; stops room + chaos.
   */
  public coopEnterHubMusic(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.evictHubMusicFromMemory();
    this.coopBgmMode = 'hub';
  }

  /**
   * Co-op wave clear / intermission: cut combat music, loop chaos. Idempotent.
   */
  public coopEnterChaosIntermissionMusic(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.evictHubMusicFromMemory();
    if (this.coopBgmMode === 'chaos' && this.coopChaosInstance !== null) {
      return;
    }
    this.coopBgmMode = 'chaos';
    void this._ensureChaosAndPlay();
  }

  private async _ensureChaosAndPlay(): Promise<void> {
    if (!this.soundCache.has('coop_chaos')) {
      const sound = new Howl({
        src: ['/audio/sfx/ui/chaosLoop.mp3'],
        volume: this.getCoopBgmVolume(),
        loop: true,
        preload: true,
        html5: LARGE_BGM_HTML5,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          sound.on('load', () => resolve());
          sound.on('loaderror', (_id, err) => reject(new Error(String(err))));
        });
        this.soundCache.set('coop_chaos', sound);
      } catch (e) {
        console.warn('Failed to load chaosLoop:', e);
        this.coopBgmMode = 'none';
        return;
      }
    }
    if (this.coopBgmMode !== 'chaos') {
      return;
    }
    const chaos = this.soundCache.get('coop_chaos');
    if (!chaos) return;
    chaos.volume(this.getCoopBgmVolume());
    this.coopChaosInstance = chaos.play();
  }

  /**
   * Co-op combat room: room-specific track when mapped, else random track1–7.
   */
  public async coopEnterCombatRoomMusic(
    roomKind: string | null,
    opts: { bossThroneArena?: boolean } = {},
  ): Promise<void> {
    const resolved = resolveCoopCombatBgm(roomKind, {
      bossThroneArena: !!opts.bossThroneArena,
    });
    if (resolved === 'random') {
      await this.coopEnterRandomCombatRoomMusic();
      return;
    }

    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.evictHubMusicFromMemory();
    this.playCoopRoomEnterStinger();
    await this._loadAndPlayCoopBgm(resolved.cacheId, resolved.src, 'combat');
  }

  /**
   * Co-op combat room: random track1–7, loop. Stops hub + chaos.
   */
  public async coopEnterRandomCombatRoomMusic(): Promise<void> {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.evictHubMusicFromMemory();
    this.playCoopRoomEnterStinger();

    const n = Math.floor(Math.random() * 7) + 1;
    const id = `coop_room_${n}`;
    await this._loadAndPlayCoopBgm(id, `/audio/sfx/ui/track${n}.mp3`, 'combat');
  }

  /** Stop combat-only and chaos. Call when leaving co-op for other modes. */
  public coopSyncNonCoopMode(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.evictHubMusicFromMemory();
    this.coopBgmMode = 'none';
  }

  /** @deprecated No default BGM. */
  public startBackgroundMusic() {}

  public stopBackgroundMusic() {
    const bgMusic = this.soundCache.get('background_music');
    if (bgMusic) {
      bgMusic.stop();
      bgMusic.unload();
      this.soundCache.delete('background_music');
    }
  }

  // Clean up resources
  public dispose() {
    this.setFootstepsPlaying(false);
    this.setJudgmentCorruptionPlaying(false);
    this.stopAllCoopRoomTracks();
    this.stopCoopChaosOnly();
    this.coopBgmMode = 'none';
    // Stop and clean up background music
    this.stopBackgroundMusic();

    // Clean up sound cache
    this.soundCache.forEach(sound => {
      sound.unload();
    });
    this.soundCache.clear();
  }

  // ECS System update method
  public update(entities: any[], deltaTime: number): void {
    // Audio system doesn't need to update entities directly
    // Could be used for spatial audio updates if needed
  }
}
