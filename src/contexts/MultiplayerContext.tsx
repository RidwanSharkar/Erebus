'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout, getDefaultLoadout } from '@/utils/weaponAbilities';
import { TalentLoadout, createDefaultTalentLoadout, getCoopZombieRoomBoonsPayload, getCoopStaggerRoomBoonsPayload } from '@/utils/talents';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import { StatSystem, StatPointData, StatKey, PlayerStats } from '@/utils/StatSystem';
import { getRuneCountForWeapon } from '@/utils/runeCount';
import type { ItemRarity } from '@/utils/itemRarity';
import { Vector3 } from '@/utils/three-exports';
import { applyEnemyMoveBatch, type EnemyLiveTransform } from '@/utils/enemyLiveTransform';

export type CoopRoomKind = 'red' | 'blue' | 'green' | 'purple' | 'stat' | 'trial' | 'merchant' | 'boss';
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
}

export interface Player {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weapon: WeaponType;
  subclass?: WeaponSubclass;
  health: number;
  maxHealth: number;
  shield?: number;
  maxShield?: number;
  movementDirection?: PlayerMovementDirection;
  // Co-op Experience system
  experience?: number;
  level?: number;
  // Essence currency system
  essence?: number;
  gold?: number;
  // Purchased items
  purchasedItems?: string[];
  // Venom status effects
  isVenomed?: boolean;
  venomedUntil?: number;
  // Character stat system
  stats?: PlayerStats;
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
  /** Glacial Bite — Barrage chill stacks; 5 stacks → 6s freeze on server. */
  glacialBiteChill?: boolean;
  /** Glacial Talons — Reaping Talons double damage vs frozen on server. */
  glacialTalons?: boolean;
  /** Entanglement — Barrage hit roots and squeezes target on server. */
  entanglementBarrage?: boolean;
  /** Tempest Rounds burst — Arctic Sting chill on hit. */
  tempestBurstArcticChill?: boolean;
  /** Tempest Rounds burst — Wyvern Sting zombie on kill. */
  tempestBurstWyvernZombie?: boolean;
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
  /** Co-op throne prep: timer-spawned hostile knights (server clears on arena transition). */
  throneKnight?: boolean;
  /** Co-op throne prep: which model to show for `training-dummy` */
  dummyVisual?: 'knight';
  soulType?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
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
  expireAt?: number;
  /** Juggernaut Strain coop room boon — larger client model when `juggernaut`. */
  zombieVariant?: 'standard' | 'juggernaut';
  /** Staggering Strike buildup (0–100), server-authoritative. */
  staggerBuildup?: number;
  /** Boss3 Weaver Nexus summoned ghoul — larger client model. */
  visualScale?: number;
  /** Per-ghoul leap landing damage override (Boss3 summons deal 2×). */
  leapDamage?: number;
  /** Titan Bladestorm — active at ≤40% HP until death. */
  bladestormActive?: boolean;
  bladestormStartTime?: number;
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
  category?: 'amulet' | 'boss_drop';
  position: { x: number; y: number; z: number };
  droppedAt: number;
  /** Boss drops: flat stat points granted on pickup */
  statBonus?: number;
  rarity?: ItemRarity;
}

export interface InventoryItem {
  id: string;
  type: string;
  stat?: StatKey;
  label: string;
  category?: 'amulet' | 'boss_drop';
  pickedUpAt: number;
  statBonus?: number;
  rarity?: ItemRarity;
}

export interface MerchantStockItem {
  id: string;
  kind: 'boss_drop' | 'dash_charge' | 'weapon_talent';
  cost: number;
  sold?: boolean;
  label?: string;
  description?: string;
  item?: Omit<DroppedItem, 'position' | 'droppedAt'> & Partial<Pick<DroppedItem, 'position' | 'droppedAt'>>;
}

export interface MerchantPurchaseState {
  dashChargePurchased: boolean;
  weaponTalentPurchases: number;
}

