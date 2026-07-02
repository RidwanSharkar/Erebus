'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Color,
  AdditiveBlending,
  SphereGeometry,
  MeshBasicMaterial,
  InstancedMesh,
  Object3D,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

const IGNITE_LIGHT_COLOR = new Color('#FF8C42');
const EMBER_COUNT = 18;
const ANCHOR_Y_OFFSET = 0.9;
const BASE_Y = 0.05;

interface IgnitedEnemyData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

type IgniteEnemyData = {
  id: string;
  position: Vector3;
  health: number;
  isDying?: boolean;
  deathStartTime?: number;
};

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

function IgniteRing({
  enemyId,
  startPosition,
  startTime,
  duration,
  enemyData,
  onComplete,
}: {
  enemyId: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
  enemyData: IgniteEnemyData[];
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const emberInstRef = useRef<InstancedMesh>(null);
  const baseGlowRef = useRef<any>(null);
  const elapsedRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const colorScratch = useRef(new Color());

  const igniteLight = useDynamicLight({ color: IGNITE_LIGHT_COLOR, distance: 5, decay: 2, priority: 1 });

  const emberData = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, () => ({
        r: 0.12 + Math.random() * 0.38,
        a: Math.random() * Math.PI * 2,
        speed: 0.85 + Math.random() * 1.1,
        phase: Math.random() * 2.8,
        wobble: Math.random() * Math.PI * 2,
        maxY: 1.0 + Math.random() * 0.75,
        scale: 0.1 + Math.random() * 0.04,
      })),
    [],
  );

  const dummy = useMemo(() => new Object3D(), []);

  const emberGeo = useMemo(() => new SphereGeometry(1, 7, 7), []);
  const emberMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
        vertexColors: true,
      }),
    [],
  );

  const baseGlowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#FF6B35',
        transparent: true,
        opacity: 0.38,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#FF4500',
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const ringGeo = useMemo(() => new SphereGeometry(1, 6, 6), []);

  useEffect(() => {
    const g = emberGeo;
    const m = emberMat;
    const bg = baseGlowMat;
    const rg = ringGeo;
    const rm = ringMat;
    return () => {
      g.dispose();
      m.dispose();
      bg.dispose();
      rg.dispose();
      rm.dispose();
    };
  }, [emberGeo, emberMat, baseGlowMat, ringGeo, ringMat]);

  const updateEmberInstances = (elapsedSeconds: number, lifeT: number) => {
    const im = emberInstRef.current;
    if (!im) return;

    for (let i = 0; i < emberData.length; i++) {
      const m = emberData[i];
      const yRaw = (elapsedSeconds * m.speed + m.phase) % m.maxY;
      const riseT = yRaw / m.maxY;
      const wobble = Math.sin(elapsedSeconds * 3.5 + m.wobble) * 0.07;
      const y = BASE_Y + yRaw;
      const x = Math.cos(m.a) * m.r + wobble;
      const z = Math.sin(m.a) * m.r - wobble * 0.6;

      dummy.position.set(x, y, z);
      const s = m.scale * (0.75 + 0.25 * (1 - riseT));
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);

      const fadeT = Math.max(0, (1 - lifeT * 0.25) * (0.35 + 0.65 * (1 - riseT)));
      if (riseT < 0.25) {
        colorScratch.current.set('#FFE066');
      } else if (riseT < 0.6) {
        colorScratch.current.set('#FF8C42');
      } else {
        colorScratch.current.set('#FF4500');
      }
      colorScratch.current.multiplyScalar(0.45 + 0.55 * fadeT);
      im.setColorAt(i, colorScratch.current);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };

  useEffect(() => {
    updateEmberInstances(0, 0);
  }, [emberData, dummy]);

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

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs >= duration) {
      finish();
      return;
    }

    const lifeT = elapsedMs / duration;

    let pos = startPosition.clone();
    pos.y += ANCHOR_Y_OFFSET;

    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find((enemy) => enemy.id === enemyId);
      if (target) {
        if (target.health <= 0 || target.isDying || target.deathStartTime) {
          finish();
          return;
        }
        pos.set(target.position.x, target.position.y + ANCHOR_Y_OFFSET, target.position.z);
      }
    }

    const pulse = 0.85 + 0.15 * Math.sin(elapsedRef.current * 8.5);

    if (groupRef.current) {
      groupRef.current.position.copy(pos);
      groupRef.current.scale.setScalar(pulse);
    }

    igniteLight.current?.setPosition(pos.x, pos.y, pos.z);
    igniteLight.current?.setIntensity(2.2 * pulse);

    if (baseGlowRef.current?.material) {
      baseGlowRef.current.material.opacity = 0.32 + 0.12 * Math.sin(elapsedRef.current * 6);
    }

    updateEmberInstances(elapsedRef.current, lifeT);

    if (Date.now() - lastSoundAtRef.current >= 1100) {
      lastSoundAtRef.current = Date.now();
      (window as any).audioSystem?.playIgniteStatusSound?.(pos);
    }
  });

  return (
    <group ref={groupRef} position={[startPosition.x, startPosition.y + ANCHOR_Y_OFFSET, startPosition.z]}>
      <mesh ref={baseGlowRef} position={[0, BASE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <primitive object={baseGlowMat} attach="material" />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = 0.42;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, BASE_Y + 0.05 + (i % 2) * 0.08, Math.sin(a) * r]}
            geometry={ringGeo}
            material={ringMat}
            scale={0.06}
          />
        );
      })}
      <instancedMesh ref={emberInstRef} args={[emberGeo, emberMat, EMBER_COUNT]} frustumCulled={false} />
    </group>
  );
}

