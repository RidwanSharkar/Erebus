'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight, PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { DEFLECT_BOLT_CHARGE_MS } from '@/utils/talents';

const _boltLightPos = new Vector3();
const _resolved = new Vector3();
const _aim = new Vector3();
const _toTarget = new Vector3();

export interface DeflectBoltProps {
  startPosition: Vector3;
  /** Aim point at cast time (target enemy position, or a fallback point ahead of the caster). */
  targetPosition: Vector3;
  /** Live-tracked target position; return null once the target dies/despawns to fizzle gracefully. */
  getTargetPosition: () => Vector3 | null;
  onHitEnemy: () => void;
  onComplete: () => void;
  /** Grow-in-place charge duration before the bolt flies (the "flash of light that grows" moment). */
  chargeDurationMs?: number;
}

const SPEED = 11; // units per second — slightly snappier than the Warlock orb it's cloned from
const TURN_RATE = 2.4; // radians per second — tighter homing than the Warlock orb
const HIT_RADIUS = 1.1;

const CHARGE_MIN_SCALE = 0.08;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Gold "Deflect Bolt" — a close visual clone of WarlockProjectile, recolored and re-targeted at enemies. */
export default function DeflectBolt({
  startPosition,
  targetPosition,
  getTargetPosition,
  onHitEnemy,
  onComplete,
  chargeDurationMs = DEFLECT_BOLT_CHARGE_MS,
}: DeflectBoltProps) {
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
  const [isCharging, setIsCharging] = useState(chargeDurationMs > 0);

  const currentDirRef = useRef(new Vector3(0, 0, -1));

  // Collapse per-orb point lights into one pooled light that follows the bolt.
  const orbLight = useDynamicLight({ color: '#ffcc33', distance: 7, priority: 1 });

  const staleDist = useMemo(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len < 1e-4) return 1;
    currentDirRef.current.copy(d).multiplyScalar(1 / len);
    return len;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxLifetimeRef = useRef((staleDist / SPEED) * 1.5);

  const resolvedStaleTargetRef = useRef(targetPosition.clone());

  // ─── Materials (gold/amber family) ──────────────────────────────────────────

  const voidMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#4d2f00'),
    transparent: true, opacity: 0.9,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffdd33'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffaa00'),
    transparent: true, opacity: 0.60,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#fff2b0'),
    transparent: true, opacity: 0.30,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const hazeMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#664d00'),
    transparent: true, opacity: 0.18,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffcc00'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffe066'),
    transparent: true, opacity: 0.65,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff9900'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffbb00'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc9900'),
    transparent: true, opacity: 0.38,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#997700'),
    transparent: true, opacity: 0.22,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail4Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#664400'),
    transparent: true, opacity: 0.12,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    return () => {
      voidMat.dispose();
      coreMat.dispose();
      midMat.dispose();
      auraMat.dispose();
      hazeMat.dispose();
      ring1Mat.dispose();
      ring2Mat.dispose();
      ring3Mat.dispose();
      trail1Mat.dispose();
      trail2Mat.dispose();
      trail3Mat.dispose();
      trail4Mat.dispose();
    };
  }, [voidMat, coreMat, midMat, auraMat, hazeMat, ring1Mat, ring2Mat, ring3Mat, trail1Mat, trail2Mat, trail3Mat, trail4Mat]);

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

    groupRef.current.getWorldPosition(_boltLightPos);
    orbLight.current?.setPosition(_boltLightPos.x, _boltLightPos.y, _boltLightPos.z);
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
        const liveTarget = getTargetPosition();
        if (!liveTarget) {
          doneRef.current = true;
          onComplete();
          return;
        }

        _resolved.copy(liveTarget);

        _aim.copy(_resolved).sub(startPosition);
        const aimLenSq = _aim.lengthSq();
        if (aimLenSq > 1e-8) {
          currentDirRef.current.copy(_aim).multiplyScalar(1 / Math.sqrt(aimLenSq));
        }

        maxLifetimeRef.current = (Math.max(Math.sqrt(aimLenSq), 0.01) / SPEED) * 1.5;
        phaseRef.current = 'flying';
        timeRef.current = 0;
        if (visualScaleRef.current) {
          visualScaleRef.current.scale.setScalar(1);
        }
        setIsCharging(false);
      }

      if (phaseRef.current === 'charging') {
        return;
      }
    }

    timeRef.current += delta;
    const t = timeRef.current;

    const targetPos = getTargetPosition();
    if (!targetPos) {
      // Target died/despawned mid-flight — fizzle gracefully rather than homing on nothing.
      doneRef.current = true;
      onComplete();
      return;
    }

    _toTarget.copy(targetPos).sub(groupRef.current.position);
    if (_toTarget.lengthSq() > 0.25) {
      _toTarget.normalize();
      currentDirRef.current
        .lerp(_toTarget, Math.min(1, TURN_RATE * delta))
        .normalize();
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

    voidMat.opacity = 0.9 * fade;
    coreMat.opacity = 0.95 * fade * pulse;
    midMat.opacity = 0.60 * fade * pulse;
    auraMat.opacity = 0.30 * fade;
    hazeMat.opacity = 0.18 * fade;
    ring1Mat.opacity = 0.75 * fade * pulse2;
    ring2Mat.opacity = 0.65 * fade * pulse2;
    ring3Mat.opacity = 0.55 * fade * pulse2;
    trail1Mat.opacity = 0.55 * fade;
    trail2Mat.opacity = 0.38 * fade;
    trail3Mat.opacity = 0.22 * fade;
    trail4Mat.opacity = 0.12 * fade;

    if (groupRef.current) {
      const bolt = groupRef.current.position;
      const dx = targetPos.x - bolt.x;
      const dz = targetPos.z - bolt.z;
      if (dx * dx + dz * dz < HIT_RADIUS * HIT_RADIUS) {
        doneRef.current = true;
        onHitEnemy();
        onComplete();
        return;
      }
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

        {/* Extra bright pulse while the bolt charges up — the "flash of light that grows". */}
        {isCharging && (
          <PooledEffectLight color="#ffee88" intensity={6} distance={9} decay={2} />
        )}
      </group>
    </group>
  );
}
