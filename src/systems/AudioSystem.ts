// Audio System for managing game sound effects and music
import { Howl, Howler } from 'howler';
import { System } from '@/ecs/System';
import { Vector3 } from 'three';
import { WeaponType } from '@/components/dragon/weapons';
import { EREBUS_STRIKE_INDICATOR_EVENT } from '@/utils/strikeIndicatorEvent';

export interface SoundConfig {
  volume?: number;
  loop?: boolean;
  rate?: number;
}

type CoopBgmMode = 'hub' | 'combat' | 'chaos' | 'none';

/** Large music files: HTML5 Audio streams instead of full Web Audio decode (lower memory). */
const LARGE_BGM_HTML5 = true;

type SfxAsset = { id: string; file: string; html5?: boolean };

const WEAPON_SOUND_ASSETS: SfxAsset[] = [
  { id: 'bow_draw', file: 'bow/draw.mp3' },
  { id: 'bow_release', file: 'bow/release.mp3' },
  { id: 'bow_power_release', file: 'bow/powerRelease.mp3' },
  { id: 'bow_viper_sting_release', file: 'bow/viper_sting_release.mp3' },
  { id: 'bow_barrage_release', file: 'bow/barrage_release.mp3' },
  { id: 'bow_cobra_shot_release', file: 'bow/cobra_shot_release.mp3' },
  { id: 'sabres_swing', file: 'sabres/sabres_swing.mp3' },
  { id: 'sabres_backstab', file: 'sabres/backstab.mp3' },
  { id: 'sabres_flourish', file: 'sabres/flourish.mp3' },
  { id: 'sabres_shadow_step', file: 'sabres/shadow_step.mp3' },
  { id: 'sabres_skyfall', file: 'sabres/skyfall.mp3' },
  { id: 'entropic_bolt', file: 'scythe/entropic_bolts.mp3' },
  { id: 'crossentropy', file: 'scythe/crossentropy.mp3' },
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
  { id: 'boss1_music', file: 'versus/boss1.mp3', html5: LARGE_BGM_HTML5 },
  { id: 'boss1_quake', file: 'versus/boss1quake.mp3' },
  { id: 'enemy_blink', file: 'versus/blink.mp3' },
  { id: 'enemy_death', file: 'versus/deathSFX.mp3' },
  { id: 'enemy_death_ghoul', file: 'versus/ghoulDeathSFX.mp3' },
  { id: 'enemy_death_warlock', file: 'versus/warlockdeath.mp3' },
  { id: 'enemy_death_shade', file: 'versus/shadedeath.mp3' },
  { id: 'enemy_death_viper', file: 'versus/viperdeath.mp3' },
  { id: 'enemy_death_templar', file: 'versus/templardeath.mp3' },
  { id: 'enemy_death_martyr', file: 'versus/martyrdeath.mp3' },
  { id: 'enemy_death_tentacle_spine', file: 'versus/spinedeath.mp3' },
  { id: 'enemy_knight_smite', file: 'versus/smite.mp3' },
  { id: 'enemy_templar_smite', file: 'sword/smite.mp3' },
  { id: 'weaver_ghoul_summon', file: 'versus/summon.mp3' },
  { id: 'enemy_spawn_summon', file: 'ui/summon.mp3' },
  { id: 'shade_throw', file: 'versus/shadeThrow.mp3' },
  { id: 'shade_damage_1', file: 'versus/shadeDamage1.mp3' },
  { id: 'shade_damage_2', file: 'versus/shadeDamage2.mp3' },
  { id: 'shade_damage_3', file: 'versus/shadeDamage3.mp3' },
  { id: 'warlock_immolate', file: 'versus/immolate.mp3' },
  { id: 'warlock_voidbolt', file: 'versus/voidbolt.mp3' },
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
  { id: 'ui_dash', file: 'ui/dash.mp3' },
  { id: 'ui_hitbox_bow', file: 'ui/bowHitbox.mp3' },
  { id: 'ui_hitbox_sabres', file: 'ui/sabresHitbox.mp3' },
  { id: 'ui_hitbox_scythe', file: 'ui/scytheHitbox.mp3' },
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
  { id: 'ui_lesser_heal', file: 'ui/lesserHeal.mp3' },
  { id: 'ui_greater_heal', file: 'ui/greaterHeal.mp3' },
  { id: 'ui_level', file: 'ui/1LEVEL.mp3' },
];

