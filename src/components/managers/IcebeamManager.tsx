import { useRef, useCallback, useEffect, useMemo } from 'react';
import { Vector3, Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy as EnemyComponent } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { CombatSystem } from '@/systems/CombatSystem';
import Icebeam from '@/components/weapons/Icebeam';

interface IcebeamManagerProps {
  world: World;
  playerRef: React.RefObject<Group>;
  isIcebeaming: boolean;
  onIcebeamEnd?: () => void;
}

export default function IcebeamManager({
  world,
  playerRef,
  isIcebeaming,
  onIcebeamEnd
}: IcebeamManagerProps) {
  const icebeamStartTime = useRef<number | null>(null);
  const lastDamageTime = useRef<Record<number, number>>({});
  const damageInterval = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  // Beam properties
  const BEAM_LENGTH = 20;
  const BEAM_WIDTH = 1.375;
  const DAMAGE_INTERVAL = 250; // Deal damage every 250ms

  // Cache vector instances to prevent garbage collection
  const beamPos2D = useMemo(() => new Vector3(), []);
  const enemyPos2D = useMemo(() => new Vector3(), []);
  const beamDirection2D = useMemo(() => new Vector3(), []);
  const enemyDirection = useMemo(() => new Vector3(), []);
  const projectedPoint = useMemo(() => new Vector3(), []);

  const stopIcebeam = useCallback(() => {
    isActiveRef.current = false;

    if (damageInterval.current) {
      clearInterval(damageInterval.current);
      damageInterval.current = null;
    }

    icebeamStartTime.current = null;
    lastDamageTime.current = {};
  }, []);

  const dealDamageToEnemies = useCallback(() => {
    if (!isActiveRef.current || !playerRef.current) {
      return;
    }

    const currentTime = Date.now();
    const timeActive = icebeamStartTime.current ? (currentTime - icebeamStartTime.current) / 1000 : 0;
    
    // Calculate damage scaling - increases every second held
    const baseDamage = 35;
    const damageMultiplier = 1 + Math.floor(timeActive) * 0.5; // +50% damage per second held
    const finalDamage = Math.floor(baseDamage * damageMultiplier);

    // Get current beam position and direction from player
    const position = playerRef.current.position.clone();
    position.y += 1;
    const direction = new Vector3(0, 0, 1).applyQuaternion(playerRef.current.quaternion);

    // Get all enemies from the world
    const entities = world.queryEntities([EnemyComponent, Transform]);

    // Get combat system for damage dealing
    const combatSystem = world.getSystem(CombatSystem);
    if (!combatSystem) return;

    entities.forEach(entity => {
      const enemy = entity.getComponent(EnemyComponent);
      const transform = entity.getComponent(Transform);
      
      if (!enemy || !transform || enemy.isDead) {
        return;
      }
      
      const now = Date.now();
      const lastHit = lastDamageTime.current[entity.id] || 0;
      
      // Deal damage every 250ms
      if (now - lastHit < DAMAGE_INTERVAL) {
        return;
      }
      
      // Reuse vector instances for collision detection
      beamPos2D.set(position.x, 0, position.z);
      enemyPos2D.set(transform.position.x, 0, transform.position.z);
      beamDirection2D.copy(direction).setY(0).normalize();
      enemyDirection.copy(enemyPos2D).sub(beamPos2D);
      
      const projectedDistance = enemyDirection.dot(beamDirection2D);

      // Check if enemy is in front and within beam length
      if (projectedDistance <= 0 || projectedDistance > BEAM_LENGTH) {
        return;
      }
      
      // Check perpendicular distance from beam center
      projectedPoint.copy(beamPos2D).add(beamDirection2D.multiplyScalar(projectedDistance));
      const perpendicularDistance = enemyPos2D.distanceTo(projectedPoint);
      
      if (perpendicularDistance < BEAM_WIDTH) {
        // Enemy is hit by the beam - apply damage through combat system
        const isCritical = damageMultiplier >= 2; // Critical display if 2x+ damage
        combatSystem.queueDamage(
          entity,
          finalDamage,
          undefined, // source entity
          'icebeam',
          undefined, // sourcePlayerId
          isCritical
        );
        
        lastDamageTime.current[entity.id] = now;
      }
    });
  }, [playerRef, world, beamPos2D, enemyPos2D, beamDirection2D, enemyDirection, projectedPoint, BEAM_LENGTH, BEAM_WIDTH, DAMAGE_INTERVAL]);


  // Handle icebeam state changes
  useEffect(() => {
    isActiveRef.current = isIcebeaming;
    
    if (isIcebeaming) {
      // Start icebeam
      icebeamStartTime.current = Date.now();

      // Clear any existing interval
      if (damageInterval.current) {
        clearInterval(damageInterval.current);
        damageInterval.current = null;
      }

      // Start damage interval immediately and then every 50ms
      dealDamageToEnemies();
      damageInterval.current = setInterval(() => {
        dealDamageToEnemies();
      }, 50); // Check every 50ms for smooth damage
    } else {
      // Stop icebeam
      stopIcebeam();
    }
  }, [isIcebeaming, dealDamageToEnemies, stopIcebeam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopIcebeam();
    };
  }, [stopIcebeam]);

  // Calculate intensity for visual feedback
  const getIntensity = () => {
    if (!icebeamStartTime.current) return 1;
    const timeActive = (Date.now() - icebeamStartTime.current) / 1000;
    return 1 + Math.floor(timeActive) * 0.5;
  };

  // Render the icebeam visual effect if active
  if (!isIcebeaming || !playerRef.current) {
    return null;
  }

  return (
    <Icebeam
      parentRef={playerRef}
      onComplete={() => {}}
      isActive={isIcebeaming}
      startTime={icebeamStartTime.current || Date.now()}
      intensity={getIntensity()}
    />
  );
}

