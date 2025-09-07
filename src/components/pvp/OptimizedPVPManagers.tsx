// Optimized PVP Managers with Object Pooling
import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { CobraShotProjectile } from '@/components/projectiles/CobraShot';
import { pvpObjectPool } from '@/utils/PVPObjectPool';

// Define ViperStingProjectile interface for PVP collision detection
interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
}

// Interfaces for PVP managers
interface PVPCobraShotManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerVenomed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

interface PVPBarrageManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerSlowed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

interface PVPFrostNovaManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerFrozen: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

interface PVPViperStingManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerVenomed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

/**
 * Optimized Cobra Shot Manager with Object Pooling
 */
export function OptimizedPVPCobraShotManager({ 
  world, 
  players, 
  onPlayerHit, 
  onPlayerVenomed, 
  serverPlayerEntities, 
  localSocketId 
}: PVPCobraShotManagerProps) {
  // Track processed hits to avoid duplicates
  const processedHits = useRef<Set<string>>(new Set());
  
  useFrame(() => {
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
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
        
        // Use temporary Vector3 from pool instead of creating new one
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x, 
          player.position.y, 
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);
        
        if (distance <= 1.5) { // Hit radius
          // Convert player ID to number for hit tracking (consistent with CobraShotProjectile type)
          const playerIdNum = parseInt(player.id) || player.id.length; // Convert to number
          
          // Check if we haven't already hit this player
          if (!projectile.hitEnemies.has(playerIdNum)) {
            projectile.hitEnemies.add(playerIdNum);
            onPlayerHit(player.id, 29); // Cobra Shot damage
            
            // Apply venom effect at the HIT player's position (not the caster)
            // Use pooled Vector3 for the venom position
            const venomPosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerVenomed(player.id, venomPosition);
            
            // Release the Vector3 back to pool after use
            // Note: onPlayerVenomed should clone the vector if it needs to store it
            pvpObjectPool.releaseVector3(venomPosition);
            
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

/**
 * Optimized Barrage Manager with Object Pooling
 */
export function OptimizedPVPBarrageManager({ 
  world, 
  players, 
  onPlayerHit, 
  onPlayerSlowed, 
  serverPlayerEntities, 
  localSocketId 
}: PVPBarrageManagerProps) {
  const hitTracker = useRef<Set<string>>(new Set());
  
  useFrame(() => {
    if (!world) return;
    
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
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
      
      // Check collision with PVP players (only check players that are NOT the projectile owner)
      players.forEach(player => {
        // Skip if this is the projectile owner (they can't hit themselves)
        // Check both the socket ID and the entity ID mapping
        if (player.id === localSocketId) {
          return; // Don't hit yourself (socket ID check)
        }

        // Additional safety check: skip if this player's entity ID matches the projectile owner
        const playerEntityId = serverPlayerEntities.current.get(player.id);
        if (playerEntityId && playerEntityId === projectile.owner) {
          return; // Don't hit the projectile owner (entity ID check)
        }

        // Use temporary Vector3 from pool
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x,
          player.position.y,
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);

        if (distance <= 1.25) { // Hit radius
          // Create unique hit key using pooled method
          const hitKey = pvpObjectPool.createHitKey(projectileEntity.id, player.id);

          // Check if we haven't already hit this player with this projectile
          if (playerEntityId && !projectile.hasHitTarget(playerEntityId) && !hitTracker.current.has(hitKey)) {
            projectile.addHitTarget(playerEntityId);
            hitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 30); // Barrage damage
            
            // Apply slow effect at the HIT player's position (50% speed reduction for 5 seconds)
            // Use pooled Vector3 for the slow position
            const slowPosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerSlowed(player.id, slowPosition);
            
            // Release the Vector3 back to pool
            pvpObjectPool.releaseVector3(slowPosition);
            
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

/**
 * Optimized Frost Nova Manager with Object Pooling
 */
export function OptimizedPVPFrostNovaManager({ 
  world, 
  players, 
  onPlayerHit, 
  onPlayerFrozen, 
  serverPlayerEntities, 
  localSocketId 
}: PVPFrostNovaManagerProps) {
  const frostNovaHitTracker = useRef<Set<string>>(new Set());
  const lastUpdateTime = useRef(0);
  
  useFrame(() => {
    if (!world) return;
    
    // Throttle updates to avoid excessive checking
    const now = Date.now();
    if (now - lastUpdateTime.current < 50) return; // Update every 50ms
    lastUpdateTime.current = now;
    
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
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
        
        // Use temporary Vector3 from pool
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x, 
          player.position.y, 
          player.position.z
        );
        const frostNovaPos = frostNova.position;
        const distance = frostNovaPos.distanceTo(playerPos);
        const frostNovaRadius = 6.0; // Same radius as ControlSystem
        
        if (distance <= frostNovaRadius) {
          // Create unique hit key using pooled method
          const hitKey = pvpObjectPool.createHitKey(frostNova.id, player.id);
          
          // Check if we haven't already hit this player with this frost nova
          if (!frostNovaHitTracker.current.has(hitKey)) {
            frostNovaHitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 50); // FrostNova damage
            
            // Apply freeze effect at the HIT player's position
            // Use pooled Vector3 for the freeze position
            const freezePosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerFrozen(player.id, freezePosition);
            
            // Release the Vector3 back to pool
            pvpObjectPool.releaseVector3(freezePosition);
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              frostNovaHitTracker.current.delete(hitKey);
            }, 7000); // Clean up after 7 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

/**
 * Hook for optimized effect management with object pooling
 */
export function useOptimizedPVPEffects() {
  const createOptimizedVenomEffect = useCallback((
    playerId: string, 
    position: Vector3, 
    duration: number = 6000
  ) => {
    // Use pooled effect data object
    const effectData = pvpObjectPool.acquireEffectData();
    effectData.id = Date.now();
    effectData.playerId = playerId;
    effectData.position.copy(position);
    effectData.startTime = Date.now();
    effectData.duration = duration;
    
    // Return cleanup function
    return () => {
      pvpObjectPool.releaseEffectData(effectData);
    };
  }, []);
  
  const createOptimizedDebuffEffect = useCallback((
    playerId: string, 
    debuffType: 'frozen' | 'slowed',
    position: Vector3, 
    duration: number = 5000
  ) => {
    // Use pooled effect data object
    const effectData = pvpObjectPool.acquireEffectData();
    effectData.id = Date.now();
    effectData.playerId = playerId;
    effectData.debuffType = debuffType;
    effectData.position.copy(position);
    effectData.startTime = Date.now();
    effectData.duration = duration;
    
    // Return cleanup function
    return () => {
      pvpObjectPool.releaseEffectData(effectData);
    };
  }, []);
  
  return {
    createOptimizedVenomEffect,
    createOptimizedDebuffEffect,
    getPoolStats: () => pvpObjectPool.getStats()
  };
}

/**
 * Optimized Viper Sting Manager with Object Pooling
 * Handles PVP collision detection for Viper Sting projectiles
 */
export function OptimizedPVPViperStingManager({
  world,
  players,
  onPlayerHit,
  onPlayerVenomed,
  serverPlayerEntities,
  localSocketId
}: PVPViperStingManagerProps) {
  // Track processed hits to avoid duplicates
  const processedHits = useRef<Set<string>>(new Set());

  useFrame(() => {
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();

    // Get visual Viper Sting projectiles from the ViperStingManager
    const { getGlobalViperStingProjectiles } = require('@/components/projectiles/ViperStingManager');
    const viperStingProjectiles = getGlobalViperStingProjectiles();

    // Check each active Viper Sting projectile for player hits
    viperStingProjectiles.forEach((projectile: ViperStingProjectile) => {
      if (!projectile.active) return;

      const projectilePos = projectile.position;

      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }

        // Use temporary Vector3 from pool instead of creating new one
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x,
          player.position.y,
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);

        if (distance <= 1.4) { // Hit radius (same as ViperSting hook)
          // Use the same hit tracking as original Viper Sting logic
          const hitSet = projectile.isReturning ? projectile.returnHitEnemies : projectile.hitEnemies;

          // Check if we haven't already hit this player with this projectile
          if (!hitSet.has(player.id)) {
            hitSet.add(player.id);

            // Apply damage - Viper Sting damage is 61
            onPlayerHit(player.id, 61);

            // Viper Sting should apply its own DoT effect, not venom (that's Cobra Shot)
            // The DoT effect and soul steal healing will be handled by the original Viper Sting logic

            // IMPORTANT: Don't deactivate projectile here! Let the original Viper Sting logic
            // handle projectile lifecycle (forward -> return -> fade out)
          }
        }
      });
    });

    // Clear processed hits for next frame
    processedHits.current.clear();
  });

  return null; // This is a logic-only component
}
