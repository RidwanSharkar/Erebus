'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout, getDefaultLoadout } from '@/utils/weaponAbilities';
import { TalentLoadout, createDefaultTalentLoadout } from '@/utils/talents';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import { StatSystem, StatPointData, StatKey, PlayerStats } from '@/utils/StatSystem';
import { Vector3 } from '@/utils/three-exports';

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
  movementDirection?: { x: number; y: number; z: number };
  // Co-op Experience system
  experience?: number;
  level?: number;
  // Essence currency system
  essence?: number;
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
  /** Staggering Strike (`wraith_strike`), Runeblade combo (`runeblade_combo`), Sabres (`sabre_left` / `sabre_right`), Staggering Smite (`smite` with `staggerToAdd`), or Stagger Shot (`projectile` with `staggerToAdd`): server accumulates stagger. */
  staggerToAdd?: number;
  /** Wyvern Bite — Barrage hit applies Concentrated Venom stack on server. */
  wyvernBiteVenom?: boolean;
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
  soulType?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
  campType?: string;
  campIndex?: number;
  /** INFESTED STRIKE ally zombie */
  ownerPlayerId?: string;
  expireAt?: number;
  /** Staggering Strike buildup (0–100), server-authoritative. */
  staggerBuildup?: number;
}

export interface DroppedItem {
  id: string;
  type: string;
  stat?: StatKey;
  label: string;
  category?: 'amulet' | 'boss_drop';
  position: { x: number; y: number; z: number };
  droppedAt: number;
}

export interface InventoryItem {
  id: string;
  type: string;
  stat?: StatKey;
  label: string;
  category?: 'amulet' | 'boss_drop';
  pickedUpAt: number;
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
  killCount: number;
  skeletonKillCount: number;
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
  /** Co-op: main combat map — two portals (wave 2) or boss gate between waves. Null otherwise. */
  coopMainArenaPortalPhase: 'pick_wave2' | 'pick_boss' | null;
  /**
   * Full-screen loading overlay for portal transitions (throne → arena, wave picks, boss).
   * Set true on `combat-arena-entered`; clear via `endCoopPortalTransition` after the scene settles.
   */
  coopTransitionOverlay: boolean;
  /** Increments on each `combat-arena-entered` so the game scene can schedule overlay teardown. */
  coopCombatArenaEnterSeq: number;
  /** Increments on each `coop-main-arena-intermission` (wave clear; choice portals; server does not move players). */
  coopMainArenaIntermissionSeq: number;
  /**
   * Co-op: camp color of the wave just cleared (first wave, etc.); from `coop-main-arena-intermission`.
   * Cleared on `combat-arena-entered` so the next transition does not reuse a stale value.
   */
  coopClearedRoomColor: string | null;
  clearCoopClearedRoomColor: () => void;
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
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass) => void;
  updatePlayerHealth: (health: number, maxHealth?: number) => void;
  broadcastPlayerAttack: (attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean; storedCharge?: boolean }) => void;
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
  applyStatusEffect: (enemyId: string, effectType: string, duration: number) => void;

  // Experience system actions
  updatePlayerExperience: (playerId: string, experience: number) => void;
  updatePlayerLevel: (playerId: string, level: number) => void;

  // Essence currency system actions
  updatePlayerEssence: (playerId: string, essence: number) => void;

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

  // Stat point system actions
  allocateStatPoint: (stat: StatKey) => void;
  updateStatPointsForLevel: (level: number) => void;

  // Item drop & inventory
  droppedItems: Map<string, DroppedItem>;
  inventory: InventoryItem[];
  pickupItem: (itemId: string) => void;

  // Merchant purchase actions
  purchaseItem: (itemId: string, cost: number, currency: 'essence') => boolean;

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

function normalizeThronePortalLayout(v: unknown): 'rim' | 'center' {
  return v === 'center' ? 'center' : 'rim';
}

