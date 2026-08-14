'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout, getDefaultLoadout } from '@/utils/weaponAbilities';
import { TalentLoadout, createDefaultTalentLoadout, getCoopZombieRoomBoonsPayload, getCoopStaggerRoomBoonsPayload, getCoopAlliedKnightBoonsPayload, getCoopRedRoomBoonsPayload, getEffectiveIntellectWithTalentBonuses } from '@/utils/talents';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import { StatSystem, StatPointData, StatKey, PlayerStats } from '@/utils/StatSystem';
import { getRuneCountForWeapon } from '@/utils/runeCount';
import type { ItemRarity } from '@/utils/itemRarity';
import { ITEM_RARITY_RANK, isItemRarity } from '@/utils/itemRarity';
import { isUniqueDreamLayerItem, PERSEPHONE } from '@/utils/dreamLayerItems';
import {
  isUpgradeableBossRelic,
  resolveBossRelicPickup,
} from '@/utils/bossRelicItems';
import { Vector3 } from '@/utils/three-exports';
import { applyEnemyMoveBatch, type EnemyLiveTransform } from '@/utils/enemyLiveTransform';
import { applyPlayerMove, type PlayerLiveTransform } from '@/utils/playerLiveTransform';
import { parseCoopAllyKind, parseCoopAllyOffer, type CoopAllyKind } from '@/utils/coopAllyTargeting';
import { parseFaeBeastCompanionKind, type FaeBeastCompanionKind } from '@/utils/faeBeastCompanion';

import { patchEnemyRef, patchPlayerRef } from '@/utils/multiplayerRefPatch';
import { buildMushroomInstances, getMushroomColliderCenter } from '@/utils/mushroomLayout';
import { clearKnightBlock } from '@/utils/knightBlockState';
import { installWebGlDiagnostics, recordMultiplayerDisconnect } from '@/utils/webglDiagnostics';
import { type Archetype, ARCHETYPE_NONE, ARCHETYPE_ROGUE, normalizeArchetype } from '@/utils/archetypes';
import {
  type WeaponAspect,
  type WeaponAspectByWeapon,
  ASPECT_LEGIONNAIRE,
  defaultWeaponAspect,
  normalizeWeaponAspect,
} from '@/utils/weaponAspects';
import { cancelKnightStyleMiss, playKnightStyleHit } from '@/utils/knightStyleMeleeSound';
import { playVengefulSpiritHitSound } from '@/utils/beastAudioSounds';

export type CoopRoomKind = 'red' | 'blue' | 'green' | 'purple' | 'stat' | 'trial' | 'merchant' | 'boss' | 'intro' | 'deep_sanctum' | 'sunken_temple' | 'eternity_palace' | 'eden' | 'false_eden' | 'delirium_gate' | 'erebus_gate' | 'dream_layer' | 'fae_realm' | 'eden_finale';
export type DeliriumStructureState = {
  hp: number;
  maxHp: number;
  position: { x: number; z: number };
  destroyed: boolean;
};
export type DeepSanctumRewardKind = 'gold' | 'stat' | 'talent';
export type CoopTerrainTheme = 'purple' | 'blue' | 'green';

export type BroadcastPlayerAttackAnimationData = {
  comboStep?: 1 | 2 | 3;
  chargeProgress?: number;
  isSpinning?: boolean;
  isPerfectShot?: boolean;
  damage?: number;
  targetId?: number;
  hitPosition?: { x: number; y: number; z: number };
  isSwordCharging?: boolean;
  storedCharge?: boolean;
  highCaliberPerfectBeam?: boolean;
  projectileConfig?: Record<string, unknown>;
};

export interface PlayerMovementDirection {
  x: number;
  y: number;
  z: number;
  inputStrength?: number;
  isGrounded?: boolean;
  isDashing?: boolean;
  dashDirection?: { x: number; y: number; z: number };
  isAttackSlowed?: boolean;
  isIcebeaming?: boolean;
  isPrimeMateriaActive?: boolean;
  isIncinerationCharging?: boolean;
  isIncinerationArmed?: boolean;
  isLocustChanneling?: boolean;
  isSprinting?: boolean;
}

export interface Player {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weapon: WeaponType;
  subclass?: WeaponSubclass;
  /** Co-op weapon aspect — throne visual/gameplay variant. */
  weaponAspect?: WeaponAspect;
  /** Co-op archetype — determines Shift behavior (`NONE` until throne selection). */
  archetype?: Archetype;
  health: number;
  maxHealth: number;
  shield?: number;
  maxShield?: number;
  energy?: number;
  maxEnergy?: number;
  movementDirection?: PlayerMovementDirection;
  // Co-op Experience system
  experience?: number;
  level?: number;
  // Essence currency system
  essence?: number;
  gold?: number;
  flow?: number;
  fate?: number;
  // Purchased items
  purchasedItems?: string[];
  // Venom status effects
  isVenomed?: boolean;
  venomedUntil?: number;
  // Character stat system
  stats?: PlayerStats;
  /** Eternity Palace III Fae pet companion upgrade id. */
  coopPetCompanionUpgrade?: string | null;
}

/** Optional metadata for co-op `enemy-damage` (Wraith Strike + Infested Strike spawn rules). */
export interface EnemyDamageMeta {
  damageType?: string;
  infestedStrike?: boolean;
  /** Infested Smite talent — zombies on kill (server), with `damageType` `smite`. */
  infestedSmite?: boolean;
  /** Infested Combo talent — zombies on kill (server), with `damageType` `runeblade_combo`. */
  infestedCombo?: boolean;
  /** Infernal Smite talent — server schedules Ignite DoT after smite hit. */
  infernalSmite?: boolean;
  /** INFERNO talent (Crossentropy) — server schedules Ignite DoT after crossentropy hit. */
  infernoCrossentropy?: boolean;
  /** Reaper talent (Crossentropy) — server counts kills for Reaper stack. */
  reaperCrossentropy?: boolean;
  /** PLAGUE Crossentropy — server zombies on kill; client venom FX. */
  crossentropyPlague?: boolean;
  /** METEOR Crossentropy — server rolls meteor proc and schedules delayed AoE impact. */
  crossentropyMeteor?: boolean;
  /** Cloudkill — bow LMB primary hit requests server-side poison arrow volley. */
  cloudkill?: boolean;
  /** Staggering Strike (`wraith_strike`), Runeblade combo (`runeblade_combo`), Sabres (`sabre_left` / `sabre_right`), Staggering Smite (`smite` with `staggerToAdd`), Stagger Shot (`projectile` with `staggerToAdd`), TEMPEST Crossentropy (`crossentropy` with `staggerToAdd`): server accumulates stagger. */
  staggerToAdd?: number;
  /** Wyvern Bite — Barrage hit applies Concentrated Venom stack on server. */
  wyvernBiteVenom?: boolean;
  /** Wyvern Sting — Cobra venom DoT kill may raise infested zombie. */
  wyvernStingVenomZombie?: boolean;
  /** Wyvern Talons — Reaping Talons / detonation kill may raise infested zombie. */
  wyvernTalonsZombie?: boolean;
  /** Wyvern Bite Concentrated Venom DoT tick — kill may raise infested zombie. */
  wyvernBiteConcentratedDoT?: boolean;
  /** Scythe Wrathful Entropic bolt — coop routing (crit computed client-side). */
  entropicWrathful?: boolean;
  /** Scythe Infesting Entropic bolt — zombie on kill (server). */
  entropicInfesting?: boolean;
  /** Scythe Wrathful Entropic beam. */
  icebeamWrathful?: boolean;
  /** Scythe Infesting Entropic beam — zombie + heal on kill (server). */
  icebeamInfested?: boolean;
  /** Sabres Backstab — server zombie on kill routing. */
  infestedBackstab?: boolean;
  /** Sabres LMB — Infesting Swipes talent; server zombie on kill. */
  sabreInfestingSwipes?: boolean;
  /** Sabres Flourish — Infested Flourish talent; server zombie on kill (`damageType` `sunder`). */
  infestedFlourish?: boolean;
  /** Sabres Killstreak — stack increment on Backstab kill (server). */
  killstreakBackstab?: boolean;
  /** Sabres Relentless — heal + cooldown RPC on Backstab kill (server). */
  relentlessBackstab?: boolean;
  /** Arctic / Glacial ground blizzard tick — 4s freeze at max chill (server uses standard blizzard chill). */
  arcticBlizzard?: boolean;
  /** Frost totem hit — chill stack routing (server). */
  frostTotemChill?: boolean;
  /** REBUKE room boon — server schedules Ignite DoT after rebuke hit. */
  rebukeRoom?: boolean;
  /** INFERNAL DASH room boon — server schedules Ignite DoT after dash hit. */
  infernalDashRoom?: boolean;
  /** Glacial Bite — Barrage chill stacks; 5 stacks → 6s freeze on server. */
  glacialBiteChill?: boolean;
  /** Glacial Talons — Reaping Talons double damage vs frozen on server. */
  glacialTalons?: boolean;
  /** Entanglement — Barrage hit roots and squeezes target on server. */
  entanglementBarrage?: boolean;
  /** Sniper Hunter's Mark — Barrage hit marks target on server. */
  huntersMark?: boolean;
  /** Bow Perfect Shot — Sniper may detonate Hunter's Mark on server. */
  perfectShot?: boolean;
  /** Druid Rejuvenating Shot — enemy hit applies Entanglement on server. */
  rejuvenatingShotEntangle?: boolean;
  /** Necromancer Mantra totem — pulse applies Entanglement on server. */
  necromancerTotemEntangle?: boolean;
  /** Tempest Rounds burst — Arctic Sting chill on hit. */
  tempestBurstArcticChill?: boolean;
  /** Tempest Rounds burst — Wyvern Sting zombie on kill. */
  tempestBurstWyvernZombie?: boolean;
  /** Explosive Talons end-of-range detonation (server validates AoE). */
  explosiveTalonsDetonation?: boolean;
  /** Royal Guard Tempest Sweep — charged R Ignite (80% over 4s). */
  tempestSweepIgnite?: boolean;
  /** Archmage aspect — every 3rd Entropic Bolt Ignite (200% over 4s). */
  archmageEntropicIgnite?: boolean;
}

/** Server enemy; `type` includes e.g. `knight`, `training-dummy` (throne prep). */
export interface Enemy {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  /** Co-op throne prep: which model to show for `training-dummy` */
  dummyVisual?: 'knight';
  soulType?: 'green' | 'red' | 'blue' | 'purple' | 'yellow' | 'orange';
  campType?: string;
  campIndex?: number;
  /** INFESTED STRIKE ally zombie */
  ownerPlayerId?: string;
  /** Persistent co-op allied unit, currently the allied knight tank. */
  alliedUnit?: boolean;
  combatInitiated?: boolean;
  /** Allied knight spell resource; true means the visible orbital is charged. */
  alliedOrbSlots?: boolean[];
  alliedOrbRecoverAt?: number[];
  alliedSmiteCooldownUntil?: number;
  alliedGreaterHealCooldownUntil?: number;
  /** Allied knight Abyssal Initiate boon — use fast walk animation when true. */
  abyssalBoonApplied?: boolean;
  /** Beastmaster / fae beast companion locomotion (server-authoritative). */
  tigerLocomotion?: 'walk' | 'run';
  /** Terrorhawk combat phase (server-authoritative fly/dive/melee loop). */
  terrorhawkPhase?: 'takeoff' | 'hover' | 'approach' | 'dive' | 'land' | 'ground_melee';
  /** Destiny dragon combat phase (server-authoritative ground/fly loop). */
  destinyPhase?: 'ground' | 'takeoff' | 'fly_idle' | 'fly_approach' | 'fly_attack' | 'fly_return' | 'land';
  /** Fae beast walk-in phase (`entering` until meet, then `active`). */
  beastCompanionPhase?: 'entering' | 'active';
  beastCompanionKind?: FaeBeastCompanionKind;
  companionSlot?: 'beastmaster' | 'fae' | 'fae_pack';
  /** Wolf pack howl intro window (server-authoritative ms timestamps). */
  howlStartsAt?: number;
  howlEndsAt?: number;
  expireAt?: number;
  /** Juggernaut Strain coop room boon — larger client model when `juggernaut`. */
  zombieVariant?: 'standard' | 'juggernaut';
  /** Staggering Strike buildup (0–100), server-authoritative. */
  staggerBuildup?: number;
  /** Concentrated Venom stacks (server-authoritative; drives VenomEffect VFX). */
  concentratedVenomStacks?: number;
  /** Concentrated Venom expiry (ms since epoch). */
  concentratedVenomExpireAt?: number;
  /** Client-side stun window expiry (ms since epoch) from `enemy-status-effect`. */
  stunnedUntilMs?: number;
  /** Client-side slow window expiry (ms since epoch) from `enemy-status-effect`. */
  slowedUntilMs?: number;
  /** Boss3 Weaver Nexus summoned ghoul — larger client model. */
  visualScale?: number;
  /** Per-ghoul leap landing damage override (Boss3 summons deal 2×). */
  leapDamage?: number;
  /** Titan Bladestorm — active at ≤40% HP until death. */
  bladestormActive?: boolean;
  bladestormStartTime?: number;
  /** Alternate Boss1 encounter: elite knight (Death Grasp pull-immune). */
  isBoss1EliteKnight?: boolean;
}

export interface ConfirmedEnemyDamageEvent {
  damageEventId: number;
  enemyId: string;
  newHealth: number;
  maxHealth: number;
  damage: number;
  fromPlayerId?: string | null;
  wasKilled?: boolean;
  timestamp: number;
  damageType?: string;
  crossentropyMeteorDamage?: boolean;
  cloudkillDamage?: boolean;
  position?: { x: number; y: number; z: number };
}

export type ConfirmedEnemyDamageListener = (event: ConfirmedEnemyDamageEvent) => void;

export interface DroppedItem {
  id: string;
  type: string;
  stat?: StatKey;
  label: string;
  category?: 'amulet' | 'boss_drop' | 'ward';
  position: { x: number; y: number; z: number };
  droppedAt: number;
  /** Boss drops: flat stat points granted on pickup */
  statBonus?: number;
  rarity?: ItemRarity;
  /** Warding pendant: enemy type banned for the rest of the run */
  bannedEnemyType?: string;
  /** Optional icon path for ward/pendant variants */
  iconPath?: string;
}

export interface InventoryItem {
  id: string;
  type: string;
  stat?: StatKey;
  label: string;
  category?: 'amulet' | 'boss_drop' | 'ward';
  pickedUpAt: number;
  statBonus?: number;
  rarity?: ItemRarity;
  bannedEnemyType?: string;
  /** Optional icon path for ward/pendant variants */
  iconPath?: string;
}

export interface DreamLayerStockItem {
  id: string;
  kind: 'warding_pendant' | 'exodia' | 'legendary_a' | 'legendary_b' | 'ring';
  cost: number;
  sold?: boolean;
  label?: string;
  description?: string;
  item?: Omit<DroppedItem, 'position' | 'droppedAt'>;
}

export interface DreamLayerPurchaseState {
  healPurchasedThisVisit: boolean;
  wardingPurchasedThisVisit: boolean;
  legendaryAPurchasedThisVisit: boolean;
  legendaryBPurchasedThisVisit: boolean;
  ringPurchasedThisVisit: boolean;
}

export interface MerchantStockItem {
  id: string;
  kind: 'boss_drop' | 'dash_charge' | 'weapon_talent' | 'oxygen' | 'warpdrive';
  cost: number;
  sold?: boolean;
  label?: string;
  description?: string;
  /** When set, this boss_drop occupies a sold-out dash/talent pedestal. */
  backfillSlot?: 'dash_charge' | 'weapon_talent';
  item?: Omit<DroppedItem, 'position' | 'droppedAt'> & Partial<Pick<DroppedItem, 'position' | 'droppedAt'>>;
}

export interface MerchantPurchaseState {
  dashChargePurchased: boolean;
  weaponTalentPurchases: number;
  oxygenPurchases: number;
  warpdrivePurchases: number;
  healPurchasedThisVisit: boolean;
  weaponTalentPurchasedThisVisit: boolean;
  utilityPurchasedThisVisit: boolean;
  backfillDashPurchasedThisVisit: boolean;
  backfillTalentPurchasedThisVisit: boolean;
}

export type MerchantPurchaseSuccessKind =
  | 'boss_drop'
  | 'dash_charge'
  | 'weapon_talent'
  | 'oxygen'
  | 'warpdrive'
  | 'heal';

export interface MerchantPurchaseSuccessPayload {
  stockId: string;
  kind?: MerchantPurchaseSuccessKind;
  cost: number;
  merchantPurchaseState?: MerchantPurchaseState;
  purchaseCount?: number;
  item?: DroppedItem;
  healingAmount?: number;
  timestamp?: number;
}

export interface DeepSanctumRewardClaimedPayload {
  rewardKind: DeepSanctumRewardKind;
  goldGranted: number;
  deepSanctumStatPoints: number;
  timestamp?: number;
}

export type BossSlainLabel = 'hate' | 'knights' | 'envy' | 'fear' | 'destiny' | 'trinity';

export interface BossDefeatedPayload {
  bossId?: string;
  killedBy?: string;
  slainLabel?: BossSlainLabel;
  timestamp?: number;
}

export interface BossItemPickupPayload {
  label: string;
  rarity?: ItemRarity;
}

export interface RunePickupPayload {
  stat: StatKey;
}

export interface GoldDrop {
  id: string;
  amount: number;
  pieceCount: number;
  position: { x: number; y: number; z: number };
  enemyType?: string | null;
  soulType?: string | null;
  droppedAt: number;
}


interface RoomPreview {
  roomId: string;
  exists: boolean;
  players: Player[];
  playerCount: number;
  maxPlayers: number;
  enemies: Enemy[];
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// Animation state type for better type safety
type PlayerAnimationState = {
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  swordComboStep?: 1 | 2 | 3;
  isSpinning?: boolean;
  isDeflecting?: boolean;
  isSwordCharging?: boolean;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isCrossentropyCharging?: boolean;
  crossentropyChargeProgress?: number;
  isSummonTotemCharging?: boolean;
  summonTotemChargeProgress?: number;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isWindShearing?: boolean;
  isWindShearCharging?: boolean;
  windShearChargeProgress?: number;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  isSundering?: boolean;
  isStealthing?: boolean;
  isInvisible?: boolean;
};

interface MultiplayerContextType {
  // Connection state
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;

  // Room state
  isInRoom: boolean;
  currentRoomId: string | null;
  players: Map<string, Player>;
  /** Bumps on infrequent roster meta changes (weapon swap, level-up, purchase) — not every XP tick. */
  playerRosterMetaRev: number;
  /** Always-current player metadata mirror (includes in-place position updates from movement ref). */
  playersRef: React.MutableRefObject<Map<string, Player>>;
  /** Server-authoritative player positions/rotations updated without React setState (~60 Hz). */
  playersTransformsRef: React.MutableRefObject<Map<string, PlayerLiveTransform>>;
  enemies: Map<string, Enemy>;
  /** Always-current enemy metadata mirror (includes in-place position updates from movement ref). */
  enemiesRef: React.MutableRefObject<Map<string, Enemy>>;
  /** Server-authoritative enemy positions/rotations updated without React setState (~30 Hz). */
  enemyTransformsRef: React.MutableRefObject<Map<string, EnemyLiveTransform>>;
  /** Lerped mesh Y rotation per enemy id (updated in renderers each frame). */
  enemyVisualRotationsRef: React.MutableRefObject<Map<string, number>>;
  killCount: number;
  skeletonKillCount: number;
  /** Co-op wave clear target — from server `skeleton-kill-count-updated` (`required`). */
  skeletonKillRequired: number;
  gameStarted: boolean;
  /** Co-op: false while the party is in the throne prep room (no enemies). True once the portal is used. */
  combatArenaActive: boolean;
  gameMode: 'multiplayer' | 'coop';
  /** Co-op session archetype for grass / border / camp lights (`['red'|'blue'|'green'|'purple']`). */
  campTypes: string[];

  /** Co-op throne: two distinct archetype keys shown on the paired portals until combat starts. */
  thronePortalOffer: string[];
  /** Co-op: south-rim only in throne; main-map portal rounds use `coopMainArenaPortalPhase`. */
  thronePortalLayout: 'rim' | 'center';
  /** Co-op: main combat map — two portals (wave 2), pre-boss Trial/Stat, reward/merchant pause, boss gate, or post-boss continuation. Null otherwise. */
  coopMainArenaPortalPhase:
    | 'pick_wave2'
    | 'pick_pre_boss'
    | 'pre_boss_reward'
    | 'pre_boss_merchant'
    | 'pick_boss'
    | 'pick_post_boss'
    | 'pick_sunken_entry'
    | 'pick_eternity_entry'
    | 'pick_eternity_late_entry'
    | 'pick_trinity_finale'
    | 'eden_exit'
    | null;
  /** Co-op: act terrain theme, independent from the selected room color/reward kind. */
  coopTerrainTheme: CoopTerrainTheme;
  /** Co-op: active destination/reward kind for environment and pedestal behavior. */
  coopCurrentRoomKind: CoopRoomKind | null;
  /** Co-op: completed room kind for the current pedestal reward. */
  coopClearedRoomKind: CoopRoomKind | null;
  /** Co-op: 1-based visit index for colored halls (roman numeral titles); null for special/boss rooms. */
  coopColoredRoomVisitIndex: number | null;
  /** Co-op: 1-based boss chamber visit index (CHAMBER OF DEATH I/II/III); null outside boss entry. */
  coopBossRoomVisitIndex: number | null;
  /**
   * Co-op: server-authoritative CustomSky preset index for the current room.
   * From `game-started`, `combat-arena-entered`, `coop-throne-sync`, `room-joined`.
   */
  coopSkyPresetIndex: number;
  /**
   * Co-op: server-authoritative StylizedGrass preset index for prep ThroneRoom.
   * From `game-started`, `coop-throne-sync`, `room-joined`.
   */
  coopGrassPresetIndex: number;
  /**
   * Co-op: stripped throne shell (boss fight + post-boss portal pause). False on prep throne and main castle map.
   * Authoritative from server (`room-joined`, `combat-arena-entered`, `coop-main-arena-intermission`).
   */
  coopBossThroneArena: boolean;
  /**
   * Co-op: which boss the throne fight is (boss tier 1, Archon tier 2, or Weaver Nexus tier 3).
   * From `room-joined`, `combat-arena-entered`, `coop-main-arena-intermission`, `game-started`.
   */
  coopThroneBossKind: 'boss' | 'boss2' | 'boss3' | 'destiny' | 'boss_all' | null;
  /**
   * Full-screen loading overlay for portal transitions (throne → arena, wave picks, boss).
   * Set true on `combat-arena-entered`; clear via `endCoopPortalTransition` after the scene settles.
   */
  coopTransitionOverlay: boolean;
  /** Increments on each local portal use (before server) or on `combat-arena-entered` for allies. */
  coopPortalBlinkSeq: number;
  /** Increments on each `combat-arena-entered` so the game scene can schedule overlay teardown. */
  coopCombatArenaEnterSeq: number;
  /** Increments on each `coop-main-arena-intermission` (wave clear; choice portals; server does not move players). */
  coopMainArenaIntermissionSeq: number;
  /** Increments on each `coop-intro-intermission` (intro room clear; void portal / fountain phase). */
  coopIntroIntermissionSeq: number;
  /** Increments on each `coop-sunken-intermission` (sunken temple room clear). */
  coopSunkenIntermissionSeq: number;
  /** Increments on each `coop-eternity-intermission` (eternity palace room clear). */
  coopEternityIntermissionSeq: number;
  /** Increments on each `coop-fae-realm-intermission` (fae realm room clear). */
  coopFaeRealmIntermissionSeq: number;
  /** Co-op intro: one-time 4-room sequence before the normal loop. */
  coopIntroPending: boolean;
  coopIntroActive: boolean;
  coopIntroRoomIndex: number;
  coopIntroPortalOpen: boolean;
  coopIntroFountainPhase: boolean;
  coopIntroFountainUsed: boolean;
  coopIntroAllyChoiceMade: boolean;
  /** Co-op Fae Realm: 3-room hex sequence between throne and Inner Sanctum. */
  coopFaeRealmPending: boolean;
  coopFaeRealmActive: boolean;
  coopFaeRealmRoomIndex: number;
  coopFaeRealmPortalOpen: boolean;
  coopFaeRealmBossKind: FaeBeastCompanionKind | null;
  coopFaeBeastCompanionGranted: boolean;
  coopFaeBeastCompanionKind: FaeBeastCompanionKind | null;
  /** Co-op sunken temple: one-time 4-room sequence after Boss 1. */
  coopSunkenActive: boolean;
  coopSunkenRoomIndex: number;
  coopSunkenPortalOpen: boolean;
  coopSunkenFountainPhase: boolean;
  coopSunkenFountainUsed: boolean;
  coopSunkenAllyChoiceMade: boolean;
  coopSunkenLootOffer: DreamLayerStockItem[];
  coopSunkenLootClaimedPlayerIds: string[];
  coopSunkenLootPhaseComplete: boolean;
  coopSunkenCompleted: boolean;
  /** Co-op eternity palace: one-time 3-room sequence after Boss 2. */
  coopEternityActive: boolean;
  coopEternityRoomIndex: number;
  coopEternityPortalOpen: boolean;
  coopEternityFountainPhase: boolean;
  coopEternityFountainUsed: boolean;
  coopEternityLootOffer: DreamLayerStockItem[];
  coopEternityLootClaimedPlayerIds: string[];
  coopEternityLootPhaseComplete: boolean;
  /** Local player's chosen Eternity III pet companion upgrade id. */
  coopPetCompanionUpgrade: string | null;
  coopEternityCompleted: boolean;
  /** Chosen co-op ally for the rest of the run after intro room IV. */
  coopAllyKind: CoopAllyKind;
  /** Three random ally kinds offered at intro room IV (server-authoritative). */
  coopAllyOffer: CoopAllyKind[];
  /** Main-loop center void portal offered alongside dual gateways. */
  coopVoidPortalOffered: boolean;
  coopDeepSanctumLevel: number;
  /** Pre-rolled reward kind after deep sanctum clear (pedestal claim). */
  deepSanctumRewardKind: DeepSanctumRewardKind | null;
  /** Increments on each `coop-deep-sanctum-intermission`. */
  coopDeepSanctumIntermissionSeq: number;
  /** True after drinking from the Eden fountain. */
  coopEdenFountainUsed: boolean;
  /** Intended destination shown on Eden exit portal. */
  coopEdenResumeKind: CoopRoomKind | null;
  /** Increments on each `coop-eden-intermission` (fountain used / exit portal revealed). */
  coopEdenIntermissionSeq: number;
  /** False Eden: all tentacle spines destroyed — fountain unlocked. */
  coopFalseEdenCleared: boolean;
  /** Delirium Gate structure HP snapshot. */
  deliriumStructure: DeliriumStructureState | null;
  coopDeliriumActive: boolean;
  coopDeliriumEventEnded: boolean;
  coopDeliriumSuccess: boolean;
  /** Erebus Gate surprise arena active. */
  coopErebusGateActive: boolean;
  /** Increments on each `boss-defeated` (co-op final boss; no `coop-main-arena-intermission` from the server). Used for BGM. */
  coopBossClearedBgmSeq: number;
  /**
   * Co-op: camp color of the wave just cleared (first wave, etc.); from `coop-main-arena-intermission`.
   * Cleared on `combat-arena-entered` so the next transition does not reuse a stale value.
   */
  coopClearedRoomColor: string | null;
  clearCoopClearedRoomColor: () => void;
  /** Co-op: server-assigned weapon when joining after the first portal (one-shot, consumed by page.tsx). */
  lateJoinCombatLoadout: { weapon: WeaponType; subclass: WeaponSubclass } | null;
  clearLateJoinCombatLoadout: () => void;
  /** Phase 1: hide the overlay and begin the fade animation (call after scene assets are ready). */
  hideCoopPortalTransition: () => void;
  /** Phase 2: tell the server this client has fully loaded (call after the fade completes). */
  confirmCoopPortalTransitionComplete: () => void;
  /** Reset outbound position emit throttle after an authoritative portal snap. */
  resetLocalPositionEmitThrottle: (
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
  ) => void;
  /** Synchronous mirror of `coopTransitionOverlay` — updated before React state in portal handlers. */
  coopTransitionOverlayRef: React.MutableRefObject<boolean>;
  /** Blocks local `player-update` emits from portal click until ECS snap completes. */
  coopPendingPortalSnapRef: React.MutableRefObject<boolean>;
  /** Monotonic token from server `combat-arena-entered`; used to reject stale authoritative position events. */
  coopRoomEntryTokenRef: React.MutableRefObject<number>;
  /** Timestamp (ms) of the latest `combat-arena-entered`; used for post-portal position grace window. */
  coopCombatArenaEnterAtRef: React.MutableRefObject<number>;
  /** @deprecated Use hideCoopPortalTransition + confirmCoopPortalTransitionComplete instead. */
  endCoopPortalTransition: () => void;

