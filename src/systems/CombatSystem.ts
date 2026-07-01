// Combat system for handling damage, healing, and combat mechanics
import { Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';
import { Movement } from '@/ecs/components/Movement';
import { World } from '@/ecs/World';
import { calculateDamage, DamageResult, getGlobalRuneCounts, getGlobalStrengthStatPoints, type DamageCalcOptions } from '@/core/DamageCalculator';
import {
  DUAL_COIL_DAMAGE_NUMBER_LATERAL_OFFSET,
  getDualCoilLateralVector,
  INFERNAL_SMITE_CRIT_CHANCE_ADD,
  INFESTED_COMBO_LIFESTEAL,
  INFESTED_ENTROPIC_BEAM_KILL_HEAL,
  CROSSENTROPY_REAPER_HIT_HEAL,
  WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD,
  WRATHFUL_ENTROPIC_BEAM_CRIT_CHANCE_ADD,
  WRATHFUL_SABRES_SWIPES_CRIT_CHANCE_ADD,
  WRATHFUL_SABRES_SWIPES_CRIT_DAMAGE_MULT_ADD,
  CHILL_SLOW_PER_STACK,
  ARCTIC_CHILL_FREEZE_DURATION_SEC,
  BLIZZARD_FREEZE_DURATION_SEC,
  ENTANGLEMENT_DURATION_MS,
} from '@/utils/talents';
import { DamageNumberManager } from '@/utils/DamageNumberManager';
import { ImpactEffectManager } from '@/utils/ImpactEffectManager';
import type { ImpactEffectEvent } from '@/utils/ImpactEffectManager';
import { Projectile } from '@/ecs/components/Projectile';
import { Pillar } from '@/ecs/components/Pillar';
import { DestructibleMushroom } from '@/ecs/components/DestructibleMushroom';
import { WeaponType } from '@/components/dragon/weapons';
import { addGlobalEntangledEnemy } from '@/components/weapons/EntangleManager';

interface DamageEvent {
  target: Entity;
  damage: number;
  source?: Entity;
  damageType?: string;
  timestamp: number;
  sourcePlayerId?: string; // Player ID of the source for proper experience attribution
  isCritical?: boolean; // Whether this damage was a critical hit
  /** Co-op routing: Infested Strike talent — only with damageType `wraith_strike`. */
  infestedStrike?: boolean;
  /** Co-op routing: Staggering Strike talent — only with damageType `wraith_strike`. */
  staggerToAdd?: number;
  /** Co-op routing: Infested Smite talent — only with damageType `smite`. */
  infestedSmite?: boolean;
  /** Co-op routing: Infernal Smite talent — Ignite DoT scheduling on server, with damageType `smite`. */
  infernalSmite?: boolean;
  /** Co-op routing: INFERNO talent — with damageType `crossentropy`. */
  crossentropyInferno?: boolean;
  /** Co-op routing: Reaper talent — with damageType `crossentropy` (pierce + kill stack on server). */
  reaperCrossentropy?: boolean;
  /** Co-op routing: PLAGUE Crossentropy — venom FX + zombies on kill (server). */
  crossentropyPlague?: boolean;
  /** Co-op routing: METEOR Crossentropy — server schedules meteor proc + AoE impact. */
  crossentropyMeteor?: boolean;
  /** Co-op routing: Infested Combo talent — with damageType `sword` / routed as `runeblade_combo`. */
  infestedCombo?: boolean;
  /** Wyvern Bite — Barrage hit applies Concentrated Venom stack (co-op: server; local: ECS). */
  wyvernBiteConcentratedVenom?: boolean;
  /** Glacial Bite — Barrage hit applies Blizzard-style chill (5 stacks → 6s freeze locally; server mirrors). */
  glacialBiteChill?: boolean;
  /** Entanglement — Barrage hit roots and squeezes the target. */
  entanglementBarrage?: boolean;
  /** Co-op: Cobra venom DoT tick — Wyvern Sting talent may raise zombie on kill. */
  wyvernStingVenomZombie?: boolean;
  /** Co-op: Reaping Talons / Wyvern Talons detonation — may raise zombie on kill. */
  wyvernTalonsZombie?: boolean;
  /** Co-op: Concentrated Venom DoT tick — eligible for zombie on kill (Wyvern Bite). */
  wyvernBiteConcentratedDoT?: boolean;
  /** Scythe Wrathful Entropic bolt — additive crit chance in calculateDamage. */
  entropicWrathful?: boolean;
  /** Scythe Infesting Entropic bolt — coop zombie on kill routing. */
  entropicInfesting?: boolean;
  /** Scythe Wrathful Entropic beam (Icebeam) — additive crit per tick. */
  icebeamWrathful?: boolean;
  /** Scythe Infesting Entropic beam — coop zombie + heal on kill routing. */
  icebeamInfested?: boolean;
  /** Sabres LMB — Wrathful Sabres Swipes talent crit modifiers. */
  sabreWrathfulSwipes?: boolean;
  /** Sabres LMB — Infesting Sabres Swipes talent (zombie routing on kill). */
  sabreInfestingSwipes?: boolean;
  /** Sabres Backstab — Infested Backstab talent (zombie routing on kill). */
  infestedBackstab?: boolean;
  /** Sabres Flourish — Infested Flourish talent (zombie routing on kill). */
  infestedFlourish?: boolean;
  /** Sabres Killstreak — co-op stack routing on Backstab kill. */
  killstreakBackstab?: boolean;
  /** Sabres Relentless — co-op heal + cooldown RPC on Backstab kill. */
  relentlessBackstab?: boolean;
  /** Arctic / Glacial concentrated blizzard ticks — 4s freeze at 5 chill stacks. */
  blizzardArctic?: boolean;
  /** Frost totem hit — server chill stack + double damage vs frozen. */
  frostTotemChill?: boolean;
  /** Glacial Talons — Reaping Talons vs frozen (server doubles damage). */
  glacialTalons?: boolean;
  /** Cloudkill — bow LMB primary hit requests server-side poison arrow volley. */
  cloudkillProc?: boolean;
  /** Cloudkill arrow impact — prevents recursive proc. */
  cloudkillDamage?: boolean;
  /** Tempest Rounds burst — Arctic Sting chill on hit. */
  tempestBurstArcticChill?: boolean;
  /** Tempest Rounds burst — Wyvern Sting zombie on kill. */
  tempestBurstWyvernZombie?: boolean;
}

interface HealEvent {
  target: Entity;
  amount: number;
  source?: Entity;
  timestamp: number;
}

export class CombatSystem extends System {
  public readonly requiredComponents = [Health];
  private world: World;
  private damageQueue: DamageEvent[] = [];
  private healQueue: HealEvent[] = [];
  private deadEntities: Entity[] = [];
  private damageNumberManager: DamageNumberManager;
  private impactEffectManager = new ImpactEffectManager();
  
  // Combat statistics
  private totalDamageDealt = 0;
  private totalHealingDone = 0;
  private enemiesKilled = 0;

  // Multiplayer damage callback for routing enemy damage to server
  private onEnemyDamageCallback?: (
    enemyId: string,
    damage: number,
    sourcePlayerId?: string,
    meta?: {
      damageType?: string;
      infestedStrike?: boolean;
      infestedSmite?: boolean;
      infernalSmite?: boolean;
      infernoCrossentropy?: boolean;
      reaperCrossentropy?: boolean;
      crossentropyPlague?: boolean;
      crossentropyMeteor?: boolean;
      staggerToAdd?: number;
      infestedCombo?: boolean;
      wyvernBiteVenom?: boolean;
      wyvernStingVenomZombie?: boolean;
      wyvernTalonsZombie?: boolean;
      wyvernBiteConcentratedDoT?: boolean;
      entropicWrathful?: boolean;
      entropicInfesting?: boolean;
      icebeamWrathful?: boolean;
      icebeamInfested?: boolean;
      sabreWrathfulSwipes?: boolean;
      sabreInfestingSwipes?: boolean;
      infestedBackstab?: boolean;
      infestedFlourish?: boolean;
      killstreakBackstab?: boolean;
      relentlessBackstab?: boolean;
      arcticBlizzard?: boolean;
      frostTotemChill?: boolean;
      glacialBiteChill?: boolean;
      glacialTalons?: boolean;
      entanglementBarrage?: boolean;
      cloudkill?: boolean;
      cloudkillDamage?: boolean;
      tempestBurstArcticChill?: boolean;
      tempestBurstWyvernZombie?: boolean;
    },
    hitWorldPosition?: { x: number; y: number; z: number },
  ) => void;
  
  // PVP damage callback for routing player damage to server
  private onPlayerDamageCallback?: (playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void;

  // Co-op mode flag - prevents player-to-player damage
  private isCoopMode: boolean = false;

  private onPillarDamageCallback?: (pillarId: string, damage: number, sourcePlayerId?: string) => void;

  private onMushroomDamageCallback?: (index: number, damage: number, sourcePlayerId: string | undefined, damageType?: string) => void;

  // Log throttling to reduce spam
  private lastDamageLogTime = 0;
  private damageLogThrottle = 100; // Only log every 100ms

  // Local player entity ID for distinguishing caster vs target damage numbers
  private localPlayerEntityId: number | null = null;

  // Shield audio state machine for local player
  private localPlayerShieldPrev = 0;
  private localPlayerRegenPrev = false;
  private localPlayerShieldAudioInitialized = false;

  /** Runeblade LMB: armed from ControlSystem when cone preview hits; crit aggregated from resolved damage, flushed end of `processDamageQueue`. */
  private runebladeLmbSfxArmed: { step: 1 | 2 | 3; position: Vector3 } | null = null;
  private runebladeLmbSfxQueueProcessed = 0;
  private runebladeLmbSfxQueueAnyCrit = false;

  constructor(world: World) {
    super();
    this.world = world;
    this.damageNumberManager = new DamageNumberManager();
    this.priority = 25; // Run after collision detection
  }

  private getCurrentWeapon(): WeaponType | undefined {
    // Get current weapon from ControlSystem
    const controlSystemRef = (window as any).controlSystemRef;
    if (controlSystemRef && controlSystemRef.current) {
      return controlSystemRef.current.getCurrentWeapon();
    }
    return undefined;
  }

  private getControlSystem(): any {
    return (window as any).controlSystemRef?.current;
  }

  private shouldApplyBloodleechRoomTalent(): boolean {
    return this.getControlSystem()?.shouldApplyBloodleechRoomTalent?.() === true;
  }

  private maybeApplyBloodleechCriticalHeal(damageResult: DamageResult, source?: Entity): void {
    if (!damageResult.isCritical || !source || !this.shouldApplyBloodleechRoomTalent()) return;
    const healingAmount = Math.max(0, Math.floor(getGlobalStrengthStatPoints()));
    if (healingAmount <= 0) return;

    const controlSystem = this.getControlSystem();
    const playerEntity = controlSystem?.playerEntity as Entity | undefined;
    const playerHealth = playerEntity?.getComponent(Health);
    if (!playerEntity || !playerHealth || !playerHealth.heal(healingAmount)) return;

    const playerTransform = playerEntity.getComponent(Transform);
    const healPosition = playerTransform
      ? playerTransform.getWorldPosition().clone().add(new Vector3(0, 1.5, 0))
      : new Vector3(0, 1.5, 0);
    this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
    controlSystem?.broadcastRoomBoonHealing?.(healingAmount, 'room_boon_bloodleech', healPosition);
  }

  /** Wrathful Bite talent — additive crit for `damageType === 'barrage'` from the local ControlSystem. */
  private getBarrageCritCalcOpts(damageType?: string): DamageCalcOptions | undefined {
    if (damageType !== 'barrage') return undefined;
    const cs = (window as any).controlSystemRef?.current;
    return cs?.getBarrageCritDamageCalcOpts?.();
  }

  /** Wrathful Shots — perfect bow primary: additive crit from ControlSystem when projectile is flagged. */
  private getWrathfulShotsPerfectCritOptsFromSource(source: Entity | undefined): DamageCalcOptions | undefined {
    if (!source) return undefined;
    const proj = source.getComponent(Projectile);
    if (!proj?.isPerfectShot) return undefined;
    const cs = (window as any).controlSystemRef?.current;
    return cs?.getWrathfulShotsPerfectCritOpts?.();
  }

  /** Wrathful Shots — Tempest Rounds burst: additive crit from ControlSystem when projectile is flagged. */
  private getWrathfulShotsTempestCritOptsFromSource(source: Entity | undefined): DamageCalcOptions | undefined {
    if (!source) return undefined;
    const proj = source.getComponent(Projectile);
    if (!proj?.tempestBurstWrathful) return undefined;
    const cs = (window as any).controlSystemRef?.current;
    return cs?.getWrathfulShotsTempestCritOpts?.();
  }

  /** Entropic bolts / Icebeam Wrathful Entropic — additive crit from queued damage meta. */
  private getCritCalcOptsForQueuedDamage(
    damageType: string | undefined,
    damageEvent: DamageEvent,
    source?: Entity,
  ): DamageCalcOptions | undefined {
    if (damageType === 'barrage') return this.getBarrageCritCalcOpts(damageType);
    if (damageType === 'fan_of_knives') return undefined;
    if (damageType === 'crossentropy' && damageEvent.crossentropyInferno === true) {
      return { critChanceAdd: INFERNAL_SMITE_CRIT_CHANCE_ADD };
    }
    if (damageType === 'projectile') {
      return (
        this.getWrathfulShotsPerfectCritOptsFromSource(source) ??
        this.getWrathfulShotsTempestCritOptsFromSource(source)
      );
    }
    if (damageType === 'entropic' && damageEvent.entropicWrathful === true) {
      return { critChanceAdd: WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD };
    }
    if (damageType === 'icebeam' && damageEvent.icebeamWrathful === true) {
      return { critChanceAdd: WRATHFUL_ENTROPIC_BEAM_CRIT_CHANCE_ADD };
    }
    if (
      (damageType === 'sabre_left' || damageType === 'sabre_right') &&
      damageEvent.sabreWrathfulSwipes === true
    ) {
      return {
        critChanceAdd: WRATHFUL_SABRES_SWIPES_CRIT_CHANCE_ADD,
        critDamageMultAdd: WRATHFUL_SABRES_SWIPES_CRIT_DAMAGE_MULT_ADD,
      };
    }
    return undefined;
  }

  /** Co-op: `enemy-damaged` echo in MultiplayerContext already spawns these DoT floats. */
  private shouldDeferDotFloatingToServerEcho(
    damageType: string | undefined,
    damageEvent: DamageEvent,
  ): boolean {
    if (!damageType) return false;
    if (
      damageType === 'ignite' ||
      damageType === 'venom' ||
      damageType === 'wyvern_talons_detonate' ||
      damageType === 'player_zombie'
    ) {
      return true;
    }
    if (damageType === 'cloudkill' && damageEvent.cloudkillDamage === true) {
      return true;
    }
    if (damageType === 'crossentropy' && damageEvent.crossentropyMeteor === true) {
      return true;
    }
    return false;
  }

  public armRunebladeLmbHitSound(comboStep: 1 | 2 | 3, position: Vector3): void {
    this.runebladeLmbSfxArmed = { step: comboStep, position: position.clone() };
  }

  private maybeRecordRunebladeLmbSfx(damageType: string | undefined, damageResult: DamageResult): void {
    if (damageType !== 'sword' || !this.runebladeLmbSfxArmed) return;
    if (this.getCurrentWeapon() !== WeaponType.RUNEBLADE) return;
    this.runebladeLmbSfxQueueAnyCrit = this.runebladeLmbSfxQueueAnyCrit || damageResult.isCritical;
    this.runebladeLmbSfxQueueProcessed += 1;
  }

  private flushRunebladeLmbHitSoundIfReady(): void {
    if (!this.runebladeLmbSfxArmed || this.runebladeLmbSfxQueueProcessed === 0) return;
    const armed = this.runebladeLmbSfxArmed;
    const anyCrit = this.runebladeLmbSfxQueueAnyCrit;
    this.runebladeLmbSfxArmed = null;
    this.runebladeLmbSfxQueueProcessed = 0;
    this.runebladeLmbSfxQueueAnyCrit = false;
    const audio = (window as any).controlSystemRef?.current?.getAudioSystem?.() as
      | { playSwordSwingSound: (s: 1 | 2 | 3, p: Vector3) => void; playRunebladeSwingHitSound: (p: Vector3) => void }
      | undefined;
    if (!audio) return;
    if (anyCrit) {
      audio.playSwordSwingSound(armed.step, armed.position);
    } else {
      audio.playRunebladeSwingHitSound(armed.position);
    }
  }

  // Throttled logging to reduce spam
  private shouldLogDamage(): boolean {
    const now = Date.now();
    if (now - this.lastDamageLogTime > this.damageLogThrottle) {
      this.lastDamageLogTime = now;
      return true;
    }
    return false;
  }

  /**
   * Dual Coil: spread floating damage numbers side-by-side (world offset + `dualCoilSlot` for UI).
   * Returns the lane (0/1) when applied.
   */
  private applyDualCoilDamageNumberLateral(
    position: Vector3,
    source: Entity | undefined,
  ): 0 | 1 | undefined {
    if (!source) return undefined;
    const projectile = source.getComponent(Projectile);
    if (projectile?.dualCoilLane === undefined) return undefined;
    const vel = projectile.velocity;
    if (!vel || vel.lengthSq() < 1e-8) return undefined;
    const dir = vel.clone().normalize();
    const off = getDualCoilLateralVector(dir, DUAL_COIL_DAMAGE_NUMBER_LATERAL_OFFSET);
    if (projectile.dualCoilLane === 1) {
      off.negate();
    }
    position.add(off);
    return projectile.dualCoilLane;
  }

  /** Bow / Entropic Bolt hit-feedback — used on both local-apply and server-routed enemy damage paths. */
  private maybeAddBowOrEntropicImpactVfx(
    source: Entity | undefined,
    target: Entity,
    damageType: string | undefined,
    shouldShow: boolean,
  ): void {
    if (!shouldShow) return;
    const proj = source?.getComponent(Projectile);
    if (!proj || this.localPlayerEntityId === null || proj.owner !== this.localPlayerEntityId) {
      return;
    }
    const isBow = damageType === 'projectile';
    const isEntropic = damageType === 'entropic' || damageType === 'entropic_cryoflame';
    if (!isBow && !isEntropic) return;
    const hitTransform = target.getComponent(Transform);
    if (!hitTransform) return;
    const hitPos = hitTransform.getWorldPosition();
    if (!hitPos) return;
    const dir =
      proj.velocity.length() > 0
        ? proj.velocity.clone().normalize()
        : new Vector3(0, 0, 1);
    const renderer = source?.getComponent(Renderer);
    const userData = renderer?.mesh?.userData;
    const isCryoflame = isEntropic && userData?.isCryoflame === true;
    let colorVariant = isEntropic
      ? (userData?.colorVariant as string | undefined)
      : undefined;
    if (isEntropic && !colorVariant) {
      const talent = userData?.entropicBoltTalent as string | undefined;
      if (talent === 'wrathful') colorVariant = 'red';
      else if (talent === 'staggering') colorVariant = 'blue';
      else if (talent === 'infesting') colorVariant = 'green';
      else if (talent === 'arctic') colorVariant = 'arctic';
    }
    this.impactEffectManager.addImpact(
      isBow ? 'bow-shot-impact' : 'entropic-bolt-impact',
      hitPos,
      dir,
      isEntropic ? { colorVariant, isCryoflame } : undefined,
    );
  }

  /** Sabres Q/E (backstab / sunder) hit-feedback — local player only. */
  private maybeAddSabreAbilityImpactVfx(
    source: Entity | undefined,
    target: Entity,
    damageType: string | undefined,
    shouldShow: boolean,
  ): void {
    if (!shouldShow) return;
    if (damageType !== 'backstab' && damageType !== 'sunder') return;
    if (
      this.localPlayerEntityId === null ||
      !source ||
      source.id !== this.localPlayerEntityId
    ) {
      return;
    }
    if (this.getCurrentWeapon() !== WeaponType.SABRES) return;

    const hitTransform = target.getComponent(Transform);
    const sourceTransform = source.getComponent(Transform);
    if (!hitTransform || !sourceTransform) return;

    const hitPos = hitTransform.getWorldPosition().clone();
    hitPos.y += 1.5;

    const srcWorld = sourceTransform.getWorldPosition().clone();
    let dir = new Vector3(hitPos.x - srcWorld.x, 0, hitPos.z - srcWorld.z);
    if (dir.lengthSq() < 1e-8) {
      const cs = (window as any).controlSystemRef?.current;
      if (cs?.camera?.getWorldDirection) {
        dir = new Vector3();
        cs.camera.getWorldDirection(dir);
        dir.y = 0;
      }
    }
    if (dir.lengthSq() < 1e-8) {
      dir.set(0, 0, 1);
    } else {
      dir.normalize();
    }

    this.impactEffectManager.addImpact('sabre-impact-effect', hitPos, dir);

    const audio = (window as any).controlSystemRef?.current?.getAudioSystem?.() as
      | { playSabresAbilityImpactSound?: (p: Vector3) => void }
      | undefined;
    audio?.playSabresAbilityImpactSound?.(hitPos);
  }

  // Set callback for routing enemy damage to multiplayer server
  public setEnemyDamageCallback(
    callback: (
      enemyId: string,
      damage: number,
      sourcePlayerId?: string,
      meta?: {
        damageType?: string;
        infestedStrike?: boolean;
        infestedSmite?: boolean;
        infernalSmite?: boolean;
        infernoCrossentropy?: boolean;
        reaperCrossentropy?: boolean;
        crossentropyPlague?: boolean;
        crossentropyMeteor?: boolean;
        staggerToAdd?: number;
        infestedCombo?: boolean;
        wyvernBiteVenom?: boolean;
        wyvernStingVenomZombie?: boolean;
        wyvernTalonsZombie?: boolean;
        wyvernBiteConcentratedDoT?: boolean;
        entropicWrathful?: boolean;
        entropicInfesting?: boolean;
        icebeamWrathful?: boolean;
        icebeamInfested?: boolean;
        sabreWrathfulSwipes?: boolean;
        sabreInfestingSwipes?: boolean;
        infestedBackstab?: boolean;
        infestedFlourish?: boolean;
        killstreakBackstab?: boolean;
        relentlessBackstab?: boolean;
        arcticBlizzard?: boolean;
        frostTotemChill?: boolean;
        glacialBiteChill?: boolean;
        glacialTalons?: boolean;
        entanglementBarrage?: boolean;
        tempestBurstArcticChill?: boolean;
        tempestBurstWyvernZombie?: boolean;
      },
      hitWorldPosition?: { x: number; y: number; z: number },
    ) => void,
  ): void {
    this.onEnemyDamageCallback = callback;
  }

  /** True when enemy damage is routed to the co-op server (no local CV ticks; use server for CV detonate). */
  public usesNetworkedEnemyDamage(): boolean {
    return !!this.onEnemyDamageCallback;
  }
  
  // Set callback for routing player damage to multiplayer server (PVP)
  public setPlayerDamageCallback(callback: (playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void): void {
    this.onPlayerDamageCallback = callback;
  }

  public setPillarDamageCallback(callback: (pillarId: string, damage: number, sourcePlayerId?: string) => void): void {
    this.onPillarDamageCallback = callback;
  }

  public setMushroomDamageCallback(
    callback: (index: number, damage: number, sourcePlayerId: string | undefined, damageType?: string) => void,
  ): void {
    this.onMushroomDamageCallback = callback;
  }

  public setCoopMode(isCoop: boolean): void {
    this.isCoopMode = isCoop;
  }


  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000;

    // Update health components (regeneration, invulnerability timers)
    this.updateHealthComponents(entities, deltaTime, currentTime);

    // Process damage queue
    this.processDamageQueue(currentTime);

    // Process heal queue
    this.processHealQueue(currentTime);

    // Handle death and respawn
    this.handleDeathAndRespawn(entities, currentTime);

    // Cleanup old damage numbers
    this.damageNumberManager.cleanup();

    // Clear processed queues
    this.damageQueue.length = 0;
    this.healQueue.length = 0;
    this.deadEntities.length = 0;
  }

  private updateHealthComponents(entities: Entity[], deltaTime: number, currentTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(Health);
      
      // Skip if required Health component is missing
      if (!health || !health.enabled) continue;

      // Update health component (handles regeneration and invulnerability)
      health.update(deltaTime, currentTime);

      // Update shield component if it exists
      const shield = entity.getComponent(Shield);
      if (shield) {
        if (this.localPlayerEntityId !== null && entity.id === this.localPlayerEntityId) {
          this.updateLocalPlayerShieldAudio(shield, deltaTime);
        } else {
          shield.update(deltaTime);
        }
      } else if (this.localPlayerEntityId !== null && entity.id === this.localPlayerEntityId && this.localPlayerRegenPrev) {
        // Shield component disappeared on local player — stop any active regen loop
        this.localPlayerRegenPrev = false;
        (window as any).audioSystem?.setShieldRegenPlaying?.(false);
      }

      // Update debuff statuses for enemies
      const enemy = entity.getComponent(Enemy);
      if (enemy) {
        enemy.updateFreezeStatus(currentTime);
        enemy.updateStunStatus(currentTime);
        enemy.updateCorruptedStatus(currentTime);
        enemy.updateChillStatus(currentTime);
        const entangleTick = enemy.updateEntangleStatus(currentTime);

        if (!this.onEnemyDamageCallback) {
          if (entangleTick.shouldDealDamage && entangleTick.damage > 0) {
            this.queueDamage(entity, entangleTick.damage, undefined, 'entanglement');
          }
          const cv = enemy.updateConcentratedVenomStatus(currentTime);
          if (cv.shouldDealDamage && cv.damage > 0) {
            this.queueDamage(
              entity,
              cv.damage,
              undefined,
              'venom',
              undefined,
              false,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              true,
            );
          }
        }
        
        // Synchronize enemy debuffs with movement component
        this.synchronizeEnemyDebuffsWithMovement(entity, enemy);
      }
    }
  }

  private processDamageQueue(currentTime: number): void {
    this.runebladeLmbSfxQueueProcessed = 0;
    this.runebladeLmbSfxQueueAnyCrit = false;
    for (const damageEvent of this.damageQueue) {
      this.applyDamage(damageEvent, currentTime);
    }
    this.flushRunebladeLmbHitSoundIfReady();
  }

  private processHealQueue(currentTime: number): void {
    for (const healEvent of this.healQueue) {
      this.applyHealing(healEvent, currentTime);
    }
  }

  private maybeApplyReaperCrossentropyHitHeal(
    damageEvent: DamageEvent,
    target: Entity,
    source: Entity | undefined,
    damageType: string | undefined,
    actualDamage: number,
  ): void {
    if (
      damageType !== 'crossentropy' ||
      damageEvent.reaperCrossentropy !== true ||
      actualDamage <= 0 ||
      !source ||
      !target.getComponent(Enemy)
    ) {
      return;
    }
    if (target.userData?.coopServerEnemyType === 'training-dummy') {
      return;
    }
    if (CROSSENTROPY_REAPER_HIT_HEAL <= 0) return;

    const projectile = source.getComponent(Projectile);
    let caster: Entity | undefined;
    if (projectile) {
      if (
        this.localPlayerEntityId !== null &&
        projectile.owner !== this.localPlayerEntityId
      ) {
        return;
      }
      caster = this.world.getEntity(projectile.owner);
    } else {
      caster = source;
    }

    if (!caster) return;
    const sourceHealth = caster.getComponent(Health);
    if (!sourceHealth) return;

    const didHeal = sourceHealth.heal(CROSSENTROPY_REAPER_HIT_HEAL);
    if (!didHeal) return;

    const sourceTransform = caster.getComponent(Transform);
    if (sourceTransform) {
      const healPosition = sourceTransform.getWorldPosition().clone();
      healPosition.y += 1.5;
      this.damageNumberManager.addDamageNumber(
        CROSSENTROPY_REAPER_HIT_HEAL,
        false,
        healPosition,
        'healing',
      );
    }
  }

  /** Glacial Talons — 2× vs fully Frozen (post-crit, matches server `damageEnemy` order). */
  private applyGlacialTalonsFrozenBonus(
    damage: number,
    damageType: string | undefined,
    glacialTalons: boolean | undefined,
    enemy: Enemy | null | undefined,
  ): number {
    if (
      enemy &&
      damageType === 'reaping_talons' &&
      glacialTalons === true &&
      enemy.isFrozen
    ) {
      return Math.floor(damage * 2);
    }
    return damage;
  }

  private applyDamage(damageEvent: DamageEvent, currentTime: number): void {
    const { target, damage: baseDamage, source, sourcePlayerId } = damageEvent;
    let damageType = damageEvent.damageType;

    const health = target.getComponent(Health);
    if (!health || !health.enabled) return;

    const enemy = target.getComponent(Enemy);
    if (enemy && target.userData?.isCoopAlliedUnit) {
      return;
    }
    if (enemy && this.onEnemyDamageCallback && target.userData?.coopEnemyDying) {
      return;
    }

    if (this.isCoopMode && !enemy && target.userData?.isCoopAllyPlayer) {
      return;
    }

    // Check if target is an enemy - if so, route damage through multiplayer
    if (enemy && !health.isDead && this.onEnemyDamageCallback) {
      // Calculate actual damage with critical hit mechanics
      // For abilities that already determined critical hits (like backstab), preserve the original critical flag
      const currentWeapon = this.getCurrentWeapon();
      let damageResult: DamageResult;

      if (damageEvent.isCritical !== undefined) {
        // Preserve pre-calculated critical hit and damage (e.g., from backstab)
        // The damage is already calculated correctly, just preserve the critical flag
        damageResult = { damage: baseDamage, isCritical: damageEvent.isCritical };
      } else {
        // Calculate critical hit normally for projectiles/abilities that don't pre-calculate
        const critOpts = this.getCritCalcOptsForQueuedDamage(damageType, damageEvent, source);
        damageResult = calculateDamage(baseDamage, currentWeapon, critOpts);
      }

      const actualDamage = damageResult.damage;
      const displayDamage = this.applyGlacialTalonsFrozenBonus(
        actualDamage,
        damageType,
        damageEvent.glacialTalons,
        enemy,
      );
      this.maybeRecordRunebladeLmbSfx(damageType, damageResult);
      this.maybeApplyBloodleechCriticalHeal(damageResult, source);

      // Get source player ID for proper kill attribution
      // Use the sourcePlayerId from damage event if available, otherwise extract from source entity
      let finalSourcePlayerId = sourcePlayerId;
      if (!finalSourcePlayerId && source) {
        // Check if source is a projectile with stored player info
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      // Route enemy damage through multiplayer server instead of applying locally
      // Use server enemy ID from entity userData instead of ECS entity ID
      const serverEnemyId = target.userData?.serverEnemyId || target.id.toString();
      // console.log(`🌐 Routing ${actualDamage} damage to enemy ${serverEnemyId} (ECS: ${target.id}) through multiplayer server from source player ${finalSourcePlayerId || 'unknown'}`);
      const baseRouteMeta =
        damageType === 'wraith_strike'
          ? {
              damageType: 'wraith_strike' as const,
              infestedStrike: damageEvent.infestedStrike === true,
              ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                ? { staggerToAdd: damageEvent.staggerToAdd }
                : {}),
            }
          : damageType === 'smite' &&
              (damageEvent.infestedSmite === true ||
                damageEvent.infernalSmite === true ||
                (damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0))
            ? {
                damageType: 'smite' as const,
                ...(damageEvent.infestedSmite === true ? { infestedSmite: true as const } : {}),
                ...(damageEvent.infernalSmite === true ? { infernalSmite: true as const } : {}),
                ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                  ? { staggerToAdd: damageEvent.staggerToAdd }
                  : {}),
              }
            : damageType === 'sword' &&
                currentWeapon === WeaponType.RUNEBLADE &&
                ((damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0) ||
                  damageEvent.infestedCombo === true)
              ? {
                  damageType: 'runeblade_combo' as const,
                  ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                    ? { staggerToAdd: damageEvent.staggerToAdd }
                    : {}),
                  ...(damageEvent.infestedCombo === true ? { infestedCombo: true as const } : {}),
                }
              : (damageType === 'sabre_left' || damageType === 'sabre_right') &&
                  ((damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0) ||
                    damageEvent.sabreInfestingSwipes === true)
                ? {
                    damageType,
                    ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                      ? { staggerToAdd: damageEvent.staggerToAdd }
                      : {}),
                    ...(damageEvent.sabreInfestingSwipes === true
                      ? { sabreInfestingSwipes: true as const }
                      : {}),
                  }
                : damageType === 'projectile' &&
                    ((damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0) ||
                      damageEvent.cloudkillProc === true ||
                      damageEvent.tempestBurstArcticChill === true ||
                      damageEvent.tempestBurstWyvernZombie === true)
                  ? {
                      damageType: 'projectile' as const,
                      ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                        ? { staggerToAdd: damageEvent.staggerToAdd }
                        : {}),
                      ...(damageEvent.cloudkillProc === true ? { cloudkill: true as const } : {}),
                      ...(damageEvent.tempestBurstArcticChill === true
                        ? { tempestBurstArcticChill: true as const }
                        : {}),
                      ...(damageEvent.tempestBurstWyvernZombie === true
                        ? { tempestBurstWyvernZombie: true as const }
                        : {}),
                    }
                  : damageType === 'cloudkill'
                    ? {
                        damageType: 'cloudkill' as const,
                        cloudkillDamage: true as const,
                      }
                  : damageType === 'reaping_talons'
                    ? {
                        damageType: 'reaping_talons' as const,
                        ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                          ? { staggerToAdd: damageEvent.staggerToAdd }
                          : {}),
                        ...(damageEvent.glacialTalons === true
                          ? { glacialTalons: true as const }
                          : {}),
                        ...(damageEvent.wyvernTalonsZombie === true
                          ? { wyvernTalonsZombie: true as const }
                          : {}),
                      }
                  : damageType === 'barrage'
                    ? {
                        damageType: 'barrage' as const,
                        ...(damageEvent.wyvernBiteConcentratedVenom === true
                          ? { wyvernBiteVenom: true as const }
                          : {}),
                        ...(damageEvent.glacialBiteChill === true
                          ? { glacialBiteChill: true as const }
                          : {}),
                        ...(damageEvent.entanglementBarrage === true
                          ? { entanglementBarrage: true as const }
                          : {}),
                        ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                          ? { staggerToAdd: damageEvent.staggerToAdd }
                          : {}),
                      }
                    : damageType === 'crossentropy'
                      ? {
                          damageType: 'crossentropy' as const,
                          ...(damageEvent.crossentropyInferno === true
                            ? { infernoCrossentropy: true as const }
                            : {}),
                          ...(damageEvent.reaperCrossentropy === true
                            ? { reaperCrossentropy: true as const }
                            : {}),
                          ...(damageEvent.crossentropyPlague === true
                            ? { crossentropyPlague: true as const }
                            : {}),
                          ...(damageEvent.crossentropyMeteor === true
                            ? { crossentropyMeteor: true as const }
                            : {}),
                          ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                            ? { staggerToAdd: damageEvent.staggerToAdd }
                            : {}),
                        }
                      : damageType === 'venom'
                        ? {
                            damageType: 'venom' as const,
                            ...(damageEvent.wyvernStingVenomZombie === true
                              ? { wyvernStingVenomZombie: true as const }
                              : {}),
                            ...(damageEvent.wyvernBiteConcentratedDoT === true
                              ? { wyvernBiteConcentratedDoT: true as const }
                              : {}),
                          }
                        : damageType === 'cobra_shot'
                          ? { damageType: 'cobra_shot' as const }
                        : damageType === 'wyvern_talons_detonate'
                          ? {
                              damageType: 'wyvern_talons_detonate' as const,
                              ...(damageEvent.wyvernTalonsZombie === true
                                ? { wyvernTalonsZombie: true as const }
                                : {}),
                            }
                          : damageType === 'blizzard'
                            ? {
                                damageType: 'blizzard' as const,
                                ...(damageEvent.blizzardArctic === true
                                  ? { arcticBlizzard: true as const }
                                  : {}),
                              }
                        : damageType === 'breath_weapon'
                          ? {
                              damageType: 'breath_weapon' as const,
                              ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                ? { staggerToAdd: damageEvent.staggerToAdd }
                                : {}),
                            }
                          : damageType === 'entropic' &&
                              ((damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0) ||
                                damageEvent.entropicWrathful === true ||
                                damageEvent.entropicInfesting === true ||
                                damageEvent.frostTotemChill === true)
                            ? {
                                damageType: 'entropic' as const,
                                ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                  ? { staggerToAdd: damageEvent.staggerToAdd }
                                  : {}),
                                ...(damageEvent.entropicWrathful === true
                                  ? { entropicWrathful: true as const }
                                  : {}),
                                ...(damageEvent.entropicInfesting === true
                                  ? { entropicInfesting: true as const }
                                  : {}),
                                ...(damageEvent.frostTotemChill === true
                                  ? { frostTotemChill: true as const }
                                  : {}),
                              }
                            : damageType === 'icebeam'
                              ? {
                                  damageType: 'icebeam' as const,
                                  ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                    ? { staggerToAdd: damageEvent.staggerToAdd }
                                    : {}),
                                  ...(damageEvent.icebeamWrathful === true
                                    ? { icebeamWrathful: true as const }
                                    : {}),
                                  ...(damageEvent.icebeamInfested === true
                                    ? { icebeamInfested: true as const }
                                    : {}),
                                }
                              : damageType === 'backstab'
                                ? {
                                    damageType: 'backstab' as const,
                                    ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                      ? { staggerToAdd: damageEvent.staggerToAdd }
                                      : {}),
                                    ...(damageEvent.infestedBackstab === true
                                      ? { infestedBackstab: true as const }
                                      : {}),
                                    ...(damageEvent.killstreakBackstab === true
                                      ? { killstreakBackstab: true as const }
                                      : {}),
                                    ...(damageEvent.relentlessBackstab === true
                                      ? { relentlessBackstab: true as const }
                                      : {}),
                                  }
                                : damageType === 'sunder'
                                  ? {
                                      damageType: 'sunder' as const,
                                      ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                        ? { staggerToAdd: damageEvent.staggerToAdd }
                                        : {}),
                                      ...(damageEvent.infestedFlourish === true
                                        ? { infestedFlourish: true as const }
                                        : {}),
                                    }
                                  : damageType === 'fan_of_knives'
                                    ? {
                                        damageType: 'fan_of_knives' as const,
                                        ...(damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0
                                          ? { staggerToAdd: damageEvent.staggerToAdd }
                                          : {}),
                                        ...(damageEvent.infestedFlourish === true
                                          ? { infestedFlourish: true as const }
                                          : {}),
                                      }
                                    : damageType === 'lightning_storm' &&
                                        (damageEvent.staggerToAdd != null && damageEvent.staggerToAdd > 0)
                                      ? {
                                          damageType: 'lightning_storm' as const,
                                          staggerToAdd: damageEvent.staggerToAdd,
                                        }
                                      : undefined;
      const routeMeta = baseRouteMeta;
      let hitWorldPosition: { x: number; y: number; z: number } | undefined;
      const hitTransform = target.getComponent(Transform);
      if (hitTransform) {
        const p = hitTransform.getWorldPosition();
        hitWorldPosition = { x: p.x, y: p.y + 1.5, z: p.z };
      }
      this.onEnemyDamageCallback(serverEnemyId, actualDamage, finalSourcePlayerId, routeMeta, hitWorldPosition);

      // Apply Runeblade Arcane Mastery passive healing (10% of damage dealt)
      if (source && currentWeapon === WeaponType.RUNEBLADE) {
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          // Check if Runeblade passive is unlocked
          const weaponSlot = controlSystem.selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' :
                            controlSystem.selectedWeapons?.secondary === WeaponType.RUNEBLADE ? 'secondary' : null;
          if (weaponSlot && controlSystem.isPassiveAbilityUnlocked && controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
            const healingAmount = Math.floor(actualDamage * 0.15); // 10% of damage dealt
            if (healingAmount > 0) {
              // Apply healing to source player
              const sourceHealth = source.getComponent(Health);
              if (sourceHealth) {
                sourceHealth.heal(healingAmount);

                // Create healing number for visual feedback
                const sourceTransform = source.getComponent(Transform);
                if (sourceTransform) {
                  const healPosition = sourceTransform.getWorldPosition().clone();
                  healPosition.y += 1.5;
                  this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
                }
              }
            }
          }
        }
      }

      // Infested Combo: heal for a fraction of final hit damage (after crit)
      if (
        source &&
        currentWeapon === WeaponType.RUNEBLADE &&
        damageEvent.infestedCombo === true
      ) {
        const infestedHeal = Math.floor(actualDamage * INFESTED_COMBO_LIFESTEAL);
        if (infestedHeal > 0) {
          const sourceHealth = source.getComponent(Health);
          if (sourceHealth) {
            sourceHealth.heal(infestedHeal);
            const sourceTransform = source.getComponent(Transform);
            if (sourceTransform) {
              const healPosition = sourceTransform.getWorldPosition().clone();
              healPosition.y += 1.5;
              this.damageNumberManager.addDamageNumber(infestedHeal, false, healPosition, 'healing');
            }
          }
        }
      }

      this.maybeApplyReaperCrossentropyHitHeal(damageEvent, target, source, damageType, actualDamage);

      // Still create local damage numbers for immediate visual feedback (DoT types defer to server echo)
      if (!this.shouldDeferDotFloatingToServerEcho(damageType, damageEvent)) {
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          position.y += 1.5;
          if (damageType === 'sabre_right' || damageType === 'sabres_right') position.x += 0.3;
          else if (damageType === 'sabre_left' || damageType === 'sabres_left') position.x -= 0.3;
          const dualCoilSlot = this.applyDualCoilDamageNumberLateral(position, source);
          this.damageNumberManager.addDamageNumber(
            displayDamage,
            damageResult.isCritical,
            position,
            damageType,
            undefined,
            damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined,
            dualCoilSlot
          );
        }
      }

      this.maybeTriggerFrostpath(damageType, source, target);
      this.maybeTriggerSolarRecharge(damageType, source, target);
      this.maybeTriggerArcticShards(damageType, source, target);

      this.maybeAddBowOrEntropicImpactVfx(source, target, damageType, actualDamage > 0);
      this.maybeAddSabreAbilityImpactVfx(source, target, damageType, actualDamage > 0);

      return; // Don't apply damage locally for enemies
    }

    const destructibleMushroom = target.getComponent(DestructibleMushroom);
    if (destructibleMushroom && !health.isDead && this.onMushroomDamageCallback) {
      const currentWeapon = this.getCurrentWeapon();
      let damageResult: DamageResult;
      if (damageEvent.isCritical !== undefined) {
        damageResult = { damage: baseDamage, isCritical: damageEvent.isCritical };
      } else {
        const critOpts = this.getCritCalcOptsForQueuedDamage(damageType, damageEvent, source);
        damageResult = calculateDamage(baseDamage, currentWeapon, critOpts);
      }
      const actualDamage = damageResult.damage;
      this.maybeRecordRunebladeLmbSfx(damageType, damageResult);

      let finalSourcePlayerId = sourcePlayerId;
      if (!finalSourcePlayerId && source) {
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      this.onMushroomDamageCallback(
        destructibleMushroom.mushroomIndex,
        actualDamage,
        finalSourcePlayerId,
        damageType,
      );

      const transform = target.getComponent(Transform);
      if (transform) {
        const position = transform.getWorldPosition();
        position.y += 1.5;
        if (damageType === 'sabre_right' || damageType === 'sabres_right') position.x += 0.3;
        else if (damageType === 'sabre_left' || damageType === 'sabres_left') position.x -= 0.3;
        const dualCoilSlot = this.applyDualCoilDamageNumberLateral(position, source);
        this.damageNumberManager.addDamageNumber(
          actualDamage,
          damageResult.isCritical,
          position,
          damageType,
          undefined,
          damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined,
          dualCoilSlot,
        );
      }

      this.maybeTriggerFrostpath(damageType, source, target);
      this.maybeTriggerSolarRecharge(damageType, source, target);
      this.maybeTriggerArcticShards(damageType, source, target);

      return;
    }

    // Check if target is a pillar - if so, route damage through multiplayer server
    const pillar = target.getComponent(Pillar);
    if (pillar && this.onPillarDamageCallback) {
      // Calculate actual damage with critical hit mechanics
      const currentWeapon = this.getCurrentWeapon();
      let damageResult: DamageResult;

      if (damageEvent.isCritical !== undefined) {
        // Preserve pre-calculated critical hit and damage
        damageResult = { damage: baseDamage, isCritical: damageEvent.isCritical };
      } else {
        // Calculate critical hit normally for projectiles/abilities that don't pre-calculate
        const critOpts = this.getCritCalcOptsForQueuedDamage(damageType, damageEvent, source);
        damageResult = calculateDamage(baseDamage, currentWeapon, critOpts);
      }

      const actualDamage = damageResult.damage;

      // Get source player ID for proper attribution
      let finalSourcePlayerId = sourcePlayerId;
      if (!finalSourcePlayerId && source) {
        // Check if source is a projectile with stored player info
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      // Get the server pillar ID from userData (set during ECS sync)
      const serverPillarId = target.userData?.serverPillarId || `pillar_${pillar.ownerId}_${pillar.pillarIndex}`;

      // CRITICAL: Only allow damage from enemy players, not from the pillar owner
      if (finalSourcePlayerId === pillar.ownerId) {
        return; // Can't damage your own pillars
      }

      this.onPillarDamageCallback(serverPillarId, actualDamage, finalSourcePlayerId);
      this.maybeRecordRunebladeLmbSfx(damageType, damageResult);

      // Create damage number for visual feedback
      const transform = target.getComponent(Transform);
      if (transform) {
        const position = transform.getWorldPosition();
        position.y += 2; // Position above pillar
        this.damageNumberManager?.addDamageNumber(
          actualDamage,
          damageResult.isCritical,
          position,
          damageType,
          undefined,
          damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined
        );
      }

      return; // Don't process further for pillars
    }

    // Check if target is a player - if so, route damage through multiplayer (only in PVP mode)
    // Also prevent self-damage and player-to-player damage in co-op mode
    if (!enemy && this.onPlayerDamageCallback && source && source.id !== target.id && !this.isCoopMode) {
      // CRITICAL: Don't damage dead players in PVP
      const targetHealth = target.getComponent(Health);
      if (targetHealth && targetHealth.isDead) {
        return;
      }
      // Check if this is a Cryoflame-enhanced Entropic Bolt
      const isCryoflameBolt = damageType === 'entropic' && source.getComponent(Renderer)?.mesh?.userData?.isCryoflame === true;

      // Update damage type for Cryoflame bolts for proper damage number coloring
      if (isCryoflameBolt) {
        damageType = 'entropic_cryoflame';
      }

      // Start with base damage (burning stacks removed)
      let finalDamage = baseDamage;

      // Apply Cryoflame double damage to frozen enemies BEFORE critical calculation
      if (isCryoflameBolt) {
        // Check if target is frozen using the debuff system
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          const isFrozen = controlSystem.isPlayerStunned(target.id); // Now checks both stunned and frozen
          if (isFrozen) {
            // Double the damage for frozen enemies BEFORE critical calculation
            finalDamage *= 2;
          }
        }
      }

      // Calculate actual damage with critical hit mechanics (using modified damage)
      // For abilities that already determined critical hits (like backstab), preserve the original critical flag
      const currentWeapon = this.getCurrentWeapon();
      let damageResult: DamageResult;

      if (damageEvent.isCritical !== undefined) {
        // Preserve pre-calculated critical hit and damage (e.g., from backstab)
        // The damage is already calculated correctly, just preserve the critical flag
        damageResult = { damage: finalDamage, isCritical: damageEvent.isCritical };
      } else {
        // Calculate critical hit normally for projectiles/abilities that don't pre-calculate
        const pvpCritOpts = this.getCritCalcOptsForQueuedDamage(damageType, damageEvent, source);
        damageResult = calculateDamage(finalDamage, currentWeapon, pvpCritOpts);
      }

      // Debug logging for sabre damage
      if (damageType?.includes('sabre')) {
       // console.log(`🎯 SABRE CRIT CALC - Base: ${finalDamage}, Final: ${damageResult.damage}, Critical: ${damageResult.isCritical}, Type: ${damageType}, Preserved: ${damageEvent.isCritical !== undefined}`);
      }

      // Route player damage through multiplayer server for PVP (let receiver handle shields)
      if (this.shouldLogDamage()) {
        // console.log(`⚔️ Routing ${damageResult.damage} PVP ${damageType || 'damage'} to player ${target.id} through multiplayer server`);
      }
      this.onPlayerDamageCallback(target.id.toString(), damageResult.damage, damageType, damageResult.isCritical); // Send damage and critical flag, let receiver handle shields
      this.maybeRecordRunebladeLmbSfx(damageType, damageResult);

      // Apply Runeblade Arcane Mastery passive healing (10% of damage dealt)
      if (source && currentWeapon === WeaponType.RUNEBLADE) {
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          // Check if Runeblade passive is unlocked
          const weaponSlot = controlSystem.selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' :
                            controlSystem.selectedWeapons?.secondary === WeaponType.RUNEBLADE ? 'secondary' : null;
          if (weaponSlot && controlSystem.isPassiveAbilityUnlocked && controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
            const healingAmount = Math.floor(damageResult.damage * 0.15); // 10% of damage dealt
            if (healingAmount > 0) {
              // Apply healing to source player
              const sourceHealth = source.getComponent(Health);
              if (sourceHealth) {
                sourceHealth.heal(healingAmount);

                // Create healing number for visual feedback
                const sourceTransform = source.getComponent(Transform);
                if (sourceTransform) {
                  const healPosition = sourceTransform.getWorldPosition().clone();
                  healPosition.y += 1.5;
                  this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
                }
              }
            }
          }
        }
      }

      // Specific projectile types use the damage taken system.
      // Exception: Show damage numbers for crossentropy and entropic bolts when local player is the caster (not the target)
      const isProjectileWithDamageTaken =
        damageType === 'crossentropy' ||
        damageType === 'entropic' ||
        damageType === 'entropic_cryoflame' ||
        damageType === 'projectile' ||
        damageType === 'fan_of_knives';
      const isLocalPlayerCaster = this.localPlayerEntityId !== null && this.localPlayerEntityId !== target.id;
      const shouldShowDamageNumbers = !isProjectileWithDamageTaken || (isProjectileWithDamageTaken && isLocalPlayerCaster);

      if (shouldShowDamageNumbers) {
        // Create local damage numbers for immediate visual feedback
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          // Only create damage number if position is valid
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            position.y += 1.5;

            // Add slight position offset for delayed damage (like sabres right hit) to prevent overlap
            if (damageType === 'sabres_right' || damageType === 'sabre_right') {
              position.x += 0.3; // Slight offset to the right for the right sabre
            } else if (damageType === 'sabres_left' || damageType === 'sabre_left') {
              position.x -= 0.3; // Slight offset to the left for the left sabre
            }

            this.damageNumberManager.addDamageNumber(
              damageResult.damage, // Show the full damage in damage numbers
              damageResult.isCritical,
              position,
              damageType || 'pvp',
              undefined,
              damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined
            );
          } else {
            // console.warn('⚠️ Skipping PVP damage number creation - invalid position:', position);
          }
        }
      }

      // Log for debugging (throttled to reduce spam)
      if (this.shouldLogDamage()) {
        const sourceName = source ? `Player ${source.id}` : 'Unknown';
        const targetName = `Player ${target.id}`;
        const critText = damageResult.isCritical ? ' CRITICAL' : '';
        // console.log(`⚔️ ${sourceName} dealt ${damageResult.damage}${critText} PVP ${damageType || 'damage'} to ${targetName} (routed to server)`);
      }

      return; // Don't apply damage locally for PVP players
    }

    // For non-enemies (like players in non-PVP mode), apply damage locally as before
    const currentWeapon = this.getCurrentWeapon();
    const localFallbackCritOpts = this.getCritCalcOptsForQueuedDamage(damageType, damageEvent, source);
    const damageResult: DamageResult =
      damageType === 'fan_of_knives'
        ? { damage: baseDamage, isCritical: false }
        : calculateDamage(baseDamage, currentWeapon, localFallbackCritOpts);
    const enemyForGlacialTalons = target.getComponent(Enemy);
    const actualDamage = this.applyGlacialTalonsFrozenBonus(
      damageResult.damage,
      damageType,
      damageEvent.glacialTalons,
      enemyForGlacialTalons,
    );
    this.maybeRecordRunebladeLmbSfx(damageType, damageResult);

    // Apply damage (pass entity so Health can use Shield component)
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;
      if (target.getComponent(Enemy)) {
        this.maybeApplyBloodleechCriticalHeal(damageResult, source);
      }

      // Create damage number at target position
      const transform = target.getComponent(Transform);
      if (transform) {
        const position = transform.getWorldPosition();
        // Only create damage number if position is valid
        if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
          // Offset slightly above the target
          position.y += 3;
          this.damageNumberManager.addDamageNumber(
            actualDamage,
            damageResult.isCritical,
            position,
            damageType,
            undefined,
            damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined
          );
        } else {
          // console.warn('⚠️ Skipping damage number creation - invalid position:', position);
        }
      }

      // Log damage for debugging (throttled to reduce spam)
      if (this.shouldLogDamage()) {
        const sourceName = source ? `Entity ${source.id}` : 'Unknown';
        const targetName = this.getEntityDisplayName(target);
        const critText = damageResult.isCritical ? ' CRITICAL' : '';
        // console.log(`💥 ${sourceName} dealt ${actualDamage}${critText} ${damageType || 'damage'} to ${targetName} (${health.currentHealth}/${health.maxHealth} HP)`);
      }

      this.maybeAddBowOrEntropicImpactVfx(source, target, damageType, damageDealt);
      this.maybeAddSabreAbilityImpactVfx(source, target, damageType, damageDealt);

      this.maybeApplyReaperCrossentropyHitHeal(damageEvent, target, source, damageType, actualDamage);

      // Check if target died
      if (health.isDead) {
        // Only handle death locally if this is not an enemy in multiplayer mode
        // Enemy deaths in multiplayer/PVP mode are handled by the server
        const enemy = target.getComponent(Enemy);
        const shouldHandleDeathLocally = !enemy || !this.onEnemyDamageCallback;

        if (shouldHandleDeathLocally) {
          this.handleEntityDeath(target, source, currentTime);
        } else {
          // Enemy death in multiplayer mode - let server handle experience and death effects
          // console.log(`🌐 Enemy ${target.id} died locally but death handling is deferred to server in multiplayer mode`);
        }

        // Solo / non–co-op-routed: Infested Entropic beam kill heal (co-op heal is server-authoritative)
        if (
          enemy &&
          damageType === 'icebeam' &&
          damageEvent.icebeamInfested === true &&
          !this.onEnemyDamageCallback
        ) {
          const cs = (window as any).controlSystemRef?.current;
          const playerEntity = cs?.playerEntity as Entity | undefined;
          const playerHealth = playerEntity?.getComponent(Health);
          if (playerHealth && INFESTED_ENTROPIC_BEAM_KILL_HEAL > 0) {
            playerHealth.heal(INFESTED_ENTROPIC_BEAM_KILL_HEAL);
            const pt = playerEntity?.getComponent(Transform);
            if (pt) {
              const healPos = pt.getWorldPosition().clone();
              healPos.y += 1.5;
              this.damageNumberManager.addDamageNumber(
                INFESTED_ENTROPIC_BEAM_KILL_HEAL,
                false,
                healPos,
                'healing',
              );
            }
          }
        }

        if (
          enemy &&
          damageType === 'backstab' &&
          health.isDead &&
          !this.onEnemyDamageCallback
        ) {
          const cs = (window as any).controlSystemRef?.current;
          cs?.applySabresBackstabKillRewards?.({
            killstreak: damageEvent.killstreakBackstab === true,
            relentless: damageEvent.relentlessBackstab === true,
          });
        }
      }

      // Trigger damage effects
      this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      this.maybeTriggerFrostpath(damageType, source, target);
      this.maybeTriggerSolarRecharge(damageType, source, target);
      this.maybeTriggerArcticShards(damageType, source, target);

      const enemyForVenom = target.getComponent(Enemy);
      if (
        enemyForVenom &&
        damageType === 'barrage' &&
        damageEvent.wyvernBiteConcentratedVenom === true
      ) {
        enemyForVenom.applyConcentratedVenomStack(currentTime);
      }

      const enemyGlacialBite = target.getComponent(Enemy);
      if (
        enemyGlacialBite &&
        damageType === 'barrage' &&
        damageEvent.glacialBiteChill === true &&
        damageDealt &&
        !this.onEnemyDamageCallback
      ) {
        const t = target.getComponent(Transform);
        if (t) {
          enemyGlacialBite.applyBlizzardChillStack(
            currentTime,
            target.id.toString(),
            t.getWorldPosition().clone(),
            BLIZZARD_FREEZE_DURATION_SEC,
            target.userData?.coopServerEnemyType as string | undefined,
          );
        }
      }

      const enemyTempestArctic = target.getComponent(Enemy);
      if (
        enemyTempestArctic &&
        damageType === 'projectile' &&
        damageEvent.tempestBurstArcticChill === true &&
        damageDealt &&
        !this.onEnemyDamageCallback
      ) {
        const t = target.getComponent(Transform);
        if (t) {
          enemyTempestArctic.applyBlizzardChillStack(
            currentTime,
            target.id.toString(),
            t.getWorldPosition().clone(),
            ARCTIC_CHILL_FREEZE_DURATION_SEC,
            target.userData?.coopServerEnemyType as string | undefined,
          );
        }
      }

      const enemyForEntanglement = target.getComponent(Enemy);
      if (
        enemyForEntanglement &&
        damageType === 'barrage' &&
        damageEvent.entanglementBarrage === true &&
        damageDealt &&
        !this.onEnemyDamageCallback
      ) {
        enemyForEntanglement.entangle(ENTANGLEMENT_DURATION_MS / 1000, currentTime);
        const t = target.getComponent(Transform);
        if (t) {
          addGlobalEntangledEnemy(target.id.toString(), t.getWorldPosition().clone(), ENTANGLEMENT_DURATION_MS);
        }
      }

      const enemyForBlizzard = target.getComponent(Enemy);
      if (
        enemyForBlizzard &&
        damageType === 'blizzard' &&
        damageDealt &&
        !this.onEnemyDamageCallback
      ) {
        const t = target.getComponent(Transform);
        if (t) {
          const freezeSec =
            damageEvent.blizzardArctic === true ? ARCTIC_CHILL_FREEZE_DURATION_SEC : undefined;
          enemyForBlizzard.applyBlizzardChillStack(
            currentTime,
            target.id.toString(),
            t.getWorldPosition().clone(),
            freezeSec,
            target.userData?.coopServerEnemyType as string | undefined,
          );
        }
      }
    } else if (actualDamage > 0 && health.isAegisInvulnerable()) {
      const transform = target.getComponent(Transform);
      if (transform) {
        const position = transform.getWorldPosition().clone();
        position.y -= 0.5;
        this.damageNumberManager.addDamageNumber(
          0,
          false,
          position,
          'aegis_blocked',
          true,
          undefined,
          undefined,
          'AEGIS'
        );
      }
      if (
        this.localPlayerEntityId !== null &&
        target.id === this.localPlayerEntityId &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new CustomEvent('aegis-block'));
      }
    }
  }

  private applyHealing(healEvent: HealEvent, currentTime: number): void {
    const { target, amount, source } = healEvent;
    
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return;

    // Apply healing
    const healingDone = health.heal(amount);
    
    if (healingDone) {
      this.totalHealingDone += amount;
      
      // Log healing for debugging
      const sourceName = source ? `Entity ${source.id}` : 'Unknown';
      const targetName = this.getEntityDisplayName(target);
      // console.log(`💚 ${sourceName} healed ${targetName} for ${amount} HP (${health.currentHealth}/${health.maxHealth} HP)`);

      // Trigger healing effects
      this.triggerHealingEffects(target, amount, source);
    }
  }

  private handleEntityDeath(entity: Entity, killer?: Entity, currentTime?: number): void {
    const enemy = entity.getComponent(Enemy);

    if (enemy) {
      enemy.die(currentTime || Date.now() / 1000);
      this.enemiesKilled++;

      // console.log(`💀 ${enemy.getDisplayName()} has been defeated!`);

      // Experience awards are now handled by the backend server

      // Trigger death effects
      this.triggerDeathEffects(entity, killer);
    }

    this.deadEntities.push(entity);
  }

  private handleDeathAndRespawn(entities: Entity[], currentTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(Health);
      const enemy = entity.getComponent(Enemy);
      
      if (!health || !enemy) continue;

      // Handle respawn for enemies
      if (enemy.isDead && enemy.canRespawnNow(currentTime)) {
        this.respawnEnemy(entity, enemy, health);
      }
    }
  }

  private respawnEnemy(entity: Entity, enemy: Enemy, health: Health): void {
    // Respawn the enemy
    enemy.respawn();
    health.revive();
    
    // console.log(`🔄 ${enemy.getDisplayName()} has respawned!`);
    
    // Trigger respawn effects
    this.triggerRespawnEffects(entity);
  }

  private triggerDamageEffects(target: Entity, damage: number, source?: Entity, damageType?: string, isCritical?: boolean): void {
    // This can be extended to trigger particle effects, screen shake, etc.
    // For now, we'll just handle basic effects
    
    const transform = target.getComponent(Transform);
    if (transform) {
      // Could trigger damage number popup, blood effects, etc.
      // For now, just log the position where damage occurred
      const critText = isCritical ? ' (CRITICAL)' : '';
      // console.log(`🎯 Damage effect${critText} at position:`, transform.position);
    }

    // Handle special projectile effects
    if (damageType === 'projectile' && source) {
      const sourceRenderer = source.getComponent(Renderer);
      if (sourceRenderer?.mesh?.userData?.isBarrageArrow) {
        // console.log(`🏹 Barrage arrow hit detected, applying slow effect to target ${target.id}`);
        const targetMovement = target.getComponent(Movement);
        if (targetMovement) {
          targetMovement.slow(5000, 0.5); // 5 seconds, 50% speed
          // console.log(`🐌 Applied 50% slow for 5 seconds to target ${target.id}`);
        }
        
        // Send slow status to server for multiplayer enemies (co-op mode)
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current && target.userData?.serverEnemyId) {
          const controlSystem = controlSystemRef.current;
          const applyStatusCallback = controlSystem.onApplyEnemyStatusEffectCallback;
          if (applyStatusCallback) {
            applyStatusCallback(target.userData.serverEnemyId, 'slow', 5000); // 5 seconds in ms
          }
        }
      }
    }
  }

  private triggerHealingEffects(target: Entity, amount: number, source?: Entity): void {
    const transform = target.getComponent(Transform);
    if (transform && amount > 0) {
      const healPos = transform.getWorldPosition().clone();
      healPos.y += 1.5;
      this.damageNumberManager.addDamageNumber(amount, false, healPos, 'healing');
    }
  }

  private triggerDeathEffects(entity: Entity, killer?: Entity): void {
    // This can be extended to trigger death animations, loot drops, etc.
    const transform = entity.getComponent(Transform);
    if (transform) {
      // console.log(`💀 Death effect at position:`, transform.position);
    }
  }

  private triggerRespawnEffects(entity: Entity): void {
    // This can be extended to trigger respawn animations, effects, etc.
    const transform = entity.getComponent(Transform);
    if (transform) {
      // console.log(`🌟 Respawn effect at position:`, transform.position);
    }
  }

  private awardExperience(entity: Entity, experience: number): void {
    // This would integrate with a progression system
    // console.log(`⭐ Entity ${entity.id} gained ${experience} experience!`);
  }

  private getEntityDisplayName(entity: Entity): string {
    const enemy = entity.getComponent(Enemy);
    if (enemy) {
      return enemy.getDisplayName();
    }

    // Could check for other components that provide names
    return `Entity ${entity.id}`;
  }

  // Public API for other systems to queue damage and healing
  public queueDamage(
    target: Entity,
    damage: number,
    source?: Entity,
    damageType?: string,
    sourcePlayerId?: string,
    isCritical?: boolean,
    infestedStrike?: boolean,
    staggerToAdd?: number,
    infestedSmite?: boolean,
    infernalSmite?: boolean,
    crossentropyInferno?: boolean,
    reaperCrossentropy?: boolean,
    infestedCombo?: boolean,
    wyvernBiteConcentratedVenom?: boolean,
    wyvernStingVenomZombie?: boolean,
    wyvernBiteConcentratedDoT?: boolean,
    entropicWrathful?: boolean,
    entropicInfesting?: boolean,
    icebeamWrathful?: boolean,
    icebeamInfested?: boolean,
    sabreWrathfulSwipes?: boolean,
    sabreInfestingSwipes?: boolean,
    infestedBackstab?: boolean,
    infestedFlourish?: boolean,
    killstreakBackstab?: boolean,
    relentlessBackstab?: boolean,
    crossentropyPlague?: boolean,
    glacialBiteChill?: boolean,
    glacialTalons?: boolean,
    crossentropyMeteor?: boolean,
    entanglementBarrage?: boolean,
    cloudkillProc?: boolean,
    wyvernTalonsZombie?: boolean,
    tempestBurstArcticChill?: boolean,
    tempestBurstWyvernZombie?: boolean,
  ): void {
    this.damageQueue.push({
      target,
      damage,
      source,
      damageType,
      timestamp: Date.now() / 1000,
      sourcePlayerId,
      isCritical,
      infestedStrike,
      staggerToAdd,
      infestedSmite,
      infernalSmite,
      crossentropyInferno,
      reaperCrossentropy,
      infestedCombo,
      wyvernBiteConcentratedVenom,
      wyvernStingVenomZombie,
      wyvernBiteConcentratedDoT,
      entropicWrathful,
      entropicInfesting,
      icebeamWrathful,
      icebeamInfested,
      sabreWrathfulSwipes,
      sabreInfestingSwipes,
      infestedBackstab,
      infestedFlourish,
      killstreakBackstab,
      relentlessBackstab,
      crossentropyPlague,
      glacialBiteChill,
      glacialTalons,
      crossentropyMeteor,
      entanglementBarrage,
      cloudkillProc,
      wyvernTalonsZombie,
      tempestBurstArcticChill,
      tempestBurstWyvernZombie,
    });
  }

  /** Concentrated arctic / glacial ground blizzard ticks (co-op: `arcticBlizzard` hitMeta). */
  public queueDamageWithBlizzardArctic(
    target: Entity,
    damage: number,
    source?: Entity,
    sourcePlayerId?: string,
  ): void {
    this.damageQueue.push({
      target,
      damage,
      source,
      damageType: 'blizzard',
      timestamp: Date.now() / 1000,
      sourcePlayerId,
      blizzardArctic: true,
    });
  }

  public queueHealing(
    target: Entity, 
    amount: number, 
    source?: Entity
  ): void {
    this.healQueue.push({
      target,
      amount,
      source,
      timestamp: Date.now() / 1000
    });
  }

  // Immediate damage/healing (bypasses queue)
  public dealDamageImmediate(
    target: Entity,
    damage: number,
    source?: Entity,
    damageType?: string,
    sourcePlayerId?: string
  ): boolean {
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return false;

    // Calculate actual damage with critical hit mechanics
    const currentWeapon = this.getCurrentWeapon();
    const immediateCritOpts: DamageCalcOptions | undefined =
      damageType === 'fan_of_knives'
        ? undefined
        : damageType === 'barrage'
        ? this.getBarrageCritCalcOpts(damageType)
        : damageType === 'projectile'
          ? this.getWrathfulShotsPerfectCritOptsFromSource(source)
          : undefined;
    const damageResult: DamageResult =
      damageType === 'fan_of_knives'
        ? { damage, isCritical: false }
        : calculateDamage(damage, currentWeapon, immediateCritOpts);
    const actualDamage = damageResult.damage;

    const currentTime = Date.now() / 1000;
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;
      if (target.getComponent(Enemy)) {
        this.maybeApplyBloodleechCriticalHeal(damageResult, source);
      }

      // Create damage number at target position
      const transform = target.getComponent(Transform);
      if (transform) {
        const position = transform.getWorldPosition();
        // Offset slightly above the target
        position.y += 1.5;
        const dualCoilSlot = this.applyDualCoilDamageNumberLateral(position, source);
        this.damageNumberManager.addDamageNumber(
          actualDamage,
          damageResult.isCritical,
          position,
          damageType,
          undefined,
          damageType === 'barrage' || damageType === 'entropic' ? target.id : undefined,
          dualCoilSlot
        );
      }

      if (health.isDead) {
        // Only handle death locally if this is not an enemy in multiplayer mode
        // Enemy deaths in multiplayer/PVP mode are handled by the server
        const enemy = target.getComponent(Enemy);
        const shouldHandleDeathLocally = !enemy || !this.onEnemyDamageCallback;
          
          if (shouldHandleDeathLocally) {
            this.handleEntityDeath(target, source, currentTime);
          }
        }

        this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      }

      return damageDealt;
    }

  public healImmediate(
    target: Entity, 
    amount: number, 
    source?: Entity
  ): boolean {
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return false;

    const healingDone = health.heal(amount);
    
    if (healingDone) {
      this.totalHealingDone += amount;
      this.triggerHealingEffects(target, amount, source);
    }
    
    return healingDone;
  }

  // Utility methods
  public isEntityDead(entity: Entity): boolean {
    const health = entity.getComponent(Health);
    return health ? health.isDead : false;
  }

  public getEntityHealthRatio(entity: Entity): number {
    const health = entity.getComponent(Health);
    return health ? health.getHealthRatio() : 0;
  }

  public canEntityTakeDamage(entity: Entity): boolean {
    const health = entity.getComponent(Health);
    return health ? (!health.isDead && !health.isInvulnerable) : false;
  }

  // Statistics and debugging
  public getCombatStats(): {
    totalDamageDealt: number;
    totalHealingDone: number;
    enemiesKilled: number;
    queuedDamageEvents: number;
    queuedHealEvents: number;
  } {
    return {
      totalDamageDealt: this.totalDamageDealt,
      totalHealingDone: this.totalHealingDone,
      enemiesKilled: this.enemiesKilled,
      queuedDamageEvents: this.damageQueue.length,
      queuedHealEvents: this.healQueue.length
    };
  }

  public resetStats(): void {
    this.totalDamageDealt = 0;
    this.totalHealingDone = 0;
    this.enemiesKilled = 0;
  }

  // Damage numbers management
  public getDamageNumbers() {
    return this.damageNumberManager.getDamageNumbers();
  }

  public getImpactEffects(): ImpactEffectEvent[] {
    return this.impactEffectManager.getImpacts();
  }

  public clearConsumedImpacts(): void {
    this.impactEffectManager.clearConsumed();
  }

  public addCrescentSlashEffect(position: Vector3, direction: Vector3): void {
    this.impactEffectManager.addImpact('crescent-slash-effect', position, direction);
  }

  public addMortalStrikeEffect(
    position: Vector3,
    direction: Vector3,
    theme: string,
  ): void {
    this.impactEffectManager.addImpact('mortal-strike-effect', position, direction, { colorVariant: theme });
  }

  public addPsionicBladeSliceEffect(
    enemyEntityId: string,
    direction: Vector3,
    bladeSide: 'left' | 'right',
  ): void {
    this.impactEffectManager.addImpact(
      'psionic-blade-slice',
      new Vector3(),
      direction,
      { enemyEntityId, bladeSide },
    );
  }

  public removeDamageNumber(id: string): void {
    this.damageNumberManager.removeDamageNumber(id);
  }

  public getDamageNumberManager() {
    return this.damageNumberManager;
  }

  public onDisable(): void {
    this.damageQueue.length = 0;
    this.healQueue.length = 0;
    this.deadEntities.length = 0;
    this.damageNumberManager.clear();
    this.resetStats();
  }

  private synchronizeEnemyDebuffsWithMovement(entity: Entity, enemy: Enemy): void {
    const movement = entity.getComponent(Movement);
    if (!movement) return;

    let speedMultiplier = 1.0;
    const nowSec = Date.now() / 1000;

    if (enemy.isCorrupted) {
      const elapsed = nowSec - enemy.corruptedStartTime;
      const currentSlowPercent = Math.max(
        0,
        enemy.corruptedInitialSlowPercent - elapsed * enemy.corruptedRecoveryRate,
      );
      speedMultiplier *= 1 - currentSlowPercent;
    }

    if (
      enemy.chillStacks > 0 &&
      nowSec < enemy.chillExpiresAtSec &&
      !enemy.isFrozen
    ) {
      speedMultiplier *= 1 - CHILL_SLOW_PER_STACK * Math.min(4, enemy.chillStacks);
    }

    if (Math.abs(movement.movementSpeedMultiplier - speedMultiplier) > 0.01) {
      movement.movementSpeedMultiplier = speedMultiplier;
    }
  }

  /** Frostpath talent: Entropic Bolt hit on PvE enemy — delegate to ControlSystem (routed + local apply paths). */
  private maybeTriggerFrostpath(
    damageType: string | undefined,
    source: Entity | undefined,
    target: Entity,
  ): void {
    if (damageType !== 'entropic' || !source) return;
    if (!target.getComponent(Enemy)) return;
    const proj = source.getComponent(Projectile);
    if (!proj) return;
    if (this.localPlayerEntityId === null || proj.owner !== this.localPlayerEntityId) return;
    const cs = (window as any).controlSystemRef?.current;
    if (cs?.tryProcFrostpathOnEntropicHit) {
      cs.tryProcFrostpathOnEntropicHit(target, source);
    }
  }

  /** Solar Recharge talent: Entropic Bolt hit on PvE enemy — delegate to ControlSystem (routed + local apply paths). */
  private maybeTriggerSolarRecharge(
    damageType: string | undefined,
    source: Entity | undefined,
    target: Entity,
  ): void {
    if (damageType !== 'entropic' || !source) return;
    if (!target.getComponent(Enemy)) return;
    const proj = source.getComponent(Projectile);
    if (!proj) return;
    if (this.localPlayerEntityId === null || proj.owner !== this.localPlayerEntityId) return;
    const cs = (window as any).controlSystemRef?.current;
    if (cs?.tryProcSolarRechargeOnEntropicHit) {
      cs.tryProcSolarRechargeOnEntropicHit(target, source);
    }
  }

  /** Arctic Shards room boon: 15% on entropic hit to spawn concentrated blizzard. */
  private maybeTriggerArcticShards(
    damageType: string | undefined,
    source: Entity | undefined,
    target: Entity,
  ): void {
    if (damageType !== 'entropic' || !source) return;
    if (!target.getComponent(Enemy)) return;
    const proj = source.getComponent(Projectile);
    if (!proj || proj.entropicBoltTalent !== 'arctic') return;
    if (this.localPlayerEntityId === null || proj.owner !== this.localPlayerEntityId) return;
    const cs = (window as any).controlSystemRef?.current;
    if (cs?.tryProcArcticShardsOnEntropicHit) {
      cs.tryProcArcticShardsOnEntropicHit(target, source);
    }
  }

  // Set the local player entity ID for damage number filtering
  public setLocalPlayerEntityId(entityId: number): void {
    this.localPlayerEntityId = entityId;
    // Reset shield audio state so the new entity starts fresh
    this.localPlayerShieldPrev = 0;
    this.localPlayerRegenPrev = false;
    this.localPlayerShieldAudioInitialized = false;
    (window as any).audioSystem?.setShieldRegenPlaying?.(false);
  }

  private updateLocalPlayerShieldAudio(shield: Shield, deltaTime: number): void {
    if (this.localPlayerShieldAudioInitialized) {
      // Shield just broke (damage reduced currentShield to 0 since last frame)
      if (this.localPlayerShieldPrev > 0 && shield.currentShield <= 0) {
        (window as any).audioSystem?.playShieldBreakSound?.();
      }

      // Regen was interrupted by damage between frames (absorbDamage sets isRegenerating false)
      if (this.localPlayerRegenPrev && !shield.isRegenerating) {
        (window as any).audioSystem?.setShieldRegenPlaying?.(false);
      }
    }

    const regenBeforeUpdate = shield.isRegenerating;
    shield.update(deltaTime);

    // Regen started this frame (regenDelay elapsed)
    if (!regenBeforeUpdate && shield.isRegenerating) {
      (window as any).audioSystem?.setShieldRegenPlaying?.(true);
    }
    // Regen ended this frame (shield refilled to max)
    if (regenBeforeUpdate && !shield.isRegenerating) {
      (window as any).audioSystem?.setShieldRegenPlaying?.(false);
    }

    this.localPlayerShieldPrev = shield.currentShield;
    this.localPlayerRegenPrev = shield.isRegenerating;
    this.localPlayerShieldAudioInitialized = true;
  }
}
