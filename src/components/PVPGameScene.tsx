'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler, Group } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';
import { useMultiplayer, Player } from '@/contexts/MultiplayerContext';

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Tower } from '@/ecs/components/Tower';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';
import { Entity } from '@/ecs/Entity';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem } from '@/systems/ControlSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { TowerSystem } from '@/systems/TowerSystem';
import { SummonedUnitSystem } from '@/systems/SummonedUnitSystem';
import { InterpolationSystem } from '@/systems/InterpolationSystem';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';
import Reanimate from '@/components/weapons/Reanimate';
import Runeblade from '@/components/weapons/Runeblade';
import Smite from '@/components/weapons/Smite';
import DeathGraspProjectile from '@/components/weapons/DeathGraspProjectile';
import DeathGraspPull from '@/components/weapons/DeathGraspPull';
import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import StunManager from '@/components/weapons/StunManager';
import FrostNova from '@/components/weapons/FrostNova';
import CobraShotManager from '@/components/projectiles/CobraShotManager';
import { CobraShotProjectile } from '@/components/projectiles/CobraShot';
import ViperStingManager from '@/components/projectiles/ViperStingManager';
import CloudkillManager, { triggerGlobalCloudkill } from '@/components/projectiles/CloudkillManager';
import VenomEffect from '@/components/projectiles/VenomEffect';
import DebuffIndicator from '@/components/ui/DebuffIndicator';
import FrozenEffect from '@/components/weapons/FrozenEffect';
import StunnedEffect from '@/components/weapons/StunnedEffect';
import SabreReaperMistEffect from '@/components/weapons/SabreReaperMistEffect';
import HauntedSoulEffect from '@/components/weapons/HauntedSoulEffect';
import ColossusStrike from '@/components/weapons/ColossusStrike';
import CrossentropyExplosion from '@/components/projectiles/CrossentropyExplosion';
import {
  OptimizedPVPCobraShotManager,
  OptimizedPVPBarrageManager,
  OptimizedPVPFrostNovaManager,
  OptimizedPVPViperStingManager,
  OptimizedPVPCrossentropyManager,
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
import DivineStormManager, { triggerGlobalDivineStorm } from '@/components/weapons/DivineStormManager';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import TowerRenderer from '@/components/towers/TowerRenderer';
import SummonedUnitRenderer from '@/components/SummonedUnitRenderer';
import EnhancedGround from '@/components/environment/EnhancedGround';

// PVP-specific Cobra Shot Manager for hitting players
interface PVPCobraShotManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerVenomed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

// PVP-specific Barrage Manager for hitting players with slow effect
interface PVPBarrageManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerSlowed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

// PVP-specific FrostNova Manager for hitting players with freeze effect
interface PVPFrostNovaManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerFrozen: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

// Old PVP managers removed - using optimized versions with object pooling

// Old PVPBarrageManager removed - using optimized version

// Old PVPFrostNovaManager removed - using optimized version

import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import { triggerGlobalBarrage } from '@/components/projectiles/BarrageManager';
import { triggerGlobalTidalWave } from '@/components/projectiles/TidalWaveManager';
import PVPTidalWaveManager from '@/components/projectiles/PVPTidalWaveManager';
import { ExperienceSystem } from '@/utils/ExperienceSystem';

// PVP Reanimate Effect Component (standalone healing effect)
const PVPReanimateEffect: React.FC<{ position: Vector3; onComplete: () => void }> = React.memo(({ position, onComplete }) => {
  const [time, setTime] = useState(0);
  const duration = 1.5;
  
  useFrame((_, delta) => {
    setTime(prev => {
      const newTime = prev + delta;
      if (newTime >= duration) {
        onComplete();
      }
      return newTime;
    });
  });

  const progress = time / duration;
  const opacity = Math.sin(progress * Math.PI);
  const scale = 1 + progress * 2;

  return (
    <group position={position.toArray()}>
      {/* Rising healing rings */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, progress * 2 + i * 0.5, 0]}
          rotation={[Math.PI / 2, 0, time * 2]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            color="#60FF38"
            emissive="#60FF38"
            emissiveIntensity={1.5}
            transparent
            opacity={opacity * (1 - i * 0.2)}
          />
        </mesh>
      ))}

      {/* Central healing glow */}
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#60FF38"
          emissive="#60FF38"
          emissiveIntensity={2}
          transparent
          opacity={opacity * 0.3}
        />
      </mesh>

      {/* Healing particles */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.75 + progress;
        const yOffset = progress * 2;
        
        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle + time * 2) * radius/1.1,
              yOffset + Math.sin(time * 3 + i) * 0.5,
              Math.sin(angle + time * 2) * radius/1.1
            ]}
          >
            <sphereGeometry args={[0.095, 8, 8]} />
            <meshStandardMaterial
              color="#60FF38"
              emissive="#60FF38"
              emissiveIntensity={2.5}
              transparent
              opacity={opacity * 0.8}
            />
          </mesh>
        );
      })}

      {/* Light source */}
      <pointLight
        color="#60FF38"
        intensity={2 * opacity}
        distance={5}
        decay={2}
      />
    </group>
  );
});

PVPReanimateEffect.displayName = 'PVPReanimateEffect';

interface PVPGameSceneProps {
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
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
}

export function PVPGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate, onExperienceUpdate, selectedWeapons }: PVPGameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const {
    players,
    setPlayers,
    towers,
    summonedUnits,
    gameStarted,
    isInRoom,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    broadcastPlayerDamage, // New function for PVP damage
    broadcastPlayerEffect, // For broadcasting venom effects
    broadcastPlayerDebuff, // For broadcasting debuff effects
    broadcastPlayerStealth, // For broadcasting stealth state
    damageTower, // New function for tower damage
    damageSummonedUnit, // New function for summoned unit damage
    damageEnemy, // New function for enemy damage with source player tracking
    socket
  } = useMultiplayer();
  
  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const towerSystemRef = useRef<TowerSystem | null>(null);
  // summonedUnitSystemRef removed - using server-authoritative summoned units
  const reanimateRef = useRef<ReanimateRef>(null);
  const isInitialized = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);

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
  
  // Track server tower to local ECS entity mapping
  const serverTowerEntities = useRef<Map<string, number>>(new Map());

  // Track server summoned unit to local ECS entity mapping
  const serverSummonedUnitEntities = useRef<Map<string, number>>(new Map());

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

  // Sync server summoned units to ECS entities for targeting and collision
  const syncSummonedUnitsToECS = useCallback(() => {
    if (!engineRef.current) return;

    const world = engineRef.current.getWorld();
    const currentUnits = Array.from(summonedUnits.values());
    const currentEntityIds = new Set(serverSummonedUnitEntities.current.values());

    // Remove entities for units that no longer exist on server
    for (const [unitId, entityId] of Array.from(serverSummonedUnitEntities.current.entries())) {
      const unitStillExists = currentUnits.some(unit => unit.unitId === unitId);
      if (!unitStillExists) {
        world.destroyEntity(entityId);
        serverSummonedUnitEntities.current.delete(unitId);
      }
    }

    // Create or update entities for current server units
    for (const unit of currentUnits) {
      let entityId = serverSummonedUnitEntities.current.get(unit.unitId);
      let entity: Entity;

      // Handle dead or inactive units - remove their ECS entities
      if (!unit.isActive || unit.isDead) {
        if (entityId) {
          world.destroyEntity(entityId);
          serverSummonedUnitEntities.current.delete(unit.unitId);
        }
        continue;
      }

      if (!entityId) {
        // Create new entity for this summoned unit
        entity = world.createEntity();
        entityId = entity.id;
        serverSummonedUnitEntities.current.set(unit.unitId, entityId);

        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(unit.position.x, unit.position.y, unit.position.z);
        entity.addComponent(transform);

        // Add SummonedUnit component
        const summonedUnitComponent = world.createComponent(SummonedUnit);
        summonedUnitComponent.ownerId = unit.ownerId;
        summonedUnitComponent.unitId = unit.unitId;
        summonedUnitComponent.maxHealth = unit.maxHealth;
        summonedUnitComponent.isActive = unit.isActive;
        summonedUnitComponent.isDead = unit.isDead;
        entity.addComponent(summonedUnitComponent);

        // Add Health component
        const health = new Health(unit.maxHealth);
        health.currentHealth = unit.health;
        health.isDead = unit.isDead;
        entity.addComponent(health);

        // Add Collider component for targeting and damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.5;
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so towers and players can target them
        collider.setOffset(0, 0.6, 0); // Center on unit
        entity.addComponent(collider);

        // Store server unit ID in userData for damage routing
        entity.userData = entity.userData || {};
        entity.userData.serverUnitId = unit.unitId;
        entity.userData.serverUnitOwnerId = unit.ownerId;

      } else {
        // Update existing entity
        const existingEntity = world.getEntity(entityId);
        if (existingEntity) {
          entity = existingEntity;
          // Update transform
          const transform = entity.getComponent(Transform);
          if (transform) {
            transform.setPosition(unit.position.x, unit.position.y, unit.position.z);
          }

          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = unit.health;
            health.isDead = unit.isDead;
          }

          // Update summoned unit component
          const summonedUnitComponent = entity.getComponent(SummonedUnit);
          if (summonedUnitComponent) {
            summonedUnitComponent.isActive = unit.isActive;
            summonedUnitComponent.isDead = unit.isDead;
          }
        }
      }
    }
  }, [summonedUnits]);

  // Sync summoned units to ECS when they change
  useEffect(() => {
    syncSummonedUnitsToECS();
  }, [summonedUnits]);

  // Sync server towers to ECS entities for targeting and collision
  const syncTowersToECS = useCallback(() => {
    if (!engineRef.current) return;

    const world = engineRef.current.getWorld();
    const currentTowers = Array.from(towers.values());

    // Remove entities for towers that no longer exist on server
    for (const [towerId, entityId] of Array.from(serverTowerEntities.current.entries())) {
      const towerStillExists = currentTowers.some(tower => tower.id === towerId);
      if (!towerStillExists) {
        world.destroyEntity(entityId);
        serverTowerEntities.current.delete(towerId);
      }
    }

    // Create or update entities for current server towers
    for (const tower of currentTowers) {
      let entityId = serverTowerEntities.current.get(tower.id);
      let entity: Entity;

      if (!entityId) {
        // Create new entity for this tower
        entity = world.createEntity();
        entityId = entity.id;
        serverTowerEntities.current.set(tower.id, entityId);

        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(tower.position.x, tower.position.y, tower.position.z);
        entity.addComponent(transform);

        // Add Tower component
        const towerComponent = world.createComponent(Tower);
        towerComponent.ownerId = tower.ownerId;
        towerComponent.towerIndex = tower.towerIndex;
        towerComponent.isActive = !tower.isDead;
        towerComponent.isDead = tower.isDead || false;
        entity.addComponent(towerComponent);

        // Add Health component
        const health = new Health(tower.maxHealth);
        health.currentHealth = tower.health;
        health.isDead = tower.isDead || false;
        entity.addComponent(health);

        // Add Collider component for targeting
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 1.5; // Tower collision radius
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so they can be targeted
        collider.setOffset(0, 1.0, 0); // Center on tower
        entity.addComponent(collider);

        // Store server tower ID in userData
        entity.userData = entity.userData || {};
        entity.userData.serverTowerId = tower.id;
        entity.userData.serverTowerOwnerId = tower.ownerId;

      } else {
        // Update existing entity
        const existingEntity = world.getEntity(entityId);
        if (existingEntity) {
          entity = existingEntity;
          // Update transform
          const transform = entity.getComponent(Transform);
          if (transform) {
            transform.setPosition(tower.position.x, tower.position.y, tower.position.z);
          }

          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = tower.health;
            health.isDead = tower.isDead || false;
          }

          // Update tower component
          const towerComponent = entity.getComponent(Tower);
          if (towerComponent) {
            towerComponent.isActive = !tower.isDead;
            towerComponent.isDead = tower.isDead || false;
          }
        }
      }
    }
  }, [towers]);

  // Sync towers to ECS when they change
  useEffect(() => {
    syncTowersToECS();
  }, [towers]);

  // Experience system state
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [lastExperienceAwardTime, setLastExperienceAwardTime] = useState(0);

