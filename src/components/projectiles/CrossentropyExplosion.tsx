import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Material,
  AdditiveBlending,
  RingGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  DoubleSide,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { CrossentropyVisualTheme } from '@/utils/talents';

interface CrossentropyExplosionProps {
  position: Vector3;
  chargeTime?: number;
  /** Kept for API compatibility; animation uses R3F clock. */
  explosionStartTime: number | null;
  visualTheme?: CrossentropyVisualTheme;
  onComplete?: () => void;
}

const DURATION = 0.55;
const BASE_RADIUS = 3.5;
const CROSS_PLANE_COUNT = 4;
const SPARK_COUNT = 4;
const ENTROPY_RING_COUNT = 3;
const EXPANDING_RING_COUNT = 5;
const CROSS_PLANE_ANGLES = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI];
const ENTROPY_RING_SCALES = [0.45, 0.65, 0.85, 1.05];
// Each expanding ring: [stagger (0-1), maxRadiusMultiplier, yOffset, tiltX, tiltZ, innerRatio]
const EXPANDING_RING_PARAMS: [number, number, number, number, number, number][] = [
  [0.00, 2.8, 0.01, 0,                 0,               0.82],
  [0.06, 2.2, 0.04, Math.PI * 0.04,    0,               0.78],
  [0.12, 3.2, 0.02, 0,                 Math.PI * 0.03,  0.85],
  [0.18, 1.8, 0.06, -Math.PI * 0.05,   Math.PI * 0.02,  0.75],
  [0.24, 2.5, 0.03, Math.PI * 0.02,   -Math.PI * 0.04,  0.80],
];

function setMatOpacity(mesh: Mesh | null, opacity: number, brightness = 1) {
  if (!mesh?.material || !(mesh.material instanceof Material)) return;
  const mat = mesh.material as Material & { opacity?: number };
  mat.opacity = Math.min(1, opacity * brightness);
}

