'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  Color,
  Vector3,
  AdditiveBlending,
  DoubleSide,
  RingGeometry,
  SphereGeometry,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const SPHERE_GEOMETRY = new SphereGeometry(1, 16, 10);
const RING_GEOMETRY = new RingGeometry(0.72, 1.0, 28);
const SHOCKWAVE_GEOMETRY = new RingGeometry(0.82, 1.05, 28);

const MOTE_COUNT = 7;
const DEFAULT_FLARE_MS = 260;
const DEFAULT_OFFSET: [number, number, number] = [0, 1.5, 0.6];
const _lightWorld = new Vector3();

export interface SpellChargeFlareProps {
  /** Increment to (re)start; 0 = never played. */
  playKey: number;
  /** Projectile trail `uColor`. */
  color: string;
  /** Projectile trail `uAccent`. */
  accentColor: string;
  chargeMs: number;
  flareMs?: number;
  offset?: [number, number, number];
  scale?: number;
}

function makeAdditiveMat(hex: string, opacity: number, doubleSide = false) {
  return new MeshBasicMaterial({
    color: new Color(hex),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    ...(doubleSide ? { side: DoubleSide } : {}),
  });
}

function SpellChargeFlarePlaying({
  playKey,
  color,
  chargeMs,
  flareMs,
  offset,
  scale,
  coreMat,
  auraMat,
  ringMat,
  moteMat,
  shockMat,
  onComplete,
}: {
  playKey: number;
  color: string;
  chargeMs: number;
  flareMs: number;
  offset: [number, number, number];
  scale: number;
  coreMat: MeshBasicMaterial;
  auraMat: MeshBasicMaterial;
  ringMat: MeshBasicMaterial;
  moteMat: MeshBasicMaterial;
  shockMat: MeshBasicMaterial;
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);
  const shockRef = useRef<Mesh>(null);
  const moteRefs = useRef<(Mesh | null)[]>([]);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const light = useDynamicLight({ color, distance: 6.5, priority: 1 });

  useEffect(() => {
    elapsedRef.current = 0;
    doneRef.current = false;
    coreMat.opacity = 0;
    auraMat.opacity = 0;
    ringMat.opacity = 0;
    moteMat.opacity = 0;
    shockMat.opacity = 0;
    light.current?.setColor(color);
  }, [playKey, color, coreMat, auraMat, ringMat, moteMat, shockMat, light]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    elapsedRef.current += delta;
    const t = elapsedRef.current;
    const chargeSec = Math.max(0.05, chargeMs / 1000);
    const flareSec = Math.max(0.05, flareMs / 1000);

    const g = groupRef.current;
    if (g) {
      g.getWorldPosition(_lightWorld);
      light.current?.setPosition(_lightWorld.x, _lightWorld.y, _lightWorld.z);
    }

    if (t < chargeSec) {
      const raw = t / chargeSec;
      const p = raw * raw * (3 - 2 * raw);
      const breathe = 0.5 + 0.5 * Math.sin(t * 10);

      if (coreRef.current) {
        coreRef.current.scale.setScalar(0.05 + 0.21 * p);
        coreMat.opacity = 0.22 + 0.73 * p;
      }
      if (auraRef.current) {
        auraRef.current.scale.setScalar((0.18 + 0.38 * p) * (1 + 0.12 * breathe));
        auraMat.opacity = 0.08 + 0.32 * p;
      }
      const ringScale = 1.15 - 0.4 * p;
      if (ringARef.current) {
        ringARef.current.scale.set(ringScale, ringScale, 1);
        ringARef.current.rotation.z = t * (1.4 + 2.2 * p);
      }
      if (ringBRef.current) {
        ringBRef.current.scale.set(ringScale * 0.82, ringScale * 0.82, 1);
        ringBRef.current.rotation.z = -t * (1.8 + 2.6 * p);
      }
      ringMat.opacity = 0.18 + 0.52 * p;
      moteMat.opacity = 0.35 + 0.5 * p;

      const radius = 0.85 * (1 - p);
      const orbitSpeed = 2.2 + 4.5 * p;
      for (let i = 0; i < MOTE_COUNT; i++) {
        const mote = moteRefs.current[i];
        if (!mote) continue;
        const angle = (i / MOTE_COUNT) * Math.PI * 2 + t * orbitSpeed;
        mote.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.55,
          Math.sin(t * 3 + i) * 0.08,
        );
        const moteScale = 0.045 + 0.035 * p;
        mote.scale.setScalar(moteScale);
      }

      if (shockRef.current) {
        shockRef.current.scale.set(0.01, 0.01, 1);
        shockMat.opacity = 0;
      }

      light.current?.setIntensity(3 + 10 * p);
      return;
    }

    const e = Math.min(1, (t - chargeSec) / flareSec);
    const fade = 1 - e;
    const burst = e * e;

    if (coreRef.current) {
      coreRef.current.scale.setScalar(0.26 + 0.64 * e);
      coreMat.opacity = 0.95 * fade;
    }
    if (auraRef.current) {
      auraRef.current.scale.setScalar(0.55 + 0.85 * e);
      auraMat.opacity = 0.4 * fade;
    }
    const flareRing = 0.75 + 0.7 * e;
    if (ringARef.current) {
      ringARef.current.scale.set(flareRing, flareRing, 1);
      ringARef.current.rotation.z += delta * 6;
    }
    if (ringBRef.current) {
      ringBRef.current.scale.set(flareRing * 0.7, flareRing * 0.7, 1);
      ringBRef.current.rotation.z -= delta * 7;
    }
    ringMat.opacity = 0.7 * fade;

    if (shockRef.current) {
      const shockScale = 0.25 + 1.25 * e;
      shockRef.current.scale.set(shockScale, shockScale, 1);
      shockMat.opacity = 0.85 * fade;
    }

    moteMat.opacity = 0.85 * fade;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const mote = moteRefs.current[i];
      if (!mote) continue;
      const angle = (i / MOTE_COUNT) * Math.PI * 2;
      const spread = 0.08 + 0.55 * burst;
      mote.position.set(
        Math.cos(angle) * spread,
        Math.sin(angle) * spread * 0.5,
        0.05 + 1.15 * e,
      );
      mote.scale.setScalar(0.08 * fade);
    }

    light.current?.setIntensity(24 * fade * fade);

    if (e >= 1 && !doneRef.current) {
      doneRef.current = true;
      light.current?.setIntensity(0);
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={offset} scale={scale}>
      <mesh ref={auraRef} geometry={SPHERE_GEOMETRY} material={auraMat} />
      <mesh ref={coreRef} geometry={SPHERE_GEOMETRY} material={coreMat} />
      <mesh ref={ringARef} geometry={RING_GEOMETRY} material={ringMat} />
      <mesh ref={ringBRef} geometry={RING_GEOMETRY} material={ringMat} />
      <mesh ref={shockRef} geometry={SHOCKWAVE_GEOMETRY} material={shockMat} />
      {Array.from({ length: MOTE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { moteRefs.current[i] = el; }}
          geometry={SPHERE_GEOMETRY}
          material={moteMat}
        />
      ))}
    </group>
  );
}

