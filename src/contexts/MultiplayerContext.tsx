'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';

interface Player {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weapon: WeaponType;
  subclass?: WeaponSubclass;
  health: number;
  maxHealth: number;
  movementDirection?: { x: number; y: number; z: number };
  // PVP Debuff states
  isFrozen?: boolean;
  frozenUntil?: number;
  isSlowed?: boolean;
  slowedUntil?: number;
  movementSpeedMultiplier?: number;
}

interface Enemy {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

interface Tower {
  id: string;
  ownerId: string;
  towerIndex: number;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isDead?: boolean;
}

interface RoomPreview {
  roomId: string;
  exists: boolean;
  players: Player[];
  playerCount: number;
  maxPlayers: number;
  enemies: Enemy[];
  towers: Tower[];
}

// Animation state type for better type safety
type PlayerAnimationState = {
  isCharging?: boolean; 
  chargeProgress?: number; 
  isSwinging?: boolean; 
  swordComboStep?: 1 | 2 | 3; 
  isDivineStorming?: boolean; 
  isSpinning?: boolean; 
  isDeflecting?: boolean; 
  isSwordCharging?: boolean; 
  isViperStingCharging?: boolean; 
  viperStingChargeProgress?: number; 
  isBarrageCharging?: boolean; 
  barrageChargeProgress?: number; 
  isBackstabbing?: boolean;
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
  towers: Map<string, Tower>;
  killCount: number;
  gameStarted: boolean;
  gameMode: 'multiplayer' | 'pvp';
  
  // Room preview
  currentPreview: RoomPreview | null;
  
  // Actions
  joinRoom: (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'pvp') => Promise<void>;
  leaveRoom: () => void;
  previewRoom: (roomId: string) => void;
  clearPreview: () => void;
  startGame: () => void;
  
  // Player actions
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass) => void;
  updatePlayerHealth: (health: number, maxHealth?: number) => void;
  broadcastPlayerAttack: (attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean }) => void;
  broadcastPlayerAbility: (abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string) => void;
  broadcastPlayerEffect: (effect: any) => void;
  broadcastPlayerDamage: (targetPlayerId: string, damage: number, damageType?: string) => void;
  broadcastPlayerAnimationState: (animationState: PlayerAnimationState) => void;
  broadcastPlayerDebuff: (targetPlayerId: string, debuffType: 'frozen' | 'slowed', duration: number, effectData?: any) => void;
  
  // Enemy actions
  damageEnemy: (enemyId: string, damage: number) => void;
  applyStatusEffect: (enemyId: string, effectType: string, duration: number) => void;
  
  // Tower actions
  damageTower: (towerId: string, damage: number) => void;
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
  const [towers, setTowers] = useState<Map<string, Tower>>(new Map());
  const [killCount, setKillCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'pvp'>('multiplayer');
  const [currentPreview, setCurrentPreview] = useState<RoomPreview | null>(null);
  
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://avernus-backend.fly.dev' 
        : 'http://localhost:8080');
    
    console.log('🔌 Connecting to multiplayer server:', serverUrl);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to multiplayer server');
      setIsConnected(true);
      setConnectionError(null);
      
      // Start heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      heartbeatInterval.current = setInterval(() => {
        newSocket.emit('heartbeat');
      }, 30000); // Send heartbeat every 30 seconds
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setIsConnected(false);
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      setTowers(new Map());
      
      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔥 Connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Room event handlers
    newSocket.on('room-joined', (data) => {
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
      if (data.gameMode !== 'pvp') {
        const enemiesMap = new Map();
        data.enemies.forEach((enemy: Enemy) => {
          enemiesMap.set(enemy.id, enemy);
        });
        setEnemies(enemiesMap);
        setTowers(new Map()); // Clear towers for multiplayer mode
      } else {
        setEnemies(new Map()); // Clear enemies for PVP mode
        // Update towers (only for PVP mode)
        const towersMap = new Map();
        if (data.towers) {
          data.towers.forEach((tower: Tower) => {
            towersMap.set(tower.id, tower);
          });
        }
        setTowers(towersMap);
      }
    });

    newSocket.on('room-full', () => {
      setConnectionError('Room is full (max 5 players)');
    });

    newSocket.on('player-joined', (data) => {
      console.log('👤 Player joined:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
    });

    newSocket.on('player-left', (data) => {
      console.log('👋 Player left:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
    });

    newSocket.on('player-moved', (data) => {
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

    newSocket.on('player-weapon-changed', (data) => {
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

    newSocket.on('player-health-updated', (data) => {
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

    // Enemy event handlers (only for multiplayer mode)
    newSocket.on('enemy-spawned', (data) => {
      console.log('👹 Enemy spawned:', data.enemy);
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          console.log('🚫 Ignoring enemy spawn in PVP mode');
          return currentMode;
        }
        setEnemies(prev => {
          const updated = new Map(prev);
          updated.set(data.enemy.id, data.enemy);
          return updated;
        });
        return currentMode;
      });
    });

    newSocket.on('enemy-damaged', (data) => {
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          return currentMode;
        }
        setEnemies(prev => {
          const updated = new Map(prev);
          const enemy = updated.get(data.enemyId);
          if (enemy) {
            updated.set(data.enemyId, {
              ...enemy,
              health: data.newHealth,
              isDying: data.wasKilled
            });
          }
          return updated;
        });
        return currentMode;
      });
    });

    newSocket.on('enemy-moved', (data) => {
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          return currentMode;
        }
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
        return currentMode;
      });
    });

    newSocket.on('kill-count-updated', (data) => {
      console.log('💀 Kill count updated:', data);
      setKillCount(data.killCount);
    });

    newSocket.on('game-started', (data) => {
      console.log('🎮 Game started:', data);
      setGameStarted(true);
      setKillCount(data.killCount);
    });

    newSocket.on('room-preview', (data) => {
      console.log('👀 Room preview:', data);
      setCurrentPreview(data);
    });

    // Player action event handlers
    newSocket.on('player-attack', (data) => {
      console.log('⚔️ Player attack received:', data);
      // This will be handled by the game scene to trigger animations
    });

    newSocket.on('player-ability', (data) => {
      console.log('✨ Player ability received:', data);
      // This will be handled by the game scene to trigger ability effects
    });

    newSocket.on('player-effect', (data) => {
      console.log('💫 Player effect received:', data);
      // This will be handled by the game scene to show visual effects
    });

    newSocket.on('player-animation-state', (data) => {
      console.log('🎭 Player animation state received:', data);
      // This will be handled by the game scene to update animation states
    });

    // Tower event handlers
    newSocket.on('tower-spawned', (data) => {
      console.log('🏰 Tower spawned:', data.tower);
      setTowers(prev => {
        const updated = new Map(prev);
        updated.set(data.tower.id, data.tower);
        return updated;
      });
    });

    newSocket.on('tower-damaged', (data) => {
      setTowers(prev => {
        const updated = new Map(prev);
        const tower = updated.get(data.towerId);
        if (tower) {
          updated.set(data.towerId, {
            ...tower,
            health: data.newHealth,
            isDead: data.wasDestroyed
          });
        }
        return updated;
      });
    });

    newSocket.on('tower-destroyed', (data) => {
      console.log('💥 Tower destroyed:', data.towerId);
      setTowers(prev => {
        const updated = new Map(prev);
        const tower = updated.get(data.towerId);
        if (tower) {
          updated.set(data.towerId, {
            ...tower,
            health: 0,
            isDead: true
          });
        }
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      newSocket.close();
    };
  }, []);

  // Actions
  const joinRoom = useCallback(async (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode: 'multiplayer' | 'pvp' = 'multiplayer') => {
    if (!socket || !isConnected) {
      throw new Error('Not connected to server');
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 10000);

      socket.once('room-joined', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.once('room-full', () => {
        clearTimeout(timeout);
        reject(new Error('Room is full'));
      });

      socket.emit('join-room', {
        roomId,
        playerName,
        weapon,
        subclass,
        gameMode
      });
    });
  }, [socket, isConnected]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave-room');
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      setTowers(new Map());
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

  const broadcastPlayerAbility = useCallback((abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string) => {
    if (socket && currentRoomId) {
      socket.emit('player-ability', {
        roomId: currentRoomId,
        abilityType,
        position,
        direction,
        target
      });
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

  const damageEnemy = useCallback((enemyId: string, damage: number) => {
    if (socket && currentRoomId) {
      socket.emit('enemy-damage', {
        roomId: currentRoomId,
        enemyId,
        damage
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

  const damageTower = useCallback((towerId: string, damage: number) => {
    if (socket && currentRoomId) {
      socket.emit('tower-damage', {
        roomId: currentRoomId,
        towerId,
        damage
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDamage = useCallback((targetPlayerId: string, damage: number, damageType?: string) => {
    if (socket && currentRoomId) {
      socket.emit('player-damage', {
        roomId: currentRoomId,
        targetPlayerId,
        damage,
        damageType
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAnimationState = useCallback((animationState: PlayerAnimationState) => {
    if (socket && currentRoomId) {
      console.log('🌐 DEBUG: Broadcasting animation state to server:', animationState);
      socket.emit('player-animation-state', {
        roomId: currentRoomId,
        animationState
      });
    } else {
      console.warn('⚠️ DEBUG: Cannot broadcast animation state - socket or roomId missing:', { socket: !!socket, currentRoomId });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDebuff = useCallback((targetPlayerId: string, debuffType: 'frozen' | 'slowed', duration: number, effectData?: any) => {
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

  const contextValue: MultiplayerContextType = {
    socket,
    isConnected,
    connectionError,
    isInRoom,
    currentRoomId,
    players,
    enemies,
    towers,
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
    broadcastPlayerAnimationState,
    broadcastPlayerDebuff,
    damageEnemy,
    applyStatusEffect,
    damageTower
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
}
