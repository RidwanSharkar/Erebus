'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler, Group, AdditiveBlending } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';
import BossRenderer from './enemies/BossRenderer';
import SummonedBossSkeleton from './enemies/SummonedBossSkeleton';
import Meteor from './enemies/Meteor';
import { useMultiplayer, Player } from '@/contexts/MultiplayerContext';
import { SkillPointData } from '@/utils/SkillPointSystem';

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';

import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem } from '@/systems/ControlSystem';
import { AudioSystem } from '@/systems/AudioSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { InterpolationSystem } from '@/systems/InterpolationSystem';
import { MerchantSystem } from '@/systems/MerchantSystem';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';

import ColossusStrike from '@/components/weapons/ColossusStrike';

import WindShearProjectileManager, { triggerWindShearProjectile } from '@/components/projectiles/WindShearProjectile';

import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import StunManager from '@/components/weapons/StunManager';

import CobraShotManager from '@/components/projectiles/CobraShotManager';

import CloudkillManager, { triggerGlobalCloudkill, triggerGlobalCloudkillWithTargets } from '@/components/projectiles/CloudkillManager';
import {
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import EnhancedGround from '@/components/environment/EnhancedGround';


import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount, setControlSystem } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import PVPSummonTotemManager from '@/components/projectiles/PVPSummonTotemManager';
import { ExperienceSystem } from '@/utils/ExperienceSystem';

// Function to calculate rune count based on weapon type and player level
// Bow, Sword, and Sabres gain 1 critical chance and 1 critical damage rune per level
// Level 1: 0 runes, Level 2: 1 rune, Level 3: 2 runes, Level 4: 3 runes, Level 5: 4 runes
function getRuneCountForWeapon(weaponType: WeaponType, level: number): number {
  if (weaponType === WeaponType.BOW || weaponType === WeaponType.SWORD || weaponType === WeaponType.SABRES) {
    return Math.max(0, level - 1); // Level 1 = 0, Level 5 = 4
  }
  return 0; // Scythe and Runeblade don't get runes from leveling
}


interface CoopGameSceneProps {
  onDamageNumbersUpdate?: (damageNumbers: DamageNumberData[]) => void;
  onDamageNumberComplete?: (id: string) => void;
  onCameraUpdate?: (camera: Camera, size: { width: number; height: number }) => void;
  onGameStateUpdate?: (gameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
  }) => void;
  onControlSystemUpdate?: (controlSystem: any) => void;
  onExperienceUpdate?: (experience: number, level: number) => void;
  onEssenceUpdate?: (essence: number) => void;
  onMerchantUIUpdate?: (isVisible: boolean) => void;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;
  skillPointData?: SkillPointData;
}

// Taunt Effect Indicator Component
function TauntEffectIndicator({ position }: { position: Vector3 }) {
  const meshRef = useRef<any>(null);
  const ringRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotate the skull indicator
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
      // Pulse the size
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
    if (ringRef.current) {
      // Rotate the ring
      ringRef.current.rotation.z = state.clock.elapsedTime * 3;
      // Pulse opacity
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Taunt indicator - rotating skull-like sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.9} />
      </mesh>

      {/* Pulsing ring effect */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 16]} />
        <meshBasicMaterial
          color="#ff0000"
          transparent
          opacity={0.5}
          side={2}
        />
      </mesh>

      {/* Warning indicator lines */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.3, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-0.3, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function CoopGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate, onExperienceUpdate, onEssenceUpdate, onMerchantUIUpdate, selectedWeapons, skillPointData }: CoopGameSceneProps = {}) {
  const { camera, gl, scene } = useThree();
  const {
    players,
    setPlayers,
    enemies,
    gameStarted,
    isInRoom,
    currentRoomId,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    updatePlayerShield,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    broadcastPlayerEffect, // For broadcasting venom effects
    broadcastPlayerDamage, // For broadcasting player damage
    broadcastPlayerHealing, // For broadcasting player healing
    broadcastPlayerDebuff, // For broadcasting debuff effects
    broadcastPlayerStealth, // For broadcasting stealth state
    broadcastPlayerTornadoEffect, // For broadcasting tornado effects
    broadcastPlayerDeathEffect, // For broadcasting death effects
    broadcastPlayerKnockback, // For broadcasting knockback effects
    damageEnemy, // New function for enemy damage with source player tracking
    applyStatusEffect, // For applying status effects to enemies (freeze, slow, corrupted)
    socket,
    updatePlayerEssence,
    isChatOpen,
    openChat,
    closeChat,
  } = useMultiplayer();

  // Debug multiplayer state
  useEffect(() => {
    console.log('🔗 CoopGameScene multiplayer state:', {
      gameStarted,
      isInRoom,
      currentRoomId,
      socketConnected: socket?.connected,
      enemyCount: enemies.size,
      enemies: Array.from(enemies.values()).map(e => ({ id: e.id, type: e.type, health: e.health, maxHealth: e.maxHealth })),
      socketId: socket?.id,
      playersCount: players.size
    });
  }, [gameStarted, isInRoom, currentRoomId, socket?.connected, socket?.id, players.size, enemies.size]);


  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const cameraSystemRef = useRef<CameraSystem | null>(null);
  // summonedUnitSystemRef removed - using server-authoritative summoned units
  const reanimateRef = useRef<ReanimateRef>(null);
  const damagePlayerCallbackRef = useRef<((playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void) | null>(null);
  const isInitialized = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const lastMeleeSoundTime = useRef(new Map<string, number>());
  const realTimePlayerPositionRef = useRef<Vector3>(new Vector3(0, 0.5, 0));
  // Real-time position refs for enemy players to enable ghost trail updates
  const enemyPlayerPositionRefs = useRef<Map<string, { current: Vector3 }>>(new Map());
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);
  const [engineReady, setEngineReady] = useState(false); // Track when engine is ready

  // PVP Kill Counter - tracks kills for all players
  const [playerKills, setPlayerKills] = useState<Map<string, number>>(new Map());


  // Merchant system state
  const [isMerchantNearby, setIsMerchantNearby] = useState(false);
  const [isMerchantVisible, setIsMerchantVisible] = useState(false);
  const [merchantRotation, setMerchantRotation] = useState<[number, number, number]>([0, 0, 0]);
  const merchantSystemRef = useRef<MerchantSystem | null>(null);
  const isMerchantNearbyRef = useRef(false);
  const isMerchantVisibleRef = useRef(false);

  // Merchant interaction handler
  const handleMerchantInteraction = useCallback(() => {
    if (isMerchantNearby) {
      if (merchantSystemRef.current) {
        merchantSystemRef.current.interact();
      }
      onMerchantUIUpdate?.(true); // Show merchant UI
      // Play interaction sound or effect here if needed
    }
  }, [isMerchantNearby, onMerchantUIUpdate]);

  // Keyboard event handler for merchant interaction and chat
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Handle Enter key for chat (only when not in input fields)
      if (event.key === 'Enter' && !isChatOpen && event.target === document.body) {
        event.preventDefault();
        openChat();
      }

      // Handle merchant interaction
      if (event.key.toLowerCase() === 'e' && isMerchantNearby) {
        handleMerchantInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMerchantNearby, handleMerchantInteraction, isChatOpen, openChat]);

  // Disable control system input and allow all keyboard input when chat is open
  useEffect(() => {
    if (controlSystemRef.current) {
      controlSystemRef.current.setInputDisabled(isChatOpen);
      controlSystemRef.current.setAllowAllInput(isChatOpen);
    }
  }, [isChatOpen]);

  // Function to increment kill count for a player
  const incrementKillCount = useCallback((playerId: string) => {
    setPlayerKills(prev => {
      const newKills = new Map(prev);
      const currentKills = newKills.get(playerId) || 0;
      newKills.set(playerId, currentKills + 1);
      return newKills;
    });
  }, []);

  // Clean up expired venom effects on players
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPlayers((prev: Map<string, Player>) => {
        const newPlayers = new Map(prev);
        let hasChanges = false;
        
        newPlayers.forEach((player: Player, playerId: string) => {
          if (player.isVenomed && player.venomedUntil && now > player.venomedUntil) {
            newPlayers.set(playerId, {
              ...player,
              isVenomed: false,
              venomedUntil: undefined
            });
            hasChanges = true;
          }
        });
        
        return hasChanges ? newPlayers : prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(cleanupInterval);
  }, []); // Remove setPlayers dependency to prevent infinite re-renders

  // Update enemy player position refs for ghost trail functionality
  useEffect(() => {
    players.forEach((player, playerId) => {
      // Skip local player - they have their own realTimePlayerPositionRef
      if (playerId === socket?.id) return;

      // Get or create position ref for this enemy player
      let positionRef = enemyPlayerPositionRefs.current.get(playerId);
      if (!positionRef) {
        positionRef = { current: new Vector3(player.position.x, player.position.y, player.position.z) };
        enemyPlayerPositionRefs.current.set(playerId, positionRef);
      } else if (positionRef.current) {
        // Update existing ref with new position
        positionRef.current.set(player.position.x, player.position.y, player.position.z);
      }
    });

    // Clean up refs for players that no longer exist
    const currentPlayerIds = Array.from(players.keys());
    const refPlayerIds = Array.from(enemyPlayerPositionRefs.current.keys());
    refPlayerIds.forEach(playerId => {
      if (!currentPlayerIds.includes(playerId)) {
        enemyPlayerPositionRefs.current.delete(playerId);
      }
    });
  }, [players, socket?.id]);


  // Damage number management for Smite effects - initialize with dummy functions
  const [smiteDamageNumbers, setSmiteDamageNumbers] = useState<{
    setDamageNumbers: (callback: (prev: Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSmite?: boolean;
    }>) => Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSmite?: boolean;
    }>) => void;
    nextDamageNumberId: { current: number };
  }>({
    setDamageNumbers: (callback) => {
      return [];
    },
    nextDamageNumberId: { current: 0 }
  });

  // Callback to receive damage number functions from DragonRenderer
  const handleDamageNumbersReady = useCallback((setDamageNumbers: any, nextDamageNumberId: any) => {
    setSmiteDamageNumbers({ setDamageNumbers, nextDamageNumberId });
  }, []);

  // Create a ref for the Viper Sting manager that includes position and rotation
  const viperStingParentRef = useRef({
    position: new Vector3(0, 0.5, 0),
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  });

  // Ref for ViperStingManager damage number ID (moved to top level to avoid hook rule violations)
  const viperStingDamageNumberIdRef = useRef(0);
  
  // Track server player to local ECS entity mapping for PVP damage
  const serverPlayerEntities = useRef<Map<string, number>>(new Map());
  
  // Track server enemy to local ECS entity mapping for co-op damage
  const serverEnemyEntities = useRef<Map<string, number>>(new Map());

  // Track stealth states for players
  const playerStealthStates = useRef<Map<string, boolean>>(new Map());

  // Track active Sabre Reaper Mist effects
  const [activeMistEffects, setActiveMistEffects] = useState<Array<{
    id: string;
    position: Vector3;
    startTime: number;
  }>>([]);

  // Track player deaths and respawn timers for PVP
  const [playerDeathStates, setPlayerDeathStates] = useState<Map<string, {
    isDead: boolean;
    deathTime: number;
    killerId?: string;
    deathPosition: Vector3;
  }>>(new Map());

  // Track death effects for players
  const [deathEffects, setDeathEffects] = useState<Map<string, {
    playerId: string;
    position: Vector3;
    startTime: number;
    isActive: boolean;
  }>>(new Map());




  // Experience system state
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [lastExperienceAwardTime, setLastExperienceAwardTime] = useState(0);

// Mana scaling based on player level
const getMaxManaForWeapon = (weaponType: WeaponType, level: number): number => {
  if (weaponType === WeaponType.RUNEBLADE) {
    // Runeblade scaling: Level 1: 150, Level 2: 175, Level 3: 200, Level 4: 225, Level 5: 250
    const runebladeMana = [0, 150, 175, 200, 225, 250];
    return runebladeMana[level] || 150;
  } else if (weaponType === WeaponType.SCYTHE) {
    // Scythe scaling: Level 1: 250, Level 2: 275, Level 3: 300, Level 4: 325, Level 5: 350
    return 250 + (level - 1) * 25;
  }
  return 200; // Default for other weapons
};