  // Chat state
  chatMessages: ChatMessage[];
  isChatOpen: boolean;

  // Weapon selection state
  selectedWeapons: {
    primary: WeaponType;
    secondary: WeaponType;
  };

  /** Co-op throne-room archetype selection (local player). */
  selectedArchetype: Archetype;

  /** Co-op throne-room weapon aspect selection (local player). */
  selectedWeaponAspect: WeaponAspect;

  /** Per-weapon last-chosen aspects for throne pedestal visuals. */
  weaponAspectByWeapon: WeaponAspectByWeapon;

  // Skill point system state
  skillPointData: SkillPointData;

  // Stat point system state
  statPointData: StatPointData;

  // Room preview
  currentPreview: RoomPreview | null;
  
  // Actions
  joinRoom: (
    roomId: string,
    playerName: string,
    weapon: WeaponType,
    subclass?: WeaponSubclass,
    gameMode?: 'multiplayer' | 'coop',
  ) => Promise<JoinRoomResult>;
  leaveRoom: () => void;
  previewRoom: (roomId: string) => void;
  clearPreview: () => void;
  startGame: () => void;
  /** Co-op: request transition from throne room to main combat arena (server-authoritative). */
  enterCombatArena: (chosenCampType?: string) => void;
  useCoopFountain: () => void;
  chooseCoopAlly: (allyKind: CoopAllyKind) => void;
  chooseSunkenTempleLoot: (stockId: string) => void;
  chooseEternityPalaceLoot: (stockId: string) => void;
  chooseEternityPetUpgrade: (upgradeId: string) => void;
  claimPreBossReward: () => void;
  claimDeepSanctumReward: () => void;
  finishPreBossMerchant: () => void;
  
  // Player actions
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: PlayerMovementDirection) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass, aspect?: WeaponAspect) => void;
  updatePlayerArchetype: (archetype: Archetype) => void;
  updatePlayerWeaponAspect: (aspect: WeaponAspect) => void;
  updatePlayerHealth: (health: number, maxHealth?: number) => void;
  broadcastPlayerAttack: (
    attackType: string,
    position: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    animationData?: BroadcastPlayerAttackAnimationData,
  ) => void;
  broadcastPlayerAbility: (abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string, extraData?: any) => void;
  broadcastPlayerEffect: (effect: any) => void;
  broadcastPlayerDamage: (targetPlayerId: string, damage: number, damageType?: string, isCritical?: boolean) => void;
  broadcastPlayerHealing: (healingAmount: number, healingType: string, position: { x: number; y: number; z: number }, targetPlayerId?: string) => void;
  broadcastAlliedHealing: (healingAmount: number, healingType: string, position: { x: number; y: number; z: number }, targetEnemyId: string) => void;
  broadcastPlayerAnimationState: (animationState: PlayerAnimationState) => void;
  broadcastPlayerDebuff: (targetPlayerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, effectData?: any) => void;
  broadcastPlayerStealth: (isInvisible: boolean, isStealthing?: boolean) => void;
  broadcastPlayerKnockback: (targetPlayerId: string, direction: { x: number; y: number; z: number }, distance: number, duration: number) => void;
  broadcastPlayerTornadoEffect: (playerId: string, position: { x: number; y: number; z: number }, duration: number) => void;
  broadcastPlayerDeathEffect: (playerId: string, position: { x: number; y: number; z: number }, isStarting: boolean) => void;
  
  // Enemy actions
  damageEnemy: (enemyId: string, damage: number, sourcePlayerId?: string, meta?: EnemyDamageMeta) => void;
  subscribeEnemyDamage: (listener: ConfirmedEnemyDamageListener) => () => void;
  /** Co-op: server clears Wyvern Bite CV + applies optional Cobra remainder as one combined hit. */
  detonateWyvernConcentratedVenom: (enemyId: string, cobraRemainingDamage?: number) => void;
  /** Co-op: Tyrant's Cloak counter-strike — server triggers stagger lightning bolt on attacker. */
  triggerTyrantsCloakStrike: (enemyId: string) => void;
  /** Co-op: Deathdealer third-hit proc — server triggers stagger lightning bolt on target. */
  triggerDeathdealerStaggerProc: (enemyId: string) => void;
  applyStatusEffect: (
    enemyId: string,
    effectType: string,
    duration: number,
    options?: { source?: 'titans_grip' },
  ) => void;

  /** Co-op: ring mushroom HP (server sync). */
  mushroomState: { health: number[]; maxHealth: number } | null;
  damageMushroom: (index: number, damage: number, sourcePlayerId?: string) => void;

  // Experience system actions
  updatePlayerExperience: (playerId: string, experience: number) => void;
  updatePlayerLevel: (playerId: string, level: number) => void;

  // Essence currency system actions
  updatePlayerEssence: (playerId: string, essence: number) => void;
  updatePlayerGold: (playerId: string, gold: number) => void;
  updatePlayerFlow: (playerId: string, flow: number) => void;
  updatePlayerFate: (playerId: string, fate: number) => void;

  // Shield actions
  updatePlayerShield: (playerId: string, shield: number, maxShield?: number) => void;

  // Energy actions
  updatePlayerEnergy: (playerId: string, energy: number, maxEnergy?: number) => void;

  // Weapon selection actions
  setSelectedWeapons: (weapons: { primary: WeaponType; secondary: WeaponType }) => void;
  setSelectedArchetype: (archetype: Archetype) => void;
  setSelectedWeaponAspect: (aspect: WeaponAspect) => void;
  /** Remember aspect for a weapon (pedestal memory) and set it as the active aspect. */
  rememberWeaponAspect: (weapon: WeaponType, aspect: WeaponAspect) => void;

  // Ability loadout
  abilityLoadout: AbilityLoadout | null;
  setAbilityLoadout: (loadout: AbilityLoadout | null) => void;

  talentLoadout: TalentLoadout;
  setTalentLoadout: (loadout: TalentLoadout | ((prev: TalentLoadout) => TalentLoadout)) => void;

  // Skill point system actions
  unlockAbility: (unlock: AbilityUnlock) => void;
  updateSkillPointsForLevel: (level: number) => void;
  grantSkillPoints: (amount: number) => void;

  // Stat point system actions
  allocateStatPoint: (stat: StatKey) => void;
  updateStatPointsForLevel: (level: number) => void;
  grantStatPoints: (amount: number) => void;

  // Item drop & inventory
  droppedItems: Map<string, DroppedItem>;
  goldDrops: Map<string, GoldDrop>;
  inventory: InventoryItem[];
  merchantInventory: MerchantStockItem[];
  merchantPurchaseState: MerchantPurchaseState;
  dreamLayerInventory: DreamLayerStockItem[];
  dreamLayerPurchaseState: DreamLayerPurchaseState;
  registerMerchantPurchaseSuccessHandler: (
    handler: (payload: MerchantPurchaseSuccessPayload) => void,
  ) => () => void;
  registerDeepSanctumRewardClaimedHandler: (
    handler: (payload: DeepSanctumRewardClaimedPayload) => void,
  ) => () => void;
  registerMerchantNpcGreetHandler: (
    handler: (payload: { kind: string }) => void,
  ) => () => void;
  registerPlayerGoldChangedHandler: (
    handler: (payload: { playerId: string; gold: number }) => void,
  ) => () => void;
  registerPlayerFlowChangedHandler: (
    handler: (payload: { playerId: string; flow: number }) => void,
  ) => () => void;
  registerPlayerFateChangedHandler: (
    handler: (payload: { playerId: string; fate: number }) => void,
  ) => () => void;
  registerBossDefeatedHandler: (
    handler: (payload: BossDefeatedPayload) => void,
  ) => () => void;
  registerBossItemPickupHandler: (
    handler: (payload: BossItemPickupPayload) => void,
  ) => () => void;
  registerRunePickupHandler: (
    handler: (payload: RunePickupPayload) => void,
  ) => () => void;
  pickupItem: (itemId: string) => void;
  pickupGoldDrop: (dropId: string) => void;

  // Merchant purchase actions
  purchaseItem: (itemId: string, cost: number, currency: 'essence' | 'gold') => boolean;
  purchaseMerchantItem: (stockId: string) => void;
  purchaseMerchantHeal: () => void;
  purchaseDreamLayerItem: (stockId: string) => void;
  purchaseDreamLayerHeal: () => void;

  // Chat actions
  sendChatMessage: (message: string) => void;
  openChat: () => void;
  closeChat: () => void;

  // Direct state setters for local visual updates (use with caution)
  setPlayers: React.Dispatch<React.SetStateAction<Map<string, Player>>>;
}

/** Stable actions + refs — does not re-render on HP/stagger/position ticks. */
export type MultiplayerActionsContextType = Pick<
  MultiplayerContextType,
  | 'socket'
  | 'playersRef'
  | 'playersTransformsRef'
  | 'enemiesRef'
  | 'enemyTransformsRef'
  | 'enemyVisualRotationsRef'
  | 'joinRoom'
  | 'leaveRoom'
  | 'previewRoom'
  | 'clearPreview'
  | 'startGame'
  | 'enterCombatArena'
  | 'useCoopFountain'
  | 'chooseCoopAlly'
  | 'chooseSunkenTempleLoot'
  | 'chooseEternityPalaceLoot'
  | 'chooseEternityPetUpgrade'
  | 'claimPreBossReward'
  | 'claimDeepSanctumReward'
  | 'finishPreBossMerchant'
  | 'updatePlayerPosition'
  | 'updatePlayerWeapon'
  | 'updatePlayerArchetype'
  | 'updatePlayerWeaponAspect'
  | 'updatePlayerHealth'
  | 'broadcastPlayerAttack'
  | 'broadcastPlayerAbility'
  | 'broadcastPlayerEffect'
  | 'broadcastPlayerDamage'
  | 'broadcastPlayerHealing'
  | 'broadcastAlliedHealing'
  | 'broadcastPlayerAnimationState'
  | 'broadcastPlayerDebuff'
  | 'broadcastPlayerStealth'
  | 'broadcastPlayerKnockback'
  | 'broadcastPlayerTornadoEffect'
  | 'broadcastPlayerDeathEffect'
  | 'damageEnemy'
  | 'subscribeEnemyDamage'
  | 'detonateWyvernConcentratedVenom'
  | 'triggerTyrantsCloakStrike'
  | 'triggerDeathdealerStaggerProc'
  | 'applyStatusEffect'
  | 'damageMushroom'
  | 'updatePlayerExperience'
  | 'updatePlayerLevel'
  | 'updatePlayerEssence'
  | 'updatePlayerGold'
  | 'updatePlayerFlow'
  | 'updatePlayerFate'
  | 'updatePlayerShield'
  | 'updatePlayerEnergy'
  | 'setSelectedWeapons'
  | 'setSelectedArchetype'
  | 'setSelectedWeaponAspect'
  | 'rememberWeaponAspect'
  | 'setAbilityLoadout'
  | 'setTalentLoadout'
  | 'unlockAbility'
  | 'updateSkillPointsForLevel'
  | 'grantSkillPoints'
  | 'allocateStatPoint'
  | 'updateStatPointsForLevel'
  | 'grantStatPoints'
  | 'purchaseItem'
  | 'purchaseMerchantItem'
  | 'purchaseMerchantHeal'
  | 'purchaseDreamLayerItem'
  | 'purchaseDreamLayerHeal'
  | 'registerMerchantPurchaseSuccessHandler'
  | 'registerDeepSanctumRewardClaimedHandler'
  | 'registerMerchantNpcGreetHandler'
  | 'registerPlayerGoldChangedHandler'
  | 'registerPlayerFlowChangedHandler'
  | 'registerPlayerFateChangedHandler'
  | 'registerBossDefeatedHandler'
  | 'registerBossItemPickupHandler'
  | 'registerRunePickupHandler'
  | 'pickupItem'
  | 'pickupGoldDrop'
  | 'sendChatMessage'
  | 'openChat'
  | 'closeChat'
  | 'setPlayers'
  | 'hideCoopPortalTransition'
  | 'confirmCoopPortalTransitionComplete'
  | 'resetLocalPositionEmitThrottle'
  | 'coopTransitionOverlayRef'
  | 'coopPendingPortalSnapRef'
  | 'coopRoomEntryTokenRef'
  | 'coopCombatArenaEnterAtRef'
  | 'endCoopPortalTransition'
  | 'clearCoopClearedRoomColor'
  | 'clearLateJoinCombatLoadout'
>;

/** Room / roster state — updates on spawn, despawn, and infrequent session events. */
export type MultiplayerRoomContextType = Omit<
  MultiplayerContextType,
  keyof MultiplayerActionsContextType
>;

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);
const MultiplayerActionsContext = createContext<MultiplayerActionsContextType | null>(null);
const MultiplayerRoomContext = createContext<MultiplayerRoomContextType | null>(null);

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}

export function useMultiplayerActions() {
  const context = useContext(MultiplayerActionsContext);
  if (!context) {
    throw new Error('useMultiplayerActions must be used within a MultiplayerProvider');
  }
  return context;
}

export function useMultiplayerRoom() {
  const context = useContext(MultiplayerRoomContext);
  if (!context) {
    throw new Error('useMultiplayerRoom must be used within a MultiplayerProvider');
  }
  return context;
}

interface MultiplayerProviderProps {
  children: React.ReactNode;
}

const VALID_CAMP_KEYS = new Set(['red', 'blue', 'green', 'purple']);
const VALID_COOP_ROOM_KINDS = new Set(['red', 'blue', 'green', 'purple', 'stat', 'trial', 'merchant', 'boss', 'intro', 'deep_sanctum', 'sunken_temple', 'eternity_palace', 'eden', 'false_eden', 'delirium_gate', 'erebus_gate', 'dream_layer', 'fae_realm', 'eden_finale']);
const VALID_COOP_TERRAIN_THEMES = new Set(['purple', 'blue', 'green']);

function normalizeThronePortalLayout(v: unknown): 'rim' | 'center' {
  return v === 'center' ? 'center' : 'rim';
}

function normalizeCoopMainArenaPhase(v: unknown):
  | 'pick_wave2'
  | 'pick_pre_boss'
  | 'pre_boss_reward'
  | 'pre_boss_merchant'
  | 'pick_boss'
  | 'pick_post_boss'
  | 'pick_sunken_entry'
  | 'pick_eternity_entry'
  | 'pick_eternity_late_entry'
  | 'pick_trinity_finale'
  | 'eden_exit'
  | null {
  if (
    v === 'pick_wave2'
    || v === 'pick_pre_boss'
    || v === 'pre_boss_reward'
    || v === 'pre_boss_merchant'
    || v === 'pick_boss'
    || v === 'pick_post_boss'
    || v === 'pick_sunken_entry'
    || v === 'pick_eternity_entry'
    || v === 'pick_eternity_late_entry'
    || v === 'pick_trinity_finale'
    || v === 'eden_exit'
  ) {
    return v;
  }
  return null;
}

function normalizeCoopRoomKind(v: unknown): CoopRoomKind | null {
  const k = String(v || '').toLowerCase();
  if (k === 'healing') return 'merchant';
  return VALID_COOP_ROOM_KINDS.has(k) ? (k as CoopRoomKind) : null;
}

function normalizeCoopColoredRoomVisitIndex(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeCoopBossRoomVisitIndex(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeMerchantInventory(v: unknown): MerchantStockItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((entry): entry is MerchantStockItem => {
    if (entry == null || typeof entry !== 'object') return false;
    const e = entry as MerchantStockItem;
    if (typeof e.id !== 'string' || typeof e.cost !== 'number') return false;
    const kind = e.kind || 'boss_drop';
    if (kind === 'boss_drop') return e.item != null;
    return kind === 'dash_charge'
      || kind === 'weapon_talent'
      || kind === 'oxygen'
      || kind === 'warpdrive';
  }).map((entry) => ({
    ...entry,
    kind: entry.kind || 'boss_drop',
  }));
}

function normalizeDreamLayerInventory(v: unknown): DreamLayerStockItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((entry): entry is DreamLayerStockItem => {
    if (entry == null || typeof entry !== 'object') return false;
    const e = entry as DreamLayerStockItem;
    if (typeof e.id !== 'string' || typeof e.cost !== 'number') return false;
    return (
      e.kind === 'warding_pendant'
      || e.kind === 'exodia'
      || e.kind === 'legendary_a'
      || e.kind === 'legendary_b'
      || e.kind === 'ring'
    );
  });
}

function normalizeDreamLayerPurchaseState(v: unknown): DreamLayerPurchaseState {
  if (v == null || typeof v !== 'object') {
    return {
      healPurchasedThisVisit: false,
      wardingPurchasedThisVisit: false,
      legendaryAPurchasedThisVisit: false,
      legendaryBPurchasedThisVisit: false,
      ringPurchasedThisVisit: false,
    };
  }
  const s = v as DreamLayerPurchaseState;
  return {
    healPurchasedThisVisit: !!s.healPurchasedThisVisit,
    wardingPurchasedThisVisit: !!s.wardingPurchasedThisVisit,
    legendaryAPurchasedThisVisit: !!s.legendaryAPurchasedThisVisit,
    legendaryBPurchasedThisVisit: !!s.legendaryBPurchasedThisVisit,
    ringPurchasedThisVisit: !!s.ringPurchasedThisVisit,
  };
}

function applyLocalDreamLayerPurchaseStatesFromPayload(
  data: { dreamLayerPurchaseStates?: Record<string, unknown> } | null | undefined,
  localPlayerId: string | undefined,
  setDreamLayerPurchaseState: React.Dispatch<React.SetStateAction<DreamLayerPurchaseState>>,
): void {
  if (!localPlayerId || !data?.dreamLayerPurchaseStates) return;
  const localState = data.dreamLayerPurchaseStates[localPlayerId];
  if (localState == null) return;
  setDreamLayerPurchaseState(normalizeDreamLayerPurchaseState(localState));
}

function normalizeMerchantPurchaseState(v: unknown): MerchantPurchaseState {
  if (v == null || typeof v !== 'object') {
    return {
      dashChargePurchased: false,
      weaponTalentPurchases: 0,
      oxygenPurchases: 0,
      warpdrivePurchases: 0,
      healPurchasedThisVisit: false,
      weaponTalentPurchasedThisVisit: false,
      utilityPurchasedThisVisit: false,
      backfillDashPurchasedThisVisit: false,
      backfillTalentPurchasedThisVisit: false,
    };
  }
  const s = v as MerchantPurchaseState;
  return {
    dashChargePurchased: !!s.dashChargePurchased,
    weaponTalentPurchases: Math.max(0, Number(s.weaponTalentPurchases) || 0),
    oxygenPurchases: Math.max(0, Number(s.oxygenPurchases) || 0),
    warpdrivePurchases: Math.max(0, Number(s.warpdrivePurchases) || 0),
    healPurchasedThisVisit: !!s.healPurchasedThisVisit,
    weaponTalentPurchasedThisVisit: !!s.weaponTalentPurchasedThisVisit,
    utilityPurchasedThisVisit: !!s.utilityPurchasedThisVisit,
    backfillDashPurchasedThisVisit: !!s.backfillDashPurchasedThisVisit,
    backfillTalentPurchasedThisVisit: !!s.backfillTalentPurchasedThisVisit,
  };
}

function applyLocalMerchantPurchaseStatesFromPayload(
  data: { merchantPurchaseStates?: Record<string, unknown> } | null | undefined,
  localPlayerId: string | undefined,
  setMerchantPurchaseState: React.Dispatch<React.SetStateAction<MerchantPurchaseState>>,
): void {
  if (!localPlayerId || !data?.merchantPurchaseStates) return;
  const localState = data.merchantPurchaseStates[localPlayerId];
  if (localState == null) return;
  setMerchantPurchaseState(normalizeMerchantPurchaseState(localState));
}

function normalizeCoopTerrainTheme(v: unknown): CoopTerrainTheme {
  const k = String(v || '').toLowerCase();
  return VALID_COOP_TERRAIN_THEMES.has(k) ? (k as CoopTerrainTheme) : 'purple';
}

function normalizeCoopBossThroneArena(v: unknown): boolean {
  return v === true;
}

function normalizeCoopThroneBossKind(v: unknown): 'boss' | 'boss2' | 'boss3' | 'destiny' | 'boss_all' | null {
  const k = String(v || '').toLowerCase();
  if (k === 'boss_all') return 'boss_all';
  if (k === 'destiny') return 'destiny';
  if (k === 'boss3') return 'boss3';
  if (k === 'boss2') return 'boss2';
  if (k === 'boss') return 'boss';
  return null;
}

/** Normalize server `campTypes` or infer from `enemies[].campType` for environment theme sync. */
function campArchetypeFromRoomPayload(data: {
  campTypes?: string[];
  enemies?: Enemy[];
}): string[] {
  if (Array.isArray(data.campTypes) && data.campTypes.length > 0) {
    const k = String(data.campTypes[0]).toLowerCase();
    if (VALID_CAMP_KEYS.has(k)) return [k];
  }
  const list = data.enemies;
  if (Array.isArray(list)) {
    for (const en of list) {
      if (!en?.campType) continue;
      const k = String(en.campType).toLowerCase();
      if (VALID_CAMP_KEYS.has(k)) return [k];
    }
  }
  return [];
}

/** Result returned from `joinRoom` — used by bootstrap to skip redundant start-game / wait for party. */
export interface JoinRoomResult {
  roomId: string;
  gameStarted: boolean;
  gameMode: 'multiplayer' | 'coop';
  playerCount: number;
}

