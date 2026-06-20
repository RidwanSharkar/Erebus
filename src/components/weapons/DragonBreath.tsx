'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShapeGeometry } from 'three';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  CylinderGeometry,
  RingGeometry,
  Shape,
  Vector3,
} from '@/utils/three-exports';
import {
  AFTERSHOCK_DETONATION_DELAY_MS,
  AFTERSHOCK_ERUPTION_WAVE_MS,
  AFTERSHOCK_STRIP_CORNER_RADIUS,
  AFTERSHOCK_STRIP_HALF_WIDTH,
  AFTERSHOCK_STRIP_LENGTH,
} from '@/utils/talents';
import { getAftershockColorPalette } from '@/utils/aftershockColorThemes';
import type { WraithStrikeImpactTalentProps } from '@/components/weapons/RunebladeWraithStrikeImpact';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const _tmpVec = new Vector3();

interface DragonBreathProps extends WraithStrikeImpactTalentProps {
  position: Vector3;
  direction: Vector3;
  startTime: number;
  onComplete: () => void;
}

const GROUND_Y = 0.04;
const PILLAR_COUNT = 15;
const CRACK_COUNT = 8;
const SPARK_COUNT = 14;
const PILLAR_RADIUS = 0.18;
const PILLAR_MAX_HEIGHT = 2.1;
const STRIP_FADE_MS = 350;
const DETONATION_RISE_MS = 420;
const TOTAL_MS =
  AFTERSHOCK_DETONATION_DELAY_MS +
  AFTERSHOCK_ERUPTION_WAVE_MS +
  STRIP_FADE_MS +
  0;

function createRoundedStripGeometry(width: number, length: number, cornerRadius: number) {
  const hw = width * 0.5;
  const hl = length * 0.5;
  const r = Math.min(cornerRadius, hw, hl);
  const shape = new Shape();
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
  shape.lineTo(hw, hl - r);
  shape.quadraticCurveTo(hw, hl, hw - r, hl);
  shape.lineTo(-hw + r, hl);
  shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
  shape.lineTo(-hw, -hl + r);
  shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
  return new ShapeGeometry(shape);
}

function eruptionProgress(localDetMs: number, riseMs: number): number {
  if (localDetMs <= 0) return 0;
  return Math.min(1, Math.pow(localDetMs / riseMs, 0.52));
}