// Mana system state for weapons (persistent across weapon switches)
const [weaponManaResources, setWeaponManaResources] = useState<{
  [key in WeaponType]: number;
}>({
  [WeaponType.SCYTHE]: getMaxManaForWeapon(WeaponType.SCYTHE, 1), // Start with level 1 capacity
  [WeaponType.SWORD]: 0,
  [WeaponType.BOW]: 0,
  [WeaponType.SABRES]: 0,
  [WeaponType.RUNEBLADE]: getMaxManaForWeapon(WeaponType.RUNEBLADE, 1) // Start with level 1 capacity
});
const [maxMana, setMaxMana] = useState(150);

  // Track current weapon for mana management
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.BOW);
  const currentMana = weaponManaResources[currentWeapon];

  // PVP Reanimate Effect Management
  const [pvpReanimateEffects, setPvpReanimateEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextReanimateEffectId = useRef(0);

  // PVP Smite Effect Management
  const [pvpSmiteEffects, setPvpSmiteEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
    onDamageDealt?: (totalDamage: number) => void;
  }>>([]);
  const nextSmiteEffectId = useRef(0);

  // PVP Colossus Strike Effect Management
  const [pvpColossusStrikeEffects, setPvpColossusStrikeEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    damage: number;
    startTime: number;
    duration: number;
    onDamageDealt?: (damageDealt: boolean) => void;
  }>>([]);
  const nextColossusStrikeEffectId = useRef(0);

  // PVP Wind Shear Effect Management
  const [pvpWindShearEffects, setPvpWindShearEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    direction: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextWindShearEffectId = useRef(0);

  // PVP WindShear Tornado Effect Management
  const [pvpWindShearTornadoEffects, setPvpWindShearTornadoEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextWindShearTornadoEffectId = useRef(0);

  // PVP DeathGrasp Effect Management
  const [pvpDeathGraspEffects, setPvpDeathGraspEffects] = useState<Array<{
    id: number;
    playerId: string;
    startPosition: Vector3;
    direction: Vector3;
    startTime: number;
    duration: number;
    pullTriggered: boolean;
  }>>([]);
  const nextDeathGraspEffectId = useRef(0);


  // PVP Summon Totem Effect Management
  const [pvpSummonTotemEffects, setPvpSummonTotemEffects] = useState<Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>>([]);

  // PVP Venom Effect Management
  const [pvpVenomEffects, setPvpVenomEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextVenomEffectId = useRef(0);

  // PVP Debuff Management
  const [pvpDebuffEffects, setPvpDebuffEffects] = useState<Array<{
    id: number;
    playerId: string;
    debuffType: 'frozen' | 'slowed' | 'stunned' | 'burning';
    position: Vector3;
    startTime: number;
    duration: number;
    stackCount?: number; // For burning stacks
  }>>([]);
  const nextDebuffEffectId = useRef(0);

  // Track active debuff indicators to prevent visual overcrowding
  // Key format: "playerId:debuffType" -> debuff effect id
  const activeDebuffIndicators = useRef<Map<string, number>>(new Map());

  // PVP Frost Nova Effect Management
  const [pvpFrostNovaEffects, setPvpFrostNovaEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextFrostNovaEffectId = useRef(0);


  // PVP Crossentropy Explosion Effect Management
  const [pvpCrossentropyExplosions, setPvpCrossentropyExplosions] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextCrossentropyExplosionId = useRef(0);

  // PVP Summon Totem Explosion Effect Management
  const [pvpSummonTotemExplosions, setPvpSummonTotemExplosions] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextSummonTotemExplosionId = useRef(0);

  // PVP Haunted Soul Effect Management
  const [pvpHauntedSoulEffects, setPvpHauntedSoulEffects] = useState<Array<{
    id: number;
    position: Vector3;
    startTime: number;
  }>>([]);
  const nextHauntedSoulEffectId = useRef(0);

  // Enemy Taunt Effect Management (for Deathgrasp)
  const [enemyTauntEffects, setEnemyTauntEffects] = useState<Array<{
    id: number;
    enemyId: string;
    startTime: number;
    duration: number;
  }>>([]);
  const nextTauntEffectId = useRef(0);

  // Boss Attack Animation State
  const [bossAttackStates, setBossAttackStates] = useState<Map<string, {
    isAttacking: boolean;
    attackingHand: 'left' | 'right' | null;
    lastAttackTime: number;
  }>>(new Map());

  // Boss Meteor State
  interface MeteorState {
    id: string;
    targetPosition: Vector3;
    timestamp: number;
  }
  const [activeMeteors, setActiveMeteors] = useState<MeteorState[]>([]);

  // Function to create enemy taunt effect (for Deathgrasp)
  const createEnemyTauntEffect = useCallback((enemyId: string, duration: number = 10000) => {
    const tauntEffect = {
      id: nextTauntEffectId.current++,
      enemyId,
      startTime: Date.now(),
      duration
    };

    // Use batched updates for taunt effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'enemy_taunt',
      setter: setEnemyTauntEffects,
      data: tauntEffect
    }]);

    // Clean up taunt effect after duration
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'enemy_taunt',
        setter: setEnemyTauntEffects,
        filterId: tauntEffect.id
      }]);
    }, duration);
  }, []);

  // Function to create venom effect on PVP players
  // Function to create debuff effect on PVP players
  const createPvpDebuffEffect = useCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number = 5000) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Check if there's already an active debuff indicator for this player and debuff type
    const indicatorKey = `${playerId}:${debuffType}`;
    const existingIndicatorId = activeDebuffIndicators.current.get(indicatorKey);
    
    // If there's already an active indicator, extend its duration instead of creating a new one
    if (existingIndicatorId !== undefined) {
      // Find and update the existing debuff effect
      setPvpDebuffEffects(prev => prev.map(effect => {
        if (effect.id === existingIndicatorId) {
          return {
            ...effect,
            duration: Math.max(effect.duration, duration), // Use the longer duration
            position: position.clone(), // Update position to latest
            stackCount: Math.max(effect.stackCount || 1, (position as any).stackCount || 1) // Update stack count if higher
          };
        }
        return effect;
      }));
      
      // Apply the debuff to the local player's movement if this is targeting us
      if (isLocalPlayer && playerEntity) {
        const playerMovement = playerEntity.getComponent(Movement);
        if (playerMovement) {
          if (debuffType === 'frozen') {
            playerMovement.freeze(duration);
          } else if (debuffType === 'slowed') {
            playerMovement.slow(duration, 0.5); // 50% speed reduction
          } else if (debuffType === 'stunned') {
            playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
          } else if (debuffType === 'corrupted') {
            playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
          } else if (debuffType === 'burning') {
            // Burning doesn't affect movement, it's a visual effect only
          }
        }
      }
      
      return; // Exit early, don't create a new indicator
    }
    
    const debuffEffect = {
      id: nextDebuffEffectId.current++,
      playerId,
      debuffType,
      position: position.clone(),
      startTime: Date.now(),
      duration,
      stackCount: (position as any).stackCount || 1 // Extract stack count from position if available
    };
    
    // Track this new debuff indicator
    activeDebuffIndicators.current.set(indicatorKey, debuffEffect.id);
    
    // Use batched updates for debuff effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'debuff',
      setter: setPvpDebuffEffects,
      data: debuffEffect
    }]);
    
    // Apply the debuff to the local player's movement if this is targeting us
    if (isLocalPlayer && playerEntity) {
      const playerMovement = playerEntity.getComponent(Movement);
      if (playerMovement) {
        if (debuffType === 'frozen') {
          playerMovement.freeze(duration);
        } else if (debuffType === 'slowed') {
          playerMovement.slow(duration, 0.5); // 50% speed reduction
        } else if (debuffType === 'stunned') {
          playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
        } else if (debuffType === 'corrupted') {
          playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
        } else if (debuffType === 'burning') {
          // Burning doesn't affect movement, it's a visual effect only
        }
      }
    }
    
    // Clean up debuff effect after duration using batched updates
    setTimeout(() => {
      // Remove from tracking map
      const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
      activeDebuffIndicators.current.delete(indicatorKey);
      
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'debuff',
        setter: setPvpDebuffEffects,
        filterId: debuffEffect.id
      }]);
    }, debuffEffect.duration);
  }, [socket?.id, playerEntity]);

  // Function to create frozen effect on PVP players (called by PVPFrostNovaManager)
  const createPvpFrozenEffect = useCallback((playerId: string, position: Vector3) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Create the frozen debuff effect (3 second freeze)
    createPvpDebuffEffect(playerId, 'frozen', position, 5000);
    
    // Broadcast debuff effect to all players so they can see it
    if (broadcastPlayerDebuff) {
      broadcastPlayerDebuff(playerId, 'frozen', 5000, {
        position: { x: position.x, y: position.y, z: position.z }
      });
    }
  }, [createPvpDebuffEffect, broadcastPlayerDebuff]);

  // Function to create reanimate effect on PVP players
  const createPvpReanimateEffect = useCallback((playerId: string, position: Vector3) => {

    const reanimateEffect = {
      id: nextReanimateEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1500 // 1.5 seconds reanimate duration (matches Reanimate component)
    };

    // Use batched updates for reanimate effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'reanimate',
      setter: setPvpReanimateEffects,
      data: reanimateEffect
    }]);

    // Clean up reanimate effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'reanimate',
        setter: setPvpReanimateEffects,
        filterId: reanimateEffect.id
      }]);
    }, reanimateEffect.duration);
  }, []);

  // Function to create smite effect on PVP players
  const createPvpSmiteEffect = useCallback((playerId: string, position: Vector3, onDamageDealt?: (totalDamage: number) => void) => {

    const smiteEffect = {
      id: nextSmiteEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds - extended to account for start delay (0.05s) + animation (1.0s) + buffer (0.15s)
      onDamageDealt: onDamageDealt // Include healing callback
    };

    // Use batched updates for smite effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'smite',
      setter: setPvpSmiteEffects,
      data: smiteEffect
    }]);

    // Clean up smite effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'smite',
        setter: setPvpSmiteEffects,
        filterId: smiteEffect.id
      }]);
    }, smiteEffect.duration);
  }, []);

  const createPvpColossusStrikeEffect = useCallback((playerId: string, position: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {

    const colossusStrikeEffect = {
      id: nextColossusStrikeEffectId.current++,
      playerId,
      position: position.clone(),
      damage: damage,
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds - extended to account for start delay (0.05s) + animation (1.0s) + buffer (0.15s)
      onDamageDealt: onDamageDealt
    };

    // Use batched updates for colossus strike effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'colossusStrike',
      setter: setPvpColossusStrikeEffects,
      data: colossusStrikeEffect
    }]);

    // Clean up colossus strike effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'colossusStrike',
        setter: setPvpColossusStrikeEffects,
        filterId: colossusStrikeEffect.id
      }]);
    }, colossusStrikeEffect.duration);
  }, []);

  // Function to create wind shear effect on PVP players
  const createPvpWindShearEffect = useCallback((playerId: string, position: Vector3, direction: Vector3) => {
    // Trigger the visual projectile effect
    triggerWindShearProjectile(position, direction);

    const windShearEffect = {
      id: nextWindShearEffectId.current++,
      playerId,
      position: position.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 2200 // 2.2 seconds (slightly longer than projectile lifetime)
    };

    // Use batched updates for wind shear effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'windShear',
      setter: setPvpWindShearEffects,
      data: windShearEffect
    }]);

    // Clean up wind shear effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'windShear',
        setter: setPvpWindShearEffects,
        filterId: windShearEffect.id
      }]);
    }, windShearEffect.duration);
  }, []);

  // Function to create wind shear tornado effect on PVP players
  const createPvpWindShearTornadoEffect = useCallback((playerId: string, duration: number) => {
    // Debug: Log all players in the map

    // For local player (socket.id or 'local'), use the actual player entity position
    let initialPosition = new Vector3();
    let player = players.get(playerId);

    // Check if this is for the local player
    const isLocalPlayer = playerId === socket?.id || playerId === 'local';
    
    if (isLocalPlayer && playerEntity) {
      const transform = playerEntity.getComponent(Transform);
      if (transform) {
        initialPosition = transform.position.clone();
      }
    } else if (player) {
      initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
    } else {
      // Try to find the local player by socket ID if playerId was 'local'
      if (playerId === 'local' && socket?.id) {
        player = players.get(socket.id);
        if (player) {
          initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
        }
      }
    }

    const tornadoEffect = {
      id: nextWindShearTornadoEffectId.current++,
      playerId,
      position: initialPosition,
      startTime: Date.now(),
      duration
    };

    // Use batched updates for tornado effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'windShearTornado',
      setter: setPvpWindShearTornadoEffects,
      data: tornadoEffect
    }]);

    // Clean up tornado effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'windShearTornado',
        setter: setPvpWindShearTornadoEffects,
        filterId: tornadoEffect.id
      }]);
    }, duration);
  }, [players, socket?.id, playerEntity]);

  // Function to create death grasp effect on PVP players
  const createPvpDeathGraspEffect = useCallback((playerId: string, startPosition: Vector3, direction: Vector3) => {

    const deathGraspEffect = {
      id: nextDeathGraspEffectId.current++,
      playerId,
      startPosition: startPosition.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds death grasp duration (matches DeathGraspProjectile component)
      pullTriggered: false
    };

    // Use batched updates for death grasp effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'deathgrasp',
      setter: setPvpDeathGraspEffects,
      data: deathGraspEffect
    }]);

    // Clean up death grasp effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'deathgrasp',
        setter: setPvpDeathGraspEffects,
        filterId: deathGraspEffect.id
      }]);
    }, deathGraspEffect.duration);
  }, []);


  // Function to create frost nova effect on PVP players
  const createPvpFrostNovaEffect = useCallback((playerId: string, position: Vector3) => {

    const frostNovaEffect = {
      id: nextFrostNovaEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200 // 1.2 seconds frost nova duration (matches FrostNovaManager)
    };

    // Use batched updates for frost nova effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'frostNova',
      setter: setPvpFrostNovaEffects,
      data: frostNovaEffect
    }]);

    // Clean up frost nova effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'frostNova',
        setter: setPvpFrostNovaEffects,
        filterId: frostNovaEffect.id
      }]);
    }, frostNovaEffect.duration);
  }, []);



  // Function to create haunted soul effect (for WraithStrike)
  const createPvpHauntedSoulEffect = useCallback((position: Vector3) => {
    const hauntedSoulEffect = {
      id: nextHauntedSoulEffectId.current++,
      position: position.clone(),
      startTime: Date.now()
    };
    
    setPvpHauntedSoulEffects(prev => [...prev, hauntedSoulEffect]);
    
  }, []);

  const createPvpVenomEffect = useCallback((playerId: string, position: Vector3, casterId?: string) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // SAFETY CHECK: Don't create venom effects on the local player
    if (isLocalPlayer) {
      return;
    }
    
    const venomEffect = {
      id: nextVenomEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 6000 // 6 seconds venom duration
    };
    
    // Use batched updates for venom effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'venom',
      setter: setPvpVenomEffects,
      data: venomEffect
    }]);
    
    // Apply DoT damage over time
    const venomDamagePerSecond = 17;
    const tickInterval = 1000; // 1 second per tick
    let tickCount = 0;
    const maxTicks = 6; // 6 seconds total
    
    const venomInterval = setInterval(() => {
      tickCount++;
      if (tickCount > maxTicks) {
        clearInterval(venomInterval);
        return;
      }
      
      // Apply venom damage
      if (broadcastPlayerDamage) {
        broadcastPlayerDamage(playerId, venomDamagePerSecond, 'cobra_shot');
      }

      // Create local damage numbers for the caster to see their venom DoT
      if (casterId === socket?.id) {
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        if (damageNumberManager && damageNumberManager.addDamageNumber) {
          const targetPlayer = players.get(playerId);
          if (targetPlayer) {
            const damagePosition = new Vector3(
              targetPlayer.position.x,
              targetPlayer.position.y + 1.5,
              targetPlayer.position.z
            );
            damageNumberManager.addDamageNumber(
              venomDamagePerSecond,
              false, // Not critical
              damagePosition,
              'cobra_shot' // Green color for venom DoT damage
            );
          }
        }
      }
    }, tickInterval);
    
    // Clean up venom effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'venom',
        setter: setPvpVenomEffects,
        filterId: venomEffect.id
      }]);
    }, venomEffect.duration);
  }, [socket?.id, broadcastPlayerDamage]);

  // Function to handle player death in PVP
  const handlePlayerDeath = useCallback((deadPlayerId: string, killerId: string | undefined) => {
    // Mark player as dead
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      const player = players.get(deadPlayerId);
      const deathPosition = player ? new Vector3(player.position.x, player.position.y, player.position.z) : new Vector3(0, 0.5, 0);

      newState.set(deadPlayerId, {
        isDead: true,
        deathTime: Date.now(),
        killerId,
        deathPosition: deathPosition.clone()
      });
      return newState;
    });

    // Start death effect locally
    const player = players.get(deadPlayerId);
    if (player) {
      setDeathEffects(prev => {
        const newEffects = new Map(prev);
        newEffects.set(deadPlayerId, {
          playerId: deadPlayerId,
          position: new Vector3(player.position.x, player.position.y, player.position.z),
          startTime: Date.now(),
          isActive: true
        });
        return newEffects;
      });

      // Broadcast death effect to other players
      broadcastPlayerDeathEffect(deadPlayerId, player.position, true);
    }

    // Set death state in ControlSystem to prevent movement and abilities
    if (deadPlayerId === socket?.id && controlSystemRef.current) {
      controlSystemRef.current.setPlayerDead(true);

      // Also disable camera rotation during death
      if (cameraSystemRef.current) {
        cameraSystemRef.current.setDeathCameraDisabled(true, socket.id);
      }

      // Also set the Health component's isDead flag and make player invulnerable
      if (playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const playerEntity = world.getEntity(playerEntityRef.current);
        if (playerEntity) {
          const health = playerEntity.getComponent(Health);
          if (health) {
            health.isDead = true; // Ensure Health component knows player is dead
            health.setInvulnerable(6.0); // Make invulnerable for 6 seconds (1 second longer than respawn)
          }
        }
      }
    }

    // Note: Experience rewards for kills are handled in handlePlayerDamaged
    // This function only handles the death of the local player

  }, [socket?.id, players, updatePlayerHealth, playerEntityRef, engineRef]);


  // Function to handle wave completion (legacy multiplayer mode - wave experience removed)
  const handleWaveComplete = useCallback(() => {
    // Wave experience has been removed - no EXP is awarded for wave completions
  }, []);

  // Function to handle PVP wave completion (wave experience removed)
  const handlePvpWaveComplete = useCallback((eventData: any) => {
    const { winnerPlayerId, defeatedPlayerId, isLocalPlayerWinner, waveId } = eventData;

    // Award 10 essence when any enemy player's wave is defeated (even if we didn't win)
    if (defeatedPlayerId && defeatedPlayerId !== socket?.id) {
      updatePlayerEssence(socket?.id!, 10);
    }

    if (isLocalPlayerWinner) {
      // Local player won - no experience awarded (wave experience system removed)
    } else {
      // Opponent won - no experience for local player
    }
  }, [socket, updatePlayerEssence]);

  // Listen for wave completion events from server
  useEffect(() => {
    const handleWaveCompletedEvent = (event: CustomEvent) => {
      handleWaveComplete();
    };

    const handlePvpWaveCompletedEvent = (event: CustomEvent) => {
      handlePvpWaveComplete(event.detail);
    };

    // Listen for both legacy multiplayer and PVP wave completion events
    window.addEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
    window.addEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);

    return () => {
      window.removeEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
      window.removeEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);
    };
  }, [handleWaveComplete, handlePvpWaveComplete]);

  // Notify parent component of experience updates
  React.useEffect(() => {
    if (onExperienceUpdate) {
      onExperienceUpdate(playerExperience, playerLevel);
    }
  }, [playerExperience, playerLevel, onExperienceUpdate]);

  // Update runes when level or primary weapon changes
  React.useEffect(() => {
    const primaryWeapon = selectedWeapons?.primary || WeaponType.BOW;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
  }, [playerLevel, selectedWeapons?.primary]);

  const [weaponState, setWeaponState] = useState({
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    isCharging: false,
    chargeProgress: 0,
    chargeDirection: new Vector3(0, 0, -1), // Default forward direction
    isSwinging: false,
    isSpinning: false,
    swordComboStep: 1 as 1 | 2 | 3,
    isSwordCharging: false,
    isDeflecting: false,
    isViperStingCharging: false,
    viperStingChargeProgress: 0,
    isBarrageCharging: false,
    barrageChargeProgress: 0,
    isCobraShotCharging: false,
    cobraShotChargeProgress: 0,
    isSkyfalling: false,
    isBackstabbing: false,
    isSundering: false,
    isCorruptedAuraActive: false,
    isFrozen: false
  });

  // Use a ref to store current weapon state to avoid infinite re-renders
  const weaponStateRef = useRef(weaponState);
  const lastWeaponStateUpdate = useRef(0);

  // Update weapon state when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons) {
      setWeaponState(prev => ({
        ...prev,
        currentWeapon: selectedWeapons.primary,
        currentSubclass: WeaponSubclass.ELEMENTAL // Default subclass, could be expanded later
      }));
    }
  }, [selectedWeapons]);

  // Throttling refs to prevent infinite re-renders in useFrame
  const lastDamageNumbersUpdate = useRef(0);
  const lastCameraUpdate = useRef(0);
  const lastGameStateUpdate = useRef(0);

  // Track previous weapon state for change detection
  const prevWeaponRef = useRef<{ weapon: WeaponType; subclass: WeaponSubclass }>({
    weapon: WeaponType.BOW,
    subclass: WeaponSubclass.ELEMENTAL
  });
  
  // Track multiplayer player states for animations
  const [multiplayerPlayerStates, setMultiplayerPlayerStates] = useState<Map<string, {
    isCharging: boolean;
    chargeProgress: number;
    isSwinging: boolean;
    swordComboStep: 1 | 2 | 3;
    isSpinning: boolean;
    isSwordCharging: boolean;
    isDeflecting: boolean;
    isViperStingCharging: boolean;
    viperStingChargeProgress: number;
    isBarrageCharging: boolean;
    barrageChargeProgress: number;
    isCobraShotCharging: boolean;
    cobraShotChargeProgress: number;
    isSkyfalling: boolean;
    isBackstabbing: boolean;
    // Add missing Runeblade animation states
    isSmiting: boolean;
    isColossusStriking?: boolean;
    isWindShearing?: boolean;
    isWindShearCharging?: boolean;
    windShearChargeProgress?: number;
    isDeathGrasping: boolean;
    isWraithStriking: boolean;
    isCorruptedAuraActive: boolean;
    isSundering?: boolean;
    isSummonTotemCharging?: boolean;
    summonTotemChargeProgress?: number;
    isFrozen?: boolean;
    lastAttackType?: string;
    lastAttackTime?: number;
    lastAnimationUpdate?: number;
  }>>(new Map());
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();
  
  // Optimized PVP effects with object pooling
  const { createOptimizedVenomEffect, createOptimizedDebuffEffect, getPoolStats } = useOptimizedPVPEffects();

