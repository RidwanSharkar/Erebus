'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, AdditiveBlending, BufferGeometry, BufferAttribute } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

// Teal/cyan wind-slash palette
const COLOR_CORE  = '#00e8d8';
const COLOR_GLOW  = '#80fff5';
const COLOR_OUTER = '#005f58';

/** Build a flat crescent (annular arc sector) in the XZ plane. */
function buildCrescentGeometry(
  innerRadius: number,
  outerRadius: number,
  spanRadians: number,
  segments: number,
): BufferGeometry {
  const geo = new BufferGeometry();
  const half = spanRadians / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = -half + (i / segments) * spanRadians;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(sin * innerRadius, 0, cos * innerRadius);
    positions.push(sin * outerRadius, 0, cos * outerRadius);
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

// Shared geometry instances (created once, reused across all instances)
const outerCrescentGeo = buildCrescentGeometry(0.22, 0.55, Math.PI * 0.72, 20);
const innerCrescentGeo = buildCrescentGeometry(0.0,  0.28, Math.PI * 0.55, 14);

// ─── Shared view type ────────────────────────────────────────────────────────

export interface WindShearProjectileView {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  distanceTraveled: number;
  /** Roll (radians) about the travel axis so paired slashes oppose diagonally. */
  roll?: number;
}

// ─── Per-instance visual ─────────────────────────────────────────────────────

function WindShearInstance({ projectile: p }: { projectile: WindShearProjectileView }) {
  const traveled = Math.max(0, p.distanceTraveled);
  const fadeStart = Math.max(p.maxDistance * 0.72, 1e-3);
  const fadeEnd   = Math.max(p.maxDistance, fadeStart + 1e-3);
  const fadeProgress =
    traveled < fadeStart ? 0 : Math.min(1, (traveled - fadeStart) / (fadeEnd - fadeStart));
  const opacity = 1 - fadeProgress * fadeProgress;

  const yaw = Math.atan2(p.direction.x, p.direction.z);
  const roll = p.roll ?? 0;

  const windLight = useDynamicLight({ color: COLOR_CORE, distance: 4, decay: 2, priority: 2 });

  useFrame(() => {
    windLight.current?.setPosition(p.position.x, p.position.y, p.position.z);
    windLight.current?.setIntensity(6 * opacity);
  });

  return (
    <group position={p.position.toArray()} rotation={[0, yaw, 0]} scale={1.15}>
      {/* Roll about the travel axis (local Z) so paired slashes read as diagonal, opposing swings. */}
      <group rotation={[0, 0, roll]}>
        <mesh geometry={outerCrescentGeo} renderOrder={1}>
          <meshBasicMaterial
            color={COLOR_CORE}
            transparent
            opacity={0.85 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh geometry={innerCrescentGeo} renderOrder={2}>
          <meshBasicMaterial
            color={COLOR_GLOW}
            transparent
            opacity={0.65 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <torusGeometry args={[0.38, 0.045, 6, 40, Math.PI * 0.75]} />
          <meshBasicMaterial
            color={COLOR_OUTER}
            transparent
            opacity={0.5 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─── ECS-based renderer (used by UnifiedProjectileManager) ───────────────────

interface WindShearProjectileProps {
  projectiles: WindShearProjectileView[];
}

export function WindShearProjectile({ projectiles }: WindShearProjectileProps) {
  return (
    <>
      {projectiles.map((p) => (
        <WindShearInstance key={p.id} projectile={p} />
      ))}
    </>
  );
}

// ─── Standalone manager (PVP visual replication) ─────────────────────────────

const STANDALONE_SPEED = 32;
const STANDALONE_MAX_DISTANCE = 8;

interface StandaloneProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  spawnTime: number;
}

let nextStandaloneId = 0;
let globalTrigger: ((position: Vector3, direction: Vector3) => void) | null = null;

/** Trigger a standalone Wind Shear visual for remote PVP players. */
export function triggerWindShearProjectile(position: Vector3, direction: Vector3): void {
  globalTrigger?.(position, direction);
}

export default function WindShearProjectileManager() {
  const [projectiles, setProjectiles] = useState<StandaloneProjectile[]>([]);

  const spawn = useCallback((position: Vector3, direction: Vector3) => {
    const p: StandaloneProjectile = {
      id: nextStandaloneId++,
      position: position.clone(),
      direction: direction.clone().normalize(),
      startPosition: position.clone(),
      spawnTime: Date.now(),
    };
    setProjectiles((prev) => [...prev, p]);
  }, []);

  // Register the global trigger when this component mounts
  React.useEffect(() => {
    globalTrigger = spawn;
    return () => { globalTrigger = null; };
  }, [spawn]);

  useFrame((_, delta) => {
    const now = Date.now();
    setProjectiles((prev) => {
      const updated: StandaloneProjectile[] = [];
      for (const p of prev) {
        const traveled = p.startPosition.distanceTo(p.position);
        if (traveled >= STANDALONE_MAX_DISTANCE) continue;
        const move = p.direction.clone().multiplyScalar(STANDALONE_SPEED * delta);
        p.position.add(move);
        updated.push(p);
      }
      return updated.length !== prev.length ? updated : prev;
    });
  });

  return (
    <>
      {projectiles.map((p) => {
        const traveled = p.startPosition.distanceTo(p.position);
        const view: WindShearProjectileView = {
          id: p.id,
          position: p.position,
          direction: p.direction,
          startPosition: p.startPosition,
          maxDistance: STANDALONE_MAX_DISTANCE,
          distanceTraveled: traveled,
        };
        return <WindShearInstance key={p.id} projectile={view} />;
      })}
    </>
  );
}