export default function IgniteEffectManager({ world }: IgniteEffectManagerProps) {
  const [ignited, setIgnited] = useState<IgnitedEnemyData[]>([]);
  const idCounter = useRef(0);
  const lastUpdateTime = useRef(0);
  const ignitedRef = useRef(ignited);
  ignitedRef.current = ignited;

  const getEnemyData = useCallback((): IgniteEnemyData[] => {
    if (!world) return [];

    return world
      .getAllEntities()
      .filter((entity) => entity.hasComponent(Enemy) && entity.hasComponent(Transform) && entity.hasComponent(Health))
      .filter(
        (entity) =>
          !entity.userData?.isCoopAlliedUnit &&
          entity.userData?.coopServerEnemyType !== 'allied-knight',
      )
      .map((entity) => {
        const transform = entity.getComponent(Transform)!;
        const health = entity.getComponent(Health)!;

        return {
          id: entity.id.toString(),
          position: transform.position.clone(),
          health: health.currentHealth,
          isDying: health.isDead,
          deathStartTime: health.isDead ? Date.now() : undefined,
        };
      });
  }, [world]);

  const addIgnitedEnemy = useCallback((enemyId: string, position: Vector3, duration: number = 3000) => {
    setIgnited((prev) => {
      const rest = prev.filter((row) => row.enemyId !== enemyId);
      return [
        ...rest,
        {
          id: idCounter.current++,
          enemyId,
          position: position.clone(),
          startTime: Date.now(),
          duration,
        },
      ];
    });
  }, []);

  useEffect(() => {
    globalIgniteManager = { addIgnitedEnemy };
    return () => {
      globalIgniteManager = null;
    };
  }, [addIgnitedEnemy]);

  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const nowSec = Date.now() / 1000;
    const allEntities = world.getAllEntities();

    allEntities.forEach((entity) => {
      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);
      const health = entity.getComponent(Health);

      if (enemy && transform && health && !health.isDead && enemy.isIgnitedActive(nowSec)) {
        const existing = ignitedRef.current.find((row) => row.enemyId === entity.id.toString());
        if (!existing) {
          const remainingMs = enemy.getIgniteRemainingMs(nowSec);
          addIgnitedEnemy(
            entity.id.toString(),
            transform.position,
            remainingMs > 0 ? remainingMs : 3000,
          );
        }
      }
    });

    setIgnited((prev) =>
      prev.filter((row) => {
        const entity = allEntities.find((e) => e.id.toString() === row.enemyId);
        if (!entity) return false;

        const enemy = entity.getComponent(Enemy);
        const health = entity.getComponent(Health);
        if (!enemy || !health || health.isDead) return false;

        return enemy.isIgnitedActive(nowSec);
      }),
    );
  });

  const handleIgniteEffectComplete = (enemyKey: string) => {
    setIgnited((prev) => prev.filter((row) => row.enemyId !== enemyKey));
  };

  const enemyData = getEnemyData();

  return (
    <>
      {ignited.map((row) => (
        <IgniteRing
          key={row.enemyId}
          enemyId={row.enemyId}
          startPosition={row.position}
          startTime={row.startTime}
          duration={row.duration}
          enemyData={enemyData}
          onComplete={() => handleIgniteEffectComplete(row.enemyId)}
        />
      ))}
    </>
  );
}
