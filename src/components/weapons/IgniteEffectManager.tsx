'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Color,
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  MeshBasicMaterial,
  Points,
  CylinderGeometry,
  RingGeometry,
  SphereGeometry,
  DoubleSide,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';

export type IgniteFlameVariant = 'ignite' | 'shadowflame';

const IGNITE_LIGHT_COLOR = new Color('#FF8C42');
const SHADOWFLAME_LIGHT_COLOR = new Color('#9B7EDE');
const EMBER_COUNT = 58;
const ANCHOR_Y_OFFSET = 0.9;
const BASE_Y = 0.05;
const ORIGIN_DISK_RADIUS = 0.75;

// InstancedEmbers red palette — dim (cool/fading) → bright (hot core)
const IGNITE_DIM = new Vector3(0.25, 0.02, 0.0);
const IGNITE_BRIGHT = new Vector3(1.0, 0.55, 0.05);

// Shadowflame purple/blue palette
const SHADOWFLAME_DIM = new Vector3(0.12, 0.04, 0.35);
const SHADOWFLAME_BRIGHT = new Vector3(0.55, 0.35, 1.0);

// Inverse of VoidPortal drag particles — small sparks rising from the ground.
const EMBER_VERT = `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aStartHeight;

  uniform float uTime;
  uniform vec3  uColorDim;
  uniform vec3  uColorBright;

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float cycle = 1.8 + hash(aIndex) * 1.4;
    float t     = mod(uTime * aSpeed + aIndex * 1.618, cycle);
    float tNorm = t / cycle;

    float angle = aIndex * 2.39996 + uTime * aSpeed * 0.85;
    float startRadius = 0.18 + hash(aIndex + 3.0) * 0.62;
    float radius = startRadius * pow(1.0 - tNorm, 1.6);

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y = aStartHeight + tNorm * (2.6 + hash(aIndex + 11.0) * 2.4);

    pos.x += sin(uTime * 4.2 + aIndex * 5.7) * 0.04 * tNorm;
    pos.z += cos(uTime * 3.5 + aIndex * 3.3) * 0.04 * tNorm;

    vAlpha = smoothstep(0.0, 0.08, tNorm) * (1.0 - smoothstep(0.45, 0.88, tNorm));

    float heat = 1.0 - tNorm;
    vColor = mix(uColorDim, uColorBright, heat * heat);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.2 - tNorm * 0.5) * (220.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const EMBER_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;
  uniform float uGlobalOpacity;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.3, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9 * uGlobalOpacity);
  }
`;

interface IgnitedEnemyData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
  variant: IgniteFlameVariant;
}

type IgniteEnemyData = {
  id: string;
  position: Vector3;
  health: number;
  isDying?: boolean;
  deathStartTime?: number;
};

let globalIgniteManager: {
  addIgnitedEnemy: (
    enemyId: string,
    position: Vector3,
    duration?: number,
    variant?: IgniteFlameVariant,
  ) => void;
} | null = null;

export const addGlobalIgnitedEnemy = (
  enemyId: string,
  position: Vector3,
  duration: number = 3000,
): boolean => {
  if (globalIgniteManager) {
    globalIgniteManager.addIgnitedEnemy(enemyId, position, duration, 'ignite');
    return true;
  }
  return false;
};

