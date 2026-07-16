'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import {
  Vector3,
  Mesh,
  AdditiveBlending,
  DoubleSide,
  CylinderGeometry,
  RingGeometry,
  CircleGeometry,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const DURATION_MS = 520;
const SKY_Y = 22;
const KNIGHT_BEAM_RADIUS = 0.11;
const WIDTH_SCALE = 1.5;
const BEAM_RADIUS = KNIGHT_BEAM_RADIUS * WIDTH_SCALE;
const GLOW_RADIUS_SCALE = 1.5;
const OUTER_RADIUS_SCALE = 2.35;
const IMPACT_BURST_PHASE = 0.6;

const PALETTE = {
  core: '#ffb8b8',
  glow: '#ef4444',
  outer: '#7f0505',
  light: '#ff4a2a',
  burstRing: '#7f0505',
  burstCore: '#ff2a1a',
} as const;

interface TemplarBlinkSmiteGroundProps {
  position: Vector3;
  onComplete: () => void;
}

/** Knight-style sky strike for Templar Blink Smite — 1.5× thicker with outer halo + ground burst. */
function TemplarBlinkSmiteGround({ position, onComplete }: TemplarBlinkSmiteGroundProps) {
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const shockRingRef = useRef<Mesh>(null);
  const flashDiscRef = useRef<Mesh>(null);

  const strikeLight = useDynamicLight({ color: PALETTE.light, distance: 20, decay: 2, priority: 1 });
  const burstLight = useDynamicLight({ color: PALETTE.burstCore, distance: 14, decay: 2, priority: 1 });

  const matCore = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.core,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matGlow = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.glow,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matOuter = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.outer,
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matShockRing = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.burstRing,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const matFlashDisc = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.burstCore,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );

  const cyl = useMemo(() => new CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 6), []);
  const shockRingGeo = useMemo(() => new RingGeometry(0.12, 0.42, 32), []);
  const flashDiscGeo = useMemo(() => new CircleGeometry(0.62, 16), []);

  useEffect(() => {
    return () => {
      matCore.dispose();
      matGlow.dispose();
      matOuter.dispose();
      matShockRing.dispose();
      matFlashDisc.dispose();
      cyl.dispose();
      shockRingGeo.dispose();
      flashDiscGeo.dispose();
    };
  }, [matCore, matGlow, matOuter, matShockRing, matFlashDisc, cyl, shockRingGeo, flashDiscGeo]);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const elapsed = performance.now() - startRef.current;
    const k = Math.min(1, elapsed / DURATION_MS);
    const fade = 1 - k;

    matCore.opacity = 0.95 * fade;
    matGlow.opacity = 0.55 * fade;
    matOuter.opacity = 0.22 * fade;

    strikeLight.current?.setPosition(position.x, position.y + 2, position.z);
    strikeLight.current?.setIntensity(32 * fade);

    const burstK = Math.min(1, k / IMPACT_BURST_PHASE);
    const easeOut = 1 - Math.pow(1 - burstK, 2);

    if (shockRingRef.current) {
      const ringScale = 0.35 + easeOut * 2.6;
      shockRingRef.current.scale.set(ringScale, ringScale, 1);
      matShockRing.opacity = 0.88 * fade * Math.min(1, burstK * 2.2);
    }
    if (flashDiscRef.current) {
      const discScale = 0.18 + easeOut * 2.4;
      flashDiscRef.current.scale.set(discScale, discScale, 1);
      matFlashDisc.opacity = 0.78 * fade * (burstK < 0.45 ? burstK / 0.45 : Math.max(0, 1 - (burstK - 0.45) / 0.55));
    }

    burstLight.current?.setPosition(position.x, position.y + 0.15, position.z);
    burstLight.current?.setIntensity(36 * fade * Math.min(1, burstK * 1.8));
    burstLight.current?.setDistance(6 + easeOut * 5);

    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      <group position={[position.x, position.y + SKY_Y / 2, position.z]}>
        <mesh geometry={cyl} material={matOuter} scale={[OUTER_RADIUS_SCALE, SKY_Y, OUTER_RADIUS_SCALE]} />
        <mesh geometry={cyl} material={matGlow} scale={[GLOW_RADIUS_SCALE, SKY_Y, GLOW_RADIUS_SCALE]} />
        <mesh geometry={cyl} material={matCore} scale={[1, SKY_Y, 1]} />
      </group>

      <group position={[position.x, position.y + 0.15, position.z]}>
        <mesh
          ref={shockRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={shockRingGeo}
          material={matShockRing}
          renderOrder={1}
        />
        <mesh
          ref={flashDiscRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={flashDiscGeo}
          material={matFlashDisc}
          renderOrder={2}
        />
      </group>
    </group>
  );
}

export default React.memo(TemplarBlinkSmiteGround);