// Mana regeneration for weapons that use mana (Scythe and Runeblade)
useEffect(() => {
  // Continuous mana regeneration for all weapons (resources regenerate even when not using that weapon)
  const interval = setInterval(() => {
    setWeaponManaResources(prev => {
      const updated = { ...prev };

      // Mana regeneration for Scythe (10 mana per second = 5 every 500ms)
      const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel);
      if (updated[WeaponType.SCYTHE] < scytheMaxMana) {
        updated[WeaponType.SCYTHE] = Math.min(scytheMaxMana, updated[WeaponType.SCYTHE] + 5);
      }

      // Mana regeneration for Runeblade (8 mana per second = 4 every 500ms)
      const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel);
      if (updated[WeaponType.RUNEBLADE] < runebladeMaxMana) {
        updated[WeaponType.RUNEBLADE] = Math.min(runebladeMaxMana, updated[WeaponType.RUNEBLADE] + 2);
      }

      return updated;
    });
  }, 500);

  return () => clearInterval(interval);
}, [playerLevel]);

// Handle mana capacity increase when leveling up
useEffect(() => {
  // When player levels up, increase mana capacity for Scythe and Runeblade
  setWeaponManaResources(prev => {
    const updated = { ...prev };
    
    // Update Scythe mana capacity
    const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel);
    if (updated[WeaponType.SCYTHE] < scytheMaxMana) {
      updated[WeaponType.SCYTHE] = scytheMaxMana; // Fill to new max capacity
    }
    
    // Update Runeblade mana capacity
    const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel);
    if (updated[WeaponType.RUNEBLADE] < runebladeMaxMana) {
      updated[WeaponType.RUNEBLADE] = runebladeMaxMana; // Fill to new max capacity
    }
    
    return updated;
  });
}, [playerLevel]);

  // Sync currentWeapon with weaponState
  useEffect(() => {
    setCurrentWeapon(weaponState.currentWeapon);
  }, [weaponState.currentWeapon]);

// Update max mana display based on current weapon and level (but don't reset the actual mana value)
useEffect(() => {
  if (currentWeapon === WeaponType.SCYTHE) {
    setMaxMana(getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel));
  } else if (currentWeapon === WeaponType.RUNEBLADE) {
    setMaxMana(getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel));
  } else {
    setMaxMana(0); // No mana for other weapons
  }
}, [currentWeapon, playerLevel]);

// Function to consume mana for weapon abilities (Scythe and Runeblade)
const consumeMana = useCallback((amount: number) => {
  if (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) {
    setWeaponManaResources(prev => ({
      ...prev,
      [currentWeapon]: Math.max(0, prev[currentWeapon] - amount)
    }));
  }
}, [currentWeapon]);