// Mana system state for weapons (persistent across weapon switches)
const [weaponManaResources, setWeaponManaResources] = useState<{
  [key in WeaponType]: number;
}>({
  [WeaponType.SCYTHE]: 250,
  [WeaponType.SWORD]: 0,
  [WeaponType.BOW]: 0,
  [WeaponType.SABRES]: 0,
  [WeaponType.RUNEBLADE]: 150
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
    onDamageDealt?: (damageDealt: boolean) => void;
  }>>([]);
  const nextSmiteEffectId = useRef(0);

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

  // PVP DeathGrasp Pull Management
  const [pvpDeathGraspPulls, setPvpDeathGraspPulls] = useState<Array<{
    id: number;
    targetPlayerId: string;
    casterPosition: Vector3;
    startTime: number;
    duration: number;
    isActive: boolean;
  }>>([]);
  const nextDeathGraspPullId = useRef(0);
  
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

  // PVP Colossus Strike Effect Management
  const [pvpColossusStrikeEffects, setPvpColossusStrikeEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    casterPosition?: Vector3;
    startTime: number;
    duration: number;
    rageSpent?: number;
  }>>([]);
  const nextColossusStrikeEffectId = useRef(0);

  // PVP Crossentropy Explosion Effect Management
  const [pvpCrossentropyExplosions, setPvpCrossentropyExplosions] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextCrossentropyExplosionId = useRef(0);

  // PVP Haunted Soul Effect Management
  const [pvpHauntedSoulEffects, setPvpHauntedSoulEffects] = useState<Array<{
    id: number;
    position: Vector3;
    startTime: number;
  }>>([]);
  const nextHauntedSoulEffectId = useRef(0);
  
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
  const createPvpSmiteEffect = useCallback((playerId: string, position: Vector3, onDamageDealt?: (damageDealt: boolean) => void) => {

    const smiteEffect = {
      id: nextSmiteEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 900, // 0.9 seconds smite duration (matches Smite component)
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

  // Function to create death grasp pull effect on PVP players
  const createPvpDeathGraspPull = useCallback((targetPlayerId: string, casterPosition: Vector3) => {

    const deathGraspPull = {
      id: nextDeathGraspPullId.current++,
      targetPlayerId,
      casterPosition: casterPosition.clone(),
      startTime: Date.now(),
      duration: 600, // 0.6 seconds pull duration (matches DeathGraspPull component)
      isActive: true
    };


    // Use batched updates for death grasp pulls
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'deathgrasp',
      setter: setPvpDeathGraspPulls,
      data: deathGraspPull
    }]);

    // Clean up death grasp pull after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'deathgrasp',
        setter: setPvpDeathGraspPulls,
        filterId: deathGraspPull.id
      }]);
    }, deathGraspPull.duration);
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

  // Function to create Colossus Strike effect on PVP players
  const createPvpColossusStrikeEffect = useCallback((playerId: string, position: Vector3, rageSpent: number = 40, casterPosition?: Vector3) => {

    const colossusStrikeEffect = {
      id: nextColossusStrikeEffectId.current++,
      playerId,
      position: position.clone(),
      casterPosition: casterPosition?.clone(), // Store caster position for damage calculation
      startTime: Date.now(),
      duration: 900, // 0.9 seconds Colossus Strike duration (matches Sword animation)
      rageSpent // Store the rage spent for damage calculation
    };

    // Use batched updates for Colossus Strike effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'colossusStrike',
      setter: setPvpColossusStrikeEffects,
      data: colossusStrikeEffect
    }]);

    // Clean up Colossus Strike effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'colossusStrike',
        setter: setPvpColossusStrikeEffects,
        filterId: colossusStrikeEffect.id
      }]);
    }, colossusStrikeEffect.duration);
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

  const createPvpVenomEffect = useCallback((playerId: string, position: Vector3) => {
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
        broadcastPlayerDamage(playerId, venomDamagePerSecond);
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
  const handlePlayerDeath = useCallback((deadPlayerId: string, killerId?: string) => {
    console.log(`💀 Player ${deadPlayerId} died! Killer: ${killerId || 'unknown'}`);

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

    // Note: Experience rewards for kills are handled in handlePlayerDamaged
    // This function only handles the death of the local player

    // Start respawn timer (5 seconds)
    setTimeout(() => {
      handlePlayerRespawn(deadPlayerId);
    }, 5000);
  }, [socket?.id, players, updatePlayerHealth, playerEntityRef, engineRef]);

  // Function to handle player respawn
  const handlePlayerRespawn = useCallback((playerId: string) => {
    console.log(`🔄 Respawning player ${playerId}`);

    // Find the player's tower
    const playerTower = Array.from(towers.values()).find(tower => tower.ownerId === playerId);
    if (!playerTower) {
      console.warn(`⚠️ No tower found for player ${playerId}, cannot respawn`);
      return;
    }

    // Teleport player to their tower
    const respawnPosition = {
      x: playerTower.position.x,
      y: playerTower.position.y + 1, // Slightly above ground
      z: playerTower.position.z
    };

    if (playerId === socket?.id) {
      // Local player respawn
      if (playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const playerEntity = world.getEntity(playerEntityRef.current);

        if (playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          const health = playerEntity.getComponent(Health);

          if (transform) {
            transform.setPosition(respawnPosition.x, respawnPosition.y, respawnPosition.z);
          }

          if (health) {
            health.revive(); // Restore full health
            updatePlayerHealth(health.currentHealth, health.maxHealth);
            console.log(`💚 Local player respawned with full health: ${health.currentHealth}/${health.maxHealth}`);
          }
        }
      }
    } else {
      // Remote player respawn - the server will handle broadcasting the position update
      // We don't need to update local state as the server sync will handle it
      console.log(`🔄 Remote player ${playerId} respawn broadcasted to server`);
    }

    // Clear death state
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      newState.delete(playerId);
      return newState;
    });

    console.log(`✅ Player ${playerId} respawned at tower position: ${respawnPosition.x}, ${respawnPosition.y}, ${respawnPosition.z}`);
  }, [socket?.id, towers, updatePlayerHealth, playerEntityRef, engineRef]);

  // Function to handle wave completion and award experience (legacy multiplayer mode)
  const handleWaveComplete = useCallback(() => {
    console.log(`🌊 Wave completed! Awarding 10 EXP to both players`);

    // Award 10 EXP to BOTH players when a wave completes
    const allPlayerIds = Array.from(players.keys());

    allPlayerIds.forEach(playerId => {
      if (playerId === socket?.id) {
        // Local player gets the experience
        setPlayerExperience(prev => {
          const newExp = prev + 10;

          // Check for level up using the previous experience to determine current level
          const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
          const newLevel = ExperienceSystem.getLevelFromExperience(newExp);
          console.log(`📈 Level check: currentLevel=${currentLevel}, newLevel=${newLevel}, prev=${prev}, newExp=${newExp}`);

          if (newLevel > currentLevel) {
            setPlayerLevel(newLevel);
            console.log(`🎉 Level up! Player reached level ${newLevel}`);

            // Update max health based on new level
            if (playerEntityRef.current !== null && engineRef.current) {
              const world = engineRef.current.getWorld();
              const actualPlayerEntity = world.getEntity(playerEntityRef.current);

              if (actualPlayerEntity) {
                const health = actualPlayerEntity.getComponent(Health);
                if (health) {
                  const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                  const oldMaxHealth = health.maxHealth;
                  const oldCurrentHealth = health.currentHealth;
                  console.log(`🔍 DEBUG: Health calculation - Level: ${newLevel}, New Max HP: ${newMaxHealth}, Old Max HP: ${oldMaxHealth}`);
                  console.log(`🔍 DEBUG: Before setMaxHealth - Current HP: ${oldCurrentHealth}/${oldMaxHealth}`);

                  // Update max health and scale current health proportionally
                  health.setMaxHealth(newMaxHealth);

                  console.log(`🔍 DEBUG: After setMaxHealth - Current HP: ${health.currentHealth}/${health.maxHealth}`);
                  console.log(`🔍 DEBUG: Health ratio preserved: ${(oldCurrentHealth / oldMaxHealth).toFixed(3)} vs ${(health.currentHealth / health.maxHealth).toFixed(3)}`);

                  // Synchronize the updated health with server and other players
                  updatePlayerHealth(health.currentHealth, health.maxHealth);

                  console.log(`💚 Health updated: ${oldMaxHealth} -> ${newMaxHealth} HP (current: ${health.currentHealth}/${health.maxHealth})`);
                } else {
                  console.log(`❌ DEBUG: Health component not found on player entity!`);
                }
              } else {
                console.log(`❌ DEBUG: Could not retrieve player entity from world using ID: ${playerEntityRef.current}`);
              }
            } else {
              console.log(`❌ DEBUG: playerEntityRef.current is null or engine not initialized during level up!`);
            }
          }

          console.log(`🎯 Local player ${playerId} gained 10 EXP from wave completion (total: ${newExp})`);
          return newExp;
        });
      } else {
        // Update opponent's experience (will be handled by server in real implementation)
        console.log(`🎯 Opponent ${playerId} gained 10 EXP from wave completion`);
      }
    });
  }, [socket?.id, playerEntity, players, updatePlayerHealth, engineRef]);

  // Function to handle PVP wave completion and award experience to the correct player
  const handlePvpWaveComplete = useCallback((eventData: any) => {
    const { winnerPlayerId, defeatedPlayerId, isLocalPlayerWinner, waveId } = eventData;
    
    console.log(`🎯 PVP Wave completed! Player ${defeatedPlayerId}'s units were defeated. Winner: ${winnerPlayerId}`);
    
    if (isLocalPlayerWinner) {
      // Local player won - award experience
      console.log(`🏆 Local player won the wave! Awarding 10 EXP`);
      
      setPlayerExperience(prev => {
        const newExp = prev + 10;

        // Check for level up using the previous experience to determine current level
        const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
        const newLevel = ExperienceSystem.getLevelFromExperience(newExp);
        console.log(`📈 PVP Level check: currentLevel=${currentLevel}, newLevel=${newLevel}, prev=${prev}, newExp=${newExp}`);

        if (newLevel > currentLevel) {
          setPlayerLevel(newLevel);
          console.log(`🎉 PVP Level up! Player reached level ${newLevel} from defeating opponent's wave`);

          // Update max health based on new level
          if (playerEntityRef.current !== null && engineRef.current) {
            const world = engineRef.current.getWorld();
            const actualPlayerEntity = world.getEntity(playerEntityRef.current);

            if (actualPlayerEntity) {
              const health = actualPlayerEntity.getComponent(Health);
              if (health) {
                const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                health.setMaxHealth(newMaxHealth);
                updatePlayerHealth(health.currentHealth, health.maxHealth);
                console.log(`💚 PVP Health updated for level ${newLevel}: ${health.currentHealth}/${health.maxHealth} HP`);
              }
            }
          }
        }

        console.log(`🎯 Local player gained 10 EXP from defeating opponent's wave (total: ${newExp})`);
        return newExp;
      });
    } else {
      // Opponent won - no experience for local player
      console.log(`😞 Opponent won the wave. Local player's units were defeated.`);
    }
  }, [socket?.id, playerEntityRef, engineRef, updatePlayerHealth]);

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

  const [weaponState, setWeaponState] = useState({
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    isCharging: false,
    chargeProgress: 0,
    isSwinging: false,
    isSpinning: false,
    swordComboStep: 1 as 1 | 2 | 3,
    isDivineStorming: false,
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
    isParticleBeamCharging: false,
    particleBeamChargeProgress: 0,
    isFrozen: false
  });

  // Use a ref to store current weapon state to avoid infinite re-renders
  const weaponStateRef = useRef(weaponState);
  const lastWeaponStateUpdate = useRef(0);

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
    isDivineStorming: boolean;
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
    isDeathGrasping: boolean;
    isWraithStriking: boolean;
    isCorruptedAuraActive: boolean;
    isColossusStriking: boolean;
    isSundering?: boolean;
    isParticleBeamCharging?: boolean;
    particleBeamChargeProgress?: number;
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
      if (updated[WeaponType.SCYTHE] < 250) {
        updated[WeaponType.SCYTHE] = Math.min(250, updated[WeaponType.SCYTHE] + 5);
      }

      // Mana regeneration for Runeblade (8 mana per second = 4 every 500ms)
      if (updated[WeaponType.RUNEBLADE] < 150) {
        updated[WeaponType.RUNEBLADE] = Math.min(150, updated[WeaponType.RUNEBLADE] + 2);
      }

      return updated;
    });
  }, 500);

  return () => clearInterval(interval);
}, []);

  // Sync currentWeapon with weaponState
  useEffect(() => {
    setCurrentWeapon(weaponState.currentWeapon);
  }, [weaponState.currentWeapon]);