export const addGlobalShadowflamedEnemy = (
  enemyId: string,
  position: Vector3,
  duration: number = 2500,
): boolean => {
  if (globalIgniteManager) {
    globalIgniteManager.addIgnitedEnemy(enemyId, position, duration, 'shadowflame');
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
  variant,
  onComplete,
}: {
  enemyId: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
  enemyData: IgniteEnemyData[];
  variant: IgniteFlameVariant;
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);
  const ringRef = useRef<any>(null);
  const pillarRef = useRef<any>(null);
  const coreRef = useRef<any>(null);
  const elapsedRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const completedRef = useRef(false);
  const posScratch = useRef(new Vector3());

  const isShadowflame = variant === 'shadowflame';
  const lightColor = isShadowflame ? SHADOWFLAME_LIGHT_COLOR : IGNITE_LIGHT_COLOR;
  const igniteLight = useDynamicLight({ color: lightColor, distance: 8, decay: 2, priority: 1 });

  const { emberGeo, emberMat } = useMemo(() => {
    const indices = new Float32Array(EMBER_COUNT);
    const origins = new Float32Array(EMBER_COUNT * 3);
    const speeds = new Float32Array(EMBER_COUNT);
    const sizes = new Float32Array(EMBER_COUNT);
    const startHeights = new Float32Array(EMBER_COUNT);
    const positions = new Float32Array(EMBER_COUNT * 3);

    for (let i = 0; i < EMBER_COUNT; i++) {
      indices[i] = i;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * ORIGIN_DISK_RADIUS;
      origins[i * 3] = Math.cos(a) * r;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 1.8 + Math.random() * 2.0;
      sizes[i] = 1.2 + Math.random() * 2.0;
      startHeights[i] = Math.random() * 0.25;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex', new Float32BufferAttribute(indices, 1));
    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aStartHeight', new Float32BufferAttribute(startHeights, 1));

    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorDim: { value: (isShadowflame ? SHADOWFLAME_DIM : IGNITE_DIM).clone() },
        uColorBright: { value: (isShadowflame ? SHADOWFLAME_BRIGHT : IGNITE_BRIGHT).clone() },
        uGlobalOpacity: { value: 1 },
      },
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    return { emberGeo: geometry, emberMat: material };
  }, [isShadowflame]);

  const geos = useMemo(
    () => ({
      ring: new RingGeometry(0.55, 1.0, 32),
      pillar: new CylinderGeometry(0.35, 0.9, 2.4, 28, 1, true),
      core: new SphereGeometry(0.18, 10, 10),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      ring: new MeshBasicMaterial({
        color: isShadowflame ? '#7C3AED' : '#FF4500',
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
      pillar: new MeshBasicMaterial({
        color: isShadowflame ? '#6366F1' : '#FF4D18',
        transparent: true,
        opacity: 0.16,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
      core: new MeshBasicMaterial({
        color: isShadowflame ? '#C4B5FD' : '#FFF1B8',
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [isShadowflame],
  );

  useEffect(() => {
    return () => {
      emberGeo.dispose();
      emberMat.dispose();
      geos.ring.dispose();
      geos.pillar.dispose();
      geos.core.dispose();
      mats.ring.dispose();
      mats.pillar.dispose();
      mats.core.dispose();
    };
  }, [emberGeo, emberMat, geos, mats]);

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
    // Fade out over the last 20% of ignite duration
    const lifeFade = lifeT > 0.8 ? 1 - (lifeT - 0.8) / 0.2 : 1;

    const pos = posScratch.current;
    pos.copy(startPosition);
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

    const t = elapsedRef.current;
    const flicker = 0.82 + Math.sin(t * 34) * 0.18;
    const pulse = 0.92 + 0.08 * Math.sin(t * 8.5);

    if (groupRef.current) {
      groupRef.current.position.copy(pos);
    }

    emberMat.uniforms.uTime.value += delta;
    emberMat.uniforms.uGlobalOpacity.value = lifeFade * (0.85 + 0.15 * flicker);

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.6;
      mats.ring.opacity = (0.35 + 0.15 * Math.sin(t * 6)) * lifeFade;
    }

    if (pillarRef.current) {
      pillarRef.current.rotation.y = t * 2.2;
      const sx = (0.85 + 0.15 * flicker) * pulse;
      pillarRef.current.scale.set(sx, pulse, sx);
      mats.pillar.opacity = 0.14 * flicker * lifeFade;
    }

    if (coreRef.current) {
      const corePulse = 0.75 + 0.25 * Math.sin(t * 12);
      coreRef.current.scale.setScalar(corePulse);
      mats.core.opacity = 0.2 * flicker * lifeFade;
    }

    igniteLight.current?.setPosition(pos.x, pos.y, pos.z);
    igniteLight.current?.setIntensity(3.5 * flicker * lifeFade);

    if (Date.now() - lastSoundAtRef.current >= 1100) {
      lastSoundAtRef.current = Date.now();
      (window as any).audioSystem?.playIgniteStatusSound?.(pos);
    }
  });

  return (
    <group ref={groupRef} position={[startPosition.x, startPosition.y + ANCHOR_Y_OFFSET, startPosition.z]}>
      {/* Ground fire ring */}
      <mesh
        ref={ringRef}
        geometry={geos.ring}
        material={mats.ring}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BASE_Y - ANCHOR_Y_OFFSET, 0]}
      />

      {/* Rising flame column — centered on torso relative to group anchor */}
      <mesh ref={pillarRef} geometry={geos.pillar} material={mats.pillar} position={[0, 0.3, 0]} />

      {/* Hot core glow */}
      <mesh ref={coreRef} geometry={geos.core} material={mats.core} position={[0, 0.15, 0]} />

      {/* GPU ember field */}
      <points
        ref={pointsRef}
        geometry={emberGeo}
        material={emberMat}
        position={[0, BASE_Y - ANCHOR_Y_OFFSET, 0]}
        frustumCulled={false}
      />
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
      .filter((entity) => !isCoopPlayerAllyEntity(entity))
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

  const addIgnitedEnemy = useCallback(
    (
      enemyId: string,
      position: Vector3,
      duration: number = 3000,
      variant: IgniteFlameVariant = 'ignite',
    ) => {
      if (world) {
        const entity = world.getAllEntities().find((e) => e.id.toString() === enemyId);
        if (entity && isCoopPlayerAllyEntity(entity)) return;
      }
      setIgnited((prev) => {
        // Dedupe per enemy+variant so ignite and shadowflame can coexist
        const rest = prev.filter((row) => !(row.enemyId === enemyId && row.variant === variant));
        return [
          ...rest,
          {
            id: idCounter.current++,
            enemyId,
            position: position.clone(),
            startTime: Date.now(),
            duration,
            variant,
          },
        ];
      });
    },
    [world],
  );

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
      if (isCoopPlayerAllyEntity(entity)) return;

      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);
      const health = entity.getComponent(Health);

      if (enemy && transform && health && !health.isDead) {
        if (enemy.isIgnitedActive(nowSec)) {
          const existing = ignitedRef.current.find(
            (row) => row.enemyId === entity.id.toString() && row.variant === 'ignite',
          );
          if (!existing) {
            const remainingMs = enemy.getIgniteRemainingMs(nowSec);
            addIgnitedEnemy(
              entity.id.toString(),
              transform.position,
              remainingMs > 0 ? remainingMs : 3000,
              'ignite',
            );
          }
        }
        if (enemy.isShadowflameActive(nowSec)) {
          const existing = ignitedRef.current.find(
            (row) => row.enemyId === entity.id.toString() && row.variant === 'shadowflame',
          );
          if (!existing) {
            const remainingMs = enemy.getShadowflameRemainingMs(nowSec);
            addIgnitedEnemy(
              entity.id.toString(),
              transform.position,
              remainingMs > 0 ? remainingMs : 2500,
              'shadowflame',
            );
          }
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

        if (row.variant === 'shadowflame') {
          return enemy.isShadowflameActive(nowSec);
        }
        return enemy.isIgnitedActive(nowSec);
      }),
    );
  });

  const handleIgniteEffectComplete = (enemyKey: string, variant: IgniteFlameVariant) => {
    setIgnited((prev) => prev.filter((row) => !(row.enemyId === enemyKey && row.variant === variant)));
  };

  const enemyData = getEnemyData();

  return (
    <>
      {ignited.map((row) => (
        <IgniteRing
          key={`${row.variant}-${row.enemyId}`}
          enemyId={row.enemyId}
          startPosition={row.position}
          startTime={row.startTime}
          duration={row.duration}
          enemyData={enemyData}
          variant={row.variant}
          onComplete={() => handleIgniteEffectComplete(row.enemyId, row.variant)}
        />
      ))}
    </>
  );
}