export type MerchantPurchaseSuccessKind = 'boss_drop' | 'dash_charge' | 'weapon_talent';

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
  enemies: Map<string, Enemy>;
  /** Always-current enemy metadata mirror (includes in-place position updates from movement ref). */
  enemiesRef: React.MutableRefObject<Map<string, Enemy>>;
  /** Server-authoritative enemy positions/rotations updated without React setState (~30 Hz). */
  enemyTransformsRef: React.MutableRefObject<Map<string, EnemyLiveTransform>>;
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
  /** Co-op: main combat map — two portals (wave 2), boss gate, or post-boss continuation. Null otherwise. */
  coopMainArenaPortalPhase: 'pick_wave2' | 'pick_boss' | 'pick_post_boss' | null;
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
   * Co-op: stripped throne shell (boss fight + post-boss portal pause). False on prep throne and main castle map.
   * Authoritative from server (`room-joined`, `combat-arena-entered`, `coop-main-arena-intermission`).
   */
  coopBossThroneArena: boolean;
  /**
   * Co-op: which boss the throne fight is (boss tier 1, Archon tier 2, or Weaver Nexus tier 3).
   * From `room-joined`, `combat-arena-entered`, `coop-main-arena-intermission`, `game-started`.
   */
  coopThroneBossKind: 'boss' | 'boss2' | 'boss3' | 'boss_all' | null;
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

  // Skill point system state
  skillPointData: SkillPointData;

  // Stat point system state
  statPointData: StatPointData;

  // Room preview
  currentPreview: RoomPreview | null;
  
  // Actions
  joinRoom: (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'coop') => Promise<string>;
  leaveRoom: () => void;
  previewRoom: (roomId: string) => void;
  clearPreview: () => void;
  startGame: () => void;
  /** Co-op: request transition from throne room to main combat arena (server-authoritative). */
  enterCombatArena: (chosenCampType?: string) => void;
  
  // Player actions
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: PlayerMovementDirection) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass) => void;
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
  applyStatusEffect: (enemyId: string, effectType: string, duration: number) => void;

  /** Co-op: ring mushroom HP (server sync). */
  mushroomState: { health: number[]; maxHealth: number } | null;
  damageMushroom: (index: number, damage: number, sourcePlayerId?: string) => void;

  // Experience system actions
  updatePlayerExperience: (playerId: string, experience: number) => void;
  updatePlayerLevel: (playerId: string, level: number) => void;

  // Essence currency system actions
  updatePlayerEssence: (playerId: string, essence: number) => void;
  updatePlayerGold: (playerId: string, gold: number) => void;

  // Shield actions
  updatePlayerShield: (playerId: string, shield: number, maxShield?: number) => void;

  // Weapon selection actions
  setSelectedWeapons: (weapons: { primary: WeaponType; secondary: WeaponType }) => void;

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
  registerMerchantPurchaseSuccessHandler: (
    handler: (payload: MerchantPurchaseSuccessPayload) => void,
  ) => () => void;
  pickupItem: (itemId: string) => void;
  pickupGoldDrop: (dropId: string) => void;

  // Merchant purchase actions
  purchaseItem: (itemId: string, cost: number, currency: 'essence' | 'gold') => boolean;
  purchaseMerchantItem: (stockId: string) => void;
  purchaseMerchantHeal: () => void;

  // Chat actions
  sendChatMessage: (message: string) => void;
  openChat: () => void;
  closeChat: () => void;

  // Direct state setters for local visual updates (use with caution)
  setPlayers: React.Dispatch<React.SetStateAction<Map<string, Player>>>;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}

interface MultiplayerProviderProps {
  children: React.ReactNode;
}

const VALID_CAMP_KEYS = new Set(['red', 'blue', 'green', 'purple']);
const VALID_COOP_ROOM_KINDS = new Set(['red', 'blue', 'green', 'purple', 'stat', 'trial', 'merchant', 'boss']);
const VALID_COOP_TERRAIN_THEMES = new Set(['purple', 'blue', 'green']);

function normalizeThronePortalLayout(v: unknown): 'rim' | 'center' {
  return v === 'center' ? 'center' : 'rim';
}

function normalizeCoopMainArenaPhase(v: unknown): 'pick_wave2' | 'pick_boss' | 'pick_post_boss' | null {
  if (v === 'pick_wave2' || v === 'pick_boss' || v === 'pick_post_boss') return v;
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
    return kind === 'dash_charge' || kind === 'weapon_talent';
  }).map((entry) => ({
    ...entry,
    kind: entry.kind || 'boss_drop',
  }));
}