// Update max mana display based on current weapon (but don't reset the actual mana value)
useEffect(() => {
  if (currentWeapon === WeaponType.SCYTHE) {
    setMaxMana(250);
  } else if (currentWeapon === WeaponType.RUNEBLADE) {
    setMaxMana(150);
  } else {
    setMaxMana(0); // No mana for other weapons
  }
}, [currentWeapon]);

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
        console.log(`🚫 Skipping own attack broadcast: ${data.attackType} from ${data.playerId}`);
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
              { speed: 16, damage: 61, lifetime: 5, piercing: true, opacity: 0.8, projectileType: 'viper_sting' }
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
            console.log(`🐍 Viper Sting projectile visual effect triggered for remote player ${data.playerId}`);
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
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile'];
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
                  { speed: 25, damage: 10, lifetime: 3, maxDistance: 25, opacity: 0.8 } // PVP damage handled by CombatSystem
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
                projectileSystem.createEntropicBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 20, damage: 20, lifetime: 1.75, piercing: false, opacity: 0.8 }
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
                  { speed: 22, damage: 30, lifetime: 3, maxDistance: 25, piercing: false, opacity: 0.8 }
                );
                
                // Mark as barrage arrow for proper visual rendering
                const renderer = barrageEntity.getComponent(Renderer);
                if (renderer?.mesh) {
                  renderer.mesh.userData.isBarrageArrow = true;
                  renderer.mesh.userData.isRegularArrow = false;
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
    };

    const handlePlayerAbility = (data: any) => {
      if (data.playerId !== socket.id) {
        // Handle special abilities like Divine Storm, Viper Sting, Barrage, and Particle Beam
        if (data.abilityType === 'divine_storm') {
          
          // Trigger visual Divine Storm effect at the player's position
          const position = pvpObjectPool.acquireVector3(data.position.x, data.position.y, data.position.z);
          triggerGlobalDivineStorm(position, data.playerId);
          
          // Release pooled Vector3 after use
          pvpObjectPool.releaseVector3(position);
          
          // Use batched updates for Divine Storm animation
          PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
            playerId: data.playerId,
            stateUpdate: {
              isDivineStorming: true,
              isSpinning: true, // Enable spinning animation for Divine Storm
              isSwordCharging: false
            }
          }]);
          
          // Reset Divine Storm state after duration using batched updates
          setTimeout(() => {
            PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
              playerId: data.playerId,
              stateUpdate: {
                isDivineStorming: false,
                isSpinning: false // Reset spinning animation
              }
            }]);
          }, 4000); // Divine Storm lasts 4 seconds
        } else if (data.abilityType === 'viper_sting') {

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
          const success = triggerGlobalViperSting(flatPosition, flatDirection);
          if (success) {
            console.log(`🐍 Viper Sting visual effect triggered for remote player ${data.playerId}`);
          }
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
        } else if (data.abilityType === 'barrage') {

          // Trigger visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalBarrage(position, direction);
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isBarrageCharging: true,
              barrageChargeProgress: 1.0 // Full charge when triggered
            });
            
            // Reset Barrage state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isBarrageCharging: false,
                    barrageChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 1500); // Barrage lasts 1.5 seconds
            
            return updated;
          });
        } else if (data.abilityType === 'tidal_wave') {



          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isParticleBeamCharging: true,
              particleBeamChargeProgress: 1.0 // Full charge when triggered
            });

            // Reset Tidal Wave state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isParticleBeamCharging: false,
                    particleBeamChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 1500); // Particle Beam lasts 1.5 seconds

            return updated;
          });
        } else if (data.abilityType === 'cloudkill') {
          // Cloudkill ability - trigger the global cloudkill effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          triggerGlobalCloudkill(position, data.playerId);
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
        } else if (data.abilityType === 'deathgrasp') {

          // Create death grasp visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          const targetPosition = position.clone().add(direction.clone().multiplyScalar(8));

          createPvpDeathGraspEffect(data.playerId, position, direction);

          // Update player state to show death grasping animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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

          // Find target player to pull (closest player in front of caster)
          let closestTarget: { id: string; distance: number } | null = null;
          players.forEach((player: any) => {
            if (player.id === data.playerId) return; // Don't pull self

            const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
            const distance = position.distanceTo(playerPos);

            // Check if player is in front of caster and within range
            const toPlayer = playerPos.clone().sub(position).normalize();
            const dotProduct = direction.dot(toPlayer);

            if (dotProduct > 0.5 && distance <= 8) { // 60 degree cone, 8 unit range
              if (!closestTarget || distance < closestTarget.distance) {
                closestTarget = { id: player.id, distance };
              }
            }
          });

          // Pull the closest target player if found
          if (closestTarget !== null && closestTarget !== undefined) {
            const target = closestTarget as { id: string; distance: number };
            createPvpDeathGraspPull(target.id, position);
          }
        } else if (data.abilityType === 'wraith_strike') {

          // Update player state to show wraith striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
        } else if (data.abilityType === 'colossus_strike') {
          
          // Create Colossus Strike visual effect for other players
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Calculate position in front of the caster (same logic as local player)
          const effectPosition = position.clone().add(direction.clone().normalize().multiplyScalar(2.5));
          
          // Create visual effect with rage value (default to 40 if not provided)
          const rageSpent = data.extraData?.rageSpent || data.rageSpent || 40;
          createPvpColossusStrikeEffect(data.playerId, effectPosition, rageSpent, position);
          
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
              isDivineStorming: false,
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
              isColossusStriking: false,
              isSundering: false,
              isParticleBeamCharging: false,
              particleBeamChargeProgress: 0,
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
        }
      }
    };

    const handlePlayerDamaged = (data: any) => {
      let targetActuallyDied = false;

      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket.id && playerEntity) {
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          // Pass the entity so Health component can use Shield for damage absorption
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity);

          // Check if player just died
          if (wasAlive && health.isDead) {
            targetActuallyDied = true;
            // @ts-ignore - data.sourcePlayerId can be undefined
            handlePlayerDeath(socket.id, data.sourcePlayerId);
          }
        }
      }

      // Check if we are the source of damage that killed another player
      // Only award experience if our damage ACTUALLY killed the target (not just what backend thought)
      if (data.sourcePlayerId === socket.id && data.targetPlayerId !== socket.id) {
        // For remote players, we need to check if they actually died
        // If we're not the target, check if the backend reported they died AND health went to 0
        const remotePlayerDied = !targetActuallyDied && data.wasKilled && data.newHealth <= 0;

        if (targetActuallyDied || remotePlayerDied) {
          const currentTime = Date.now() / 1000; // Current time in seconds
          const timeSinceLastExp = currentTime - lastExperienceAwardTime;

          // Check if 5 seconds have passed since last experience award
          if (timeSinceLastExp < 5) {
            console.log(`⏰ Experience cooldown active. ${5 - timeSinceLastExp} seconds remaining.`);
            return;
          }

          console.log(`🎯 Local player killed ${data.targetPlayerId} with ${data.damage} damage! Awarding +5 EXP`);

          // Award +5 EXP to the local player for the kill
          setPlayerExperience(prev => {
            const newExp = prev + 5;

            // Check for level up
            const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
            const newLevel = ExperienceSystem.getLevelFromExperience(newExp);

            if (newLevel > currentLevel) {
              setPlayerLevel(newLevel);
              console.log(`🎉 Level up! Player reached level ${newLevel} from killing ${data.targetPlayerId}`);

              // Update max health based on new level
              if (playerEntityRef.current !== null && engineRef.current) {
                const world = engineRef.current.getWorld();
                const actualPlayerEntity = world.getEntity(playerEntityRef.current);

                if (actualPlayerEntity) {
                  const health = actualPlayerEntity.getComponent(Health);
                  if (health) {
                    const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                    health.setMaxHealth(newMaxHealth);
                    updatePlayerHealth(health.currentHealth, health.maxHealth);
                  }
                }
              }
            }

            console.log(`🎯 Local player gained +5 EXP from killing ${data.targetPlayerId} (total: ${newExp})`);
            return newExp;
          });

          // Update the last experience award time
          setLastExperienceAwardTime(currentTime);
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
            isDivineStorming: false,
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
            isColossusStriking: false,
            isSundering: false,
            isParticleBeamCharging: false,
            particleBeamChargeProgress: 0,
            isFrozen: false
          };
          
          // Update with the received animation state
          const newState = {
            ...currentState,
            ...data.animationState,
            lastAnimationUpdate: Date.now()
          };
          
  
          
          updated.set(data.playerId, newState);
          
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

      if (data.effect?.type === 'deathgrasp_pull') {
        const { targetPlayerId, position, casterId } = data.effect;

        // If this client is the target player, update the local position
        if (targetPlayerId === socket?.id && position) {
          const pullPosition = new Vector3(position.x, position.y, position.z);

          // Update local player entity position
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              transform.setPosition(pullPosition.x, pullPosition.y, pullPosition.z);
            }
          }
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

      // Update tower system stealth state so towers don't target invisible players
      if (towerSystemRef.current) {
        towerSystemRef.current.updatePlayerStealthState(playerId, isInvisible);
      }

    };

    const handlePlayerKnockback = (data: any) => {
      if (!data || !data.targetPlayerId) {
        return;
      }

      const { targetPlayerId, direction, distance, duration } = data;

      // Find the target player entity
      const targetEntityId = serverPlayerEntities.current.get(targetPlayerId);
      if (!targetEntityId) {
        console.log(`🌊 Knockback: Could not find entity for player ${targetPlayerId}`);
        return;
      }

      // Get the entity from the world
      const world = engineRef.current?.getWorld();
      if (!world) {
        console.log(`🌊 Knockback: World not available`);
        return;
      }

      const targetEntity = world.getEntity(targetEntityId);
      if (!targetEntity) {
        console.log(`🌊 Knockback: Could not find entity ${targetEntityId} in world`);
        return;
      }

      // Get the movement component
      const targetMovement = targetEntity.getComponent(Movement);
      if (!targetMovement) {
        console.log(`🌊 Knockback: Entity ${targetEntityId} has no movement component`);
        return;
      }

      // Get the transform component for current position
      const targetTransform = targetEntity.getComponent(Transform);
      if (!targetTransform) {
        console.log(`🌊 Knockback: Entity ${targetEntityId} has no transform component`);
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

      console.log(`🌊 Applied knockback to player ${targetPlayerId}: distance ${distance}, duration ${duration}s`);
    };

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-animation-state', handlePlayerAnimationState);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);
    socket.on('player-stealth', handlePlayerStealth);
    socket.on('player-knockback', handlePlayerKnockback);

    return () => {
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-used-ability', handlePlayerAbility);
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-debuff', handlePlayerDebuff);
      socket.off('player-stealth', handlePlayerStealth);
      socket.off('player-knockback', handlePlayerKnockback);
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
              console.log(`🔧 Force resetting stuck animation for player ${playerId}`);
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
        const shield = new Shield(250, 20, 2.5); // 100 max shield, 20/s regen, 5s delay
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

      // Update tower system player mapping
      if (towerSystemRef.current && socket?.id) {
        towerSystemRef.current.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }
    
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
              console.log(`💀 Remote player ${playerId} detected as dead from health sync`);
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
    
    // Create local ECS entities for towers
    towers.forEach((serverTower, towerId) => {
      if (!serverTowerEntities.current.has(towerId)) {
        // Create a new local ECS entity for this server tower
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverTower.position.x, serverTower.position.y, serverTower.position.z);
        entity.addComponent(transform);
        
        // Add Tower component
        const tower = world.createComponent(Tower);
        tower.ownerId = serverTower.ownerId;
        tower.towerIndex = serverTower.towerIndex;
        entity.addComponent(tower);
        
        // Add Health component
        const health = new Health(serverTower.maxHealth);
        health.currentHealth = serverTower.health;
        entity.addComponent(health);
        
        // Add Collider component for tower damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.CYLINDER;
        collider.radius = 1.5; // Tower base radius
        collider.height = 4; // Tower height
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so projectiles can hit towers
        collider.setMask(CollisionLayer.ENVIRONMENT | CollisionLayer.PLAYER);
        collider.setOffset(0, 2, 0); // Center vertically
        entity.addComponent(collider);
        
        // Notify systems that the entity is ready
        world.notifyEntityAdded(entity);
        
        // Store the mapping
        serverTowerEntities.current.set(towerId, entity.id);
        
  
      } else {
        // Update existing local ECS entity
        const entityId = serverTowerEntities.current.get(towerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.maxHealth = serverTower.maxHealth;
            health.currentHealth = serverTower.health;
            if (serverTower.isDead && !health.isDead) {
              health.currentHealth = 0;
              health.isDead = true;
            }
          }
          
          // Update tower state
          const tower = entity.getComponent(Tower);
          if (tower && serverTower.isDead && !tower.isDead) {
            tower.die(Date.now() / 1000);
          }
        } else {
          console.warn(`⚠️ Could not find local ECS entity ${entityId} for tower ${towerId}`);
        }
      }
    });
    
    // Clean up local entities for towers that no longer exist
    const currentTowerIds = new Set(towers.keys());
    const towerEntitiesToRemove: string[] = [];
    
    serverTowerEntities.current.forEach((entityId, towerId) => {
      if (!currentTowerIds.has(towerId)) {
        const entity = world.getEntity(entityId);
        if (entity) {
          // Mark entity as dead instead of removing
          const health = entity.getComponent(Health);
          const tower = entity.getComponent(Tower);
          if (health && tower) {
            health.currentHealth = 0;
            health.isDead = true;
            tower.die(Date.now() / 1000);
          }
        }
        towerEntitiesToRemove.push(towerId);
      }
    });
    
    // Remove from mapping
    towerEntitiesToRemove.forEach(towerId => {
      serverTowerEntities.current.delete(towerId);
    });
  }, [players, towers, gameStarted, socket?.id]);

  // Update tower system player mapping when players change
  useEffect(() => {
    if (towerSystemRef.current && socket?.id) {
      towerSystemRef.current.setPlayerMapping(serverPlayerEntities.current, socket.id);
    }
  }, [players, socket?.id]);

  // Initialize the PVP game engine
  useEffect(() => {
    if (isInitialized.current || !gameStarted) return;
    isInitialized.current = true;


    // Initialize damage system with some test runes for demonstration
    setGlobalCriticalRuneCount(0); // 11% + (2 * 3%) = 17% crit chance
    setGlobalCritDamageRuneCount(0); // 2.0 + (1 * 0.15) = 2.15x crit damage
    
    // Create engine
    const engine = new Engine({ enableDebug: true });
    engineRef.current = engine;

    // Initialize with canvas
    const canvas = gl.domElement;
    engine.initialize(canvas).then(() => {
      // Create a PVP damage callback that maps local ECS entity IDs back to server player IDs
      const damagePlayerWithMapping = (entityId: string, damage: number) => {
        // Find the server player ID that corresponds to this local ECS entity ID
        const numericEntityId = parseInt(entityId);
        let serverPlayerId: string | null = null;
        
        serverPlayerEntities.current.forEach((localEntityId, playerId) => {
          if (localEntityId === numericEntityId) {
            serverPlayerId = playerId;
          }
        });
        
        if (serverPlayerId) {
          broadcastPlayerDamage(serverPlayerId, damage);
        }
      };
      
      const { player, controlSystem, towerSystem } = setupPVPGame(engine, scene, camera as PerspectiveCamera, gl, damagePlayerWithMapping, damageTower, damageSummonedUnit, damageEnemy, selectedWeapons);
      
      // Update player entity with correct socket ID for team validation
      if (socket?.id) {
        player.userData = player.userData || {};
        player.userData.playerId = socket.id;
      }
      
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      towerSystemRef.current = towerSystem;
      // summonedUnitSystemRef.current = summonedUnitSystem; // Removed - using server-authoritative units

      // Set initial tower system player mapping and socket ID if socket is available
      if (socket?.id) {
        towerSystem.setLocalSocketId(socket.id);
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }

      // Set up Corrupted Aura toggle callback
      controlSystem.setCorruptedAuraToggleCallback((active: boolean) => {
        const newState = {
          ...weaponStateRef.current,
          isCorruptedAuraActive: active,
          isParticleBeamCharging: weaponStateRef.current.isParticleBeamCharging,
          particleBeamChargeProgress: weaponStateRef.current.particleBeamChargeProgress,
          isFrozen: weaponStateRef.current.isFrozen
        };
        weaponStateRef.current = newState;
        setWeaponState(newState);
      });
      
      // Set up tower system with player mapping
      if (towerSystem && socket?.id) {
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }

      // Note: Wave completion callback is now handled by server-side summoned unit system
      // The server will broadcast 'wave-completed' events that we handle in MultiplayerContext
      
      // Pass controlSystem back to parent
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
          const currentPlayerEntity = engine.getWorld().getEntity(playerEntityRef.current!);
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
                true  // isElementalShotsUnlocked - for now assume unlocked
              );
            }
          }
        }
      });
      
      // Set up Divine Storm callback
      controlSystem.setDivineStormCallback((position, direction, duration) => {
        
        // Trigger local visual effect immediately with correct duration
        triggerGlobalDivineStorm(position, socket?.id, duration);
        
        // Broadcast to other players with duration info
        broadcastPlayerAbility('divine_storm', position, direction);
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

      // Set up Tidal Wave callback
      controlSystem.setParticleBeamCallback((position, direction) => {
        broadcastPlayerAbility('tidal_wave', position, direction);
      });

      // Set up local Tidal Wave visual effect callback
      controlSystem.setCreateLocalParticleBeamCallback((position, direction) => {
        // Create a local tidal wave effect for the casting player
        const beamId = Math.random().toString(36).substr(2, 9);
        const startTime = Date.now();

        // Create a dummy parent ref positioned at the beam origin
        const parentRef = React.createRef<Group>();

        // Position the dummy ref at the beam position with correct rotation
        if (parentRef.current) {
          parentRef.current.position.copy(position);
          parentRef.current.lookAt(position.clone().add(direction));
        }

        // Create tidal wave through TidalWaveManager
        // Pass the local socket ID as casterId to exclude self from collision detection
        triggerGlobalTidalWave(position, direction, socket?.id);
      });

      // Set up Cloudkill callback
      controlSystem.setCloudkillCallback((position, direction) => {
        // Broadcast to other players
        broadcastPlayerAbility('cloudkill', position, direction);
        
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

      // Set up multiplayer context reference for ControlSystem stealth broadcasting and ColossusStrike damage
      (window as any).multiplayerContext = {
        broadcastPlayerStealth,
        broadcastPlayerDamage
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
        
        broadcastPlayerAttack(projectileType, position, direction, animationData);
      });
      
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
          }
        }
      });

      // Set up Smite callback
      controlSystem.setSmiteCallback((position: Vector3, direction: Vector3, onDamageDealt?: (damageDealt: boolean) => void) => {
        // Create local Smite effect
        createPvpSmiteEffect(socket?.id || '', position, onDamageDealt);

        // Broadcast Smite ability to other players
        broadcastPlayerAbility('smite', position, direction);
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

      // Set up Colossus Strike callback
      controlSystem.setColossusStrikeCallback((position: Vector3, direction: Vector3, rageSpent: number) => {

        // Calculate position in front of the player (like Smite)
        const casterPosition = position.clone();
        const casterDirection = direction.clone().normalize();
        
        // Position the effect 2.5 units in front of the caster (same as Smite)
        const effectPosition = casterPosition.add(casterDirection.multiplyScalar(2.5));
        
        // Create visual effect at the calculated position (in front of caster)
        // The damage will be handled by the ColossusStrike component itself
        createPvpColossusStrikeEffect(socket?.id || '', effectPosition, rageSpent, casterPosition);

        // Broadcast Colossus Strike ability to other players with rage value
        broadcastPlayerAbility('colossus_strike', position, direction, undefined, { rageSpent });
      });

      // Set up mana callbacks for Runeblade
      controlSystem.setConsumeManaCallback(consumeMana);
      controlSystem.setCheckManaCallback(hasMana);

      engine.start();
    });

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
      // Clear any pending batched updates
      pvpStateBatcher.clear();
    };
  }, [scene, camera, gl, gameStarted]);

  // Expose PVP player data globally for ControlSystem access
  useEffect(() => {
    (window as any).pvpPlayers = players;
    (window as any).localSocketId = socket?.id;
    (window as any).serverPlayerEntities = serverPlayerEntities;
    (window as any).multiplayer = {
      broadcastPlayerEffect: broadcastPlayerEffect
    };

    // Expose interpolation system for debugging
    (window as any).getInterpolationStats = () => {
      if (!engineRef.current) {
        return { error: 'Engine not initialized' };
      }

      const world = engineRef.current.getWorld();
      const interpolationSystem = world.getSystem(InterpolationSystem);

      if (!interpolationSystem) {
        return { error: 'InterpolationSystem not found' };
      }

      const stats: any = {};
      serverPlayerEntities.current.forEach((entityId, playerId) => {
        const entity = world.getEntity(entityId);
        if (entity) {
          stats[playerId] = interpolationSystem.getInterpolationStats(entity);
        }
      });

      return stats;
    };

    // Expose advanced interpolation methods for testing
    (window as any).testInterpolationMethods = () => {


      return 'Interpolation methods available in InterpolationSystem class';
    };
  }, [players, socket?.id]);

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
        const newWeaponState = {
          currentWeapon: controlSystemRef.current.getCurrentWeapon(),
          currentSubclass: controlSystemRef.current.getCurrentSubclass(),
          isCharging: controlSystemRef.current.isWeaponCharging(),
          chargeProgress: controlSystemRef.current.getChargeProgress(),
          isSwinging: controlSystemRef.current.isWeaponSwinging(),
          isSpinning: (controlSystemRef.current.isWeaponCharging() || controlSystemRef.current.isCrossentropyChargingActive() || controlSystemRef.current.isParticleBeamChargingActive()) && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE,
          swordComboStep: controlSystemRef.current.getSwordComboStep(),
          isDivineStorming: controlSystemRef.current.isDivineStormActive(),
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
          isParticleBeamCharging: controlSystemRef.current.isParticleBeamChargingActive(),
          particleBeamChargeProgress: controlSystemRef.current.getParticleBeamChargeProgress(),
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
          // Determine if sword is spinning during Divine Storm or Charge
          const isSwordSpinning = newWeaponState.isDivineStorming || newWeaponState.isSwordCharging;
          // Combine all spinning states
          const isSpinning = isScytheSpinning || isSwordSpinning;

          // Create the animation state object
          const animationStateToSend = {
            isCharging: newWeaponState.isCharging,
            chargeProgress: newWeaponState.chargeProgress,
            isSwinging: newWeaponState.isSwinging,
            swordComboStep: newWeaponState.swordComboStep,
            isDivineStorming: newWeaponState.isDivineStorming,
            isSpinning: isSpinning, // Broadcast spinning for scythe, Divine Storm, and sword charge
            isDeflecting: newWeaponState.isDeflecting,
            isSwordCharging: newWeaponState.isSwordCharging, // Broadcast sword charging state
            isViperStingCharging: newWeaponState.isViperStingCharging,
            viperStingChargeProgress: newWeaponState.viperStingChargeProgress,
            isBarrageCharging: newWeaponState.isBarrageCharging,
            barrageChargeProgress: newWeaponState.barrageChargeProgress,
            isBackstabbing: newWeaponState.isBackstabbing, // Broadcast backstab animation state
            // Add missing Runeblade animation states
            isSmiting: controlSystemRef.current?.isSmiteActive() || false,
            isDeathGrasping: controlSystemRef.current?.isDeathGraspActive() || false,
            isWraithStriking: controlSystemRef.current?.isWraithStrikeActive() || false,
            isCorruptedAuraActive: controlSystemRef.current?.isCorruptedAuraActive() || false,
            isColossusStriking: controlSystemRef.current?.isColossusStrikeActive() || false
          };
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
        onCameraUpdate(camera, size);
        lastCameraUpdate.current = cameraNow;
      }

      // Log object pool and state batcher statistics periodically (every 5 seconds)
      const now = Date.now();
      if (now % 10000 < 16) { // Approximately every 5 seconds (accounting for frame rate)
        const poolStats = getPoolStats();
        const batcherStats = pvpStateBatcher.getStats();
        console.log('🔧 PVP Performance Stats:', {
          objectPool: poolStats,
          stateBatcher: batcherStats
        });
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

            // Update multiplayer health
            updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
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

  return (
    <>
      {/* Don't render game world if game hasn't started */}
      {!gameStarted ? null : (
        <>
          {/* Environment (Sky, Planet, Mountains, Pillars, Pedestal) - No level progression in PVP */}
      <Environment level={1} world={engineRef.current?.getWorld()} />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.5}
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

      {/* Map boundary visual indicator */}
      <mesh position={[0, 0.01, 0]} scale={[2.5, 2.5, 2.5]}>
        <ringGeometry args={[25, 29, 64]} />
        <meshStandardMaterial color="#ff6b6b" transparent opacity={0.3} />
      </mesh>






      {/* Main Player Dragon Unit Renderer */}
      {(() => {

        return playerEntity && engineRef.current && socket;
      })() && (
        <DragonRenderer
          entityId={playerEntity.id}
          position={playerPosition}
          world={engineRef.current!.getWorld()}
          currentWeapon={weaponState.currentWeapon}
          currentSubclass={weaponState.currentSubclass}
          isCharging={weaponState.isCharging}
          chargeProgress={weaponState.chargeProgress}
          isSwinging={weaponState.isSwinging}
          isSpinning={weaponState.isSpinning}
          swordComboStep={weaponState.swordComboStep}
          isDivineStorming={weaponState.isDivineStorming}
          isSwordCharging={weaponState.isSwordCharging}
          isDeflecting={weaponState.isDeflecting}
          isViperStingCharging={weaponState.isViperStingCharging}
          viperStingChargeProgress={weaponState.viperStingChargeProgress}
          isBarrageCharging={weaponState.isBarrageCharging}
          barrageChargeProgress={weaponState.barrageChargeProgress}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          cobraShotChargeProgress={weaponState.cobraShotChargeProgress}
          isSkyfalling={weaponState.isSkyfalling}
          isBackstabbing={weaponState.isBackstabbing}
          isSundering={weaponState.isSundering}
          isSmiting={controlSystemRef.current?.isSmiteActive() || false}
          isDeathGrasping={controlSystemRef.current?.isDeathGraspActive() || false}
          isWraithStriking={controlSystemRef.current?.isWraithStrikeActive() || false}
          isCorruptedAuraActive={controlSystemRef.current?.isCorruptedAuraActive() || false}
          isColossusStriking={controlSystemRef.current?.isColossusStrikeActive() || false}
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
          onDamageNumbersReady={handleDamageNumbersReady}
          combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
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
              isParticleBeamCharging: weaponStateRef.current.isParticleBeamCharging,
              particleBeamChargeProgress: weaponStateRef.current.particleBeamChargeProgress,
              isFrozen: weaponStateRef.current.isFrozen
            };
            weaponStateRef.current = newState;
            setWeaponState(newState);
          }}
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
          isDivineStorming: false,
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
          isColossusStriking: false,
          isParticleBeamCharging: false,
          particleBeamChargeProgress: 0,
          isFrozen: false
        };
        
        return (
          <DragonRenderer
            key={player.id}
            entityId={parseInt(player.id.replace(/\D/g, '0'))} // Convert string ID to number
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            world={engineRef.current?.getWorld() || new World()} // Use current world or create new one
            currentWeapon={player.weapon}
            currentSubclass={player.subclass}
            isCharging={playerState.isCharging}
            chargeProgress={playerState.chargeProgress}
            isSwinging={playerState.isSwinging}
            isSpinning={playerState.isSpinning}
            swordComboStep={playerState.swordComboStep}
            isDivineStorming={playerState.isDivineStorming}
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
            isDeathGrasping={playerState.isDeathGrasping || false}
            isWraithStriking={playerState.isWraithStriking || false}
            isCorruptedAuraActive={playerState.isCorruptedAuraActive || false}
            isColossusStriking={playerState.isColossusStriking || false}
            isDead={isPlayerDead}
            rotation={player.rotation}
            isLocalPlayer={false}
            onBowRelease={() => {}}
            onScytheSwingComplete={() => {}}
            onSwordSwingComplete={() => {}}
            onSabresSwingComplete={() => {}}
            onBackstabComplete={() => {}}
            onSunderComplete={() => {}}
            onSmiteComplete={() => {}}
            onDeathGraspComplete={() => {}}
            onWraithStrikeComplete={() => {}}
          />
        );
      })}

      {/* Towers */}
      {Array.from(towers.values()).map(tower => {
        return (
          <TowerRenderer
            key={tower.id}
            entityId={parseInt(tower.id.replace(/\D/g, '0'))} // Convert string ID to number
            world={engineRef.current?.getWorld() || new World()}
            position={new Vector3(tower.position.x, tower.position.y, tower.position.z)}
            ownerId={tower.ownerId}
            towerIndex={tower.towerIndex}
            health={tower.health}
            maxHealth={tower.maxHealth}
            isDead={tower.isDead}
            camera={camera}
          />
        );
      })}

      {/* Server-Authoritative Summoned Units */}
      {engineRef.current && Array.from(summonedUnits.values()).map((unit) => {
        // Filter out dead or inactive units
        if (!unit.isActive || unit.isDead) return null;

        return (
          <SummonedUnitRenderer
            key={unit.unitId}
            entityId={0} // Not using local entity ID for server-authoritative units
            world={engineRef.current!.getWorld()}
            position={new Vector3(unit.position.x, unit.position.y, unit.position.z)}
            ownerId={unit.ownerId}
            health={unit.health}
            maxHealth={unit.maxHealth}
            isDead={unit.isDead}
          />
        );
      }).filter(Boolean)}

      {/* Other Players Health Bars */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't show health bar for local player
        
        // Get shield info from the server player entity if it exists
        const serverPlayerEntityId = serverPlayerEntities.current.get(player.id);
        let shieldAmount = 0;
        let maxShieldAmount = 200;
        
        if (serverPlayerEntityId && engineRef.current) {
          const entity = engineRef.current.getWorld().getEntity(serverPlayerEntityId);
          if (entity) {
            const shield = entity.getComponent(Shield);
            if (shield) {
              shieldAmount = shield.currentShield;
              maxShieldAmount = shield.maxShield;
            }
          }
        }
        
        return (
          <PlayerHealthBar
            key={`healthbar-${player.id}`}
            playerId={player.id}
            playerName={player.name}
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            health={player.health}
            maxHealth={player.maxHealth}
            shield={shieldAmount}
            maxShield={maxShieldAmount}
            camera={camera}
            showDistance={35}
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
          <DivineStormManager
            enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => ({
              id: p.id,
              position: new Vector3(p.position.x, p.position.y, p.position.z),
              health: p.health
            }))}
            onHitTarget={(targetId: string, damage: number) => {
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(targetId, damage);
              }
            }}
            playerId={socket?.id}
          />
          <DeflectShieldManager />
          {/* Optimized PVP-specific Cobra Shot Manager with Object Pooling */}
          <OptimizedPVPCobraShotManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())} // Include all players, filtering is done inside the component
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }
              
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3) => {

              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition);
              
              // Update player's venom status
              setPlayers((prev: Map<string, Player>) => {
                const newPlayers = new Map(prev);
                const player = newPlayers.get(playerId);
                if (player) {
                  newPlayers.set(playerId, {
                    ...player,
                    isVenomed: true,
                    venomedUntil: Date.now() + 6000 // 6 seconds venom duration
                  });
                }
                return newPlayers;
              });
              
              // Broadcast venom effect to all players so they can see it
              if (broadcastPlayerEffect) {
                broadcastPlayerEffect({
                  type: 'venom',
                  targetPlayerId: playerId,
                  position: { x: clonedPosition.x, y: clonedPosition.y, z: clonedPosition.z },
                  duration: 6000
                });
              }
            }}
          />
          
          {/* Optimized PVP-specific Barrage Manager with Object Pooling */}
          <OptimizedPVPBarrageManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }
              
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerSlowed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply slow effect to the local player
              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpDebuffEffect(playerId, 'slowed', clonedPosition, 5000); // 5 second slow
              
              // Broadcast debuff effect to all players so they can see it
              if (broadcastPlayerDebuff) {
                broadcastPlayerDebuff(playerId, 'slowed', 5000, {
                  position: { x: clonedPosition.x, y: clonedPosition.y, z: clonedPosition.z },
                  speedMultiplier: 0.5
                });
              }
            }}
          />
          
          {/* Optimized PVP-specific FrostNova Manager with Object Pooling */}
          <OptimizedPVPFrostNovaManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }
              
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerFrozen={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply frozen effect to the local player
              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpFrozenEffect(playerId, clonedPosition);
            }}
          />
          {/* Optimized PVP-specific ViperSting Manager with Object Pooling */}
          <OptimizedPVPViperStingManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply venom effect to the local player
              if (playerId === socket?.id) {
                return;
              }

              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition);
            }}
            onSoulStealCreated={(enemyPosition: Vector3) => {
              // Create soul steal effect using the global ViperStingManager
              const { triggerGlobalViperStingSoulSteal } = require('@/components/projectiles/ViperStingManager');
              if (triggerGlobalViperStingSoulSteal) {
                triggerGlobalViperStingSoulSteal(enemyPosition);
              }
            }}
          />

          {/* ViperStingManager for visual projectiles in PVP mode */}
          <ViperStingManager
            parentRef={viperStingParentRef as any}
            enemyData={
              // FIXED: Provide other players as enemy data for Viper Sting to hit
              Array.from(players.entries())
                .filter(([playerId]) => playerId !== socket?.id) // Exclude self
                .map(([playerId, player]) => ({
                  id: playerId,
                  position: new Vector3(player.position.x, player.position.y, player.position.z),
                  health: player.health,
                  isDying: player.health <= 0
                }))
            }
            onHit={(targetId: string, damage: number) => {
              // FIXED: Route damage through PVP system instead of no-op
              broadcastPlayerDamage(targetId, damage, 'viper_sting');
              console.log(`🐍 Viper Sting hit player ${targetId} for ${damage} damage`);
            }}
            setDamageNumbers={() => {}} // No-op since damage numbers are handled by combat system
            nextDamageNumberId={viperStingDamageNumberIdRef}
            onHealthChange={(deltaHealth: number) => {
              // Proper healing implementation using Health component like Smite/Reanimate
              if (deltaHealth > 0 && engineRef.current && playerEntityRef.current !== null) {
                const world = engineRef.current.getWorld();
                const playerEntity = world.getEntity(playerEntityRef.current);
                
                if (playerEntity) {
                  const healthComponent = playerEntity.getComponent(Health);
                  if (healthComponent) {
                    const didHeal = healthComponent.heal(deltaHealth);
                    if (didHeal) {
                      console.log(`🐍 Viper Sting Soul Steal healed player for ${deltaHealth} HP! Health: ${healthComponent.currentHealth}/${healthComponent.maxHealth}`);
                    }
                  }
                }
              }
            }}
            charges={[{ id: 1, available: true, cooldownStartTime: null }]} // Dummy charge state
            setCharges={() => {}} // No-op since charges aren't used in PVP
            localSocketId={socket?.id}
          />

          {/* CloudkillManager for visual arrows in PVP mode */}
          <CloudkillManager
            enemyData={[]} // Empty array since we target players in PVP
            onHit={(targetId, damage, isCritical, position) => {
              // Handle player hits from Cloudkill arrows
              const targetPlayer = Array.from(players.values()).find(p => p.id === targetId);
              if (targetPlayer && targetId !== socket?.id) { // Don't damage local player
                if (broadcastPlayerDamage) {
                  broadcastPlayerDamage(targetId, damage);
                }

                // Add damage numbers
                if (onDamageNumbersUpdate && playerPosition) {
                  const damageNumberId = Math.random().toString(36).substr(2, 9);
                  onDamageNumbersUpdate([{
                    id: damageNumberId,
                    damage: damage,
                    position: position,
                    isCritical: isCritical,
                    timestamp: Date.now()
                  }]);
                }
              }
            }}
            playerPosition={playerPosition}
            onPlayerHit={(damage) => {
              // Handle self-damage if player is hit by their own Cloudkill
              if (socket?.id && broadcastPlayerDamage) {
                broadcastPlayerDamage(socket.id, damage);
              }
            }}
            players={Array.from(players.values())
              .filter(player => player.position) // Only include players with positions
              .map(player => ({
                id: player.id,
                position: player.position!,
                isVenomed: player.isVenomed,
                venomedUntil: player.venomedUntil
              }))}
            localSocketId={socket?.id}
          />

          {/* Optimized PVP-specific Crossentropy Manager with Object Pooling */}
          <OptimizedPVPCrossentropyManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerExplosion={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply explosion effect to the local player
              if (playerId === socket?.id) {
                return;
              }

              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              
              // Create explosion effect at the hit player's position
              const explosionId = nextCrossentropyExplosionId.current++;
              
              setPvpCrossentropyExplosions(prev => [...prev, {
                id: explosionId,
                playerId: playerId,
                position: clonedPosition,
                startTime: Date.now(),
                duration: 1000 // 1 second explosion
              }]);
              
              // Remove explosion effect after duration
              setTimeout(() => {
                setPvpCrossentropyExplosions(prev => prev.filter(effect => effect.id !== explosionId));
              }, 1000);
            }}
          />

          {/* PVP Tidal Wave Manager for Particle Beam ability */}
          <PVPTidalWaveManager />

          {/* PVP Reanimate Effects */}
          {pvpReanimateEffects.map(reanimateEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(reanimateEffect.playerId);
            const currentPosition = affectedPlayer
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y, affectedPlayer.position.z)
              : reanimateEffect.position;

            return (
              <PVPReanimateEffect
                key={reanimateEffect.id}
                position={currentPosition}
                onComplete={() => {
                  setPvpReanimateEffects(prev => prev.filter(effect => effect.id !== reanimateEffect.id));
                }}
              />
            );
          })}

          {/* PVP Smite Effects */}
          {pvpSmiteEffects.map(smiteEffect => {
            // Create enemy data from other players for PVP smite damage
            const otherPlayersData = Array.from(players.entries())
              .filter(([playerId]) => playerId !== smiteEffect.playerId)
              .map(([playerId, player]) => ({
                id: playerId,
                position: new Vector3(player.position.x, player.position.y, player.position.z),
                health: player.health
              }));


            return (
              <Smite
                key={smiteEffect.id}
                weaponType={WeaponType.RUNEBLADE}
                position={smiteEffect.position}
                onComplete={() => {
                  setPvpSmiteEffects(prev => prev.filter(effect => effect.id !== smiteEffect.id));
                }}
                onHit={(targetId, damage) => {
                  // Handle PVP damage through broadcast system
                  broadcastPlayerDamage(targetId, damage, 'smite');
                }}
                enemyData={otherPlayersData}
                onDamageDealt={smiteEffect.onDamageDealt || ((damageDealt) => {
                  // Fallback healing if no callback provided
                  if (damageDealt && playerEntity) {
                    const healthComponent = playerEntity.getComponent(Health);
                    if (healthComponent) {
                      const oldHealth = healthComponent.currentHealth;
                      const didHeal = healthComponent.heal(20); // Smite healing amount
                      if (didHeal) {
                      }
                    }
                  }
                })}
                setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
                nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
                combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
              />
            );
          })}

          {/* PVP DeathGrasp Effects */}
          {pvpDeathGraspEffects.map(deathGraspEffect => {
            // For local player, use current transform position instead of potentially stale players map position
            let currentStartPosition: Vector3;

            if (deathGraspEffect.playerId === socket?.id && playerEntity) {
              // Local player - use current ECS position
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                currentStartPosition = transform.position.clone();
              } else {
                // Fallback to players map if ECS position unavailable
                const castingPlayer = players.get(deathGraspEffect.playerId);
                currentStartPosition = castingPlayer
                  ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
                  : deathGraspEffect.startPosition;
              }
            } else {
              // Remote player - use players map position
              const castingPlayer = players.get(deathGraspEffect.playerId);
              currentStartPosition = castingPlayer
                ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
                : deathGraspEffect.startPosition;
            }

            return (
              <DeathGraspProjectile
                key={deathGraspEffect.id}
                startPosition={currentStartPosition}
                direction={deathGraspEffect.direction}
                casterId={deathGraspEffect.playerId}
                onHit={(targetId: string, position: Vector3) => {
                  // Create the pulling effect when projectile hits
                  createPvpDeathGraspPull(targetId, currentStartPosition);
                }}
                onComplete={() => {
                  setPvpDeathGraspEffects(prev => prev.filter(effect => effect.id !== deathGraspEffect.id));
                }}
                players={players}
                localSocketId={socket?.id}
              />
            );
          })}

          {/* PVP DeathGrasp Pull Effects */}
          {pvpDeathGraspPulls.map(pull => {
            if (!pull.isActive) return null;

            return (
              <DeathGraspPull
                key={pull.id}
                targetPlayerId={pull.targetPlayerId}
                casterPosition={pull.casterPosition}
                isActive={pull.isActive}
                onComplete={() => {
                  setPvpDeathGraspPulls(prev => prev.map(p =>
                    p.id === pull.id ? { ...p, isActive: false } : p
                  ));
                }}
                playerEntities={serverPlayerEntities}
                getEntityPosition={(entityId) => {
                  const world = engineRef.current?.getWorld();
                  if (!world) return null;

                  const entity = world.getEntity(entityId);
                  if (!entity) return null;

                  const transform = entity.getComponent(Transform);
                  return transform ? transform.position : null;
                }}
                updateEntityPosition={(entityId, position) => {
                  const world = engineRef.current?.getWorld();
                  if (!world) return;

                  const entity = world.getEntity(entityId);
                  if (!entity) return;

                  const transform = entity.getComponent(Transform);
                  if (transform) {
                    transform.setPosition(position.x, position.y, position.z);
                  }
                }}
              />
            );
          })}

          {/* PVP Frost Nova Effects */}
          {pvpFrostNovaEffects.map(frostNovaEffect => {
            // Find the current position of the casting player
            const castingPlayer = players.get(frostNovaEffect.playerId);
            const currentPosition = castingPlayer
              ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
              : frostNovaEffect.position;

            return (
              <FrostNova
                key={frostNovaEffect.id}
                position={currentPosition}
                duration={frostNovaEffect.duration}
                startTime={frostNovaEffect.startTime}
                onComplete={() => {
                  setPvpFrostNovaEffects(prev => prev.filter(effect => effect.id !== frostNovaEffect.id));
                }}
              />
            );
          })}

          {/* PVP Colossus Strike Effects */}
          {pvpColossusStrikeEffects.map(colossusStrikeEffect => {
            return (
              <ColossusStrike
                key={colossusStrikeEffect.id}
                position={colossusStrikeEffect.position}
                onComplete={() => {
                  setPvpColossusStrikeEffects(prev => prev.filter(effect => effect.id !== colossusStrikeEffect.id));
                }}
                onHit={(targetId: string, damage: number) => {
                  // Handle damage to target player
                  console.log(`⚡ Colossus Strike: Dealing ${damage} damage to player ${targetId}`);
                  broadcastPlayerDamage(targetId, damage, 'colossus_strike');
                }}
                targetPlayerData={Array.from(players.values()).filter(p => p.id !== colossusStrikeEffect.playerId).map(p => ({
                  id: p.id,
                  position: new Vector3(p.position.x, p.position.y, p.position.z),
                  health: p.health,
                  maxHealth: p.maxHealth
                }))}
                playerPosition={colossusStrikeEffect.casterPosition || new Vector3(0, 0, 0)} // Use caster position for damage calculation
                rageSpent={colossusStrikeEffect.rageSpent || 40} // Use stored rage value
                delayStart={0} // Remove delay to test if timing is the issue
                setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
                nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
                combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
              />
            );
          })}

          {/* PVP Crossentropy Explosion Effects */}
          {pvpCrossentropyExplosions.map(explosionEffect => {
            return (
              <CrossentropyExplosion
                key={explosionEffect.id}
                position={explosionEffect.position}
                chargeTime={1.0} // Default charge time for PVP explosions
                explosionStartTime={explosionEffect.startTime}
                onComplete={() => {
                  setPvpCrossentropyExplosions(prev => prev.filter(effect => effect.id !== explosionEffect.id));
                }}
              />
            );
          })}

          {/* PVP Venom Effects */}
          {pvpVenomEffects.map(venomEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(venomEffect.playerId);
            const currentPosition = affectedPlayer 
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y, affectedPlayer.position.z)
              : venomEffect.position;
            
            return (
              <VenomEffect
                key={venomEffect.id}
                position={currentPosition}
                duration={venomEffect.duration}
                startTime={venomEffect.startTime}
                enemyId={venomEffect.playerId} // Use playerId as enemyId for tracking
                enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => ({
                  id: p.id,
                  position: new Vector3(p.position.x, p.position.y, p.position.z),
                  health: p.health,
                  isDying: false
                }))}
                onComplete={() => {
                  setPvpVenomEffects(prev => prev.filter(effect => effect.id !== venomEffect.id));
                }}
              />
            );
          })}

          {/* PVP Debuff Effects */}
          {pvpDebuffEffects.map(debuffEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(debuffEffect.playerId);
            let currentPosition: Vector3;
            
            // Special handling for local player to use the most up-to-date position
            if (debuffEffect.playerId === socket?.id && playerEntity) {
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                currentPosition = new Vector3(transform.position.x, transform.position.y + 0.5, transform.position.z);
              } else {
                currentPosition = new Vector3(playerPosition.x, playerPosition.y + 0.5, playerPosition.z);
              }
            } else if (affectedPlayer) {
              currentPosition = new Vector3(affectedPlayer.position.x, affectedPlayer.position.y + 0.5, affectedPlayer.position.z);
            } else {
              currentPosition = new Vector3(debuffEffect.position.x, debuffEffect.position.y + 0.5, debuffEffect.position.z);
            }
            
            // Use different effects for different debuff types
            if (debuffEffect.debuffType === 'frozen') {
              return (
                <FrozenEffect
                  key={debuffEffect.id}
                  position={currentPosition}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  enemyId={debuffEffect.playerId}
                  enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => {
                    // For local player, use the most current position
                    if (p.id === socket?.id && playerEntity) {
                      const transform = playerEntity.getComponent(Transform);
                      const currentPos = transform ? transform.position : playerPosition;
                      return {
                        id: p.id,
                        position: currentPos.clone(),
                        health: p.health,
                        isDying: false
                      };
                    } else {
                      return {
                        id: p.id,
                        position: new Vector3(p.position.x, p.position.y, p.position.z),
                        health: p.health,
                        isDying: false
                      };
                    }
                  })}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            } else if (debuffEffect.debuffType === 'stunned') {
              return (
                <StunnedEffect
                  key={debuffEffect.id}
                  position={currentPosition}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  enemyId={debuffEffect.playerId}
                  disableCameraRotation={debuffEffect.playerId === socket?.id} // Only disable camera for the stunned player
                  enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => {
                    // For local player, use the most current position
                    if (p.id === socket?.id && playerEntity) {
                      const transform = playerEntity.getComponent(Transform);
                      const currentPos = transform ? transform.position : playerPosition;
                      return {
                        id: p.id,
                        position: currentPos.clone(),
                        health: p.health,
                        isDying: false
                      };
                    } else {
                      return {
                        id: p.id,
                        position: new Vector3(p.position.x, p.position.y, p.position.z),
                        health: p.health,
                        isDying: false
                      };
                    }
                  })}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            } else {
              return (
                <DebuffIndicator
                  key={debuffEffect.id}
                  position={currentPosition}
                  debuffType={debuffEffect.debuffType}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  stackCount={debuffEffect.stackCount}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            }
          })}
          
          {/* Sabre Reaper Mist Effects for Stealth */}
          {activeMistEffects.map(mistEffect => {
            console.log('🎨 Rendering SabreReaperMistEffect at:', mistEffect.position, 'id:', mistEffect.id);
            return (
              <SabreReaperMistEffect
                key={mistEffect.id}
                position={mistEffect.position}
                duration={1000} // 1 second duration
                onComplete={() => {
                  setActiveMistEffects(prev => prev.filter(effect => effect.id !== mistEffect.id));
                }}
              />
            );
          })}

          {/* Haunted Soul Effects for WraithStrike */}
          {pvpHauntedSoulEffects.map(soulEffect => {
            return (
              <HauntedSoulEffect
                key={soulEffect.id}
                position={soulEffect.position}
                onComplete={() => {
                  setPvpHauntedSoulEffects(prev => prev.filter(effect => effect.id !== soulEffect.id));
                }}
              />
            );
          })}
        </>
      )}
        </>
      )}
    </>
  );
}

