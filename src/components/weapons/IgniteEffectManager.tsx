'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Color, AdditiveBlending, SphereGeometry, MeshBasicMaterial, Mesh } from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { World } from '@/ecs/World';

const IGNITE_LIGHT_COLOR = new Color('#FF8C42');
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface IgnitedEnemyData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

let globalIgniteManager: {
  addIgnitedEnemy: (enemyId: string, position: Vector3, duration?: number) => void;
} | null = null;

export const addGlobalIgnitedEnemy = (enemyId: string, position: Vector3, duration: number = 3000): boolean => {
  if (globalIgniteManager) {
    globalIgniteManager.addIgnitedEnemy(enemyId, position, duration);
    return true;
  }
  return false;
};

interface IgniteEffectManagerProps {
  world?: World;
}

function EmberOrb({ offset }: { offset: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 2.2;
  });
  return (
    <mesh ref={meshRef} position={offset}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshBasicMaterial color="#FF6B35" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function IgniteRing({ enemyId, startPosition, startTime, duration, world, onComplete }: {
  enemyId: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
  world?: World;
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const geom = useMemo(() => new SphereGeometry(0.06, 6, 6), []);
  const lastSoundAtRef = useRef(0);

  // Borrow a pooled point light for the ember glow instead of mounting a <pointLight>.
  const igniteLight = useDynamicLight({ color: IGNITE_LIGHT_COLOR, distance: 3.5, decay: 2, priority: 1 });
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#FF4500',
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const g = geom;
    const m = mat;
    return () => {
      g.dispose();
      m.dispose();
    };
  }, [geom, mat]);

  const completedRef = useRef(false);
  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    lastSoundAtRef.current = Date.now();
    (window as any).audioSystem?.playIgniteStatusSound?.(startPosition);
  }, [startPosition, startTime]);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration) {
      finish();
      return;
    }
    let pos = startPosition.clone();
    if (world) {
      const entity = world.getAllEntities().find((e) => e.id.toString() === enemyId);
      if (entity) {
        const t = entity.getComponent(Transform);
        const h = entity.getComponent(Health);
        if (h?.isDead) {
          finish();
          return;
        }
        if (t && h && !h.isDead) {
          pos = t.position.clone();
          pos.y += 0.9;
        }
      }
    }
    if (groupRef.current) {
      groupRef.current.position.copy(pos);
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * 0.012);
      groupRef.current.scale.setScalar(pulse);
    }
    // Drive the pooled light at the ring's world position (constant intensity).
    igniteLight.current?.setPosition(pos.x, pos.y, pos.z);
    igniteLight.current?.setIntensity(2.2);
    if (Date.now() - lastSoundAtRef.current >= 1100) {
      lastSoundAtRef.current = Date.now();
      (window as any).audioSystem?.playIgniteStatusSound?.(pos);
    }
  });

  return (
    <group ref={groupRef} position={[startPosition.x, startPosition.y + 0.9, startPosition.z]}>
      {/* Ember glow point light now driven via the shared dynamic light pool (see useFrame). */}
      <EmberOrb offset={[0.25, 0.15, 0]} />
      <EmberOrb offset={[-0.22, 0.12, 0.08]} />
      <EmberOrb offset={[0.05, -0.2, -0.18]} />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = 0.45;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.05 + (i % 2) * 0.08, Math.sin(a) * r]} geometry={geom} material={mat} />
        );
      })}
    </group>
  );
}

export default function IgniteEffectManager({ world }: IgniteEffectManagerProps) {
  const [ignited, setIgnited] = useState<IgnitedEnemyData[]>([]);
  const idCounter = useRef(0);

  const addIgnitedEnemy = useCallback((enemyId: string, position: Vector3, duration: number = 3000) => {
    setIgnited((prev) => [
      ...prev,
      {
        id: idCounter.current++,
        enemyId,
        position: position.clone(),
        startTime: Date.now(),
        duration,
      },
    ]);
  }, []);

  useEffect(() => {
    globalIgniteManager = { addIgnitedEnemy };
    return () => {
      globalIgniteManager = null;
    };
  }, [addIgnitedEnemy]);

  return (
    <>
      {ignited.map((row) => (
        <IgniteRing
          key={row.id}
          enemyId={row.enemyId}
          startPosition={row.position}
          startTime={row.startTime}
          duration={row.duration}
          world={world}
          onComplete={() => setIgnited((p) => p.filter((x) => x.id !== row.id))}
        />
      ))}
    </>
  );
}
