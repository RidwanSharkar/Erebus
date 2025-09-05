'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color } from '@/utils/three-exports';
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
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem } from '@/systems/ControlSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { TowerSystem } from '@/systems/TowerSystem';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';
import Reanimate from '@/components/weapons/Reanimate';
import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import FrostNova from '@/components/weapons/FrostNova';
import CobraShotManager from '@/components/projectiles/CobraShotManager';
import { CobraShotProjectile } from '@/components/projectiles/CobraShot';
import ViperStingManager from '@/components/projectiles/ViperStingManager';
import VenomEffect from '@/components/projectiles/VenomEffect';
import DebuffIndicator from '@/components/ui/DebuffIndicator';
import FrozenEffect from '@/components/weapons/FrozenEffect';
import DivineStormManager, { triggerGlobalDivineStorm } from '@/components/weapons/DivineStormManager';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import TowerRenderer from '@/components/towers/TowerRenderer';

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

function PVPCobraShotManager({ world, players, onPlayerHit, onPlayerVenomed, serverPlayerEntities, localSocketId }: PVPCobraShotManagerProps) {
  // This component monitors visual Cobra Shot projectiles and checks for hits against PVP players
  useFrame(() => {
    // Get visual Cobra Shot projectiles from the CobraShotManager
    const { getGlobalCobraShotProjectiles } = require('@/components/projectiles/CobraShotManager');
    const cobraShotProjectiles = getGlobalCobraShotProjectiles();
    
    // Check each active Cobra Shot projectile for player hits
    cobraShotProjectiles.forEach((projectile: CobraShotProjectile) => {
      if (!projectile.active) return;
      
      const projectilePos = projectile.position;
      
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }
        
        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
        const distance = projectilePos.distanceTo(playerPos);
        
        if (distance <= 1.5) { // Hit radius
          // Convert player ID to number for hit tracking (consistent with CobraShotProjectile type)
          const playerIdNum = parseInt(player.id) || player.id.length; // Convert to number
          
          // Check if we haven't already hit this player
          if (!projectile.hitEnemies.has(playerIdNum)) {
            projectile.hitEnemies.add(playerIdNum);
            onPlayerHit(player.id, 29); // Cobra Shot damage
            
            // Apply venom effect at the HIT player's position (not the caster)
            console.log(`🐍 Cobra Shot projectile ${projectile.id} hit player ${player.id} (local: ${player.id === localSocketId}), applying venom effect at target position:`, playerPos.toArray());
            onPlayerVenomed(player.id, playerPos.clone());
            
            // Mark projectile as inactive to stop further hits
            projectile.active = false;
            projectile.fadeStartTime = Date.now();
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

function PVPBarrageManager({ world, players, onPlayerHit, onPlayerSlowed, serverPlayerEntities, localSocketId }: PVPBarrageManagerProps) {
  // This component monitors ECS Barrage projectiles and checks for hits against PVP players
  const hitTracker = useRef<Set<string>>(new Set()); // Track hits to prevent multiple hits per projectile per player
  
  useFrame(() => {
    if (!world) return;
    
    // Get all projectile entities from the world
    const allEntities = world.getAllEntities();
    const projectileEntities = allEntities.filter(entity => 
      entity.hasComponent(Projectile) && entity.hasComponent(Transform) && entity.hasComponent(Renderer)
    );
    
    // Check each Barrage projectile for player hits
    projectileEntities.forEach(projectileEntity => {
      const renderer = projectileEntity.getComponent(Renderer);
      const transform = projectileEntity.getComponent(Transform);
      const projectile = projectileEntity.getComponent(Projectile);
      
      // Only check Barrage arrows
      if (!renderer?.mesh?.userData?.isBarrageArrow || !transform || !projectile) return;
      
      const projectilePos = transform.position;
      
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }
        
        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
        const distance = projectilePos.distanceTo(playerPos);
        
        if (distance <= 1.25) { // Hit radius
          // Create unique hit key to prevent multiple hits
          const hitKey = `${projectileEntity.id}-${player.id}`;
          
          // Check if we haven't already hit this player with this projectile
          const playerEntityId = serverPlayerEntities.current.get(player.id);
          if (playerEntityId && !projectile.hasHitTarget(playerEntityId) && !hitTracker.current.has(hitKey)) {
            projectile.addHitTarget(playerEntityId);
            hitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 30); // Barrage damage
            
            // Apply slow effect at the HIT player's position (50% speed reduction for 5 seconds)
            console.log(`🏹 Barrage projectile ${projectileEntity.id} hit player ${player.id}, applying slow effect at target position:`, playerPos.toArray());
            onPlayerSlowed(player.id, playerPos.clone());
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              hitTracker.current.delete(hitKey);
            }, 10000); // Clean up after 10 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

function PVPFrostNovaManager({ world, players, onPlayerHit, onPlayerFrozen, serverPlayerEntities, localSocketId }: PVPFrostNovaManagerProps) {
  // This component monitors FrostNova effects and checks for hits against PVP players
  const frostNovaHitTracker = useRef<Set<string>>(new Set()); // Track hits to prevent multiple hits per frost nova per player
  const lastUpdateTime = useRef(0);
  
  useFrame(() => {
    if (!world) return;
    
    // Throttle updates to avoid excessive checking
    const now = Date.now();
    if (now - lastUpdateTime.current < 50) return; // Update every 50ms
    lastUpdateTime.current = now;
    
    // Get active frost nova effects from the FrostNovaManager
    const { getActiveFrostNovas } = require('@/components/weapons/FrostNovaManager');
    const activeFrostNovas = getActiveFrostNovas ? getActiveFrostNovas() : [];
    
    // Check each active frost nova for player hits
    activeFrostNovas.forEach((frostNova: any) => {
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }
        
        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
        const frostNovaPos = frostNova.position;
        const distance = frostNovaPos.distanceTo(playerPos);
        const frostNovaRadius = 6.0; // Same radius as ControlSystem
        
        if (distance <= frostNovaRadius) {
          // Create unique hit key to prevent multiple hits
          const hitKey = `${frostNova.id}-${player.id}`;
          
          // Check if we haven't already hit this player with this frost nova
          if (!frostNovaHitTracker.current.has(hitKey)) {
            frostNovaHitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 50); // FrostNova damage
            
            // Apply freeze effect at the HIT player's position
            console.log(`❄️ FrostNova ${frostNova.id} hit player ${player.id}, applying freeze effect at target position:`, playerPos.toArray());
            onPlayerFrozen(player.id, playerPos.clone());
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              frostNovaHitTracker.current.delete(hitKey);
            }, 7000); // Clean up after 10 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import { triggerGlobalBarrage } from '@/components/projectiles/BarrageManager';

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
}

export function PVPGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate }: PVPGameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const { 
    players, 
    towers,
    gameStarted,
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
  
  // PVP Reanimate Effect Management
  const [pvpReanimateEffects, setPvpReanimateEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextReanimateEffectId = useRef(0);
  
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
    debuffType: 'frozen' | 'slowed';
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
  const createPvpDebuffEffect = useCallback((playerId: string, debuffType: 'frozen' | 'slowed', position: Vector3, duration: number = 5000) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    console.log(`🎯 Creating PVP ${debuffType} effect for player ${playerId} (isLocal: ${isLocalPlayer}) at position:`, position.toArray());
    console.log(`🔍 Debug: playerId="${playerId}", socket?.id="${socket?.id}", comparison result: ${playerId === socket?.id}`);
    
    const debuffEffect = {
      id: nextDebuffEffectId.current++,
      playerId,
      debuffType,
      position: position.clone(),
      startTime: Date.now(),
      duration
    };
    
    setPvpDebuffEffects(prev => [...prev, debuffEffect]);
    
    // Apply the debuff to the local player's movement if this is targeting us
    if (isLocalPlayer && playerEntity) {
      const playerMovement = playerEntity.getComponent(Movement);
      if (playerMovement) {
        if (debuffType === 'frozen') {
          playerMovement.freeze(duration);
          console.log(`🧊 Applied freeze to local player for ${duration}ms - movement speed set to 0`);
        } else if (debuffType === 'slowed') {
          playerMovement.slow(duration, 0.5); // 50% speed reduction
          console.log(`🐌 Applied slow to local player for ${duration}ms - movement speed reduced to 50%`);
        }
      }
    }
    
    // Clean up debuff effect after duration
    setTimeout(() => {
      setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
      console.log(`🎯 PVP ${debuffType} effect expired for player ${playerId}`);
    }, debuffEffect.duration);
  }, [socket?.id, playerEntity]);

  // Function to create frozen effect on PVP players (called by PVPFrostNovaManager)
  const createPvpFrozenEffect = useCallback((playerId: string, position: Vector3) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    console.log(`❄️ Creating PVP frozen effect for player ${playerId} (isLocal: ${isLocalPlayer}) at position:`, position.toArray());
    
    // Create the frozen debuff effect (3 second freeze)
    createPvpDebuffEffect(playerId, 'frozen', position, 5000);
    
    // Broadcast debuff effect to all players so they can see it
    if (broadcastPlayerDebuff) {
      broadcastPlayerDebuff(playerId, 'frozen', 5000, {
        position: { x: position.x, y: position.y, z: position.z }
      });
      console.log(`❄️ Broadcasting frozen effect for player ${playerId}`);
    }
  }, [createPvpDebuffEffect, broadcastPlayerDebuff]);

  // Function to create reanimate effect on PVP players
  const createPvpReanimateEffect = useCallback((playerId: string, position: Vector3) => {
    console.log(`🌿 Creating PVP reanimate effect for player ${playerId} at position:`, position.toArray());
    
    const reanimateEffect = {
      id: nextReanimateEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1500 // 1.5 seconds reanimate duration (matches Reanimate component)
    };
    
    setPvpReanimateEffects(prev => [...prev, reanimateEffect]);
    
    // Clean up reanimate effect after duration
    setTimeout(() => {
      setPvpReanimateEffects(prev => prev.filter(effect => effect.id !== reanimateEffect.id));
      console.log(`🌿 PVP reanimate effect expired for player ${playerId}`);
    }, reanimateEffect.duration);
  }, []);

  // Function to create frost nova effect on PVP players
  const createPvpFrostNovaEffect = useCallback((playerId: string, position: Vector3) => {
    console.log(`❄️ Creating PVP frost nova effect for player ${playerId} at position:`, position.toArray());
    
    const frostNovaEffect = {
      id: nextFrostNovaEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200 // 1.2 seconds frost nova duration (matches FrostNovaManager)
    };
    
    setPvpFrostNovaEffects(prev => [...prev, frostNovaEffect]);
    
    // Clean up frost nova effect after duration
    setTimeout(() => {
      setPvpFrostNovaEffects(prev => prev.filter(effect => effect.id !== frostNovaEffect.id));
      console.log(`❄️ PVP frost nova effect expired for player ${playerId}`);
    }, frostNovaEffect.duration);
  }, []);

  const createPvpVenomEffect = useCallback((playerId: string, position: Vector3) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    console.log(`☠️ Creating PVP venom effect for player ${playerId} (isLocal: ${isLocalPlayer}) at position:`, position.toArray());
    
    // SAFETY CHECK: Don't create venom effects on the local player
    if (isLocalPlayer) {
      console.warn(`⚠️ Attempted to create venom effect on local player ${playerId} - this should not happen!`);
      return;
    }
    
    const venomEffect = {
      id: nextVenomEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 6000 // 6 seconds venom duration
    };
    
    setPvpVenomEffects(prev => [...prev, venomEffect]);
    
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
      console.log(`☠️ Venom tick ${tickCount}/${maxTicks} - dealing ${venomDamagePerSecond} damage to player ${playerId} (isLocal: ${isLocalPlayer})`);
      if (broadcastPlayerDamage) {
        broadcastPlayerDamage(playerId, venomDamagePerSecond);
      }
    }, tickInterval);
    
    // Clean up venom effect after duration
    setTimeout(() => {
      setPvpVenomEffects(prev => prev.filter(effect => effect.id !== venomEffect.id));
      console.log(`☠️ PVP venom effect expired for player ${playerId}`);
    }, venomEffect.duration);
  }, [socket?.id, broadcastPlayerDamage]);
  
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
    isBackstabbing: false
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

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const handlePlayerAttack = (data: any) => {
      console.log('⚔️ Received PVP player attack:', data);
      if (data.playerId !== socket.id && engineRef.current) {
        // Handle perfect shot beam effects
        if (data.attackType === 'bow_release' && data.animationData?.isPerfectShot) {
          console.log('🌟 Creating perfect shot beam effect for PVP player!');
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
          console.log('🐍 Creating PVP Viper Sting visual effect from player', data.playerId);
          
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
              { speed: 16, damage: 61, lifetime: 5, piercing: true, opacity: 0.8 }
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
          console.log('🐍 Creating PVP Cobra Shot visual effect from player', data.playerId);
          
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
          console.log('⚔️ Received PVP sword charge hit from player', data.playerId, 'animationData:', data.animationData);
          
          // Validate animationData object exists and has required properties
          if (!data.animationData || typeof data.animationData.damage !== 'number' || typeof data.animationData.targetId !== 'number') {
            console.warn('⚠️ Invalid sword charge hit animationData:', data.animationData);
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
                console.log(`⚔️ Took ${data.animationData.damage} charge damage from ${data.playerId}`);
              }
            }
          }
          
          return; // Don't process as regular projectile
        }
        
        // Handle regular projectile attacks - create projectiles that can hit the local player
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile'];
        if (projectileTypes.includes(data.attackType)) {
          console.log('🏹 Creating PVP projectile:', data.attackType, 'from player', data.playerId);
          
          // Create a projectile that can damage the local player
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            const position = new Vector3(data.position.x, data.position.y, data.position.z);
            const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
            
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
          }
        }
        
        // Update the player state to show attack animation
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
            cobraShotChargeProgress: 0
          };
          
          // If there's already an active animation, we'll override it with the new one
          // This prevents animation stacking and ensures clean transitions
          
          // Extract animation data from the attack
          const animationData = data.animationData || {};
          
          // Store the animation update time to check against later
          const animationUpdateTime = Date.now();
          
          updated.set(data.playerId, {
            ...currentState,
            isSwinging: data.attackType.includes('swing') || (data.attackType.includes('sword') && !data.attackType.includes('charge')),
            isCharging: data.attackType.includes('bow') && data.attackType.includes('charge'),
            isSpinning: data.attackType.includes('scythe') || data.attackType.includes('entropic_bolt') || data.attackType.includes('crossentropy_bolt') || data.attackType.includes('sword_charge_spin') || animationData.isSpinning || false,
            isSwordCharging: data.attackType === 'sword_charge_spin' || data.attackType === 'sword_charge_start' || animationData.isSpinning || animationData.isSwordCharging || false,
            swordComboStep: animationData.comboStep || currentState.swordComboStep,
            chargeProgress: animationData.chargeProgress || 0,
            isSkyfalling: (currentState as any).isSkyfalling || false,
            isBackstabbing: (currentState as any).isBackstabbing || false,
            lastAttackType: data.attackType,
            lastAttackTime: animationUpdateTime,
            lastAnimationUpdate: animationUpdateTime
          });
          
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
            case WeaponType.SPEAR:
              // Check if Storm subclass (has burst attacks with different timing)
              if (playerSubclass === WeaponSubclass.STORM) {
                // Storm spear burst: swingProgress += delta * 22.5 (faster)
                // At 60fps: (Math.PI * 0.75) / 22.5 / (1/60) ≈ 133ms per swing, 3 swings = ~400ms total
                resetDuration = 275;
              } else {
                // Regular spear: swingProgress += delta * 15 until >= Math.PI * 0.75
                // At 60fps: (Math.PI * 0.75) / 15 / (1/60) ≈ 200ms
                resetDuration = 200;
              }
              break;
            case WeaponType.BOW:
              resetDuration = 300; // Quick shots
              break;
            default:
              resetDuration = 100; // Default for other weapons
            }
          }
          
          setTimeout(() => {
            setMultiplayerPlayerStates(prev => {
              const updated = new Map(prev);
              const state = updated.get(data.playerId);
              if (state && state.lastAnimationUpdate === animationUpdateTime) {
                // Only reset if this timeout corresponds to the most recent animation update
                updated.set(data.playerId, {
                  ...state,
                  isSwinging: false,
                  isCharging: false,
                  isSpinning: false,
                  isSwordCharging: false
                });
              }
              return updated;
            });
          }, resetDuration);
          
          return updated;
        });
      }
    };

    const handlePlayerAbility = (data: any) => {
      console.log('✨ Received PVP player ability:', data);
      console.log('🔍 DEBUG: Ability type:', data.abilityType, 'from player:', data.playerId, 'my ID:', socket.id);
      if (data.playerId !== socket.id) {
        // Handle special abilities like Divine Storm, Viper Sting, and Barrage
        if (data.abilityType === 'divine_storm') {
          console.log('⚡ Handling Divine Storm ability from player', data.playerId);
          
          // Trigger visual Divine Storm effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          triggerGlobalDivineStorm(position, data.playerId);
          
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
              isDivineStorming: true,
              isSpinning: true, // Enable spinning animation for Divine Storm
              isSwordCharging: false
            });
            
            // Reset Divine Storm state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDivineStorming: false,
                    isSpinning: false // Reset spinning animation
                  });
                }
                return updated;
              });
            }, 4000); // Divine Storm lasts 3 seconds
            
            return updated;
          });
        } else if (data.abilityType === 'viper_sting') {
          console.log('🐍 Handling Viper Sting ability from player', data.playerId);
          
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
          console.log('🐍 Viper Sting visual trigger result:', success);
          
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
          console.log('🏹 Handling Barrage ability from player', data.playerId);
          
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
          console.log('❄️ Handling Frost Nova ability from player', data.playerId);
          console.log('🔍 DEBUG: Creating Frost Nova effect at position:', data.position);
          // Create frost nova visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpFrostNovaEffect(data.playerId, position);
          
          // Note: PVP damage and freeze effects are now handled by PVPFrostNovaManager
        } else if (data.abilityType === 'reanimate') {
          console.log('🌿 Handling Reanimate ability from player', data.playerId);
          console.log('🔍 DEBUG: Creating Reanimate effect at position:', data.position);
          
          // Create reanimate visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpReanimateEffect(data.playerId, position);
        } else if (data.abilityType === 'charge') {
          console.log('⚔️ Handling Charge ability from player', data.playerId);
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
          console.log('🛡️ Handling Deflect ability from player', data.playerId);
          
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
          console.log('🌟 Handling Skyfall ability from player', data.playerId);
          
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
          console.log('🗡️ Handling Backstab ability from player', data.playerId);
          
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
                    console.log(`🗡️ BACKSTAB! Player ${data.playerId} attacked local player from behind for ${damage} damage`);
                  } else {
                    console.log(`🗡️ Front attack from player ${data.playerId} for ${damage} damage`);
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
      console.log('💥 Received PVP player damage:', data);
      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket.id && playerEntity) {
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Pass the entity so Health component can use Shield for damage absorption
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity);
          console.log(`🩸 Took ${data.damage} damage from ${data.sourcePlayerId}. Health: ${health.currentHealth}/${health.maxHealth}, Shield: ${shield ? shield.currentShield : 0}/${shield ? shield.maxShield : 0}`);
        }
      }
    };

    const handlePlayerAnimationState = (data: any) => {
      console.log('🎭 Received PVP player animation state:', data);
      
      // Debug: Log backstab animation specifically
      if (data.animationState?.isBackstabbing) {
        console.log('🗡️ DEBUG: Received backstab animation state from player', data.playerId, 'isBackstabbing:', data.animationState.isBackstabbing);
      }
      
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
          
          // Debug: Log the final state for backstab
          if (newState.isBackstabbing) {
            console.log('🗡️ DEBUG: Setting backstab animation state for player', data.playerId, 'to:', newState.isBackstabbing);
          }
          
          updated.set(data.playerId, newState);
          
          return updated;
        });
      }
    };

    const handlePlayerEffect = (data: any) => {
      console.log('✨ Received PVP player effect:', data);
      
      if (data.effect?.type === 'venom') {
        const { targetPlayerId, position, duration } = data.effect;
        
        // Create venom effect on the target player (could be local player or other player)
        if (targetPlayerId && position) {
          const venomPosition = new Vector3(position.x, position.y, position.z);
          console.log(`☠️ Creating venom effect for player ${targetPlayerId} from broadcast`);
          createPvpVenomEffect(targetPlayerId, venomPosition);
        }
      }
    };

    const handlePlayerDebuff = (data: any) => {
      console.log('🎯 Received PVP player debuff:', data);
      console.log(`🔍 Debug: My socket ID is "${socket?.id}", target is "${data.targetPlayerId}"`);
      
      const { targetPlayerId, debuffType, duration, effectData } = data;
      
      if (targetPlayerId && debuffType && duration) {
        const position = effectData?.position 
          ? new Vector3(effectData.position.x, effectData.position.y, effectData.position.z)
          : new Vector3(0, 0, 0);
        
        console.log(`🎯 Creating ${debuffType} effect for player ${targetPlayerId} from broadcast`);
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
        
        console.log(`🔗 Created local ECS entity ${entity.id} for PVP player ${playerId} (${serverPlayer.name}) at position [${serverPlayer.position.x.toFixed(2)}, ${serverPlayer.position.y.toFixed(2)}, ${serverPlayer.position.z.toFixed(2)}]`);
        console.log(`🚫 Remote player ${playerId} collision mask: ${collider.mask} (ENVIRONMENT only - no player-to-player collision)`);
      } else {
        // Update existing local ECS entity
        const entityId = serverPlayerEntities.current.get(playerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update position
          const transform = entity.getComponent(Transform);
          if (transform) {
            const oldPos = transform.position.clone();
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
        
        console.log(`🏰 Created local ECS entity ${entity.id} for tower ${towerId} (Owner: ${serverTower.ownerId}) at position [${serverTower.position.x.toFixed(2)}, ${serverTower.position.y.toFixed(2)}, ${serverTower.position.z.toFixed(2)}]`);
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
      
      const { player, controlSystem, towerSystem } = setupPVPGame(engine, scene, camera as PerspectiveCamera, gl, damagePlayerWithMapping, damageTower);
      console.log('🎮 PVP Player entity created:', player, 'ID:', player.id);
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      towerSystemRef.current = towerSystem;
      
      // Set up tower system with player mapping
      if (towerSystem && socket?.id) {
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }
      
      // Pass controlSystem back to parent
      if (onControlSystemUpdate) {
        onControlSystemUpdate(controlSystem);
      }
      
      // Set up PVP callbacks (AFTER playerEntity is set)
      controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
        console.log('🏹 PVP Bow released with charge:', finalProgress, isPerfectShot ? '✨ PERFECT SHOT!' : '');
        
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
          console.log('🌟 Creating perfect shot visual effect!');
          
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
              console.log('🌟 Perfect shot effect created with ID:', effectId);
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
        console.log('🐍 PVP Viper Sting triggered - broadcasting to other players');
        broadcastPlayerAbility('viper_sting', position, direction);
      });
      
      // Set up Barrage callback
      controlSystem.setBarrageCallback((position, direction) => {
        console.log('🏹 PVP Barrage triggered - broadcasting to other players');
        broadcastPlayerAbility('barrage', position, direction);
      });
      
      // Set up Frost Nova callback
      console.log('🔍 DEBUG: Setting up Frost Nova callback in PVP');
      controlSystem.setFrostNovaCallback((position, direction) => {
        console.log('❄️ PVP Frost Nova triggered - broadcasting to other players');
        broadcastPlayerAbility('frost_nova', position, direction);
      });
      
      // Set up Cobra Shot callback (for local visual effects only - projectile is handled via onProjectileCreatedCallback)
      controlSystem.setCobraShotCallback((position, direction) => {
        console.log('🐍 PVP Cobra Shot triggered - local visual effects only');
        // Don't broadcast as ability - the projectile is already broadcast via onProjectileCreatedCallback
      });
      
      // Set up Charge callback
      controlSystem.setChargeCallback((position, direction) => {
        console.log('⚔️ PVP Charge triggered - broadcasting to other players');
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
      
      // Set up Debuff callback for broadcasting freeze/slow effects
      console.log(`🔧 Debug: Setting up debuff callback for ControlSystem`);
      controlSystem.setDebuffCallback((targetEntityId: number, debuffType: 'frozen' | 'slowed', duration: number, position: Vector3) => {
        console.log(`🎯 PVP Debuff callback triggered - ${debuffType} effect on entity ${targetEntityId}`);
        
        // Find the server player ID that corresponds to this local ECS entity ID
        console.log(`🔍 Debug: Looking for entity ${targetEntityId} in serverPlayerEntities:`, Array.from(serverPlayerEntities.current.entries()));
        let targetPlayerId: string | null = null;
        // The map is stored as playerId -> entityId, so we need to find the key where the value matches targetEntityId
        serverPlayerEntities.current.forEach((localEntityId, playerId) => {
          console.log(`🔍 Debug: Checking entity ${localEntityId} for player ${playerId}`);
          if (localEntityId === targetEntityId) {
            targetPlayerId = playerId;
            console.log(`✅ Debug: Found match! Entity ${targetEntityId} belongs to player ${playerId}`);
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
        console.log('🏹 PVP Projectile created - broadcasting to other players:', projectileType);
        const animationData: any = {};
        
        // Add charge progress for bow projectiles
        if (projectileType.includes('arrow') || projectileType.includes('bolt')) {
          animationData.chargeProgress = controlSystem.getChargeProgress();
        }
        
        broadcastPlayerAttack(projectileType, position, direction, animationData);
      });
      
      // Set up Reanimate callback
      console.log('🔍 DEBUG: Setting up Reanimate callback in PVP');
      controlSystem.setReanimateCallback(() => {
        console.log('🌿 PVP Reanimate healing effect triggered - broadcasting to other players');
        if (reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }
        
        // Broadcast Reanimate ability to other players
        console.log('🔍 DEBUG: Player entity available for Reanimate broadcast:', !!player);
        if (player) {
          const transform = player.getComponent(Transform);
          if (transform) {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            console.log('🔍 DEBUG: Broadcasting Reanimate ability with position:', transform.position);
            broadcastPlayerAbility('reanimate', transform.position, direction);
          } else {
            console.log('🔍 DEBUG: No transform component found on player entity');
          }
        } else {
          console.log('🔍 DEBUG: No player entity available for Reanimate broadcast');
        }
      });
      
      engine.start();
    });

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [scene, camera, gl, gameStarted]);

  // Expose PVP player data globally for ControlSystem access
  useEffect(() => {
    (window as any).pvpPlayers = players;
    (window as any).localSocketId = socket?.id;
  }, [players, socket?.id]);

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
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
          isBackstabbing: controlSystemRef.current.isBackstabActive()
        };
        
        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (newWeaponState.currentWeapon !== prevWeapon.weapon || 
            newWeaponState.currentSubclass !== prevWeapon.subclass) {
          console.log('🔄 PVP Weapon changed:', newWeaponState.currentWeapon, newWeaponState.currentSubclass);
          updatePlayerWeapon(newWeaponState.currentWeapon, newWeaponState.currentSubclass);
          prevWeaponRef.current = {
            weapon: newWeaponState.currentWeapon,
            subclass: newWeaponState.currentSubclass
          };
        }
        
        setWeaponState(newWeaponState);
        
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
          
          // Debug: Log backstab state broadcasting with full context
          if (newWeaponState.isBackstabbing) {
            console.log('🗡️ DEBUG: Broadcasting backstab animation state:', newWeaponState.isBackstabbing);
            console.log('🗡️ DEBUG: Full animation state being sent:', animationStateToSend);
            console.log('🗡️ DEBUG: Socket connected:', !!socket);
          }
          
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
            currentSubclass: controlSystemRef.current.getCurrentSubclass()
          };
          onGameStateUpdate(gameState);
          
          // Update multiplayer health
          updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
        }
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

  // Don't render anything if game hasn't started
  if (!gameStarted) {
    return null;
  }

  return (
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


      <mesh castShadow position={[0, 1, -10]}>
        <boxGeometry args={[4, 2, 1]} />
        <meshStandardMaterial color="#696969" />
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
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
          }}
          onScytheSwingComplete={() => {
            console.log('⚔️ PVP Scythe swing completed');
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('scythe_swing', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onSwordSwingComplete={() => {
            console.log('🗡️ PVP Sword swing completed - notifying control system');
            controlSystemRef.current?.onSwordSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onSabresSwingComplete={() => {
            console.log('⚔️ PVP Sabres swing completed - notifying control system');
            controlSystemRef.current?.onSabresSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sabres_swing', playerPosition, direction);
          }}
          onChargeComplete={() => {
            console.log('⚔️ PVP Charge completed - notifying control system');
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
            console.log('🛡️ PVP Deflect completed - notifying control system');
            controlSystemRef.current?.onDeflectComplete();
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
        
        // Debug: Log backstab state for this player
        if (playerState.isBackstabbing) {
          console.log('🗡️ DEBUG: Rendering player', player.id, 'with isBackstabbing:', playerState.isBackstabbing);
        }
        
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
          />
        );
      })}

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
          <CobraShotManager world={engineRef.current.getWorld()} />
          <DivineStormManager 
            enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => ({
              id: p.id,
              position: new Vector3(p.position.x, p.position.y, p.position.z),
              health: p.health
            }))}
            onHitTarget={(targetId: string, damage: number) => {
              console.log(`⚡ Divine Storm hit player ${targetId} for ${damage} damage`);
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(targetId, damage);
              }
            }}
          />
          <DeflectShieldManager />
          {/* PVP-specific Cobra Shot Manager that can hit players */}
          <PVPCobraShotManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())} // Include all players, filtering is done inside the component
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              console.log(`🐍 Cobra Shot hit player ${playerId} for ${damage} damage`);
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3) => {
              createPvpVenomEffect(playerId, position);
              
              // Broadcast venom effect to all players so they can see it
              if (broadcastPlayerEffect) {
                broadcastPlayerEffect({
                  type: 'venom',
                  targetPlayerId: playerId,
                  position: { x: position.x, y: position.y, z: position.z },
                  duration: 6000
                });
                console.log(`☠️ Broadcasting venom effect for player ${playerId}`);
              }
            }}
          />
          
          {/* PVP-specific Barrage Manager that can hit players with slow effect */}
          <PVPBarrageManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              console.log(`🏹 Barrage hit player ${playerId} for ${damage} damage`);
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerSlowed={(playerId: string, position: Vector3) => {
              createPvpDebuffEffect(playerId, 'slowed', position, 5000); // 5 second slow
              
              // Broadcast debuff effect to all players so they can see it
              if (broadcastPlayerDebuff) {
                broadcastPlayerDebuff(playerId, 'slowed', 5000, {
                  position: { x: position.x, y: position.y, z: position.z },
                  speedMultiplier: 0.5
                });
                console.log(`🐌 Broadcasting slow effect for player ${playerId}`);
              }
            }}
          />
          
          {/* PVP-specific FrostNova Manager that can hit players with freeze effect */}
          <PVPFrostNovaManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              console.log(`❄️ FrostNova hit player ${playerId} for ${damage} damage`);
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerFrozen={(playerId: string, position: Vector3) => {
              createPvpFrozenEffect(playerId, position);
            }}
          />
          <ViperStingManager 
            parentRef={viperStingParentRef as any}
            enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => ({
              id: p.id,
              position: new Vector3(p.position.x, p.position.y, p.position.z),
              health: p.health,
              isDying: false
            }))}
            onHit={(targetId: string, damage: number) => {
              // Handle PVP damage to other players
              console.log(`🐍 Viper Sting hit player ${targetId} for ${damage} damage`);
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(targetId, damage);
              }
            }}
            setDamageNumbers={() => {
              // Viper Sting damage numbers are handled through the combat system in PVP
              // This is just a placeholder to satisfy the interface
            }}
            nextDamageNumberId={{ current: Date.now() }}
            charges={[
              { id: 1, available: true, cooldownStartTime: null },
              { id: 2, available: true, cooldownStartTime: null },
              { id: 3, available: true, cooldownStartTime: null }
            ]}
            setCharges={() => {}}
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
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y + 1, affectedPlayer.position.z)
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
            const currentPosition = affectedPlayer 
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y, affectedPlayer.position.z)
              : debuffEffect.position;
            
            // Use FrozenEffect for frozen debuffs, DebuffIndicator for others
            if (debuffEffect.debuffType === 'frozen') {
              return (
                <FrozenEffect
                  key={debuffEffect.id}
                  position={currentPosition}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  enemyId={debuffEffect.playerId}
                  enemyData={Array.from(players.values()).map(p => ({
                    id: p.id,
                    position: new Vector3(p.position.x, p.position.y, p.position.z),
                    health: p.health,
                    isDying: false
                  }))}
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
  );
}