function setupPVPGame(
  engine: Engine,
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  damagePlayerCallback: (playerId: string, damage: number) => void,
  damageTowerCallback: (towerId: string, damage: number) => void,
  damageSummonedUnitCallback?: (unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string) => void,
  damageEnemyCallback?: (enemyId: string, damage: number, sourcePlayerId?: string) => void,
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null
): { player: any; controlSystem: ControlSystem; towerSystem: TowerSystem } {
  const world = engine.getWorld();
  const inputManager = engine.getInputManager();

  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Create systems
  const physicsSystem = new PhysicsSystem();
  const collisionSystem = new CollisionSystem(5); // 5 unit cell size for spatial hash
  const combatSystem = new CombatSystem(world);
  const renderSystem = new RenderSystem(scene, camera, renderer);
  const projectileSystem = new ProjectileSystem(world);
  const towerSystem = new TowerSystem(world);
  // Note: SummonedUnitSystem is disabled for PVP - using server-authoritative summoned units instead
  // const summonedUnitSystem = new SummonedUnitSystem(world);
  const controlSystem = new ControlSystem(
    camera as PerspectiveCamera,
    inputManager,
    world,
    projectileSystem,
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

  // Expose camera system globally for StunnedEffect access
  (window as any).cameraSystem = cameraSystem;
  const interpolationSystem = new InterpolationSystem();

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  towerSystem.setProjectileSystem(projectileSystem);
  // summonedUnitSystem.setCombatSystem(combatSystem); // Disabled for server-authoritative units

  // Set up combat system to route player damage through PVP system
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);

  // Set up enemy damage callback (for multiplayer mode with enemies)
  if (damageEnemyCallback) {
    combatSystem.setEnemyDamageCallback(damageEnemyCallback);
  }

  // Set up summoned unit damage callback
  combatSystem.setSummonedUnitDamageCallback((unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string, damageType?: string) => {
    // Use the summoned unit damage callback from multiplayer context
    if (damageSummonedUnitCallback) {
      damageSummonedUnitCallback(unitId, unitOwnerId, damage, sourcePlayerId);
    }
  });
  
  // Set up tower system callback for tower damage
  // TODO: Implement tower damage callback mapping similar to player damage

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(interpolationSystem); // Add interpolation system before render system
  world.addSystem(renderSystem);
  world.addSystem(projectileSystem);
  world.addSystem(towerSystem);
  // world.addSystem(summonedUnitSystem); // Disabled for server-authoritative units
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createPVPPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();

  return { player: playerEntity, controlSystem, towerSystem };
}