type CoopSessionSnapshotPayload = {
  killCount?: number;
  combatArenaActive?: boolean;
  players?: Player[];
  enemies?: Enemy[];
  thronePortalOffer?: string[];
  thronePortalLayout?: string;
  coopMainArenaPortalPhase?: string;
  coopBossThroneArena?: boolean;
  coopThroneBossKind?: unknown;
  coopTerrainTheme?: unknown;
  coopCurrentRoomKind?: string;
  coopClearedRoomKind?: string;
  coopColoredRoomVisitIndex?: unknown;
  coopBossRoomVisitIndex?: unknown;
  coopSkyPresetIndex?: unknown;
  coopGrassPresetIndex?: unknown;
  merchantInventory?: unknown;
  mushroomState?: { health?: number[]; maxHealth?: number };
  coopIntroPending?: boolean;
  coopIntroActive?: boolean;
  coopIntroRoomIndex?: number;
  coopIntroPortalOpen?: boolean;
  coopIntroFountainPhase?: boolean;
  coopIntroFountainUsed?: boolean;
  coopIntroAllyChoiceMade?: boolean;
  coopFaeRealmPending?: boolean;
  coopFaeRealmActive?: boolean;
  coopFaeRealmRoomIndex?: number;
  coopFaeRealmPortalOpen?: boolean;
  coopFaeRealmBossKind?: string | null;
  coopFaeBeastCompanionGranted?: boolean;
  coopFaeBeastCompanionKind?: string | null;
  coopSunkenActive?: boolean;
  coopSunkenRoomIndex?: number;
  coopSunkenPortalOpen?: boolean;
  coopSunkenFountainPhase?: boolean;
  coopSunkenFountainUsed?: boolean;
  coopSunkenAllyChoiceMade?: boolean;
  coopSunkenLootOffer?: DreamLayerStockItem[];
  coopSunkenLootClaimedPlayerIds?: string[];
  coopSunkenLootPhaseComplete?: boolean;
  coopSunkenCompleted?: boolean;
  coopEternityActive?: boolean;
  coopEternityRoomIndex?: number;
  coopEternityPortalOpen?: boolean;
  coopEternityFountainPhase?: boolean;
  coopEternityFountainUsed?: boolean;
  coopEternityLootOffer?: DreamLayerStockItem[];
  coopEternityLootClaimedPlayerIds?: string[];
  coopEternityLootPhaseComplete?: boolean;
  coopEternityCompleted?: boolean;
  coopAllyKind?: string;
  coopAllyOffer?: string[];
  coopVoidPortalOffered?: boolean;
  coopDeepSanctumActive?: boolean;
  coopDeepSanctumLevel?: number;
  deepSanctumRewardKind?: string;
  coopEdenFountainUsed?: boolean;
  coopEdenResumeKind?: string;
  coopFalseEdenCleared?: boolean;
  coopDeliriumActive?: boolean;
  coopDeliriumEventEnded?: boolean;
  coopDeliriumSuccess?: boolean;
  coopErebusGateActive?: boolean;
  deliriumStructure?: DeliriumStructureState | null;
  introGoldReward?: number;
};

type CoopSnapshotSetters = {
  setGameStarted: React.Dispatch<React.SetStateAction<boolean>>;
  setKillCount: React.Dispatch<React.SetStateAction<number>>;
  setCombatArenaActive: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayers: React.Dispatch<React.SetStateAction<Map<string, Player>>>;
  setEnemies: React.Dispatch<React.SetStateAction<Map<string, Enemy>>>;
  setThronePortalOffer: React.Dispatch<React.SetStateAction<string[]>>;
  setThronePortalLayout: React.Dispatch<React.SetStateAction<'rim' | 'center'>>;
  setCoopMainArenaPortalPhase: React.Dispatch<
    React.SetStateAction<
      | 'pick_wave2'
      | 'pick_pre_boss'
      | 'pre_boss_reward'
      | 'pre_boss_merchant'
      | 'pick_boss'
      | 'pick_post_boss'
      | 'pick_sunken_entry'
      | 'pick_eternity_entry'
      | 'pick_eternity_late_entry'
      | 'pick_trinity_finale'
      | 'eden_exit'
      | null
    >
  >;
  setCoopBossThroneArena: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopThroneBossKind: React.Dispatch<
    React.SetStateAction<'boss' | 'boss2' | 'boss3' | 'destiny' | 'boss_all' | null>
  >;
  setCoopTerrainTheme: React.Dispatch<React.SetStateAction<CoopTerrainTheme>>;
  setCoopCurrentRoomKind: React.Dispatch<React.SetStateAction<CoopRoomKind | null>>;
  setCoopClearedRoomKind: React.Dispatch<React.SetStateAction<CoopRoomKind | null>>;
  setCoopColoredRoomVisitIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setCoopBossRoomVisitIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setCoopSkyPresetIndex: React.Dispatch<React.SetStateAction<number>>;
  setCoopGrassPresetIndex: React.Dispatch<React.SetStateAction<number>>;
  setMerchantInventory: React.Dispatch<React.SetStateAction<MerchantStockItem[]>>;
  setMerchantPurchaseState: React.Dispatch<React.SetStateAction<MerchantPurchaseState>>;
  setMushroomState: React.Dispatch<
    React.SetStateAction<{ health: number[]; maxHealth: number } | null>
  >;
  setCoopIntroPending: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopIntroActive: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopIntroRoomIndex: React.Dispatch<React.SetStateAction<number>>;
  setCoopIntroPortalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopIntroFountainPhase: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopIntroFountainUsed: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopIntroAllyChoiceMade: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopFaeRealmPending: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopFaeRealmActive: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopFaeRealmRoomIndex: React.Dispatch<React.SetStateAction<number>>;
  setCoopFaeRealmPortalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopFaeRealmBossKind: React.Dispatch<React.SetStateAction<FaeBeastCompanionKind | null>>;
  setCoopFaeBeastCompanionGranted: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopFaeBeastCompanionKind: React.Dispatch<React.SetStateAction<FaeBeastCompanionKind | null>>;
  setCoopSunkenActive: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenRoomIndex: React.Dispatch<React.SetStateAction<number>>;
  setCoopSunkenPortalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenFountainPhase: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenFountainUsed: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenAllyChoiceMade: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenLootOffer: React.Dispatch<React.SetStateAction<DreamLayerStockItem[]>>;
  setCoopSunkenLootClaimedPlayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCoopSunkenLootPhaseComplete: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopSunkenCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityActive: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityRoomIndex: React.Dispatch<React.SetStateAction<number>>;
  setCoopEternityPortalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityFountainPhase: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityFountainUsed: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityLootOffer: React.Dispatch<React.SetStateAction<DreamLayerStockItem[]>>;
  setCoopEternityLootClaimedPlayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCoopEternityLootPhaseComplete: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEternityCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopAllyKind: React.Dispatch<React.SetStateAction<CoopAllyKind>>;
  setCoopAllyOffer: React.Dispatch<React.SetStateAction<CoopAllyKind[]>>;
  setCoopVoidPortalOffered: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopDeepSanctumLevel: React.Dispatch<React.SetStateAction<number>>;
  setDeepSanctumRewardKind: React.Dispatch<React.SetStateAction<DeepSanctumRewardKind | null>>;
  setCoopEdenFountainUsed: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopEdenResumeKind: React.Dispatch<React.SetStateAction<CoopRoomKind | null>>;
  setCoopFalseEdenCleared: React.Dispatch<React.SetStateAction<boolean>>;
  setDeliriumStructure: React.Dispatch<React.SetStateAction<DeliriumStructureState | null>>;
  setCoopDeliriumActive: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopDeliriumEventEnded: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopDeliriumSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  setCoopErebusGateActive: React.Dispatch<React.SetStateAction<boolean>>;
};

function applyCoopCombatArenaActiveFromServer(
  gameMode: string | undefined,
  combatArenaActive: boolean | undefined,
  setCombatArenaActive: React.Dispatch<React.SetStateAction<boolean>>,
) {
  if (gameMode === 'coop') {
    setCombatArenaActive(!!combatArenaActive);
  } else {
    setCombatArenaActive(true);
  }
}

function applyIntroSnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    | 'setCoopIntroPending'
    | 'setCoopIntroActive'
    | 'setCoopIntroRoomIndex'
    | 'setCoopIntroPortalOpen'
    | 'setCoopIntroFountainPhase'
    | 'setCoopIntroFountainUsed'
    | 'setCoopIntroAllyChoiceMade'
    | 'setCoopAllyKind'
    | 'setCoopAllyOffer'
  >,
) {
  if (!data) return;
  if ('coopIntroPending' in data) setters.setCoopIntroPending(!!data.coopIntroPending);
  if ('coopIntroActive' in data) setters.setCoopIntroActive(!!data.coopIntroActive);
  if ('coopIntroRoomIndex' in data) {
    setters.setCoopIntroRoomIndex(Math.max(0, Number(data.coopIntroRoomIndex) || 0));
  }
  if ('coopIntroPortalOpen' in data) setters.setCoopIntroPortalOpen(!!data.coopIntroPortalOpen);
  if ('coopIntroFountainPhase' in data) setters.setCoopIntroFountainPhase(!!data.coopIntroFountainPhase);
  if ('coopIntroFountainUsed' in data) setters.setCoopIntroFountainUsed(!!data.coopIntroFountainUsed);
  if ('coopIntroAllyChoiceMade' in data) setters.setCoopIntroAllyChoiceMade(!!data.coopIntroAllyChoiceMade);
  if ('coopAllyKind' in data) {
    setters.setCoopAllyKind(parseCoopAllyKind(data.coopAllyKind));
  }
  if ('coopAllyOffer' in data) {
    setters.setCoopAllyOffer(parseCoopAllyOffer(data.coopAllyOffer));
  }
}

function applyFaeRealmSnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    | 'setCoopFaeRealmPending'
    | 'setCoopFaeRealmActive'
    | 'setCoopFaeRealmRoomIndex'
    | 'setCoopFaeRealmPortalOpen'
    | 'setCoopFaeRealmBossKind'
    | 'setCoopFaeBeastCompanionGranted'
    | 'setCoopFaeBeastCompanionKind'
  >,
) {
  if (!data) return;
  if ('coopFaeRealmPending' in data) setters.setCoopFaeRealmPending(!!data.coopFaeRealmPending);
  if ('coopFaeRealmActive' in data) setters.setCoopFaeRealmActive(!!data.coopFaeRealmActive);
  if ('coopFaeRealmRoomIndex' in data) {
    setters.setCoopFaeRealmRoomIndex(Math.max(0, Number(data.coopFaeRealmRoomIndex) || 0));
  }
  if ('coopFaeRealmPortalOpen' in data) setters.setCoopFaeRealmPortalOpen(!!data.coopFaeRealmPortalOpen);
  if ('coopFaeRealmBossKind' in data) {
    setters.setCoopFaeRealmBossKind(parseFaeBeastCompanionKind(data.coopFaeRealmBossKind));
  }
  if ('coopFaeBeastCompanionGranted' in data || 'faeBeastCompanionGranted' in data) {
    const granted = (data as any).coopFaeBeastCompanionGranted ?? (data as any).faeBeastCompanionGranted;
    setters.setCoopFaeBeastCompanionGranted(!!granted);
  }
  if ('coopFaeBeastCompanionKind' in data || 'faeBeastCompanionKind' in data) {
    const kind = (data as any).coopFaeBeastCompanionKind ?? (data as any).faeBeastCompanionKind;
    setters.setCoopFaeBeastCompanionKind(parseFaeBeastCompanionKind(kind));
  }
}

function parseCoopSunkenLootOffer(raw: unknown): DreamLayerStockItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is DreamLayerStockItem => {
    return entry != null && typeof entry === 'object' && typeof (entry as DreamLayerStockItem).id === 'string';
  });
}

function applySunkenSnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    | 'setCoopSunkenActive'
    | 'setCoopSunkenRoomIndex'
    | 'setCoopSunkenPortalOpen'
    | 'setCoopSunkenFountainPhase'
    | 'setCoopSunkenFountainUsed'
    | 'setCoopSunkenAllyChoiceMade'
    | 'setCoopSunkenLootOffer'
    | 'setCoopSunkenLootClaimedPlayerIds'
    | 'setCoopSunkenLootPhaseComplete'
    | 'setCoopSunkenCompleted'
    | 'setCoopAllyKind'
    | 'setCoopAllyOffer'
  >,
) {
  if (!data) return;
  if ('coopSunkenActive' in data) setters.setCoopSunkenActive(!!data.coopSunkenActive);
  if ('coopSunkenRoomIndex' in data) {
    setters.setCoopSunkenRoomIndex(Math.max(0, Number(data.coopSunkenRoomIndex) || 0));
  }
  if ('coopSunkenPortalOpen' in data) setters.setCoopSunkenPortalOpen(!!data.coopSunkenPortalOpen);
  if ('coopSunkenFountainPhase' in data) setters.setCoopSunkenFountainPhase(!!data.coopSunkenFountainPhase);
  if ('coopSunkenFountainUsed' in data) setters.setCoopSunkenFountainUsed(!!data.coopSunkenFountainUsed);
  if ('coopSunkenAllyChoiceMade' in data) setters.setCoopSunkenAllyChoiceMade(!!data.coopSunkenAllyChoiceMade);
  if ('coopSunkenLootOffer' in data) {
    setters.setCoopSunkenLootOffer(parseCoopSunkenLootOffer(data.coopSunkenLootOffer));
  }
  if ('coopSunkenLootClaimedPlayerIds' in data) {
    setters.setCoopSunkenLootClaimedPlayerIds(
      Array.isArray(data.coopSunkenLootClaimedPlayerIds)
        ? [...data.coopSunkenLootClaimedPlayerIds]
        : [],
    );
  }
  if ('coopSunkenLootPhaseComplete' in data) {
    setters.setCoopSunkenLootPhaseComplete(!!data.coopSunkenLootPhaseComplete);
  }
  if ('coopSunkenCompleted' in data) setters.setCoopSunkenCompleted(!!data.coopSunkenCompleted);
  if ('coopAllyKind' in data) {
    setters.setCoopAllyKind(parseCoopAllyKind(data.coopAllyKind));
  }
  if ('coopAllyOffer' in data) {
    setters.setCoopAllyOffer(parseCoopAllyOffer(data.coopAllyOffer));
  }
}

function parseCoopEternityLootOffer(raw: unknown): DreamLayerStockItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is DreamLayerStockItem => {
    return entry != null && typeof entry === 'object' && typeof (entry as DreamLayerStockItem).id === 'string';
  });
}

function applyEternitySnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    | 'setCoopEternityActive'
    | 'setCoopEternityRoomIndex'
    | 'setCoopEternityPortalOpen'
    | 'setCoopEternityFountainPhase'
    | 'setCoopEternityFountainUsed'
    | 'setCoopEternityLootOffer'
    | 'setCoopEternityLootClaimedPlayerIds'
    | 'setCoopEternityLootPhaseComplete'
    | 'setCoopEternityCompleted'
  >,
) {
  if (!data) return;
  if ('coopEternityActive' in data) setters.setCoopEternityActive(!!data.coopEternityActive);
  if ('coopEternityRoomIndex' in data) {
    setters.setCoopEternityRoomIndex(Math.max(0, Number(data.coopEternityRoomIndex) || 0));
  }
  if ('coopEternityPortalOpen' in data) setters.setCoopEternityPortalOpen(!!data.coopEternityPortalOpen);
  if ('coopEternityFountainPhase' in data) setters.setCoopEternityFountainPhase(!!data.coopEternityFountainPhase);
  if ('coopEternityFountainUsed' in data) setters.setCoopEternityFountainUsed(!!data.coopEternityFountainUsed);
  if ('coopEternityLootOffer' in data) {
    setters.setCoopEternityLootOffer(parseCoopEternityLootOffer(data.coopEternityLootOffer));
  }
  if ('coopEternityLootClaimedPlayerIds' in data) {
    setters.setCoopEternityLootClaimedPlayerIds(
      Array.isArray(data.coopEternityLootClaimedPlayerIds)
        ? [...data.coopEternityLootClaimedPlayerIds]
        : [],
    );
  }
  if ('coopEternityLootPhaseComplete' in data) {
    setters.setCoopEternityLootPhaseComplete(!!data.coopEternityLootPhaseComplete);
  }
  if ('coopEternityCompleted' in data) setters.setCoopEternityCompleted(!!data.coopEternityCompleted);
}

function applyDeepSanctumSnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    'setCoopVoidPortalOffered' | 'setCoopDeepSanctumLevel' | 'setDeepSanctumRewardKind'
  >,
) {
  if (!data) return;
  if ('coopVoidPortalOffered' in data) setters.setCoopVoidPortalOffered(!!data.coopVoidPortalOffered);
  if ('coopDeepSanctumLevel' in data) {
    setters.setCoopDeepSanctumLevel(Math.max(0, Number(data.coopDeepSanctumLevel) || 0));
  }
  if ('deepSanctumRewardKind' in data) {
    const k = String(data.deepSanctumRewardKind || '').toLowerCase();
    setters.setDeepSanctumRewardKind(
      k === 'gold' || k === 'stat' || k === 'talent' ? (k as DeepSanctumRewardKind) : null,
    );
  } else if ('coopDeepSanctumActive' in data && !data.coopDeepSanctumActive) {
    setters.setDeepSanctumRewardKind(null);
  }
}

function normalizeDeliriumStructure(value: unknown): DeliriumStructureState | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as DeliriumStructureState;
  if (typeof s.hp !== 'number' || typeof s.maxHp !== 'number') return null;
  if (!s.position || typeof s.position.x !== 'number' || typeof s.position.z !== 'number') return null;
  return {
    hp: s.hp,
    maxHp: s.maxHp,
    position: { x: s.position.x, z: s.position.z },
    destroyed: !!s.destroyed,
  };
}

function applyEdenSnapshot(
  data: CoopSessionSnapshotPayload | null | undefined,
  setters: Pick<
    CoopSnapshotSetters,
    | 'setCoopEdenFountainUsed'
    | 'setCoopEdenResumeKind'
    | 'setCoopFalseEdenCleared'
    | 'setDeliriumStructure'
    | 'setCoopDeliriumActive'
    | 'setCoopDeliriumEventEnded'
    | 'setCoopDeliriumSuccess'
    | 'setCoopErebusGateActive'
  >,
) {
  if (!data) return;
  if ('coopEdenFountainUsed' in data) setters.setCoopEdenFountainUsed(!!data.coopEdenFountainUsed);
  if ('coopEdenResumeKind' in data) {
    setters.setCoopEdenResumeKind(normalizeCoopRoomKind(data.coopEdenResumeKind));
  } else if ('coopCurrentRoomKind' in data) {
    const kind = normalizeCoopRoomKind(data.coopCurrentRoomKind);
    if (kind !== 'eden' && kind !== 'false_eden' && kind !== 'delirium_gate' && kind !== 'erebus_gate' && kind !== 'dream_layer') {
      setters.setCoopEdenFountainUsed(false);
      setters.setCoopEdenResumeKind(null);
    }
  }
  if ('coopFalseEdenCleared' in data) setters.setCoopFalseEdenCleared(!!data.coopFalseEdenCleared);
  if ('coopDeliriumActive' in data) setters.setCoopDeliriumActive(!!data.coopDeliriumActive);
  if ('coopDeliriumEventEnded' in data) setters.setCoopDeliriumEventEnded(!!data.coopDeliriumEventEnded);
  if ('coopDeliriumSuccess' in data) setters.setCoopDeliriumSuccess(!!data.coopDeliriumSuccess);
  if ('coopErebusGateActive' in data) setters.setCoopErebusGateActive(!!data.coopErebusGateActive);
  if ('deliriumStructure' in data) {
    setters.setDeliriumStructure(normalizeDeliriumStructure(data.deliriumStructure));
  } else if ('coopCurrentRoomKind' in data) {
    const kind = normalizeCoopRoomKind(data.coopCurrentRoomKind);
    if (kind !== 'delirium_gate') {
      setters.setDeliriumStructure(null);
      setters.setCoopDeliriumActive(false);
      setters.setCoopDeliriumEventEnded(false);
      setters.setCoopDeliriumSuccess(false);
    }
    if (kind !== 'erebus_gate') {
      setters.setCoopErebusGateActive(false);
    }
  }
}

/** Shared coop session fields from `game-started`, `coop-throne-sync`, and active `room-joined`. */
function applyCoopSessionSnapshot(
  data: CoopSessionSnapshotPayload,
  setters: CoopSnapshotSetters,
  options: { resetVisitIndices?: boolean; resetMerchantPurchaseState?: boolean } = {},
) {
  const { resetVisitIndices = false, resetMerchantPurchaseState = false } = options;

  setters.setGameStarted(true);
  if (data.killCount != null) {
    setters.setKillCount(data.killCount);
  }
  if (data && 'combatArenaActive' in data) {
    setters.setCombatArenaActive(!!data.combatArenaActive);
  }
  if (data?.players && Array.isArray(data.players)) {
    setters.setPlayers((prev) => {
      const next = new Map(prev);
      for (const p of data.players as Player[]) {
        const old = next.get(p.id);
        next.set(p.id, old ? { ...old, ...p } : p);
      }
      return next;
    });
  }
  if (data?.enemies && Array.isArray(data.enemies)) {
    setters.setEnemies((prev) => {
      const next = new Map(prev);
      for (const e of data.enemies as Enemy[]) {
        next.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
      }
      return next;
    });
  }
  if (Array.isArray(data?.thronePortalOffer)) {
    setters.setThronePortalOffer([...data.thronePortalOffer]);
  } else {
    setters.setThronePortalOffer([]);
  }
  if (data && 'thronePortalLayout' in data) {
    setters.setThronePortalLayout(normalizeThronePortalLayout(data.thronePortalLayout));
  } else {
    setters.setThronePortalLayout('rim');
  }
  if (data && 'coopMainArenaPortalPhase' in data) {
    setters.setCoopMainArenaPortalPhase(normalizeCoopMainArenaPhase(data.coopMainArenaPortalPhase));
  } else {
    setters.setCoopMainArenaPortalPhase(null);
  }
  if (data && 'coopBossThroneArena' in data) {
    setters.setCoopBossThroneArena(normalizeCoopBossThroneArena(data.coopBossThroneArena));
  } else {
    setters.setCoopBossThroneArena(false);
  }
  if (data && 'coopThroneBossKind' in data) {
    setters.setCoopThroneBossKind(normalizeCoopThroneBossKind(data.coopThroneBossKind));
  } else {
    setters.setCoopThroneBossKind(null);
  }
  setters.setCoopTerrainTheme(normalizeCoopTerrainTheme(data?.coopTerrainTheme));
  setters.setCoopCurrentRoomKind(normalizeCoopRoomKind(data?.coopCurrentRoomKind));
  setters.setCoopClearedRoomKind(normalizeCoopRoomKind(data?.coopClearedRoomKind));
  if (data && 'coopSkyPresetIndex' in data) {
    const skyIdx = Number(data.coopSkyPresetIndex);
    if (Number.isFinite(skyIdx)) {
      setters.setCoopSkyPresetIndex(Math.max(0, Math.floor(skyIdx)));
    }
  }
  if (data && 'coopGrassPresetIndex' in data) {
    const grassIdx = Number(data.coopGrassPresetIndex);
    if (Number.isFinite(grassIdx)) {
      setters.setCoopGrassPresetIndex(Math.max(0, Math.floor(grassIdx)));
    }
  }
  if (resetVisitIndices) {
    setters.setCoopColoredRoomVisitIndex(null);
    setters.setCoopBossRoomVisitIndex(null);
  } else {
    if (data && 'coopColoredRoomVisitIndex' in data) {
      setters.setCoopColoredRoomVisitIndex(
        normalizeCoopColoredRoomVisitIndex(data.coopColoredRoomVisitIndex),
      );
    }
    if (data && 'coopBossRoomVisitIndex' in data) {
      setters.setCoopBossRoomVisitIndex(normalizeCoopBossRoomVisitIndex(data.coopBossRoomVisitIndex));
    }
  }
  setters.setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
  if (resetMerchantPurchaseState) {
    setters.setMerchantPurchaseState({
      dashChargePurchased: false,
      weaponTalentPurchases: 0,
      oxygenPurchases: 0,
      warpdrivePurchases: 0,
      healPurchasedThisVisit: false,
      weaponTalentPurchasedThisVisit: false,
      utilityPurchasedThisVisit: false,
      backfillDashPurchasedThisVisit: false,
      backfillTalentPurchasedThisVisit: false,
    });
  }
  if (data?.mushroomState?.health && Array.isArray(data.mushroomState.health)) {
    setters.setMushroomState({
      health: [...data.mushroomState.health],
      maxHealth: data.mushroomState.maxHealth ?? 10,
    });
  }
  applyIntroSnapshot(data, setters);
  applyFaeRealmSnapshot(data, setters);
  applySunkenSnapshot(data, setters);
  applyEternitySnapshot(data, setters);
  applyDeepSanctumSnapshot(data, setters);
  applyEdenSnapshot(data, setters);
}