const STARTUP_SOUND_IDS = new Set([
  'ui_selection',
  'ui_interface',
  'ui_dash',
  'ui_room_start_1',
  'ui_room_start_2',
]);

const LAZY_LARGE_SFX_IDS = new Set([
  'boss1_music',
]);

const GAMEPLAY_PRELOAD_ASSETS = WEAPON_SOUND_ASSETS.filter(
  asset => !LAZY_LARGE_SFX_IDS.has(asset.id),
);

export class AudioSystem extends System {
  public readonly requiredComponents = []; // Audio system doesn't require specific components

  private soundCache = new Map<string, Howl>();
  private soundLoadPromises = new Map<string, Promise<Howl | null>>();
  private weaponPreloadPromise: Promise<void> | null = null;
  private startupPreloadPromise: Promise<void> | null = null;
  private readonly sfxById = new Map(WEAPON_SOUND_ASSETS.map(asset => [asset.id, asset]));
  private masterVolume = 0.7;
  private sfxVolume = 0.75;
  private listenerPosition = new Vector3(0, 0, 0);
  private coopBgmMode: CoopBgmMode = 'none';
  private coopChaosInstance: number | null = null;
  private coopRoomInstance: number | null = null;
  private coopBoss1Instance: number | null = null;
  private currentCoopRoomTrackId: string | null = null;
  private footstepsLoopInstance: number | null = null;
  private footstepsShouldPlay = false;

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

  // Preload gameplay SFX. Keeps large / on-demand music out of the loading screen.
  public preloadWeaponSounds(): Promise<void> {
    if (!this.weaponPreloadPromise) {
      this.weaponPreloadPromise = this.preloadSfxAssets(GAMEPLAY_PRELOAD_ASSETS);
    }
    return this.weaponPreloadPromise;
  }

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public async preloadBackgroundMusic(): Promise<void> {
    return Promise.resolve();
  }

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public startBackgroundMusicStreaming(): void {}

  /** @deprecated No default hub BGM; kept for call-site compatibility. */
  public stopBackgroundMusicStreaming(): void {}