export default function CrossentropyExplosion({
  position,
  chargeTime = 1,
  explosionStartTime: _explosionStartTime,
  visualTheme = 'default',
  onComplete,
}: CrossentropyExplosionProps) {
  const groupRef = useRef<Group>(null);
  const groundRingRef = useRef<Mesh>(null);
  const ringOuterRef = useRef<Mesh>(null);
  const ringInnerRef = useRef<Mesh>(null);
  const entropyRingRefs = useRef<(Mesh | null)[]>([]);
  const expandingRingRefs = useRef<(Mesh | null)[]>([]);
  const coreRef = useRef<Mesh>(null);
  const crossPlaneRefs = useRef<(Mesh | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);
  const startTime = useRef<number | null>(null);
  const finished = useRef(false);

  const normalizedCharge = Math.min(chargeTime / 4, 1.0);
  const radius = BASE_RADIUS * (0.85 + 0.15 * normalizedCharge);

  const px = position.x;
  const py = position.y;
  const pz = position.z;

  const {
    c1,
    c1e,
    c2,
    c2e,
    ringC,
    ringE,
    sparkMain,
    sparkMainE,
    pl1,
  } = useMemo(() => {
    if (visualTheme === 'inferno') {
      return {
        c1: '#CC1100', c1e: '#FF2200', c2: '#E62E2E', c2e: '#FF4400',
        ringC: '#DD2200', ringE: '#FF3300', sparkMain: '#FF5500', sparkMainE: '#FFCC22', pl1: '#EE2200',
      };
    }
    if (visualTheme === 'glacial') {
      return {
        c1: '#064E8A', c1e: '#0B74C4', c2: '#0A5FAD', c2e: '#3DB3FF',
        ringC: '#1E56A0', ringE: '#60C4FF', sparkMain: '#94DDFF', sparkMainE: '#E0F5FF', pl1: '#0D5A9E',
      };
    }
    if (visualTheme === 'tempest') {
      return {
        c1: '#0D47A1', c1e: '#2196F3', c2: '#1565C0', c2e: '#42A5F5',
        ringC: '#1E88E5', ringE: '#64B5F6', sparkMain: '#40C4FF', sparkMainE: '#B3E5FC', pl1: '#2196F3',
      };
    }
    if (visualTheme === 'plague') {
      return {
        c1: '#1B5E20', c1e: '#43A047', c2: '#2E7D32', c2e: '#66BB6A',
        ringC: '#43A047', ringE: '#81C784', sparkMain: '#69F0AE', sparkMainE: '#C8E6C9', pl1: '#43A047',
      };
    }
    return {
      c1: '#FF4500', c1e: '#FF6600', c2: '#FF6600', c2e: '#FFA500',
      ringC: '#FF4500', ringE: '#FF6600', sparkMain: '#FFA500', sparkMainE: '#FFD700', pl1: '#FF4500',
    };
  }, [visualTheme]);

  const geometries = useMemo(() => {
    const baseR = radius * 0.42;
    const tubeOuter = Math.max(0.08, radius * 0.11);
    const tubeInner = tubeOuter * 0.65;
    const entropyTube = Math.max(0.06, radius * 0.036);
    return {
      groundRing: new RingGeometry(0.05, 0.35, 32),
      torusOuter: new TorusGeometry(baseR, tubeOuter, 10, 32),
      torusInner: new TorusGeometry(baseR * 0.72, tubeInner, 8, 32),
      crossPlane: new PlaneGeometry(radius * 1.6, radius * 1.2),
      core: new SphereGeometry(radius * 0.18, 12, 12),
      spark: new SphereGeometry(0.06, 6, 6),
      entropyRings: ENTROPY_RING_SCALES.map(
        (scale) => new TorusGeometry(scale * radius * 0.45, entropyTube, 8, 32),
      ),
      expandingRings: EXPANDING_RING_PARAMS.map(([, , , , , innerRatio]) =>
        new RingGeometry(innerRatio * 0.5, 0.5, 48),
      ),
    };
  }, [radius]);

  const entropyRingRotations = useMemo(
    () =>
      ENTROPY_RING_SCALES.map(
        () =>
          [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [
            number,
            number,
            number,
          ],
      ),
    [],
  );

  const blastLight = useDynamicLight({
    color: pl1,
    distance: radius * 2.5,
    decay: 2,
    priority: 1,
  });

  useEffect(
    () => () => {
      geometries.groundRing.dispose();
      geometries.torusOuter.dispose();
      geometries.torusInner.dispose();
      geometries.crossPlane.dispose();
      geometries.core.dispose();
      geometries.spark.dispose();
      geometries.entropyRings.forEach((g) => g.dispose());
      geometries.expandingRings.forEach((g) => g.dispose());
    },
    [geometries],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    if (startTime.current === null) {
      startTime.current = state.clock.getElapsedTime();
    }

    const t = (state.clock.getElapsedTime() - startTime.current) / DURATION;
    if (t >= 1) {
      if (!finished.current) {
        finished.current = true;
        onComplete?.();
      }
      return;
    }

    const fade = 1 - t;
    const pulse = 0.15 + t * 0.85;

    blastLight.current?.setPosition(px, py, pz);
    blastLight.current?.setIntensity(2.0 * fade * (1 + t * 0.5));

    groupRef.current.scale.setScalar(pulse);

    setMatOpacity(ringOuterRef.current, fade * 0.75, 0.75);
    setMatOpacity(ringInnerRef.current, fade * 0.55, 0.55);

    const groundRing = groundRingRef.current;
    if (groundRing) {
      const groundScale = 0.2 + t * (radius / 0.35);
      groundRing.scale.set(groundScale, groundScale, 1);
      setMatOpacity(groundRing, fade * 0.85, 0.85);
    }

    entropyRingRefs.current.forEach((ring, i) => {
      if (!ring) return;
      const stagger = i * 0.05;
      const ringT = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
      const ringScale = 0.35 + ringT * 1.65;
      ring.scale.setScalar(ringScale);
      setMatOpacity(ring, fade * (0.7 - i * 0.12), 0.65 - i * 0.08);
    });

    expandingRingRefs.current.forEach((ring, i) => {
      if (!ring) return;
      const [stagger, maxMult] = EXPANDING_RING_PARAMS[i];
      const localT = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
      // expand quickly then slow down (ease-out cubic)
      const eased = 1 - Math.pow(1 - localT, 3);
      const targetScale = radius * maxMult;
      const currentScale = 0.05 * radius + eased * targetScale;
      ring.scale.set(currentScale, currentScale, 1);
      // fade out more aggressively for later rings to create layered feel
      const opacity = (1 - localT) * (0.85 - i * 0.1);
      setMatOpacity(ring, Math.max(0, opacity), 1);
    });

    const core = coreRef.current;
    if (core) {
      const corePulse = t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.35);
      core.scale.setScalar(0.3 + corePulse * 1.4);
      setMatOpacity(core, fade * 0.9, 0.35 + corePulse * 0.65);
    }

    crossPlaneRefs.current.forEach((plane, i) => {
      if (!plane) return;
      const stagger = i * 0.04;
      const planeT = Math.min(1, Math.max(0, (t - stagger) / (1 - stagger)));
      const planeScale = 0.1 + planeT * 0.9;
      plane.scale.set(planeScale, 0.15 + planeT * 1.2, 1);
      setMatOpacity(plane, fade * 0.5, 0.45 + planeScale * 0.45);
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
      setMatOpacity(spark, fade * 0.8, 0.65);
    });
  });

  const vfxMat = (color: string, opacity: number) => (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      depthWrite={false}
      blending={AdditiveBlending}
    />
  );

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      <mesh
        ref={groundRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        geometry={geometries.groundRing}
      >
        {vfxMat(ringE, 0.85)}
      </mesh>

      <mesh ref={ringOuterRef} rotation={[Math.PI / 2, 0, 0]} geometry={geometries.torusOuter}>
        {vfxMat(c1e, 0.75)}
      </mesh>

      <mesh ref={ringInnerRef} rotation={[Math.PI / 2, 0, 0.35]} geometry={geometries.torusInner}>
        {vfxMat(c2e, 0.55)}
      </mesh>

      {geometries.entropyRings.map((geo, i) => (
        <mesh
          key={`entropy-ring-${i}`}
          ref={(el) => {
            entropyRingRefs.current[i] = el;
          }}
          geometry={geo}
          rotation={entropyRingRotations[i]}
        >
          {vfxMat(ringE, 0.7 - i * 0.12)}
        </mesh>
      ))}

      {EXPANDING_RING_PARAMS.map(([, , yOffset, tiltX, tiltZ], i) => (
        <mesh
          key={`expanding-ring-${i}`}
          ref={(el) => {
            expandingRingRefs.current[i] = el;
          }}
          geometry={geometries.expandingRings[i]}
          position={[0, yOffset, 0]}
          rotation={[-Math.PI / 2 + tiltX, 0, tiltZ]}
        >
          {vfxMat(i % 3 === 0 ? ringE : i % 3 === 1 ? c1e : ringC, 0.85 - i * 0.1)}
        </mesh>
      ))}

      {CROSS_PLANE_ANGLES.map((angle, i) => (
        <mesh
          key={`plane-${i}`}
          ref={(el) => {
            crossPlaneRefs.current[i] = el;
          }}
          rotation={[0, angle, 0]}
          geometry={geometries.crossPlane}
        >
          <meshBasicMaterial
            color={i % 2 === 0 ? c1e : c2e}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
      ))}

      <mesh ref={coreRef} geometry={geometries.core}>
        {vfxMat(c1, 0.9)}
      </mesh>

      {Array.from({ length: SPARK_COUNT }).map((_, i) => (
        <mesh
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          geometry={geometries.spark}
        >
          {vfxMat(i % 2 === 0 ? sparkMain : sparkMainE, 0.8)}
        </mesh>
      ))}
    </group>
  );
}