function normalizeMerchantPurchaseState(v: unknown): MerchantPurchaseState {
  if (v == null || typeof v !== 'object') {
    return { dashChargePurchased: false, weaponTalentPurchases: 0 };
  }
  const s = v as MerchantPurchaseState;
  return {
    dashChargePurchased: !!s.dashChargePurchased,
    weaponTalentPurchases: Math.max(0, Number(s.weaponTalentPurchases) || 0),
  };
}

function normalizeCoopTerrainTheme(v: unknown): CoopTerrainTheme {
  const k = String(v || '').toLowerCase();
  return VALID_COOP_TERRAIN_THEMES.has(k) ? (k as CoopTerrainTheme) : 'purple';
}

function normalizeCoopBossThroneArena(v: unknown): boolean {
  return v === true;
}

function normalizeCoopThroneBossKind(v: unknown): 'boss' | 'boss2' | 'boss3' | 'boss_all' | null {
  const k = String(v || '').toLowerCase();
  if (k === 'boss_all') return 'boss_all';
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

export function MultiplayerProvider({ children }: MultiplayerProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
  const enemiesRef = useRef<Map<string, Enemy>>(enemies);
  const enemyTransformsRef = useRef<Map<string, EnemyLiveTransform>>(new Map());

  enemiesRef.current = enemies;

  const playersRef = useRef(players);
  playersRef.current = players;

  // Keep transform ref aligned with React enemy lifecycle (spawn/despawn); movement bypasses setState.
  useEffect(() => {
    const ids = new Set(enemies.keys());
    for (const id of Array.from(enemyTransformsRef.current.keys())) {
      if (!ids.has(id)) enemyTransformsRef.current.delete(id);
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
    'pick_wave2' | 'pick_boss' | 'pick_post_boss' | null
  >(null);
  const [coopCurrentRoomKind, setCoopCurrentRoomKind] = useState<CoopRoomKind | null>(null);
  const [coopClearedRoomKind, setCoopClearedRoomKind] = useState<CoopRoomKind | null>(null);
  const [coopColoredRoomVisitIndex, setCoopColoredRoomVisitIndex] = useState<number | null>(null);
  const [coopBossRoomVisitIndex, setCoopBossRoomVisitIndex] = useState<number | null>(null);
  const [coopBossThroneArena, setCoopBossThroneArena] = useState(false);
  const [coopThroneBossKind, setCoopThroneBossKind] = useState<'boss' | 'boss2' | 'boss3' | 'boss_all' | null>(null);
  const [coopTerrainTheme, setCoopTerrainTheme] = useState<CoopTerrainTheme>('purple');
  const [coopTransitionOverlay, setCoopTransitionOverlay] = useState(false);
  const [coopPortalBlinkSeq, setCoopPortalBlinkSeq] = useState(0);
  const pendingLocalPortalBlinkRef = useRef(false);
  const [coopCombatTransitionId, setCoopCombatTransitionId] = useState<number | null>(null);
  const [coopCombatArenaEnterSeq, setCoopCombatArenaEnterSeq] = useState(0);
  const [coopMainArenaIntermissionSeq, setCoopMainArenaIntermissionSeq] = useState(0);
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
  });
  const merchantPurchaseSuccessHandlersRef = useRef<
    Set<(payload: MerchantPurchaseSuccessPayload) => void>
  >(new Set());

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  /** Deferred `io()` so React Strict Mode’s mount→unmount→mount does not disconnect a half-open socket. */
  const socketConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSocketRef = useRef<Socket | null>(null);

  // Throttling refs to prevent infinite re-render loops
  const lastPlayerMoveUpdate = useRef<{ [playerId: string]: number }>({});
  const lastPlayerHealthUpdate = useRef<{ [playerId: string]: number }>({});
  const lastEnemyMoveUpdate = useRef<{ [enemyId: string]: number }>({});
  const lastEnemyDamageUpdate = useRef<{ [enemyId: string]: number }>({});
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
      console.log('❌ Disconnected from server:', reason);
      cancelPendingEnemyRemovals();
      setIsConnected(false);
      setSocket(null); // Clear socket reference
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      enemyTransformsRef.current.clear();
      setCampTypes([]);
      setCoopTerrainTheme('purple');
      setSkeletonKillCount(0);
      setSkeletonKillRequired(8);
      setDroppedItems(new Map());
      setGoldDrops(new Map());
      setInventory([]);
      setMerchantInventory([]);

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
      if ((data.gameMode || 'multiplayer') === 'coop' && data.gameStarted) {
        setCombatArenaActive(!!data.combatArenaActive);
      } else {
        setCombatArenaActive(true);
      }

      // Update players
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);

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

    addEventHandler('player-moved', (data) => {
      // Throttle player movement updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastPlayerMoveUpdate.current[data.playerId] || 0;
      if (now - lastUpdate < 16) { // Throttle to ~60fps
        return;
      }
      lastPlayerMoveUpdate.current[data.playerId] = now;

      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            updated.set(data.playerId, {
              ...player,
              position: data.position,
              rotation: data.rotation,
              movementDirection: data.movementDirection
            });
          }
          return updated;
        });
      });
    });

    addEventHandler('player-weapon-changed', (data) => {
      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            updated.set(data.playerId, {
              ...player,
              weapon: data.weapon,
              subclass: data.subclass
            });
          }
          return updated;
        });
      });
    });

    addEventHandler('player-health-updated', (data) => {
      // Throttle player health updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastPlayerHealthUpdate.current[data.playerId] || 0;
      if (now - lastUpdate < 100) { // Throttle to 10fps for health updates
        return;
      }
      lastPlayerHealthUpdate.current[data.playerId] = now;

      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            updated.set(data.playerId, {
              ...player,
              health: data.health,
              maxHealth: data.maxHealth
            });
          }
          return updated;
        });
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
      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(data.titanId);
        if (enemy) {
          updated.set(data.titanId, {
            ...enemy,
            bladestormActive: true,
            bladestormStartTime: data.startTime,
          });
        }
        return updated;
      });
    });

    addEventHandler('reaper-crossentropy-stack', (data: { stacks: number }) => {
      (window as any).controlSystemRef?.current?.setReaperCrossentropyStack(data.stacks ?? 0);
    });

    addEventHandler('backstab-killstreak-stack', (data: { stacks: number }) => {
      (window as any).controlSystemRef?.current?.setBackstabKillstreakStack(data.stacks ?? 0);
    });

    addEventHandler('sabres-relentless-backstab-kill', () => {
      const cs = (window as any).controlSystemRef?.current;
      cs?.resetBackstabCooldownForRelentless();
      (window as any).audioSystem?.playLesserHealSound?.();
      const playerPos = cs?.getPlayerWorldPosition?.();
      if (playerPos) {
        const healPos = new Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);
        const mgr = (window as any).damageNumberManager;
        mgr?.addDamageNumber?.(30, false, healPos, 'healing');
      }
    });

    addEventHandler('mushroom-damaged', (data: { index: number; newHealth: number; maxHealth: number }) => {
      setMushroomState((prev) => {
        if (!prev) return prev;
        const h = [...prev.health];
        if (data.index >= 0 && data.index < h.length) h[data.index] = data.newHealth;
        return { health: h, maxHealth: data.maxHealth ?? prev.maxHealth };
      });
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
          data.damageType === 'venom' ||
          data.damageType === 'wyvern_talons_detonate' ||
          data.damageType === 'player_zombie' ||
          data.damageType === 'zombie_explosion' ||
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
            data.damageType === 'venom' || data.damageType === 'wyvern_talons_detonate'
              ? 'venom'
              : data.damageType === 'crossentropy'
                ? 'crossentropy'
                : data.damageType === 'cloudkill'
                  ? 'cloudkill'
                  : data.damageType === 'player_zombie' || data.damageType === 'zombie_explosion'
                  ? 'player_zombie'
                  : 'ignite';
          mgr.addDamageNumber(data.damage, false, pos, dt);
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

      // Throttle enemy damage updates to prevent infinite re-renders (throne training dummy: always apply so HP bar stays accurate under rapid fire). Never throttle kill packets — dropping wasKilled breaks death VFX/sync.
      const now = Date.now();
      const lastUpdate = lastEnemyDamageUpdate.current[data.enemyId] || 0;
      const urgent = data.wasKilled === true;
      if (!isThroneDummy && !urgent && now - lastUpdate < 50) {
        return;
      }
      lastEnemyDamageUpdate.current[data.enemyId] = now;

      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(data.enemyId);
        if (enemy) {
          // Update enemy health and maxHealth with new values from server
          enemy.health = data.newHealth;
          enemy.maxHealth = data.maxHealth;

          // Mark dying so renderers run death animations (throne / training dummies excluded)
          if (enemy.type !== 'training-dummy' && !isThroneDummy) {
            const shouldMarkDying =
              data.wasKilled === true ||
              (typeof data.newHealth === 'number' && data.newHealth <= 0);
            if (shouldMarkDying) {
              enemy.isDying = true;
              if (data.wasKilled === true) {
                (window as any).audioSystem?.playEnemyDeathSound(enemy.position, enemy.type);
              }
            }
          }
        }
        // Silently ignore if enemy not found - it may have been removed already (died)
        return updated;
      });
    });

    addEventHandler('enemy-stagger-updated', (data: { enemyId: string; stagger: number }) => {
      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(data.enemyId);
        if (enemy) {
          updated.set(data.enemyId, { ...enemy, staggerBuildup: data.stagger });
        }
        return updated;
      });
    });

    addEventHandler('allied-knight-orbs-updated', (data: {
      knightId?: string;
      slots?: boolean[];
      recoverAt?: number[];
    }) => {
      const knightId = data.knightId || 'allied-knight';
      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(knightId);
        if (enemy) {
          updated.set(knightId, {
            ...enemy,
            alliedOrbSlots: Array.isArray(data.slots) ? [...data.slots] : enemy.alliedOrbSlots,
            alliedOrbRecoverAt: Array.isArray(data.recoverAt) ? [...data.recoverAt] : enemy.alliedOrbRecoverAt,
          });
        }
        return updated;
      });
    });

    // Batched movement updates: ref-only — avoids ~30 Hz React re-renders of the full scene tree.
    addEventHandler('enemies-moved', (data: { moves: Array<{ enemyId: string; position: { x: number; y: number; z: number }; rotation: number }>; timestamp: number }) => {
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

    // Update enemy health when a Weaver heals an ally
    addEventHandler('enemy-healed', (data) => {
      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(data.enemyId);
        if (enemy) {
          enemy.health    = data.newHealth;
          enemy.maxHealth = data.maxHealth;
        }
        return updated;
      });
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
      // Grant stat only to the player who picked it up
      if (newSocket.id && data.playerId === newSocket.id) {
        const isAmuletPickup =
          typeof data.item.type === 'string' && data.item.type.startsWith('AMULET_OF');
        if (isAmuletPickup) {
          (window as any).audioSystem?.playUITomePickupSound?.();
        }
        if (data.item.stat != null) {
          const bonus = data.item.statBonus;
          if (bonus != null && bonus > 0) {
            setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!, bonus));
          } else if (bonus == null) {
            setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!));
          }
        }
        setInventory(prev => [
          ...prev,
          {
            id: data.itemId,
            type: data.item.type,
            stat: data.item.stat,
            label: data.item.label,
            category: data.item.category,
            statBonus: data.item.statBonus,
            rarity: data.item.rarity,
            pickedUpAt: Date.now()
          }
        ]);
      }
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
      setPlayers(prev => {
        const next = new Map(prev);
        const player = next.get(data.playerId);
        if (player) {
          next.set(data.playerId, {
            ...player,
            gold: data.gold,
          });
        }
        return next;
      });
    });

    addEventHandler('merchant-inventory-updated', (data: { inventory?: unknown }) => {
      setMerchantInventory(normalizeMerchantInventory(data?.inventory));
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

    addEventHandler('game-started', (data: any) => {
      cancelPendingEnemyRemovals();
      setGameStarted(true);
      setKillCount(data.killCount);
      if (data && 'combatArenaActive' in data) {
        setCombatArenaActive(!!data.combatArenaActive);
      }
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
      // Authoritative enemy list (co-op throne dummy + any spawns) — fixes missed `enemy-spawned` ordering.
      if (data?.enemies && Array.isArray(data.enemies)) {
        setEnemies((prev) => {
          const next = new Map(prev);
          for (const e of data.enemies as Enemy[]) {
            next.set(e.id, { ...e, staggerBuildup: e.staggerBuildup ?? 0 });
          }
          return next;
        });
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
      setCoopClearedRoomKind(normalizeCoopRoomKind(data?.coopClearedRoomKind));
      setCoopColoredRoomVisitIndex(null);
      setCoopBossRoomVisitIndex(null);
      setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
      setMerchantPurchaseState({ dashChargePurchased: false, weaponTalentPurchases: 0 });
      if (data?.mushroomState?.health && Array.isArray(data.mushroomState.health)) {
        setMushroomState({
          health: [...data.mushroomState.health],
          maxHealth: data.mushroomState.maxHealth ?? 10,
        });
      }
    });

    addEventHandler('boss-defeated', () => {
      setCoopBossClearedBgmSeq((s) => s + 1);
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
      setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
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

    addEventHandler('combat-arena-entered', (data: any) => {
      setCombatArenaActive(true);
      // Boss throne shell: keep gate intermission colour so perimeter matches SimpleBorderEffects / prep throne.
      if (!normalizeCoopBossThroneArena(data?.coopBossThroneArena)) {
        setCoopClearedRoomColor(null);
      }
      setThronePortalOffer([]);
      setThronePortalLayout('rim');
      setCoopMainArenaPortalPhase(null);
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
      setCoopColoredRoomVisitIndex(normalizeCoopColoredRoomVisitIndex(data?.coopColoredRoomVisitIndex));
      setCoopBossRoomVisitIndex(normalizeCoopBossRoomVisitIndex(data?.coopBossRoomVisitIndex));
      setMerchantInventory(normalizeMerchantInventory(data?.merchantInventory));
      const transitionId = data?.coopCombatTransitionId != null
        ? Number(data.coopCombatTransitionId)
        : NaN;
      setCoopCombatTransitionId(Number.isFinite(transitionId) ? transitionId : null);
      setCoopTransitionOverlay(true);
      setCoopCombatArenaEnterSeq((s) => s + 1);
      if (pendingLocalPortalBlinkRef.current) {
        pendingLocalPortalBlinkRef.current = false;
      } else {
        setCoopPortalBlinkSeq((s) => s + 1);
      }
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
      // console.log('📈 Player experience gained:', data);
      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(data.playerId);
        if (player) {
          const newExperience = (player.experience || 0) + data.experienceGained;
          const newLevel = ExperienceSystem.getLevelFromExperience(newExperience);

          updated.set(data.playerId, {
            ...player,
            experience: newExperience,
            level: newLevel
          });
        }
        return updated;
      });

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
      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(data.playerId);
        if (player) {
          updated.set(data.playerId, {
            ...player,
            experience: data.experience,
            level: data.level
          });
        }
        return updated;
      });
    });


    addEventHandler('player-purchase', (data) => {
      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(data.playerId);
        if (player) {
          const nextEssence =
            data.currency === 'essence' ? (player.essence || 0) - data.cost : (player.essence || 0);
          const nextGold =
            data.currency === 'gold' ? (player.gold || 0) - data.cost : (player.gold || 0);
          updated.set(data.playerId, {
            ...player,
            purchasedItems: [...(player.purchasedItems || []), data.itemId],
            essence: nextEssence,
            gold: nextGold,
          });
        }
        return updated;
      });
    });

    addEventHandler('chat-message', (data) => {
      setChatMessages(prev => {
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerId: data.message.playerId || 'unknown',
          playerName: data.message.playerName || 'Unknown',
          message: data.message,
          timestamp: Date.now()
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
      pendingEnemyRemovalsRef.current.add(id);
      // Prune throttle maps so they don't accumulate stale entries
      delete lastEnemyMoveUpdate.current[id];
      delete lastEnemyDamageUpdate.current[id];
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
      setCampTypes([]);
      setCoopTerrainTheme('purple');
      setDroppedItems(new Map());
      setGoldDrops(new Map());
      setInventory([]);
      setMerchantInventory([]);

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

    return new Promise<string>((resolve, reject) => {
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
      const handleRoomJoined = (data: { roomId?: string }) => {
        clearTimeout(timeout);
        socket.off('room-joined', handleRoomJoined);
        socket.off('room-full', handleRoomFull);
        resolve(data?.roomId ?? roomId);
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
    setKillCount(0);
    setSkeletonKillCount(0);
    setSkeletonKillRequired(8);
    setGameStarted(false);
    setCombatArenaActive(true);
    setGameMode('multiplayer');
    setCampTypes([]);
    setCoopTerrainTheme('purple');
    setThronePortalOffer([]);
    setThronePortalLayout('rim');
    setCoopMainArenaPortalPhase(null);
    setCoopBossThroneArena(false);
    setCoopThroneBossKind(null);
    setCoopTransitionOverlay(false);
    setCoopPortalBlinkSeq(0);
    pendingLocalPortalBlinkRef.current = false;
    setCoopCombatTransitionId(null);
    setCoopCombatArenaEnterSeq(0);
    setCoopMainArenaIntermissionSeq(0);
    setCoopBossClearedBgmSeq(0);
    setLateJoinCombatLoadout(null);
    setMushroomState(null);
    setDroppedItems(new Map());
    setGoldDrops(new Map());
    setInventory([]);
    setMerchantInventory([]);
    setSelectedWeaponsState({ primary: WeaponType.NONE, secondary: WeaponType.NONE });
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
    setCoopPortalBlinkSeq((s) => s + 1);
    setCoopTransitionOverlay(true);
  }, []);

  const enterCombatArena = useCallback((chosenCampType?: string) => {
    startCoopPortalBlink();
    if (socket && currentRoomId) {
      socket.emit('enter-combat-arena', { roomId: currentRoomId, chosenCampType });
    }
  }, [socket, currentRoomId, startCoopPortalBlink]);

  const hideCoopPortalTransition = useCallback(() => {
    setCoopTransitionOverlay(false);
  }, []);

  const confirmCoopPortalTransitionComplete = useCallback(() => {
    if (socket && currentRoomId && coopCombatTransitionId != null) {
      socket.emit('coop-combat-transition-ready', {
        roomId: currentRoomId,
        transitionId: coopCombatTransitionId,
        timestamp: Date.now(),
      });
    }
    setCoopCombatTransitionId(null);
  }, [socket, currentRoomId, coopCombatTransitionId]);

  const endCoopPortalTransition = useCallback(() => {
    if (socket && currentRoomId && coopCombatTransitionId != null) {
      socket.emit('coop-combat-transition-ready', {
        roomId: currentRoomId,
        transitionId: coopCombatTransitionId,
        timestamp: Date.now(),
      });
    }
    setCoopCombatTransitionId(null);
    setCoopTransitionOverlay(false);
  }, [socket, currentRoomId, coopCombatTransitionId]);

  const clearCoopClearedRoomColor = useCallback(() => {
    setCoopClearedRoomColor(null);
    setCoopClearedRoomKind(null);
  }, []);

  const clearLateJoinCombatLoadout = useCallback(() => {
    setLateJoinCombatLoadout(null);
  }, []);

  const updatePlayerPosition = useCallback((position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: PlayerMovementDirection) => {
    if (socket && currentRoomId) {
      socket.emit('player-update', {
        roomId: currentRoomId,
        position,
        rotation,
        movementDirection
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerWeapon = useCallback((weapon: WeaponType, subclass?: WeaponSubclass) => {
    if (socket && currentRoomId) {
      socket.emit('weapon-changed', {
        roomId: currentRoomId,
        weapon,
        subclass
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
        ...(meta?.glacialBiteChill ? { glacialBiteChill: true } : {}),
        ...(meta?.glacialTalons ? { glacialTalons: true } : {}),
        ...(meta?.entanglementBarrage ? { entanglementBarrage: true } : {}),
        ...(meta?.tempestBurstArcticChill ? { tempestBurstArcticChill: true } : {}),
        ...(meta?.tempestBurstWyvernZombie ? { tempestBurstWyvernZombie: true } : {}),
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

  const applyStatusEffect = useCallback((enemyId: string, effectType: string, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('apply-status-effect', {
        roomId: currentRoomId,
        enemyId,
        effectType,
        duration
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

  // Weapon selection functions (moved before updatePlayerLevel to avoid forward reference)
  const setSelectedWeapons = useCallback((weapons: { primary: WeaponType; secondary: WeaponType }) => {
    setSelectedWeaponsState(weapons);
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
    socket.emit('coop-zombie-room-boons', {
      roomId: currentRoomId,
      coopZombieBoons: getCoopZombieRoomBoonsPayload(talentLoadout),
    });

    const localPlayerLevel = socket.id ? (players.get(socket.id)?.level ?? 1) : 1;
    const effectiveStats = StatSystem.getEffectiveStatsWithInventory(statPointData.stats, inventory);
    const runeCount = getRuneCountForWeapon(selectedWeapons.primary, localPlayerLevel);
    socket.emit('coop-stagger-room-boons', {
      roomId: currentRoomId,
      coopStaggerRoomBoons: getCoopStaggerRoomBoonsPayload(talentLoadout, {
        agility: effectiveStats.agility,
        strength: effectiveStats.strength,
        stamina: effectiveStats.stamina,
        criticalRuneCount: runeCount,
        critDamageRuneCount: runeCount,
      }),
    });
  }, [socket, currentRoomId, gameMode, talentLoadout, statPointData, inventory, selectedWeapons, players]);

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

  const registerMerchantPurchaseSuccessHandler = useCallback(
    (handler: (payload: MerchantPurchaseSuccessPayload) => void) => {
      merchantPurchaseSuccessHandlersRef.current.add(handler);
      return () => {
        merchantPurchaseSuccessHandlersRef.current.delete(handler);
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
    enemies,
    enemiesRef,
    enemyTransformsRef,
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
    coopBossThroneArena,
    coopThroneBossKind,
    coopTransitionOverlay,
    coopPortalBlinkSeq,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopBossClearedBgmSeq,
    coopClearedRoomColor,
    clearCoopClearedRoomColor,
    lateJoinCombatLoadout,
    clearLateJoinCombatLoadout,
    hideCoopPortalTransition,
    confirmCoopPortalTransitionComplete,
    endCoopPortalTransition,
    currentPreview,
    joinRoom,
    leaveRoom,
    previewRoom,
    clearPreview,
    startGame,
    enterCombatArena,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerEffect,
    broadcastPlayerDamage,
    broadcastPlayerHealing,
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
    applyStatusEffect,
    mushroomState,
    updatePlayerExperience,
    updatePlayerLevel,
    updatePlayerEssence,
    updatePlayerGold,
    updatePlayerShield,
    selectedWeapons,
    setSelectedWeapons,
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
    merchantPurchaseState,
    registerMerchantPurchaseSuccessHandler,
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
  }), [socket, isConnected, connectionError, isInRoom, currentRoomId, players, enemies, killCount, skeletonKillCount, skeletonKillRequired, gameStarted, combatArenaActive, gameMode, campTypes, thronePortalOffer, thronePortalLayout, coopMainArenaPortalPhase, coopTerrainTheme, coopCurrentRoomKind, coopClearedRoomKind, coopColoredRoomVisitIndex, coopBossRoomVisitIndex, coopBossThroneArena, coopThroneBossKind, coopTransitionOverlay, coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq, coopBossClearedBgmSeq, coopClearedRoomColor, clearCoopClearedRoomColor, lateJoinCombatLoadout, clearLateJoinCombatLoadout, hideCoopPortalTransition, confirmCoopPortalTransitionComplete, endCoopPortalTransition, currentPreview, joinRoom, leaveRoom, previewRoom, clearPreview, startGame, enterCombatArena, updatePlayerPosition, updatePlayerWeapon, updatePlayerHealth, broadcastPlayerAttack, broadcastPlayerAbility, broadcastPlayerEffect, broadcastPlayerDamage, broadcastPlayerHealing, broadcastPlayerAnimationState, broadcastPlayerDebuff, broadcastPlayerStealth, broadcastPlayerKnockback, broadcastPlayerTornadoEffect, broadcastPlayerDeathEffect, damageEnemy, subscribeEnemyDamage, damageMushroom, detonateWyvernConcentratedVenom, applyStatusEffect, mushroomState, updatePlayerExperience, updatePlayerLevel, updatePlayerEssence, updatePlayerGold, updatePlayerShield, selectedWeapons, setSelectedWeapons, abilityLoadout, setAbilityLoadout, talentLoadout, setTalentLoadout, skillPointData, unlockAbility, updateSkillPointsForLevel, grantSkillPoints, statPointData, allocateStatPoint, updateStatPointsForLevel, grantStatPoints, purchaseItem, purchaseMerchantItem, purchaseMerchantHeal, merchantPurchaseState, registerMerchantPurchaseSuccessHandler, droppedItems, goldDrops, inventory, merchantInventory, pickupItem, pickupGoldDrop, chatMessages, isChatOpen, sendChatMessage, openChat, closeChat, setPlayers]);

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
}
