import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Matrix4, Color, Object3D, BufferGeometry, Material } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface InstancedEnemyRendererProps {
  world: World;
  maxInstances?: number;
}

interface EnemyInstance {
  entityId: number;
  type: EnemyType;
  matrixIndex: number;
  lastUpdateTime: number;
}

export default function InstancedEnemyRenderer({ 
  world, 
  maxInstances = 200 
}: InstancedEnemyRendererProps) {
  // Separate instanced meshes for each enemy type
  const bossInstancedMeshRef = useRef<InstancedMesh>(null);
  const eliteInstancedMeshRef = useRef<InstancedMesh>(null);
  const gruntInstancedMeshRef = useRef<InstancedMesh>(null);

  // Track instances for each enemy type
  const instancesRef = useRef<{
    boss: Map<number, EnemyInstance>;
    elite: Map<number, EnemyInstance>;
    grunt: Map<number, EnemyInstance>;
  }>({
    boss: new Map(),
    elite: new Map(),
    grunt: new Map()
  });

  // Track next available matrix indices
  const nextIndexRef = useRef<{
    boss: number;
    elite: number;
    grunt: number;
  }>({
    boss: 0,
    elite: 0,
    grunt: 0
  });

  // Reusable objects to reduce allocations
  const tempMatrix = useMemo(() => new Matrix4(), []);
  const tempObject = useMemo(() => new Object3D(), []);
  const tempColor = useMemo(() => new Color(), []);

  // Colors for different enemy types
  const enemyColors = useMemo(() => ({
    [EnemyType.BOSS]: new Color(0x8B0000),    // Dark red
    [EnemyType.ELITE]: new Color(0xFF4500),   // Orange red
    [EnemyType.GRUNT]: new Color(0xFF6B6B),   // Light red
    [EnemyType.DUMMY]: new Color(0x888888)    // Gray for dummy
  }), []);

  // Sizes for different enemy types
  const enemySizes = useMemo(() => ({
    [EnemyType.BOSS]: { x: 3, y: 3, z: 3 },
    [EnemyType.ELITE]: { x: 2, y: 2, z: 2 },
    [EnemyType.GRUNT]: { x: 1, y: 1, z: 1 },
    [EnemyType.DUMMY]: { x: 0.5, y: 0.5, z: 0.5 }
  }), []);

  const getInstancedMeshRef = (type: EnemyType) => {
    switch (type) {
      case EnemyType.BOSS: return bossInstancedMeshRef;
      case EnemyType.ELITE: return eliteInstancedMeshRef;
      case EnemyType.GRUNT: return gruntInstancedMeshRef;
      default: return gruntInstancedMeshRef;
    }
  };

  const getInstancesMap = (type: EnemyType) => {
    switch (type) {
      case EnemyType.BOSS: return instancesRef.current.boss;
      case EnemyType.ELITE: return instancesRef.current.elite;
      case EnemyType.GRUNT: return instancesRef.current.grunt;
      default: return instancesRef.current.grunt;
    }
  };

  const getNextIndex = (type: EnemyType) => {
    switch (type) {
      case EnemyType.BOSS: return nextIndexRef.current.boss++;
      case EnemyType.ELITE: return nextIndexRef.current.elite++;
      case EnemyType.GRUNT: return nextIndexRef.current.grunt++;
      default: return nextIndexRef.current.grunt++;
    }
  };

  const updateEnemyInstance = (
    entity: Entity, 
    enemyComponent: Enemy, 
    transform: Transform,
    instancedMesh: InstancedMesh,
    instances: Map<number, EnemyInstance>,
    currentTime: number
  ) => {
    let instance = instances.get(entity.id);
    
    if (!instance) {
      // Create new instance
      instance = {
        entityId: entity.id,
        type: enemyComponent.type,
        matrixIndex: getNextIndex(enemyComponent.type),
        lastUpdateTime: currentTime
      };
      instances.set(entity.id, instance);
    }

    // Update transform matrix with floating animation
    const size = enemySizes[enemyComponent.type];
    tempObject.position.copy(transform.position);
    
    // Add floating animation based on enemy type
    const floatOffset = Math.sin(currentTime * 0.002 + entity.id * 0.1) * 0.2;
    tempObject.position.y += floatOffset;
    
    // Add gentle rotation based on enemy type
    const rotationSpeed = enemyComponent.type === EnemyType.BOSS ? 0.0005 : 
                         enemyComponent.type === EnemyType.ELITE ? 0.001 : 0.002;
    tempObject.rotation.y = currentTime * rotationSpeed + entity.id * 0.1;
    
    tempObject.scale.set(size.x, size.y, size.z);
    tempObject.updateMatrix();

    // Set matrix for this instance
    instancedMesh.setMatrixAt(instance.matrixIndex, tempObject.matrix);

    // Update color based on health if available
    const health = entity.getComponent(Health);
    if (health) {
      const healthRatio = health.currentHealth / health.maxHealth;
      tempColor.copy(enemyColors[enemyComponent.type]);
      
      // Darken color as health decreases
      tempColor.multiplyScalar(0.5 + healthRatio * 0.5);
      instancedMesh.setColorAt(instance.matrixIndex, tempColor);
    } else {
      instancedMesh.setColorAt(instance.matrixIndex, enemyColors[enemyComponent.type]);
    }

    instance.lastUpdateTime = currentTime;
  };

  const cleanupDeadInstances = (
    instances: Map<number, EnemyInstance>,
    instancedMesh: InstancedMesh,
    currentTime: number
  ) => {
    const deadInstances: number[] = [];
    
    instances.forEach((instance, entityId) => {
      // Check if entity still exists
      const entity = world.getEntity(entityId);
      if (!entity || !entity.getComponent(Enemy) || !entity.getComponent(Transform)) {
        deadInstances.push(entityId);
      }
    });

    // Remove dead instances
    deadInstances.forEach(entityId => {
      const instance = instances.get(entityId);
      if (instance) {
        // Hide the instance by scaling it to zero
        tempMatrix.makeScale(0, 0, 0);
        instancedMesh.setMatrixAt(instance.matrixIndex, tempMatrix);
        instances.delete(entityId);
      }
    });

    if (deadInstances.length > 0) {
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  };

  useFrame(() => {
    if (!world) return;

    const currentTime = performance.now();
    const frameStart = performance.now();
    
    // Get all enemy entities in a single query
    const allEnemyEntities = world.queryEntities([Enemy, Transform]);
    
    // Separate entities by type and update instances
    const bosses: Entity[] = [];
    const elites: Entity[] = [];
    const grunts: Entity[] = [];

    for (const entity of allEnemyEntities) {
      const enemy = entity.getComponent(Enemy)!;
      switch (enemy.type) {
        case EnemyType.BOSS:
          bosses.push(entity);
          break;
        case EnemyType.ELITE:
          elites.push(entity);
          break;
        case EnemyType.GRUNT:
          grunts.push(entity);
          break;
      }
    }

    // Update boss instances
    if (bossInstancedMeshRef.current && bosses.length > 0) {
      for (const entity of bosses) {
        const enemy = entity.getComponent(Enemy)!;
        const transform = entity.getComponent(Transform)!;
        updateEnemyInstance(
          entity, 
          enemy, 
          transform, 
          bossInstancedMeshRef.current,
          instancesRef.current.boss,
          currentTime
        );
      }
      bossInstancedMeshRef.current.instanceMatrix.needsUpdate = true;
      if (bossInstancedMeshRef.current.instanceColor) {
        bossInstancedMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Update elite instances
    if (eliteInstancedMeshRef.current && elites.length > 0) {
      for (const entity of elites) {
        const enemy = entity.getComponent(Enemy)!;
        const transform = entity.getComponent(Transform)!;
        updateEnemyInstance(
          entity, 
          enemy, 
          transform, 
          eliteInstancedMeshRef.current,
          instancesRef.current.elite,
          currentTime
        );
      }
      eliteInstancedMeshRef.current.instanceMatrix.needsUpdate = true;
      if (eliteInstancedMeshRef.current.instanceColor) {
        eliteInstancedMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Update grunt instances
    if (gruntInstancedMeshRef.current && grunts.length > 0) {
      for (const entity of grunts) {
        const enemy = entity.getComponent(Enemy)!;
        const transform = entity.getComponent(Transform)!;
        updateEnemyInstance(
          entity, 
          enemy, 
          transform, 
          gruntInstancedMeshRef.current,
          instancesRef.current.grunt,
          currentTime
        );
      }
      gruntInstancedMeshRef.current.instanceMatrix.needsUpdate = true;
      if (gruntInstancedMeshRef.current.instanceColor) {
        gruntInstancedMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Cleanup dead instances periodically (every 60 frames ~1 second at 60fps)
    if (Math.floor(currentTime / 16.67) % 60 === 0) {
      if (bossInstancedMeshRef.current) {
        cleanupDeadInstances(instancesRef.current.boss, bossInstancedMeshRef.current, currentTime);
      }
      if (eliteInstancedMeshRef.current) {
        cleanupDeadInstances(instancesRef.current.elite, eliteInstancedMeshRef.current, currentTime);
      }
      if (gruntInstancedMeshRef.current) {
        cleanupDeadInstances(instancesRef.current.grunt, gruntInstancedMeshRef.current, currentTime);
      }
    }

    // Performance logging (only log every 60 frames to avoid spam)
    if (Math.floor(currentTime / 16.67) % 60 === 0) {
      const frameTime = performance.now() - frameStart;
      const totalEnemies = bosses.length + elites.length + grunts.length;
      if (totalEnemies > 0) {
        console.log(`🚀 Instanced Rendering: ${totalEnemies} enemies (${bosses.length} bosses, ${elites.length} elites, ${grunts.length} grunts) rendered in ${frameTime.toFixed(2)}ms`);
      } else {
        console.log(`⚠️ No enemies found in world query`);
      }
    }
  });

  return (
    <>
      {/* Boss Enemies - Instanced (Large imposing shapes) */}
      <instancedMesh
        ref={bossInstancedMeshRef}
        args={[undefined, undefined, Math.floor(maxInstances * 0.1)]} // 10% for bosses
        castShadow
        receiveShadow
      >
        <octahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial 
          color={enemyColors[EnemyType.BOSS]}
          emissive={enemyColors[EnemyType.BOSS]}
          emissiveIntensity={0.2}
          metalness={0.6}
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </instancedMesh>

      {/* Elite Enemies - Instanced (Crystal-like ice structures) */}
      <instancedMesh
        ref={eliteInstancedMeshRef}
        args={[undefined, undefined, Math.floor(maxInstances * 0.3)]} // 30% for elites
        castShadow
        receiveShadow
      >
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial 
          color="#4FC3F7"
          emissive="#29B6F6"
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
          metalness={0.8}
          roughness={0.2}
        />
      </instancedMesh>

      {/* Grunt Enemies - Instanced (Smaller skeletal shapes) */}
      <instancedMesh
        ref={gruntInstancedMeshRef}
        args={[undefined, undefined, Math.floor(maxInstances * 0.6)]} // 60% for grunts
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial 
          color="#4169E1"
          emissive="#1E3A8A"
          emissiveIntensity={0.2}
          transparent
          opacity={0.85}
          metalness={0.6}
          roughness={0.3}
        />
      </instancedMesh>
    </>
  );
}
