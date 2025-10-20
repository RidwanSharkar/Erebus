'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';

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
}

export interface Enemy {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
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
  gameStarted: boolean;
  gameMode: 'multiplayer' | 'coop';

  // Chat state
  chatMessages: ChatMessage[];
  isChatOpen: boolean;

  // Weapon selection state
  selectedWeapons: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;

  // Skill point system state
  skillPointData: SkillPointData;

  // Room preview
  currentPreview: RoomPreview | null;
  
  // Actions
  joinRoom: (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'coop') => Promise<void>;
  leaveRoom: () => void;
  previewRoom: (roomId: string) => void;
  clearPreview: () => void;
  startGame: () => void;
  
  // Player actions
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass) => void;
  updatePlayerHealth: (health: number, maxHealth?: number) => void;
  broadcastPlayerAttack: (attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean }) => void;
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
  damageEnemy: (enemyId: string, damage: number, sourcePlayerId?: string) => void;
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

  // Skill point system actions
  unlockAbility: (unlock: AbilityUnlock) => void;
  updateSkillPointsForLevel: (level: number) => void;

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

export function MultiplayerProvider({ children }: MultiplayerProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
  const [killCount, setKillCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'coop'>('multiplayer');
  const [currentPreview, setCurrentPreview] = useState<RoomPreview | null>(null);
  const [selectedWeapons, setSelectedWeaponsState] = useState<{
    primary: WeaponType;
    secondary: WeaponType;
  } | null>(null);
  const [skillPointData, setSkillPointData] = useState<SkillPointData>(SkillPointSystem.getInitialSkillPointData());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Throttling refs to prevent infinite re-render loops
  const lastPlayerMoveUpdate = useRef<{ [playerId: string]: number }>({});
  const lastPlayerHealthUpdate = useRef<{ [playerId: string]: number }>({});
  const lastEnemyMoveUpdate = useRef<{ [enemyId: string]: number }>({});
  const lastEnemyDamageUpdate = useRef<{ [enemyId: string]: number }>({});

  // Initialize socket connection
  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://empyrea-game-backend.fly.dev'
        : 'http://localhost:8080');

    console.log('🔌 Connecting to multiplayer server:', serverUrl);

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
      setIsConnected(false);
      setSocket(null); // Clear socket reference
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());

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
      setIsInRoom(true);
      setCurrentRoomId(data.roomId);
      setKillCount(data.killCount);
      setGameStarted(data.gameStarted);
      setGameMode(data.gameMode || 'multiplayer'); // Set game mode from server

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
          enemiesMap.set(enemy.id, enemy);
        });
      }
      setEnemies(enemiesMap);
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
        updated.set(data.enemy.id, data.enemy);
        return updated;
      });
    });

    addEventHandler('enemy-damaged', (data) => {

      // Throttle enemy damage updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastEnemyDamageUpdate.current[data.enemyId] || 0;
      if (now - lastUpdate < 50) { // Throttle to 20fps for damage updates
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

          // Handle enemy death
          if (data.wasKilled) {
            enemy.isDying = true;
          }
        }
        // Silently ignore if enemy not found - it may have been removed already (died)
        return updated;
      });
    });

    addEventHandler('enemy-moved', (data) => {
      // Throttle enemy movement updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastEnemyMoveUpdate.current[data.enemyId] || 0;
      if (now - lastUpdate < 33) { // Throttle to ~30fps for enemy movements
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

    addEventHandler('kill-count-updated', (data) => {
      setKillCount(data.killCount);
    });

    addEventHandler('game-started', (data) => {
      setGameStarted(true);
      setKillCount(data.killCount);
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
          const newLevel = Math.floor(newExperience / 100) + 1; // Simple leveling formula

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

    addEventHandler('boss-skeleton-attack', (data) => {
      // This will be handled by the game scene for attack animations
      // The event is forwarded through window for the SummonedBossSkeleton component
    });

    addEventHandler('enemy-removed', (data) => {
      // Immediately remove enemy from local state (for instant cleanup of skeletons)
      setEnemies(prev => {
        const updated = new Map(prev);
        updated.delete(data.enemyId);
        console.log(`🗑️ Removed enemy ${data.enemyId} from local state`);
        return updated;
      });
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());

      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, []); // Only run once on mount

  const joinRoom = useCallback(async (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'coop') => {
    if (!socket || !isConnected) {
      throw new Error('Not connected to server');
    }

    return new Promise<void>((resolve, reject) => {
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
      const handleRoomJoined = (data: any) => {
        clearTimeout(timeout);
        socket.off('room-joined', handleRoomJoined);
        socket.off('room-full', handleRoomFull);
        resolve();
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
      setGameStarted(false);
      setGameMode('multiplayer');
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

  const broadcastPlayerAttack = useCallback((attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean }) => {
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

  const damageEnemy = useCallback((enemyId: string, damage: number, sourcePlayerId?: string) => {
    if (socket && currentRoomId) {
      socket.emit('enemy-damage', {
        roomId: currentRoomId,
        enemyId,
        damage,
        sourcePlayerId: sourcePlayerId || socket.id // Always send the player ID for aggro tracking
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

  const updatePlayerLevel = useCallback((playerId: string, level: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-level-changed', {
        roomId: currentRoomId,
        playerId,
        level
      });

      // Update skill points when leveling up
      updateSkillPointsForLevel(level);
    }
  }, [socket, currentRoomId, gameMode]);

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

  const contextValue: MultiplayerContextType = {
    socket,
    isConnected,
    connectionError,
    isInRoom,
    currentRoomId,
    players,
    enemies,
    killCount,
    gameStarted,
    gameMode,
    currentPreview,
    joinRoom,
    leaveRoom,
    previewRoom,
    clearPreview,
    startGame,
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
    skillPointData,
    unlockAbility,
    updateSkillPointsForLevel,
    purchaseItem,
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
