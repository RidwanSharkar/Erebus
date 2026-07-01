'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Vector3, Group, CylinderGeometry, TorusGeometry, BoxGeometry } from '@/utils/three-exports';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

type SoulType = 'green' | 'red' | 'blue' | 'purple';

// Mirror Boss3GreenBeam's height/pitch exactly — Titan and Boss3 are the same scale in-game.
const BEAM_ORIGIN_Y = 2.8;
const BEAM_AXIS_Y = 2.65;
const BEAM_PITCH_RAD = (10 * Math.PI) / 180;
const BEAM_START_OFFSET = 0.65;
const BEAM_RANGE = 25;

const BEAM_SEGMENT_LENGTH = BEAM_RANGE - BEAM_START_OFFSET;
const BEAM_AXIS_MID_Z = (BEAM_START_OFFSET + BEAM_RANGE) / 2;

// Wide single-burst — much thicker than Boss3's 0.52 half-width
const BEAM_BASE_RADIUS = 1.5;

// Quick burst timing (ms)
const FLASH_IN_MS = 60;
const HOLD_MS = 150;
const FADE_OUT_MS = 300;
const TOTAL_MS = FLASH_IN_MS + HOLD_MS + FADE_OUT_MS;

// Muzzle flash rings at the beam origin
const MUZZLE_RING_COUNT = 5;

const SOUL_COLORS: Record<SoulType, { core: string; emissive: string; light: string }> = {
  green:  { core: '#00ff88', emissive: '#00aa44', light: '#00ff66' },
  red:    { core: '#ff3344', emissive: '#cc1122', light: '#ff2233' },
  blue:   { core: '#44aaff', emissive: '#2266dd', light: '#3399ff' },
  purple: { core: '#cc44ff', emissive: '#8811cc', light: '#bb33ff' },
};

function createCannonCylinderMaterials(soulType: SoulType) {
  const c = SOUL_COLORS[soulType];
  const base = new Color(c.core);
  return {
    core:     createBeamCylinderAdditiveMaterial(base.clone(), 0.95, 0.35),
    inner:    createBeamCylinderAdditiveMaterial(base.clone(), 0.82, 0.28),
    outer:    createBeamCylinderAdditiveMaterial(base.clone(), 0.68, 0.22),
    outermost:createBeamCylinderAdditiveMaterial(base.clone(), 0.54, 0.18),
  };
}

interface TitanCannonBeamProps {
  /** World-space position of the titan (beam origin computed internally with offset). */
  position: Vector3;
  /** Titan's Y rotation (radians) — beam fires along Math.sin/cos of this. */
  rotation: number;
  soulType: SoulType;
  onComplete: () => void;
}

const _lightWorldPos = new Vector3();

