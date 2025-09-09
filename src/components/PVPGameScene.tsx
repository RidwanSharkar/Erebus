'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

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
import VenomEffect from '@/components/projectiles/VenomEffect';
import DebuffIndicator from '@/components/ui/DebuffIndicator';
import FrozenEffect from '@/components/weapons/FrozenEffect';
import StunnedEffect from '@/components/weapons/StunnedEffect';
import {
  OptimizedPVPCobraShotManager,
  OptimizedPVPBarrageManager,
  OptimizedPVPFrostNovaManager,
  OptimizedPVPViperStingManager,
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
import DivineStormManager, { triggerGlobalDivineStorm } from '@/components/weapons/DivineStormManager';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import TowerRenderer from '@/components/towers/TowerRenderer';
import SummonedUnitRenderer from '@/components/SummonedUnitRenderer';

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
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import ExperienceBar from '@/components/ui/ExperienceBar';

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
}

export function PVPGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate, onExperienceUpdate }: PVPGameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const {
    players,
    towers,
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
    damageTower, // New function for tower damage
    socket
  } = useMultiplayer();
  
  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const towerSystemRef = useRef<TowerSystem | null>(null);
  const summonedUnitSystemRef = useRef<SummonedUnitSystem | null>(null);
  const reanimateRef = useRef<ReanimateRef>(null);
  const isInitialized = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);
  
  // Create a ref for the Viper Sting manager that includes position and rotation
  const viperStingParentRef = useRef({
    position: new Vector3(0, 0.5, 0),
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  });
  
  // Track server player to local ECS entity mapping for PVP damage
  const serverPlayerEntities = useRef<Map<string, number>>(new Map());
  
  // Track server tower to local ECS entity mapping
  const serverTowerEntities = useRef<Map<string, number>>(new Map());

  // Track server summoned unit to local ECS entity mapping
  const serverSummonedUnitEntities = useRef<Map<string, number>>(new Map());

  // Experience system state
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);

  // Mana system state for Runeblade
  const [currentMana, setCurrentMana] = useState(150);
  const maxMana = 150;

  // Track current weapon for mana management
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.BOW);

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
    debuffType: 'frozen' | 'slowed' | 'stunned';
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextDebuffEffectId = useRef(0);

  // PVP Frost Nova Effect Management
  const [pvpFrostNovaEffects, setPvpFrostNovaEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextFrostNovaEffectId = useRef(0);
  
  // Function to create venom effect on PVP players
  // Function to create debuff effect on PVP players
  const createPvpDebuffEffect = useCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned', position: Vector3, duration: number = 5000) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    const debuffEffect = {
      id: nextDebuffEffectId.current++,
      playerId,
      debuffType,
      position: position.clone(),
      startTime: Date.now(),
      duration
    };
    
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
        }
      }
    }
    
    // Clean up debuff effect after duration using batched updates
    setTimeout(() => {
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
    console.log(`🎣 Creating DeathGraspPull effect for target ${targetPlayerId} from position:`, casterPosition);

    const deathGraspPull = {
      id: nextDeathGraspPullId.current++,
      targetPlayerId,
      casterPosition: casterPosition.clone(),
      startTime: Date.now(),
      duration: 600, // 0.6 seconds pull duration (matches DeathGraspPull component)
      isActive: true
    };

    console.log(`🎣 DeathGraspPull created with ID ${deathGraspPull.id}`);

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

  // Function to handle wave completion and award experience
  const handleWaveComplete = useCallback(() => {
    console.log(`🌊 Wave completed! Awarding 10 EXP to both players`);

    // Award 10 EXP to BOTH players when a wave completes
    const allPlayerIds = Array.from(players.keys());

    allPlayerIds.forEach(playerId => {
      if (playerId === socket?.id) {
        // Local player gets the experience
        setPlayerExperience(prev => {
          const newExp = prev + 10;

          // Check for level up
          const newLevel = ExperienceSystem.getLevelFromExperience(newExp);
          if (newLevel > playerLevel) {
            setPlayerLevel(newLevel);
            console.log(`🎉 Level up! Player reached level ${newLevel}`);

        // Update max health based on new level
        if (playerEntity) {
          const health = playerEntity.getComponent(Health);
          if (health) {
            const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
            const oldMaxHealth = health.maxHealth;

            // Update max health and scale current health proportionally
            health.setMaxHealth(newMaxHealth);

            // Synchronize the updated health with server and other players
            updatePlayerHealth(health.currentHealth, health.maxHealth);

            console.log(`💚 Health updated: ${oldMaxHealth} -> ${newMaxHealth} HP (current: ${health.currentHealth}/${health.maxHealth})`);
          }
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
  }, [socket?.id, playerLevel, playerEntity, players]);

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
    isSundering: false
  });
  
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
    lastAttackType?: string;
    lastAttackTime?: number;
    lastAnimationUpdate?: number;
  }>>(new Map());
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();
  
  // Optimized PVP effects with object pooling
  const { createOptimizedVenomEffect, createOptimizedDebuffEffect, getPoolStats } = useOptimizedPVPEffects();

  // Mana regeneration for Runeblade (8 mana per second, same as Scythe)
  useEffect(() => {
    if (currentWeapon === WeaponType.RUNEBLADE) {
      const interval = setInterval(() => {
        setCurrentMana(prev => Math.min(maxMana, prev + 4));
      }, 500);

      return () => clearInterval(interval);
    }
  }, [currentWeapon, maxMana]);

  // Sync currentWeapon with weaponState
  useEffect(() => {
    setCurrentWeapon(weaponState.currentWeapon);
  }, [weaponState.currentWeapon]);

  // Weapon switching - reset mana when switching to Runeblade
  useEffect(() => {
    if (currentWeapon === WeaponType.RUNEBLADE) {
      setCurrentMana(maxMana); // Start with full mana (150)
    }
  }, [currentWeapon, maxMana]);

  // Function to consume mana for Runeblade abilities
  const consumeMana = useCallback((amount: number) => {
    console.log('🔍 DEBUG: consumeMana called - currentWeapon:', currentWeapon, 'amount:', amount);
    if (currentWeapon === WeaponType.RUNEBLADE) {
      setCurrentMana(prev => {
        const newValue = Math.max(0, prev - amount);
        console.log('🔍 DEBUG: consumeMana - old mana:', prev, 'new mana:', newValue);
        return newValue;
      });
    }
  }, [currentWeapon]);

  // Function to check if Runeblade has enough mana
  const hasMana = useCallback((amount: number) => {
    console.log('🔍 DEBUG: hasMana called - currentMana:', currentMana, 'amount:', amount);
    const result = currentMana >= amount;
    console.log('🔍 DEBUG: hasMana result:', result);
    return result;
  }, [currentMana]);

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const handlePlayerAttack = (data: any) => {
      if (data.playerId !== socket.id && engineRef.current) {
        // Handle perfect shot beam effects
        if (data.attackType === 'bow_release' && data.animationData?.isPerfectShot) {
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Get the player's subclass from the players map
          const player = players.get(data.playerId);
          const subclass = player?.subclass || WeaponSubclass.ELEMENTAL;
          
          // Create perfect shot beam effect
          createPowershotEffect(
            position,
            direction,
            subclass,
            true, // isPerfectShot
            true  // isElementalShotsUnlocked
          );
        }
        
        // Handle special ability projectiles that need custom visual effects
        if (data.attackType === 'viper_sting_projectile') {
          // Skip processing our own viper sting projectiles to prevent self-damage
          if (data.playerId === socket.id) {
            return;
          }

          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          // Create the ECS projectile for damage
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
          
          // Trigger visual effect for Viper Sting projectile
          const { triggerGlobalViperSting } = require('@/components/projectiles/ViperStingManager');
          
          // Update the Viper Sting parent ref to the other player's position for visual effect
          const originalPosition = viperStingParentRef.current.position.clone();
          const originalQuaternion = { ...viperStingParentRef.current.quaternion };
          
          // Temporarily set the parent ref to the other player's position and direction
          viperStingParentRef.current.position.copy(position);
          
          // Calculate quaternion from the other player's direction
          const angle = Math.atan2(direction.x, direction.z);
          viperStingParentRef.current.quaternion = {
            x: 0,
            y: Math.sin(angle / 2),
            z: 0,
            w: Math.cos(angle / 2)
          };
          
          // Trigger the Viper Sting visual effect
          triggerGlobalViperSting();
          
          // Restore original parent ref position and rotation
          setTimeout(() => {
            viperStingParentRef.current.position.copy(originalPosition);
            viperStingParentRef.current.quaternion = originalQuaternion;
          }, 100);
          
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
                projectileSystem.createChargedArrowProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 35, damage: 50, lifetime: 3, piercing: true, opacity: 0.8 }
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
                projectileSystem.createChargedArrowProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 40, damage: 75, lifetime: 3, piercing: true, opacity: 1.0 }
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
        // Handle special abilities like Divine Storm, Viper Sting, and Barrage
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
          // Skip processing our own viper sting abilities to prevent any potential issues
          if (data.playerId === socket.id) {
            return;
          }

          // Trigger visual effect - this should create the proper Viper Sting projectiles
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Update the Viper Sting parent ref to the other player's position for visual effect
          const originalPosition = viperStingParentRef.current.position.clone();
          const originalQuaternion = { ...viperStingParentRef.current.quaternion };
          
          // Temporarily set the parent ref to the other player's position and direction
          viperStingParentRef.current.position.copy(position);
          
          // Calculate quaternion from the other player's direction
          const angle = Math.atan2(direction.x, direction.z);
          viperStingParentRef.current.quaternion = {
            x: 0,
            y: Math.sin(angle / 2),
            z: 0,
            w: Math.cos(angle / 2)
          };
          
          // Trigger the Viper Sting visual effect
          const success = triggerGlobalViperSting();
          
          // Restore original parent ref position after a short delay
          setTimeout(() => {
            viperStingParentRef.current.position.copy(originalPosition);
            viperStingParentRef.current.quaternion = originalQuaternion;
          }, 100);
          
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
              isBackstabbing: false
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
          // Skip processing our own barrage abilities to prevent any potential issues
          if (data.playerId === socket.id) {
            return;
          }

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
              isBackstabbing: false
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
        } else if (data.abilityType === 'deathgrasp') {

          // Create death grasp visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          const targetPosition = position.clone().add(direction.clone().multiplyScalar(8));

          createPvpDeathGraspEffect(data.playerId, position, direction);

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
              isBackstabbing: false
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
              isBackstabbing: false
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
              isBackstabbing: false
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
              isBackstabbing: false
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
              isBackstabbing: false
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
        }
      }
    };

    const handlePlayerDamaged = (data: any) => {
      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket.id && playerEntity) {
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Pass the entity so Health component can use Shield for damage absorption
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity);
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
            isBackstabbing: false
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

      if (data.effect?.type === 'deathgrasp_pull') {
        const { targetPlayerId, position, casterId } = data.effect;
        console.log(`🎣 Received DeathGrasp pull effect for target ${targetPlayerId} from caster ${casterId}`);

        // If this client is the target player, update the local position
        if (targetPlayerId === socket?.id && position) {
          const pullPosition = new Vector3(position.x, position.y, position.z);
          console.log(`🎣 Applying DeathGrasp pull to local player, moving to:`, pullPosition);

          // Update local player entity position
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              transform.setPosition(pullPosition.x, pullPosition.y, pullPosition.z);
              console.log(`🎣 Local player position updated via DeathGrasp pull`);
            }
          }
        }
      }
    };

    const handlePlayerDebuff = (data: any) => {
      console.log('🎯 Received PVP player debuff:', data);
      console.log(`🔍 Debug: My socket ID is "${socket?.id}", target is "${data.targetPlayerId}", am I the target? ${socket?.id === data.targetPlayerId}`);
      
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

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-animation-state', handlePlayerAnimationState);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);

    return () => {
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-used-ability', handlePlayerAbility);
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-debuff', handlePlayerDebuff);
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
        const shield = new Shield(100, 20, 5); // 100 max shield, 20/s regen, 5s delay
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
            health.maxHealth = serverPlayer.maxHealth;
            health.currentHealth = serverPlayer.health;
          }
        } else {
          console.warn(`⚠️ Could not find local ECS entity ${entityId} for PVP player ${playerId}`);
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
          console.log(`💀 Marked local ECS entity ${entityId} as dead for disconnected player ${playerId}`);
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
          console.log(`💀 Marked local ECS entity ${entityId} as dead for removed tower ${towerId}`);
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
          console.log(`🎯 Mapping local entity ${entityId} to server player ${serverPlayerId} for ${damage} PVP damage`);
          broadcastPlayerDamage(serverPlayerId, damage);
        } else {
          console.warn(`⚠️ Could not find server player ID for local entity ${entityId}`);
        }
      };
      
      const { player, controlSystem, towerSystem, summonedUnitSystem } = setupPVPGame(engine, scene, camera as PerspectiveCamera, gl, damagePlayerWithMapping, damageTower);
      console.log('🎮 PVP Player entity created:', player, 'ID:', player.id);
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      towerSystemRef.current = towerSystem;
      summonedUnitSystemRef.current = summonedUnitSystem;
      
      // Set up tower system with player mapping
      if (towerSystem && socket?.id) {
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }

      // Set up wave completion callback for experience awarding
      if (summonedUnitSystem) {
        summonedUnitSystem.setWaveCompleteCallback(handleWaveComplete);
      }
      
      // Pass controlSystem back to parent
      if (onControlSystemUpdate) {
        onControlSystemUpdate(controlSystem);
      }
      
      // Set up PVP callbacks (AFTER playerEntity is set)
      controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
        
        // Broadcast attack to other players
        if (playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          if (transform) {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            
            broadcastPlayerAttack('bow_release', transform.position, direction, {
              chargeProgress: finalProgress,
              isPerfectShot: isPerfectShot
            });
          }
        }
        
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
        console.log('⚡ PVP Divine Storm activated - broadcasting to other players');
        
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
        console.log('🌟 PVP Skyfall triggered - broadcasting to other players');
        broadcastPlayerAbility('skyfall', position, direction);
      });
      
      // Set up Backstab callback
      controlSystem.setBackstabCallback((position, direction, damage, isBackstab) => {
        console.log(`🗡️ PVP Backstab triggered - broadcasting to other players (damage: ${damage}, backstab: ${isBackstab})`);
        broadcastPlayerAbility('backstab', position, direction);
        // Note: Animation state is now broadcasted automatically in the game loop
      });
      
      // Set up Sunder callback
      controlSystem.setSunderCallback((position, direction, damage, stackCount) => {
        console.log(`⚔️ PVP Sunder triggered - broadcasting to other players (damage: ${damage}, stacks: ${stackCount})`);
        broadcastPlayerAbility('sunder', position, direction);
        // Note: Animation state is now broadcasted automatically in the game loop
      });
      
      // Set up Debuff callback for broadcasting freeze/slow effects
      console.log(`🔧 Debug: Setting up debuff callback for ControlSystem`);
      controlSystem.setDebuffCallback((targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned', duration: number, position: Vector3) => {
        console.log(`🎯 PVP Debuff callback triggered - ${debuffType} effect on entity ${targetEntityId}`);
        
        // Find the server player ID that corresponds to this local ECS entity ID
        let targetPlayerId: string | null = null;
        serverPlayerEntities.current.forEach((localEntityId, playerId) => {
          if (localEntityId === targetEntityId) {
            targetPlayerId = playerId;
          }
        });
        
        if (targetPlayerId && broadcastPlayerDebuff) {
          console.log(`🎯 Broadcasting ${debuffType} effect to player ${targetPlayerId}`);
          broadcastPlayerDebuff(targetPlayerId, debuffType, duration, {
            position: { x: position.x, y: position.y, z: position.z }
          });
        } else {
          console.warn(`⚠️ Could not find server player ID for local entity ${targetEntityId}`);
        }
      });
      
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
        console.log('🔍 DEBUG: Smite callback triggered in PVP mode');
        // Create local Smite effect
        createPvpSmiteEffect(socket?.id || '', position, onDamageDealt);

        // Broadcast Smite ability to other players
        broadcastPlayerAbility('smite', position, direction);
      });

      // Set up DeathGrasp callback
      controlSystem.setDeathGraspCallback((position: Vector3, direction: Vector3) => {
        console.log('🔍 DEBUG: DeathGrasp callback triggered in PVP mode');

        // Create local DeathGrasp projectile effect
        createPvpDeathGraspEffect(socket?.id || '', position, direction);

        // Broadcast DeathGrasp ability to other players
        broadcastPlayerAbility('deathgrasp', position, direction);
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
      console.log('🧮 Available Interpolation Methods:');
      console.log('1. Linear Interpolation (LERP) - Currently used');
      console.log('2. Hermite Spline - Smoother curves with velocity');
      console.log('3. Catmull-Rom Spline - Smooth curves through waypoints');
      console.log('4. Cubic Bezier - Custom control point curves');
      console.log('5. Smooth Step - Easing functions');
      console.log('6. Smoother Step - Even smoother easing');

      console.log('\n📊 Current Interpolation Stats:');
      console.log((window as any).getInterpolationStats());

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
      
      // Collect all state updates to batch them
      const stateUpdates: Array<{
        setter: React.Dispatch<React.SetStateAction<any>>;
        value: any;
      }> = [];
      
      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform && transform.position) {
          const newPosition = transform.position.clone();
          stateUpdates.push({
            setter: setPlayerPosition,
            value: newPosition
          });
          
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
          isSpinning: controlSystemRef.current.isWeaponCharging() && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE,
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
          isSundering: controlSystemRef.current.isSunderActive()
        };
        
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
        
        stateUpdates.push({
          setter: setWeaponState,
          value: newWeaponState
        });
        
        // Broadcast animation state changes to other players (throttled to avoid spam)
        const now = Date.now();
        if (now - lastAnimationBroadcast.current > 100) { // Throttle to 10 times per second
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
            isBackstabbing: newWeaponState.isBackstabbing // Broadcast backstab animation state
          };
          broadcastPlayerAnimationState(animationStateToSend);
          lastAnimationBroadcast.current = now;
        }
      }

      // Update damage numbers from combat system
      const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
      if (combatSystem && onDamageNumbersUpdate) {
        onDamageNumbersUpdate(combatSystem.getDamageNumbers());
      }

      // Update camera information for damage number positioning
      if (onCameraUpdate) {
        onCameraUpdate(camera, size);
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

      // Update game state for UI
      if (onGameStateUpdate && playerEntity && controlSystemRef.current) {
        const healthComponent = playerEntity.getComponent(Health);
        const shieldComponent = playerEntity.getComponent(Shield);
        if (healthComponent) {
          const gameState = {
            playerHealth: healthComponent.currentHealth,
            maxHealth: healthComponent.maxHealth,
            playerShield: shieldComponent ? shieldComponent.currentShield : 0,
            maxShield: shieldComponent ? shieldComponent.maxShield : 0,
            currentWeapon: controlSystemRef.current.getCurrentWeapon(),
            currentSubclass: controlSystemRef.current.getCurrentSubclass(),
            // Add mana information for Runeblade
            mana: currentWeapon === WeaponType.RUNEBLADE ? currentMana : 150,
            maxMana: currentWeapon === WeaponType.RUNEBLADE ? maxMana : 150
          };
          onGameStateUpdate(gameState);
          
          // Update multiplayer health
          updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
        }
      }
      
      // Batch all collected state updates at the end of the frame
      if (stateUpdates.length > 0) {
        PVPStateUpdateHelpers.batchGameStateUpdates(stateUpdates);
      }
    }
  });

  // Expose damage number completion handler for parent component
  React.useEffect(() => {
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

      {/* Ground - matches 29-unit map boundary */}
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <cylinderGeometry args={[29, 29, 1, 6]} />
        <meshStandardMaterial color="#2d5a2d" />
      </mesh>

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
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
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
        />
      )}

      {/* Other Players Dragon Renderers */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't render our own player twice
        
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
          isBackstabbing: false
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
            rotation={player.rotation}
            isLocalPlayer={false}
            onBowRelease={() => {}}
            onScytheSwingComplete={() => {}}
            onSwordSwingComplete={() => {}}
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

      {/* Summoned Units */}
      {engineRef.current && (() => {
        const world = engineRef.current.getWorld();
        const summonedUnits = world.queryEntities([Transform, SummonedUnit, Health]);

        return summonedUnits.map(entity => {
          const transform = entity.getComponent(Transform);
          const unit = entity.getComponent(SummonedUnit);
          const health = entity.getComponent(Health);

          if (!transform || !unit || !health || unit.isDead || health.isDead) {
            return null;
          }

          return (
            <SummonedUnitRenderer
              key={unit.unitId}
              entityId={entity.id}
              world={world}
              position={transform.position}
              ownerId={unit.ownerId}
              health={health.currentHealth}
              maxHealth={unit.maxHealth}
              isDead={unit.isDead}
            />
          );
        }).filter(Boolean); // Remove null entries
      })()}

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
                console.log(`⚠️ Skipping Cobra Shot damage to local player ${socket?.id}`);
                return;
              }
              
              if (broadcastPlayerDamage) {
                console.log(`🎯 Broadcasting Cobra Shot damage to player ${playerId} (NOT local player ${socket?.id})`);
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply venom effect to the local player
              if (playerId === socket?.id) {
                console.log(`⚠️ Skipping Cobra Shot venom effect on local player ${socket?.id}`);
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition);
              
              // Broadcast venom effect to all players so they can see it
              if (broadcastPlayerEffect) {
                console.log(`🎯 Broadcasting Cobra Shot venom effect to player ${playerId} (NOT local player ${socket?.id})`);
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
                console.log(`⚠️ Skipping Barrage damage to local player ${socket?.id}`);
                return;
              }
              
              if (broadcastPlayerDamage) {
                console.log(`🎯 Broadcasting Barrage damage to player ${playerId} (NOT local player ${socket?.id})`);
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerSlowed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply slow effect to the local player
              if (playerId === socket?.id) {
                console.log(`⚠️ Skipping Barrage slow effect on local player ${socket?.id}`);
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpDebuffEffect(playerId, 'slowed', clonedPosition, 5000); // 5 second slow
              
              // Broadcast debuff effect to all players so they can see it
              if (broadcastPlayerDebuff) {
                console.log(`🎯 Broadcasting Barrage slow effect to player ${playerId} (NOT local player ${socket?.id})`);
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
                console.log(`⚠️ Skipping Frost Nova damage to local player ${socket?.id}`);
                return;
              }
              
              if (broadcastPlayerDamage) {
                console.log(`🎯 Broadcasting Frost Nova damage to player ${playerId} (NOT local player ${socket?.id})`);
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerFrozen={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply frozen effect to the local player
              if (playerId === socket?.id) {
                console.log(`⚠️ Skipping Frost Nova frozen effect on local player ${socket?.id}`);
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
                console.log(`⚠️ Skipping Viper Sting damage to local player ${socket?.id}`);
                return;
              }

              if (broadcastPlayerDamage) {
                console.log(`🎯 Broadcasting Viper Sting damage to player ${playerId} (NOT local player ${socket?.id})`);
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply venom effect to the local player
              if (playerId === socket?.id) {
                console.log(`⚠️ Skipping Viper Sting venom effect on local player ${socket?.id}`);
                return;
              }

              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition);
            }}
          />
          
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
                        console.log(`⚡ Smite (PVP visual fallback) healed player for 20 HP! Health: ${oldHealth} -> ${healthComponent.currentHealth}/${healthComponent.maxHealth}`);
                      }
                    }
                  }
                })}
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
                  console.log(`🎯 DeathGrasp hit target: ${targetId} at position:`, position);
                  console.log(`🎯 DeathGrasp caster position:`, currentStartPosition);
                  console.log(`🎯 DeathGrasp creating pull effect for target ${targetId}`);
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
                  onComplete={() => {
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            }
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
  damageTowerCallback: (towerId: string, damage: number) => void
): { player: any; controlSystem: ControlSystem; towerSystem: TowerSystem; summonedUnitSystem: SummonedUnitSystem } {
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
  const summonedUnitSystem = new SummonedUnitSystem(world);
  const controlSystem = new ControlSystem(
    camera as PerspectiveCamera,
    inputManager,
    world,
    projectileSystem
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
  const interpolationSystem = new InterpolationSystem();

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  towerSystem.setProjectileSystem(projectileSystem);
  summonedUnitSystem.setCombatSystem(combatSystem);

  // Set up combat system to route player damage through PVP system
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);
  
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
  world.addSystem(summonedUnitSystem);
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createPVPPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();
  
      console.log('🌍 Total entities in PVP world:', world.getAllEntities().length);
      console.log(`👤 Player entity created with ID: ${playerEntity.id}`);

  return { player: playerEntity, controlSystem, towerSystem, summonedUnitSystem };
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
  const shield = new Shield(250, 20, 2); // 100 max shield, 20/s regen, 5s delay
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

  console.log('👤 PVP player entity created with components:', {
    transform: !!player.getComponent(Transform),
    movement: !!player.getComponent(Movement),
    health: !!player.getComponent(Health),
    shield: !!player.getComponent(Shield),
    collider: !!player.getComponent(Collider),
  });
  
  const localCollider = player.getComponent(Collider);

  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}
