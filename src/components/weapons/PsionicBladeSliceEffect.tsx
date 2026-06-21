'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface PsionicBladeSliceEffectProps {
  enemyEntityId: string;
  /** Player facing direction at the moment of impact — orients the crescent. */
  direction: Vector3;
  bladeSide?: 'left' | 'right';
  world: World;
  onComplete: () => void;
}

const DURATION = 0.28;
const SPARK_COUNT = 3;

const COLOR_CRESCENT = new Color('#a855f7');
const COLOR_SPARK_A = new Color('#e879f9');
const COLOR_SPARK_B = new Color('#c084fc');
const COLOR_FLASH = new Color('#f5d0fe');

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() * 0.5 - 0.25);
    const speed = 3.5 + Math.random() * 2.5;
    const delay = Math.random() * 0.04;
    const size = 0.04 + Math.random() * 0.06;
    const yBias = Math.random() * 0.25;
    return { angle, speed, delay, size, yBias };
  });
}

export default function PsionicBladeSliceEffect({
  enemyEntityId,
  direction,
  bladeSide = 'left',
  world,
  onComplete,
}: PsionicBladeSliceEffectProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const crescentRef = useRef<Mesh | null>(null);
  const flashRef = useRef<Mesh | null>(null);
  const sparkRefs = useRef<(Mesh | null)[]>(Array(SPARK_COUNT).fill(null));

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

  const sideYawOffset = bladeSide === 'left' ? -0.35 : 0.35;
  const crescentYaw = useMemo(
    () => Math.atan2(direction.x, direction.z) + sideYawOffset,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction.x, direction.z, sideYawOffset],
  );

  const crescentMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CRESCENT,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_FLASH,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const sparkMats = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: i % 2 === 0 ? COLOR_SPARK_A : COLOR_SPARK_B,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    const entity = world.getAllEntities().find((e) => e.id.toString() === enemyEntityId);
    if (!entity) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const health = entity.getComponent(Health);
    if (health?.isDead) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const transform = entity.getComponent(Transform);
    if (transform && groupRef.current) {
      const pos = transform.getWorldPosition();
      groupRef.current.position.set(pos.x, pos.y + 1.2, pos.z);
    }

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    if (flashRef.current) {
      const flashFade = t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.14);
      const scale = 0.2 + t * 4.5;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.9);
    }

    if (crescentRef.current) {
      const progress = Math.min(t / (DURATION * 0.65), 1.0);
      const scale = progress * 0.95;
      crescentRef.current.scale.set(scale, scale, scale);
      const fadeIn = t < 0.05 ? t / 0.05 : 1.0;
      const fadeOut =
        t > DURATION * 0.4 ? 1 - (t - DURATION * 0.4) / (DURATION * 0.6) : 1.0;
      crescentMat.opacity = Math.max(0, fadeIn * fadeOut * 0.95);
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      const mesh = sparkRefs.current[i];
      const mat = sparkMats[i];
      if (!mesh) continue;
      const { angle, speed, delay, size, yBias } = sparkParams[i];
      const localT = t - delay;
      if (localT <= 0) {
        mat.opacity = 0;
        continue;
      }

      const dist = localT * speed;
      mesh.position.set(
        Math.sin(angle) * dist,
        yBias + localT * 1.2,
        Math.cos(angle) * dist,
      );
      const s = size * (0.5 + localT * 2.0);
      mesh.scale.set(s, s, s);
      const localFade =
        localT < 0.05 ? localT / 0.05 : Math.max(0, 1 - (localT - 0.05) / (DURATION * 0.75));
      mat.opacity = Math.max(0, 0.9 * localFade);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={flashRef} rotation={[-Math.PI / 3, 0, 0]} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[0.6, 16]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      <mesh
        ref={crescentRef}
        rotation={[Math.PI / 2, -0.2, crescentYaw]}
        scale={[0.01, 0.01, 0.01]}
      >
        <torusGeometry args={[0.65, 0.06, 5, 32, Math.PI * 1.2]} />
        <primitive object={crescentMat} attach="material" />
      </mesh>

      {sparkParams.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
        >
          <planeGeometry args={[1, 1]} />
          <primitive object={sparkMats[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
