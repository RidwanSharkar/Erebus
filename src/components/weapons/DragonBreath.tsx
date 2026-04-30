'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  CylinderGeometry,
  PointLight,
  RingGeometry,
  Vector3,
} from '@/utils/three-exports';
import {
  AFTERSHOCK_DETONATION_DELAY_MS,
  AFTERSHOCK_STRIP_HALF_WIDTH,
  AFTERSHOCK_STRIP_LENGTH,
} from '@/utils/talents';

interface DragonBreathProps {
  position: Vector3;
  direction: Vector3;
  startTime: number;
  onComplete: () => void;
}

const GROUND_Y = 0.04;
const PILLAR_COUNT = 9;
const CRACK_COUNT = 8;
const SPARK_COUNT = 14;
const PILLAR_RADIUS = 0.18;
const PILLAR_MAX_HEIGHT = 3.1;
const STRIP_FADE_MS = 350;
const TOTAL_MS =
  AFTERSHOCK_DETONATION_DELAY_MS + STRIP_FADE_MS + 260;

export default function DragonBreath({ position, direction, startTime, onComplete }: DragonBreathProps) {
  const rootRef = useRef<Group>(null);
  const stripRef = useRef<Group>(null);
  const completedRef = useRef(false);
  const detonationSoundPlayedRef = useRef(false);

  const pillarGroupRefs = useRef<(Group | null)[]>(Array(PILLAR_COUNT).fill(null));
  const pillarLightRefs = useRef<(PointLight | null)[]>(Array(PILLAR_COUNT).fill(null));
  const shockwaveRef = useRef<Mesh>(null);
  const blastCoreRef = useRef<Mesh>(null);
  const sparkGroupRefs = useRef<(Group | null)[]>(Array(SPARK_COUNT).fill(null));

  const stripWidth = AFTERSHOCK_STRIP_HALF_WIDTH * 2;

  const geometries = useMemo(
    () => ({
      ground: new PlaneGeometry(stripWidth, AFTERSHOCK_STRIP_LENGTH),
      ember: new PlaneGeometry(stripWidth * 0.92, AFTERSHOCK_STRIP_LENGTH * 0.96),
      fissure: new PlaneGeometry(stripWidth * 0.16, AFTERSHOCK_STRIP_LENGTH * 0.18),
      edge: new PlaneGeometry(0.06, AFTERSHOCK_STRIP_LENGTH),
      pillar: new CylinderGeometry(PILLAR_RADIUS, PILLAR_RADIUS * 0.65, 1, 10),
      shockwave: new RingGeometry(0.62, 1.02, 48),
      blastCore: new CylinderGeometry(stripWidth * 0.48, stripWidth * 0.28, 0.08, 24),
      spark: new ConeGeometry(0.055, 0.72, 5),
    }),
    [stripWidth],
  );

  const materials = useMemo(
    () => ({
      ground: new MeshBasicMaterial({
        color: new Color('#173800'),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      ember: new MeshBasicMaterial({
        color: new Color('#50FF28'),
        transparent: true,
        opacity: 0.42,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      fissure: new MeshBasicMaterial({
        color: new Color('#D8FF75'),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      edge: new MeshBasicMaterial({
        color: new Color('#8CFF42'),
        transparent: true,
        opacity: 0.46,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pillar: new MeshBasicMaterial({
        color: new Color('#D7FF72'),
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pillarOuter: new MeshBasicMaterial({
        color: new Color('#22CC11'),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      shockwave: new MeshBasicMaterial({
        color: new Color('#BCFF65'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      blastCore: new MeshBasicMaterial({
        color: new Color('#F4FFAA'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      spark: new MeshBasicMaterial({
        color: new Color('#B7FF55'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  );

  const crackSegments = useMemo(
    () =>
      Array.from({ length: CRACK_COUNT }, (_, i) => {
        const progress = (i + 0.72) / CRACK_COUNT;
        return {
          x: Math.sin(i * 2.17) * stripWidth * 0.22,
          z: progress * AFTERSHOCK_STRIP_LENGTH,
          rotation: Math.sin(i * 1.31) * 0.48,
          scaleX: 0.62 + (i % 3) * 0.22,
          scaleY: 0.74 + ((i + 1) % 4) * 0.18,
        };
      }),
    [stripWidth],
  );

  const pillarBursts = useMemo(
    () =>
      Array.from({ length: PILLAR_COUNT }, (_, i) => ({
        x: Math.sin(i * 1.71) * stripWidth * 0.24,
        z: (i + 0.5) * (AFTERSHOCK_STRIP_LENGTH / PILLAR_COUNT),
        height: 0.72 + ((i * 7) % 5) * 0.11,
        radius: 0.8 + ((i * 5) % 4) * 0.12,
      })),
    [stripWidth],
  );

  const sparkBursts = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => ({
        x: Math.sin(i * 2.53) * stripWidth * 0.46,
        z: ((i + 0.35) / SPARK_COUNT) * AFTERSHOCK_STRIP_LENGTH,
        height: 0.85 + (i % 4) * 0.2,
        rotationY: i * 1.37,
        lean: (i % 2 === 0 ? 1 : -1) * (0.24 + (i % 3) * 0.08),
      })),
    [stripWidth],
  );

  const normalizedDirection = useMemo(() => {
    const d = direction.clone();
    d.y = 0;
    if (d.lengthSq() < 1e-8) d.set(0, 0, 1);
    return d.normalize();
  }, [direction]);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometries, materials]);

  useFrame(({ clock }) => {
    if (!rootRef.current || completedRef.current) return;

    const elapsedMs = Date.now() - startTime;
    const t = clock.getElapsedTime();

    rootRef.current.position.set(position.x, position.y + GROUND_Y, position.z);
    rootRef.current.rotation.y = Math.atan2(normalizedDirection.x, normalizedDirection.z);

    // Strip center at half length along local +Z (forward)
    if (stripRef.current) {
      stripRef.current.position.set(0, 0, AFTERSHOCK_STRIP_LENGTH * 0.5);
    }

    const telegraphEnd = AFTERSHOCK_DETONATION_DELAY_MS;
    const telegraphFade = Math.max(0, 1 - Math.max(0, elapsedMs - telegraphEnd) / STRIP_FADE_MS);
    const pulse = 0.78 + Math.sin(t * 14) * 0.12;
    materials.ground.opacity = 0.35 * pulse * telegraphFade;
    materials.ember.opacity = 0.38 * pulse * telegraphFade;
    materials.fissure.opacity = (0.34 + Math.sin(t * 22) * 0.12) * telegraphFade;
    materials.edge.opacity = (0.22 + Math.sin(t * 18) * 0.14) * telegraphFade;

    const rawDet = elapsedMs - telegraphEnd;
    const detonationT =
      rawDet <= 0 ? 0 : Math.min(1, rawDet / 420);
    const pillarScale =
      rawDet <= 0 ? 0 : Math.min(1, Math.pow(detonationT, 0.52));
    const shockwaveT = rawDet <= 0 ? 0 : Math.min(1, rawDet / 520);
    const sparkT = rawDet <= 0 ? 0 : Math.min(1, rawDet / 460);

    if (rawDet >= 0 && !detonationSoundPlayedRef.current) {
      detonationSoundPlayedRef.current = true;
      (window as any).audioSystem?.playAftershockSound?.(position);
    }

    materials.pillar.opacity = pillarScale > 0.01 ? 0.92 * (1 - detonationT * 0.82) : 0;
    materials.pillarOuter.opacity = pillarScale > 0.01 ? 0.42 * (1 - detonationT * 0.88) : 0;
    materials.shockwave.opacity = shockwaveT > 0.01 ? 0.72 * Math.pow(1 - shockwaveT, 1.4) : 0;
    materials.blastCore.opacity = pillarScale > 0.01 ? 0.72 * Math.pow(1 - detonationT, 1.25) : 0;
    materials.spark.opacity = sparkT > 0.01 ? 0.78 * Math.pow(1 - sparkT, 1.1) : 0;

    const pillarH = PILLAR_MAX_HEIGHT * pillarScale;

    if (shockwaveRef.current) {
      const shockScale = 0.4 + shockwaveT * 2.45;
      shockwaveRef.current.scale.set(shockScale, shockScale, shockScale);
    }
    if (blastCoreRef.current) {
      const coreScale = 0.35 + pillarScale * 1.25;
      blastCoreRef.current.scale.set(coreScale, 1, coreScale);
    }

    for (let i = 0; i < PILLAR_COUNT; i++) {
      const grp = pillarGroupRefs.current[i];
      const light = pillarLightRefs.current[i];
      const burst = pillarBursts[i];
      if (grp) {
        const widthScale = burst.radius + pillarScale * 0.72;
        grp.scale.set(widthScale, Math.max(0.001, pillarH * burst.height), widthScale);
      }
      if (light) {
        light.intensity = pillarScale > 0.02 ? 34 * pillarScale * (1 - detonationT * 0.62) : 0;
      }
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      const grp = sparkGroupRefs.current[i];
      const burst = sparkBursts[i];
      if (!grp) continue;
      const lift = Math.sin(sparkT * Math.PI) * burst.height;
      const spread = sparkT * (0.32 + (i % 5) * 0.05);
      grp.position.set(
        burst.x + Math.sin(burst.rotationY) * spread,
        lift,
        burst.z + Math.cos(burst.rotationY) * spread,
      );
      grp.scale.setScalar(sparkT > 0.01 ? 0.65 + sparkT * 0.8 : 0.001);
    }

    if (elapsedMs >= TOTAL_MS) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={stripRef}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={geometries.ground}
          material={materials.ground}
        />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          geometry={geometries.ember}
          material={materials.ember}
        />
        {[-1, 1].map(side => (
          <mesh
            key={`edge-${side}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[side * stripWidth * 0.5, 0.018, 0]}
            geometry={geometries.edge}
            material={materials.edge}
          />
        ))}
        {crackSegments.map((segment, i) => (
          <mesh
            key={`crack-${i}`}
            rotation={[-Math.PI / 2, 0, segment.rotation]}
            position={[segment.x, 0.028, segment.z - AFTERSHOCK_STRIP_LENGTH * 0.5]}
            scale={[segment.scaleX, segment.scaleY, 1]}
            geometry={geometries.fissure}
            material={materials.fissure}
          />
        ))}
      </group>

      <mesh
        ref={shockwaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.045, AFTERSHOCK_STRIP_LENGTH * 0.5]}
        geometry={geometries.shockwave}
        material={materials.shockwave}
        scale={[0.001, 0.001, 0.001]}
      />

      <mesh
        ref={blastCoreRef}
        position={[0, 0.04, AFTERSHOCK_STRIP_LENGTH * 0.5]}
        geometry={geometries.blastCore}
        material={materials.blastCore}
        scale={[0.001, 1, 0.001]}
      />

      {pillarBursts.map((burst, i) => (
        <group key={`pill-${i}`} position={[burst.x, 0, burst.z]}>
          <group
            ref={(el) => {
              pillarGroupRefs.current[i] = el;
            }}
            scale={[1, 0.001, 1]}
          >
            <mesh
              geometry={geometries.pillar}
              material={materials.pillarOuter}
              position={[0, 0.5, 0]}
              scale={[1.9, 1, 1.9]}
            />
            <mesh
              geometry={geometries.pillar}
              material={materials.pillar}
              position={[0, 0.5, 0]}
            />
          </group>
          <pointLight
            ref={(el) => {
              pillarLightRefs.current[i] = el;
            }}
            color="#66FF33"
            intensity={0}
            distance={7}
            decay={2}
            position={[0, 1.1, 0]}
          />
        </group>
      ))}

      {sparkBursts.map((spark, i) => (
        <group
          key={`spark-${i}`}
          ref={(el) => {
            sparkGroupRefs.current[i] = el;
          }}
          position={[spark.x, 0, spark.z]}
          rotation={[spark.lean, spark.rotationY, 0]}
          scale={[0.001, 0.001, 0.001]}
        >
          <mesh
            geometry={geometries.spark}
            material={materials.spark}
            position={[0, 0.36, 0]}
          />
        </group>
      ))}
    </group>
  );
}
