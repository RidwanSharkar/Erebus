'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const _warlockLightPos = new Vector3();

export interface WarlockProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
  /** When > 0, orb stays at start and scales up until duration elapses, then flies (matches warlock_launch wind-up). */
  chargeDurationMs?: number;
  /** Called once when charge ends; if false, despawns without flying (mirrors delayed spawn guard). */
  isSourceEnemyLiving?: () => boolean;
}

const SPEED = 9; // units per second
const TURN_RATE = 1.8; // radians per second — moderate homing, still dodge-able
const HIT_RADIUS = 1.6;

const CHARGE_MIN_SCALE = 0.08;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export default function WarlockProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
  chargeDurationMs = 0,
  isSourceEnemyLiving,
}: WarlockProjectileProps) {
  const groupRef = useRef<Group>(null);
  const visualScaleRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const ring1Ref = useRef<Group>(null);
  const ring2Ref = useRef<Group>(null);
  const ring3Ref = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const phaseRef = useRef<'charging' | 'flying'>(chargeDurationMs > 0 ? 'charging' : 'flying');
  const chargeTimeRef = useRef(0);
  const chargeDurationSecRef = useRef(chargeDurationMs / 1000);

  const currentDirRef = useRef(new Vector3(0, 0, -1));

  // Collapse the three per-orb <pointLight>s into one pooled light that follows the orb.
  const orbLight = useDynamicLight({ color: '#dd1133', distance: 6.5, priority: 2 });

  const staleDist = useMemo(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len < 1e-4) return 1;
    currentDirRef.current.copy(d).multiplyScalar(1 / len);
    return len;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxLifetimeRef = useRef((staleDist / SPEED) * 1.5);

  const resolvedStaleTargetRef = useRef(targetPosition.clone());

  // ─── Materials ─────────────────────────────────────────────────────────────

  const voidMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#1a0005'),
    transparent: true, opacity: 0.92,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#dd1133'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#8800ff'),
    transparent: true, opacity: 0.60,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff5500'),
    transparent: true, opacity: 0.28,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const hazeMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#220033'),
    transparent: true, opacity: 0.18,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc0044'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#9900ff'),
    transparent: true, opacity: 0.65,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff6600'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#880022'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#550019'),
    transparent: true, opacity: 0.38,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#330010'),
    transparent: true, opacity: 0.22,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail4Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#1a0008'),
    transparent: true, opacity: 0.12,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    resolvedStaleTargetRef.current.copy(targetPosition);
  }, [targetPosition]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    const dir = currentDirRef.current;
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    if (visualScaleRef.current) {
      visualScaleRef.current.scale.setScalar(chargeDurationMs > 0 ? CHARGE_MIN_SCALE : 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    // Drive the pooled light at the orb's world position (group position is world-space).
    groupRef.current.getWorldPosition(_warlockLightPos);
    orbLight.current?.setPosition(_warlockLightPos.x, _warlockLightPos.y, _warlockLightPos.z);
    orbLight.current?.setIntensity(18);

    const charging = phaseRef.current === 'charging';

    if (charging) {
      chargeTimeRef.current += delta;
      const dur = chargeDurationSecRef.current;
      const u = dur > 0 ? Math.min(1, chargeTimeRef.current / dur) : 1;
      const ease = smoothstep01(u);
      const s = CHARGE_MIN_SCALE + (1 - CHARGE_MIN_SCALE) * ease;
      if (visualScaleRef.current) {
        visualScaleRef.current.scale.setScalar(s);
      }

      const trailDim = 0.12 + 0.88 * ease;
      trail1Mat.opacity = 0.55 * trailDim;
      trail2Mat.opacity = 0.38 * trailDim;
      trail3Mat.opacity = 0.22 * trailDim;
      trail4Mat.opacity = 0.12 * trailDim;

      if (chargeTimeRef.current >= dur || dur <= 0) {
        if (isSourceEnemyLiving && !isSourceEnemyLiving()) {
          doneRef.current = true;
          onComplete();
          return;
        }

        let resolved = resolvedStaleTargetRef.current.clone();
        const pp = getPlayerPosition();
        if (pp) {
          resolved.set(pp.x, resolvedStaleTargetRef.current.y, pp.z);
        }

        const aim = resolved.clone().sub(startPosition);
        const aimLen = aim.length();
        if (aimLen > 1e-4) {
          currentDirRef.current.copy(aim).multiplyScalar(1 / aimLen);
        }

        maxLifetimeRef.current = (Math.max(aimLen, 0.01) / SPEED) * 1.5;
        phaseRef.current = 'flying';
        timeRef.current = 0;
        if (visualScaleRef.current) {
          visualScaleRef.current.scale.setScalar(1);
        }
      }

      if (phaseRef.current === 'charging') {
        return;
      }
    }

    timeRef.current += delta;
    const t = timeRef.current;

    const playerPos = getPlayerPosition();
    if (playerPos) {
      const toPlayer = playerPos.clone().sub(groupRef.current.position);
      if (toPlayer.length() > 0.5) {
        toPlayer.normalize();
        currentDirRef.current
          .lerp(toPlayer, Math.min(1, TURN_RATE * delta))
          .normalize();
      }
    }

    const dir = currentDirRef.current;
    groupRef.current.position.addScaledVector(dir, SPEED * delta);
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

    if (spinRef.current) spinRef.current.rotation.z += delta * 2.6;
    if (ring1Ref.current) ring1Ref.current.rotation.y += delta * 3.5;
    if (ring2Ref.current) ring2Ref.current.rotation.x -= delta * 2.3;
    if (ring3Ref.current) ring3Ref.current.rotation.z += delta * 2.9;

    const maxLifetime = maxLifetimeRef.current;
    const progress = Math.min(t / maxLifetime, 1.0);
    const fade = progress > 0.70 ? 1 - (progress - 0.70) / 0.30 : 1.0;
    const pulse = 0.85 + 0.15 * Math.sin(t * 14);
    const pulse2 = 0.78 + 0.22 * Math.sin(t * 9 + 1.3);

    voidMat.opacity = 0.92 * fade;
    coreMat.opacity = 0.95 * fade * pulse;
    midMat.opacity = 0.60 * fade * pulse;
    auraMat.opacity = 0.28 * fade;
    hazeMat.opacity = 0.18 * fade;
    ring1Mat.opacity = 0.75 * fade * pulse2;
    ring2Mat.opacity = 0.65 * fade * pulse2;
    ring3Mat.opacity = 0.55 * fade * pulse2;
    trail1Mat.opacity = 0.55 * fade;
    trail2Mat.opacity = 0.38 * fade;
    trail3Mat.opacity = 0.22 * fade;
    trail4Mat.opacity = 0.12 * fade;

    if (playerPos && groupRef.current.position.distanceTo(playerPos) < HIT_RADIUS) {
      doneRef.current = true;
      onHitPlayer();
      onComplete();
      return;
    }

    if (t >= maxLifetime) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={visualScaleRef}>
        <group ref={spinRef}>
          <mesh material={voidMat}>
            <sphereGeometry args={[0.20, 8, 8]} />
          </mesh>

          <mesh material={coreMat}>
            <sphereGeometry args={[0.30, 10, 10]} />
          </mesh>

          <mesh material={midMat}>
            <sphereGeometry args={[0.50, 10, 10]} />
          </mesh>

          <mesh material={auraMat}>
            <sphereGeometry args={[0.72, 10, 10]} />
          </mesh>

          <mesh material={hazeMat}>
            <sphereGeometry args={[0.95, 8, 8]} />
          </mesh>

          <mesh material={trail1Mat} position={[0, 0, 1.0]}>
            <sphereGeometry args={[0.26, 8, 8]} />
          </mesh>
          <mesh material={trail2Mat} position={[0, 0, 1.8]}>
            <sphereGeometry args={[0.18, 7, 7]} />
          </mesh>
          <mesh material={trail3Mat} position={[0, 0, 2.6]}>
            <sphereGeometry args={[0.11, 6, 6]} />
          </mesh>
          <mesh material={trail4Mat} position={[0, 0, 3.4]}>
            <sphereGeometry args={[0.06, 5, 5]} />
          </mesh>
        </group>

        <group ref={ring1Ref}>
          <mesh material={ring1Mat}>
            <torusGeometry args={[0.60, 0.038, 6, 28]} />
          </mesh>
        </group>

        <group ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
          <mesh material={ring2Mat}>
            <torusGeometry args={[0.68, 0.028, 6, 28]} />
          </mesh>
        </group>

        <group ref={ring3Ref} rotation={[-Math.PI / 3.6, 0, Math.PI / 4]}>
          <mesh material={ring3Mat}>
            <torusGeometry args={[0.55, 0.032, 6, 24]} />
          </mesh>
        </group>

      </group>
    </group>
  );
}
