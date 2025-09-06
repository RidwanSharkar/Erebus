'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
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
import UnifiedEnemyManager from '@/components/managers/UnifiedEnemyManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import CobraShotManager from '@/components/projectiles/CobraShotManager';
import DivineStormManager, { triggerGlobalDivineStorm } from '@/components/weapons/DivineStormManager';
import DeflectShieldManager from '@/components/weapons/DeflectShieldManager';

import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';

interface GameSceneProps {
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

export function GameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate }: GameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const reanimateRef = useRef<ReanimateRef>(null);
  const isInitialized = useRef(false);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);
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
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();

  // Initialize the game engine
  useEffect(() => {
    if (isInitialized.current) return;
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
      const { player, controlSystem } = setupGame(engine, scene, camera as PerspectiveCamera, gl);
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      
      // Pass controlSystem back to parent
      if (onControlSystemUpdate) {
        onControlSystemUpdate(controlSystem);
      }
      
      // Set up bow release callback for perfect shot effects
      controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
        
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
              const compensationAngle = Math.PI/12; // 30 degrees
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
      
      // Set up Viper Sting callback
      controlSystem.setViperStingCallback((position, direction) => {
        // The actual Viper Sting logic is handled by the ViperStingManager
        // This callback could be used for additional effects or sound
      });
      
      // Set up Barrage callback
      controlSystem.setBarrageCallback((position, direction) => {
        // The actual Barrage logic is handled by the BarrageManager
        // This callback could be used for additional effects or sound
      });
      
      // Set up Divine Storm callback
      controlSystem.setDivineStormCallback((position, direction, duration) => {
        // Trigger local visual effect with correct duration
        triggerGlobalDivineStorm(position, 'local-player', duration);
      });
      
      // Set up Reanimate callback
      controlSystem.setReanimateCallback(() => {
        if (reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }
      });
      
      // Set up Skyfall callback
      controlSystem.setSkyfallCallback((position, direction) => {
        // The actual Skyfall logic is handled by the ControlSystem
        // This callback could be used for additional effects or sound
      });
      
      engine.start();
    });

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [scene, camera, gl]);

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    if (engineRef.current && engineRef.current.isEngineRunning()) {
      // Update FPS counter
      updateFPSCounter(engineRef.current.getCurrentFPS());
      
      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform && transform.position) {
          setPlayerPosition(transform.position.clone());
        }
      }
      
      // Update weapon state from control system
      if (controlSystemRef.current) {
        setWeaponState({
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
        });
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
          onGameStateUpdate({
            playerHealth: healthComponent.currentHealth,
            maxHealth: healthComponent.maxHealth,
            playerShield: shieldComponent ? shieldComponent.currentShield : 0,
            maxShield: shieldComponent ? shieldComponent.maxShield : 0,
            currentWeapon: controlSystemRef.current.getCurrentWeapon(),
            currentSubclass: controlSystemRef.current.getCurrentSubclass()
          });
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

  return (
    <>
      {/* Environment (Sky, Planet, Mountains, Pillars, Pedestal) */}
      <Environment level={1} world={engineRef.current?.getWorld()} />

      {/* Lighting */}
      <ambientLight intensity={0.225} />
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

      {/* Dragon Unit Renderer */}
      {(() => {

        return playerEntity && engineRef.current;
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
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
            // Keeping this for compatibility but it won't be used for perfect shot effects
          }}
          onScytheSwingComplete={() => {
           // console.log('⚔️ Scythe swing completed');
          }}
          onSwordSwingComplete={() => {
           // console.log('🗡️ Sword swing completed - notifying control system');
            controlSystemRef.current?.onSwordSwingComplete();
          }}
          onSabresSwingComplete={() => {
           // console.log('⚔️ Sabres swing completed - notifying control system');
            controlSystemRef.current?.onSabresSwingComplete();
          }}
          onChargeComplete={() => {
           // console.log('⚔️ Charge completed - notifying control system');
            controlSystemRef.current?.onChargeComplete();
          }}
          onDeflectComplete={() => {
           // console.log('🛡️ Deflect completed - notifying control system');
            controlSystemRef.current?.onDeflectComplete();
          }}
        />
      )}

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && (
        <>
          <UnifiedProjectileManager world={engineRef.current.getWorld()} />
          <UnifiedEnemyManager world={engineRef.current.getWorld()} />
          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <CobraShotManager world={engineRef.current.getWorld()} />
          <DivineStormManager 
            enemyData={[]} // Single-player mode uses ECS enemies, not this prop
          />
          <DeflectShieldManager />
        </>
      )}
    </>
  );
}

function setupGame(
  engine: Engine, 
  scene: Scene, 
  camera: PerspectiveCamera, 
  renderer: WebGLRenderer
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
  const playerEntity = createPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();

  // Create enemy factory and spawn some enemies
  const enemyFactory = new EnemyFactory(world, {
    enableObjectPooling: true,
    enableHealthBars: true,
    healthBarConfig: {
      showWhenFull: true, // Always show health bars for enemies
      fadeDistance: 20
    }
  });

  // Spawn a training dummy for testing
  enemyFactory.createTrainingDummy(new Vector3(5, 0, 5));
  
  // Spawn some enemies around the map

  enemyFactory.createElite(new Vector3(-8, 0, 8), 2);
  enemyFactory.createElite(new Vector3(8, 0, 3), 2);

  
  return { player: playerEntity, controlSystem };
}

function createPlayer(world: World): any {
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
  health.enableRegeneration(1, 5); // 2 HP per second after 5 seconds
  player.addComponent(health);

  // Add Shield component with 100 max shield
  const shield = new Shield(200, 20, 5); // 100 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  // Add Collider component for environment collision (pillars, walls, etc.)
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 1; // Player collision radius
  collider.layer = CollisionLayer.PLAYER; // Use player layer for proper collision detection
  collider.setOffset(0, 0.5, 0); // Center on player
  player.addComponent(collider);

  // Note: Visual rendering is handled by DragonRenderer component
  // No Renderer component needed as we use React Three Fiber for the dragon model

  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}
