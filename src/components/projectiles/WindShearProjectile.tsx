'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, AdditiveBlending, BufferGeometry, BufferAttribute, Group, MeshBasicMaterial } from 'three';
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

function computeFadeOpacity(traveled: number, maxDistance: number): number {
  const fadeStart = Math.max(maxDistance * 0.72, 1e-3);
  const fadeEnd = Math.max(maxDistance, fadeStart + 1e-3);
  const fadeProgress =
    traveled < fadeStart ? 0 : Math.min(1, (traveled - fadeStart) / (fadeEnd - fadeStart));
  return 1 - fadeProgress * fadeProgress;
}

// ─── Per-instance visual ─────────────────────────────────────────────────────

function WindShearInstance({ projectile: p }: { projectile: WindShearProjectileView }) {
  const projectileRef = useRef(p);
  projectileRef.current = p;

  const groupRef = useRef<Group>(null);
  const rollGroupRef = useRef<Group>(null);
  const outerMatRef = useRef<MeshBasicMaterial>(null);
  const innerMatRef = useRef<MeshBasicMaterial>(null);
  const torusMatRef = useRef<MeshBasicMaterial>(null);

  const windLight = useDynamicLight({ color: COLOR_CORE, distance: 4, decay: 2, priority: 2 });

  useFrame(() => {
    const proj = projectileRef.current;
    const traveled = Math.max(0, proj.distanceTraveled);
    const opacity = computeFadeOpacity(traveled, proj.maxDistance);
    const yaw = Math.atan2(proj.direction.x, proj.direction.z);
    const roll = proj.roll ?? 0;

    if (groupRef.current) {
      groupRef.current.position.copy(proj.position);
      groupRef.current.rotation.set(0, yaw, 0);
      groupRef.current.scale.setScalar(1.15);
    }
    if (rollGroupRef.current) {
      rollGroupRef.current.rotation.set(0, 0, roll);
    }
    if (outerMatRef.current) outerMatRef.current.opacity = 0.85 * opacity;
    if (innerMatRef.current) innerMatRef.current.opacity = 0.65 * opacity;
    if (torusMatRef.current) torusMatRef.current.opacity = 0.5 * opacity;

    windLight.current?.setPosition(proj.position.x, proj.position.y, proj.position.z);
    windLight.current?.setIntensity(6 * opacity);
  });

  return (
    <group ref={groupRef}>
      <group ref={rollGroupRef}>
        <mesh geometry={outerCrescentGeo} renderOrder={1}>
          <meshBasicMaterial
            ref={outerMatRef}
            color={COLOR_CORE}
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh geometry={innerCrescentGeo} renderOrder={2}>
          <meshBasicMaterial
            ref={innerMatRef}
            color={COLOR_GLOW}
            transparent
            opacity={0.65}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <torusGeometry args={[0.38, 0.045, 6, 40, Math.PI * 0.75]} />
          <meshBasicMaterial
            ref={torusMatRef}
            color={COLOR_OUTER}
            transparent
            opacity={0.5}
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

function StandaloneWindShearInstance({ projectile }: { projectile: StandaloneProjectile }) {
  const projectileRef = useRef(projectile);
  projectileRef.current = projectile;

  const groupRef = useRef<Group>(null);
  const rollGroupRef = useRef<Group>(null);
  const outerMatRef = useRef<MeshBasicMaterial>(null);
  const innerMatRef = useRef<MeshBasicMaterial>(null);
  const torusMatRef = useRef<MeshBasicMaterial>(null);

  const windLight = useDynamicLight({ color: COLOR_CORE, distance: 4, decay: 2, priority: 2 });

  useFrame(() => {
    const p = projectileRef.current;
    const traveled = p.startPosition.distanceTo(p.position);
    const opacity = computeFadeOpacity(traveled, STANDALONE_MAX_DISTANCE);
    const yaw = Math.atan2(p.direction.x, p.direction.z);

    if (groupRef.current) {
      groupRef.current.position.copy(p.position);
      groupRef.current.rotation.set(0, yaw, 0);
      groupRef.current.scale.setScalar(1.15);
    }
    if (outerMatRef.current) outerMatRef.current.opacity = 0.85 * opacity;
    if (innerMatRef.current) innerMatRef.current.opacity = 0.65 * opacity;
    if (torusMatRef.current) torusMatRef.current.opacity = 0.5 * opacity;

    windLight.current?.setPosition(p.position.x, p.position.y, p.position.z);
    windLight.current?.setIntensity(6 * opacity);
  });

  return (
    <group ref={groupRef}>
      <group ref={rollGroupRef}>
        <mesh geometry={outerCrescentGeo} renderOrder={1}>
          <meshBasicMaterial
            ref={outerMatRef}
            color={COLOR_CORE}
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh geometry={innerCrescentGeo} renderOrder={2}>
          <meshBasicMaterial
            ref={innerMatRef}
            color={COLOR_GLOW}
            transparent
            opacity={0.65}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <torusGeometry args={[0.38, 0.045, 6, 40, Math.PI * 0.75]} />
          <meshBasicMaterial
            ref={torusMatRef}
            color={COLOR_OUTER}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

let nextStandaloneId = 0;
let globalTrigger: ((position: Vector3, direction: Vector3) => void) | null = null;

/** Trigger a standalone Wind Shear visual for remote PVP players. */
export function triggerWindShearProjectile(position: Vector3, direction: Vector3): void {
  globalTrigger?.(position, direction);
}

export default function WindShearProjectileManager() {
  const projectilesRef = useRef<StandaloneProjectile[]>([]);
  const [activeIds, setActiveIds] = useState<number[]>([]);

  const spawn = useCallback((position: Vector3, direction: Vector3) => {
    const p: StandaloneProjectile = {
      id: nextStandaloneId++,
      position: position.clone(),
      direction: direction.clone().normalize(),
      startPosition: position.clone(),
      spawnTime: Date.now(),
    };
    projectilesRef.current.push(p);
    setActiveIds((prev) => [...prev, p.id]);
  }, []);

  React.useEffect(() => {
    globalTrigger = spawn;
    return () => { globalTrigger = null; };
  }, [spawn]);

  useFrame((_, delta) => {
    const live: StandaloneProjectile[] = [];
    for (const p of projectilesRef.current) {
      const traveled = p.startPosition.distanceTo(p.position);
      if (traveled >= STANDALONE_MAX_DISTANCE) continue;
      p.position.addScaledVector(p.direction, STANDALONE_SPEED * delta);
      live.push(p);
    }
    if (live.length !== projectilesRef.current.length) {
      projectilesRef.current = live;
      setActiveIds(live.map((p) => p.id));
    }
  });

  return (
    <>
      {activeIds.map((id) => {
        const p = projectilesRef.current.find((entry) => entry.id === id);
        if (!p) return null;
        return <StandaloneWindShearInstance key={id} projectile={p} />;
      })}
    </>
  );
}