export default function TitanCannonBeam({ position, rotation, soulType, onComplete }: TitanCannonBeamProps) {
  const beamRef = useRef<Group>(null);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

  const colors = SOUL_COLORS[soulType];

  const cylinderMaterials = useMemo(() => createCannonCylinderMaterials(soulType), [soulType]);

  useEffect(() => {
    const m = cylinderMaterials;
    return () => {
      m.core.dispose();
      m.inner.dispose();
      m.outer.dispose();
      m.outermost.dispose();
    };
  }, [cylinderMaterials]);

  const beamGeometries = useMemo(() => ({
    core:     new CylinderGeometry(BEAM_BASE_RADIUS * 0.18, BEAM_BASE_RADIUS * 0.24, BEAM_SEGMENT_LENGTH, 20),
    inner:    new CylinderGeometry(BEAM_BASE_RADIUS * 0.44, BEAM_BASE_RADIUS * 0.52, BEAM_SEGMENT_LENGTH, 20),
    outer:    new CylinderGeometry(BEAM_BASE_RADIUS * 0.74, BEAM_BASE_RADIUS * 0.84, BEAM_SEGMENT_LENGTH, 20),
    outermost:new CylinderGeometry(BEAM_BASE_RADIUS * 0.96, BEAM_BASE_RADIUS * 1.0,  BEAM_SEGMENT_LENGTH, 20),
  }), []);

  useEffect(() => () => {
    beamGeometries.core.dispose();
    beamGeometries.inner.dispose();
    beamGeometries.outer.dispose();
    beamGeometries.outermost.dispose();
  }, [beamGeometries]);

  const ringGeometries = useMemo(
    () => Array.from({ length: MUZZLE_RING_COUNT }, (_, i) =>
      new TorusGeometry(BEAM_BASE_RADIUS * (0.55 + i * 0.28), 0.09 + i * 0.03, 8, 32),
    ),
    [],
  );

  useEffect(() => () => {
    ringGeometries.forEach((g) => g.dispose());
  }, [ringGeometries]);

  const shardGeometry = useMemo(() => new BoxGeometry(0.07, 0.07, 0.18), []);

  useEffect(() => () => {
    shardGeometry.dispose();
  }, [shardGeometry]);

  // Pooled dynamic light at the muzzle
  const beamLight = useDynamicLight({ color: colors.light, distance: 6, priority: 1 });

  // Beam is positioned in world space from CoopGameScene — we just need to set its world transform.
  // We place the group at the titan's XZ, let rotation.y handle facing, and apply pitch internally.

  useFrame(() => {
    if (!beamRef.current || completedRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    let fp: number;
    if (elapsed < FLASH_IN_MS) {
      fp = elapsed / FLASH_IN_MS;
    } else if (elapsed < FLASH_IN_MS + HOLD_MS) {
      fp = 1;
    } else {
      const fadeElapsed = elapsed - FLASH_IN_MS - HOLD_MS;
      fp = Math.max(0, 1 - fadeElapsed / FADE_OUT_MS);
    }

    const bri = fp * 28;

    cylinderMaterials.core.uniforms.uOpacity.value = 0.96 * fp;
    cylinderMaterials.core.uniforms.uBrightnessMul.value = bri;
    cylinderMaterials.core.uniforms.uWhiteMix.value = 0.38;

    cylinderMaterials.inner.uniforms.uOpacity.value = 0.82 * fp;
    cylinderMaterials.inner.uniforms.uBrightnessMul.value = bri * 0.55;
    cylinderMaterials.inner.uniforms.uWhiteMix.value = 0.28;

    cylinderMaterials.outer.uniforms.uOpacity.value = 0.65 * fp;
    cylinderMaterials.outer.uniforms.uBrightnessMul.value = bri * 0.18;
    cylinderMaterials.outer.uniforms.uWhiteMix.value = 0.22;

    cylinderMaterials.outermost.uniforms.uOpacity.value = 0.48 * fp;
    cylinderMaterials.outermost.uniforms.uBrightnessMul.value = bri * 0.08;
    cylinderMaterials.outermost.uniforms.uWhiteMix.value = 0.16;

    beamRef.current.scale.setScalar(fp > 0 ? 1 : 0);

    // Drive light at beam muzzle in world space
    if (beamRef.current) {
      beamRef.current.updateMatrixWorld();
      _lightWorldPos.set(0, BEAM_ORIGIN_Y, BEAM_START_OFFSET);
      beamRef.current.localToWorld(_lightWorldPos);
      beamLight.current?.setColor(colors.light);
      beamLight.current?.setPosition(_lightWorldPos.x, _lightWorldPos.y, _lightWorldPos.z);
      beamLight.current?.setIntensity(22 * fp);
    }

    if (elapsed >= TOTAL_MS && !completedRef.current) {
      completedRef.current = true;
      beamRef.current.scale.setScalar(0);
      onComplete();
    }
  });

  const shardCount = 28;
  const zShardSpan = BEAM_SEGMENT_LENGTH * 0.45;
  const shardLayouts = useMemo(() => {
    const rnd = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
    return Array.from({ length: shardCount }, (_, i) => ({
      x: (rnd(i + 0.3) - 0.5) * BEAM_BASE_RADIUS * 2.2,
      y: (rnd(i + 0.7) - 0.5) * 1.4,
      z: (rnd(i + 1.1) - 0.5) * zShardSpan,
      rx: rnd(i + 1.9) * Math.PI * 2,
      ry: rnd(i + 2.3) * Math.PI * 2,
      rz: rnd(i + 2.7) * Math.PI * 2,
    }));
  }, [zShardSpan]);

  // World transform: position at titan XZ, rotate to face target
  const px = position.x;
  const pz = position.z;

  return (
    <group
      ref={beamRef}
      position={[px, 0, pz]}
      rotation={[0, rotation, 0]}
    >
      {/* Internal pitch matches Boss3GreenBeam exactly */}
      <group rotation={[BEAM_PITCH_RAD, 0, 0]}>
        {/* Muzzle flash — double sphere at beam origin */}
        <group position={[0, BEAM_ORIGIN_Y, BEAM_START_OFFSET]}>
          <mesh>
            <sphereGeometry args={[BEAM_BASE_RADIUS * 0.62, 18, 18]} />
            <meshStandardMaterial
              color={colors.core}
              emissive={colors.emissive}
              emissiveIntensity={3.2}
              transparent
              opacity={0.72}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[BEAM_BASE_RADIUS * 0.92, 18, 18]} />
            <meshStandardMaterial
              color={colors.core}
              emissive={colors.emissive}
              emissiveIntensity={1.2}
              transparent
              opacity={0.48}
            />
          </mesh>

          {/* Muzzle burst rings — expanding outward radially */}
          {ringGeometries.map((geo, i) => (
            <mesh
              key={`muzzle-ring-${i}`}
              geometry={geo}
              rotation={[Math.PI / 2, 0, (i * Math.PI) / MUZZLE_RING_COUNT]}
            >
              <meshStandardMaterial
                color={colors.core}
                emissive={colors.emissive}
                emissiveIntensity={1.8}
                transparent
                opacity={0.55 - i * 0.08}
              />
            </mesh>
          ))}
        </group>

        {/* Beam cylinder stack */}
        <group position={[0, BEAM_AXIS_Y, BEAM_AXIS_MID_Z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.core}      material={cylinderMaterials.core} />
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.inner}     material={cylinderMaterials.inner} />
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.outer}     material={cylinderMaterials.outer} />
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.outermost} material={cylinderMaterials.outermost} />

          {/* Explosive debris shards */}
          {shardLayouts.map((L, i) => (
            <mesh
              key={`cshard-${i}`}
              geometry={shardGeometry}
              position={[L.x, L.y, L.z]}
              rotation={[L.rx, L.ry, L.rz]}
            >
              <meshStandardMaterial
                color={colors.core}
                emissive={colors.emissive}
                emissiveIntensity={2.4}
                transparent
                opacity={0.78}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