const SpellChargeFlare = React.memo(function SpellChargeFlare({
  playKey,
  color,
  accentColor,
  chargeMs,
  flareMs = DEFAULT_FLARE_MS,
  offset = DEFAULT_OFFSET,
  scale = 1,
}: SpellChargeFlareProps) {
  const [alive, setAlive] = useState(playKey > 0);

  const coreMat = useMemo(() => makeAdditiveMat(accentColor, 0), [accentColor]);
  const auraMat = useMemo(() => makeAdditiveMat(color, 0), [color]);
  const ringMat = useMemo(() => makeAdditiveMat(color, 0, true), [color]);
  const moteMat = useMemo(() => makeAdditiveMat(accentColor, 0), [accentColor]);
  const shockMat = useMemo(() => makeAdditiveMat(accentColor, 0, true), [accentColor]);

  useEffect(() => {
    return () => {
      coreMat.dispose();
      auraMat.dispose();
      ringMat.dispose();
      moteMat.dispose();
      shockMat.dispose();
    };
  }, [coreMat, auraMat, ringMat, moteMat, shockMat]);

  useEffect(() => {
    if (playKey > 0) setAlive(true);
  }, [playKey]);

  if (!alive || playKey <= 0) return null;

  return (
    <SpellChargeFlarePlaying
      playKey={playKey}
      color={color}
      chargeMs={chargeMs}
      flareMs={flareMs}
      offset={offset}
      scale={scale}
      coreMat={coreMat}
      auraMat={auraMat}
      ringMat={ringMat}
      moteMat={moteMat}
      shockMat={shockMat}
      onComplete={() => setAlive(false)}
    />
  );
});

export default SpellChargeFlare;
