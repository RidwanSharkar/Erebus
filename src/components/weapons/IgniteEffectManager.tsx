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
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

const IGNITE_LIGHT_COLOR = new Color('#FF8C42');
const EMBER_COUNT = 18;
const BASE_Y = -0.55;

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

function IgniteRing({
  enemyId,
  startPosition,
  startTime,
  duration,
  world,
  onComplete,
}: {
  enemyId: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
  world?: World;
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
        r: 0.08 + Math.random() * 0.38,
        a: Math.random() * Math.PI * 2,
        speed: 0.85 + Math.random() * 1.1,
        phase: Math.random() * 2.8,
        wobble: Math.random() * Math.PI * 2,
        maxY: 1.2 + Math.random() * 0.85,
        scale: 0.04 + Math.random() * 0.05,
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
        opacity: 0.9,
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
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const g = emberGeo;
    const m = emberMat;
    const bg = baseGlowMat;
    return () => {
      g.dispose();
      m.dispose();
      bg.dispose();
    };
  }, [emberGeo, emberMat, baseGlowMat]);

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
          pos.y += 1.0;
        }
      }
    }

    if (groupRef.current) {
      groupRef.current.position.copy(pos);
    }

    const flicker = 0.85 + 0.15 * Math.sin(elapsedRef.current * 8.5);
    igniteLight.current?.setPosition(pos.x, pos.y, pos.z);
    igniteLight.current?.setIntensity(2.0 * flicker);

    if (baseGlowRef.current?.material) {
      baseGlowRef.current.material.opacity = 0.18 + 0.08 * Math.sin(elapsedRef.current * 6);
    }

    const im = emberInstRef.current;
    if (im) {
      for (let i = 0; i < emberData.length; i++) {
        const m = emberData[i];
        const yRaw = (elapsedRef.current * m.speed + m.phase) % m.maxY;
        const riseT = yRaw / m.maxY;
        const wobble = Math.sin(elapsedRef.current * 3.5 + m.wobble) * 0.07;
        const y = BASE_Y + yRaw;
        const x = Math.cos(m.a) * m.r + wobble;
        const z = Math.sin(m.a) * m.r - wobble * 0.6;

        dummy.position.set(x, y, z);
        const s = m.scale * (0.75 + 0.25 * (1 - riseT));
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);

        const fadeT = Math.max(0, (1 - lifeT * 0.35) * (0.25 + 0.75 * (1 - riseT)));
        if (riseT < 0.25) {
          colorScratch.current.set('#FFE066');
        } else if (riseT < 0.6) {
          colorScratch.current.set('#FF8C42');
        } else {
          colorScratch.current.set('#FF4500');
        }
        colorScratch.current.multiplyScalar(0.35 + 0.65 * fadeT);
        im.setColorAt(i, colorScratch.current);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    if (Date.now() - lastSoundAtRef.current >= 1100) {
      lastSoundAtRef.current = Date.now();
      (window as any).audioSystem?.playIgniteStatusSound?.(pos);
    }
  });

  return (
    <group ref={groupRef} position={[startPosition.x, startPosition.y + 1.0, startPosition.z]}>
      <mesh ref={baseGlowRef} position={[0, BASE_Y + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <primitive object={baseGlowMat} attach="material" />
      </mesh>
      <instancedMesh ref={emberInstRef} args={[emberGeo, emberMat, EMBER_COUNT]} frustumCulled={false} />
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