// Function to check if current weapon has enough mana
const hasMana = useCallback((amount: number) => {
  const result = currentMana >= amount;
  return result;
}, [currentMana]);

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const handlePlayerAttack = (data: any) => {
      // CRITICAL FIX: Never process our own attacks to prevent duplicate projectiles and damage
      if (data.playerId === socket.id) {
        return;
      }
      
      if (engineRef.current) {
        // NOTE: bow_release attacks are no longer broadcast to avoid duplicate damage
        // Perfect shot visual effects are now handled via the projectile system broadcasts
        
        // Handle special ability projectiles that need custom visual effects
        if (data.attackType === 'viper_sting_projectile') {

          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          // Create the ECS projectile for damage (this is needed for collision detection)
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);

            // Create Viper Sting projectile for damage
            projectileSystem.createProjectile(
              engineRef.current.getWorld(),
              position,
              direction,
              attackerEntityId,
              { speed: 16, damage: 61, lifetime: 5, piercing: true, opacity: 0.8, projectileType: 'viper_sting', sourcePlayerId: data.playerId }
            );
          }
          
          // For PVP broadcasts, normalize the position and direction to be flat for visual effect
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Create visual effect from the remote player's position but with flat trajectory
          // This will show the Viper Sting projectile coming from the correct player but flat
          const success = triggerGlobalViperSting(flatPosition, flatDirection);
          if (success) {
          }
          
          return;
        }
        
        if (data.attackType === 'cobra_shot_projectile') {
          // Note: Cobra Shot damage is handled by PVPCobraShotManager through visual projectiles
          // No need to create ECS projectiles that show up as regular arrows
          
          // Trigger visual effect for Cobra Shot projectile (this creates the visual projectile that PVPCobraShotManager monitors)
          const { triggerGlobalCobraShot } = require('@/components/projectiles/CobraShotManager');
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalCobraShot(position, direction);
          
          return;
        }
        
        // Handle sword charge hit attacks
        if (data.attackType === 'sword_charge_hit') {
          
          // Validate animationData object exists and has required properties
          if (!data.animationData || typeof data.animationData.damage !== 'number' || typeof data.animationData.targetId !== 'number') {
            return;
          }
          
          // Check if this hit targets the local player
          const targetEntityId = serverPlayerEntities.current.get(socket?.id || '');
          if (targetEntityId === data.animationData.targetId) {
            // Apply damage directly to local player
            if (playerEntity && broadcastPlayerDamage && socket?.id) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                // Apply damage through PVP system
                broadcastPlayerDamage(socket.id, data.animationData.damage);
              }
            }
          }
          
          return; // Don't process as regular projectile
        }
        
        // Handle regular projectile attacks - create projectiles that can hit the local player
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile', 'burst_arrow'];
        if (projectileTypes.includes(data.attackType)) {

          
          // Create a projectile that can damage the local player
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            // Use pooled Vector3 objects for better performance
            const position = pvpObjectPool.acquireVector3(data.position.x, data.position.y, data.position.z);
            const direction = pvpObjectPool.acquireVector3(data.direction.x, data.direction.y, data.direction.z);
            
            // Get the attacker's local ECS entity ID (if it exists) or use a unique negative ID
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);
            
            // Create appropriate projectile type with PVP damage enabled
            switch (data.attackType) {
              case 'regular_arrow':
                projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId, // Use attacker's entity ID as owner
                  { speed: 25, damage: 10, lifetime: 3, maxDistance: 25, opacity: 0.8, sourcePlayerId: data.playerId } // PVP damage handled by CombatSystem
                );
                break;
              case 'charged_arrow':
                // Only create visual effect for charged arrows - no damage-dealing projectile
                // The local player already created the damage-dealing projectile
                
                // Create charged arrow visual effect for other players with flat positioning
                const chargedPlayer = players.get(data.playerId);
                const chargedSubclass = chargedPlayer?.subclass || WeaponSubclass.ELEMENTAL;
                
                // For PVP broadcasts, normalize the position and direction to be flat
                const chargedFlatPosition = position.clone();
                chargedFlatPosition.y = 1.5; // Fixed height for visual consistency
                
                const chargedFlatDirection = direction.clone();
                chargedFlatDirection.y = 0; // Remove vertical component
                chargedFlatDirection.normalize(); // Ensure it's still a unit vector
                
                createPowershotEffect(
                  chargedFlatPosition,
                  chargedFlatDirection,
                  chargedSubclass,
                  false, // not a perfect shot
                  true   // isElementalShotsUnlocked
                );
                break;
              case 'entropic_bolt':
                // Use broadcast config data if available, otherwise fall back to defaults
                const entropicConfig = data.animationData?.projectileConfig || {};
                const isCryoflame = entropicConfig.isCryoflame || false;
                
                projectileSystem.createEntropicBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { 
                    speed: entropicConfig.speed || 20, 
                    damage: entropicConfig.damage || 20, 
                    lifetime: entropicConfig.lifetime || 1.75, 
                    piercing: entropicConfig.piercing || false, 
                    opacity: entropicConfig.opacity || 0.8,
                    isCryoflame: isCryoflame // Pass Cryoflame state to projectile system
                  }
                );
                break;
              case 'crossentropy_bolt':
                projectileSystem.createCrossentropyBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 15, damage: 90, lifetime: 2.5, piercing: false, opacity: 0.8 }
                );
                break;
              case 'perfect_shot':
                // Only create visual effect for perfect shots - no damage-dealing projectile
                // The local player already created the damage-dealing projectile
                
                // Create perfect shot visual effect for other players with flat positioning
                const player = players.get(data.playerId);
                const subclass = player?.subclass || WeaponSubclass.ELEMENTAL;
                
                // For PVP broadcasts, normalize the position and direction to be flat
                const flatPosition = position.clone();
                flatPosition.y = 1.25; // Fixed height for visual consistency
                
                const flatDirection = direction.clone();
                flatDirection.y = 0; // Remove vertical component
                flatDirection.normalize(); // Ensure it's still a unit vector
                
                createPowershotEffect(
                  flatPosition,
                  flatDirection,
                  subclass,
                  true, // isPerfectShot
                  true  // isElementalShotsUnlocked
                );
                break;
              case 'barrage_projectile':
                // Create Barrage projectiles for PVP
                const barrageEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 22, damage: 30, lifetime: 3, maxDistance: 25, piercing: false, opacity: 0.8, sourcePlayerId: data.playerId }
                );
                
                // Mark as barrage arrow for proper visual rendering
                const renderer = barrageEntity.getComponent(Renderer);
                if (renderer?.mesh) {
                  renderer.mesh.userData.isBarrageArrow = true;
                  renderer.mesh.userData.isRegularArrow = false;
                }
                break;
              case 'burst_arrow':
                // Create Tempest Rounds burst projectiles for PVP
                const burstEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 25, damage: 30, lifetime: 3, maxDistance: 25, piercing: false, opacity: 0.8, projectileType: 'burst_arrow', sourcePlayerId: data.playerId }
                );
                
                // Mark as burst arrow for proper visual rendering (teal color)
                const burstRenderer = burstEntity.getComponent(Renderer);
                if (burstRenderer?.mesh) {
                  burstRenderer.mesh.userData.isBurstArrow = true;
                  burstRenderer.mesh.userData.isRegularArrow = false;
                }
                break;
            }
            
            // Release pooled Vector3 objects back to pool after use
            pvpObjectPool.releaseVector3(position);
            pvpObjectPool.releaseVector3(direction);
          }
        }
        
        // Update the player state to show attack animation using batched updates
        const animationData = data.animationData || {};
        const animationUpdateTime = Date.now();
        
        PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
          playerId: data.playerId,
          stateUpdate: {
            isSwinging: data.attackType.includes('swing') || (data.attackType.includes('sword') && !data.attackType.includes('charge')),
            isCharging: data.attackType.includes('bow') && data.attackType.includes('charge'),
            isSpinning: data.attackType.includes('scythe') || data.attackType.includes('entropic_bolt') || data.attackType.includes('crossentropy_bolt') || data.attackType.includes('sword_charge_spin') || animationData.isSpinning || false,
            isSwordCharging: data.attackType === 'sword_charge_spin' || data.attackType === 'sword_charge_start' || animationData.isSpinning || animationData.isSwordCharging || false,
            swordComboStep: animationData.comboStep || 1,
            chargeProgress: animationData.chargeProgress || 0,
            lastAttackType: data.attackType,
            lastAttackTime: animationUpdateTime,
            lastAnimationUpdate: animationUpdateTime
          }
        }]);
          
          // Get the player's weapon and subclass for proper animation timing
          const player = players.get(data.playerId);
          const playerWeapon = player?.weapon || WeaponType.BOW;
          const playerSubclass = player?.subclass;
          
          // Calculate weapon-specific animation duration based on actual weapon timing
          // These durations match the real animation calculations in each weapon component
          let resetDuration = 100; // Default
          
          // Special handling for sword charge attacks
          if (data.attackType === 'sword_charge_spin') {
            // Charge spin lasts about 1 full rotation at 27.5 rotation speed
            // (Math.PI * 2) / 27.5 / (1/60) ≈ 685ms for one full rotation
            resetDuration = 50;
          } else if (data.attackType === 'sword_charge_start') {
            // Charge movement lasts about 1.5 seconds (matches ControlSystem chargeDuration)
            resetDuration = 450;
          } else {
            switch (playerWeapon) {
              case WeaponType.SCYTHE:
                // Check if dual wielding (Abyssal subclass level 2+)
                if (playerSubclass === WeaponSubclass.ABYSSAL) {
                  // Dual scythe timing: similar to Sabres with delays
                  resetDuration = 350;
                } else {
                  // Single scythe: swingProgress += delta * 8 until >= Math.PI * 0.85
                  // At 60fps: (Math.PI * 0.85) / 8 / (1/60) ≈ 335ms
                  resetDuration = 167.5;
                }
                break;
              case WeaponType.SWORD:
                // swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
                // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
                // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
                resetDuration = 80
                break;
            case WeaponType.SABRES:
              // Two swings with delays - total duration roughly 350ms
              resetDuration = 275;
              break;
            case WeaponType.RUNEBLADE:
              // Same timing as sword: swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
              // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
              // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
              resetDuration = 80;
              break;
            case WeaponType.BOW:
              resetDuration = 300; // Quick shots
              break;
            default:
              resetDuration = 100; // Default for other weapons
            }
          }
          
          // Schedule animation reset using batched updates
          setTimeout(() => {
            PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
              playerId: data.playerId,
              stateUpdate: {
                isSwinging: false,
                isCharging: false,
                isSpinning: false,
                isSwordCharging: false
              }
            }]);
          }, resetDuration);
      }

      // Play enemy sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.attackType) {
          case 'viper_sting_projectile':
            window.audioSystem.playEnemyViperStingReleaseSound(position);
            break;
          case 'cobra_shot_projectile':
            // Cobra shot uses bow release sound
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'regular_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'charged_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'perfect_shot':
            window.audioSystem.playEnemyBowReleaseSound(position, 1.0); // Perfect shot is max charge
            break;
          case 'barrage_projectile':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'burst_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'entropic_bolt':
            window.audioSystem.playEnemyEntropicBoltSound(position);
            break;
          case 'crossentropy_bolt':
            window.audioSystem.playEnemyCrossentropySound(position);
            break;
          case 'sword_swing':
            window.audioSystem.playEnemySwordSwingSound(data.animationData?.comboStep || 1, position);
            break;
          case 'runeblade_swing':
            window.audioSystem.playEnemySwordSwingSound(data.animationData?.comboStep || 1, position);
            break;
          case 'sabres_swing':
            window.audioSystem.playEnemySabresSwingSound(position);
            break;
        }
      }
    };

    const handlePlayerAbility = (data: any) => {
      if (data.playerId !== socket.id) {
        // Handle special abilities like Viper Sting, Barrage
        if (data.abilityType === 'viper_sting') {

          // Create Viper Sting visual effect from the remote player's position and direction
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // For PVP broadcasts, normalize the position and direction to be flat
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Trigger Viper Sting visual effect with flat position and direction
          // This will create the projectile from the correct player's position but flat
          // Pass caster ID so projectile returns to the correct player
          const success = triggerGlobalViperSting(flatPosition, flatDirection, data.playerId);
          if (success) {
          }
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isViperStingCharging: true,
              viperStingChargeProgress: 1.0 // Full charge when triggered
            });
            
            // Reset Viper Sting state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isViperStingCharging: false,
                    viperStingChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 2000); // Viper Sting lasts 2 seconds
            
            return updated;
          });
        } else if (data.abilityType === 'cloudkill') {
          // Cloudkill ability - use the target positions from when the ability was originally cast
          // Check if target positions are included in the broadcast data
          if (data.targetPositions && Array.isArray(data.targetPositions)) {
            // Use the original target positions from the caster
            triggerGlobalCloudkillWithTargets(data.targetPositions, data.playerId);
          } else {
            // Fallback to old behavior for compatibility (should be removed after testing)
            if (playerEntityRef.current !== null && engineRef.current) {
              const world = engineRef.current.getWorld();
              const localPlayerEntity = world.getEntity(playerEntityRef.current);
              if (localPlayerEntity) {
                const localPlayerTransform = localPlayerEntity.getComponent(Transform);
                if (localPlayerTransform) {
                  const localPosition = localPlayerTransform.position.clone();
                  triggerGlobalCloudkill(localPosition, data.playerId);
                }
              }
            }
          }
        } else if (data.abilityType === 'frost_nova') {
          // Create frost nova visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpFrostNovaEffect(data.playerId, position);
          
          // Note: PVP damage and freeze effects are now handled by PVPFrostNovaManager
        } else if (data.abilityType === 'reanimate') {

          // Create reanimate visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpReanimateEffect(data.playerId, position);
        } else if (data.abilityType === 'smite') {

          // Create smite visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpSmiteEffect(data.playerId, position, undefined); // No healing callback for remote players

          // Update player state to show smiting animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSmiting: true
            });

            // Reset smite state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSmiting: false
                  });
                }
                return updated;
              });
            }, 900); // Smite animation duration

            return updated;
          });
        } else if (data.abilityType === 'colossusStrike') {

          // Create colossus strike visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const damage = (data.extraData && data.extraData.damage) ? data.extraData.damage : 100;
          createPvpColossusStrikeEffect(data.playerId, position, damage, undefined); // No healing callback for remote players

          // Update player state to show colossus striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isColossusStriking: true
            });

            // Reset colossus strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isColossusStriking: false
                  });
                }
                return updated;
              });
            }, 1200); // Colossus Strike animation duration

            return updated;
          });
        } else if (data.abilityType === 'windShear') {

          // Create wind shear projectile visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpWindShearEffect(data.playerId, position, direction);

          // Update player state to show wind shearing animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isWindShearing: false,
              isWindShearCharging: false,
              windShearChargeProgress: 0,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWindShearing: true
            });

            // Reset wind shear state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWindShearing: false,
                    isWindShearCharging: false,
                    windShearChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 200); // Wind shear animation duration

            return updated;
          });
        } else if (data.abilityType === 'deathgrasp') {

          // Create death grasp visual effect and taunt nearby bosses
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpDeathGraspEffect(data.playerId, position, direction);

          // Show taunt effects on nearby bosses (Deathgrasp now taunts enemies)
          const tauntRange = 15; // Same range as backend
          enemies.forEach((enemy: any) => {
            if (enemy.type === 'boss') {
              const enemyPos = new Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
              const distance = position.distanceTo(enemyPos);

              if (distance <= tauntRange) {
                // Create taunt visual effect on this boss
                createEnemyTauntEffect(enemy.id, 10000); // 10 seconds taunt duration
                console.log(`🎯 Deathgrasp: Showing taunt effect on boss ${enemy.id}`);
              }
            }
          });

          // Update player state to show death grasping animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isDeathGrasping: true
            });

            // Reset death grasp state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeathGrasping: false
                  });
                }
                return updated;
              });
            }, 1200); // Death grasp animation duration

            return updated;
          });
        } else if (data.abilityType === 'wraith_strike') {

          // Update player state to show wraith striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWraithStriking: true
            });

            // Reset wraith strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWraithStriking: false
                  });
                }
                return updated;
              });
            }, 550); // Wraith strike animation duration

            return updated;
          });

          // Create Haunted Soul effect for remote players
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          setPvpHauntedSoulEffects(prev => [...prev, {
            id: Date.now(),
            playerId: data.playerId,
            position: position,
            startTime: Date.now(),
            duration: 800 // Match the effect duration
          }]);
        } else if (data.abilityType === 'charge') {
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwordCharging: true
            });
            
            // Reset Charge state after duration (charge lasts about 2 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwordCharging: false
                  });
                }
                return updated;
              });
            }, 2000);
            
            return updated;
          });
        } else if (data.abilityType === 'deflect') {
          
          // Trigger visual Deflect Shield effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Calculate rotation from direction for shield positioning
          const rotation = new Vector3(0, Math.atan2(direction.x, direction.z), 0);
          triggerGlobalDeflectShield(position, rotation, data.playerId);
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isDeflecting: true
            });
            
            // Reset Deflect state after duration (deflect lasts 3 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeflecting: false
                  });
                }
                return updated;
              });
            }, 3000);
            
            return updated;
          });
        } else if (data.abilityType === 'skyfall') {
          
          // Set the skyfall animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSkyfalling: true
            });
            
            // Reset Skyfall state after duration (skyfall lasts about 3-4 seconds total)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSkyfalling: false
                  });
                }
                return updated;
              });
            }, 1750); // Skyfall duration
            
            return updated;
          });
        } else if (data.abilityType === 'backstab') {
          
          // Backstab is an instant melee attack, so we need to:
          // 1. Calculate damage based on position relative to targets
          // 2. Apply damage to players in range
          // 3. Show brief animation state
          
          const attackerPosition = new Vector3(data.position.x, data.position.y, data.position.z);
          const attackerDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Set the backstab animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isDeflecting: false,
              isSwordCharging: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            // Set backstab animation state
            updated.set(data.playerId, {
              ...currentState,
              isBackstabbing: true
            });
            
            // Reset backstab animation after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const currentState = updated.get(data.playerId);
                if (currentState) {
                  updated.set(data.playerId, {
                    ...currentState,
                    isBackstabbing: false
                  });
                }
                return updated;
              });
            }, 1000); // Match backstab duration
            
            return updated;
          });
          
          // Find the attacker player to get their rotation
          const attackerPlayer = players.get(data.playerId);
          if (attackerPlayer) {
            // Check if local player is in range and calculate damage
            const localPlayer = players.get(socket?.id || '');
            if (localPlayer && socket?.id !== data.playerId) {
              const localPlayerPos = new Vector3(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z);
              const distance = attackerPosition.distanceTo(localPlayerPos);
              
              if (distance <= 2.5) { // Backstab range
                // Check if attacker is in front of local player (cone attack)
                const directionToLocal = new Vector3()
                  .subVectors(localPlayerPos, attackerPosition)
                  .normalize();
                
                const dotProduct = attackerDirection.dot(directionToLocal);
                const angleThreshold = Math.cos(Math.PI / 3); // 60 degree cone
                
                if (dotProduct >= angleThreshold) {
                  // Local player is in the attack cone, calculate backstab damage
                  let damage = 75; // Base damage
                  let isBackstab = false;
                  
                  // Calculate local player's facing direction from their rotation
                  const localFacingDirection = new Vector3(
                    Math.sin(localPlayer.rotation.y),
                    0,
                    Math.cos(localPlayer.rotation.y)
                  ).normalize();
                  
                  // Vector from local player to attacker
                  const attackerDirectionFromLocal = new Vector3()
                    .subVectors(attackerPosition, localPlayerPos)
                    .normalize();
                  
                  // Check if attacker is behind local player (dot product < 0 means opposite direction)
                  const behindDotProduct = localFacingDirection.dot(attackerDirectionFromLocal);
                  isBackstab = behindDotProduct < -0.3; // 70 degree cone behind target
                  
                  if (isBackstab) {
                    damage = 150; // Backstab damage
                  }
                  
                  // Apply damage to local player
                  if (broadcastPlayerDamage && socket?.id) {
                    broadcastPlayerDamage(socket.id, damage, 'backstab');
                  }
                }
              }
            }
          }
          
          // Show brief backstab animation state
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwinging: true // Brief swing animation for backstab
            });
            
            // Reset swing state after brief duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwinging: false
                  });
                }
                return updated;
              });
            }, 300); // Brief 300ms animation
            
            return updated;
          });
        } else if (data.abilityType === 'sunder') {

          // Set the sunder animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isSundering: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSundering: true
            });

            // Reset sunder animation after duration (match the 1.5 second duration from ControlSystem)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSundering: false
                  });
                }
                return updated;
              });
            }, 1500); // Sunder animation duration

            return updated;
          });
        } else if (data.abilityType === 'summon_totem') {
          // Trigger remote totem creation via PVPSummonTotemManager

          if ((window as any).triggerGlobalSummonTotem) {
            const position = new Vector3(data.position.x, data.position.y, data.position.z);
            (window as any).triggerGlobalSummonTotem(
              position,
              undefined, // Let PVPSummonTotemManager handle enemy data
              undefined, // Let PVPSummonTotemManager handle damage callback
              undefined, // Let PVPSummonTotemManager handle effects
              undefined, // Let PVPSummonTotemManager handle active effects
              undefined, // Let PVPSummonTotemManager handle damage numbers
              undefined, // Let PVPSummonTotemManager handle damage number ID
              undefined, // Remote totems healing is handled by the server
              data.playerId // Pass remote caster ID
            );
          }
        }
      }

      // Play enemy ability sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.abilityType) {
          case 'cloudkill':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'frost_nova':
            window.audioSystem.playEnemyFrostNovaSound(position);
            break;
          case 'reanimate':
            // Reanimate doesn't have a specific sound, uses healing sound which is handled separately
            break;
          case 'smite':
            window.audioSystem.playEnemyRunebladeSmiteSound(position);
            break;
          case 'colossusStrike':
            window.audioSystem.playEnemyColossusStrikeSound(position);
            break;
          case 'windShear':
            window.audioSystem.playEnemyWindshearSound(position);
            break;
          case 'deathgrasp':
            window.audioSystem.playEnemyRunebladeVoidGraspSound(position);
            break;
          case 'wraith_strike':
            window.audioSystem.playEnemyRunebladeWraithbladeSound(position);
            break;
          case 'charge':
            window.audioSystem.playEnemySwordChargeSound(position);
            break;
          case 'deflect':
            window.audioSystem.playEnemySwordDeflectSound(position);
            break;
          case 'skyfall':
            window.audioSystem.playEnemySabresSkyfallSound(position);
            break;
          case 'backstab':
            window.audioSystem.playEnemyBackstabSound(position);
            break;
          case 'sunder':
            window.audioSystem.playEnemySabresFlourishSound(position);
            break;
          case 'stealth':
            window.audioSystem.playEnemySabresShadowStepSound(position);
            break;
        }
      }
    };

    const handlePlayerDamaged = (data: any) => {
      let targetActuallyDied = false;

      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket?.id && playerEntity && socket?.id) {
        // Check if player is already in death state - if so, ignore damage
        const deathState = playerDeathStates.get(socket.id);
        if (deathState?.isDead) {
          return;
        }
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          // Pass the entity so Health component can use Shield for damage absorption
          // Bypass invulnerability for PVP damage to allow rapid attacks like bursts to land multiple hits,
          // but respect deflect invulnerability (3 seconds) which is much longer than standard invulnerability (0.5s)
          const bypassInvulnerability = !health.isInvulnerable || health.invulnerabilityTimer <= 1.0;
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity, bypassInvulnerability);

          // Display incoming damage numbers
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              // Use the critical hit information passed from the server
              const isCritical = data.isCritical || false;

              // Directly add damage numbers using the combat system's damage number manager
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5; // Position below player's feet

                damageNumberManager.addDamageNumber(
                  data.damage,
                  isCritical,
                  incomingDamagePosition,
                  data.damageType,
                  true // isIncomingDamage = true
                );
              }
            }
          }

          // Broadcast shield changes to other players
          if (shield) {
            updatePlayerShield(shield.currentShield, shield.maxShield);
          }

          // Check if player just died
          if (wasAlive && health.isDead) {
            targetActuallyDied = true;
            handlePlayerDeath(socket.id, data.sourcePlayerId);
          }
        }
      }

      // Check if we are the source of damage that killed another player
      // Only award experience if our damage ACTUALLY killed the target (not just what backend thought)
      if (data.sourcePlayerId === socket.id && data.targetPlayerId !== socket.id) {
        // For remote players, we need to check if they actually died
        // STRICT VALIDATION: Only award experience if backend says wasKilled AND health is exactly 0
        const remotePlayerDied = !targetActuallyDied && data.wasKilled && data.newHealth === 0;

        // Additional validation: Check if target player is actually removed from players map (truly dead)
        const targetPlayerStillExists = players.has(data.targetPlayerId);
        
        // All EXP awards are now handled by the server via player-experience-gained events
        // The frontend no longer does any kill detection or EXP calculation
        if (targetActuallyDied || remotePlayerDied) {
        }
      }

      // Check if we are the source of damage that killed a summoned unit
      if (data.sourcePlayerId === socket.id && data.damageType === 'summoned_unit_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Check if we are the source of damage that killed an enemy
      if (data.sourcePlayerId === socket.id && data.damageType === 'enemy_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Create damage number for visual feedback - ONLY for the local player being damaged
      // This prevents duplicate damage numbers from appearing on multiple screens
      if (onDamageNumbersUpdate && socket.id && data.targetPlayerId === socket.id) {
        // Get the position of the local player (who was damaged)
        const localPlayer = players.get(socket.id);
        if (localPlayer) {
          const damagePosition = new Vector3(
            localPlayer.position.x,
            localPlayer.position.y + 1.5, // Offset above player
            localPlayer.position.z
          );

          const damageNumberId = Math.random().toString(36).substr(2, 9);
          onDamageNumbersUpdate([{
            id: damageNumberId,
            damage: data.damage,
            position: damagePosition,
            isCritical: false, // PVP damage doesn't have crits currently
            timestamp: Date.now(),
            damageType: data.damageType || 'default' // Use the damage type from the broadcast
          }]);
        }
      }
    };

    const handleBossSkeletonAttack = (data: any) => {
      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket?.id && playerEntity && socket?.id) {
        // Check if player is already in death state - if so, ignore damage
        const deathState = playerDeathStates.get(socket.id);
        if (deathState?.isDead) {
          return;
        }

        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          // Apply damage from boss skeleton (treat as physical damage from enemy)
          // Use standard invulnerability rules for enemy damage
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

          // Display incoming damage numbers
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              // Boss skeleton damage is not critical
              const isCritical = false;

              // Directly add damage numbers using the combat system's damage number manager
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5; // Position below player's feet

                damageNumberManager.addDamageNumber(
                  data.damage,
                  isCritical,
                  incomingDamagePosition,
                  'physical', // Boss skeleton damage type
                  true // isIncomingDamage = true
                );
              }
            }
          }

          // Broadcast shield changes to other players
          if (shield) {
            updatePlayerShield(shield.currentShield, shield.maxShield);
          }

          // Check if player died from this damage
          if (wasAlive && health.isDead) {
            // Handle player death from boss skeleton attack
            handlePlayerDeath(socket.id, data.skeletonId);
          }
        }
      }
    };

    const handlePlayerAnimationState = (data: any) => {
      
      
      if (data.playerId !== socket.id) {
        setMultiplayerPlayerStates(prev => {
          const updated = new Map(prev);
          const currentState = updated.get(data.playerId) || {
            isCharging: false,
            chargeProgress: 0,
            isSwinging: false,
            swordComboStep: 1 | 2 | 3,
            isSpinning: false,
            isSwordCharging: false,
            isDeflecting: false,
            isViperStingCharging: false,
            viperStingChargeProgress: 0,
            isBarrageCharging: false,
            barrageChargeProgress: 0,
            isCobraShotCharging: false,
            cobraShotChargeProgress: 0,
            isBackstabbing: false,
            // Add missing Runeblade animation states
            isSmiting: false,
            isDeathGrasping: false,
            isWraithStriking: false,
            isCorruptedAuraActive: false,
            isSundering: false,
            isFrozen: false
          };
          
          // Update with the received animation state
          const newState = {
            ...currentState,
            ...data.animationState,
            lastAnimationUpdate: Date.now()
          };



          updated.set(data.playerId, newState);

          // Play enemy animation sound effects at 25% volume
          const position = new Vector3(data.position?.x || 0, data.position?.y || 0, data.position?.z || 0);
          if (window.audioSystem && data.animationState) {
            // Handle melee attack sounds - prevent duplicate sounds within 100ms
            if (data.animationState.isSwinging) {
              const now = Date.now();
              const lastSoundTime = lastMeleeSoundTime.current.get(data.playerId) || 0;
              if (now - lastSoundTime > 50) { // 100ms cooldown to prevent double sounds
                lastMeleeSoundTime.current.set(data.playerId, now);

                // Get the player's weapon type to determine which sound to play
                const player = players.get(data.playerId);
                const weaponType = player?.weapon || WeaponType.BOW;

                switch (weaponType) {
                  case WeaponType.SWORD:
                    // Use swordComboStep if available, otherwise default to 1
                    const swordComboStep = data.animationState.swordComboStep || 1;
                    window.audioSystem.playEnemySwordSwingSound(swordComboStep, position);
                    break;
                  case WeaponType.SABRES:
                    window.audioSystem.playEnemySabresSwingSound(position);
                    break;
                  case WeaponType.SCYTHE:
                    // Scythe melee attacks use entropic bolt sound
                    window.audioSystem.playEnemyEntropicBoltSound(position);
                    break;
                case WeaponType.RUNEBLADE:
                  // Use swordComboStep if available, otherwise default to 1
                  const runebladeComboStep = data.animationState.swordComboStep || 1;
                  window.audioSystem.playEnemySwordSwingSound(runebladeComboStep, position);
                  break;
                }
              }
            }

            // Handle charging sounds - only play when charging starts (transitions from false to true)
            if (data.animationState.isCharging && !currentState.isCharging) {
              const player = players.get(data.playerId);
              const weaponType = player?.weapon || WeaponType.BOW;

              switch (weaponType) {
                case WeaponType.BOW:
                  window.audioSystem.playEnemyBowDrawSound(position);
                  break;
                case WeaponType.SWORD:
                  window.audioSystem.playEnemySwordChargeSound(position);
                  break;
              }
            }
          }

          return updated;
        });
      }
    };

    const handlePlayerEffect = (data: any) => {

      if (data.effect?.type === 'venom') {
        const { targetPlayerId, position, duration } = data.effect;

        // Create venom effect on the target player (could be local player or other player)
        if (targetPlayerId && position) {
          const venomPosition = new Vector3(position.x, position.y, position.z);
          createPvpVenomEffect(targetPlayerId, venomPosition);
        }
      }

      if (data.effect?.type === 'mist') {
        const { effectType, position, duration } = data.effect;

        // Create Sabre Reaper Mist effect at the specified position
        if (position) {
          const mistPosition = new Vector3(position.x, position.y, position.z);

          const effectId = `mist_${data.playerId}_${Date.now()}_${Math.random()}`;
          const newEffect = {
            id: effectId,
            position: mistPosition,
            startTime: Date.now(),
            effectType
          };

          setActiveMistEffects(prev => {
            const newEffects = [...prev, newEffect];
            return newEffects;
          });

          // Remove effect after duration (1 second)
          setTimeout(() => {
            setActiveMistEffects(prev => {
              const filtered = prev.filter(effect => effect.id !== effectId);
              return filtered;
            });
          }, duration || 1000);
        }
      }

    };

    const handlePlayerDebuff = (data: any) => {

      const { targetPlayerId, debuffType, duration, effectData } = data;
      
      if (targetPlayerId && debuffType && duration) {
        let position: Vector3;
        
        // If this is the local player being debuffed, use the local player entity position for accuracy
        if (targetPlayerId === socket?.id && playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          if (transform) {
            position = transform.position.clone();
          } else {
            // Fallback to current player position from state
            position = playerPosition.clone();
          }
        } else {
          // For other players, use the multiplayer context or effectData
          const targetPlayer = players.get(targetPlayerId);
          position = targetPlayer 
            ? new Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z)
            : (effectData?.position 
                ? new Vector3(effectData.position.x, effectData.position.y, effectData.position.z)
                : new Vector3(0, 0, 0));
        }
        
        createPvpDebuffEffect(targetPlayerId, debuffType, position, duration);
      }
    };

    const handlePlayerStealth = (data: any) => {

      if (!data || !data.playerId) {
        return;
      }

      const { playerId, isInvisible } = data;

      // Update stealth state for the player
      const previousState = playerStealthStates.current.get(playerId);
      playerStealthStates.current.set(playerId, isInvisible);


    };

    const handlePlayerTornadoEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, duration } = data;

      // Create the tornado effect for the remote player
      createPvpWindShearTornadoEffect(playerId, duration);
    };

    const handlePlayerDeathEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, position, isStarting } = data;

      if (isStarting) {
        // Start death effect
        setDeathEffects(prev => {
          const newEffects = new Map(prev);
          newEffects.set(playerId, {
            playerId,
            position: new Vector3(position.x, position.y, position.z),
            startTime: Date.now(),
            isActive: true
          });
          return newEffects;
        });
      } else {
        // Stop death effect
        setDeathEffects(prev => {
          const newEffects = new Map(prev);
          newEffects.delete(playerId);
          return newEffects;
        });
      }
    };

    const handlePlayerShieldChanged = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, shield, maxShield } = data;

      // Update the player's shield in the players state
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            shield: shield,
            maxShield: maxShield ?? player.maxShield
          });
        }
        return newPlayers;
      });
    };

    const handlePlayerKnockback = (data: any) => {
      if (!data || !data.targetPlayerId) {
        return;
      }

      const { targetPlayerId, direction, distance, duration } = data;

      // Find the target player entity
      const targetEntityId = serverPlayerEntities.current.get(targetPlayerId);
      if (!targetEntityId) {
        return;
      }

      // Get the entity from the world
      const world = engineRef.current?.getWorld();
      if (!world) {
        return;
      }

      const targetEntity = world.getEntity(targetEntityId);
      if (!targetEntity) {
        return;
      }

      // Get the movement component
      const targetMovement = targetEntity.getComponent(Movement);
      if (!targetMovement) {
        return;
      }

      // Get the transform component for current position
      const targetTransform = targetEntity.getComponent(Transform);
      if (!targetTransform) {
        return;
      }

      // Apply knockback
      const knockbackDirection = new Vector3(direction.x, direction.y, direction.z);
      const currentTime = Date.now() / 1000; // Convert to seconds

      targetMovement.applyKnockback(
        knockbackDirection,
        distance,
        targetTransform.position.clone(),
        currentTime,
        duration
      );
    };

    const handlePlayerKill = (data: any) => {
      if (!data || !data.killerId || !data.victimId) {
        return;
      }

      const { killerId, victimId } = data;

      // Increment kill counter for the killer
      incrementKillCount(killerId);

      // Award 20 essence for player kills
      updatePlayerEssence(killerId, 20);
    };

    const handlePillarDestroyed = (data: any) => {
      if (!data || !data.destroyerId) {
        return;
      }

      const { destroyerId } = data;

      // Award 150 essence to the player who destroyed the pillar
      updatePlayerEssence(destroyerId, 150);
    };

    const handlePlayerEssenceChanged = (data: any) => {
      if (!data || !data.playerId || typeof data.essence !== 'number') {
        return;
      }

      const { playerId, essence } = data;

      // Update the players map with new essence
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            essence
          });
        }
        return newPlayers;
      });

      // If this is the local player, notify parent component
      if (playerId === socket?.id && onEssenceUpdate) {
        onEssenceUpdate(essence);
      }
    };


  const handlePlayerHealing = (data: any) => {
      const { healingAmount, healingType, position, targetPlayerId, sourcePlayerId } = data;

      // If this healing is for the local player, apply it to their health
      if (socket.id && targetPlayerId === socket.id && playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const localPlayerEntity = world.getEntity(playerEntityRef.current);
        if (localPlayerEntity) {
          const healthComponent = localPlayerEntity.getComponent(Health);
          if (healthComponent) {
            healthComponent.heal(healingAmount);
          }
        }
        
        // If this is Reanimate healing for the local player from another player, show the visual effect
        if (healingType === 'reanimate' && sourcePlayerId !== socket.id && reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }
      }

      // Create damage numbers for ALL healing events
      // This ensures the visual feedback appears for everyone who sees the healing
      const damageNumberManager = (window as any).damageNumberManager;
      if (damageNumberManager && position) {
        const healingPosition = new Vector3(position.x, position.y, position.z);
        damageNumberManager.addDamageNumber(
          healingAmount,
          false, // Not critical
          healingPosition,
          `${healingType}_healing`
        );
      }
      
      // If this is Reanimate healing for another player, create a visual effect at their position
      if (healingType === 'reanimate' && targetPlayerId !== socket.id && position) {
        const healedPosition = new Vector3(position.x, position.y - 1.5, position.z); // Adjust back to ground level
        createPvpReanimateEffect(targetPlayerId, healedPosition);
      }
    };

    const handlePlayerExperienceGained = (data: any) => {
      const { playerId, experienceGained, source, timestamp } = data;

      // Only award EXP to the local player
      if (playerId === socket?.id) {
        setPlayerExperience(prev => {
          const newExp = prev + experienceGained;

          // Check for level up
          const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
          const newLevel = ExperienceSystem.getLevelFromExperience(newExp);

          if (newLevel > currentLevel) {
            setPlayerLevel(newLevel);

            // Update ControlSystem level for rune calculations
            if (controlSystemRef.current) {
              controlSystemRef.current.setWeaponLevel(newLevel);
            }

            // Update max health based on new level
            if (playerEntity) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                health.maxHealth = newMaxHealth;
              }
            }
          }

          return newExp;
        });
      }
    };

    const handleBossAttack = (data: any) => {
      const { bossId, targetPlayerId, damage, position, timestamp } = data;

      // Update boss attack animation state for all bosses
      setBossAttackStates(prev => {
        const updated = new Map(prev);
        // Alternate hands for attack animation
        const currentState = updated.get(bossId) || { isAttacking: false, attackingHand: null, lastAttackTime: 0 };
        const newHand = currentState.attackingHand === 'left' ? 'right' : 'left';

        updated.set(bossId, {
          isAttacking: true,
          attackingHand: newHand,
          lastAttackTime: Date.now()
        });``

        // Reset attack state after animation duration
        setTimeout(() => {
          setBossAttackStates(prevStates => {
            const resetUpdated = new Map(prevStates);
            const state = resetUpdated.get(bossId);
            if (state) {
              resetUpdated.set(bossId, {
                ...state,
                isAttacking: false,
                attackingHand: null
              });
            }
            return resetUpdated;
          });
        }, 1200); // Match boss animation duration

        return updated;
      });

      // Only handle boss attacks targeting the local player
      if (targetPlayerId === socket?.id && playerEntity) {
        console.log(`🔥 Boss ${bossId} attacked local player for ${damage} damage!`);

        // Apply damage to local player
        const health = playerEntity.getComponent(Health);
        if (health) {
          const currentTime = Date.now() / 1000;
          health.takeDamage(damage, currentTime, playerEntity);

          // Create damage number for visual feedback
          const damageNumberManager = (window as any).damageNumberManager;
          if (damageNumberManager && playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              const damagePosition = transform.getWorldPosition().clone();
              damagePosition.y += 2; // Position above player
              damageNumberManager.addDamageNumber(
                damage,
                false, // Not critical
                damagePosition,
                'boss_attack'
              );
            }
          }
        }
      }
    };

    const handleBossDefeated = (data: any) => {
      const { bossId, killedBy, timestamp } = data;
      console.log(`🎉 BOSS DEFEATED! Killed by player ${killedBy}`);
      
      // Play victory sound or show victory message here if desired
      const audioSystem = (window as any).audioSystem;
      if (audioSystem) {
        // audioSystem.playSound('boss_defeated'); // If you have a boss defeated sound
      }
    };

    const handleBossMeteorCast = (data: any) => {
      const { meteorId, targetPositions, timestamp } = data;
      
      // Create meteors for each target position (all player positions)
      const newMeteors: MeteorState[] = targetPositions.map((pos: { x: number; y: number; z: number }, index: number) => ({
        id: `${meteorId}_${index}`,
        targetPosition: new Vector3(pos.x, pos.y, pos.z),
        timestamp
      }));

      setActiveMeteors(prev => [...prev, ...newMeteors]);
    };

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-healing', handlePlayerHealing);
    socket.on('player-experience-gained', handlePlayerExperienceGained);
    socket.on('player-kill', handlePlayerKill);
    socket.on('pillar-destroyed', handlePillarDestroyed);
    socket.on('player-essence-changed', handlePlayerEssenceChanged);
    socket.on('player-animation-state', handlePlayerAnimationState);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);
    socket.on('player-stealth', handlePlayerStealth);
    socket.on('player-tornado-effect', handlePlayerTornadoEffect);
    socket.on('player-death-effect', handlePlayerDeathEffect);
    socket.on('player-shield-changed', handlePlayerShieldChanged);
    socket.on('player-knockback', handlePlayerKnockback);
    socket.on('boss-attack', handleBossAttack);
    socket.on('boss-defeated', handleBossDefeated);
    socket.on('boss-meteor-cast', handleBossMeteorCast);
    socket.on('boss-skeleton-attack', handleBossSkeletonAttack);


    return () => {
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-used-ability', handlePlayerAbility);
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-healing', handlePlayerHealing);
      socket.off('player-experience-gained', handlePlayerExperienceGained);
      socket.off('player-kill', handlePlayerKill);
      socket.off('pillar-destroyed', handlePillarDestroyed);
      socket.off('player-essence-changed', handlePlayerEssenceChanged);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-debuff', handlePlayerDebuff);
      socket.off('player-stealth', handlePlayerStealth);
      socket.off('player-tornado-effect', handlePlayerTornadoEffect);
      socket.off('player-death-effect', handlePlayerDeathEffect);
      socket.off('player-shield-changed', handlePlayerShieldChanged);
      socket.off('player-knockback', handlePlayerKnockback);
      socket.off('boss-attack', handleBossAttack);
      socket.off('boss-defeated', handleBossDefeated);
      socket.off('boss-meteor-cast', handleBossMeteorCast);
      socket.off('boss-skeleton-attack', handleBossSkeletonAttack);
    };
  }, [socket, playerEntity]);

  // Add a cleanup effect to prevent stuck animations
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setMultiplayerPlayerStates(prev => {
        const updated = new Map(prev);
        const now = Date.now();
        let hasChanges = false;
        
        updated.forEach((state, playerId) => {
          // If an animation has been active for more than 3 seconds, force reset it
          if (state.lastAnimationUpdate && now - state.lastAnimationUpdate > 3000) {
            if (state.isSwinging || state.isCharging || state.isSpinning) {
              updated.set(playerId, {
                ...state,
                isSwinging: false,
                isCharging: false,
                isSpinning: false
              });
              hasChanges = true;
            }
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Sync server enemies with local ECS entities for co-op damage system
  useEffect(() => {
    if (!engineRef.current || !gameStarted) return;
    
    const world = engineRef.current.getWorld();
    
    // Create local ECS entities for enemies (for collision detection and damage)
    enemies.forEach((serverEnemy, enemyId) => {
      if (serverEnemy.isDying) return; // Skip dying enemies
      
      if (!serverEnemyEntities.current.has(enemyId)) {
        // Create a new local ECS entity for this server enemy
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
        entity.addComponent(transform);
        
        // Add Health component
        const health = new Health(serverEnemy.maxHealth);
        health.currentHealth = serverEnemy.health;
        entity.addComponent(health);
        
        // Add Enemy component
        const enemyType = serverEnemy.type === 'boss' ? EnemyType.BOSS : EnemyType.ELITE;
        const enemy = new Enemy(enemyType, 1);
        entity.addComponent(enemy);
        
        // Add Collider component for damage detection (non-solid, trigger only)
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        // Boss = 2.0, boss-skeleton = 1.2, elite = 1.5
        collider.radius = serverEnemy.type === 'boss' ? 2.0 : (serverEnemy.type === 'boss-skeleton' ? 1.2 : 1.5);
        collider.layer = CollisionLayer.ENEMY;
        collider.isTrigger = true; // IMPORTANT: Trigger only, doesn't push players
        collider.setMask(CollisionLayer.PROJECTILE); // Only detect projectiles, not physical collision with players
        collider.setOffset(0, 1, 0); // Center on enemy
        entity.addComponent(collider);

        // Store server enemy ID in entity userData for damage routing
        entity.userData = entity.userData || {};
        entity.userData.serverEnemyId = enemyId;

        // Notify systems that the entity is ready
        world.notifyEntityAdded(entity);

        // Store the mapping
        serverEnemyEntities.current.set(enemyId, entity.id);
        
        console.log(`✅ Created local ECS entity for enemy ${enemyId} (type: ${serverEnemy.type})`);
      } else {
        // Update existing local ECS entity
        const entityId = serverEnemyEntities.current.get(enemyId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update position
          const transform = entity.getComponent(Transform);
          if (transform) {
            transform.setPosition(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
          }
          
          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.maxHealth = serverEnemy.maxHealth;
            health.currentHealth = serverEnemy.health;
          }
        }
      }
    });
    
    // Clean up local entities for enemies that no longer exist
    const currentEnemyIds = new Set(enemies.keys());
    const enemiesToRemove: string[] = [];
    
    serverEnemyEntities.current.forEach((entityId, enemyId) => {
      if (!currentEnemyIds.has(enemyId)) {
        const entity = world.getEntity(entityId);
        if (entity) {
          world.destroyEntity(entity.id);
          console.log(`🗑️ Removed local ECS entity for enemy ${enemyId}`);
        }
        enemiesToRemove.push(enemyId);
      }
    });
    
    // Remove from mapping
    enemiesToRemove.forEach(enemyId => {
      serverEnemyEntities.current.delete(enemyId);
    });
  }, [enemies, gameStarted]);

  // Sync server players and towers with local ECS entities for PVP damage system
  useEffect(() => {
    if (!engineRef.current || !gameStarted) return;
    
    const world = engineRef.current.getWorld();
    
    // Create local ECS entities for other players (for collision detection)
    players.forEach((serverPlayer, playerId) => {
      // Skip our own player
      if (playerId === socket?.id) return;
      
      if (!serverPlayerEntities.current.has(playerId)) {
        // Create a new local ECS entity for this server player
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        entity.addComponent(transform);

        // Add InterpolationBuffer component for smooth movement
        const interpolationBuffer = world.createComponent(InterpolationBuffer);
        entity.addComponent(interpolationBuffer);
        
        // Add Health component (for PVP damage)
        const health = new Health(serverPlayer.maxHealth);
        health.currentHealth = serverPlayer.health;
        entity.addComponent(health);

        // Add Shield component (for PVP damage)
        const shield = new Shield(100, 15, 2.5); // 100 max shield, 20/s regen, 5s delay
        entity.addComponent(shield);

        // Add Movement component for equal collision treatment with local player
        // Remote players don't use this for actual movement (they're position-synced from server)
        // but having it ensures equal collision resolution in CollisionSystem
        const movement = world.createComponent(Movement);
        movement.maxSpeed = 3.75; // Match local player settings
        movement.jumpForce = 8;
        movement.friction = 0.85;
        movement.canMove = false; // Disable actual movement since position comes from server
        entity.addComponent(movement);
        
        // Add Collider component for PVP damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.9; // Reduced collision radius for better player proximity in PVP
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so projectiles can hit remote players in PVP
        // Set collision mask to collide with environment only - NO player-to-player collision in PVP
        collider.setMask(CollisionLayer.ENVIRONMENT);
        collider.setOffset(0, 0.25, 0); // Center on player
        entity.addComponent(collider);
        
        // Notify systems that the entity is ready
        world.notifyEntityAdded(entity);
        
      // Store the mapping
      serverPlayerEntities.current.set(playerId, entity.id);

    
      } else {
        // Update existing local ECS entity
        const entityId = serverPlayerEntities.current.get(playerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update position using interpolation buffer for remote players only
          const transform = entity.getComponent(Transform);
          const interpolationBuffer = entity.getComponent(InterpolationBuffer);
          if (transform && interpolationBuffer) {
            // Create rotation quaternion from Euler angles
            const rotation = new Quaternion();
            rotation.setFromEuler(new Euler(serverPlayer.rotation.x, serverPlayer.rotation.y, serverPlayer.rotation.z));

            // Add server state to interpolation buffer for smooth remote player movement
            const position = new Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
            interpolationBuffer.addServerState(position, rotation);
          } else if (transform) {
            // Fallback to direct position update if interpolation buffer not available
            transform.setPosition(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
          }
          
          // Reset velocity for remote players to prevent drift from collision resolution
          const movement = entity.getComponent(Movement);
          if (movement) {
            movement.velocity.set(0, 0, 0); // Clear any velocity from collision resolution
            movement.acceleration.set(0, 0, 0); // Clear acceleration
          }
          
          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            const wasAlive = !health.isDead;
            health.maxHealth = serverPlayer.maxHealth;
            health.currentHealth = serverPlayer.health;

            // Check if remote player just died
            if (wasAlive && health.isDead) {
              // For remote players, we don't know who killed them from server updates
              // This will be handled by server-side death broadcasts
            }
          }
        }
      }
    });
    
    // Clean up local entities for players that no longer exist
    const currentPlayerIds = new Set(players.keys());
    const entitiesToRemove: string[] = [];
    
    serverPlayerEntities.current.forEach((entityId, playerId) => {
      if (!currentPlayerIds.has(playerId) || playerId === socket?.id) {
        const entity = world.getEntity(entityId);
        if (entity) {
          // Mark entity as dead instead of removing
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = 0;
            health.isDead = true;
          }
        }
        entitiesToRemove.push(playerId);
      }
    });
    
    // Remove from mapping
    entitiesToRemove.forEach(playerId => {
      serverPlayerEntities.current.delete(playerId);
    });
  }, [players, gameStarted, socket?.id]);


  // Initialize the PVP game engine
  // Function to get cloudkill target positions (replicates CloudkillManager logic)
  const getCloudkillTargetPositions = useCallback((casterPosition: Vector3, casterId: string): Array<{ x: number; y: number; z: number }> => {
    const ARROW_COUNT = 3;
    const bossTargets: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

    // Add boss enemies only
    Array.from(enemies.values()).forEach(enemy => {
      if (enemy.health > 0 && (enemy.type === 'boss' || enemy.type === 'boss-skeleton')) {
        bossTargets.push({
          id: enemy.id,
          position: enemy.position
        });
      }
    });

    if (bossTargets.length === 0) return [];

    // Calculate distances and sort by proximity - same logic as CloudkillManager
    const targetsWithDistance = bossTargets.map(target => ({
      target,
      distance: casterPosition.distanceTo(new Vector3(target.position.x, 0, target.position.z))
    }));

    targetsWithDistance.sort((a, b) => a.distance - b.distance);

    // Get closest targets
    const closestTargets = targetsWithDistance.slice(0, Math.min(bossTargets.length, ARROW_COUNT)).map(item => item.target);

    // Return the target positions that arrows will be aimed at
    return closestTargets.map(target => target.position);
  }, [enemies]);

  useEffect(() => {
    if (isInitialized.current || !gameStarted) return;
    isInitialized.current = true;


    // Initialize damage system with level-scaled runes for Bow, Sword, and Sabres
    const primaryWeapon = selectedWeapons?.primary || WeaponType.BOW;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
    
    // Create engine
    const engine = new Engine({ enableDebug: true });
    engineRef.current = engine;

    // Initialize with canvas
    const canvas = gl.domElement;
    engine.initialize(canvas).then(() => {
      // Engine initialized successfully - now start the game loop
      console.log('🚀 CoopGameScene: Engine initialized, starting game loop...');
      engine.start();
      console.log('✅ CoopGameScene: Engine started and ready');
      setEngineReady(true);
    });

    // Cleanup function
    return () => {
      console.log('🧹 CoopGameScene: Cleaning up engine...');
      setEngineReady(false);
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [gameStarted]); // Only initialize when game starts, not when players change

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
      // Update FPS counter
      updateFPSCounter(engineRef.current.getCurrentFPS());

      // Reset object pool temporary objects for this frame
      pvpObjectPool.resetFrameTemporaries();

      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform && transform.position) {
          const newPosition = transform.position.clone();
          setPlayerPosition(newPosition);
          realTimePlayerPositionRef.current.copy(newPosition);

          // Update Viper Sting parent ref with current position and camera rotation
          viperStingParentRef.current.position.copy(newPosition);

          // Calculate quaternion from camera direction for Viper Sting
          const cameraDirection = new Vector3();
          camera.getWorldDirection(cameraDirection);
          const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);

          // Update quaternion for Viper Sting direction
          viperStingParentRef.current.quaternion = {
            x: 0,
            y: Math.sin(cameraAngle / 2),
            z: 0,
            w: Math.cos(cameraAngle / 2)
          };

          // Send position updates to other players with camera rotation
          const rotation = { x: 0, y: cameraAngle, z: 0 };
          updatePlayerPosition(transform.position, rotation);
        }
      }

      // Update weapon state from control system
      if (controlSystemRef.current) {
        // Debug: Log control system state occasionally
        if (Math.random() < 0.01) { // Only log 1% of the time
          console.log('🎮 Control system state:', {
            currentWeapon: controlSystemRef.current.getCurrentWeapon(),
            isWeaponCharging: controlSystemRef.current.isWeaponCharging(),
            position: playerEntity?.getComponent(require('@/ecs/components/Transform').Transform)?.position?.toArray()
          });
        }

        const newWeaponState = {
          currentWeapon: controlSystemRef.current.getCurrentWeapon(),
          currentSubclass: controlSystemRef.current.getCurrentSubclass(),
          isCharging: controlSystemRef.current.isWeaponCharging(),
          chargeProgress: controlSystemRef.current.getChargeProgress(),
          chargeDirection: weaponStateRef.current.chargeDirection,
          isSwinging: controlSystemRef.current.isWeaponSwinging(),
          isSpinning: (controlSystemRef.current.isWeaponCharging() || controlSystemRef.current.isCrossentropyChargingActive()) && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE,
          swordComboStep: controlSystemRef.current.getSwordComboStep(),
          isSwordCharging: controlSystemRef.current.isChargeActive(),
          isDeflecting: controlSystemRef.current.isDeflectActive(),
          isViperStingCharging: controlSystemRef.current.isViperStingChargingActive(),
          viperStingChargeProgress: controlSystemRef.current.getViperStingChargeProgress(),
          isBarrageCharging: controlSystemRef.current.isBarrageChargingActive(),
          barrageChargeProgress: controlSystemRef.current.getBarrageChargeProgress(),
          isCobraShotCharging: controlSystemRef.current.isCobraShotChargingActive(),
          cobraShotChargeProgress: controlSystemRef.current.getCobraShotChargeProgress(),
          isSkyfalling: controlSystemRef.current.isSkyfallActive(),
          isBackstabbing: controlSystemRef.current.isBackstabActive(),
          isSundering: controlSystemRef.current.isSunderActive(),
          isCorruptedAuraActive: controlSystemRef.current.isCorruptedAuraActive(),
          isFrozen: weaponStateRef.current.isFrozen
        };

        // Update the ref immediately
        weaponStateRef.current = newWeaponState;

        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (newWeaponState.currentWeapon !== prevWeapon.weapon ||
            newWeaponState.currentSubclass !== prevWeapon.subclass) {
          updatePlayerWeapon(newWeaponState.currentWeapon, newWeaponState.currentSubclass);
          prevWeaponRef.current = {
            weapon: newWeaponState.currentWeapon,
            subclass: newWeaponState.currentSubclass
          };
        }

        // Throttle React state updates to prevent infinite re-renders
        const now = Date.now();
        if (now - lastWeaponStateUpdate.current > 16) { // ~60fps throttle
          setWeaponState(newWeaponState);
          lastWeaponStateUpdate.current = now;
        }

        // Broadcast animation state changes to other players (throttled to avoid spam)
        const animationNow = Date.now();
        if (animationNow - lastAnimationBroadcast.current > 100) { // Throttle to 10 times per second
          // Determine if scythe is spinning based on weapon type and charging state
          const isScytheSpinning = newWeaponState.currentWeapon === WeaponType.SCYTHE && newWeaponState.isCharging;
          // Determine if sword is spinning during Charge
          const isSwordSpinning = newWeaponState.isSwordCharging;
          // Combine all spinning states
          const isSpinning = isScytheSpinning || isSwordSpinning;

          // Create the animation state object - only include weapon-specific fields for current weapon
          const animationStateToSend: any = {
            isCharging: newWeaponState.isCharging,
            chargeProgress: newWeaponState.chargeProgress,
            isSwinging: newWeaponState.isSwinging,
            isSpinning: isSpinning, // Broadcast spinning for scythe and sword charge
            isDeflecting: newWeaponState.isDeflecting,
            isSwordCharging: newWeaponState.isSwordCharging, // Broadcast sword charging state
            isViperStingCharging: newWeaponState.isViperStingCharging,
            viperStingChargeProgress: newWeaponState.viperStingChargeProgress,
            isBarrageCharging: newWeaponState.isBarrageCharging,
            barrageChargeProgress: newWeaponState.barrageChargeProgress,
            isBackstabbing: newWeaponState.isBackstabbing, // Broadcast backstab animation state
            // Add missing Runeblade animation states
            isSmiting: controlSystemRef.current?.isSmiteActive() || false,
            isColossusStriking: controlSystemRef.current?.isColossusStrikeActive() || false,
            isWindShearing: controlSystemRef.current?.isWindShearActive() || false,
            isWindShearCharging: controlSystemRef.current?.isWindShearChargingActive() || false,
            windShearChargeProgress: controlSystemRef.current?.getWindShearChargeProgress() || 0,
            isDeathGrasping: controlSystemRef.current?.isDeathGraspActive() || false,
            isWraithStriking: controlSystemRef.current?.isWraithStrikeActive() || false,
            isCorruptedAuraActive: controlSystemRef.current?.isCorruptedAuraActive() || false
          };

          // Only include swordComboStep for weapons that actually use it (Sword and Runeblade)
          const currentWeapon = controlSystemRef.current?.getCurrentWeapon();
          if (currentWeapon === WeaponType.SWORD || currentWeapon === WeaponType.RUNEBLADE) {
            animationStateToSend.swordComboStep = newWeaponState.swordComboStep;
          }
          broadcastPlayerAnimationState(animationStateToSend);
          lastAnimationBroadcast.current = animationNow;
        }
      }

      // Throttle damage numbers update to prevent infinite re-renders (every 33ms for smooth animation)
      const damageNumbersNow = Date.now();
      if (damageNumbersNow - lastDamageNumbersUpdate.current > 33 && onDamageNumbersUpdate) {
        const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          const newDamageNumbers = combatSystem.getDamageNumbers();
          onDamageNumbersUpdate(newDamageNumbers);
          lastDamageNumbersUpdate.current = damageNumbersNow;
        }
      }


      // Throttle camera update to prevent object reference changes (every 33ms for consistency)
      const cameraNow = Date.now();
      if (cameraNow - lastCameraUpdate.current > 33 && onCameraUpdate) {
        onCameraUpdate(camera, state.size);
        lastCameraUpdate.current = cameraNow;
      }

      // Log object pool and state batcher statistics periodically (every 5 seconds)
      const now = Date.now();
      if (now % 10000 < 16) { // Approximately every 5 seconds (accounting for frame rate)
        const poolStats = getPoolStats();
        const batcherStats = pvpStateBatcher.getStats();
      }

      // Update merchant system and check player proximity
      if (merchantSystemRef.current && playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          merchantSystemRef.current.update(deltaTime, transform.position);

          const merchantState = merchantSystemRef.current.getMerchantState();
          setIsMerchantNearby(merchantState.isPlayerNearby);
          setIsMerchantVisible(merchantState.isPlayerInVisibilityRange);
          setMerchantRotation(merchantState.rotation);

          // Auto-show merchant UI when player gets close (but allow manual toggle)
          if (merchantState.isPlayerNearby && !isMerchantNearbyRef.current) {
            // Player just entered range - show UI
            onMerchantUIUpdate?.(true);
          } else if (!merchantState.isPlayerNearby && isMerchantNearbyRef.current) {
            // Player just left range - hide UI
            onMerchantUIUpdate?.(false);
          }

          // Update the refs for next comparison
          isMerchantNearbyRef.current = merchantState.isPlayerNearby;
          isMerchantVisibleRef.current = merchantState.isPlayerInVisibilityRange;
        }
      }

      // Throttle game state update to prevent infinite re-renders (every 100ms)
      const gameStateNow = Date.now();
      if (gameStateNow - lastGameStateUpdate.current > 100 && onGameStateUpdate && playerEntityRef.current !== null && engineRef.current && controlSystemRef.current) {
        const world = engineRef.current.getWorld();
        const actualPlayerEntity = world.getEntity(playerEntityRef.current);
        if (actualPlayerEntity) {
          const healthComponent = actualPlayerEntity.getComponent(Health);
          const shieldComponent = actualPlayerEntity.getComponent(Shield);
          if (healthComponent) {
            const gameState = {
              playerHealth: healthComponent.currentHealth,
              maxHealth: healthComponent.maxHealth,
              playerShield: shieldComponent ? shieldComponent.currentShield : 0,
              maxShield: shieldComponent ? shieldComponent.maxShield : 0,
              currentWeapon: controlSystemRef.current.getCurrentWeapon(),
              currentSubclass: controlSystemRef.current.getCurrentSubclass(),
              // Add mana information for weapons that use mana
              mana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? currentMana : 0,
              maxMana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? maxMana : 0
            };
            onGameStateUpdate(gameState);

            // Update multiplayer health and shield
            updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
            if (shieldComponent) {
              updatePlayerShield(socket?.id || '', shieldComponent.currentShield, shieldComponent.maxShield);
            }
            lastGameStateUpdate.current = gameStateNow;
          }
        }
      }

      // Process pending summoned unit damage events
      const pendingDamage = (window as any).pendingSummonedUnitDamage;
      if (pendingDamage && pendingDamage.length > 0) {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          for (const damageEvent of pendingDamage) {
            combatSystem.applySummonedUnitDamage(
              damageEvent.unitId,
              damageEvent.damage,
              damageEvent.sourcePlayerId
            );
          }
        }
        // Clear processed events
        (window as any).pendingSummonedUnitDamage = [];
      }

      // State updates are handled individually above
    }
  });

  // Initialize game setup after engine is ready
  useEffect(() => {
    if (!engineRef.current || !engineReady) {
      console.log('🔍 CoopGameScene: Waiting for engine to be ready...', {
        hasEngine: !!engineRef.current,
        engineReady
      });
      return;
    }

    console.log('✅ CoopGameScene: Engine ready, setting up player and control system...');

    // Create a PVP damage callback that maps local ECS entity IDs back to server player IDs
    const damagePlayerWithMapping = (entityId: string, damage: number, damageType?: string, isCritical?: boolean) => {
      // Find the server player ID that corresponds to this local ECS entity ID
      const numericEntityId = parseInt(entityId);
      let serverPlayerId: string | null = null;

      serverPlayerEntities.current.forEach((localEntityId, playerId) => {
        if (localEntityId === numericEntityId) {
          serverPlayerId = playerId;
        }
      });

      if (serverPlayerId) {
        broadcastPlayerDamage(serverPlayerId, damage, damageType, isCritical);
      }
    };

    // Store in ref for access from JSX
    damagePlayerCallbackRef.current = damagePlayerWithMapping;

    const { player, controlSystem } = setupCoopGame(
      engineRef.current,
      scene,
      camera as PerspectiveCamera,
      gl,
      damagePlayerWithMapping,
      damageEnemy,
      selectedWeapons,
      skillPointData,
      cameraSystemRef
    );

    // Initialize merchant system
    const merchantPosition = new Vector3(16, 0, 8); // Same position as in Environment.tsx
    const merchantSystem = new MerchantSystem(merchantPosition);
    merchantSystemRef.current = merchantSystem;

    // Set control system reference for damage calculations (needed for weapon passives)
    setControlSystem(controlSystem);

    // Pass control system to parent for UI cooldown updates
    if (onControlSystemUpdate) {
      onControlSystemUpdate(controlSystem);
    }

    // Set up PVP callbacks (AFTER playerEntity is set)
    controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
      // NOTE: Projectile broadcasting is now handled by setProjectileCreatedCallback
      // This callback only handles visual effects to avoid duplicate damage

      // Trigger perfect shot visual effect if it was a perfect shot
      if (isPerfectShot) {

        // Get current player position from the engine
        const currentPlayerEntity = engineRef.current?.getWorld().getEntity(playerEntityRef.current!);
        if (currentPlayerEntity) {
          const transform = currentPlayerEntity.getComponent(Transform);
          if (transform) {
            // Get camera direction for effect direction
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();

            // Apply same downward compensation as projectile system
            const compensationAngle = Math.PI / 12; // 30 degrees
            const cameraRight = new Vector3();
            cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
            const rotationMatrix = new Matrix4();
            rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
            direction.applyMatrix4(rotationMatrix);
            direction.normalize();

            // Create perfect shot effect
            const effectId = createPowershotEffect(
              transform.position.clone(),
              direction,
              controlSystem.getCurrentSubclass(),
              true, // isPerfectShot
              true  // isElementalShotsUnlocked
            );
          }
        }
      }
    });


    // Set up Viper Sting callback
    controlSystem.setViperStingCallback((position, direction) => {
      broadcastPlayerAbility('viper_sting', position, direction);
    });

    // Set up Barrage callback
    controlSystem.setBarrageCallback((position, direction) => {
      broadcastPlayerAbility('barrage', position, direction);
    });

    // Set up Frost Nova callback
    controlSystem.setFrostNovaCallback((position, direction) => {
      broadcastPlayerAbility('frost_nova', position, direction);
    });

    // Set up Summon Totem callback
    controlSystem.setSummonTotemCallback((position) => {
      // Broadcast to other players first
      broadcastPlayerAbility('summon_totem', position);

      // Trigger local totem creation via PVPSummonTotemManager with healing callback
      if (socket?.id && (window as any).triggerGlobalSummonTotem) {
        (window as any).triggerGlobalSummonTotem(
          position,
          undefined, // Let PVPSummonTotemManager handle enemy data
          undefined, // Let PVPSummonTotemManager handle damage callback
          undefined, // Let PVPSummonTotemManager handle effects
          undefined, // Let PVPSummonTotemManager handle active effects
          undefined, // Let PVPSummonTotemManager handle damage numbers
          undefined, // Let PVPSummonTotemManager handle damage number ID
          (healAmount: number, targetPlayerId?: string) => {
            // Heal callback - broadcast healing to specific player or all nearby players
            if (targetPlayerId && player && socket && currentRoomId) {
              const transform = player.getComponent(Transform);
              if (transform) {
                // Broadcast single-target healing (totem heals specific player)
                socket.emit('player-healing', {
                  roomId: currentRoomId,
                  healingAmount: healAmount,
                  healingType: 'summon_totem',
                  position: {
                    x: transform.position.x,
                    y: transform.position.y,
                    z: transform.position.z
                  },
                  targetPlayerId: targetPlayerId, // Heal the specific target player
                  sourcePlayerId: socket.id
                });

                // If healing the local player, apply it immediately
                if (targetPlayerId === socket.id) {
                  const healthComponent = player.getComponent(Health);
                  if (healthComponent) {
                    healthComponent.heal(healAmount);
                  }
                }
              }
            }
          },
          socket.id  // Pass caster ID
        );
      }
    });


    // Set up Cloudkill callback with target position capture
    controlSystem.setCloudkillCallback((position, direction) => {
      // First, get the target positions that will be hit by cloudkill
      const targetPositions = getCloudkillTargetPositions(position, socket?.id || '');

      // Broadcast to other players with target positions
      broadcastPlayerAbility('cloudkill', position, direction, undefined, { targetPositions });

      // Also trigger local CloudkillManager for the casting player
      if (socket?.id) {
        triggerGlobalCloudkill(position, socket.id);
      }
    });

    // Set up Cobra Shot callback (for local visual effects only - projectile is handled via onProjectileCreatedCallback)
    controlSystem.setCobraShotCallback((position, direction) => {
      // Don't broadcast as ability - the projectile is already broadcast via onProjectileCreatedCallback
    });

    // Set up Charge callback
    controlSystem.setChargeCallback((position, direction) => {
      // Store charge direction for trail effect
      setWeaponState(prev => ({
        ...prev,
        chargeDirection: direction.clone()
      }));
      // Broadcast as ability for state management
      broadcastPlayerAbility('charge', position, direction);
      // Also broadcast as attack for animation
      broadcastPlayerAttack('sword_charge_start', position, direction, {
        isSwordCharging: true
      });
    });



    // Set up Skyfall callback
    controlSystem.setSkyfallCallback((position, direction) => {
      broadcastPlayerAbility('skyfall', position, direction);
    });

    // Set up Backstab callback
    controlSystem.setBackstabCallback((position, direction, damage, isBackstab) => {
      broadcastPlayerAbility('backstab', position, direction);
      // Note: Animation state is now broadcasted automatically in the game loop
    });

    // Set up Sunder callback
    controlSystem.setSunderCallback((position, direction, damage, stackCount) => {
      broadcastPlayerAbility('sunder', position, direction);
      // Note: Animation state is now broadcasted automatically in the game loop
    });

    // Set up SabreReaperMistEffect callback for Stealth ability
    controlSystem.setCreateSabreMistEffectCallback((position: Vector3) => {

      const effectId = `mist_${Date.now()}_${Math.random()}`;
      const newEffect = {
        id: effectId,
        position: position.clone(),
        startTime: Date.now()
      };

      setActiveMistEffects(prev => {
        const newEffects = [...prev, newEffect];
        return newEffects;
      });

      // Remove effect after duration (1 second)
      setTimeout(() => {
        setActiveMistEffects(prev => {
          const filtered = prev.filter(effect => effect.id !== effectId);
          return filtered;
        });
      }, 1000);
    });

    // Set up broadcast callback for Sabre Reaper Mist effects
    controlSystem.setBroadcastSabreMistCallback((position: Vector3, effectType: 'stealth' | 'skyfall') => {
      if (broadcastPlayerEffect) {
        broadcastPlayerEffect({
          type: 'mist',
          effectType,
          position: { x: position.x, y: position.y, z: position.z },
          duration: 1000
        });
      }
    });

    // Set up callback for creating local debuff effects
    controlSystem.setCreateLocalDebuffCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number) => {
      createPvpDebuffEffect(playerId, debuffType, position, duration);
    });

    // Set up Debuff callback for broadcasting freeze/slow effects
    controlSystem.setDebuffCallback((targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, position: Vector3) => {

      // Find the server player ID that corresponds to this local ECS entity ID
      let targetPlayerId: string | null = null;
      serverPlayerEntities.current.forEach((localEntityId, playerId) => {
        if (localEntityId === targetEntityId) {
          targetPlayerId = playerId;
        }
      });

      if (targetPlayerId && broadcastPlayerDebuff) {
        broadcastPlayerDebuff(targetPlayerId, debuffType, duration, {
          position: { x: position.x, y: position.y, z: position.z }
        });
      }
    });

    // Set up enemy status effect callback for co-op mode
    controlSystem.setApplyEnemyStatusEffectCallback((enemyId: string, effectType: string, duration: number) => {
      if (applyStatusEffect) {
        applyStatusEffect(enemyId, effectType, duration);
      }
    });

    // Set up multiplayer context reference for ControlSystem stealth broadcasting
    (window as any).multiplayerContext = {
      broadcastPlayerStealth,
      broadcastPlayerDamage,
      broadcastPlayerHealing,
      broadcastPlayerKnockback
    };

    // Set up global control system reference for tower targeting
    (window as any).controlSystemRef = controlSystemRef;

    // Set up projectile creation callback
    controlSystem.setProjectileCreatedCallback((projectileType, position, direction, config) => {
      const animationData: any = {};

      // Add charge progress for bow projectiles
      if (projectileType.includes('arrow') || projectileType.includes('bolt')) {
        animationData.chargeProgress = controlSystem.getChargeProgress();
      }

      // Add projectile config data for special effects (like Cryoflame)
      animationData.projectileConfig = config;

      broadcastPlayerAttack(projectileType, position, direction, animationData);
    });

    // Melee attack sounds are now handled through animation state broadcasting only

    // Set up Reanimate callback
    controlSystem.setReanimateCallback(() => {
      if (reanimateRef.current) {
        reanimateRef.current.triggerHealingEffect();
      }

      // Broadcast Reanimate ability to other players
      if (player) {
        const transform = player.getComponent(Transform);
        if (transform) {
          const direction = new Vector3();
          camera.getWorldDirection(direction);
          direction.normalize();

          broadcastPlayerAbility('reanimate', transform.position, direction);

          // Broadcast Reanimate healing to ALL nearby players (within 5 units)
          // The server will determine which players are within range and heal them
          if (socket && currentRoomId) {
            socket.emit('heal-nearby-allies', {
              roomId: currentRoomId,
              healAmount: 60,
              abilityType: 'reanimate',
              position: {
                x: transform.position.x,
                y: transform.position.y,
                z: transform.position.z
              },
              radius: 5.0 // 5 units radius
            });
          }
        }
      }
    });

    // Set up Smite callback
    controlSystem.setSmiteCallback((position: Vector3, direction: Vector3, onDamageDealt?: (totalDamage: number) => void) => {
      // Create local Smite effect
      createPvpSmiteEffect(socket?.id || '', position, onDamageDealt);

      // Broadcast Smite ability to other players
      broadcastPlayerAbility('smite', position, direction);
    });

    // Set up damage numbers callback for healing effects
    controlSystem.setDamageNumbersCallback((damageNumbers) => {
      if (onDamageNumbersUpdate) {
        onDamageNumbersUpdate(damageNumbers);
      }
    });

    // Incoming damage display is now handled directly in handlePlayerDamaged to avoid R3F issues

    // Set up healing broadcast callback for PVP and co-op
    controlSystem.setBroadcastHealingCallback((healingAmount, healingType, position, targetPlayerId) => {
      broadcastPlayerHealing(healingAmount, healingType, position, targetPlayerId);
    });

    // Set up Colossus Strike callback
    controlSystem.setColossusStrikeCallback((position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {
      // Create local Colossus Strike effect with damage
      createPvpColossusStrikeEffect(socket?.id || '', position, damage, onDamageDealt);

      // Broadcast Colossus Strike ability to other players
      broadcastPlayerAbility('colossusStrike', position, direction, undefined, { damage });
    });

    // Set up Wind Shear callback
    controlSystem.setWindShearCallback((position: Vector3, direction: Vector3) => {
      // Create local Wind Shear projectile effect
      createPvpWindShearEffect(socket?.id || '', position, direction);

      // Broadcast Wind Shear ability to other players
      broadcastPlayerAbility('windShear', position, direction);
    });

    // Set the local socket ID for the control system
    if (socket?.id) {
      controlSystem.setLocalSocketId(socket.id);
    }

    // Set up WindShear Tornado callback
    controlSystem.setWindShearTornadoCallback((playerId: string, duration: number) => {
      // Create local tornado effect
      createPvpWindShearTornadoEffect(playerId, duration);

      // Always broadcast tornado effect to other players when windshear is used
      if (socket?.id) {
        // Get current player position for broadcasting (should be local player position)
        const localPlayer = players.get(socket.id);
        if (localPlayer) {
          broadcastPlayerTornadoEffect(socket.id, {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
          }, duration);
        }
      }
    });

    // Set up DeathGrasp callback
    controlSystem.setDeathGraspCallback((position: Vector3, direction: Vector3) => {

      // Create local DeathGrasp projectile effect
      createPvpDeathGraspEffect(socket?.id || '', position, direction);

      // Broadcast DeathGrasp ability to other players
      broadcastPlayerAbility('deathgrasp', position, direction);
    });

    // Set up WraithStrike callback
    controlSystem.setWraithStrikeCallback((position: Vector3, direction: Vector3) => {

      // Broadcast WraithStrike ability to other players
      broadcastPlayerAbility('wraith_strike', position, direction);
    });

    // Set up Haunted Soul Effect callback (for WraithStrike)
    controlSystem.setHauntedSoulEffectCallback((position: Vector3) => {
      createPvpHauntedSoulEffect(position);
    });


    // Set up mana callbacks for Runeblade
    controlSystem.setConsumeManaCallback(consumeMana);
    controlSystem.setCheckManaCallback(hasMana);

    // Update player entity with correct socket ID for team validation
    if (socket?.id) {
      player.userData = player.userData || {};
      player.userData.playerId = socket.id;
    }

    setPlayerEntity(player);
    playerEntityRef.current = player.id;
    controlSystemRef.current = controlSystem;

    console.log('🎮 CoopGameScene: Player and control system setup complete', {
      playerEntityId: player.id,
      hasControlSystem: !!controlSystem,
      socketId: socket?.id
    });

    // Cleanup function
    return () => {
      console.log('🧹 CoopGameScene: Cleaning up player and control system...');
      setPlayerEntity(null);
      playerEntityRef.current = null;
      controlSystemRef.current = null;
    };
  }, [engineReady, selectedWeapons, socket?.id]); // Use socket?.id instead of socket to prevent unnecessary re-renders

  // Sync skill point data with control system when it changes
  useEffect(() => {
    if (controlSystemRef.current && skillPointData) {
      console.log('🎯 CoopGameScene: Syncing skill point data with control system', skillPointData);
      controlSystemRef.current.setSkillPointData(skillPointData);
    }
  }, [skillPointData]);

  // Expose damage number completion handler for parent component
  useEffect(() => {
    if (onDamageNumberComplete) {
      // Store the completion handler in a way the parent can access it
      (window as any).handleDamageNumberComplete = (id: string) => {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.removeDamageNumber(id);
        }
      };
    }
  }, [onDamageNumberComplete]);

  // Real-time enemy data for Summon Totem Manager (not memoized to get real-time positions)
  const summonTotemEnemyData = Array.from(players.values()).filter((player: Player) => player.id !== socket?.id).map((player: Player) => ({
    id: player.id,
    position: new Vector3(player.position.x, player.position.y, player.position.z),
    health: player.health
  }));

  return (
    <>
      {/* Don't render game world if game hasn't started */}
      {!gameStarted ? null : (
        <>
          {/* Environment (Sky, Planet, Mountains, Pillars, Pedestal) - No level progression in COOP */}
      <Environment
        level={1}
        world={engineRef.current?.getWorld()}
        camera={camera as PerspectiveCamera}
        enableLargeTree={true}
        isPVP={false} // COOP mode
        merchantRotation={merchantRotation}
        showMerchant={isMerchantVisible}
      />

      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Enhanced Ground with textures and ambient occlusion */}
      <EnhancedGround radius={29} height={1} level={1} />

      {/* Main Player Dragon Unit Renderer */}
      {(() => {
        const shouldRender = playerEntity && engineRef.current;
        console.log('🎮 CoopGameScene DragonRenderer render check:', {
          shouldRender,
          playerEntityId: playerEntity?.id,
          engineRunning: engineRef.current?.isEngineRunning(),
          selectedWeapons
        });
        return shouldRender;
      })() && (
        <DragonRenderer
          entityId={playerEntity.id}
          position={playerPosition}
          realTimePositionRef={realTimePlayerPositionRef}
          world={engineRef.current!.getWorld()}
          currentWeapon={weaponState.currentWeapon}
          currentSubclass={weaponState.currentSubclass}
          isCharging={weaponState.isCharging}
          chargeProgress={weaponState.chargeProgress}
          chargeDirection={weaponState.chargeDirection}
          isSwinging={weaponState.isSwinging}
          isSpinning={weaponState.isSpinning}
          swordComboStep={weaponState.swordComboStep}
          isSwordCharging={weaponState.isSwordCharging}
          isDeflecting={weaponState.isDeflecting}
          isViperStingCharging={weaponState.isViperStingCharging}
          viperStingChargeProgress={weaponState.viperStingChargeProgress}
          isBarrageCharging={weaponState.isBarrageCharging}
          barrageChargeProgress={weaponState.barrageChargeProgress}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          cobraShotChargeProgress={weaponState.cobraShotChargeProgress}
          isCloudkillCharging={controlSystemRef.current?.isCloudkillChargingActive() || false}
          cloudkillChargeProgress={controlSystemRef.current?.getCloudkillChargeProgress() || 0}
          isSkyfalling={weaponState.isSkyfalling}
          isBackstabbing={weaponState.isBackstabbing}
          isSundering={weaponState.isSundering}
          isSmiting={controlSystemRef.current?.isSmiteActive() || false}
          isColossusStriking={controlSystemRef.current?.isColossusStrikeActive() || false}
          isDeathGrasping={controlSystemRef.current?.isDeathGraspActive() || false}
          isWraithStriking={controlSystemRef.current?.isWraithStrikeActive() || false}
          isCorruptedAuraActive={controlSystemRef.current?.isCorruptedAuraActive() || false}
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
          isStealthing={controlSystemRef.current?.getIsStealthing() || false}
          onDamageNumbersReady={handleDamageNumbersReady}
          combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
          onHeal={(amount: number) => {
            // Handle healing for local player (Viper Sting soul steal, etc.)
            if (playerEntityRef.current !== null && engineRef.current) {
              const world = engineRef.current.getWorld();
              const playerEntity = world.getEntity(playerEntityRef.current);
              if (playerEntity) {
                const CombatSystemClass = require('@/systems/CombatSystem').CombatSystem;
                const combatSystem = world.getSystem(CombatSystemClass) as any;
                if (combatSystem && combatSystem.healImmediate) {
                  // Use CombatSystem to heal the player (this handles all the logic)
                  combatSystem.healImmediate(playerEntity, amount, playerEntity);
                  // The CombatSystem will handle updating the health component and triggering effects

                  // Broadcast healing to other players
                  broadcastPlayerHealing(amount, 'viper_sting', playerPosition);
                }
              }
            }
          }}
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
          }}
          onScytheSwingComplete={() => {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('scythe_swing', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onSwordSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onSabresSwingComplete={() => {
            controlSystemRef.current?.onSabresSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sabres_swing', playerPosition, direction);
          }}
          onRunebladeSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete(); // Reuse Sword swing complete for combo advancement
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('runeblade_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onChargeComplete={() => {
            controlSystemRef.current?.onChargeComplete();
            // Broadcast charge spin animation
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_charge_spin', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onDeflectComplete={() => {
            controlSystemRef.current?.onDeflectComplete();
          }}
          onBackstabComplete={() => {
            // Backstab animation completed - no need to broadcast as animation state is handled automatically
          }}
          onSunderComplete={() => {
            // Sunder animation completed - no need to broadcast as animation state is handled automatically
          }}
          onSmiteComplete={() => {
            controlSystemRef.current?.onSmiteComplete();
          }}
          onColossusStrikeComplete={() => {
            controlSystemRef.current?.onColossusStrikeComplete();
          }}
          onDeathGraspComplete={() => {
            controlSystemRef.current?.onDeathGraspComplete();
          }}
          onWraithStrikeComplete={() => {
            controlSystemRef.current?.onWraithStrikeComplete();
          }}
          onCorruptedAuraToggle={(active: boolean) => {
            // Update the weapon state when Corrupted Aura is toggled
            const newState = {
              ...weaponStateRef.current,
              isCorruptedAuraActive: active,
              isFrozen: weaponStateRef.current.isFrozen
            };
            weaponStateRef.current = newState;
            setWeaponState(newState);
          }}
          purchasedItems={players.get(socket?.id || '')?.purchasedItems || []}
        />
      )}

      {/* Other Players Dragon Renderers */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't render our own player twice

        // Check if player is invisible due to stealth
        const isPlayerInvisible = playerStealthStates.current.get(player.id) || false;

        // Check if player is dead
        const deathState = playerDeathStates.get(player.id);
        const isPlayerDead = deathState?.isDead || false;

        if (isPlayerInvisible) {
          return null; // Don't render invisible players
        }

        const playerState = multiplayerPlayerStates.get(player.id) || {
          isCharging: false,
          chargeProgress: 0,
          isSwinging: false,
          swordComboStep: 1 as 1 | 2 | 3,
          isSpinning: false,
          isSwordCharging: false,
          isDeflecting: false,
          isViperStingCharging: false,
          viperStingChargeProgress: 0,
          isBarrageCharging: false,
          barrageChargeProgress: 0,
          isCobraShotCharging: false,
          cobraShotChargeProgress: 0,
          isSkyfalling: false,
          isBackstabbing: false,
          // Add missing Runeblade animation states
          isSmiting: false,
          isDeathGrasping: false,
          isWraithStriking: false,
          isCorruptedAuraActive: false,
          isFrozen: false
        };

        // Get the real-time position ref for this enemy player
        const enemyPositionRef = enemyPlayerPositionRefs.current.get(player.id);

        return (
          <DragonRenderer
            key={player.id}
            entityId={parseInt(player.id.replace(/\D/g, '0'))} // Convert string ID to number
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            realTimePositionRef={enemyPositionRef}
            world={engineRef.current?.getWorld() || new World()} // Use current world or create new one
            currentWeapon={player.weapon}
            currentSubclass={player.subclass}
            isCharging={playerState.isCharging}
            chargeProgress={playerState.chargeProgress}
            isSwinging={playerState.isSwinging}
            isSpinning={playerState.isSpinning}
            swordComboStep={playerState.swordComboStep}
            isSwordCharging={playerState.isSwordCharging}
            isDeflecting={playerState.isDeflecting}
            isViperStingCharging={playerState.isViperStingCharging}
            viperStingChargeProgress={playerState.viperStingChargeProgress}
            isBarrageCharging={playerState.isBarrageCharging}
            barrageChargeProgress={playerState.barrageChargeProgress}
            isCobraShotCharging={playerState.isCobraShotCharging}
            cobraShotChargeProgress={playerState.cobraShotChargeProgress}
            isSkyfalling={playerState.isSkyfalling}
            isBackstabbing={playerState.isBackstabbing}
            isSundering={playerState.isSundering || false}
            isSmiting={playerState.isSmiting || false}
            isColossusStriking={playerState.isColossusStriking || false}
            isDeathGrasping={playerState.isDeathGrasping || false}
            isWraithStriking={playerState.isWraithStriking || false}
            isCorruptedAuraActive={playerState.isCorruptedAuraActive || false}
            isDead={isPlayerDead}
            rotation={player.rotation}
            isLocalPlayer={false}
            onBowRelease={() => {}}
            onScytheSwingComplete={() => {}}
            onSwordSwingComplete={() => {}}
            onSabresSwingComplete={() => {}}
            onRunebladeSwingComplete={() => {}}
            onBackstabComplete={() => {}}
            onSunderComplete={() => {}}
            onSmiteComplete={() => {}}
            onColossusStrikeComplete={() => {}}
            onDeathGraspComplete={() => {}}
            onWraithStrikeComplete={() => {}}
            purchasedItems={player.purchasedItems || []}
          />
        );
      })}

      {/* BOSS Enemy Renderer (Co-op Mode) */}
      {engineRef.current && Array.from(enemies.values()).map(enemy => {
        // Only render boss enemies in co-op mode
        if (enemy.isDying || enemy.type !== 'boss') return null;

        // Get the local ECS entity ID for this enemy
        const entityId = serverEnemyEntities.current.get(enemy.id);
        if (!entityId) return null; // Wait for ECS sync

        // Check if this boss is currently taunted
        const isTaunted = enemyTauntEffects.some(effect => effect.enemyId === enemy.id);

        // Get boss attack state
        const bossAttackState = bossAttackStates.get(enemy.id) || { isAttacking: false, attackingHand: null, lastAttackTime: 0 };

        // Determine boss target position for rotation
        let targetPosition: Vector3 | null = null;

        // First priority: player being attacked
        if (bossAttackState.isAttacking) {
          // Find the player being attacked by checking recent damage
          let targetPlayerId: string | null = null;

          // Check boss damage tracking to find who it's targeting
          const damageMap = new Map(); // We don't have access to this directly, so let's find the target differently

          // For now, find the closest player as the target
          let closestDistance = Infinity;
          Array.from(players.values()).forEach(player => {
            const distance = Math.sqrt(
              Math.pow(player.position.x - enemy.position.x, 2) +
              Math.pow(player.position.z - enemy.position.z, 2)
            );

            if (distance < closestDistance) {
              closestDistance = distance;
              targetPosition = new Vector3(player.position.x, player.position.y, player.position.z);
            }
          });
        } else {
          // Not attacking, still face nearest player for intimidation
          let closestDistance = Infinity;
          Array.from(players.values()).forEach(player => {
            const distance = Math.sqrt(
              Math.pow(player.position.x - enemy.position.x, 2) +
              Math.pow(player.position.z - enemy.position.z, 2)
            );

            if (distance < closestDistance) {
              closestDistance = distance;
              targetPosition = new Vector3(player.position.x, player.position.y, player.position.z);
            }
          });
        }

        return (
          <group key={enemy.id}>
            <BossRenderer
              entityId={entityId}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              world={engineRef.current!.getWorld()}
              isAttacking={bossAttackState.isAttacking}
              attackingHand={bossAttackState.attackingHand}
              targetPosition={targetPosition}
              rotation={enemy.rotation}
            />

            {/* Taunt Effect Indicator */}
            {isTaunted && (
              <TauntEffectIndicator
                position={new Vector3(enemy.position.x, enemy.position.y + 4, enemy.position.z)}
              />
            )}
          </group>
        );
      })}

      {/* Boss Summoned Skeletons (Co-op Mode) */}
      {Array.from(enemies.values()).map(enemy => {
        // Only render boss-skeleton type enemies
        if (enemy.isDying || enemy.type !== 'boss-skeleton') return null;

        return (
          <SummonedBossSkeleton
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
          />
        );
      })}

      {/* Boss Meteors */}
      {activeMeteors.map(meteor => {
        return (
          <Meteor
            key={meteor.id}
            targetPosition={meteor.targetPosition}
            onImpact={(damage, position) => {
              // Only apply damage if local player is within range
              if (playerEntity) {
                const localPlayerTransform = playerEntity.getComponent(Transform);
                if (localPlayerTransform) {
                  const playerGroundPos = new Vector3(
                    localPlayerTransform.position.x,
                    0,
                    localPlayerTransform.position.z
                  );
                  const meteorGroundPos = new Vector3(position.x, 0, position.z);
                  
                  if (playerGroundPos.distanceTo(meteorGroundPos) <= 2.99) {
                    console.log(`☄️ Meteor hit local player for ${damage} damage!`);
                    
                    // Apply damage to local player directly
                    const health = playerEntity.getComponent(Health);
                    if (health) {
                      const currentTime = Date.now() / 1000;
                      health.takeDamage(damage, currentTime, playerEntity);

                      // Create damage number for visual feedback
                      const damageNumberManager = (window as any).damageNumberManager;
                      if (damageNumberManager) {
                        const damagePosition = localPlayerTransform.getWorldPosition().clone();
                        damagePosition.y += 2; // Position above player
                        damageNumberManager.addDamageNumber(
                          damage,
                          false, // Not critical
                          damagePosition,
                          'meteor'
                        );
                      }
                    }
                  }
                }
              }
            }}
            onComplete={() => {
              // Remove meteor when it's done
              setActiveMeteors(prev => prev.filter(m => m.id !== meteor.id));
            }}
          />
        );
      })}

      {/* Other Players Health Bars */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't show health bar for local player

        // Check if player is invisible (stealth mode) - don't show health bar
        const isInvisible = playerStealthStates.current.get(player.id);
        if (isInvisible) return null;

        // Use shield values from the synchronized player data
        const shieldAmount = player.shield ?? 0;
        const maxShieldAmount = player.maxShield ?? 100;

        return (
          <PlayerHealthBar
            key={`healthbar-${player.id}`}
            playerId={player.id}
            playerName={player.name}
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            health={player.health}
            maxHealth={player.maxHealth}
            shield={shieldAmount}
            camera={camera}
            showDistance={35}
          />
        );
      })}

      {/* Boss Health Bar */}
      {Array.from(enemies.values()).map(enemy => {
        if (enemy.isDying) return null; // Don't show health bar for dying boss
        if (enemy.type !== 'boss') return null; // Only render boss (co-op mode)

        // console.log(`🏥 Boss health bar: ${enemy.id}, health: ${enemy.health}/${enemy.maxHealth}`);

        return (
          <PlayerHealthBar
            key={`boss-healthbar-${enemy.id}`}
            playerId={enemy.id}
            playerName="👹 BOSS"
            position={new Vector3(enemy.position.x, enemy.position.y + 3, enemy.position.z)} // Position above boss
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            shield={0}
            camera={camera}
            showDistance={100} // Show from very far away for boss
          />
        );
      })}

      {/* PVP Smite Effects */}
      {pvpSmiteEffects.map(effect => {
        // Prepare enemy data including BOSS and BOSS-SKELETON enemies
        const smiteEnemyData = Array.from(enemies.values())
          .filter(enemy => !enemy.isDying && (enemy.type === 'boss' || enemy.type === 'boss-skeleton'))
          .map(enemy => ({
            id: enemy.id,
            position: new Vector3(enemy.position.x, enemy.position.y, enemy.position.z),
            health: enemy.health
          }));

        return (
          <ColossusStrike
            key={`smite-${effect.id}`}
            weaponType={WeaponType.RUNEBLADE}
            position={effect.position}
            delayStart={0.25} // Delay the visual effect by 0.5 seconds
            onComplete={() => {
              // Remove effect after completion
              setPvpSmiteEffects(prev => prev.filter(e => e.id !== effect.id));
            }}
            onHit={(targetId, damage, isCritical) => {
              // Handle damage to enemies
              if (socket && currentRoomId) {
                socket.emit('player-hit-enemy', {
                  roomId: currentRoomId,
                  enemyId: targetId,
                  damage: damage,
                  isCritical: isCritical || false
                });
              }
            }}
            onDamageDealt={(damageDealt) => {
              // Convert boolean to number for healing calculation (same as Smite)
              if (effect.onDamageDealt && damageDealt) {
                // Calculate base damage for healing (same as Smite: 100)
                const baseDamage = 100;
                effect.onDamageDealt(baseDamage);
              }
            }}
            enemyData={smiteEnemyData}
            targetPlayerData={[]} // No player targets for Smite
            setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
            nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
            combatSystem={engineRef.current?.getWorld().getSystem(CombatSystem)}
          />
        );
      })}

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && (
        <>
          <UnifiedProjectileManager world={engineRef.current.getWorld()} />
          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <StunManager world={engineRef.current.getWorld()} />
          <CobraShotManager world={engineRef.current.getWorld()} />
          <DeflectShieldManager />
          <PVPSummonTotemManager
            players={players}
            localSocketId={socket?.id}
          />
          <CloudkillManager
            enemyData={Array.from(enemies.values())
              .filter(enemy => !enemy.isDying && (enemy.type === 'boss' || enemy.type === 'boss-skeleton'))
              .map(enemy => ({
                id: enemy.id,
                type: enemy.type,
                position: enemy.position,
                rotation: enemy.rotation,
                health: enemy.health,
                maxHealth: enemy.maxHealth,
                isDying: enemy.isDying
              }))}
            onHit={(targetId, damage, isCritical, position) => {
              if (socket && currentRoomId) {
                damageEnemy(targetId, damage, socket.id);
              }
            }}
            playerPosition={playerPosition}
          />
        </>
      )}
        </>
      )}

    </>
  );
}

