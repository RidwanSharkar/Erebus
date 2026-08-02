'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  MathUtils,
  Quaternion,
} from 'three';
// meleeTelegraphVisual imports MeleeWeightClass from here as `import type`, which
// is erased at build time — no runtime cycle.
import { MELEE_COMMIT_FRAC, MELEE_RECOVERY_TAIL_MS } from '@/utils/meleeTelegraphVisual';

/** Match `attackRange` in `backend/enemyAI.js` / `backend/meleeProfiles.js` */
export const KNIGHT_MELEE_ATTACK_RANGE = 2.6;
export const TEMPLAR_MELEE_ATTACK_RANGE = 2.725;
export const SPECTRE_MELEE_ATTACK_RANGE = 2.725;
export const DEATH_KNIGHT_MELEE_ATTACK_RANGE = 2.725;
export const SHAMAN_MELEE_ATTACK_RANGE = 2.725;
export const GHOUL_MELEE_ATTACK_RANGE = 2.4;
export const SERPENT_MELEE_ATTACK_RANGE = 2.75;
export const TIGER_MELEE_ATTACK_RANGE = 2.6;
export const WOLF_MELEE_ATTACK_RANGE = 2.6;
export const BEAR_MELEE_ATTACK_RANGE = 2.75;
export const SKYRAY_MELEE_ATTACK_RANGE = 2.5;
export const WYVERN_MELEE_ATTACK_RANGE = 3.075;
export const TERRORHAWK_MELEE_ATTACK_RANGE = 3.0;
export const DESTINY_MELEE_ATTACK_RANGE = 4.0;
export const BONE_SPIDER_MELEE_ATTACK_RANGE = 3.0;
export const TITAN_MELEE_ATTACK_RANGE = 3.0;
export const NEMESIS_MELEE_ATTACK_RANGE = 3.0;
export const BOSS_MELEE_ATTACK_RANGE = 2.9;

export type MeleeWeightClass = 'beast' | 'large-beast' | 'humanoid' | 'giant';

interface EnemyMeleeAttackRangeRingProps {
  radius: number;
  /** Server-sent swing windup (ms). When omitted, ring stays static (legacy). */
  hitDelayMs?: number;
  /** Total swing lock including recovery (ms). */
  swingLockMs?: number;
  /** Full swing arc in degrees (default 110). */
  arcDeg?: number;
  /**
   * Enemy facing yaw (atan2(dx,dz)). Kept for compatibility; animated mode
   * inherits parent rotation and only uses this as a pre-commit fallback when
   * no parent group provides yaw.
   */
  facing?: number;
  weightClass?: MeleeWeightClass;
  /** When true, desaturate and collapse instead of impact flash. */
  whiffed?: boolean;
  /** Client-local monotonic ms when the telegraph started. */
  startedAtMs?: number;
  /** Ms from start until facing hard-locks (dodge window). */
  commitAtMs?: number;
}

const WEIGHT_STYLE: Record<
  MeleeWeightClass,
  { lineHalf: number; baseOpacity: number; amber: string; hot: string; segments: number }
> = {
  beast: { lineHalf: 0.035, baseOpacity: 0.5, amber: '#d4a017', hot: '#e83a2a', segments: 40 },
  'large-beast': { lineHalf: 0.055, baseOpacity: 0.55, amber: '#e09020', hot: '#ff3d2e', segments: 44 },
  humanoid: { lineHalf: 0.04, baseOpacity: 0.52, amber: '#c9a227', hot: '#c94a3a', segments: 40 },
  giant: { lineHalf: 0.08, baseOpacity: 0.62, amber: '#f0a020', hot: '#ff2a1a', segments: 48 },
};

/** Epoch ms are ~1.7e12; performance.now() stays in the thousands. */
const EPOCH_GUARD_MS = 1e12;

const _tmpQuat = new Quaternion();
const _tmpEuler = new Euler();

type SharedGeo = {
  bed: BufferGeometry;
  rim: BufferGeometry;
  refCount: number;
};

