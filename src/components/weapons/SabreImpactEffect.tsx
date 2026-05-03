'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';

interface SabreImpactEffectProps {
  position: Vector3;
  /** Horizontal stab direction (player toward hit). */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION = 0.36;
const SPARK_COUNT = 1;

const COLOR_CORE = new Color('#e8fcff');
const COLOR_EDGE = new Color('#ff6a5c');
const COLOR_FLASH = new Color('#ffffff');
const COLOR_RING = new Color('#7ae8ff');

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const base = (i / count) * Math.PI * 2;
    const angle = base + (Math.random() * 0.35 - 0.175);
    const speed = 4.2 + Math.random() * 3.2;
    const delay = 0.04 + Math.random() * 0.1;
    const size = 0.04 + Math.random() * 0.07;
    const yBias = (Math.random() - 0.5) * 0.15;
    return { angle, speed, delay, size, yBias };
  });
}

export default function SabreImpactEffect({
  position,
  direction,
  onComplete,
}: SabreImpactEffectProps) {
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const leftBladeRef = useRef<Mesh | null>(null);
  const rightBladeRef = useRef<Mesh | null>(null);
  const leftGhostRef = useRef<Mesh | null>(null);
  const rightGhostRef = useRef<Mesh | null>(null);
  const pinchX1Ref = useRef<Mesh | null>(null);
  const pinchX2Ref = useRef<Mesh | null>(null);
  const ringRef = useRef<Mesh | null>(null);
  const sparkRefs = useRef<(Mesh | null)[]>(Array(SPARK_COUNT).fill(null));

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

  const stabYaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    [direction.x, direction.z],
  );

  const leftMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_EDGE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const rightMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CORE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const leftGhostMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_EDGE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const rightGhostMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CORE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const pinchMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_FLASH,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_RING,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const sparkMats = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: i % 2 === 0 ? COLOR_FLASH : COLOR_CORE,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: 2,
        }),
      ),
    [],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const phaseClose = Math.min(t / 0.14, 1);
    const easeClose = 1 - (1 - phaseClose) ** 2;
    const spreadStart = 0.42;
    const spreadEnd = 0.04;
    const lateral = spreadStart + (spreadEnd - spreadStart) * easeClose;

    const bladeStretch = 0.88 + 0.22 * easeClose;
    const bladeFade =
      t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.12) / (DURATION - 0.12));

    if (leftBladeRef.current && rightBladeRef.current) {
      leftBladeRef.current.position.x = -lateral;
      rightBladeRef.current.position.x = lateral;

      const twist = 0.55 * (1 - easeClose);
      leftBladeRef.current.rotation.z = -twist;
      rightBladeRef.current.rotation.z = twist;

      const lunge = t * 2.2;
      leftBladeRef.current.position.z = lunge * 0.35;
      rightBladeRef.current.position.z = lunge * 0.35;

      leftBladeRef.current.scale.set(1, bladeStretch, 1);
      rightBladeRef.current.scale.set(1, bladeStretch, 1);

      const mainOp = Math.max(0, 0.92 * bladeFade);
      leftMat.opacity = mainOp;
      rightMat.opacity = Math.max(0, 0.95 * bladeFade);

      if (leftGhostRef.current && rightGhostRef.current) {
        leftGhostRef.current.position.x = -lateral;
        rightGhostRef.current.position.x = lateral;
        leftGhostRef.current.position.z = lunge * 0.35 - 0.045;
        rightGhostRef.current.position.z = lunge * 0.35 - 0.045;
        leftGhostRef.current.rotation.z = -twist;
        rightGhostRef.current.rotation.z = twist;
        leftGhostRef.current.scale.set(1, bladeStretch * 1.02, 1);
        rightGhostRef.current.scale.set(1, bladeStretch * 1.02, 1);
        leftGhostMat.opacity = Math.max(0, mainOp * 0.38);
        rightGhostMat.opacity = Math.max(0, mainOp * 0.38);
      }
    }

    // Crossed pinch planes — brief core glint (replaces dominant flat disc)
    if (pinchX1Ref.current && pinchX2Ref.current) {
      const pinchFade =
        t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.12);
      const s = Math.min(0.42 + t * 3.5, 1.05);
      pinchX1Ref.current.scale.set(s, s, 1);
      pinchX2Ref.current.scale.set(s, s, 1);
      pinchMat.opacity = Math.max(0, pinchFade * 0.55);
    }

    // Expanding cyan shock ring
    if (ringRef.current) {
      const progress = Math.min(t / DURATION, 1);
      const ringScale = progress * 1.35;
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const fadeIn = t < 0.05 ? t / 0.05 : 1;
      const fadeOut =
        t > DURATION * 0.42 ? 1 - (t - DURATION * 0.42) / (DURATION * 0.58) : 1;
      ringMat.opacity = Math.max(0, fadeIn * fadeOut * 0.72);
    }

    // Radial sparks — burst mid-hit (aligned with blade convergence)
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
      mesh.rotation.y = -angle;
      const sc = size * (0.55 + localT * 2.4);
      mesh.scale.set(sc * 0.35, sc * 1.15, 1);
      const localFade =
        localT < 0.06
          ? localT / 0.06
          : Math.max(0, 1 - (localT - 0.06) / (DURATION * 0.82));
      mat.opacity = Math.max(0, 0.88 * localFade);
    }
  });

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, stabYaw, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <torusGeometry args={[1, 0.055, 8, 40]} />
        <primitive object={ringMat} attach="material" />
      </mesh>

      <mesh ref={pinchX1Ref} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[0.055, 0.48]} />
        <primitive object={pinchMat} attach="material" />
      </mesh>
      <mesh ref={pinchX2Ref} rotation={[0, -Math.PI / 4, 0]}>
        <planeGeometry args={[0.055, 0.48]} />
        <primitive object={pinchMat} attach="material" />
      </mesh>

      {sparkParams.map((_, i) => (
        <mesh key={i} ref={(el) => { sparkRefs.current[i] = el; }}>
          <planeGeometry args={[1, 1]} />
          <primitive object={sparkMats[i]} attach="material" />
        </mesh>
      ))}

      <mesh ref={leftBladeRef} rotation={[0.15, 0, 0.35]} position={[-0.42, 0, 0]}>
        <planeGeometry args={[0.095, 0.74]} />
        <primitive object={leftMat} attach="material" />
      </mesh>
      <mesh ref={rightBladeRef} rotation={[0.15, 0, -0.35]} position={[0.42, 0, 0]}>
        <planeGeometry args={[0.095, 0.74]} />
        <primitive object={rightMat} attach="material" />
      </mesh>
      <mesh ref={leftGhostRef} rotation={[0.15, 0, 0.35]} position={[-0.42, 0, -0.045]}>
        <planeGeometry args={[0.095, 0.74]} />
        <primitive object={leftGhostMat} attach="material" />
      </mesh>
      <mesh ref={rightGhostRef} rotation={[0.15, 0, -0.35]} position={[0.42, 0, -0.045]}>
        <planeGeometry args={[0.095, 0.74]} />
        <primitive object={rightGhostMat} attach="material" />
      </mesh>
    </group>
  );
}