function createCoopPlayer(world: World): any {
  // Create player entity
  const player = world.createEntity();

  // Add Transform component
  const transform = world.createComponent(Transform);
  transform.setPosition(0, 0.5, 0); // Position sphere center at radius height above ground
  player.addComponent(transform);

  // Add Movement component
  const movement = world.createComponent(Movement);
  movement.maxSpeed = 3.75; // Reduced from 8 to 3.65 for slower movement
  movement.jumpForce = 8;
  movement.friction = 0.85;
  player.addComponent(movement);

  // Add Health component with level-based max health
  const maxHealth = ExperienceSystem.getMaxHealthForLevel(1); // Start at level 1
  const health = new Health(maxHealth);
  health.enableRegeneration(2, 5); // Slower regen in COOP: 1 HP per second after 10 seconds
  player.addComponent(health);

  // Add Shield component with 250 max shield
  const shield = new Shield(100, 15, 2.5); // 250 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  // Add Collider component for environment collision and enemy damage detection
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 1.2; // Reduced collision radius for better player proximity in COOP
  collider.layer = CollisionLayer.PLAYER; // Use player layer for local player
  // Set collision mask to collide with environment and enemies only - NO player-to-player collision in COOP
  collider.setMask(CollisionLayer.ENVIRONMENT | CollisionLayer.ENEMY);
  collider.setOffset(0, 0.5, 0); // Center on player
  player.addComponent(collider);

  // Store player ID in userData for projectile source identification
  // Note: This will be updated when the socket ID becomes available
  player.userData = player.userData || {};
  player.userData.playerId = 'unknown';

  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}