function normalizeCoopMainArenaPhase(v: unknown): 'pick_wave2' | 'pick_boss' | null {
  if (v === 'pick_wave2' || v === 'pick_boss') return v;
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
  const [killCount, setKillCount] = useState(0);
  const [skeletonKillCount, setSkeletonKillCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [combatArenaActive, setCombatArenaActive] = useState(true);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'coop'>('multiplayer');
  const [campTypes, setCampTypes] = useState<string[]>([]);
  const [thronePortalOffer, setThronePortalOffer] = useState<string[]>([]);
  const [thronePortalLayout, setThronePortalLayout] = useState<'rim' | 'center'>('rim');
  const [coopMainArenaPortalPhase, setCoopMainArenaPortalPhase] = useState<'pick_wave2' | 'pick_boss' | null>(null);
  const [coopTransitionOverlay, setCoopTransitionOverlay] = useState(false);
  const [coopCombatArenaEnterSeq, setCoopCombatArenaEnterSeq] = useState(0);
  const [coopMainArenaIntermissionSeq, setCoopMainArenaIntermissionSeq] = useState(0);
  const [coopClearedRoomColor, setCoopClearedRoomColor] = useState<string | null>(null);
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  /** Deferred `io()` so React Strict Mode’s mount→unmount→mount does not disconnect a half-open socket. */
  const socketConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSocketRef = useRef<Socket | null>(null);

  // Throttling refs to prevent infinite re-render loops
  const lastPlayerMoveUpdate = useRef<{ [playerId: string]: number }>({});
  const lastPlayerHealthUpdate = useRef<{ [playerId: string]: number }>({});
  const lastEnemyMoveUpdate = useRef<{ [enemyId: string]: number }>({});
  const lastEnemyDamageUpdate = useRef<{ [enemyId: string]: number }>({});
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
      setCampTypes([]);
      setSkeletonKillCount(0);
      setDroppedItems(new Map());
      setInventory([]);

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
    });

    addEventHandler('camps-initialized', (data: { campTypes?: string[] }) => {
      const next = campArchetypeFromRoomPayload({ campTypes: data.campTypes });
      if (next.length > 0) setCampTypes(next);
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

    addEventHandler('reaper-crossentropy-stack', (data: { stacks: number }) => {
      (window as any).controlSystemRef?.current?.setReaperCrossentropyStack(data.stacks ?? 0);
    });

    addEventHandler('enemy-damaged', (data) => {
      if (
        (data.damageType === 'ignite' || data.damageType === 'venom') &&
        typeof data.damage === 'number' &&
        data.damage > 0 &&
        data.position
      ) {
        const mgr = (window as any).damageNumberManager;
        if (mgr?.addDamageNumber) {
          const pos = new Vector3(data.position.x, data.position.y + 1.5, data.position.z);
          mgr.addDamageNumber(data.damage, false, pos, data.damageType === 'venom' ? 'venom' : 'ignite');
        }
      }

      // Throttle enemy damage updates to prevent infinite re-renders (throne training dummy: always apply so HP bar stays accurate under rapid fire)
      const now = Date.now();
      const lastUpdate = lastEnemyDamageUpdate.current[data.enemyId] || 0;
      const isThroneDummy = String(data.enemyId || '').startsWith('throne-training-dummy');
      if (!isThroneDummy && now - lastUpdate < 50) {
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

          // Handle enemy death (throne training dummy resets HP on server — never mark dying)
          if (data.wasKilled && enemy.type !== 'training-dummy') {
            enemy.isDying = true;
            // Play death sound at the enemy's position
            (window as any).audioSystem?.playEnemyDeathSound(enemy.position, enemy.type);
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

    addEventHandler('enemy-moved', (data) => {
      // Throttle enemy movement updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastEnemyMoveUpdate.current[data.enemyId] || 0;
      if (now - lastUpdate < 16) { // Throttle to ~60fps for enemy movements
        return;
      }
      lastEnemyMoveUpdate.current[data.enemyId] = now;

      setEnemies(prev => {
        const updated = new Map(prev);
        const enemy = updated.get(data.enemyId);
        if (enemy) {
          updated.set(data.enemyId, {
            ...enemy,
            position: data.position,
            rotation: data.rotation
          });
        }
        return updated;
      });
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

    addEventHandler('skeleton-kill-count-updated', (data) => {
      setSkeletonKillCount(data.skeletonKillCount);
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
        // Only amulets grant a stat bonus; boss drops have their own effects
        if (data.item.stat) {
          setStatPointData(prev => StatSystem.grantItemStat(prev, data.item.stat!));
        }
        setInventory(prev => [
          ...prev,
          {
            id: data.itemId,
            type: data.item.type,
            stat: data.item.stat,
            label: data.item.label,
            category: data.item.category,
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
      setCoopClearedRoomColor(null);
      setThronePortalOffer([]);
      setThronePortalLayout('rim');
      setCoopMainArenaPortalPhase(null);
      setCoopTransitionOverlay(true);
      setCoopCombatArenaEnterSeq((s) => s + 1);
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
          const purchasedItems = player.purchasedItems || [];
          purchasedItems.push(data.itemId);
          updated.set(data.playerId, {
            ...player,
            purchasedItems,
            essence: (player.essence || 0) - data.cost
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
        return [...prev, newMessage];
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
      setCampTypes([]);

      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [cancelPendingEnemyRemovals]); // `cancel` stable; handlers need fresh ref to cancel batching

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
    setKillCount(0);
    setSkeletonKillCount(0);
    setGameStarted(false);
    setCombatArenaActive(true);
    setGameMode('multiplayer');
    setCampTypes([]);
    setThronePortalOffer([]);
    setThronePortalLayout('rim');
    setCoopMainArenaPortalPhase(null);
    setCoopTransitionOverlay(false);
    setCoopCombatArenaEnterSeq(0);
    setCoopMainArenaIntermissionSeq(0);
    setDroppedItems(new Map());
    setInventory([]);
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

  const enterCombatArena = useCallback((chosenCampType?: string) => {
    if (socket && currentRoomId) {
      socket.emit('enter-combat-arena', { roomId: currentRoomId, chosenCampType });
    }
  }, [socket, currentRoomId]);

  const endCoopPortalTransition = useCallback(() => {
    setCoopTransitionOverlay(false);
  }, []);

  const clearCoopClearedRoomColor = useCallback(() => {
    setCoopClearedRoomColor(null);
  }, []);

  const updatePlayerPosition = useCallback((position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => {
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

  const broadcastPlayerAttack = useCallback((attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean; storedCharge?: boolean }) => {
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
        ...(meta?.staggerToAdd != null && meta.staggerToAdd > 0 ? { staggerToAdd: meta.staggerToAdd } : {}),
        ...(meta?.wyvernBiteVenom ? { wyvernBiteVenom: true } : {}),
      });
    }
  }, [socket, currentRoomId]);

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


  const broadcastPlayerDamage = useCallback((targetPlayerId: string, damage: number, damageType?: string, isCritical?: boolean) => {
    if (socket && currentRoomId) {

      socket.emit('player-damage', {
        roomId: currentRoomId,
        targetPlayerId,
        damage,
        damageType,
        isCritical
      });
    }
  }, [socket, currentRoomId]);

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
      setTalentLoadoutState(loadout);
    },
    [],
  );

  const updatePlayerLevel = useCallback((playerId: string, level: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-level-changed', {
        roomId: currentRoomId,
        playerId,
        level
      });

      // Update skill points and stat points when leveling up
      updateSkillPointsForLevel(level);
      updateStatPointsForLevel(level);
    }
  }, [socket, currentRoomId, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Skill point system functions
  const unlockAbility = useCallback((unlock: AbilityUnlock) => {
    try {
      const newSkillPointData = SkillPointSystem.unlockAbility(skillPointData, unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
      setSkillPointData(newSkillPointData);
    } catch (error) {
      // console.error('Failed to unlock ability:', error);
    }
  }, [skillPointData]);

  const updateSkillPointsForLevel = useCallback((level: number) => {
    const newSkillPointData = SkillPointSystem.updateSkillPointsForLevel(skillPointData, level);
    setSkillPointData(newSkillPointData);
  }, [skillPointData]);

  const allocateStatPoint = useCallback((stat: StatKey) => {
    try {
      const newStatPointData = StatSystem.allocateStat(statPointData, stat);
      setStatPointData(newStatPointData);
    } catch {
      // No points available
    }
  }, [statPointData]);

  const updateStatPointsForLevel = useCallback((level: number) => {
    const newStatPointData = StatSystem.updateStatPointsForLevel(statPointData, level);
    setStatPointData(newStatPointData);
  }, [statPointData]);

  const purchaseItem = useCallback((itemId: string, cost: number, currency: 'essence'): boolean => {
    // Try to find local player by socket ID first, then by looking for any player (for single-player mode)
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

    // Check if player has enough essence
    const currentEssence = localPlayer.essence || 0;
    if (currentEssence < cost) {
      return false;
    }

    // Deduct essence and add item to purchased items
    const updatedPlayer = {
      ...localPlayer,
      essence: currentEssence - cost,
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
  }, [players, socket, currentRoomId]);

  // Chat functions
  const sendChatMessage = useCallback((message: string) => {
    if (!socket || !currentRoomId || !socket.id) return;

    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: socket.id,
      playerName: players.get(socket.id)?.name || 'Unknown',
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
  }, [socket, currentRoomId, players]);

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

  const contextValue: MultiplayerContextType = {
    socket,
    isConnected,
    connectionError,
    isInRoom,
    currentRoomId,
    players,
    enemies,
    killCount,
    skeletonKillCount,
    gameStarted,
    combatArenaActive,
    gameMode,
    campTypes,
    thronePortalOffer,
    thronePortalLayout,
    coopMainArenaPortalPhase,
    coopTransitionOverlay,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopClearedRoomColor,
    clearCoopClearedRoomColor,
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
    applyStatusEffect,
    updatePlayerExperience,
    updatePlayerLevel,
    updatePlayerEssence,
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
    statPointData,
    allocateStatPoint,
    updateStatPointsForLevel,
    purchaseItem,
    droppedItems,
    inventory,
    pickupItem,
    chatMessages,
    isChatOpen,
    sendChatMessage,
    openChat,
    closeChat,
    setPlayers
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
}
