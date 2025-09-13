import { useRef, memo } from 'react';
import { Group, Vector3, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import DivineStormShard from './DivineStormShard';
import { Color } from '@/utils/three-exports';

interface DivineStormProps {
  position: Vector3;
  onComplete: () => void;
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  onHitTarget?: (targetId: string, damage: number, isCritical: boolean, position: Vector3, isDivineStorm: boolean) => void;
  parentRef?: React.RefObject<Group>;
  isActive?: boolean; // Control if divine storm should remain active
  playerId?: string; // ID of the player who cast the Divine Storm (to prevent self-damage)
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
}

const DivineStormComponent = memo(function DivineStorm({
  position,
  onComplete,
  parentRef,
  isActive = true,
  enemyData = [],
  onHitTarget,
  playerId,
  setDamageNumbers,
  nextDamageNumberId
}: DivineStormProps) {
  const stormRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const shardsRef = useRef<Array<{ id: number; position: Vector3; type: 'orbital' | 'falling' }>>([]);
  const lastHitTime = useRef<Record<string, number>>({});
  
  // Smaller parameters than Firestorm for more focused divine effect
  const ORBITAL_RADIUS = 1.5;        // Smaller radius than firestorm
  const FALLING_RADIUS = 1.0;        // Smaller radius for concentration
  const ORBITAL_HEIGHT = -2.0;       // Height for orbital shards
  const FALLING_HEIGHT = 1.0;        // Starting height for falling shards

  useFrame((_, delta) => {
    if (!stormRef.current) return;

    // Use position prop if parentRef is not available or doesn't have position
    const parentPosition = parentRef?.current?.position || position;
    stormRef.current.position.copy(parentPosition);

    const now = Date.now();

    // Only auto-complete if isActive is false (managed externally)
    if (!isActive) {
      onComplete();
      return;
    }
    
    progressRef.current += delta;

    // Slower rotation than firestorm for more elegant divine effect
    stormRef.current.rotation.y += delta * 4;

    // Damage detection - check distance from storm center
    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;

      // Prevent self-damage: skip if this enemy is the player who cast the Divine Storm
      if (playerId && enemy.id === playerId) return;

      const lastHitTimeForEnemy = lastHitTime.current[enemy.id] || 0;
      if (now - lastHitTimeForEnemy < 200) return; // 200ms cooldown between hits on same enemy

      // Calculate distance from storm center (parent position)
      const distance = parentPosition.distanceTo(enemy.position);

      if (distance <= 4.0) { // Hit range from storm center - 5 distance radius
        lastHitTime.current[enemy.id] = now;

        // Deal 40 damage per hit (based on rotation speed)
        onHitTarget?.(enemy.id, 40, false, enemy.position, true);

        // Create damage number
        if (setDamageNumbers && nextDamageNumberId) {
          setDamageNumbers(prev => [...prev, {
            id: nextDamageNumberId.current++,
            damage: 40,
            position: enemy.position.clone(),
            isCritical: false,
            isDivineStorm: true
          }]);
        }
      }
    });

    // Spawn orbital shards - less frequent than firestorm for cleaner look
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * ORBITAL_RADIUS;
      
      const orbitalPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        ORBITAL_HEIGHT + Math.random() * 0.6,
        Math.sin(angle) * spawnRadius
      );

      shardsRef.current.push({
        id: Date.now() + Math.random(),
        position: orbitalPosition,
        type: 'orbital'
      });
    }

    // Spawn falling shards
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * FALLING_RADIUS;
      
      const fallingPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        FALLING_HEIGHT + Math.random() * 1.2,
        Math.sin(angle) * spawnRadius
      );

      shardsRef.current.push({
        id: Date.now() + Math.random(),
        position: fallingPosition,
        type: 'falling'
      });
    }

    // Limit total shards to prevent performance issues
    if (shardsRef.current.length > 50) {
      shardsRef.current = shardsRef.current.slice(-50);
    }
  });

  return (
    <group ref={stormRef}>
 
      {/* Divine light */}
      <pointLight 
        color={new Color(0xFFD700)}
        intensity={1}
        distance={8}
        decay={1}
      />
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (!prevProps.position.equals(nextProps.position)) return false;
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.playerId !== nextProps.playerId) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;
  if (prevProps.parentRef !== nextProps.parentRef) return false;

  if (prevProps.enemyData && nextProps.enemyData) {
    for (let i = 0; i < prevProps.enemyData.length; i++) {
      const prev = prevProps.enemyData[i];
      const next = nextProps.enemyData[i];
      if (!prev || !next) return false;
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position)) {
        return false;
      }
    }
  }

  return true;
});

export default DivineStormComponent;