export default function DragonBreath({
  position,
  direction,
  startTime,
  onComplete,
  wrathfulStrike = false,
  infestedStrike = false,
  wraithGuard = false,
  staggeringStrike = false,
}: DragonBreathProps) {
  const rootRef = useRef<Group>(null);
  const stripRef = useRef<Group>(null);
  const completedRef = useRef(false);
  const detonationSoundPlayedRef = useRef(false);

  const pillarGroupRefs = useRef<(Group | null)[]>(Array(PILLAR_COUNT).fill(null));
  const shockwaveRef = useRef<Mesh>(null);
  const blastCoreRef = useRef<Mesh>(null);
  const sparkGroupRefs = useRef<(Group | null)[]>(Array(SPARK_COUNT).fill(null));

  const palette = useMemo(
    () =>
      getAftershockColorPalette({
        wrathfulStrike: !!wrathfulStrike,
        infestedStrike: !!infestedStrike,
        wraithGuard: !!wraithGuard,
        staggeringStrike: !!staggeringStrike,
      }),
    [wrathfulStrike, infestedStrike, wraithGuard, staggeringStrike],
  );

  const blastLight = useDynamicLight({
    color: palette.light,
    distance: 7,
    decay: 2,
    priority: 1,
  });

  const stripWidth = AFTERSHOCK_STRIP_HALF_WIDTH * 2;

  const geometries = useMemo(
    () => ({
      ground: createRoundedStripGeometry(
        stripWidth,
        AFTERSHOCK_STRIP_LENGTH,
        AFTERSHOCK_STRIP_CORNER_RADIUS,
      ),
      ember: createRoundedStripGeometry(
        stripWidth * 0.92,
        AFTERSHOCK_STRIP_LENGTH * 0.96,
        AFTERSHOCK_STRIP_CORNER_RADIUS * 0.92,
      ),
      fissure: createRoundedStripGeometry(
        stripWidth * 0.16,
        AFTERSHOCK_STRIP_LENGTH * 0.18,
        AFTERSHOCK_STRIP_CORNER_RADIUS * 0.35,
      ),
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
        color: new Color(palette.ground),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      ember: new MeshBasicMaterial({
        color: new Color(palette.ember),
        transparent: true,
        opacity: 0.42,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      fissure: new MeshBasicMaterial({
        color: new Color(palette.fissure),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pillar: new MeshBasicMaterial({
        color: new Color(palette.pillar),
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pillarOuter: new MeshBasicMaterial({
        color: new Color(palette.pillarOuter),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      shockwave: new MeshBasicMaterial({
        color: new Color(palette.shockwave),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      blastCore: new MeshBasicMaterial({
        color: new Color(palette.blastCore),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      spark: new MeshBasicMaterial({
        color: new Color(palette.spark),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [palette],
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
    blastLight.current?.setColor(palette.light);
  }, [palette.light, blastLight]);

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

    if (stripRef.current) {
      stripRef.current.position.set(0, 0, AFTERSHOCK_STRIP_LENGTH * 0.5);
    }

    const telegraphEnd = AFTERSHOCK_DETONATION_DELAY_MS;
    const telegraphFade = Math.max(0, 1 - Math.max(0, elapsedMs - telegraphEnd) / STRIP_FADE_MS);
    const pulse = 0.78 + Math.sin(t * 14) * 0.12;
    materials.ground.opacity = 0.35 * pulse * telegraphFade;
    materials.ember.opacity = 0.38 * pulse * telegraphFade;

    const rawDet = elapsedMs - telegraphEnd;

    if (rawDet >= 0 && !detonationSoundPlayedRef.current) {
      detonationSoundPlayedRef.current = true;
      (window as any).audioSystem?.playAftershockSound?.(position);
    }

    let maxPillarScale = 0;
    let maxDetonationT = 0;
    let maxSparkT = 0;

    for (let i = 0; i < PILLAR_COUNT; i++) {
      const burst = pillarBursts[i];
      const pillarDelay = (burst.z / AFTERSHOCK_STRIP_LENGTH) * AFTERSHOCK_ERUPTION_WAVE_MS;
      const localDet = rawDet - pillarDelay;
      const detonationT = eruptionProgress(localDet, DETONATION_RISE_MS);
      const pillarScale = detonationT;
      maxPillarScale = Math.max(maxPillarScale, pillarScale);
      maxDetonationT = Math.max(maxDetonationT, detonationT);

      const grp = pillarGroupRefs.current[i];
      if (grp) {
        const widthScale = burst.radius + pillarScale * 0.72;
        const pillarH = PILLAR_MAX_HEIGHT * pillarScale;
        grp.scale.set(widthScale, Math.max(0.001, pillarH * burst.height), widthScale);
      }
    }

    materials.pillar.opacity =
      maxPillarScale > 0.01 ? 0.92 * (1 - maxDetonationT * 0.82) : 0;
    materials.pillarOuter.opacity =
      maxPillarScale > 0.01 ? 0.42 * (1 - maxDetonationT * 0.88) : 0;

    const shockwaveDelay = AFTERSHOCK_ERUPTION_WAVE_MS * 0.35;
    const shockwaveLocalDet = rawDet - shockwaveDelay;
    const shockwaveT =
      shockwaveLocalDet <= 0 ? 0 : Math.min(1, shockwaveLocalDet / 520);
    materials.shockwave.opacity =
      shockwaveT > 0.01 ? 0.72 * Math.pow(1 - shockwaveT, 1.4) : 0;
    materials.blastCore.opacity =
      maxPillarScale > 0.01 ? 0.72 * Math.pow(1 - maxDetonationT, 1.25) : 0;

    if (shockwaveRef.current) {
      const shockScale = 0.4 + shockwaveT * 2.45;
      shockwaveRef.current.scale.set(shockScale, shockScale, shockScale);
    }
    if (blastCoreRef.current) {
      const coreScale = 0.35 + maxPillarScale * 1.25;
      blastCoreRef.current.scale.set(coreScale, 1, coreScale);
    }

    if (blastCoreRef.current) {
      blastCoreRef.current.getWorldPosition(_tmpVec);
      blastLight.current?.setPosition(_tmpVec.x, _tmpVec.y, _tmpVec.z);
    }
    blastLight.current?.setIntensity(
      maxPillarScale > 0.02 ? 34 * maxPillarScale * (1 - maxDetonationT * 0.62) : 0,
    );

    for (let i = 0; i < SPARK_COUNT; i++) {
      const grp = sparkGroupRefs.current[i];
      const burst = sparkBursts[i];
      if (!grp) continue;

      const sparkDelay = (burst.z / AFTERSHOCK_STRIP_LENGTH) * AFTERSHOCK_ERUPTION_WAVE_MS;
      const localDet = rawDet - sparkDelay;
      const sparkT = localDet <= 0 ? 0 : Math.min(1, localDet / 460);
      maxSparkT = Math.max(maxSparkT, sparkT);

      const lift = Math.sin(sparkT * Math.PI) * burst.height;
      const spread = sparkT * (0.32 + (i % 5) * 0.05);
      grp.position.set(
        burst.x + Math.sin(burst.rotationY) * spread,
        lift,
        burst.z + Math.cos(burst.rotationY) * spread,
      );
      grp.scale.setScalar(sparkT > 0.01 ? 0.65 + sparkT * 0.8 : 0.001);
    }

    materials.spark.opacity = maxSparkT > 0.01 ? 0.78 * Math.pow(1 - maxSparkT, 1.1) : 0;

    let maxCrackPulse = 0;
    for (const segment of crackSegments) {
      const crackDelay = (segment.z / AFTERSHOCK_STRIP_LENGTH) * AFTERSHOCK_ERUPTION_WAVE_MS * 0.85;
      const localDet = rawDet - crackDelay;
      if (localDet > 0) {
        maxCrackPulse = Math.max(maxCrackPulse, 0.34 + Math.sin(t * 22 + segment.z) * 0.12);
      }
    }
    materials.fissure.opacity =
      rawDet <= 0
        ? (0.34 + Math.sin(t * 22) * 0.12) * telegraphFade
        : maxCrackPulse * Math.max(0, 1 - maxDetonationT);

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