function setupCoopGame(
  engine: Engine,
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  damagePlayerCallback: (playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void,
  damageEnemyCallback?: (enemyId: string, damage: number, sourcePlayerId?: string) => void,
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null,
  skillPointData?: any,
  cameraSystemRef?: React.MutableRefObject<CameraSystem | null>
): { player: any; controlSystem: ControlSystem } {
  const world = engine.getWorld();
  const inputManager = engine.getInputManager();

  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Create systems for coop mode (similar to PVP but without towers/pillars)
  const physicsSystem = new PhysicsSystem();
  const collisionSystem = new CollisionSystem(5); // 5 unit cell size for spatial hash
  const combatSystem = new CombatSystem(world);
  const renderSystem = new RenderSystem(scene, camera, renderer);
  const projectileSystem = new ProjectileSystem(world);

  // Initialize Audio System (reuse if already created for UI sounds)
  const audioSystem = (window as any).audioSystem || new AudioSystem();

  // Make audio system globally available for UI sounds (if not already set)
  if (!(window as any).audioSystem) {
    (window as any).audioSystem = audioSystem;
  }

  const controlSystem = new ControlSystem(
    camera as PerspectiveCamera,
    inputManager,
    world,
    projectileSystem,
    audioSystem,
    selectedWeapons
  );
  const cameraSystem = new CameraSystem(
    camera as PerspectiveCamera,
    inputManager,
    {
      distance: 8,
      height: 2,
      mouseSensitivity: 0.005,
      smoothing: 0.15,
    }
  );

  // Store camera system reference if ref provided
  if (cameraSystemRef) {
    cameraSystemRef.current = cameraSystem;
  }

  // Expose camera system globally for effects access
  (window as any).cameraSystem = cameraSystem;

  // Expose damage number manager globally for abilities
  (window as any).damageNumberManager = combatSystem.getDamageNumberManager();

  const interpolationSystem = new InterpolationSystem();

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  combatSystem.setCoopMode(true); // Enable cooperative mode (no player-to-player damage)

  // Set up damage callbacks
  if (damageEnemyCallback) {
    combatSystem.setEnemyDamageCallback(damageEnemyCallback);
  }
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(interpolationSystem); // Add interpolation system before render system
  world.addSystem(renderSystem);
  world.addSystem(projectileSystem);
  world.addSystem(audioSystem);
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createCoopPlayer(world);

  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();

  // Set local player entity ID for combat system damage number filtering
  combatSystem.setLocalPlayerEntityId(playerEntity.id);

  // Set weapon level based on selected weapons
  const playerLevel = selectedWeapons ? getRuneCountForWeapon(selectedWeapons.primary, 1) + getRuneCountForWeapon(selectedWeapons.secondary, 1) : 1;
  controlSystem.setWeaponLevel(playerLevel);

  // Set skill point data for ability unlocks
  if (skillPointData) {
    controlSystem.setSkillPointData(skillPointData);
  }

  // Preload weapon sound effects
  audioSystem.preloadWeaponSounds().catch((error: any) => {
    console.warn('Failed to preload weapon sounds:', error);
  });

  return { player: playerEntity, controlSystem };
}