const geoCache = new Map<string, SharedGeo>();

/**
 * Flat arc-sector wedge in XZ, centered on local +Z (enemy facing).
 * Angle 0 = +Z; spans [-half, +half]. Vertices alternate inner/outer so
 * setDrawRange fills angularly from the left edge of the arc.
 */
function buildArcWedgeGeometry(
  innerRadius: number,
  outerRadius: number,
  thetaLength: number,
  segments: number,
): BufferGeometry {
  const geo = new BufferGeometry();
  const half = thetaLength / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = -half + (i / segments) * thetaLength;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // +Z-forward: x = sin(angle) * r, z = cos(angle) * r
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
  geo.computeBoundingSphere();
  return geo;
}

function acquireSharedGeos(
  key: string,
  innerRadius: number,
  outerRadius: number,
  rimInner: number,
  rimOuter: number,
  thetaLength: number,
  segments: number,
): SharedGeo {
  let entry = geoCache.get(key);
  if (!entry) {
    entry = {
      bed: buildArcWedgeGeometry(innerRadius * 0.12, outerRadius, thetaLength, segments),
      rim: buildArcWedgeGeometry(rimInner, rimOuter, thetaLength, segments),
      refCount: 0,
    };
    geoCache.set(key, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseSharedGeos(key: string) {
  const entry = geoCache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.bed.dispose();
    entry.rim.dispose();
    geoCache.delete(key);
  }
}

/**
 * Animated melee arc telegraph at the unit’s feet.
 * Tracks parent yaw until commitAtMs, then world-locks ("dodge now").
 * Sweeps angularly over hitDelayMs, flashes at impact, fades through recovery.
 * Backward compatible: with only `radius`, renders a static full ring like before.
 */
export default function EnemyMeleeAttackRangeRing({
  radius,
  hitDelayMs,
  swingLockMs,
  arcDeg = 110,
  facing = 0,
  weightClass = 'humanoid',
  whiffed = false,
  startedAtMs,
  commitAtMs,
}: EnemyMeleeAttackRangeRingProps) {
  const style = WEIGHT_STYLE[weightClass] ?? WEIGHT_STYLE.humanoid;
  const animated = typeof hitDelayMs === 'number' && hitDelayMs > 0;

  const startRef = useRef(0);
  const lockedWorldYawRef = useRef<number | null>(null);
  const groupRef = useRef<any>(null);
  const bedMatRef = useRef<any>(null);
  const fillMatRef = useRef<any>(null);
  const rimMatRef = useRef<any>(null);
  const spokeMatRef = useRef<any>(null);
  const spokeRef = useRef<any>(null);
  const fillGeoLiveRef = useRef<BufferGeometry | null>(null);

  const colorA = useMemo(() => new Color(style.amber), [style.amber]);
  const colorB = useMemo(() => new Color(style.hot), [style.hot]);
  const colorFlash = useMemo(() => new Color('#ffffff'), []);
  const colorWhiff = useMemo(() => new Color('#6a6a6a'), []);
  const mixed = useMemo(() => new Color(), []);

  const thetaLength = animated
    ? MathUtils.degToRad(Math.max(20, Math.min(360, arcDeg)))
    : Math.PI * 2;
  const segments = style.segments;
  const innerRadius = Math.max(0.02, radius - style.lineHalf);
  const outerRadius = radius + style.lineHalf;
  const rimInner = Math.max(0.01, radius * 0.96);
  const rimOuter = radius * 1.04;

  const cacheKey = animated
    ? `${arcDeg.toFixed(1)}|${radius.toFixed(3)}|${weightClass}`
    : '';

  const [shared, setShared] = useState<SharedGeo | null>(null);
  const [fillGeo, setFillGeo] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    if (!animated || !cacheKey) {
      setShared(null);
      setFillGeo(null);
      fillGeoLiveRef.current = null;
      return;
    }
    const entry = acquireSharedGeos(
      cacheKey,
      innerRadius,
      outerRadius,
      rimInner,
      rimOuter,
      thetaLength,
      segments,
    );
    setShared(entry);
    const fill = entry.bed.clone();
    fill.setDrawRange(0, 0);
    fillGeoLiveRef.current = fill;
    setFillGeo(fill);
    return () => {
      fill.dispose();
      fillGeoLiveRef.current = null;
      setFillGeo(null);
      setShared(null);
      releaseSharedGeos(cacheKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    let start =
      startedAtMs != null
        ? startedAtMs
        : typeof performance !== 'undefined'
          ? performance.now()
          : Date.now();
    // Guard: epoch Date.now() values blank the arc when mixed with performance.now().
    if (start > EPOCH_GUARD_MS) {
      start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    startRef.current = start;
    lockedWorldYawRef.current = null;
  }, [startedAtMs, hitDelayMs, facing, arcDeg, commitAtMs]);

  useFrame(() => {
    if (!animated) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - startRef.current;
    const windup = hitDelayMs!;
    const commit =
      typeof commitAtMs === 'number' && commitAtMs > 0
        ? commitAtMs
        : Math.floor(windup * MELEE_COMMIT_FRAC);
    // swingLockMs is the movement lock and may end before the hit frame, so the
    // fade always gets at least the shared recovery tail.
    const lock = swingLockMs && swingLockMs > 0 ? swingLockMs : windup + MELEE_RECOVERY_TAIL_MS;
    const recovery = Math.max(MELEE_RECOVERY_TAIL_MS, lock - windup);

    // --- Track then snap-lock orientation ---
    const group = groupRef.current;
    if (group) {
      if (elapsed < commit) {
        lockedWorldYawRef.current = null;
        group.rotation.y = 0; // inherit parent yaw → tracks enemy turn
      } else {
        if (lockedWorldYawRef.current == null) {
          const parent = group.parent;
          if (parent) {
            parent.getWorldQuaternion(_tmpQuat);
            _tmpEuler.setFromQuaternion(_tmpQuat, 'YXZ');
            lockedWorldYawRef.current = _tmpEuler.y;
          } else {
            lockedWorldYawRef.current = facing;
          }
        }
        const parent = group.parent;
        if (parent && lockedWorldYawRef.current != null) {
          parent.getWorldQuaternion(_tmpQuat);
          _tmpEuler.setFromQuaternion(_tmpQuat, 'YXZ');
          group.rotation.y = lockedWorldYawRef.current - _tmpEuler.y;
        }
      }
    }

    let bedOpacity = style.baseOpacity * 0.35;
    let fillOpacity = 0;
    let rimOpacity = 0;
    let spokeOpacity = 0;
    let spokeAngle = 0;
    let scale = 1;
    mixed.copy(colorA);

    const liveFill = fillGeoLiveRef.current;
    const indexCount = segments * 6;

    if (whiffed) {
      const t = Math.min(1, elapsed / Math.max(200, windup * 0.5));
      bedOpacity = style.baseOpacity * (1 - t) * 0.3;
      fillOpacity = style.baseOpacity * (1 - t) * 0.25;
      rimOpacity = 0;
      spokeOpacity = 0;
      scale = 1 - t * 0.35;
      mixed.copy(colorWhiff);
      if (liveFill) liveFill.setDrawRange(0, indexCount);
    } else if (elapsed < windup) {
      const t = Math.max(0, Math.min(1, elapsed / windup));
      if (liveFill) {
        liveFill.setDrawRange(0, Math.max(0, Math.floor(t * segments) * 6));
      }

      mixed.copy(colorA).lerp(colorB, t);
      bedOpacity = style.baseOpacity * 0.28;
      fillOpacity = style.baseOpacity * (0.4 + t * 0.5);
      spokeOpacity = 0.2 + t * 0.55;
      // Leading edge relative to wedge center (-half … +half).
      spokeAngle = -thetaLength / 2 + t * thetaLength;

      if (elapsed >= commit) {
        const commitPulse = Math.min(1, (elapsed - commit) / 90);
        rimOpacity = 0.55 + (1 - commitPulse) * 0.4;
        mixed.copy(colorB);
        if (commitPulse < 1) {
          mixed.lerp(colorFlash, (1 - commitPulse) * 0.35);
        }
      } else {
        rimOpacity = 0.12 + t * 0.2;
      }
    } else if (elapsed < windup + 70) {
      const flashT = (elapsed - windup) / 70;
      mixed.copy(colorFlash).lerp(colorB, flashT);
      bedOpacity = 0.85 * (1 - flashT * 0.4);
      fillOpacity = 0.9 * (1 - flashT * 0.3);
      rimOpacity = 0.95 * (1 - flashT);
      spokeOpacity = 0.8 * (1 - flashT);
      scale = 1 + flashT * 0.06;
      if (liveFill) liveFill.setDrawRange(0, indexCount);
      spokeAngle = thetaLength / 2;
    } else {
      const t = Math.min(1, (elapsed - windup - 70) / recovery);
      mixed.copy(colorB);
      bedOpacity = style.baseOpacity * (1 - t) * 0.35;
      fillOpacity = style.baseOpacity * (1 - t) * 0.45;
      rimOpacity = style.baseOpacity * (1 - t) * 0.3;
      spokeOpacity = 0;
      scale = 1;
      if (liveFill) liveFill.setDrawRange(0, indexCount);
    }

    if (bedMatRef.current) {
      bedMatRef.current.color.copy(mixed);
      bedMatRef.current.opacity = Math.max(0, bedOpacity);
    }
    if (fillMatRef.current) {
      fillMatRef.current.color.copy(mixed);
      fillMatRef.current.opacity = Math.max(0, fillOpacity);
    }
    if (rimMatRef.current) {
      rimMatRef.current.color.copy(mixed);
      rimMatRef.current.opacity = Math.max(0, rimOpacity);
    }
    if (spokeMatRef.current) {
      spokeMatRef.current.color.copy(mixed);
      spokeMatRef.current.opacity = Math.max(0, spokeOpacity);
    }
    if (spokeRef.current) {
      spokeRef.current.rotation.y = spokeAngle;
    }
    if (group) {
      group.scale.set(scale, 1, scale);
    }
  });

  if (!animated) {
    return (
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.125, 0]}
        renderOrder={2}
        frustumCulled={false}
      >
        <ringGeometry args={[innerRadius, outerRadius, 64]} />
        <meshBasicMaterial
          color="#c94a3a"
          transparent
          opacity={0.55}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    );
  }

  if (!shared) return null;

  const spokeLength = outerRadius;
  const spokeWidth = Math.max(0.04, style.lineHalf * 1.6);

  return (
    <group ref={groupRef} position={[0, 0.125, 0]}>
      {/* Dim bed at true attack range — fixed size so range reads from frame one */}
      <mesh geometry={shared.bed} renderOrder={2} frustumCulled={false}>
        <meshBasicMaterial
          ref={bedMatRef}
          color={style.amber}
          transparent
          opacity={style.baseOpacity * 0.28}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Angular sweep fill */}
      {fillGeo && (
        <mesh geometry={fillGeo} renderOrder={3} frustumCulled={false}>
          <meshBasicMaterial
            ref={fillMatRef}
            color={style.amber}
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}

      {/* Crisp rim — hardens at commit, flashes at strike */}
      <mesh geometry={shared.rim} renderOrder={4} frustumCulled={false}>
        <meshBasicMaterial
          ref={rimMatRef}
          color={style.hot}
          transparent
          opacity={0}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Charge-front spoke: pivots around feet, strip extends along local +Z */}
      <group ref={spokeRef}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, spokeLength * 0.5]}
          renderOrder={5}
          frustumCulled={false}
        >
          <planeGeometry args={[spokeWidth, spokeLength]} />
          <meshBasicMaterial
            ref={spokeMatRef}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