function createPVPPlayer(world: World): any {
  // Create player entity
  const player = world.createEntity();

  // Add Transform component
  const transform = world.createComponent(Transform);
  transform.setPosition(0, 0.5, 0); // Position sphere center at radius height above ground
  player.addComponent(transform);

  // NOTE: Local players do NOT get interpolation buffers
  // Only remote players use interpolation for smooth movement

  // Add Movement component
  const movement = world.createComponent(Movement);
  movement.maxSpeed = 3.75; // Reduced from 8 to 3.65 for slower movement
  movement.jumpForce = 8;
  movement.friction = 0.85;
  player.addComponent(movement);

  // Add Health component with level-based max health
  const maxHealth = ExperienceSystem.getMaxHealthForLevel(1); // Start at level 1
  const health = new Health(maxHealth);
  health.enableRegeneration(2, 5); // Slower regen in PVP: 1 HP per second after 10 seconds
  player.addComponent(health);

  // Add Shield component with 100 max shield
  const shield = new Shield(250, 20, 2.5); // 100 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  // Add Collider component for environment collision and PVP damage detection
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 1.2; // Reduced collision radius for better player proximity in PVP
  collider.layer = CollisionLayer.PLAYER; // Use player layer for local player
  // Set collision mask to collide with environment only - NO player-to-player collision in PVP
  collider.setMask(CollisionLayer.ENVIRONMENT);
  collider.setOffset(0, 0.5, 0); // Center on player
  player.addComponent(collider);

  // Store player ID in userData for projectile source identification
  // Note: This will be updated when the socket ID becomes available
  player.userData = player.userData || {};
  player.userData.playerId = 'unknown';


  
  // const localCollider = player.getComponent(Collider);

  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}