export function MultiplayerProvider({ children }: MultiplayerProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [playerRosterMetaRev, setPlayerRosterMetaRev] = useState(0);
  const bumpPlayerRosterMetaRev = useCallback(() => {
    setPlayerRosterMetaRev((v) => v + 1);
  }, []);
  const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
  const enemiesRef = useRef<Map<string, Enemy>>(enemies);
  const enemyTransformsRef = useRef<Map<string, EnemyLiveTransform>>(new Map());
  const enemyVisualRotationsRef = useRef<Map<string, number>>(new Map());

  enemiesRef.current = enemies;

  useEffect(() => {
    (window as Window & { enemyVisualRotationsRef?: typeof enemyVisualRotationsRef }).enemyVisualRotationsRef =
      enemyVisualRotationsRef;
    return () => {
      delete (window as Window & { enemyVisualRotationsRef?: typeof enemyVisualRotationsRef }).enemyVisualRotationsRef;
    };
  }, []);

  const playersRef = useRef(players);
  playersRef.current = players;
  const playersTransformsRef = useRef<Map<string, PlayerLiveTransform>>(new Map());

  // Keep player transform ref aligned with React lifecycle (join/leave); movement bypasses setState.
  useEffect(() => {
    const ids = new Set(players.keys());
    for (const id of Array.from(playersTransformsRef.current.keys())) {
      if (!ids.has(id)) playersTransformsRef.current.delete(id);
    }
    players.forEach((p, id) => {
      const prev = playersTransformsRef.current.get(id);
      if (!prev) {
        playersTransformsRef.current.set(id, {
          position: { x: p.position.x, y: p.position.y, z: p.position.z },
          rotation: { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z },
          movementDirection: p.movementDirection,
        });
      }
    });
  }, [players]);

  // Keep transform ref aligned with React enemy lifecycle (spawn/despawn); movement bypasses setState.
  useEffect(() => {
    const ids = new Set(enemies.keys());
    for (const id of Array.from(enemyTransformsRef.current.keys())) {
      if (!ids.has(id)) enemyTransformsRef.current.delete(id);
    }
    for (const id of Array.from(enemyVisualRotationsRef.current.keys())) {
      if (!ids.has(id)) enemyVisualRotationsRef.current.delete(id);
    }
    enemies.forEach((e, id) => {
      const prev = enemyTransformsRef.current.get(id);
      if (!prev) {
        enemyTransformsRef.current.set(id, {
          position: { x: e.position.x, y: e.position.y, z: e.position.z },
          rotation: e.rotation,
        });
      }
    });
  }, [enemies]);
  const [killCount, setKillCount] = useState(0);
  const [skeletonKillCount, setSkeletonKillCount] = useState(0);
  const [skeletonKillRequired, setSkeletonKillRequired] = useState(8);
  const [gameStarted, setGameStarted] = useState(false);
  const [combatArenaActive, setCombatArenaActive] = useState(true);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'coop'>('multiplayer');
  const [campTypes, setCampTypes] = useState<string[]>([]);
  const [thronePortalOffer, setThronePortalOffer] = useState<string[]>([]);
  const [thronePortalLayout, setThronePortalLayout] = useState<'rim' | 'center'>('rim');
  const [coopMainArenaPortalPhase, setCoopMainArenaPortalPhase] = useState<
    | 'pick_wave2'
    | 'pick_pre_boss'
    | 'pre_boss_reward'
    | 'pre_boss_merchant'
    | 'pick_boss'
    | 'pick_post_boss'
    | 'pick_sunken_entry'
    | 'pick_eternity_entry'
    | 'pick_eternity_late_entry'
    | 'pick_trinity_finale'
    | 'eden_exit'
    | null
  >(null);
  const [coopCurrentRoomKind, setCoopCurrentRoomKind] = useState<CoopRoomKind | null>(null);
  const [coopClearedRoomKind, setCoopClearedRoomKind] = useState<CoopRoomKind | null>(null);
  const [coopColoredRoomVisitIndex, setCoopColoredRoomVisitIndex] = useState<number | null>(null);
  const [coopBossRoomVisitIndex, setCoopBossRoomVisitIndex] = useState<number | null>(null);
  /** Server-authoritative CustomSky preset index for the current co-op room. */
  const [coopSkyPresetIndex, setCoopSkyPresetIndex] = useState(0);
  /** Server-authoritative StylizedGrass preset index for prep ThroneRoom. */
  const [coopGrassPresetIndex, setCoopGrassPresetIndex] = useState(0);
  const [coopBossThroneArena, setCoopBossThroneArena] = useState(false);
  const [coopThroneBossKind, setCoopThroneBossKind] = useState<'boss' | 'boss2' | 'boss3' | 'destiny' | 'boss_all' | null>(null);
  const [coopTerrainTheme, setCoopTerrainTheme] = useState<CoopTerrainTheme>('purple');
  const [coopTransitionOverlay, setCoopTransitionOverlay] = useState(false);
  const coopTransitionOverlayRef = useRef(false);
  const coopPendingPortalSnapRef = useRef(false);
  const coopRoomEntryTokenRef = useRef(0);
  const coopCombatArenaEnterAtRef = useRef(0);
  const [coopPortalBlinkSeq, setCoopPortalBlinkSeq] = useState(0);
  const pendingLocalPortalBlinkRef = useRef(false);
  const [coopCombatTransitionId, setCoopCombatTransitionId] = useState<number | null>(null);
  const coopCombatTransitionIdRef = useRef<number | null>(null);
  const syncCoopCombatTransitionId = useCallback((id: number | null) => {
    coopCombatTransitionIdRef.current = id;
    setCoopCombatTransitionId(id);
  }, []);
  const [coopCombatArenaEnterSeq, setCoopCombatArenaEnterSeq] = useState(0);
  const [coopMainArenaIntermissionSeq, setCoopMainArenaIntermissionSeq] = useState(0);
  const [coopIntroIntermissionSeq, setCoopIntroIntermissionSeq] = useState(0);
  const [coopSunkenIntermissionSeq, setCoopSunkenIntermissionSeq] = useState(0);
  const [coopEternityIntermissionSeq, setCoopEternityIntermissionSeq] = useState(0);
  const [coopFaeRealmIntermissionSeq, setCoopFaeRealmIntermissionSeq] = useState(0);
  const [coopIntroPending, setCoopIntroPending] = useState(false);
  const [coopIntroActive, setCoopIntroActive] = useState(false);
  const [coopIntroRoomIndex, setCoopIntroRoomIndex] = useState(0);
  const [coopIntroPortalOpen, setCoopIntroPortalOpen] = useState(false);
  const [coopIntroFountainPhase, setCoopIntroFountainPhase] = useState(false);
  const [coopIntroFountainUsed, setCoopIntroFountainUsed] = useState(false);
  const [coopIntroAllyChoiceMade, setCoopIntroAllyChoiceMade] = useState(false);
  const [coopFaeRealmPending, setCoopFaeRealmPending] = useState(false);
  const [coopFaeRealmActive, setCoopFaeRealmActive] = useState(false);
  const [coopFaeRealmRoomIndex, setCoopFaeRealmRoomIndex] = useState(0);
  const [coopFaeRealmPortalOpen, setCoopFaeRealmPortalOpen] = useState(false);
  const [coopFaeRealmBossKind, setCoopFaeRealmBossKind] = useState<FaeBeastCompanionKind | null>(null);
  const [coopFaeBeastCompanionGranted, setCoopFaeBeastCompanionGranted] = useState(false);
  const [coopFaeBeastCompanionKind, setCoopFaeBeastCompanionKind] = useState<FaeBeastCompanionKind | null>(null);
  const [coopSunkenActive, setCoopSunkenActive] = useState(false);
  const [coopSunkenRoomIndex, setCoopSunkenRoomIndex] = useState(0);
  const [coopSunkenPortalOpen, setCoopSunkenPortalOpen] = useState(false);
  const [coopSunkenFountainPhase, setCoopSunkenFountainPhase] = useState(false);
  const [coopSunkenFountainUsed, setCoopSunkenFountainUsed] = useState(false);
  const [coopSunkenAllyChoiceMade, setCoopSunkenAllyChoiceMade] = useState(false);
  const [coopSunkenLootOffer, setCoopSunkenLootOffer] = useState<DreamLayerStockItem[]>([]);
  const [coopSunkenLootClaimedPlayerIds, setCoopSunkenLootClaimedPlayerIds] = useState<string[]>([]);
  const [coopSunkenLootPhaseComplete, setCoopSunkenLootPhaseComplete] = useState(false);
  const [coopSunkenCompleted, setCoopSunkenCompleted] = useState(false);
  const [coopEternityActive, setCoopEternityActive] = useState(false);
  const [coopEternityRoomIndex, setCoopEternityRoomIndex] = useState(0);
  const [coopEternityPortalOpen, setCoopEternityPortalOpen] = useState(false);
  const [coopEternityFountainPhase, setCoopEternityFountainPhase] = useState(false);
  const [coopEternityFountainUsed, setCoopEternityFountainUsed] = useState(false);
  const [coopEternityLootOffer, setCoopEternityLootOffer] = useState<DreamLayerStockItem[]>([]);
  const [coopEternityLootClaimedPlayerIds, setCoopEternityLootClaimedPlayerIds] = useState<string[]>([]);
  const [coopEternityLootPhaseComplete, setCoopEternityLootPhaseComplete] = useState(false);
  const [coopPetCompanionUpgrade, setCoopPetCompanionUpgrade] = useState<string | null>(null);
  const [coopEternityCompleted, setCoopEternityCompleted] = useState(false);
  const [coopAllyKind, setCoopAllyKind] = useState<CoopAllyKind>('knight');
  const [coopAllyOffer, setCoopAllyOffer] = useState<CoopAllyKind[]>([]);
  const [coopVoidPortalOffered, setCoopVoidPortalOffered] = useState(false);
  const [coopDeepSanctumLevel, setCoopDeepSanctumLevel] = useState(0);
  const [deepSanctumRewardKind, setDeepSanctumRewardKind] = useState<DeepSanctumRewardKind | null>(null);
  const [coopEdenFountainUsed, setCoopEdenFountainUsed] = useState(false);
  const [coopEdenResumeKind, setCoopEdenResumeKind] = useState<CoopRoomKind | null>(null);
  const [coopEdenIntermissionSeq, setCoopEdenIntermissionSeq] = useState(0);
  const [coopFalseEdenCleared, setCoopFalseEdenCleared] = useState(false);
  const [deliriumStructure, setDeliriumStructure] = useState<DeliriumStructureState | null>(null);
  const [coopDeliriumActive, setCoopDeliriumActive] = useState(false);
  const [coopDeliriumEventEnded, setCoopDeliriumEventEnded] = useState(false);
  const [coopDeliriumSuccess, setCoopDeliriumSuccess] = useState(false);
  const [coopErebusGateActive, setCoopErebusGateActive] = useState(false);
  const [coopDeepSanctumIntermissionSeq, setCoopDeepSanctumIntermissionSeq] = useState(0);
  const [coopBossClearedBgmSeq, setCoopBossClearedBgmSeq] = useState(0);
  const [coopClearedRoomColor, setCoopClearedRoomColor] = useState<string | null>(null);
  const [lateJoinCombatLoadout, setLateJoinCombatLoadout] = useState<{
    weapon: WeaponType;
    subclass: WeaponSubclass;
  } | null>(null);
  const [mushroomState, setMushroomState] = useState<{ health: number[]; maxHealth: number } | null>(null);
  const [currentPreview, setCurrentPreview] = useState<RoomPreview | null>(null);
  const [selectedWeapons, setSelectedWeaponsState] = useState<{
    primary: WeaponType;
    secondary: WeaponType;
  }>({
    primary: WeaponType.NONE,
    secondary: WeaponType.NONE,
  });
  const [selectedArchetype, setSelectedArchetypeState] = useState<Archetype>(ARCHETYPE_ROGUE);
  const [selectedWeaponAspect, setSelectedWeaponAspectState] = useState<WeaponAspect>(ASPECT_LEGIONNAIRE);
  const [weaponAspectByWeapon, setWeaponAspectByWeapon] = useState<WeaponAspectByWeapon>({});
  const [skillPointData, setSkillPointData] = useState<SkillPointData>(SkillPointSystem.getInitialSkillPointData());
  const [statPointData, setStatPointData] = useState<StatPointData>(StatSystem.getInitialStatPointData());
  const [abilityLoadout, setAbilityLoadoutState] = useState<AbilityLoadout | null>(() => getDefaultLoadout());
  const [talentLoadout, setTalentLoadoutState] = useState<TalentLoadout>(() => createDefaultTalentLoadout());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Item drop & inventory state
  const [droppedItems, setDroppedItems] = useState<Map<string, DroppedItem>>(new Map());
  const [goldDrops, setGoldDrops] = useState<Map<string, GoldDrop>>(new Map());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const inventoryRef = useRef<InventoryItem[]>([]);
  inventoryRef.current = inventory;
  const [merchantInventory, setMerchantInventory] = useState<MerchantStockItem[]>([]);
  const [merchantPurchaseState, setMerchantPurchaseState] = useState<MerchantPurchaseState>({
    dashChargePurchased: false,
    weaponTalentPurchases: 0,
    oxygenPurchases: 0,
    warpdrivePurchases: 0,
    healPurchasedThisVisit: false,
    weaponTalentPurchasedThisVisit: false,
    utilityPurchasedThisVisit: false,
    backfillDashPurchasedThisVisit: false,
    backfillTalentPurchasedThisVisit: false,
  });
  const [dreamLayerInventory, setDreamLayerInventory] = useState<DreamLayerStockItem[]>([]);
  const [dreamLayerPurchaseState, setDreamLayerPurchaseState] = useState<DreamLayerPurchaseState>({
    healPurchasedThisVisit: false,
    wardingPurchasedThisVisit: false,
    legendaryAPurchasedThisVisit: false,
    legendaryBPurchasedThisVisit: false,
    ringPurchasedThisVisit: false,
  });
  const merchantPurchaseSuccessHandlersRef = useRef<
    Set<(payload: MerchantPurchaseSuccessPayload) => void>
  >(new Set());
  const deepSanctumRewardClaimedHandlersRef = useRef<
    Set<(payload: DeepSanctumRewardClaimedPayload) => void>
  >(new Set());
  const merchantNpcGreetHandlersRef = useRef<
    Set<(payload: { kind: string }) => void>
  >(new Set());
  const playerGoldChangedHandlersRef = useRef<
    Set<(payload: { playerId: string; gold: number }) => void>
  >(new Set());
  const playerFlowChangedHandlersRef = useRef<
    Set<(payload: { playerId: string; flow: number }) => void>
  >(new Set());
  const playerFateChangedHandlersRef = useRef<
    Set<(payload: { playerId: string; fate: number }) => void>
  >(new Set());
  const bossDefeatedHandlersRef = useRef<
    Set<(payload: BossDefeatedPayload) => void>
  >(new Set());
  const bossItemPickupHandlersRef = useRef<
    Set<(payload: BossItemPickupPayload) => void>
  >(new Set());
  const runePickupHandlersRef = useRef<
    Set<(payload: RunePickupPayload) => void>
  >(new Set());

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  /** Deferred `io()` so React Strict Mode’s mount→unmount→mount does not disconnect a half-open socket. */
  const socketConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSocketRef = useRef<Socket | null>(null);

  // Throttling refs to prevent infinite re-render loops
  const lastPlayerMoveUpdate = useRef<{ [playerId: string]: number }>({});
  const lastLocalPositionEmitRef = useRef({ time: 0, x: 0, y: 0, z: 0, ry: 0 });
  const lastPlayerHealthUpdate = useRef<{ [playerId: string]: number }>({});
  const lastEnemyMoveUpdate = useRef<{ [enemyId: string]: number }>({});
  const enemyDamageListenersRef = useRef<Set<ConfirmedEnemyDamageListener>>(new Set());
  /** Coalesce many `enemy-removed` events (wave end) into one `setEnemies` per frame. */
  const pendingEnemyRemovalsRef = useRef<Set<string>>(new Set());
  const enemyRemovalRafRef = useRef<number | null>(null);
  const cancelPendingEnemyRemovals = useCallback(() => {
    if (enemyRemovalRafRef.current != null) {
      cancelAnimationFrame(enemyRemovalRafRef.current);
      enemyRemovalRafRef.current = null;
    }
    pendingEnemyRemovalsRef.current.clear();
  }, []);

  const subscribeEnemyDamage = useCallback((listener: ConfirmedEnemyDamageListener) => {
    enemyDamageListenersRef.current.add(listener);
    return () => {
      enemyDamageListenersRef.current.delete(listener);
    };
  }, []);

  const notifyEnemyDamageListeners = useCallback((event: ConfirmedEnemyDamageEvent) => {
    enemyDamageListenersRef.current.forEach((listener) => listener(event));
  }, []);

  // Initialize socket connection
  useEffect(() => {
    installWebGlDiagnostics();

    const serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://empyrea-game-backend.fly.dev'
        : 'http://localhost:8080');

    console.log('🔌 Connecting to multiplayer server:', serverUrl);

    socketConnectTimerRef.current = setTimeout(() => {
      socketConnectTimerRef.current = null;
      const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Prefer websocket first
      timeout: 20000,
      forceNew: true,
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: true // Remember successful upgrades
    });

    activeSocketRef.current = newSocket;

    // Store the socket in state
    setSocket(newSocket);

    // Store event handlers for cleanup
    const eventHandlers = new Map<string, (...args: any[]) => void>();

    // Helper function to add event handler with cleanup tracking
    const addEventHandler = (event: string, handler: (...args: any[]) => void) => {
      eventHandlers.set(event, handler);
      newSocket.on(event, handler);
    };

    // Connection event handlers
    addEventHandler('connect', () => {
      console.log('✅ Connected to multiplayer server');
      setIsConnected(true);
      setConnectionError(null);

      // Start heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      heartbeatInterval.current = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('heartbeat');
        }
      }, 15000); // Send heartbeat every 15 seconds
    });

    addEventHandler('connecting', () => {
      console.log('🔄 Connecting to multiplayer server...');
    });

    addEventHandler('disconnect', (reason) => {
      recordMultiplayerDisconnect(String(reason));
      console.log('❌ Disconnected from server:', reason);
      cancelPendingEnemyRemovals();
      setIsConnected(false);
      setSocket(null); // Clear socket reference
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      enemyTransformsRef.current.clear();
      enemyVisualRotationsRef.current.clear();
      playersTransformsRef.current.clear();
      setCampTypes([]);
      setCoopTerrainTheme('purple');
      setCoopSkyPresetIndex(0);
      setCoopGrassPresetIndex(0);
      setSkeletonKillCount(0);
      setSkeletonKillRequired(8);
      setDroppedItems(new Map());
      setGoldDrops(new Map());
      setInventory([]);
      setMerchantInventory([]);
      setDreamLayerInventory([]);
      setDreamLayerPurchaseState({
        healPurchasedThisVisit: false,
        wardingPurchasedThisVisit: false,
        legendaryAPurchasedThisVisit: false,
        legendaryBPurchasedThisVisit: false,
        ringPurchasedThisVisit: false,
      });

      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    });

    addEventHandler('connect_error', (error) => {
      console.error('🔥 Connection error:', error);
      console.error('🔥 Error details:', error.message, error);
      setConnectionError(error.message);
      setIsConnected(false);
      // Don't clear socket reference immediately on connection error - let reconnection handle it
    });

    // Room event handlers
    addEventHandler('room-joined', (data) => {
      console.log('🏠 Joined room:', data);
      (window as any).controlSystemRef?.current?.setReaperCrossentropyStack(0);
      (window as any).controlSystemRef?.current?.setBackstabKillstreakStack(0);
      cancelPendingEnemyRemovals();
      setIsInRoom(true);
      setCurrentRoomId(data.roomId);
      setKillCount(data.killCount);
      setGameStarted(data.gameStarted);
      setGameMode(data.gameMode || 'multiplayer'); // Set game mode from server
      applyCoopCombatArenaActiveFromServer(
        data.gameMode || 'multiplayer',
        data.combatArenaActive,
        setCombatArenaActive,
      );

      // Update players
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
      const localJoin = data.players.find((p: Player) => p.id === socket?.id);
      if (localJoin && typeof (localJoin as any).coopPetCompanionUpgrade === 'string') {
        setCoopPetCompanionUpgrade((localJoin as any).coopPetCompanionUpgrade);
      }

      // Update enemies (only for multiplayer mode)
      // Co-op mode - initialize enemies
      const enemiesMap = new Map();
      if (data.enemies) {
        data.enemies.forEach((enemy: Enemy) => {
          enemiesMap.set(enemy.id, { ...enemy, staggerBuildup: enemy.staggerBuildup ?? 0 });
        });
      }
      setEnemies(enemiesMap);
      const initialGoldDrops = new Map<string, GoldDrop>();
      if (Array.isArray((data as { goldDrops?: GoldDrop[] }).goldDrops)) {
        for (const drop of (data as { goldDrops: GoldDrop[] }).goldDrops) {
          if (drop?.id) {
            initialGoldDrops.set(drop.id, drop);
          }
        }
      }
      setGoldDrops(initialGoldDrops);
      setCampTypes(campArchetypeFromRoomPayload(data));
      if (Array.isArray((data as { thronePortalOffer?: string[] }).thronePortalOffer)) {
        setThronePortalOffer([...(data as { thronePortalOffer: string[] }).thronePortalOffer]);
      } else {
        setThronePortalOffer([]);
      }
      setThronePortalLayout(
        normalizeThronePortalLayout((data as { thronePortalLayout?: string }).thronePortalLayout),
      );
      setCoopMainArenaPortalPhase(
        normalizeCoopMainArenaPhase((data as { coopMainArenaPortalPhase?: string }).coopMainArenaPortalPhase),
      );
      setCoopBossThroneArena(
        normalizeCoopBossThroneArena((data as { coopBossThroneArena?: boolean }).coopBossThroneArena),
      );
      if ('coopThroneBossKind' in (data as object)) {
        setCoopThroneBossKind(normalizeCoopThroneBossKind((data as { coopThroneBossKind?: unknown }).coopThroneBossKind));
      } else {
        setCoopThroneBossKind(null);
      }
      setCoopTerrainTheme(normalizeCoopTerrainTheme((data as { coopTerrainTheme?: unknown }).coopTerrainTheme));
      setCoopCurrentRoomKind(normalizeCoopRoomKind((data as { coopCurrentRoomKind?: string }).coopCurrentRoomKind));
      setCoopClearedRoomKind(normalizeCoopRoomKind((data as { coopClearedRoomKind?: string }).coopClearedRoomKind));
      setCoopColoredRoomVisitIndex(
        normalizeCoopColoredRoomVisitIndex((data as { coopColoredRoomVisitIndex?: unknown }).coopColoredRoomVisitIndex),
      );
      setCoopBossRoomVisitIndex(
        normalizeCoopBossRoomVisitIndex((data as { coopBossRoomVisitIndex?: unknown }).coopBossRoomVisitIndex),
      );
      if ('coopSkyPresetIndex' in (data as object)) {
        const skyIdx = Number((data as { coopSkyPresetIndex?: unknown }).coopSkyPresetIndex);
        if (Number.isFinite(skyIdx)) {
          setCoopSkyPresetIndex(Math.max(0, Math.floor(skyIdx)));
        }
      }
      if ('coopGrassPresetIndex' in (data as object)) {
        const grassIdx = Number((data as { coopGrassPresetIndex?: unknown }).coopGrassPresetIndex);
        if (Number.isFinite(grassIdx)) {
          setCoopGrassPresetIndex(Math.max(0, Math.floor(grassIdx)));
        }
      }
      setMerchantInventory(normalizeMerchantInventory((data as { merchantInventory?: unknown }).merchantInventory));
      const ms = (data as { mushroomState?: { health?: number[]; maxHealth?: number } }).mushroomState;
      if (ms?.health && Array.isArray(ms.health)) {
        setMushroomState({ health: [...ms.health], maxHealth: ms.maxHealth ?? 10 });
      } else {
        setMushroomState(null);
      }

      const lj = (data as { lateJoinCombatLoadout?: { weapon?: string; subclass?: string } | null })
        .lateJoinCombatLoadout;
      if (lj?.weapon) {
        const w = lj.weapon.toUpperCase() as WeaponType;
        const sc = (lj.subclass?.toUpperCase() ?? 'ELEMENTAL') as WeaponSubclass;
        setLateJoinCombatLoadout({ weapon: w, subclass: sc });
      } else {
        setLateJoinCombatLoadout(null);
      }

      const rejoinTransitionId = (data as { coopCombatTransitionId?: number | null }).coopCombatTransitionId;
      const parsedRejoinTransition = rejoinTransitionId != null ? Number(rejoinTransitionId) : NaN;
      if (Number.isFinite(parsedRejoinTransition)) {
        syncCoopCombatTransitionId(parsedRejoinTransition);
        coopTransitionOverlayRef.current = true;
        coopPendingPortalSnapRef.current = true;
        setCoopTransitionOverlay(true);
      }
      applyDeepSanctumSnapshot(data, {
        setCoopVoidPortalOffered,
        setCoopDeepSanctumLevel,
        setDeepSanctumRewardKind,
      });
      applyEdenSnapshot(data, {
        setCoopEdenFountainUsed,
        setCoopEdenResumeKind,
        setCoopFalseEdenCleared,
        setDeliriumStructure,
        setCoopDeliriumActive,
        setCoopDeliriumEventEnded,
        setCoopDeliriumSuccess,
        setCoopErebusGateActive,
      });
    });

    addEventHandler('delirium-structure-updated', (data: any) => {
      if ('deliriumStructure' in data) {
        setDeliriumStructure(normalizeDeliriumStructure(data.deliriumStructure));
      }
    });

    addEventHandler('camps-initialized', (data: { campTypes?: string[]; coopTerrainTheme?: unknown; coopCurrentRoomKind?: string }) => {
      const next = campArchetypeFromRoomPayload({ campTypes: data.campTypes });
      if (next.length > 0) setCampTypes(next);
      setCoopTerrainTheme(normalizeCoopTerrainTheme(data.coopTerrainTheme));
      if (data.coopCurrentRoomKind != null) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
    });

    addEventHandler('room-full', () => {
      setConnectionError('Room is full (max 5 players)');
    });

    // Handle player level changes (for tertiary weapon unlocks)
    addEventHandler('player-level-changed', (data) => {
      const { playerId, level } = data;
      console.log(`📈 Player ${playerId} leveled up to ${level}`);

      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(playerId);
        if (player) {
          updated.set(playerId, { ...player, level });
        }
        return updated;
      });
    });

    addEventHandler('player-joined', (data) => {
      console.log('👤 Player joined:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
    });

    addEventHandler('player-left', (data) => {
      console.log('👋 Player left:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      // Prune throttle timestamps for the departed player
      if (data.playerId) {
        delete lastPlayerMoveUpdate.current[data.playerId];
        delete lastPlayerHealthUpdate.current[data.playerId];
      }
      setPlayers(playersMap);
    });

    // Ref-only movement updates — avoids ~60 Hz React re-renders of the full scene tree.
    addEventHandler('player-moved', (data) => {
      const expectedToken = coopRoomEntryTokenRef.current;
      if (expectedToken > 0) {
        const token = Number(data?.coopRoomEntryToken ?? 0);
        if (token !== expectedToken) return;
      }
      applyPlayerMove(playersTransformsRef, playersRef, {
        playerId: data.playerId,
        position: data.position,
        rotation: data.rotation,
        movementDirection: data.movementDirection,
      });
    });

    addEventHandler('player-weapon-changed', (data) => {
      const weapon = data.weapon as WeaponType;
      patchPlayerRef(playersRef, data.playerId, {
        weapon,
        subclass: data.subclass,
        ...(data.weaponAspect != null
          ? { weaponAspect: normalizeWeaponAspect(data.weaponAspect, weapon) }
          : { weaponAspect: defaultWeaponAspect(weapon) }),
      });
      bumpPlayerRosterMetaRev();
    });

    addEventHandler('player-archetype-changed', (data) => {
      patchPlayerRef(playersRef, data.playerId, {
        archetype: normalizeArchetype(data.archetype),
      });
      bumpPlayerRosterMetaRev();
    });

    addEventHandler('player-weapon-aspect-changed', (data) => {
      const existing = playersRef.current.get(data.playerId);
      const weapon = (existing?.weapon ?? WeaponType.NONE) as WeaponType;
      patchPlayerRef(playersRef, data.playerId, {
        weaponAspect: normalizeWeaponAspect(data.aspect, weapon),
      });
      bumpPlayerRosterMetaRev();
    });

    addEventHandler('player-health-updated', (data) => {
      // Throttle player health updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastPlayerHealthUpdate.current[data.playerId] || 0;
      if (now - lastUpdate < 100) { // Throttle to 10fps for health updates
        return;
      }
      lastPlayerHealthUpdate.current[data.playerId] = now;

      // Ref-only — avoids full scene re-render on every health tick.
      patchPlayerRef(playersRef, data.playerId, {
        health: data.health,
        maxHealth: data.maxHealth,
      });
    });

    addEventHandler('player-damaged', (data: {
      targetPlayerId?: string;
      newHealth?: number;
      maxHealth?: number;
    }) => {
      if (!data.targetPlayerId || typeof data.newHealth !== 'number') return;
      patchPlayerRef(playersRef, data.targetPlayerId, {
        health: data.newHealth,
        maxHealth: data.maxHealth,
      });
    });

    // Enemy event handlers (for multiplayer and co-op modes)
    addEventHandler('enemy-spawned', (data) => {
      setEnemies(prev => {
        const updated = new Map(prev);
        const e = data.enemy as Enemy;
        updated.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
        return updated;
      });
    });

    addEventHandler('titan-bladestorm-start', (data: {
      titanId: string;
      startTime: number;
      soulType?: string;
    }) => {
      patchEnemyRef(enemiesRef, data.titanId, {
        bladestormActive: true,
        bladestormStartTime: data.startTime,
      });
    });

    addEventHandler('reaper-crossentropy-stack', (data: { stacks: number }) => {
      (window as any).controlSystemRef?.current?.setReaperCrossentropyStack(data.stacks ?? 0);
    });

    addEventHandler('backstab-killstreak-stack', (data: { stacks: number }) => {
      (window as any).controlSystemRef?.current?.setBackstabKillstreakStack(data.stacks ?? 0);
    });

    addEventHandler('sabres-relentless-backstab-kill', () => {
      (window as any).controlSystemRef?.current?.resetBackstabCooldownForRelentless();
    });

    addEventHandler('mushroom-damaged', (data: { index: number; newHealth: number; maxHealth: number; damage?: number }) => {
      setMushroomState((prev) => {
        if (!prev) return prev;
        const h = [...prev.health];
        if (data.index >= 0 && data.index < h.length) h[data.index] = data.newHealth;
        return { health: h, maxHealth: data.maxHealth ?? prev.maxHealth };
      });

      if (typeof data.damage === 'number' && data.damage > 0) {
        const inst = buildMushroomInstances()[data.index];
        if (inst) {
          const mgr = (window as any).damageNumberManager;
          if (mgr?.addDamageNumber) {
            const c = getMushroomColliderCenter(inst);
            const pos = new Vector3(c.x, c.y + 1.0, c.z);
            mgr.addDamageNumber(data.damage, false, pos, 'mushroom');
          }
        }
      }
    });

    addEventHandler('mushroom-destroyed', (data: { index: number }) => {
      setMushroomState((prev) => {
        if (!prev) return prev;
        const h = [...prev.health];
        if (data.index >= 0 && data.index < h.length) h[data.index] = 0;
        return { ...prev, health: h };
      });
    });

    addEventHandler('enemy-damaged', (data) => {
      const isThroneDummy = String(data.enemyId || '').startsWith('throne-training-dummy');
      /** Do not stack floating DoT text on lethal / zero-HP snapshots (death uses other VFX/sounds). */
      const skipDotFloating =
        data.wasKilled === true ||
        (typeof data.newHealth === 'number' &&
          data.newHealth <= 0 &&
          !isThroneDummy);

      if (
        !skipDotFloating &&
        (data.damageType === 'ignite' ||
          data.damageType === 'shadowflame' ||
          data.damageType === 'venom' ||
          data.damageType === 'entanglement' ||
          data.damageType === 'allied_enchantress_entanglement' ||
          data.damageType === 'wyvern_talons_detonate' ||
          data.damageType === 'player_zombie' ||
          data.damageType === 'vengeful_spirit' ||
          data.damageType === 'zombie_explosion' ||
          data.damageType === 'allied_knight' ||
          data.damageType === 'allied_huntress' ||
          data.damageType === 'allied_phantom' ||
          data.damageType === 'allied_demon' ||
          data.damageType === 'allied_enchantress' ||
          data.damageType === 'allied_tiger' ||
          data.damageType === 'allied_wolf' ||
          data.damageType === 'allied_bear' ||
          data.damageType === 'allied_serpent' ||
          data.damageType === 'allied_spider' ||
          data.damageType === 'hatemail' ||
          data.damageType === 'mushroom_eruption' ||
          data.damageType === 'prime_materia' ||
          data.damageType === 'incineration' ||
          data.damageType === 'archmage_flame_pillar' ||
          (data.damageType === 'crossentropy' && data.crossentropyMeteorDamage === true) ||
          (data.damageType === 'cloudkill' && data.cloudkillDamage === true)) &&
        typeof data.damage === 'number' &&
        data.damage > 0 &&
        data.position
      ) {
        const mgr = (window as any).damageNumberManager;
        if (mgr?.addDamageNumber) {
          const pos = new Vector3(data.position.x, data.position.y + 1.5, data.position.z);
          const dt =
            data.damageType === 'venom' || data.damageType === 'wyvern_talons_detonate' || data.damageType === 'entanglement'
              ? 'venom'
              : data.damageType === 'allied_enchantress_entanglement'
                ? 'allied_enchantress_entanglement'
              : data.damageType === 'crossentropy'
                ? 'crossentropy'
                : data.damageType === 'cloudkill'
                  ? 'cloudkill'
                  : data.damageType === 'player_zombie' || data.damageType === 'zombie_explosion'
                  ? 'player_zombie'
                  : data.damageType === 'vengeful_spirit'
                  ? 'vengeful_spirit'
                  : data.damageType === 'allied_knight'
                  ? 'allied_knight'
                  : data.damageType === 'allied_huntress'
                  ? 'allied_huntress'
                  : data.damageType === 'allied_phantom'
                  ? 'allied_phantom'
                  : data.damageType === 'allied_demon'
                  ? 'allied_demon'
                  : data.damageType === 'allied_enchantress'
                  ? 'allied_enchantress'
                  : data.damageType === 'allied_tiger'
                  ? 'allied_tiger'
                  : data.damageType === 'allied_wolf'
                  ? 'allied_wolf'
                  : data.damageType === 'allied_bear'
                  ? 'allied_bear'
                  : data.damageType === 'allied_serpent'
                  ? 'allied_serpent'
                  : data.damageType === 'allied_spider'
                  ? 'allied_spider'
                  : data.damageType === 'hatemail'
                  ? 'hatemail'
                  : data.damageType === 'mushroom_eruption'
                  ? 'mushroom_eruption'
                  : data.damageType === 'prime_materia'
                  ? 'prime_materia'
                  : data.damageType === 'incineration'
                  ? 'incineration'
                  : data.damageType === 'archmage_flame_pillar'
                  ? 'ignite'
                  : data.damageType === 'shadowflame'
                  ? 'shadowflame'
                  : 'ignite';
          mgr.addDamageNumber(data.damage, !!data.isCritical, pos, dt);
        }
      }

      // Allied knight / demon / player-zombie melee hit SFX (cancel pending miss whoosh)
      if (
        typeof data.damage === 'number' &&
        data.damage > 0 &&
        data.position &&
        (data.damageType === 'allied_knight' ||
          data.damageType === 'allied_demon' ||
          data.damageType === 'player_zombie' ||
          data.damageType === 'vengeful_spirit')
      ) {
        const hitPos = {
          x: data.position.x,
          y: data.position.y ?? 0,
          z: data.position.z,
        };
        if (data.damageType === 'allied_knight') {
          // Only play knight-style hit when a melee miss was pending (smite has its own SFX)
          if (cancelKnightStyleMiss(data.sourceAlliedUnitId)) {
            playKnightStyleHit(hitPos);
          }
        } else if (data.damageType === 'allied_demon') {
          cancelKnightStyleMiss(data.sourceAlliedUnitId);
          playKnightStyleHit(hitPos);
        } else if (data.damageType === 'player_zombie') {
          cancelKnightStyleMiss(data.sourceZombieId);
          playKnightStyleHit(hitPos);
        } else if (data.damageType === 'vengeful_spirit') {
          cancelKnightStyleMiss(data.sourceAlliedUnitId);
          playVengefulSpiritHitSound(hitPos);
        }
      }

      if (
        typeof data.damageEventId === 'number' &&
        typeof data.enemyId === 'string' &&
        typeof data.damage === 'number' &&
        typeof data.newHealth === 'number' &&
        typeof data.maxHealth === 'number'
      ) {
        notifyEnemyDamageListeners({
          damageEventId: data.damageEventId,
          enemyId: data.enemyId,
          newHealth: data.newHealth,
          maxHealth: data.maxHealth,
          damage: data.damage,
          fromPlayerId: data.fromPlayerId ?? null,
          wasKilled: data.wasKilled,
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
          damageType: typeof data.damageType === 'string' ? data.damageType : undefined,
          crossentropyMeteorDamage: data.crossentropyMeteorDamage === true,
          cloudkillDamage: data.cloudkillDamage === true,
          position: data.position,
        });
      }

      const urgent = data.wasKilled === true;

      const isThroneDummyEnemy = String(data.enemyId || '').startsWith('throne-training-dummy');
      const shouldMarkDying =
        !isThroneDummyEnemy &&
        data.enemyId &&
        (data.wasKilled === true ||
          (typeof data.newHealth === 'number' && data.newHealth <= 0));

      // Always patch live ref (HP bar readers use enemiesRef in useFrame).
      patchEnemyRef(enemiesRef, data.enemyId, {
        health: data.newHealth,
        maxHealth: data.maxHealth,
        ...(shouldMarkDying ? { isDying: true } : {}),
      });

      if (shouldMarkDying && data.wasKilled === true) {
        const enemy = enemiesRef.current.get(data.enemyId);
        if (enemy) {
          const killPos = data.position ?? enemy.position;
          (window as any).audioSystem?.playEnemyKillFeedback(killPos, enemy.type);
        }
      }

      // React roster update only on kill (isDying) — rare; skip routine damage ticks.
      if (urgent || shouldMarkDying) {
        setEnemies((prev) => {
          const updated = new Map(prev);
          const enemy = updated.get(data.enemyId);
          if (enemy) {
            enemy.health = data.newHealth;
            enemy.maxHealth = data.maxHealth;
            if (shouldMarkDying) {
              enemy.isDying = true;
            }
          }
          return updated;
        });
      }
    });

    addEventHandler('enemy-stagger-updated', (data: { enemyId: string; stagger: number }) => {
      patchEnemyRef(enemiesRef, data.enemyId, { staggerBuildup: data.stagger });
    });

    addEventHandler('enemy-concentrated-venom-updated', (data: {
      enemyId: string;
      stacks: number;
      expireAt?: number | null;
    }) => {
      if (!data.enemyId) return;
      patchEnemyRef(enemiesRef, data.enemyId, {
        concentratedVenomStacks: typeof data.stacks === 'number' ? data.stacks : 0,
        concentratedVenomExpireAt:
          typeof data.expireAt === 'number' && data.expireAt > 0 ? data.expireAt : undefined,
      });
    });

    addEventHandler('enemy-status-effect', (data: {
      enemyId: string;
      effectType: string;
      duration: number;
      timestamp: number;
    }) => {
      if (!data.enemyId) return;
      const ts = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      const duration = typeof data.duration === 'number' ? data.duration : 0;
      if (duration <= 0) return;
      if (data.effectType === 'stun') {
        patchEnemyRef(enemiesRef, data.enemyId, { stunnedUntilMs: ts + duration });
      } else if (data.effectType === 'slow') {
        patchEnemyRef(enemiesRef, data.enemyId, { slowedUntilMs: ts + duration });
      }
    });

    addEventHandler('allied-knight-orbs-updated', (data: {
      knightId?: string;
      slots?: boolean[];
      recoverAt?: number[];
    }) => {
      const knightId = data.knightId || 'allied-knight';
      const enemy = enemiesRef.current.get(knightId);
      if (!enemy) return;
      patchEnemyRef(enemiesRef, knightId, {
        alliedOrbSlots: Array.isArray(data.slots) ? [...data.slots] : enemy.alliedOrbSlots,
        alliedOrbRecoverAt: Array.isArray(data.recoverAt) ? [...data.recoverAt] : enemy.alliedOrbRecoverAt,
      });
    });

    addEventHandler('allied-knight-boons-updated', (data: {
      enemyId?: string;
      abyssalInitiate?: boolean;
    }) => {
      const enemyId = data.enemyId || 'allied-knight';
      if (!data.abyssalInitiate) return;
      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(enemyId);
        if (enemy) {
          updated.set(enemyId, { ...enemy, abyssalBoonApplied: true });
        }
        return updated;
      });
    });

    // Batched movement updates: ref-only — avoids ~30 Hz React re-renders of the full scene tree.
    addEventHandler('enemies-moved', (data: { moves: Array<{ enemyId: string; position: { x: number; y: number; z: number }; rotation: number; tigerLocomotion?: 'walk' | 'run'; terrorhawkPhase?: 'takeoff' | 'hover' | 'approach' | 'dive' | 'land' | 'ground_melee'; destinyPhase?: 'ground' | 'takeoff' | 'fly_idle' | 'fly_approach' | 'fly_attack' | 'fly_return' | 'land' }>; timestamp: number }) => {
      if (!data.moves || data.moves.length === 0) return;
      applyEnemyMoveBatch(enemyTransformsRef, enemiesRef, data.moves);
    });

    // Legacy single-enemy-moved handler (for backward compat with any old server)
    addEventHandler('enemy-moved', (data) => {
      applyEnemyMoveBatch(enemyTransformsRef, enemiesRef, [{
        enemyId: data.enemyId,
        position: data.position,
        rotation: data.rotation,
      }]);
    });

    // Update enemy health when a Weaver heals an ally (supports batched oak aura heals).
    addEventHandler('enemy-healed', (data) => {
      const entries = Array.isArray(data?.heals) ? data.heals : [data];
      for (const entry of entries) {
        if (!entry?.enemyId) continue;
        patchEnemyRef(enemiesRef, entry.enemyId, {
          health: entry.newHealth,
          maxHealth: entry.maxHealth,
        });
      }
    });

    addEventHandler('kill-count-updated', (data) => {
      setKillCount(data.killCount);
    });

    addEventHandler('skeleton-kill-count-updated', (data: {
      skeletonKillCount: number;
      required?: number;
    }) => {
      setSkeletonKillCount(data.skeletonKillCount);
      const r = Number(data.required);
      if (Number.isFinite(r) && r > 0) {
        setSkeletonKillRequired(Math.floor(r));
      }
    });

    // Item drop event handlers
    addEventHandler('item-dropped', (data: { item: DroppedItem }) => {
      setDroppedItems(prev => {
        const next = new Map(prev);
        next.set(data.item.id, data.item);
        return next;
      });
    });

    addEventHandler('item-picked-up', (data: { itemId: string; playerId: string; item: DroppedItem }) => {
      // Remove from world for everyone
      setDroppedItems(prev => {
        const next = new Map(prev);
        next.delete(data.itemId);
        return next;
      });
      // Grant / upgrade only for the player who picked it up
      if (newSocket.id && data.playerId === newSocket.id) {
        const isAmuletPickup =
          typeof data.item.type === 'string' && data.item.type.startsWith('AMULET_OF');
        if (isAmuletPickup) {
          (window as any).audioSystem?.playUITomePickupSound?.();
          if (data.item.stat != null) {
            runePickupHandlersRef.current.forEach((handler) => handler({
              stat: data.item.stat!,
            }));
          }
        }

        const invSnapshot = inventoryRef.current;
        const existing = invSnapshot.find((i) => i.type === data.item.type);
        let pickupOutcome: 'new' | 'upgrade' | 'discard' = 'new';

        if (data.item.category === 'boss_drop' && data.item.type) {
          if (isUpgradeableBossRelic(data.item.type)) {
            pickupOutcome = resolveBossRelicPickup(existing?.rarity, data.item.rarity);
          } else if (isUniqueDreamLayerItem(data.item.type) && existing) {
            pickupOutcome = 'discard';
          } else if (existing && data.item.category === 'boss_drop') {
            // Any other boss_drop type is unique — one copy only
            pickupOutcome = 'discard';
          }
        }

        if (pickupOutcome === 'discard') {
          return;
        }

        if (data.item.stat != null) {
          if (pickupOutcome === 'upgrade' && existing) {
            const delta = StatSystem.getBossRelicStatDelta(existing.statBonus, data.item.statBonus);
            if (delta > 0) {
              setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!, delta));
            }
          } else {
            const bonus = data.item.statBonus;
            if (bonus != null && bonus > 0) {
              setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!, bonus));
            } else if (bonus == null) {
              setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!));
            }
          }
        }

        setInventory((prev) => {
          const incoming = {
            id: data.itemId,
            type: data.item.type,
            stat: data.item.stat,
            label: data.item.label,
            category: data.item.category,
            statBonus: data.item.statBonus,
            rarity: data.item.rarity,
            bannedEnemyType: data.item.bannedEnemyType,
            iconPath: data.item.iconPath,
            pickedUpAt: Date.now(),
          };

          let next: InventoryItem[];
          if (pickupOutcome === 'upgrade') {
            next = prev.map((i) => (i.type === data.item.type ? incoming : i));
          } else {
            // Belt-and-suspenders: never keep two of the same boss_drop type
            if (
              data.item.category === 'boss_drop'
              && prev.some((i) => i.type === data.item.type)
            ) {
              return prev;
            }
            next = [...prev, incoming];
          }

          const bossDrops = next.filter((item) => item.category === 'boss_drop');
          if (bossDrops.length <= 7) return next;

          const sorted = [...bossDrops].sort((a, b) => {
            const rankA = a.rarity && isItemRarity(a.rarity) ? ITEM_RARITY_RANK[a.rarity] : -1;
            const rankB = b.rarity && isItemRarity(b.rarity) ? ITEM_RARITY_RANK[b.rarity] : -1;
            if (rankA !== rankB) return rankA - rankB;
            return (a.pickedUpAt ?? 0) - (b.pickedUpAt ?? 0);
          });
          const discardIds = new Set(sorted.slice(0, bossDrops.length - 7).map((item) => item.id));
          return next.filter((item) => item.category !== 'boss_drop' || !discardIds.has(item.id));
        });
        if (data.item.category === 'boss_drop') {
          bossItemPickupHandlersRef.current.forEach((handler) => handler({
            label: data.item.label ?? 'Artifact',
            rarity: data.item.rarity,
          }));
        }
      }
    });

    addEventHandler('item-pickup-discarded', (data: { itemId: string; playerId?: string; item?: DroppedItem }) => {
      setDroppedItems(prev => {
        const next = new Map(prev);
        next.delete(data.itemId);
        return next;
      });
    });

    addEventHandler('item-expired', (data: { itemId: string }) => {
      setDroppedItems(prev => {
        const next = new Map(prev);
        next.delete(data.itemId);
        return next;
      });
    });

    addEventHandler('gold-dropped', (data: { drop: GoldDrop }) => {
      if (!data?.drop?.id) return;
      setGoldDrops(prev => {
        const next = new Map(prev);
        next.set(data.drop.id, data.drop);
        return next;
      });
    });

    addEventHandler('gold-picked-up', (data: { dropId: string }) => {
      if (!data?.dropId) return;
      setGoldDrops(prev => {
        const next = new Map(prev);
        next.delete(data.dropId);
        return next;
      });
    });

    addEventHandler('gold-expired', (data: { dropId: string }) => {
      if (!data?.dropId) return;
      setGoldDrops(prev => {
        const next = new Map(prev);
        next.delete(data.dropId);
        return next;
      });
    });

    addEventHandler('player-gold-changed', (data: { playerId: string; gold: number }) => {
      if (!data?.playerId || typeof data.gold !== 'number') return;
      patchPlayerRef(playersRef, data.playerId, { gold: data.gold });
      playerGoldChangedHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('player-flow-changed', (data: { playerId: string; flow: number }) => {
      if (!data?.playerId || typeof data.flow !== 'number') return;
      patchPlayerRef(playersRef, data.playerId, { flow: data.flow });
      playerFlowChangedHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('player-fate-changed', (data: { playerId: string; fate: number }) => {
      if (!data?.playerId || typeof data.fate !== 'number') return;
      patchPlayerRef(playersRef, data.playerId, { fate: data.fate });
      playerFateChangedHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('merchant-inventory-updated', (data: {
      inventory?: unknown;
      merchantPurchaseStates?: Record<string, unknown>;
    }) => {
      setMerchantInventory(normalizeMerchantInventory(data?.inventory));
      applyLocalMerchantPurchaseStatesFromPayload(data, newSocket.id, setMerchantPurchaseState);
    });

    addEventHandler('dream-layer-inventory-updated', (data: {
      inventory?: unknown;
      dreamLayerPurchaseStates?: Record<string, unknown>;
    }) => {
      setDreamLayerInventory(normalizeDreamLayerInventory(data?.inventory));
      applyLocalDreamLayerPurchaseStatesFromPayload(data, newSocket.id, setDreamLayerPurchaseState);
    });

    addEventHandler('dream-layer-purchase-succeeded', (data: { dreamLayerPurchaseState?: unknown }) => {
      if (data?.dreamLayerPurchaseState) {
        setDreamLayerPurchaseState(normalizeDreamLayerPurchaseState(data.dreamLayerPurchaseState));
      }
    });

    addEventHandler('dream-layer-purchase-failed', (data: { reason?: string }) => {
      console.warn('Dream Layer purchase failed:', data?.reason || 'unknown');
    });

    addEventHandler('persephone-triggered', (data: { playerId?: string; newHealth?: number; maxHealth?: number }) => {
      if (!newSocket.id || data?.playerId !== newSocket.id) return;
      setInventory((prev) => prev.filter((item) => item.type !== PERSEPHONE));
      if (typeof data.newHealth === 'number') {
        patchPlayerRef(playersRef, newSocket.id, {
          health: data.newHealth,
          maxHealth: data.maxHealth,
        });
      }
    });

    addEventHandler('merchant-purchase-failed', (data: { reason?: string }) => {
      console.warn('Merchant purchase failed:', data?.reason || 'unknown');
    });

    addEventHandler('merchant-purchase-succeeded', (data: MerchantPurchaseSuccessPayload) => {
      if (data?.merchantPurchaseState) {
        setMerchantPurchaseState(normalizeMerchantPurchaseState(data.merchantPurchaseState));
      }
      merchantPurchaseSuccessHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('merchant-npc-greet', (data: { kind?: string }) => {
      const kind = data?.kind ?? '';
      merchantNpcGreetHandlersRef.current.forEach((handler) => handler({ kind }));
    });

    addEventHandler('game-started', (data: any) => {
      cancelPendingEnemyRemovals();
      applyCoopSessionSnapshot(
        data,
        {
          setGameStarted,
          setKillCount,
          setCombatArenaActive,
          setPlayers,
          setEnemies,
          setThronePortalOffer,
          setThronePortalLayout,
          setCoopMainArenaPortalPhase,
          setCoopBossThroneArena,
          setCoopThroneBossKind,
          setCoopTerrainTheme,
          setCoopCurrentRoomKind,
          setCoopClearedRoomKind,
          setCoopColoredRoomVisitIndex,
          setCoopBossRoomVisitIndex,
          setCoopSkyPresetIndex,
          setCoopGrassPresetIndex,
          setMerchantInventory,
          setMerchantPurchaseState,
          setMushroomState,
          setCoopIntroPending,
          setCoopIntroActive,
          setCoopIntroRoomIndex,
          setCoopIntroPortalOpen,
          setCoopIntroFountainPhase,
          setCoopIntroFountainUsed,
          setCoopIntroAllyChoiceMade,
          setCoopFaeRealmPending,
          setCoopFaeRealmActive,
          setCoopFaeRealmRoomIndex,
          setCoopFaeRealmPortalOpen,
          setCoopFaeRealmBossKind,
          setCoopFaeBeastCompanionGranted,
          setCoopFaeBeastCompanionKind,
          setCoopSunkenActive,
          setCoopSunkenRoomIndex,
          setCoopSunkenPortalOpen,
          setCoopSunkenFountainPhase,
          setCoopSunkenFountainUsed,
          setCoopSunkenAllyChoiceMade,
          setCoopSunkenLootOffer,
          setCoopSunkenLootClaimedPlayerIds,
          setCoopSunkenLootPhaseComplete,
          setCoopSunkenCompleted,
          setCoopEternityActive,
          setCoopEternityRoomIndex,
          setCoopEternityPortalOpen,
          setCoopEternityFountainPhase,
          setCoopEternityFountainUsed,
          setCoopEternityLootOffer,
          setCoopEternityLootClaimedPlayerIds,
          setCoopEternityLootPhaseComplete,
          setCoopEternityCompleted,
          setCoopAllyKind,
          setCoopAllyOffer,
          setCoopVoidPortalOffered,
          setCoopDeepSanctumLevel,
          setDeepSanctumRewardKind,
          setCoopEdenFountainUsed,
          setCoopEdenResumeKind,
          setCoopFalseEdenCleared,
          setDeliriumStructure,
          setCoopDeliriumActive,
          setCoopDeliriumEventEnded,
          setCoopDeliriumSuccess,
          setCoopErebusGateActive,
        },
        { resetVisitIndices: true, resetMerchantPurchaseState: true },
      );
    });

    addEventHandler('coop-throne-sync', (data: any) => {
      cancelPendingEnemyRemovals();
      applyCoopSessionSnapshot(
        data,
        {
          setGameStarted,
          setKillCount,
          setCombatArenaActive,
          setPlayers,
          setEnemies,
          setThronePortalOffer,
          setThronePortalLayout,
          setCoopMainArenaPortalPhase,
          setCoopBossThroneArena,
          setCoopThroneBossKind,
          setCoopTerrainTheme,
          setCoopCurrentRoomKind,
          setCoopClearedRoomKind,
          setCoopColoredRoomVisitIndex,
          setCoopBossRoomVisitIndex,
          setCoopSkyPresetIndex,
          setCoopGrassPresetIndex,
          setMerchantInventory,
          setMerchantPurchaseState,
          setMushroomState,
          setCoopIntroPending,
          setCoopIntroActive,
          setCoopIntroRoomIndex,
          setCoopIntroPortalOpen,
          setCoopIntroFountainPhase,
          setCoopIntroFountainUsed,
          setCoopIntroAllyChoiceMade,
          setCoopFaeRealmPending,
          setCoopFaeRealmActive,
          setCoopFaeRealmRoomIndex,
          setCoopFaeRealmPortalOpen,
          setCoopFaeRealmBossKind,
          setCoopFaeBeastCompanionGranted,
          setCoopFaeBeastCompanionKind,
          setCoopSunkenActive,
          setCoopSunkenRoomIndex,
          setCoopSunkenPortalOpen,
          setCoopSunkenFountainPhase,
          setCoopSunkenFountainUsed,
          setCoopSunkenAllyChoiceMade,
          setCoopSunkenLootOffer,
          setCoopSunkenLootClaimedPlayerIds,
          setCoopSunkenLootPhaseComplete,
          setCoopSunkenCompleted,
          setCoopEternityActive,
          setCoopEternityRoomIndex,
          setCoopEternityPortalOpen,
          setCoopEternityFountainPhase,
          setCoopEternityFountainUsed,
          setCoopEternityLootOffer,
          setCoopEternityLootClaimedPlayerIds,
          setCoopEternityLootPhaseComplete,
          setCoopEternityCompleted,
          setCoopAllyKind,
          setCoopAllyOffer,
          setCoopVoidPortalOffered,
          setCoopDeepSanctumLevel,
          setDeepSanctumRewardKind,
          setCoopEdenFountainUsed,
          setCoopEdenResumeKind,
          setCoopFalseEdenCleared,
          setDeliriumStructure,
          setCoopDeliriumActive,
          setCoopDeliriumEventEnded,
          setCoopDeliriumSuccess,
          setCoopErebusGateActive,
        },
        { resetVisitIndices: false, resetMerchantPurchaseState: false },
      );
    });

    addEventHandler('start-game-failed', (data: { error?: string }) => {
      if (data?.error === 'Game already started') {
        console.log('ℹ️ Game already started — using room-joined / throne sync state');
        return;
      }
      console.warn('Failed to start game:', data?.error || 'unknown');
    });

    addEventHandler('boss-defeated', (data: BossDefeatedPayload) => {
      setCoopBossClearedBgmSeq((s) => s + 1);
      bossDefeatedHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('coop-intro-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopIntroIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(null);
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      }
      applyIntroSnapshot(data, {
        setCoopIntroPending,
        setCoopIntroActive,
        setCoopIntroRoomIndex,
        setCoopIntroPortalOpen,
        setCoopIntroFountainPhase,
        setCoopIntroFountainUsed,
        setCoopIntroAllyChoiceMade,
        setCoopAllyKind,
        setCoopAllyOffer,
      });
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
    });

    addEventHandler('coop-fae-realm-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopFaeRealmIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(null);
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      }
      applyFaeRealmSnapshot(data, {
        setCoopFaeRealmPending,
        setCoopFaeRealmActive,
        setCoopFaeRealmRoomIndex,
        setCoopFaeRealmPortalOpen,
        setCoopFaeRealmBossKind,
        setCoopFaeBeastCompanionGranted,
        setCoopFaeBeastCompanionKind,
      });
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
    });

    addEventHandler('coop-sunken-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopSunkenIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(null);
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      }
      applySunkenSnapshot(data, {
        setCoopSunkenActive,
        setCoopSunkenRoomIndex,
        setCoopSunkenPortalOpen,
        setCoopSunkenFountainPhase,
        setCoopSunkenFountainUsed,
        setCoopSunkenAllyChoiceMade,
        setCoopSunkenLootOffer,
        setCoopSunkenLootClaimedPlayerIds,
        setCoopSunkenLootPhaseComplete,
        setCoopSunkenCompleted,
        setCoopAllyKind,
        setCoopAllyOffer,
      });
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
    });

    addEventHandler('coop-sunken-loot-chosen', (data: {
      coopSunkenLootClaimedPlayerIds?: string[];
      coopSunkenLootPhaseComplete?: boolean;
    }) => {
      if (Array.isArray(data?.coopSunkenLootClaimedPlayerIds)) {
        setCoopSunkenLootClaimedPlayerIds([...data.coopSunkenLootClaimedPlayerIds]);
      }
      if ('coopSunkenLootPhaseComplete' in (data ?? {})) {
        setCoopSunkenLootPhaseComplete(!!data.coopSunkenLootPhaseComplete);
      }
    });

    addEventHandler('coop-sunken-loot-failed', () => {
      (window as any).audioSystem?.playUIInterface4Sound?.();
    });

    addEventHandler('coop-eternity-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopEternityIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(null);
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      }
      applyEternitySnapshot(data, {
        setCoopEternityActive,
        setCoopEternityRoomIndex,
        setCoopEternityPortalOpen,
        setCoopEternityFountainPhase,
        setCoopEternityFountainUsed,
        setCoopEternityLootOffer,
        setCoopEternityLootClaimedPlayerIds,
        setCoopEternityLootPhaseComplete,
        setCoopEternityCompleted,
      });
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
    });

    addEventHandler('coop-eternity-loot-chosen', (data: {
      coopEternityLootClaimedPlayerIds?: string[];
      coopEternityLootPhaseComplete?: boolean;
    }) => {
      if (Array.isArray(data?.coopEternityLootClaimedPlayerIds)) {
        setCoopEternityLootClaimedPlayerIds([...data.coopEternityLootClaimedPlayerIds]);
      }
      if ('coopEternityLootPhaseComplete' in (data ?? {})) {
        setCoopEternityLootPhaseComplete(!!data.coopEternityLootPhaseComplete);
      }
    });

    addEventHandler('coop-eternity-pet-upgrade-chosen', (data: {
      upgradeId?: string;
      coopEternityLootClaimedPlayerIds?: string[];
      coopEternityLootPhaseComplete?: boolean;
    }) => {
      if (typeof data?.upgradeId === 'string') {
        setCoopPetCompanionUpgrade(data.upgradeId);
      }
      if (Array.isArray(data?.coopEternityLootClaimedPlayerIds)) {
        setCoopEternityLootClaimedPlayerIds([...data.coopEternityLootClaimedPlayerIds]);
      }
      if ('coopEternityLootPhaseComplete' in (data ?? {})) {
        setCoopEternityLootPhaseComplete(!!data.coopEternityLootPhaseComplete);
      }
    });

    addEventHandler('coop-pet-companion-upgrade-synced', (data: {
      playerId?: string;
      upgradeId?: string;
    }) => {
      if (data?.playerId && data.playerId === socket?.id && typeof data.upgradeId === 'string') {
        setCoopPetCompanionUpgrade(data.upgradeId);
      }
    });

    addEventHandler('coop-eternity-loot-failed', () => {
      (window as any).audioSystem?.playUIInterface4Sound?.();
    });

    addEventHandler('coop-eternity-pet-upgrade-failed', () => {
      (window as any).audioSystem?.playUIInterface4Sound?.();
    });

    addEventHandler('coop-deep-sanctum-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopDeepSanctumIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      setCoopMainArenaPortalPhase(null);
      setThronePortalOffer([]);
      setCoopVoidPortalOffered(false);
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      }
      applyDeepSanctumSnapshot(data, {
        setCoopVoidPortalOffered,
        setCoopDeepSanctumLevel,
        setDeepSanctumRewardKind,
      });
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
    });

    addEventHandler('coop-eden-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopEdenIntermissionSeq((s) => s + 1);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(normalizeCoopMainArenaPhase(data?.coopMainArenaPortalPhase));
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      applyEdenSnapshot(data, {
        setCoopEdenFountainUsed,
        setCoopEdenResumeKind,
        setCoopFalseEdenCleared,
        setDeliriumStructure,
        setCoopDeliriumActive,
        setCoopDeliriumEventEnded,
        setCoopDeliriumSuccess,
        setCoopErebusGateActive,
      });
    });

    addEventHandler('coop-deep-sanctum-reward-claimed', (data: DeepSanctumRewardClaimedPayload) => {
      setDeepSanctumRewardKind(null);
      deepSanctumRewardClaimedHandlersRef.current.forEach((handler) => handler(data));
    });

    addEventHandler('coop-main-arena-intermission', (data: any) => {
      cancelPendingEnemyRemovals();
      setCoopMainArenaIntermissionSeq((s) => s + 1);
      if (data && 'coopClearedRoomColor' in data && data.coopClearedRoomColor != null) {
        const c = String(data.coopClearedRoomColor).toLowerCase();
        setCoopClearedRoomColor(VALID_CAMP_KEYS.has(c) ? c : null);
      } else {
        setCoopClearedRoomColor(null);
      }
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      }
      setCoopMainArenaPortalPhase(normalizeCoopMainArenaPhase(data?.coopMainArenaPortalPhase));
      if (data && 'coopBossThroneArena' in data) {
        setCoopBossThroneArena(normalizeCoopBossThroneArena(data.coopBossThroneArena));
      }
      if (data && 'coopThroneBossKind' in data) {
        setCoopThroneBossKind(normalizeCoopThroneBossKind(data.coopThroneBossKind));
      }
      setCoopTerrainTheme(normalizeCoopTerrainTheme(data?.coopTerrainTheme));
      if (data && 'coopCurrentRoomKind' in data) {
        setCoopCurrentRoomKind(normalizeCoopRoomKind(data.coopCurrentRoomKind));
      }
      if (data && 'coopClearedRoomKind' in data) {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data.coopClearedRoomKind));
      } else {
        setCoopClearedRoomKind(normalizeCoopRoomKind(data?.coopClearedRoomColor));
      }
      if (data && 'coopSkyPresetIndex' in data) {
        const skyIdx = Number(data.coopSkyPresetIndex);
        if (Number.isFinite(skyIdx)) {
          setCoopSkyPresetIndex(Math.max(0, Math.floor(skyIdx)));
        }
      }
      setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
      applyLocalMerchantPurchaseStatesFromPayload(data, newSocket.id, setMerchantPurchaseState);
      setDreamLayerInventory(normalizeDreamLayerInventory(data?.dreamLayerInventory));
      applyLocalDreamLayerPurchaseStatesFromPayload(data, newSocket.id, setDreamLayerPurchaseState);
      if (data?.players && Array.isArray(data.players)) {
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies(() => {
          const m = new Map<string, Enemy>();
          for (const e of data.enemies as Enemy[]) {
            m.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return m;
        });
      }
      applyDeepSanctumSnapshot(data, {
        setCoopVoidPortalOffered,
        setCoopDeepSanctumLevel,
        setDeepSanctumRewardKind,
      });
    });

    addEventHandler('combat-arena-entered', (data: any) => {
      setCombatArenaActive(true);
      // Boss throne shell: keep gate intermission colour so perimeter matches SimpleBorderEffects / prep throne.
      if (!normalizeCoopBossThroneArena(data?.coopBossThroneArena)) {
        setCoopClearedRoomColor(null);
      }
      if (Array.isArray(data?.thronePortalOffer)) {
        setThronePortalOffer([...data.thronePortalOffer]);
      } else {
        setThronePortalOffer([]);
      }
      if (data && 'thronePortalLayout' in data) {
        setThronePortalLayout(normalizeThronePortalLayout(data.thronePortalLayout));
      } else {
        setThronePortalLayout('rim');
      }
      if (data && 'coopMainArenaPortalPhase' in data) {
        setCoopMainArenaPortalPhase(normalizeCoopMainArenaPhase(data.coopMainArenaPortalPhase));
      } else {
        setCoopMainArenaPortalPhase(null);
      }
      if (data && 'coopBossThroneArena' in data) {
        setCoopBossThroneArena(normalizeCoopBossThroneArena(data.coopBossThroneArena));
      } else {
        setCoopBossThroneArena(false);
      }
      if (data && 'coopThroneBossKind' in data) {
        setCoopThroneBossKind(normalizeCoopThroneBossKind(data.coopThroneBossKind));
      } else {
        setCoopThroneBossKind(null);
      }
      setCoopTerrainTheme(normalizeCoopTerrainTheme(data?.coopTerrainTheme));
      setCoopCurrentRoomKind(normalizeCoopRoomKind(data?.coopCurrentRoomKind));
      setCoopClearedRoomKind(null);
      if (data && 'coopSkyPresetIndex' in data) {
        const skyIdx = Number(data.coopSkyPresetIndex);
        if (Number.isFinite(skyIdx)) {
          setCoopSkyPresetIndex(Math.max(0, Math.floor(skyIdx)));
        }
      }
      applyIntroSnapshot(data, {
        setCoopIntroPending,
        setCoopIntroActive,
        setCoopIntroRoomIndex,
        setCoopIntroPortalOpen,
        setCoopIntroFountainPhase,
        setCoopIntroFountainUsed,
        setCoopIntroAllyChoiceMade,
        setCoopAllyKind,
        setCoopAllyOffer,
      });
      applyFaeRealmSnapshot(data, {
        setCoopFaeRealmPending,
        setCoopFaeRealmActive,
        setCoopFaeRealmRoomIndex,
        setCoopFaeRealmPortalOpen,
        setCoopFaeRealmBossKind,
        setCoopFaeBeastCompanionGranted,
        setCoopFaeBeastCompanionKind,
      });
      applySunkenSnapshot(data, {
        setCoopSunkenActive,
        setCoopSunkenRoomIndex,
        setCoopSunkenPortalOpen,
        setCoopSunkenFountainPhase,
        setCoopSunkenFountainUsed,
        setCoopSunkenAllyChoiceMade,
        setCoopSunkenLootOffer,
        setCoopSunkenLootClaimedPlayerIds,
        setCoopSunkenLootPhaseComplete,
        setCoopSunkenCompleted,
        setCoopAllyKind,
        setCoopAllyOffer,
      });
      applyEternitySnapshot(data, {
        setCoopEternityActive,
        setCoopEternityRoomIndex,
        setCoopEternityPortalOpen,
        setCoopEternityFountainPhase,
        setCoopEternityFountainUsed,
        setCoopEternityLootOffer,
        setCoopEternityLootClaimedPlayerIds,
        setCoopEternityLootPhaseComplete,
        setCoopEternityCompleted,
      });
      applyDeepSanctumSnapshot(data, {
        setCoopVoidPortalOffered,
        setCoopDeepSanctumLevel,
        setDeepSanctumRewardKind,
      });
      applyEdenSnapshot(data, {
        setCoopEdenFountainUsed,
        setCoopEdenResumeKind,
        setCoopFalseEdenCleared,
        setDeliriumStructure,
        setCoopDeliriumActive,
        setCoopDeliriumEventEnded,
        setCoopDeliriumSuccess,
        setCoopErebusGateActive,
      });
      if (normalizeCoopRoomKind(data?.coopCurrentRoomKind) === 'deep_sanctum') {
        setCoopVoidPortalOffered(false);
        setDeepSanctumRewardKind(null);
      }
      setCoopColoredRoomVisitIndex(normalizeCoopColoredRoomVisitIndex(data?.coopColoredRoomVisitIndex));
      setCoopBossRoomVisitIndex(normalizeCoopBossRoomVisitIndex(data?.coopBossRoomVisitIndex));
      setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
      applyLocalMerchantPurchaseStatesFromPayload(data, newSocket.id, setMerchantPurchaseState);
      setDreamLayerInventory(normalizeDreamLayerInventory(data?.dreamLayerInventory));
      applyLocalDreamLayerPurchaseStatesFromPayload(data, newSocket.id, setDreamLayerPurchaseState);
      if (data?.mushroomState?.health && Array.isArray(data.mushroomState.health)) {
        setMushroomState({
          health: [...data.mushroomState.health],
          maxHealth: data.mushroomState.maxHealth ?? 10,
        });
      }
      const transitionId = data?.coopCombatTransitionId != null
        ? Number(data.coopCombatTransitionId)
        : NaN;
      syncCoopCombatTransitionId(Number.isFinite(transitionId) ? transitionId : null);
      coopTransitionOverlayRef.current = true;
      coopPendingPortalSnapRef.current = true;
      const entryToken = Number(data?.coopRoomEntryToken);
      coopRoomEntryTokenRef.current = Number.isFinite(entryToken) ? entryToken : 0;
      coopCombatArenaEnterAtRef.current = Date.now();
      setCoopTransitionOverlay(true);
      setCoopCombatArenaEnterSeq((s) => s + 1);
      if (pendingLocalPortalBlinkRef.current) {
        pendingLocalPortalBlinkRef.current = false;
      } else {
        setCoopPortalBlinkSeq((s) => s + 1);
      }
      if (data?.players && Array.isArray(data.players)) {
        for (const p of data.players as Player[]) {
          applyPlayerMove(playersTransformsRef, playersRef, {
            playerId: p.id,
            position: p.position,
            rotation: p.rotation,
            movementDirection: p.movementDirection,
          });
        }
        setPlayers((prev) => {
          const next = new Map(prev);
          for (const p of data.players as Player[]) {
            const old = next.get(p.id);
            next.set(p.id, old ? { ...old, ...p } : p);
          }
          return next;
        });
      }
    });

    addEventHandler('room-preview', (data) => {
      setCurrentPreview(data);
    });

    // Player action event handlers
    addEventHandler('player-attack', (data) => {
      // console.log('⚔️ Player attack received:', data);
      // This will be handled by the game scene to trigger animations
    });

    addEventHandler('player-used-ability', (data) => {
      // console.log('✨ Player ability received:', data);
      // This will be handled by the game scene to trigger ability effects
    });

    addEventHandler('player-effect', (data) => {
      // console.log('💫 Player effect received:', data);
      // This will be handled by the game scene to show visual effects
    });


    addEventHandler('player-animation-state', (data) => {
      // This will be handled by the game scene to update animation states
    });

    // Experience system event handlers
    addEventHandler('player-experience-gained', (data) => {
      const player = playersRef.current.get(data.playerId);
      const prevExperience = player?.experience ?? 0;
      const prevLevel = ExperienceSystem.getLevelFromExperience(prevExperience);
      const newExperience = prevExperience + data.experienceGained;
      const newLevel = ExperienceSystem.getLevelFromExperience(newExperience);

      patchPlayerRef(playersRef, data.playerId, {
        experience: newExperience,
        level: newLevel,
      });

      if (newLevel > prevLevel) {
        bumpPlayerRosterMetaRev();
      }

      // Trigger level up effects if level changed
      window.dispatchEvent(new CustomEvent('player-level-up-check', {
        detail: { playerId: data.playerId, experienceGained: data.experienceGained }
      }));
    });

    // Wave completion handler
    addEventHandler('wave-completed', (data) => {
      // Co-op mode - award to all players
      window.dispatchEvent(new CustomEvent('wave-completed', { detail: data }));
    });

    // Experience system event handlers
    addEventHandler('player-experience-updated', (data) => {
      const player = playersRef.current.get(data.playerId);
      const prevLevel = player?.level ?? ExperienceSystem.getLevelFromExperience(player?.experience ?? 0);
      patchPlayerRef(playersRef, data.playerId, {
        experience: data.experience,
        level: data.level,
      });
      if (typeof data.level === 'number' && data.level > prevLevel) {
        bumpPlayerRosterMetaRev();
      }
    });


    addEventHandler('player-purchase', (data) => {
      const player = playersRef.current.get(data.playerId);
      if (!player) return;
      const nextEssence =
        data.currency === 'essence' ? (player.essence || 0) - data.cost : (player.essence || 0);
      const nextGold =
        data.currency === 'gold' ? (player.gold || 0) - data.cost : (player.gold || 0);
      patchPlayerRef(playersRef, data.playerId, {
        purchasedItems: [...(player.purchasedItems || []), data.itemId],
        essence: nextEssence,
        gold: nextGold,
      });
      bumpPlayerRosterMetaRev();
    });

    addEventHandler('chat-message', (data) => {
      setChatMessages(prev => {
        const payload = data.message;
        const text = typeof payload === 'string' ? payload : (payload?.message ?? '');
        const newMessage: ChatMessage = {
          id: payload?.id ?? `${Date.now()}-${Math.random()}`,
          playerId: payload?.playerId || 'unknown',
          playerName: payload?.playerName || 'Unknown',
          message: typeof text === 'string' ? text : '',
          timestamp: typeof payload?.timestamp === 'number' ? payload.timestamp : Date.now(),
        };
        return [...prev.slice(-49), newMessage];
      });
    });

    // Boss-related event handlers
    addEventHandler('boss-skeleton-summoned', (data) => {
      // Add the summoned skeleton to enemies map
      setEnemies(prev => {
        const updated = new Map(prev);
        updated.set(data.skeleton.id, data.skeleton);
        return updated;
      });
    });

    // Weaver summons a ghoul — add it to the enemies map so it renders.
    addEventHandler('weaver-ghoul-summoned', (data) => {
      setEnemies(prev => {
        const updated = new Map(prev);
        updated.set(data.ghoul.id, data.ghoul);
        return updated;
      });
    });

    addEventHandler('boss-skeleton-attack', (data) => {
      // This will be handled by the game scene for attack animations
      // The event is forwarded through window for the SummonedBossSkeleton component
    });

    addEventHandler('enemy-removed', (data) => {
      const id = data?.enemyId;
      if (typeof id !== 'string' || !id) return;
      clearKnightBlock(id);
      pendingEnemyRemovalsRef.current.add(id);
      // Prune throttle maps so they don't accumulate stale entries
      delete lastEnemyMoveUpdate.current[id];
      if (enemyRemovalRafRef.current != null) return;
      enemyRemovalRafRef.current = requestAnimationFrame(() => {
        enemyRemovalRafRef.current = null;
        const batch = pendingEnemyRemovalsRef.current;
        pendingEnemyRemovalsRef.current = new Set();
        if (batch.size === 0) return;
        setEnemies((prev) => {
          if (batch.size === 0) return prev;
          const next = new Map(prev);
          batch.forEach((eid) => {
            next.delete(eid);
          });
          return next;
        });
        if (process.env.NODE_ENV === 'development' && batch.size > 0) {
          console.log(`🗑️ Removed ${batch.size} enemy id(s) from local state (batched)`);
        }
      });
    });

    }, 0);

    // Cleanup function
    return () => {
      cancelPendingEnemyRemovals();
      if (socketConnectTimerRef.current != null) {
        clearTimeout(socketConnectTimerRef.current);
        socketConnectTimerRef.current = null;
      }
      const s = activeSocketRef.current;
      activeSocketRef.current = null;
      if (s) {
        console.log('🧹 Cleaning up socket connection');
        s.removeAllListeners();
        s.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      enemyTransformsRef.current.clear();
      enemyVisualRotationsRef.current.clear();
      playersTransformsRef.current.clear();
      setCampTypes([]);
      setCoopTerrainTheme('purple');
      setCoopSkyPresetIndex(0);
      setCoopGrassPresetIndex(0);
      setDroppedItems(new Map());
      setGoldDrops(new Map());
      setInventory([]);
      setMerchantInventory([]);
      setDreamLayerInventory([]);
      setDreamLayerPurchaseState({
        healPurchasedThisVisit: false,
        wardingPurchasedThisVisit: false,
        legendaryAPurchasedThisVisit: false,
        legendaryBPurchasedThisVisit: false,
        ringPurchasedThisVisit: false,
      });

      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [cancelPendingEnemyRemovals, notifyEnemyDamageListeners]); // `cancel` stable; handlers need fresh ref to cancel batching

  const joinRoom = useCallback(async (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'coop') => {
    if (!socket || !isConnected) {
      throw new Error('Not connected to server');
    }

    return new Promise<JoinRoomResult>((resolve, reject) => {
      socket.emit('join-room', {
        roomId,
        playerName,
        weapon,
        subclass,
        gameMode: gameMode || 'multiplayer'
      });

      // Set up timeout for room join response
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 10000);

      // Listen for successful room join
      const handleRoomJoined = (data: {
        roomId?: string;
        gameStarted?: boolean;
        gameMode?: string;
        players?: Player[];
      }) => {
        clearTimeout(timeout);
        socket.off('room-joined', handleRoomJoined);
        socket.off('room-full', handleRoomFull);
        resolve({
          roomId: data?.roomId ?? roomId,
          gameStarted: !!data?.gameStarted,
          gameMode: data?.gameMode === 'coop' ? 'coop' : 'multiplayer',
          playerCount: Array.isArray(data?.players) ? data.players.length : 1,
        });
      };

      // Listen for room full error
      const handleRoomFull = () => {
        clearTimeout(timeout);
        socket.off('room-joined', handleRoomJoined);
        socket.off('room-full', handleRoomFull);
        reject(new Error('Room is full'));
      };

      socket.once('room-joined', handleRoomJoined);
      socket.once('room-full', handleRoomFull);
    });
  }, [socket, isConnected]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave-room');
    setIsInRoom(false);
    setCurrentRoomId(null);
    setPlayers(new Map());
    setEnemies(new Map());
    enemyTransformsRef.current.clear();
    enemyVisualRotationsRef.current.clear();
    setKillCount(0);
    setSkeletonKillCount(0);
    setSkeletonKillRequired(8);
    setGameStarted(false);
    setCombatArenaActive(true);
    setGameMode('multiplayer');
    setCampTypes([]);
    setCoopTerrainTheme('purple');
    setCoopSkyPresetIndex(0);
    setCoopGrassPresetIndex(0);
    setThronePortalOffer([]);
    setThronePortalLayout('rim');
    setCoopMainArenaPortalPhase(null);
    setCoopBossThroneArena(false);
    setCoopThroneBossKind(null);
    setCoopTransitionOverlay(false);
    coopTransitionOverlayRef.current = false;
    coopPendingPortalSnapRef.current = false;
    coopRoomEntryTokenRef.current = 0;
    coopCombatArenaEnterAtRef.current = 0;
    setCoopPortalBlinkSeq(0);
    pendingLocalPortalBlinkRef.current = false;
    syncCoopCombatTransitionId(null);
    setCoopCombatArenaEnterSeq(0);
    setCoopMainArenaIntermissionSeq(0);
    setCoopBossClearedBgmSeq(0);
    setLateJoinCombatLoadout(null);
    setMushroomState(null);
    setDroppedItems(new Map());
    setGoldDrops(new Map());
    setInventory([]);
    setMerchantInventory([]);
    setDreamLayerInventory([]);
    setDreamLayerPurchaseState({
      healPurchasedThisVisit: false,
      wardingPurchasedThisVisit: false,
      legendaryAPurchasedThisVisit: false,
      legendaryBPurchasedThisVisit: false,
      ringPurchasedThisVisit: false,
    });
    setSelectedWeaponsState({ primary: WeaponType.NONE, secondary: WeaponType.NONE });
    setSelectedArchetypeState(ARCHETYPE_ROGUE);
    setSelectedWeaponAspectState(ASPECT_LEGIONNAIRE);
    setWeaponAspectByWeapon({});
    setAbilityLoadoutState(getDefaultLoadout());
    }
  }, [socket]);

  const previewRoom = useCallback((roomId: string) => {
    if (socket && isConnected) {
      socket.emit('preview-room', { roomId });
    }
  }, [socket, isConnected]);

  const clearPreview = useCallback(() => {
    setCurrentPreview(null);
  }, []);

  const startGame = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('start-game', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const startCoopPortalBlink = useCallback(() => {
    pendingLocalPortalBlinkRef.current = true;
    coopTransitionOverlayRef.current = true;
    coopPendingPortalSnapRef.current = true;
    setCoopPortalBlinkSeq((s) => s + 1);
    setCoopTransitionOverlay(true);
  }, []);

  const enterCombatArena = useCallback((chosenCampType?: string) => {
    startCoopPortalBlink();
    if (socket && currentRoomId) {
      socket.emit('enter-combat-arena', { roomId: currentRoomId, chosenCampType });
    }
  }, [socket, currentRoomId, startCoopPortalBlink]);

  const useCoopFountain = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('coop-use-fountain', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const chooseCoopAlly = useCallback((allyKind: CoopAllyKind) => {
    if (socket && currentRoomId) {
      socket.emit('coop-choose-ally', { roomId: currentRoomId, allyKind });
    }
  }, [socket, currentRoomId]);

  const chooseSunkenTempleLoot = useCallback((stockId: string) => {
    if (socket && currentRoomId) {
      socket.emit('coop-choose-sunken-loot', { roomId: currentRoomId, stockId });
    }
  }, [socket, currentRoomId]);

  const chooseEternityPalaceLoot = useCallback((stockId: string) => {
    if (socket && currentRoomId) {
      socket.emit('coop-choose-eternity-loot', { roomId: currentRoomId, stockId });
    }
  }, [socket, currentRoomId]);

  const chooseEternityPetUpgrade = useCallback((upgradeId: string) => {
    if (socket && currentRoomId) {
      socket.emit('coop-choose-eternity-pet-upgrade', { roomId: currentRoomId, upgradeId });
    }
  }, [socket, currentRoomId]);

  const claimPreBossReward = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('coop-pre-boss-reward-claimed', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const claimDeepSanctumReward = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('coop-deep-sanctum-reward-claimed', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const finishPreBossMerchant = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('coop-pre-boss-merchant-finished', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const hideCoopPortalTransition = useCallback(() => {
    coopTransitionOverlayRef.current = false;
    coopPendingPortalSnapRef.current = false;
    setCoopTransitionOverlay(false);
  }, []);

  const confirmCoopPortalTransitionComplete = useCallback(() => {
    const transitionId = coopCombatTransitionIdRef.current;
    if (socket && currentRoomId && transitionId != null) {
      socket.emit('coop-combat-transition-ready', {
        roomId: currentRoomId,
        transitionId,
        timestamp: Date.now(),
      });
    }
    syncCoopCombatTransitionId(null);
  }, [socket, currentRoomId, syncCoopCombatTransitionId]);

  const endCoopPortalTransition = useCallback(() => {
    const transitionId = coopCombatTransitionIdRef.current;
    if (socket && currentRoomId && transitionId != null) {
      socket.emit('coop-combat-transition-ready', {
        roomId: currentRoomId,
        transitionId,
        timestamp: Date.now(),
      });
    }
    syncCoopCombatTransitionId(null);
    coopTransitionOverlayRef.current = false;
    coopPendingPortalSnapRef.current = false;
    setCoopTransitionOverlay(false);
  }, [socket, currentRoomId, syncCoopCombatTransitionId]);

  const clearCoopClearedRoomColor = useCallback(() => {
    setCoopClearedRoomColor(null);
    setCoopClearedRoomKind(null);
  }, []);

  const clearLateJoinCombatLoadout = useCallback(() => {
    setLateJoinCombatLoadout(null);
  }, []);

  const resetLocalPositionEmitThrottle = useCallback((
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
  ) => {
    lastLocalPositionEmitRef.current = {
      time: 0,
      x: position.x,
      y: position.y,
      z: position.z,
      ry: rotation.y,
    };
  }, []);

  const updatePlayerPosition = useCallback((position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: PlayerMovementDirection) => {
    if (!socket || !currentRoomId) return;

    const now = performance.now();
    const last = lastLocalPositionEmitRef.current;
    const dx = position.x - last.x;
    const dy = position.y - last.y;
    const dz = position.z - last.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const rotDelta = Math.abs(rotation.y - last.ry);
    const movedEnough = distSq > 0.0025 || rotDelta > 0.05;
    const elapsed = now - last.time;
    if (elapsed < 33 && !movedEnough) return;

    lastLocalPositionEmitRef.current = {
      time: now,
      x: position.x,
      y: position.y,
      z: position.z,
      ry: rotation.y,
    };

    socket.emit('player-update', {
      roomId: currentRoomId,
      position,
      rotation,
      movementDirection,
      coopRoomEntryToken: coopRoomEntryTokenRef.current,
    });
  }, [socket, currentRoomId]);

  const updatePlayerWeapon = useCallback((weapon: WeaponType, subclass?: WeaponSubclass, aspect?: WeaponAspect) => {
    if (socket && currentRoomId) {
      socket.emit('weapon-changed', {
        roomId: currentRoomId,
        weapon,
        subclass,
        ...(aspect != null ? { aspect } : {}),
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerArchetype = useCallback((archetype: Archetype) => {
    if (socket && currentRoomId) {
      socket.emit('archetype-changed', {
        roomId: currentRoomId,
        archetype,
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerWeaponAspect = useCallback((aspect: WeaponAspect) => {
    if (socket && currentRoomId) {
      socket.emit('weapon-aspect-changed', {
        roomId: currentRoomId,
        aspect,
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerHealth = useCallback((health: number, maxHealth?: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-health-changed', {
        roomId: currentRoomId,
        health,
        maxHealth
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAttack = useCallback(
    (
      attackType: string,
      position: { x: number; y: number; z: number },
      direction: { x: number; y: number; z: number },
      animationData?: BroadcastPlayerAttackAnimationData,
    ) => {
    if (socket && currentRoomId) {
      socket.emit('player-attack', {
        roomId: currentRoomId,
        attackType,
        position,
        direction,
        animationData
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAbility = useCallback((abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string, extraData?: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-ability', {
        roomId: currentRoomId,
        abilityType,
        position,
        direction,
        target,
        extraData
      });
    } else {
      // console.log('🔍 DEBUG: Cannot broadcast - missing socket or roomId');
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerEffect = useCallback((effect: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-effect', {
        roomId: currentRoomId,
        effect
      });
    }
  }, [socket, currentRoomId]);

  const damageMushroom = useCallback((index: number, damage: number, sourcePlayerId?: string) => {
    if (socket && currentRoomId) {
      socket.emit('mushroom-damage', {
        roomId: currentRoomId,
        index,
        damage,
        sourcePlayerId: sourcePlayerId || socket.id,
      });
    }
  }, [socket, currentRoomId]);

  const damageEnemy = useCallback((enemyId: string, damage: number, sourcePlayerId?: string, meta?: EnemyDamageMeta) => {
    if (socket && currentRoomId) {
      socket.emit('enemy-damage', {
        roomId: currentRoomId,
        enemyId,
        damage,
        sourcePlayerId: sourcePlayerId || socket.id, // Always send the player ID for aggro tracking
        ...(meta?.damageType !== undefined ? { damageType: meta.damageType } : {}),
        ...(meta?.infestedStrike ? { infestedStrike: true } : {}),
        ...(meta?.infestedSmite ? { infestedSmite: true } : {}),
        ...(meta?.infestedCombo ? { infestedCombo: true } : {}),
        ...(meta?.infernalSmite ? { infernalSmite: true } : {}),
        ...(meta?.infernoCrossentropy ? { infernoCrossentropy: true } : {}),
        ...(meta?.reaperCrossentropy ? { reaperCrossentropy: true } : {}),
        ...(meta?.crossentropyPlague ? { crossentropyPlague: true } : {}),
        ...(meta?.crossentropyMeteor ? { crossentropyMeteor: true } : {}),
        ...(meta?.cloudkill ? { cloudkill: true } : {}),
        ...(meta?.staggerToAdd != null && meta.staggerToAdd > 0 ? { staggerToAdd: meta.staggerToAdd } : {}),
        ...(meta?.wyvernBiteVenom ? { wyvernBiteVenom: true } : {}),
        ...(meta?.wyvernStingVenomZombie ? { wyvernStingVenomZombie: true } : {}),
        ...(meta?.wyvernTalonsZombie ? { wyvernTalonsZombie: true } : {}),
        ...(meta?.wyvernBiteConcentratedDoT ? { wyvernBiteConcentratedDoT: true } : {}),
        ...(meta?.entropicWrathful ? { entropicWrathful: true } : {}),
        ...(meta?.entropicInfesting ? { entropicInfesting: true } : {}),
        ...(meta?.icebeamWrathful ? { icebeamWrathful: true } : {}),
        ...(meta?.icebeamInfested ? { icebeamInfested: true } : {}),
        ...(meta?.infestedBackstab ? { infestedBackstab: true } : {}),
        ...(meta?.sabreInfestingSwipes ? { sabreInfestingSwipes: true } : {}),
        ...(meta?.infestedFlourish ? { infestedFlourish: true } : {}),
        ...(meta?.killstreakBackstab ? { killstreakBackstab: true } : {}),
        ...(meta?.relentlessBackstab ? { relentlessBackstab: true } : {}),
        ...(meta?.arcticBlizzard ? { arcticBlizzard: true } : {}),
        ...(meta?.frostTotemChill ? { frostTotemChill: true } : {}),
        ...(meta?.rebukeRoom ? { rebukeRoom: true } : {}),
        ...(meta?.infernalDashRoom ? { infernalDashRoom: true } : {}),
        ...(meta?.glacialBiteChill ? { glacialBiteChill: true } : {}),
        ...(meta?.glacialTalons ? { glacialTalons: true } : {}),
        ...(meta?.entanglementBarrage ? { entanglementBarrage: true } : {}),
        ...(meta?.huntersMark ? { huntersMark: true } : {}),
        ...(meta?.perfectShot ? { perfectShot: true } : {}),
        ...(meta?.rejuvenatingShotEntangle ? { rejuvenatingShotEntangle: true } : {}),
        ...(meta?.necromancerTotemEntangle ? { necromancerTotemEntangle: true } : {}),
        ...(meta?.tempestBurstArcticChill ? { tempestBurstArcticChill: true } : {}),
        ...(meta?.tempestBurstWyvernZombie ? { tempestBurstWyvernZombie: true } : {}),
        ...(meta?.explosiveTalonsDetonation ? { explosiveTalonsDetonation: true } : {}),
        ...(meta?.tempestSweepIgnite ? { tempestSweepIgnite: true } : {}),
        ...(meta?.archmageEntropicIgnite ? { archmageEntropicIgnite: true } : {}),
      });
    }
  }, [socket, currentRoomId]);

  const detonateWyvernConcentratedVenom = useCallback(
    (enemyId: string, cobraRemainingDamage?: number) => {
      if (socket && currentRoomId) {
        socket.emit('wyvern-talons-detonate-cv', {
          roomId: currentRoomId,
          enemyId,
          ...(typeof cobraRemainingDamage === 'number' && cobraRemainingDamage > 0
            ? { cobraRemainingDamage }
            : {}),
        });
      }
    },
    [socket, currentRoomId],
  );

  const triggerTyrantsCloakStrike = useCallback(
    (enemyId: string) => {
      if (socket && currentRoomId) {
        socket.emit('tyrants-cloak-strike', {
          roomId: currentRoomId,
          enemyId,
        });
      }
    },
    [socket, currentRoomId],
  );

  const triggerDeathdealerStaggerProc = useCallback(
    (enemyId: string) => {
      if (socket && currentRoomId) {
        socket.emit('deathdealer-stagger-proc', {
          roomId: currentRoomId,
          enemyId,
        });
      }
    },
    [socket, currentRoomId],
  );

  const applyStatusEffect = useCallback((
    enemyId: string,
    effectType: string,
    duration: number,
    options?: { source?: 'titans_grip' },
  ) => {
    if (socket && currentRoomId) {
      socket.emit('apply-status-effect', {
        roomId: currentRoomId,
        enemyId,
        effectType,
        duration,
        ...(options?.source ? { source: options.source } : {}),
      });
    }
  }, [socket, currentRoomId]);

  const pickupItem = useCallback((itemId: string) => {
    if (socket && currentRoomId) {
      socket.emit('pickup-item', {
        roomId: currentRoomId,
        itemId
      });
    }
  }, [socket, currentRoomId]);

  const pickupGoldDrop = useCallback((dropId: string) => {
    if (socket && currentRoomId) {
      socket.emit('pickup-gold-drop', {
        roomId: currentRoomId,
        dropId,
      });
    }
  }, [socket, currentRoomId]);


  const broadcastPlayerDamage = useCallback((targetPlayerId: string, damage: number, damageType?: string, isCritical?: boolean) => {
    if (gameMode === 'coop') {
      return;
    }

    if (socket && currentRoomId) {

      socket.emit('player-damage', {
        roomId: currentRoomId,
        targetPlayerId,
        damage,
        damageType,
        isCritical
      });
    }
  }, [socket, currentRoomId, gameMode]);

  const broadcastPlayerHealing = useCallback((healingAmount: number, healingType: string, position: { x: number; y: number; z: number }, targetPlayerId?: string) => {
    if (socket && currentRoomId) {
      socket.emit('player-healing', {
        roomId: currentRoomId,
        healingAmount,
        healingType,
        position,
        targetPlayerId // Optional: if specified, heals target player; otherwise heals source
      });
    }
  }, [socket, currentRoomId]);

  const broadcastAlliedHealing = useCallback((
    healingAmount: number,
    healingType: string,
    position: { x: number; y: number; z: number },
    targetEnemyId: string,
  ) => {
    if (socket && currentRoomId) {
      socket.emit('allied-healing', {
        roomId: currentRoomId,
        healingAmount,
        healingType,
        position,
        targetEnemyId,
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAnimationState = useCallback((animationState: PlayerAnimationState) => {
    if (socket && currentRoomId) {
      socket.emit('player-animation-state', {
        roomId: currentRoomId,
        animationState
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDebuff = useCallback((targetPlayerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, effectData?: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-debuff', {
        roomId: currentRoomId,
        targetPlayerId,
        debuffType,
        duration,
        effectData,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerStealth = useCallback((isInvisible: boolean, isStealthing?: boolean) => {

    if (socket && currentRoomId) {
      socket.emit('player-stealth', {
        roomId: currentRoomId,
        playerId: socket.id,
        isInvisible,
        isStealthing: isStealthing || false,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerTornadoEffect = useCallback((playerId: string, position: { x: number; y: number; z: number }, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-tornado-effect', {
        roomId: currentRoomId,
        playerId,
        position,
        duration,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDeathEffect = useCallback((playerId: string, position: { x: number; y: number; z: number }, isStarting: boolean) => {
    if (socket && currentRoomId) {
      socket.emit('player-death-effect', {
        roomId: currentRoomId,
        playerId,
        position,
        isStarting,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerKnockback = useCallback((targetPlayerId: string, direction: { x: number; y: number; z: number }, distance: number, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-knockback', {
        roomId: currentRoomId,
        playerId: socket.id,
        targetPlayerId,
        direction,
        distance,
        duration,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerExperience = useCallback((playerId: string, experience: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-experience-changed', {
        roomId: currentRoomId,
        playerId,
        experience
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerEssence = useCallback((playerId: string, essence: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-essence-changed', {
        roomId: currentRoomId,
        playerId,
        essence
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerGold = useCallback((playerId: string, gold: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-gold-changed', {
        roomId: currentRoomId,
        playerId,
        gold,
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerFlow = useCallback((playerId: string, flow: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-flow-changed', {
        roomId: currentRoomId,
        playerId,
        flow,
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerFate = useCallback((playerId: string, fate: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-fate-changed', {
        roomId: currentRoomId,
        playerId,
        fate,
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerShield = useCallback((playerId: string, shield: number, maxShield?: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-shield-changed', {
        roomId: currentRoomId,
        playerId,
        shield,
        maxShield
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerEnergy = useCallback((playerId: string, energy: number, maxEnergy?: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-energy-changed', {
        roomId: currentRoomId,
        playerId,
        energy,
        maxEnergy
      });
    }
  }, [socket, currentRoomId]);

  // Weapon selection functions (moved before updatePlayerLevel to avoid forward reference)
  const setSelectedWeapons = useCallback((weapons: { primary: WeaponType; secondary: WeaponType }) => {
    setSelectedWeaponsState(weapons);
  }, []);

  const setSelectedArchetype = useCallback((archetype: Archetype) => {
    setSelectedArchetypeState(archetype);
  }, []);

  const setSelectedWeaponAspect = useCallback((aspect: WeaponAspect) => {
    setSelectedWeaponAspectState(aspect);
  }, []);

  const rememberWeaponAspect = useCallback((weapon: WeaponType, aspect: WeaponAspect) => {
    const normalized = normalizeWeaponAspect(aspect, weapon);
    setWeaponAspectByWeapon((prev) => ({ ...prev, [weapon]: normalized }));
    setSelectedWeaponAspectState(normalized);
  }, []);

  const setAbilityLoadout = useCallback((loadout: AbilityLoadout | null) => {
    setAbilityLoadoutState(loadout);
  }, []);

  const setTalentLoadout = useCallback(
    (loadout: TalentLoadout | ((prev: TalentLoadout) => TalentLoadout)) => {
      setTalentLoadoutState((prev) => {
        const next = typeof loadout === 'function' ? loadout(prev) : loadout;
        return { ...createDefaultTalentLoadout(), ...next };
      });
    },
    [],
  );

  useEffect(() => {
    if (!socket || !currentRoomId || gameMode !== 'coop') return;
    if (!socket.connected) return;

    const localPlayerLevel = socket.id ? (players.get(socket.id)?.level ?? 1) : 1;
    const effectiveStats = StatSystem.getEffectiveStatsWithInventory(statPointData.stats, inventory);
    const effectiveIntellect = getEffectiveIntellectWithTalentBonuses(
      effectiveStats,
      talentLoadout,
      abilityLoadout,
    );
    const runeCount = getRuneCountForWeapon(selectedWeapons.primary, localPlayerLevel);

    socket.emit('coop-zombie-room-boons', {
      roomId: currentRoomId,
      coopZombieBoons: getCoopZombieRoomBoonsPayload(talentLoadout, {
        agility: effectiveStats.agility,
        strength: effectiveStats.strength,
        criticalRuneCount: runeCount,
        critDamageRuneCount: runeCount,
      }),
    });

    socket.emit('coop-stagger-room-boons', {
      roomId: currentRoomId,
      coopStaggerRoomBoons: getCoopStaggerRoomBoonsPayload(talentLoadout, {
        agility: effectiveStats.agility,
        strength: effectiveStats.strength,
        stamina: effectiveStats.stamina,
        intellect: effectiveIntellect,
        criticalRuneCount: runeCount,
        critDamageRuneCount: runeCount,
      }),
    });
    socket.emit('coop-allied-knight-boons', {
      roomId: currentRoomId,
      coopAlliedKnightBoons: getCoopAlliedKnightBoonsPayload(talentLoadout, {
        agility: effectiveStats.agility,
        strength: effectiveStats.strength,
        stamina: effectiveStats.stamina,
        intellect: effectiveIntellect,
      }),
    });

    socket.emit('coop-red-room-boons', {
      roomId: currentRoomId,
      coopRedRoomBoons: getCoopRedRoomBoonsPayload(talentLoadout),
    });
  }, [socket, currentRoomId, gameMode, talentLoadout, abilityLoadout, statPointData, inventory, selectedWeapons, players]);

  const updatePlayerLevel = useCallback((playerId: string, level: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-level-changed', {
        roomId: currentRoomId,
        playerId,
        level
      });

      setSkillPointData((prev) => SkillPointSystem.updateSkillPointsForLevel(prev, level));
      setStatPointData((prev) =>
        StatSystem.updateStatPointsForLevel(prev, level, inventoryRef.current),
      );
    }
  }, [socket, currentRoomId]);

  // Skill point system functions
  const unlockAbility = useCallback((unlock: AbilityUnlock) => {
    setSkillPointData((prev) => {
      try {
        return SkillPointSystem.unlockAbility(prev, unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
      } catch {
        return prev;
      }
    });
  }, []);

  const updateSkillPointsForLevel = useCallback((level: number) => {
    setSkillPointData((prev) => SkillPointSystem.updateSkillPointsForLevel(prev, level));
  }, []);

  const grantSkillPoints = useCallback((amount: number) => {
    setSkillPointData((prev) => SkillPointSystem.grantSkillPoints(prev, amount));
  }, []);

  const allocateStatPoint = useCallback((stat: StatKey) => {
    try {
      setStatPointData((prev) => StatSystem.allocateStat(prev, stat));
    } catch {
      // No points available
    }
  }, []);

  const updateStatPointsForLevel = useCallback((level: number) => {
    setStatPointData((prev) =>
      StatSystem.updateStatPointsForLevel(prev, level, inventoryRef.current),
    );
  }, []);

  const grantStatPoints = useCallback((amount: number) => {
    setStatPointData((prev) => StatSystem.grantStatPoints(prev, amount));
  }, []);

  const purchaseItem = useCallback((itemId: string, cost: number, currency: 'essence' | 'gold'): boolean => {
    const players = playersRef.current;
    let localPlayer = players.get(socket?.id || '');
    if (!localPlayer) {
      // If no player found by socket ID, try to find any player (for cases where socket isn't connected)
      const allPlayers = Array.from(players.values());
      localPlayer = allPlayers.find(p => p.id) || undefined;
    }

    if (!localPlayer) {
      return false;
    }

    // Check if item is already purchased
    if (localPlayer.purchasedItems?.includes(itemId)) {
      return false;
    }

    const currentEssence = localPlayer.essence || 0;
    const currentGold = localPlayer.gold || 0;
    const currentBalance = currency === 'gold' ? currentGold : currentEssence;
    if (currentBalance < cost) {
      return false;
    }

    // Deduct selected currency and add item to purchased items
    const updatedPlayer = {
      ...localPlayer,
      essence: currency === 'essence' ? currentEssence - cost : currentEssence,
      gold: currency === 'gold' ? currentGold - cost : currentGold,
      purchasedItems: [...(localPlayer.purchasedItems || []), itemId]
    };

    setPlayers(prev => new Map(prev).set(localPlayer.id, updatedPlayer));

    // Broadcast to other players
    if (socket && currentRoomId) {
      socket.emit('player-purchase', {
        roomId: currentRoomId,
        playerId: localPlayer.id,
        itemId,
        cost,
        currency
      });
    }

    return true;
  }, [socket, currentRoomId]);

  const purchaseMerchantItem = useCallback((stockId: string) => {
    if (!socket || !currentRoomId) return;
    socket.emit('coop-merchant-buy-item', {
      roomId: currentRoomId,
      stockId,
    });
  }, [socket, currentRoomId]);

  const purchaseMerchantHeal = useCallback(() => {
    if (!socket || !currentRoomId) return;
    socket.emit('coop-merchant-buy-heal', {
      roomId: currentRoomId,
    });
  }, [socket, currentRoomId]);

  const purchaseDreamLayerItem = useCallback((stockId: string) => {
    if (!socket || !currentRoomId) return;
    socket.emit('coop-dream-layer-buy-item', {
      roomId: currentRoomId,
      stockId,
    });
  }, [socket, currentRoomId]);

  const purchaseDreamLayerHeal = useCallback(() => {
    if (!socket || !currentRoomId) return;
    socket.emit('coop-dream-layer-buy-heal', {
      roomId: currentRoomId,
    });
  }, [socket, currentRoomId]);

  const registerMerchantPurchaseSuccessHandler = useCallback(
    (handler: (payload: MerchantPurchaseSuccessPayload) => void) => {
      merchantPurchaseSuccessHandlersRef.current.add(handler);
      return () => {
        merchantPurchaseSuccessHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerDeepSanctumRewardClaimedHandler = useCallback(
    (handler: (payload: DeepSanctumRewardClaimedPayload) => void) => {
      deepSanctumRewardClaimedHandlersRef.current.add(handler);
      return () => {
        deepSanctumRewardClaimedHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerMerchantNpcGreetHandler = useCallback(
    (handler: (payload: { kind: string }) => void) => {
      merchantNpcGreetHandlersRef.current.add(handler);
      return () => {
        merchantNpcGreetHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerPlayerGoldChangedHandler = useCallback(
    (handler: (payload: { playerId: string; gold: number }) => void) => {
      playerGoldChangedHandlersRef.current.add(handler);
      return () => {
        playerGoldChangedHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerPlayerFlowChangedHandler = useCallback(
    (handler: (payload: { playerId: string; flow: number }) => void) => {
      playerFlowChangedHandlersRef.current.add(handler);
      return () => {
        playerFlowChangedHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerPlayerFateChangedHandler = useCallback(
    (handler: (payload: { playerId: string; fate: number }) => void) => {
      playerFateChangedHandlersRef.current.add(handler);
      return () => {
        playerFateChangedHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerBossDefeatedHandler = useCallback(
    (handler: (payload: BossDefeatedPayload) => void) => {
      bossDefeatedHandlersRef.current.add(handler);
      return () => {
        bossDefeatedHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerBossItemPickupHandler = useCallback(
    (handler: (payload: BossItemPickupPayload) => void) => {
      bossItemPickupHandlersRef.current.add(handler);
      return () => {
        bossItemPickupHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerRunePickupHandler = useCallback(
    (handler: (payload: RunePickupPayload) => void) => {
      runePickupHandlersRef.current.add(handler);
      return () => {
        runePickupHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  // Chat functions
  const sendChatMessage = useCallback((message: string) => {
    if (!socket || !currentRoomId || !socket.id) return;

    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: socket.id,
      playerName: playersRef.current.get(socket.id)?.name || 'Unknown',
      message: message.trim(),
      timestamp: Date.now()
    };

    // Add to local chat messages immediately
    setChatMessages(prev => [...prev.slice(-49), chatMessage]); // Keep last 50 messages

    // Broadcast to other players
    socket.emit('chat-message', {
      roomId: currentRoomId,
      message: chatMessage
    });
  }, [socket, currentRoomId]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  // If we never got `camps-initialized` / `room-joined` campTypes, infer from synced enemies (late-join / edge cases).
  useEffect(() => {
    setCampTypes((prev) => {
      if (prev.length > 0) return prev;
      for (const enemy of Array.from(enemies.values())) {
        const k = enemy.campType?.toLowerCase();
        if (k && VALID_CAMP_KEYS.has(k)) return [k];
      }
      return prev;
    });
  }, [enemies]);

  const contextValue: MultiplayerContextType = useMemo(() => ({
    socket,
    isConnected,
    connectionError,
    isInRoom,
    currentRoomId,
    players,
    playerRosterMetaRev,
    playersRef,
    playersTransformsRef,
    enemies,
    enemiesRef,
    enemyTransformsRef,
    enemyVisualRotationsRef,
    killCount,
    skeletonKillCount,
    skeletonKillRequired,
    gameStarted,
    combatArenaActive,
    gameMode,
    campTypes,
    thronePortalOffer,
    thronePortalLayout,
    coopMainArenaPortalPhase,
    coopTerrainTheme,
    coopCurrentRoomKind,
    coopClearedRoomKind,
    coopColoredRoomVisitIndex,
    coopBossRoomVisitIndex,
    coopSkyPresetIndex,
    coopGrassPresetIndex,
    coopBossThroneArena,
    coopThroneBossKind,
    coopTransitionOverlay,
    coopPortalBlinkSeq,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopIntroIntermissionSeq,
    coopSunkenIntermissionSeq,
    coopEternityIntermissionSeq,
    coopFaeRealmIntermissionSeq,
    coopIntroPending,
    coopIntroActive,
    coopIntroRoomIndex,
    coopIntroPortalOpen,
    coopIntroFountainPhase,
    coopIntroFountainUsed,
    coopIntroAllyChoiceMade,
    coopFaeRealmPending,
    coopFaeRealmActive,
    coopFaeRealmRoomIndex,
    coopFaeRealmPortalOpen,
    coopFaeRealmBossKind,
    coopFaeBeastCompanionGranted,
    coopFaeBeastCompanionKind,
    coopSunkenActive,
    coopSunkenRoomIndex,
    coopSunkenPortalOpen,
    coopSunkenFountainPhase,
    coopSunkenFountainUsed,
    coopSunkenAllyChoiceMade,
    coopSunkenLootOffer,
    coopSunkenLootClaimedPlayerIds,
    coopSunkenLootPhaseComplete,
    coopSunkenCompleted,
    coopEternityActive,
    coopEternityRoomIndex,
    coopEternityPortalOpen,
    coopEternityFountainPhase,
    coopEternityFountainUsed,
    coopEternityLootOffer,
    coopEternityLootClaimedPlayerIds,
    coopEternityLootPhaseComplete,
    coopPetCompanionUpgrade,
    coopEternityCompleted,
    coopAllyKind,
    coopAllyOffer,
    coopVoidPortalOffered,
    coopDeepSanctumLevel,
    deepSanctumRewardKind,
    coopDeepSanctumIntermissionSeq,
    coopEdenFountainUsed,
    coopEdenResumeKind,
    coopEdenIntermissionSeq,
    coopFalseEdenCleared,
    deliriumStructure,
    coopDeliriumActive,
    coopDeliriumEventEnded,
    coopDeliriumSuccess,
    coopErebusGateActive,
    coopBossClearedBgmSeq,
    coopClearedRoomColor,
    clearCoopClearedRoomColor,
    lateJoinCombatLoadout,
    clearLateJoinCombatLoadout,
    hideCoopPortalTransition,
    confirmCoopPortalTransitionComplete,
    resetLocalPositionEmitThrottle,
    coopTransitionOverlayRef,
    coopPendingPortalSnapRef,
    coopRoomEntryTokenRef,
    coopCombatArenaEnterAtRef,
    endCoopPortalTransition,
    currentPreview,
    joinRoom,
    leaveRoom,
    previewRoom,
    clearPreview,
    startGame,
    enterCombatArena,
    useCoopFountain,
    chooseCoopAlly,
    chooseSunkenTempleLoot,
    chooseEternityPalaceLoot,
    chooseEternityPetUpgrade,
    claimPreBossReward,
    claimDeepSanctumReward,
    finishPreBossMerchant,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerArchetype,
    updatePlayerWeaponAspect,
    updatePlayerHealth,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerEffect,
    broadcastPlayerDamage,
    broadcastPlayerHealing,
    broadcastAlliedHealing,
    broadcastPlayerAnimationState,
    broadcastPlayerDebuff,
    broadcastPlayerStealth,
    broadcastPlayerKnockback,
    broadcastPlayerTornadoEffect,
    broadcastPlayerDeathEffect,
    damageEnemy,
    subscribeEnemyDamage,
    damageMushroom,
    detonateWyvernConcentratedVenom,
    triggerTyrantsCloakStrike,
    triggerDeathdealerStaggerProc,
    applyStatusEffect,
    mushroomState,
    updatePlayerExperience,
    updatePlayerLevel,
    updatePlayerEssence,
    updatePlayerGold,
    updatePlayerFlow,
    updatePlayerFate,
    updatePlayerShield,
    updatePlayerEnergy,
    selectedWeapons,
    selectedArchetype,
    selectedWeaponAspect,
    weaponAspectByWeapon,
    setSelectedWeapons,
    setSelectedArchetype,
    setSelectedWeaponAspect,
    rememberWeaponAspect,
    abilityLoadout,
    setAbilityLoadout,
    talentLoadout,
    setTalentLoadout,
    skillPointData,
    unlockAbility,
    updateSkillPointsForLevel,
    grantSkillPoints,
    statPointData,
    allocateStatPoint,
    updateStatPointsForLevel,
    grantStatPoints,
    purchaseItem,
    purchaseMerchantItem,
    purchaseMerchantHeal,
    purchaseDreamLayerItem,
    purchaseDreamLayerHeal,
    merchantPurchaseState,
    dreamLayerInventory,
    dreamLayerPurchaseState,
    registerMerchantPurchaseSuccessHandler,
    registerDeepSanctumRewardClaimedHandler,
    registerMerchantNpcGreetHandler,
    registerPlayerGoldChangedHandler,
    registerPlayerFlowChangedHandler,
    registerPlayerFateChangedHandler,
    registerBossDefeatedHandler,
    registerBossItemPickupHandler,
    registerRunePickupHandler,
    droppedItems,
    goldDrops,
    inventory,
    merchantInventory,
    pickupItem,
    pickupGoldDrop,
    chatMessages,
    isChatOpen,
    sendChatMessage,
    openChat,
    closeChat,
    setPlayers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [socket, isConnected, connectionError, isInRoom, currentRoomId, players, playerRosterMetaRev, enemies, killCount, skeletonKillCount, skeletonKillRequired, gameStarted, combatArenaActive, gameMode, campTypes, thronePortalOffer, thronePortalLayout, coopMainArenaPortalPhase, coopTerrainTheme, coopCurrentRoomKind, coopClearedRoomKind, coopColoredRoomVisitIndex, coopBossRoomVisitIndex, coopSkyPresetIndex, coopGrassPresetIndex, coopBossThroneArena, coopThroneBossKind, coopTransitionOverlay, coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq, coopBossClearedBgmSeq, coopClearedRoomColor, clearCoopClearedRoomColor, lateJoinCombatLoadout, clearLateJoinCombatLoadout, hideCoopPortalTransition, confirmCoopPortalTransitionComplete, endCoopPortalTransition, currentPreview, joinRoom, leaveRoom, previewRoom, clearPreview, startGame, enterCombatArena, updatePlayerPosition, updatePlayerWeapon, updatePlayerArchetype, updatePlayerWeaponAspect, updatePlayerHealth, broadcastPlayerAttack, broadcastPlayerAbility, broadcastPlayerEffect, broadcastPlayerDamage, broadcastPlayerHealing, broadcastAlliedHealing, broadcastPlayerAnimationState, broadcastPlayerDebuff, broadcastPlayerStealth, broadcastPlayerKnockback, broadcastPlayerTornadoEffect, broadcastPlayerDeathEffect, damageEnemy, subscribeEnemyDamage, damageMushroom, detonateWyvernConcentratedVenom, applyStatusEffect, mushroomState, updatePlayerExperience, updatePlayerLevel, updatePlayerEssence, updatePlayerGold, updatePlayerShield, selectedWeapons, selectedArchetype, selectedWeaponAspect, weaponAspectByWeapon, setSelectedWeapons, setSelectedArchetype, setSelectedWeaponAspect, rememberWeaponAspect, abilityLoadout, setAbilityLoadout, talentLoadout, setTalentLoadout, skillPointData, unlockAbility, updateSkillPointsForLevel, grantSkillPoints, statPointData, allocateStatPoint, updateStatPointsForLevel, grantStatPoints, purchaseItem, purchaseMerchantItem, purchaseMerchantHeal, merchantPurchaseState, registerMerchantPurchaseSuccessHandler, registerMerchantNpcGreetHandler, registerPlayerGoldChangedHandler, droppedItems, goldDrops, inventory, merchantInventory, pickupItem, pickupGoldDrop, chatMessages, isChatOpen, sendChatMessage, openChat, closeChat, setPlayers]);

  const actionsValue: MultiplayerActionsContextType = useMemo(
    () => ({
      socket,
      playersRef,
      playersTransformsRef,
      enemiesRef,
      enemyTransformsRef,
      enemyVisualRotationsRef,
      joinRoom,
      leaveRoom,
      previewRoom,
      clearPreview,
      startGame,
      enterCombatArena,
      useCoopFountain,
      chooseCoopAlly,
      chooseSunkenTempleLoot,
      chooseEternityPalaceLoot,
    chooseEternityPetUpgrade,
      claimPreBossReward,
      claimDeepSanctumReward,
      finishPreBossMerchant,
      updatePlayerPosition,
      updatePlayerWeapon,
      updatePlayerArchetype,
      updatePlayerWeaponAspect,
      updatePlayerHealth,
      broadcastPlayerAttack,
      broadcastPlayerAbility,
      broadcastPlayerEffect,
      broadcastPlayerDamage,
      broadcastPlayerHealing,
      broadcastAlliedHealing,
      broadcastPlayerAnimationState,
      broadcastPlayerDebuff,
      broadcastPlayerStealth,
      broadcastPlayerKnockback,
      broadcastPlayerTornadoEffect,
      broadcastPlayerDeathEffect,
      damageEnemy,
      subscribeEnemyDamage,
      detonateWyvernConcentratedVenom,
      triggerTyrantsCloakStrike,
      triggerDeathdealerStaggerProc,
      applyStatusEffect,
      damageMushroom,
      updatePlayerExperience,
      updatePlayerLevel,
      updatePlayerEssence,
      updatePlayerGold,
      updatePlayerFlow,
      updatePlayerFate,
      updatePlayerShield,
      updatePlayerEnergy,
      setSelectedWeapons,
      setSelectedArchetype,
      setSelectedWeaponAspect,
      rememberWeaponAspect,
      setAbilityLoadout,
      setTalentLoadout,
      unlockAbility,
      updateSkillPointsForLevel,
      grantSkillPoints,
      allocateStatPoint,
      updateStatPointsForLevel,
      grantStatPoints,
      purchaseItem,
      purchaseMerchantItem,
      purchaseMerchantHeal,
      purchaseDreamLayerItem,
      purchaseDreamLayerHeal,
      registerMerchantPurchaseSuccessHandler,
      registerDeepSanctumRewardClaimedHandler,
      registerMerchantNpcGreetHandler,
      registerPlayerGoldChangedHandler,
      registerPlayerFlowChangedHandler,
      registerPlayerFateChangedHandler,
      registerBossDefeatedHandler,
      registerBossItemPickupHandler,
      registerRunePickupHandler,
      pickupItem,
      pickupGoldDrop,
      sendChatMessage,
      openChat,
      closeChat,
      setPlayers,
      hideCoopPortalTransition,
      confirmCoopPortalTransitionComplete,
      resetLocalPositionEmitThrottle,
      coopTransitionOverlayRef,
      coopPendingPortalSnapRef,
      coopRoomEntryTokenRef,
      coopCombatArenaEnterAtRef,
      endCoopPortalTransition,
      clearCoopClearedRoomColor,
      clearLateJoinCombatLoadout,
    }),
    [
      socket,
      joinRoom,
      leaveRoom,
      previewRoom,
      clearPreview,
      startGame,
      enterCombatArena,
      useCoopFountain,
      chooseCoopAlly,
      chooseSunkenTempleLoot,
      chooseEternityPalaceLoot,
    chooseEternityPetUpgrade,
      claimPreBossReward,
      claimDeepSanctumReward,
      finishPreBossMerchant,
      updatePlayerPosition,
      updatePlayerWeapon,
      updatePlayerArchetype,
      updatePlayerWeaponAspect,
      updatePlayerHealth,
      broadcastPlayerAttack,
      broadcastPlayerAbility,
      broadcastPlayerEffect,
      broadcastPlayerDamage,
      broadcastPlayerHealing,
      broadcastAlliedHealing,
      broadcastPlayerAnimationState,
      broadcastPlayerDebuff,
      broadcastPlayerStealth,
      broadcastPlayerKnockback,
      broadcastPlayerTornadoEffect,
      broadcastPlayerDeathEffect,
      damageEnemy,
      subscribeEnemyDamage,
      detonateWyvernConcentratedVenom,
      triggerTyrantsCloakStrike,
      triggerDeathdealerStaggerProc,
      applyStatusEffect,
      damageMushroom,
      updatePlayerExperience,
      updatePlayerLevel,
      updatePlayerEssence,
      updatePlayerGold,
      updatePlayerFlow,
      updatePlayerFate,
      updatePlayerShield,
      updatePlayerEnergy,
      setSelectedWeapons,
      setSelectedArchetype,
      setSelectedWeaponAspect,
      rememberWeaponAspect,
      setAbilityLoadout,
      setTalentLoadout,
      unlockAbility,
      updateSkillPointsForLevel,
      grantSkillPoints,
      allocateStatPoint,
      updateStatPointsForLevel,
      grantStatPoints,
      purchaseItem,
      purchaseMerchantItem,
      purchaseMerchantHeal,
      purchaseDreamLayerItem,
      purchaseDreamLayerHeal,
      registerMerchantPurchaseSuccessHandler,
      registerDeepSanctumRewardClaimedHandler,
      registerMerchantNpcGreetHandler,
      registerPlayerGoldChangedHandler,
      registerPlayerFlowChangedHandler,
      registerPlayerFateChangedHandler,
      registerBossDefeatedHandler,
      registerBossItemPickupHandler,
      registerRunePickupHandler,
      pickupItem,
      pickupGoldDrop,
      sendChatMessage,
      openChat,
      closeChat,
      setPlayers,
      hideCoopPortalTransition,
      confirmCoopPortalTransitionComplete,
      resetLocalPositionEmitThrottle,
      coopTransitionOverlayRef,
      coopPendingPortalSnapRef,
      coopRoomEntryTokenRef,
      coopCombatArenaEnterAtRef,
      endCoopPortalTransition,
      clearCoopClearedRoomColor,
      clearLateJoinCombatLoadout,
    ],
  );

  const roomValue: MultiplayerRoomContextType = useMemo(
    () => ({
      isConnected,
      connectionError,
      isInRoom,
      currentRoomId,
      players,
      playerRosterMetaRev,
      enemies,
      killCount,
      skeletonKillCount,
      skeletonKillRequired,
      gameStarted,
      combatArenaActive,
      gameMode,
      campTypes,
      thronePortalOffer,
      thronePortalLayout,
      coopMainArenaPortalPhase,
      coopTerrainTheme,
      coopCurrentRoomKind,
      coopClearedRoomKind,
      coopColoredRoomVisitIndex,
      coopBossRoomVisitIndex,
      coopSkyPresetIndex,
      coopGrassPresetIndex,
      coopBossThroneArena,
      coopThroneBossKind,
      coopTransitionOverlay,
      coopPortalBlinkSeq,
      coopCombatArenaEnterSeq,
      coopMainArenaIntermissionSeq,
      coopIntroIntermissionSeq,
      coopSunkenIntermissionSeq,
      coopEternityIntermissionSeq,
      coopFaeRealmIntermissionSeq,
      coopIntroPending,
      coopIntroActive,
      coopIntroRoomIndex,
      coopIntroPortalOpen,
      coopIntroFountainPhase,
      coopIntroFountainUsed,
      coopIntroAllyChoiceMade,
      coopFaeRealmPending,
      coopFaeRealmActive,
      coopFaeRealmRoomIndex,
      coopFaeRealmPortalOpen,
      coopFaeRealmBossKind,
      coopFaeBeastCompanionGranted,
      coopFaeBeastCompanionKind,
      coopSunkenActive,
      coopSunkenRoomIndex,
      coopSunkenPortalOpen,
      coopSunkenFountainPhase,
      coopSunkenFountainUsed,
      coopSunkenAllyChoiceMade,
      coopSunkenLootOffer,
      coopSunkenLootClaimedPlayerIds,
      coopSunkenLootPhaseComplete,
      coopSunkenCompleted,
      coopEternityActive,
      coopEternityRoomIndex,
      coopEternityPortalOpen,
      coopEternityFountainPhase,
      coopEternityFountainUsed,
      coopEternityLootOffer,
      coopEternityLootClaimedPlayerIds,
      coopEternityLootPhaseComplete,
    coopPetCompanionUpgrade,
      coopEternityCompleted,
      coopAllyKind,
      coopAllyOffer,
      coopVoidPortalOffered,
      coopDeepSanctumLevel,
      deepSanctumRewardKind,
      coopDeepSanctumIntermissionSeq,
      coopEdenFountainUsed,
      coopEdenResumeKind,
      coopEdenIntermissionSeq,
      coopFalseEdenCleared,
      deliriumStructure,
      coopDeliriumActive,
      coopDeliriumEventEnded,
      coopDeliriumSuccess,
      coopErebusGateActive,
      coopBossClearedBgmSeq,
      coopClearedRoomColor,
      lateJoinCombatLoadout,
      currentPreview,
      chatMessages,
      isChatOpen,
      selectedWeapons,
      selectedArchetype,
      selectedWeaponAspect,
      weaponAspectByWeapon,
      skillPointData,
      statPointData,
      abilityLoadout,
      talentLoadout,
      droppedItems,
      goldDrops,
      inventory,
      merchantInventory,
      merchantPurchaseState,
      dreamLayerInventory,
      dreamLayerPurchaseState,
      mushroomState,
    }),
    [
      isConnected,
      connectionError,
      isInRoom,
      currentRoomId,
      players,
      playerRosterMetaRev,
      enemies,
      killCount,
      skeletonKillCount,
      skeletonKillRequired,
      gameStarted,
      combatArenaActive,
      gameMode,
      campTypes,
      thronePortalOffer,
      thronePortalLayout,
      coopMainArenaPortalPhase,
      coopTerrainTheme,
      coopCurrentRoomKind,
      coopClearedRoomKind,
      coopColoredRoomVisitIndex,
      coopBossRoomVisitIndex,
      coopSkyPresetIndex,
      coopGrassPresetIndex,
      coopBossThroneArena,
      coopThroneBossKind,
      coopTransitionOverlay,
      coopPortalBlinkSeq,
      coopCombatArenaEnterSeq,
      coopMainArenaIntermissionSeq,
      coopIntroIntermissionSeq,
      coopSunkenIntermissionSeq,
      coopEternityIntermissionSeq,
      coopFaeRealmIntermissionSeq,
      coopIntroPending,
      coopIntroActive,
      coopIntroRoomIndex,
      coopIntroPortalOpen,
      coopIntroFountainPhase,
      coopIntroFountainUsed,
      coopIntroAllyChoiceMade,
      coopFaeRealmPending,
      coopFaeRealmActive,
      coopFaeRealmRoomIndex,
      coopFaeRealmPortalOpen,
      coopFaeRealmBossKind,
      coopFaeBeastCompanionGranted,
      coopFaeBeastCompanionKind,
      coopPetCompanionUpgrade,
      coopEdenFountainUsed,
      coopEdenResumeKind,
      coopEdenIntermissionSeq,
      coopFalseEdenCleared,
      deliriumStructure,
      coopDeliriumActive,
      coopDeliriumEventEnded,
      coopDeliriumSuccess,
      coopErebusGateActive,
      coopBossClearedBgmSeq,
      coopClearedRoomColor,
      lateJoinCombatLoadout,
      currentPreview,
      chatMessages,
      isChatOpen,
      selectedWeapons,
      selectedArchetype,
      selectedWeaponAspect,
      weaponAspectByWeapon,
      skillPointData,
      statPointData,
      abilityLoadout,
      talentLoadout,
      droppedItems,
      goldDrops,
      inventory,
      merchantInventory,
      merchantPurchaseState,
      dreamLayerInventory,
      dreamLayerPurchaseState,
      mushroomState,
    ],
  );

  return (
    <MultiplayerActionsContext.Provider value={actionsValue}>
      <MultiplayerRoomContext.Provider value={roomValue}>
        <MultiplayerContext.Provider value={contextValue}>
          {children}
        </MultiplayerContext.Provider>
      </MultiplayerRoomContext.Provider>
    </MultiplayerActionsContext.Provider>
  );
}