  // Play weapon sound effect (local only)
  public playWeaponSound(soundId: string, position: Vector3, config?: SoundConfig) {
    const sound = this.soundCache.get(soundId);
    if (!sound) {
      const asset = this.sfxById.get(soundId);
      if (asset) {
        void this.loadSfx(asset);
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
  public playBowReleaseSound(position: Vector3, chargeProgress?: number, isPerfectShot?: boolean) {
    // Adjust volume/pitch based on charge level
    const volume = 0.7 + (chargeProgress || 0) * 0.3; // 0.7 to 1.0
    const rate = 0.9 + (chargeProgress || 0) * 0.2; // 0.9 to 1.1
    const soundId = isPerfectShot === true ? 'bow_power_release' : 'bow_release';

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
    return this.playWeaponSound('sabres_swing', position, { volume: 0.8 });
  }

  // Play sabres flourish sound (Sunder ability)
  public playSabresFlourishSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish', position, { volume: 0.9 });
  }

  // Play sabres shadow step sound (Stealth ability)
  public playSabresShadowStepSound(position: Vector3) {
    return this.playWeaponSound('sabres_shadow_step', position, { volume: 0.8 });
  }

  // Play sabres skyfall sound
  public playSabresSkyfallSound(position: Vector3) {
    return this.playWeaponSound('sabres_skyfall', position, { volume: 1.0 });
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

  /** Remote player Runeblade LMB — same asset as `playRunebladeSwingHitSound` at enemy volume. */
  public playEnemyRunebladeSwingHitSound(position: Vector3) {
    return this.playWeaponSound('runeblade_swing_hit', position, { volume: 0.2 }); // 0.8 * 0.25
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
      } else {
        sound.stop();
      }
    }
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

  /** Runeblade LMB connect — non-crit; crits use `playSwordSwingSound` (sword_swing_1–3). */
  public playRunebladeSwingHitSound(position: Vector3) {
    return this.playWeaponSound('runeblade_swing_hit', position, { volume: 0.8 });
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

  public playEnemyKnightSmiteSound(position: Vector3) {
    return this.playWeaponSound('enemy_knight_smite', position, { volume: 0.85 });
  }

  public playEnemyTemplarSmiteSound(position: Vector3) {
    return this.playWeaponSound('enemy_templar_smite', position, { volume: 0.85 });
  }

  public playWeaverGhoulSummonSound(position: Vector3) {
    return this.playWeaponSound('weaver_ghoul_summon', position, { volume: 0.85 });
  }

  // Play the flame-summon spawn cue when an enemy emerges into an enemy room.
  public playEnemySummonSpawnSound(position: Vector3) {
    return this.playWeaponSound('enemy_spawn_summon', position, { volume: 0.7 });
  }

  // Play enemy blink sound (Shade and Warlock teleport)
  public playEnemyBlinkSound(position: Vector3) {
    return this.playWeaponSound('enemy_blink', position, { volume: 0.9 });
  }

  // Play enemy death sound — accepts a plain object so callers outside Three.js contexts
  // don't need to import Vector3. `deathSFX.mp3` is reserved for knight / weaver only.
  public playEnemyDeathSound(position: { x: number; y: number; z: number }, enemyType?: string) {
    const soundId = this.resolveEnemyDeathSoundId(enemyType);
    return this.playWeaponSound(soundId, new Vector3(position.x, position.y, position.z), { volume: 0.95 });
  }

  private resolveEnemyDeathSoundId(enemyType?: string): string {
    if (enemyType === undefined) {
      return 'enemy_death';
    }
    switch (enemyType) {
      case 'knight':
      case 'weaver':
        return 'enemy_death';
      case 'ghoul':
      case 'boss-skeleton':
      case 'player-zombie':
        return 'enemy_death_ghoul';
      case 'martyr':
        return 'enemy_death_martyr';
      case 'warlock':
        return 'enemy_death_warlock';
      case 'shade':
        return 'enemy_death_shade';
      case 'viper':
        return 'enemy_death_viper';
      case 'templar':
      case 'boss':
        return 'enemy_death_templar';
      case 'tentacle-spine':
        return 'enemy_death_tentacle_spine';
      default:
        return 'enemy_death_templar';
    }
  }

  // Play Shade dart throw sound (one call per dart, staggered by the caller)
  public playShadeThrowSound(position: Vector3) {
    return this.playWeaponSound('shade_throw', position, { volume: 0.85 });
  }

  // Play Shade dart hit-damage sound (variant matches which dart hit: 1, 2, or 3)
  public playShadeDamageSound(position: Vector3, variant: 1 | 2 | 3) {
    return this.playWeaponSound(`shade_damage_${variant}`, position, { volume: 0.9 });
  }

  // Play Viper enemy bow draw sound (when the Viper starts drawing its bow)
  public playViperBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.55 });
  }

