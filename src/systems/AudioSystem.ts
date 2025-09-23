// Audio System for managing game sound effects and music
import { Howl, Howler } from 'howler';
import { System } from '@/ecs/System';
import { World } from '@/ecs/World';
import { Vector3 } from 'three';
import { Transform } from '@/ecs/components/Transform';

export interface SoundConfig {
  volume?: number;
  loop?: boolean;
  rate?: number;
}

export class AudioSystem extends System {
  public readonly requiredComponents = []; // Audio system doesn't require specific components

  private soundCache = new Map<string, Howl>();
  private masterVolume = 0.7;
  private sfxVolume = 0.8;
  private listenerPosition = new Vector3(0, 0, 0);

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

  // Preload weapon sound effects
  public async preloadWeaponSounds() {
    const weaponSounds = [
      { id: 'bow_draw', file: 'bow/draw.mp3' },
      { id: 'bow_release', file: 'bow/release.mp3' },
      { id: 'sabres_swing', file: 'sabres/sabres_swing.mp3' },
      { id: 'entropic_bolt', file: 'scythe/entropic_bolts.mp3' },
      { id: 'crossentropy', file: 'scythe/crossentropy.mp3' },
      { id: 'sword_swing_1', file: 'sword/swing_1.mp3' },
      { id: 'sword_swing_2', file: 'sword/swing_2.mp3' },
      { id: 'sword_swing_3', file: 'sword/swing_3.mp3' },
      { id: 'windshear', file: 'sword/windshear.mp3' }
    ];

    const loadPromises = weaponSounds.map(async ({ id, file }) => {
      try {
        const sound = new Howl({
          src: [`/audio/sfx/${file}`],
          volume: this.sfxVolume * this.masterVolume,
          preload: true,
          html5: false // Use Web Audio API for better performance
        });

        // Wait for sound to load
        await new Promise<void>((resolve, reject) => {
          sound.on('load', () => resolve());
          sound.on('loaderror', (soundId, error) => reject(new Error(`Failed to load ${file}: ${error}`)));
        });

        this.soundCache.set(id, sound);
        console.log(`✅ Loaded sound: ${id}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load sound ${id}:`, error);
        // Continue with other sounds instead of failing completely
      }
    });

    await Promise.all(loadPromises);
    console.log('🎵 Weapon sound preloading complete');
  }

  // Play weapon sound effect (local only)
  public playWeaponSound(soundId: string, position: Vector3, config?: SoundConfig) {
    const sound = this.soundCache.get(soundId);
    if (!sound) {
      // Silently fail for missing sounds to avoid console spam
      return null;
    }

    const soundInstance = sound.play();

    // Apply 3D positioning if position provided
    if (position) {
      sound.pos(position.x, position.y, position.z, soundInstance);
    }

    // Apply custom config
    if (config) {
      if (config.volume !== undefined) {
        sound.volume(config.volume * this.sfxVolume * this.masterVolume, soundInstance);
      }
      if (config.rate !== undefined) {
        sound.rate(config.rate, soundInstance);
      }
    }

    return soundInstance;
  }

  // Play bow draw sound (called when charging starts)
  public playBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.6 });
  }

  // Play bow release sound (called when arrow is fired)
  public playBowReleaseSound(position: Vector3, chargeProgress?: number) {
    // Adjust volume/pitch based on charge level
    const volume = 0.7 + (chargeProgress || 0) * 0.3; // 0.7 to 1.0
    const rate = 0.9 + (chargeProgress || 0) * 0.2; // 0.9 to 1.1

    return this.playWeaponSound('bow_release', position, {
      volume,
      rate
    });
  }

  // Play sabres swing sound
  public playSabresSwingSound(position: Vector3) {
    return this.playWeaponSound('sabres_swing', position, { volume: 0.8 });
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

  // Play windshear sound
  public playWindshearSound(position: Vector3) {
    return this.playWeaponSound('windshear', position, { volume: 0.9 });
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

  // Clean up resources
  public dispose() {
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
