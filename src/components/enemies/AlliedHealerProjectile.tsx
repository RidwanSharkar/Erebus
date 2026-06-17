'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface AlliedHealerProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onComplete: () => void;
}

const SPEED = 9; // units per second — matches warlock orb
const CHARGE_MIN_SCALE = 0.08;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export default function AlliedHealerProjectile({
  startPosition,
  targetPosition,
  onComplete,
}: AlliedHealerProjectileProps) {
  const groupRef = useRef<Group>(null);
  const visualScaleRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const ring1Ref = useRef<Group>(null);
  const ring2Ref = useRef<Group>(null);
  const ring3Ref = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const currentDirRef = useRef(new Vector3(0, 0, -1));

  // Single pooled light follows the orb (replaces 3 near-coincident <pointLight>s).
  const orbLight = useDynamicLight({ color: '#00eeff', distance: 6.5, priority: 2 });

  const staleDist = useMemo(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len < 1e-4) return 1;
    currentDirRef.current.copy(d).multiplyScalar(1 / len);
    return len;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxLifetimeRef = useRef((staleDist / SPEED) * 1.4);

  // ─── Materials — cyan / teal / azure palette ───────────────────────────────

  const voidMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#001a22'),
    transparent: true, opacity: 0.90,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00eeff'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#0099cc'),
    transparent: true, opacity: 0.60,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00aadd'),
    transparent: true, opacity: 0.28,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const hazeMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#002233'),
    transparent: true, opacity: 0.18,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00ccff'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#0077bb'),
    transparent: true, opacity: 0.65,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00ddee'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#008899'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#005566'),
    transparent: true, opacity: 0.38,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#003344'),
    transparent: true, opacity: 0.22,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail4Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#001a22'),
    transparent: true, opacity: 0.12,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    const dir = currentDirRef.current;
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    if (visualScaleRef.current) {
      visualScaleRef.current.scale.setScalar(CHARGE_MIN_SCALE);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const maxLifetime = maxLifetimeRef.current;

    // Brief scale-up at launch
    if (visualScaleRef.current) {
      const scaleT = Math.min(1, t / 0.12);
      const s = CHARGE_MIN_SCALE + (1 - CHARGE_MIN_SCALE) * smoothstep01(scaleT);
      visualScaleRef.current.scale.setScalar(s);
    }

    const dir = currentDirRef.current;
    groupRef.current.position.addScaledVector(dir, SPEED * delta);
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

    // Drive the pooled light at the orb's world position.
    const gp = groupRef.current.position;
    orbLight.current?.setPosition(gp.x, gp.y, gp.z);
    orbLight.current?.setIntensity(18);

    if (spinRef.current) spinRef.current.rotation.z += delta * 2.6;
    if (ring1Ref.current) ring1Ref.current.rotation.y += delta * 3.5;
    if (ring2Ref.current) ring2Ref.current.rotation.x -= delta * 2.3;
    if (ring3Ref.current) ring3Ref.current.rotation.z += delta * 2.9;

    const progress = Math.min(t / maxLifetime, 1.0);
    const fade = progress > 0.70 ? 1 - (progress - 0.70) / 0.30 : 1.0;
    const pulse = 0.85 + 0.15 * Math.sin(t * 14);
    const pulse2 = 0.78 + 0.22 * Math.sin(t * 9 + 1.3);

    voidMat.opacity = 0.90 * fade;
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