function setupPVPGame(
  engine: Engine, 
  scene: Scene, 
  camera: PerspectiveCamera, 
  renderer: WebGLRenderer,
  damagePlayerCallback: (playerId: string, damage: number) => void,
  damageTowerCallback: (towerId: string, damage: number) => void
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

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  towerSystem.setProjectileSystem(projectileSystem);
  
  // Set up combat system to route player damage through PVP system
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);
  
  // Set up tower system callback for tower damage
  // TODO: Implement tower damage callback mapping similar to player damage

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(renderSystem);
  world.addSystem(projectileSystem);
  world.addSystem(towerSystem);
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createPVPPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();
  
  console.log('🌍 Total entities in PVP world:', world.getAllEntities().length);
  
  console.log('✅ PVP game setup complete!');
  console.log(`👤 Player entity created with ID: ${playerEntity.id}`);
  console.log('⚔️ PVP players will be synchronized from server');
  
  return { player: playerEntity, controlSystem, towerSystem };
}

function createPVPPlayer(world: World): any {
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

  // Add Health component with 400 max health
  const health = new Health(500);
  health.enableRegeneration(2, 10); // Slower regen in PVP: 1 HP per second after 10 seconds
  player.addComponent(health);

  // Add Shield component with 100 max shield
  const shield = new Shield(200, 20, 5); // 100 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  // Add Collider component for environment collision and PVP damage detection
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 0.9; // Reduced collision radius for better player proximity in PVP
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
  console.log(`🚫 Local player collision mask: ${localCollider?.mask} (ENVIRONMENT only - no player-to-player collision)`);

  return player;
}