  // Play Viper enemy bow release sound (when the Viper fires its arrow)
  public playViperBowReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_release', position, { volume: 0.6 });
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
    return this.playWeaponSound('knight_aggro', position, { volume: 0.9 });
  }

  public playBossTectonicQuakeWarnSound(position: Vector3) {
    return this.playWeaponSound('boss1_quake', position, { volume: 0.95 });
  }

  // Play Warlock flame-strike (immolate) sound — fires when the pillars erupt
  public playWarlockImmolateSound(position: Vector3) {
    return this.playWeaponSound('warlock_immolate', position, { volume: 0.9 });
  }

  // Play Warlock void-bolt hit sound — fires when the chaos orb hits the player
  public playWarlockVoidboltSound(position: Vector3) {
    return this.playWeaponSound('warlock_voidbolt', position, { volume: 0.9 });
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
    return this.playWeaponSound('scythe_cryoflame', position, { volume: 0.8 });
  }

  public playMeteorIndicatorSound(position: Vector3) {
    return this.playWeaponSound('scythe_meteor', position, { volume: 0.9 });
  }

  public playCrossentropyMeteoriteFallSound(position: Vector3) {
    setTimeout(() => {
      this.playWeaponSound('scythe_meteorite', position, { volume: 0.9 });
    }, 500);
  }

  public playTotemBoltLaunchSound(position: Vector3) {
    return this.playWeaponSound('scythe_totem_bolt', position, { volume: 0.72 });
  }

  public playTotemSuperconductorSound(position: Vector3) {
    return this.playWeaponSound('scythe_superconductor', position, { volume: 0.78 });
  }

  // Play Aftershock eruption sound when the delayed ground strip detonates
  public playAftershockSound(position: Vector3) {
    return this.playWeaponSound('aftershock', position, { volume: 0.95 });
  }

  // Play UI selection sound
  public playUISelectionSound() {
    return this.playWeaponSound('ui_selection', new Vector3(0, 0, 0), { volume: 0.7 });
  }

  public playUIGoldPickupSound() {
    return this.playWeaponSound('ui_gold_pickup', new Vector3(0, 0, 0), { volume: 0.72 });
  }

  public playUITomePickupSound() {
    return this.playWeaponSound('ui_tome_pickup', new Vector3(0, 0, 0), { volume: 0.72 });
  }

  // Play UI interface sound (for navigation buttons)
  public playUIInterfaceSound() {
    return this.playWeaponSound('ui_interface', new Vector3(0, 0, 0), { volume: 0.7 });
  }

  /** Local player defeated — short UI sting. */
  public playDefeatSound() {
    return this.playWeaponSound('ui_defeat', new Vector3(0, 0, 0), { volume: 0.85 });
  }

  public playLevelUpSound() {
    return this.playWeaponSound('ui_level', new Vector3(0, 0, 0), { volume: 0.9 });
  }

  public playFrozenStatusSound(position: Vector3) {
    return this.playWeaponSound('ui_frozen', position, { volume: 0.78 });
  }

  public playIgniteStatusSound(position: Vector3) {
    return this.playWeaponSound('ui_ignite', position, { volume: 0.58 });
  }

  public playEntangleStatusSound(position: Vector3) {
    return this.playWeaponSound('ui_entangle', position, { volume: 0.62 });
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
    return this.playWeaponSound('flurry', position, { volume: 0.9 });
  }

  // Play icebeam sound (loops while active)
  public playIcebeamSound(position: Vector3) {
    return this.playWeaponSound('icebeam', position, { volume: 0.8, loop: true });
  }

  // Play UI dash sound (when dashing)
  public playUIDashSound() {
    return this.playWeaponSound('ui_dash', new Vector3(0, 0, 0), { volume: 0.8 });
  }

  /** Co-op combat room entry: random start chime alongside combat BGM. */
  public playCoopRoomEnterStinger(): void {
    const id = Math.random() < 0.5 ? 'ui_room_start_1' : 'ui_room_start_2';
    this.playWeaponSound(id, new Vector3(0, 0, 0), { volume: 0.85 });
  }

  /** Co-op room clear: pedestal / portal unlock. */
  public playCoopRoomClearFinish(): void {
    this.playWeaponSound('ui_room_finish', new Vector3(0, 0, 0), { volume: 0.85 });
  }

  /** Looped locomotion footsteps (local player run); mirrors Run vs slow-walk in CharacterRenderer. */
  public setFootstepsPlaying(active: boolean): void {
    this.footstepsShouldPlay = active;
    const sound = this.soundCache.get('ui_footsteps');
    if (!sound) {
      if (active) {
        const asset = this.sfxById.get('ui_footsteps');
        if (asset) {
          void this.loadSfx(asset).then(loadedSound => {
            if (loadedSound && this.footstepsShouldPlay) {
              this.startFootstepsLoop(loadedSound);
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

    this.startFootstepsLoop(sound);
  }

  private startFootstepsLoop(sound: Howl): void {
    if (this.footstepsLoopInstance !== null) return;
    const vol = 2.0 * this.sfxVolume * this.masterVolume;
    this.footstepsLoopInstance = sound.play();
    if (this.footstepsLoopInstance !== undefined) {
      sound.loop(true, this.footstepsLoopInstance);
      sound.volume(vol, this.footstepsLoopInstance);
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
      case WeaponType.SCYTHE:
        return 'ui_hitbox_scythe';
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

  // Play enemy-hit confirmation sound (per equipped weapon)
  public playUIHitboxSound(
    weapon?: WeaponType,
    damageDealt?: number,
    hitWorldPosition?: { x: number; y: number; z: number },
  ) {
    const resolved = weapon ?? this.getCurrentWeaponFromControl();
    const soundId = this.hitboxSoundIdForWeapon(resolved);
    const playResult = this.playWeaponSound(soundId, new Vector3(0, 0, 0), { volume: 0.65 });

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
            weapon: resolved,
            ...(hitWorldPosition ? { position: hitWorldPosition } : {}),
          },
        }),
      );
    }

    return playResult;
  }

  private getCoopBgmVolume(): number {
    return 0.5 * this.sfxVolume * this.masterVolume;
  }

  private stopAllCoopRoomTracks(): void {
    for (let n = 1; n <= 7; n++) {
      const id = `coop_room_${n}`;
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
  }

  private unloadCoopChaosFromCache(): void {
    const chaos = this.soundCache.get('coop_chaos');
    if (chaos) {
      chaos.stop();
      chaos.unload();
      this.soundCache.delete('coop_chaos');
    }
  }

  private stopCoopBoss1Only(): void {
    const boss = this.soundCache.get('coop_boss1');
    if (boss && this.coopBoss1Instance !== null) {
      boss.stop(this.coopBoss1Instance);
    } else if (boss) {
      boss.stop();
    }
    this.coopBoss1Instance = null;
  }

  private unloadCoopBoss1FromCache(): void {
    const boss = this.soundCache.get('coop_boss1');
    if (boss) {
      boss.stop();
      boss.unload();
      this.soundCache.delete('coop_boss1');
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
   * Co-op throne prep: no BGM. Idempotent; stops room + chaos.
   */
  public coopEnterHubMusic(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.stopCoopBoss1Only();
    this.unloadCoopBoss1FromCache();
    this.evictHubMusicFromMemory();
    this.coopBgmMode = 'hub';
  }

  /**
   * Co-op wave clear / intermission: cut combat music, loop chaos. Idempotent.
   */
  public coopEnterChaosIntermissionMusic(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopBoss1Only();
    this.unloadCoopBoss1FromCache();
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
   * Co-op combat room: random track1–7, loop. Stops hub + chaos.
   */
  public async coopEnterRandomCombatRoomMusic(): Promise<void> {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.stopCoopBoss1Only();
    this.unloadCoopBoss1FromCache();
    this.evictHubMusicFromMemory();
    this.playCoopRoomEnterStinger();

    const n = Math.floor(Math.random() * 7) + 1;
    const id = `coop_room_${n}`;
    this.coopBgmMode = 'combat';
    this.currentCoopRoomTrackId = id;

    if (!this.soundCache.has(id)) {
      const path = `/audio/sfx/ui/track${n}.mp3`;
      const sound = new Howl({
        src: [path],
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
        this.soundCache.set(id, sound);
      } catch (e) {
        console.warn(`Failed to load ${path}:`, e);
        this.coopBgmMode = 'none';
        this.currentCoopRoomTrackId = null;
        return;
      }
    }
    if (this.coopBgmMode !== 'combat' || this.currentCoopRoomTrackId !== id) {
      return;
    }
    const h = this.soundCache.get(id);
    if (!h) return;
    h.volume(this.getCoopBgmVolume());
    this.coopRoomInstance = h.play();
  }

  public async coopBoss1FightMusicStart(): Promise<void> {
    if (this.coopBoss1Instance !== null) {
      return;
    }

    if (!this.soundCache.has('coop_boss1')) {
      const sound = new Howl({
        src: ['/audio/sfx/versus/boss1.mp3'],
        volume: this.getCoopBgmVolume() * 0.72,
        loop: true,
        preload: true,
        html5: LARGE_BGM_HTML5,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          sound.on('load', () => resolve());
          sound.on('loaderror', (_id, err) => reject(new Error(String(err))));
        });
        this.soundCache.set('coop_boss1', sound);
      } catch (e) {
        console.warn('Failed to load boss1.mp3:', e);
        return;
      }
    }

    const boss = this.soundCache.get('coop_boss1');
    if (!boss || this.coopBoss1Instance !== null) return;
    boss.volume(this.getCoopBgmVolume() * 0.72);
    this.coopBoss1Instance = boss.play();
  }

  public coopBoss1FightMusicStop(): void {
    this.stopCoopBoss1Only();
    this.unloadCoopBoss1FromCache();
  }

  /** Stop combat-only and chaos. Call when leaving co-op for other modes. */
  public coopSyncNonCoopMode(): void {
    this.stopAllCoopRoomTracks();
    this.unloadCoopRoomHowlsFromCache();
    this.stopCoopChaosOnly();
    this.unloadCoopChaosFromCache();
    this.stopCoopBoss1Only();
    this.unloadCoopBoss1FromCache();
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
    this.stopAllCoopRoomTracks();
    this.stopCoopChaosOnly();
    this.stopCoopBoss1Only();
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
