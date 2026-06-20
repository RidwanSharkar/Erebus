import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Material,
  AdditiveBlending,
  Color,
  RingGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { EXPLOSIVE_TALONS_EXPLOSION_RADIUS } from '@/utils/talents';

const VENOM = new Color('#2ee6a8');
const ACCENT = new Color('#ff9a3c');
const DURATION = 0.45;
const CROSS_PLANE_COUNT = 4;
const SPARK_COUNT = 6;
const CROSS_PLANE_ANGLES = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI];

interface ExplosiveTalonsDetonationProps {
  position: Vector3;
  onComplete: () => void;
}

/**
 * One-shot AoE read for Explosive Talons at max range; scale tracks gameplay radius.
 */
export default function ExplosiveTalonsDetonation({
  position,
  onComplete,
}: ExplosiveTalonsDetonationProps) {
  const groupRef = useRef<Group>(null);
  const ringOuterRef = useRef<Mesh>(null);
  const ringInnerRef = useRef<Mesh>(null);
  const groundRingRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const crossPlaneRefs = useRef<(Mesh | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);
  const startTime = useRef<number | null>(null);

  const px = position.x;
  const py = Math.max(1.0, position.y);
  const pz = position.z;

  const detonationLight = useDynamicLight({
    color: ACCENT,
    distance: EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 3,
    decay: 2,
    priority: 1,
  });

  const geometries = useMemo(() => {
    const baseR = EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 0.42;
    const tubeOuter = Math.max(0.08, EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 0.11);
    const tubeInner = tubeOuter * 0.65;
    const radius = EXPLOSIVE_TALONS_EXPLOSION_RADIUS;
    return {
      groundRing: new RingGeometry(0.05, 0.35, 32),
      torusOuter: new TorusGeometry(baseR, tubeOuter, 10, 40),
      torusInner: new TorusGeometry(baseR * 0.72, tubeInner, 8, 32),
      crossPlane: new PlaneGeometry(radius * 1.6, radius * 1.2),
      core: new SphereGeometry(radius * 0.18, 12, 12),
      spark: new SphereGeometry(0.06, 6, 6),
    };
  }, []);

  useEffect(
    () => () => {
      geometries.groundRing.dispose();
      geometries.torusOuter.dispose();
      geometries.torusInner.dispose();
      geometries.crossPlane.dispose();
      geometries.core.dispose();
      geometries.spark.dispose();
    },
    [geometries],
  );

  const setMatOpacity = (mesh: Mesh | null, opacity: number, emissiveIntensity: number) => {
    if (!mesh?.material || !(mesh.material instanceof Material)) return;
    const mat = mesh.material as Material & { opacity?: number; emissiveIntensity?: number };
    mat.opacity = opacity;
    mat.emissiveIntensity = emissiveIntensity;
  };

  useFrame((state) => {
    if (!groupRef.current) return;

    if (startTime.current === null) {
      startTime.current = state.clock.getElapsedTime();
    }

    const t = (state.clock.getElapsedTime() - startTime.current) / DURATION;
    if (t >= 1) {
      onComplete();
      return;
    }

    const fade = 1 - t;
    const pulse = 0.15 + t * 0.85;
    const radius = EXPLOSIVE_TALONS_EXPLOSION_RADIUS;

    detonationLight.current?.setPosition(px, py, pz);
    detonationLight.current?.setIntensity(2.2 * fade * (1 + t * 0.5));

    groupRef.current.scale.setScalar(pulse);

    setMatOpacity(ringOuterRef.current, fade * 0.75, fade * 2.2);
    setMatOpacity(ringInnerRef.current, fade * 0.55, fade * 1.6);

    const groundRing = groundRingRef.current;
    if (groundRing) {
      const groundScale = 0.2 + t * (radius / 0.35);
      groundRing.scale.set(groundScale, groundScale, 1);
      setMatOpacity(groundRing, fade * 0.85, fade * 2.4);
    }

    const core = coreRef.current;
    if (core) {
      const corePulse = t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.35);
      core.scale.setScalar(0.3 + corePulse * 1.4);
      setMatOpacity(core, fade * 0.9, fade * 3.5 * corePulse);
    }

    crossPlaneRefs.current.forEach((plane, i) => {
      if (!plane) return;
      const stagger = i * 0.04;
      const planeT = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
      const planeScale = 0.1 + planeT * 0.9;
      plane.scale.set(planeScale, 0.15 + planeT * 1.2, 1);
      setMatOpacity(plane, fade * 0.5, fade * 1.8 * planeScale);
    });

    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return;
      const angle = (i / SPARK_COUNT) * Math.PI * 2;
      const sparkRadius = radius * 0.15 + t * radius * 0.85;
      const sparkY = Math.sin(t * Math.PI * 2 + i) * 0.3 * fade;
      spark.position.set(
        Math.cos(angle) * sparkRadius,
        sparkY,
        Math.sin(angle) * sparkRadius,
      );
      const sparkScale = fade * (0.6 + (1 - t) * 0.8);
      spark.scale.setScalar(sparkScale);
      setMatOpacity(spark, fade * 0.8, fade * 2.5);
    });
  });

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      <mesh ref={groundRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} geometry={geometries.groundRing}>
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={2.4}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={AdditiveBlending}
          side={2}
        />
      </mesh>

      <mesh ref={ringOuterRef} rotation={[Math.PI / 2, 0, 0]} geometry={geometries.torusOuter}>
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={2}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh ref={ringInnerRef} rotation={[Math.PI / 2, 0, 0.35]} geometry={geometries.torusInner}>
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={1.6}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {CROSS_PLANE_ANGLES.map((angle, i) => (
        <mesh
          key={`plane-${i}`}
          ref={(el) => {
            crossPlaneRefs.current[i] = el;
          }}
          rotation={[0, angle, 0]}
          geometry={geometries.crossPlane}
        >
          <meshStandardMaterial
            color={i % 2 === 0 ? ACCENT : ACCENT}
            emissive={i % 2 === 0 ? ACCENT : ACCENT}
            emissiveIntensity={1.8}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={AdditiveBlending}
            side={2}
          />
        </mesh>
      ))}

      <mesh ref={coreRef} geometry={geometries.core}>
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={3.5}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {Array.from({ length: SPARK_COUNT }).map((_, i) => (
        <mesh
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          geometry={geometries.spark}
        >
          <meshStandardMaterial
            color={i % 2 === 0 ? ACCENT : ACCENT}
            emissive={i % 2 === 0 ? ACCENT : ACCENT}
            emissiveIntensity={2.5}
            transparent
            opacity={0.8}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
