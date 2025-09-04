'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { HealthBar, HealthBarConfig } from '@/ecs/components/HealthBar';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem } from '@/systems/ControlSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { HealthBarSystem } from '@/systems/HealthBarSystem';
import { EnemyFactory } from '@/utils/EnemyFactory';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';
import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import CobraShotManager from '@/components/projectiles/CobraShotManager';
import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import EliteRenderer from '@/components/enemies/EliteRenderer';

interface MultiplayerGameSceneProps {
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

export function MultiplayerGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate }: MultiplayerGameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const { 
    players, 
    enemies, 
    killCount, 
    gameStarted,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    damageEnemy,
    socket
  } = useMultiplayer();
  
  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const reanimateRef = useRef<ReanimateRef>(null);
  const isInitialized = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);
  
  // Track server enemy to local ECS entity mapping
  const serverEnemyEntities = useRef<Map<string, number>>(new Map());
  const [weaponState, setWeaponState] = useState({
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    isCharging: false,
    chargeProgress: 0,
    isSwinging: false,
    swordComboStep: 1 as 1 | 2 | 3,
    isDivineStorming: false
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
    lastAttackType?: string;
    lastAttackTime?: number;
    lastAnimationUpdate?: number;
  }>>(new Map());
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();

  // Set up multiplayer event listeners for player actions
  useEffect(() => {
    if (!socket) return;

    const handlePlayerAttack = (data: any) => {
      console.log('⚔️ Received player attack:', data);
      if (data.playerId !== socket.id && engineRef.current) {
        // Handle perfect shot beam effects
        if (data.attackType === 'bow_release' && data.animationData?.isPerfectShot) {
          console.log('🌟 Creating perfect shot beam effect for other player!');
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
        
        // Handle projectile attacks - create visual projectiles for other players
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot'];
        if (projectileTypes.includes(data.attackType)) {
          console.log('🏹 Creating multiplayer projectile:', data.attackType);
          
          // Create a visual-only projectile for other players
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            const position = new Vector3(data.position.x, data.position.y, data.position.z);
            const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
            
            // Create appropriate projectile type
            switch (data.attackType) {
              case 'regular_arrow':
                projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  -1, // Use -1 as owner ID to indicate multiplayer projectile
                  { speed: 25, damage: 0, lifetime: 3, opacity: 0.8 } // No damage for visual-only
                );
                break;
              case 'charged_arrow':
                projectileSystem.createChargedArrowProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  -1,
                  { speed: 35, damage: 0, lifetime: 5, piercing: true, opacity: 0.8 }
                );
                break;
              case 'entropic_bolt':
                projectileSystem.createEntropicBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  -1,
                  { speed: 20, damage: 0, lifetime: 8, piercing: true, opacity: 0.8 }
                );
                break;
              case 'crossentropy_bolt':
                projectileSystem.createCrossentropyBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  -1,
                  { speed: 15, damage: 0, lifetime: 10, piercing: true, opacity: 0.8 }
                );
                break;
              case 'perfect_shot':
                projectileSystem.createChargedArrowProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  -1,
                  { speed: 40, damage: 0, lifetime: 6, piercing: true, opacity: 1.0 }
                );
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
            isSpinning: false
          };
          
          // If there's already an active animation, we'll override it with the new one
          // This prevents animation stacking and ensures clean transitions
          
          // Extract animation data from the attack
          const animationData = data.animationData || {};
          
          // Store the animation update time to check against later
          const animationUpdateTime = Date.now();
          
          updated.set(data.playerId, {
            ...currentState,
            isSwinging: data.attackType.includes('swing') || data.attackType.includes('sword'),
            isCharging: data.attackType.includes('bow') && data.attackType.includes('charge'),
            isSpinning: data.attackType.includes('scythe') || animationData.isSpinning || false,
            swordComboStep: animationData.comboStep || currentState.swordComboStep,
            chargeProgress: animationData.chargeProgress || 0,
            lastAttackType: data.attackType,
            lastAttackTime: animationUpdateTime,
            lastAnimationUpdate: animationUpdateTime
          });
          
          // Reset animation state after appropriate duration based on attack type
          const resetDuration = data.attackType.includes('scythe') ? 2000 : // Scythe spinning lasts longer
                               data.attackType.includes('sword') ? 800 :   // Sword swings are quick
                               data.attackType.includes('bow') ? 500 :     // Bow releases are fast
                               1000; // Default
          
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
                  isSpinning: false
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
      console.log('✨ Received player ability:', data);
      if (data.playerId !== socket.id) {
        // Handle special abilities like Divine Storm
        if (data.abilityType === 'divine_storm') {
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isDivineStorming: false,
              isSpinning: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isDivineStorming: true
            });
            
            // Reset Divine Storm state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDivineStorming: false
                  });
                }
                return updated;
              });
            }, 3000); // Divine Storm lasts 3 seconds
            
            return updated;
          });
        }
      }
    };

    const handlePlayerEffect = (data: any) => {
      console.log('💫 Received player effect:', data);
      // Handle visual effects that don't require state changes
    };

    const handlePlayerAnimationState = (data: any) => {
      console.log('🎭 Received player animation state:', data);
      if (data.playerId !== socket.id) {
        setMultiplayerPlayerStates(prev => {
          const updated = new Map(prev);
          const currentState = updated.get(data.playerId) || {
            isCharging: false,
            chargeProgress: 0,
            isSwinging: false,
            swordComboStep: 1 as 1 | 2 | 3,
            isDivineStorming: false,
            isSpinning: false
          };
          
          // Update with the received animation state
          updated.set(data.playerId, {
            ...currentState,
            ...data.animationState,
            lastAnimationUpdate: Date.now()
          });
          
          return updated;
        });
      }
    };

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-ability', handlePlayerAbility);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-animation-state', handlePlayerAnimationState);

    return () => {
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-ability', handlePlayerAbility);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-animation-state', handlePlayerAnimationState);
    };
  }, [socket]);

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

  // Sync server enemies with local ECS entities for damage system
  useEffect(() => {
    if (!engineRef.current || !gameStarted) return;
    
    const world = engineRef.current.getWorld();
    
    // Create local ECS entities for server enemies
    enemies.forEach((serverEnemy, serverId) => {
      if (!serverEnemyEntities.current.has(serverId)) {
        // Create a new local ECS entity for this server enemy
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
        entity.addComponent(transform);
        
        // Add Enemy component
        const enemy = world.createComponent(Enemy);
        enemy.type = serverEnemy.type === 'elite' ? EnemyType.ELITE : EnemyType.GRUNT;
        enemy.level = 1; // Default level
        entity.addComponent(enemy);
        
        // Add Health component
        const health = world.createComponent(Health);
        health.maxHealth = serverEnemy.maxHealth;
        health.currentHealth = serverEnemy.health;
        entity.addComponent(health);
        
        // Add Collider component for damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 2; // Match Elite collider radius from EnemyFactory
        collider.layer = CollisionLayer.ENEMY;
        collider.setOffset(0, 1, 0); // Center on entity
        entity.addComponent(collider);
        
        // Add HealthBar component
        const healthBar = world.createComponent(HealthBar);
        const healthBarConfig: HealthBarConfig = {
          width: 1.2, // Slightly larger for Elite enemies
          height: 0.1,
          offset: new Vector3(0, 2.5, 0), // Position above Elite enemy
          showWhenFull: false, // Only show when damaged
          fadeDistance: 20,
          healthColor: new Color(0x00ff00), // Green
          lowHealthColor: new Color(0xffff00), // Yellow
          criticalHealthColor: new Color(0xff0000), // Red
        };
        
        // Apply configuration to healthBar
        healthBar.width = healthBarConfig.width!;
        healthBar.height = healthBarConfig.height!;
        healthBar.offset.copy(healthBarConfig.offset!);
        healthBar.showWhenFull = healthBarConfig.showWhenFull!;
        healthBar.fadeDistance = healthBarConfig.fadeDistance!;
        healthBar.healthColor.copy(healthBarConfig.healthColor!);
        healthBar.lowHealthColor.copy(healthBarConfig.lowHealthColor!);
        healthBar.criticalHealthColor.copy(healthBarConfig.criticalHealthColor!);
        
        entity.addComponent(healthBar);
        
        // Notify systems that the entity is ready (this will add health bar to scene)
        world.notifyEntityAdded(entity);
        
        // Store the mapping
        serverEnemyEntities.current.set(serverId, entity.id);
        
        console.log(`🔗 Created local ECS entity ${entity.id} for server enemy ${serverId} (${serverEnemy.type}) with health bar`);
      } else {
        // Update existing local ECS entity
        const entityId = serverEnemyEntities.current.get(serverId)!;
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
            
            // Mark as dying if server enemy is dying
            if (serverEnemy.isDying && !health.isDead) {
              health.currentHealth = 0;
            }
          }
        }
      }
    });
    
    // Clean up local entities for server enemies that no longer exist
    const currentServerIds = new Set(enemies.keys());
    const entitiesToRemove: string[] = [];
    
    serverEnemyEntities.current.forEach((entityId, serverId) => {
      if (!currentServerIds.has(serverId)) {
        const entity = world.getEntity(entityId);
        if (entity) {
          // Mark entity as dead instead of removing (World might not have removeEntity method)
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = 0;
            health.isDead = true;
          }
          console.log(`💀 Marked local ECS entity ${entityId} as dead for deleted server enemy ${serverId}`);
        }
        entitiesToRemove.push(serverId);
      }
    });
    
    // Remove from mapping
    entitiesToRemove.forEach(serverId => {
      serverEnemyEntities.current.delete(serverId);
    });
  }, [enemies, gameStarted]);

  // Initialize the game engine
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
      // Create a damage callback that maps local ECS entity IDs back to server enemy IDs
      const damageEnemyWithMapping = (entityId: string, damage: number) => {
        // Find the server enemy ID that corresponds to this local ECS entity ID
        const numericEntityId = parseInt(entityId);
        let serverEnemyId: string | null = null;
        
        serverEnemyEntities.current.forEach((localEntityId, serverId) => {
          if (localEntityId === numericEntityId) {
            serverEnemyId = serverId;
          }
        });
        
        if (serverEnemyId) {
          console.log(`🎯 Mapping local entity ${entityId} to server enemy ${serverEnemyId} for ${damage} damage`);
          damageEnemy(serverEnemyId, damage);
        } else {
          console.warn(`⚠️ Could not find server enemy ID for local entity ${entityId}`);
        }
      };
      
      const { player, controlSystem } = setupMultiplayerGame(engine, scene, camera as PerspectiveCamera, gl, damageEnemyWithMapping);
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      
      // Pass controlSystem back to parent
      if (onControlSystemUpdate) {
        onControlSystemUpdate(controlSystem);
      }
      
      // Set up multiplayer callbacks
      controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
        console.log('🏹 Bow released with charge:', finalProgress, isPerfectShot ? '✨ PERFECT SHOT!' : '');
        
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
      controlSystem.setDivineStormCallback((position, direction) => {
        console.log('⚡ Divine Storm activated - broadcasting to other players');
        broadcastPlayerAbility('divine_storm', position, direction);
      });
      
      // Set up projectile creation callback
      controlSystem.setProjectileCreatedCallback((projectileType, position, direction, config) => {
        console.log('🏹 Projectile created - broadcasting to other players:', projectileType);
        const animationData: any = {};
        
        // Add charge progress for bow projectiles
        if (projectileType.includes('arrow') || projectileType.includes('bolt')) {
          animationData.chargeProgress = controlSystem.getChargeProgress();
        }
        
        broadcastPlayerAttack(projectileType, position, direction, animationData);
      });
      
      // Set up Reanimate callback
      controlSystem.setReanimateCallback(() => {
        console.log('🌿 Multiplayer Reanimate healing effect triggered');
        if (reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }
      });
      
      // Note: Weapon changes are handled in the game loop via polling
      // Damage is handled through the existing combat system
      
      engine.start();
    });

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [scene, camera, gl, gameStarted]);

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          const newPosition = transform.position.clone();
          setPlayerPosition(newPosition);
          
          // Send position updates to other players
          const rotation = { x: 0, y: 0, z: 0 }; // Get from camera or player rotation
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
          swordComboStep: controlSystemRef.current.getSwordComboStep(),
          isDivineStorming: controlSystemRef.current.isDivineStormActive()
        };
        
        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (newWeaponState.currentWeapon !== prevWeapon.weapon || 
            newWeaponState.currentSubclass !== prevWeapon.subclass) {
          console.log('🔄 Weapon changed:', newWeaponState.currentWeapon, newWeaponState.currentSubclass);
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
          
          broadcastPlayerAnimationState({
            isCharging: newWeaponState.isCharging,
            chargeProgress: newWeaponState.chargeProgress,
            isSwinging: newWeaponState.isSwinging,
            swordComboStep: newWeaponState.swordComboStep,
            isDivineStorming: newWeaponState.isDivineStorming,
            isSpinning: isScytheSpinning // Properly broadcast scythe spinning state
          });
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
      {/* Environment (Sky, Planet, Mountains, Pillars, Pedestal) */}
      <Environment level={Math.min(5, Math.floor(killCount / 10) + 1)} world={engineRef.current?.getWorld()} />

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
      <mesh position={[0, 0.01, 0]}>
        <ringGeometry args={[28.5, 29, 64]} />
        <meshStandardMaterial color="#ff6b6b" transparent opacity={0.3} />
      </mesh>

      {/* Some basic environment objects */}
      <mesh castShadow position={[5, 1, 5]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      <mesh castShadow position={[-5, 1, -5]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      <mesh castShadow position={[0, 1, -10]}>
        <boxGeometry args={[4, 2, 1]} />
        <meshStandardMaterial color="#696969" />
      </mesh>

      {/* Main Player Dragon Unit Renderer */}
      {playerEntity && engineRef.current && socket && (
        <DragonRenderer
          entityId={playerEntity.id}
          position={playerPosition}
          world={engineRef.current.getWorld()}
          currentWeapon={weaponState.currentWeapon}
          currentSubclass={weaponState.currentSubclass}
          isCharging={weaponState.isCharging}
          chargeProgress={weaponState.chargeProgress}
          isSwinging={weaponState.isSwinging}
          swordComboStep={weaponState.swordComboStep}
          isDivineStorming={weaponState.isDivineStorming}
          reanimateRef={reanimateRef}
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
          }}
          onScytheSwingComplete={() => {
            console.log('⚔️ Scythe swing completed');
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('scythe_swing', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onSwordSwingComplete={() => {
            console.log('🗡️ Sword swing completed - notifying control system');
            controlSystemRef.current?.onSwordSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onChargeComplete={() => {
            console.log('⚔️ Charge completed - notifying control system');
            controlSystemRef.current?.onChargeComplete();
          }}
          onDeflectComplete={() => {
            console.log('🛡️ Deflect completed - notifying control system');
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
          isSpinning: false
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
            onBowRelease={() => {}}
            onScytheSwingComplete={() => {}}
            onSwordSwingComplete={() => {}}
          />
        );
      })}

      {/* Local ECS Enemy Renderers (includes server-synced enemies) */}
      {engineRef.current && (() => {
        const allEntities = engineRef.current.getWorld().getAllEntities();
        const enemyEntities = allEntities.filter(entity => entity.hasComponent(Enemy));
        console.log('🔍 All entities:', allEntities.length, 'Enemy entities:', enemyEntities.length);
        return enemyEntities;
      })().map(entity => {
          const enemy = entity.getComponent(Enemy);
          const transform = entity.getComponent(Transform);
          
          if (!enemy || !transform) return null;
          
          // Use the ECS enemy type to determine which renderer to use
          switch (enemy.type) {
            case EnemyType.ELITE:
              return (
                <EliteRenderer
                  key={entity.id}
                  entityId={entity.id}
                  position={transform.position.clone()}
                  world={engineRef.current!.getWorld()}
                />
              );
            case EnemyType.GRUNT:
              // Grunt renderer would go here if you add it back
              return null;
            case EnemyType.BOSS:
              // Boss renderer would go here if you add it back
              return null;
            default:
              return null;
          }
        })}

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && (
        <>
          <UnifiedProjectileManager world={engineRef.current.getWorld()} />
          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <CobraShotManager world={engineRef.current.getWorld()} />
        </>
      )}
    </>
  );
}

function setupMultiplayerGame(
  engine: Engine, 
  scene: Scene, 
  camera: PerspectiveCamera, 
  renderer: WebGLRenderer,
  damageEnemyCallback: (enemyId: string, damage: number) => void
): { player: any; controlSystem: ControlSystem } {
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
  const healthBarSystem = new HealthBarSystem(scene, camera);
  const projectileSystem = new ProjectileSystem(world);
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
  
  // Set up combat system to route enemy damage through multiplayer
  combatSystem.setEnemyDamageCallback(damageEnemyCallback);

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(renderSystem);
  world.addSystem(healthBarSystem);
  world.addSystem(projectileSystem);
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createMultiplayerPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();
  
  // Note: Enemies are now managed by the server and synchronized through multiplayer context
  // Local ECS enemies are only created when they don't exist on server (for backward compatibility)
  console.log('🌍 Total entities in world:', world.getAllEntities().length);
  
  console.log('✅ Multiplayer game setup complete!');
  console.log(`👤 Player entity created with ID: ${playerEntity.id}`);
  console.log('🌐 Multiplayer enemies and players will be synchronized from server');
  
  return { player: playerEntity, controlSystem };
}

function createMultiplayerPlayer(world: World): any {
  // Create player entity
  const player = world.createEntity();

  // Add Transform component
  const transform = world.createComponent(Transform);
  transform.setPosition(0, 0.5, 0); // Position sphere center at radius height above ground
  player.addComponent(transform);

  // Add Movement component
  const movement = world.createComponent(Movement);
  movement.maxSpeed = 3.65; // Reduced from 8 to 3.65 for slower movement
  movement.jumpForce = 8;
  movement.friction = 0.85;
  player.addComponent(movement);

  // Add Health component
  const health = world.createComponent(Health);
  health.maxHealth = 200; // Updated to 200 as requested
  health.enableRegeneration(2, 5); // 2 HP per second after 5 seconds
  player.addComponent(health);

  // Add Shield component with 100 max shield
  const shield = new Shield(100, 20, 5); // 100 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  console.log('👤 Multiplayer player entity created with components:', {
    transform: !!player.getComponent(Transform),
    movement: !!player.getComponent(Movement),
    health: !!player.getComponent(Health),
    shield: !!player.getComponent(Shield),
  });

  return player;
}
