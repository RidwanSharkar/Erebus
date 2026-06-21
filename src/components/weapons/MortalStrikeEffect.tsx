'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  MeshStandardMaterial,
  MeshBasicMaterial,
  TorusGeometry,
  SphereGeometry,
  Color,
  AdditiveBlending,
  BufferGeometry,
  BufferAttribute,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { getMortalStrikeColorPalette } from '@/utils/mortalStrikeColorThemes';
import { useMortalStrikeAnimation } from './useMortalStrikeAnimation';

interface MortalStrikeEffectProps {
  position: Vector3;
  direction: Vector3;
  theme?: string;
  onComplete: () => void;
}

const PARTICLE_COUNT = 12;
/** ~70% of a full circle (extends past a half-circle sweep). */
const ARC_SPAN = Math.PI * 1.4;

/** Flat arc sector in XZ plane, centered on +Z (matches CrescentSlashEffect). */
function buildArcSectorGeometry(
  innerRadius: number,
  outerRadius: number,
  spanRadians: number,
  segments: number,
): BufferGeometry {
  const geo = new BufferGeometry();
  const half = spanRadians / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = -half + (i / segments) * spanRadians;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(sin * innerRadius, 0, cos * innerRadius);
    positions.push(sin * outerRadius, 0, cos * outerRadius);
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

function flattenDirection(direction: Vector3): Vector3 {
  const flat = direction.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-8) return new Vector3(0, 0, -1);
  return flat.normalize();
}

export default function MortalStrikeEffect({
  position,
  direction,
  theme,
  onComplete,
}: MortalStrikeEffectProps) {
  const contentRef = useRef<Group>(null);
  const doneRef = useRef(false);

  const palette = useMemo(() => getMortalStrikeColorPalette(theme), [theme]);

  // Yaw on parent Y — same convention as CrescentSlashEffect (arc geometry faces +Z)
  const yaw = useMemo(() => {
    const flat = flattenDirection(direction);
    return Math.atan2(flat.x, flat.z);
  }, [direction.x, direction.y, direction.z]);

  const geometries = useMemo(
    () => ({
      mainArc: new TorusGeometry(3, 0.8, 8, 32, ARC_SPAN),
      innerGlow: new TorusGeometry(3, 0.4, 16, 32, ARC_SPAN),
      outerGlow: new TorusGeometry(2, 0.9, 16, 32, ARC_SPAN),
      particle: new SphereGeometry(0.15, 8, 8),
      arcSector: buildArcSectorGeometry(0.4, 4.2, ARC_SPAN, 28),
    }),
    [],
  );

  const materials = useMemo(() => {
    const mainColor = new Color(palette.main);
    const emissiveColor = new Color(palette.emissive);
    const innerColor = new Color(palette.inner);
    const outerColor = new Color(palette.outer);
    const particleColor = new Color(palette.particle);
    const flashColor = new Color(palette.flash);

    return {
      mainFlame: new MeshStandardMaterial({
        color: mainColor,
        emissive: emissiveColor,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.9,
      }),
      innerGlow: new MeshStandardMaterial({
        color: innerColor,
        emissive: emissiveColor,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.7,
      }),
      outerGlow: new MeshStandardMaterial({
        color: outerColor,
        emissive: emissiveColor,
        emissiveIntensity: 1.3,
        transparent: true,
        opacity: 0.5,
      }),
      particle: new MeshStandardMaterial({
        color: particleColor,
        emissive: emissiveColor,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.6,
      }),
      arcFill: new MeshBasicMaterial({
        color: mainColor,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
      flash: new MeshBasicMaterial({
        color: flashColor,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    };
  }, [palette]);

  const particlePositions = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const half = ARC_SPAN / 2;
        const angle =
          PARTICLE_COUNT <= 1
            ? 0
            : -half + (i / (PARTICLE_COUNT - 1)) * ARC_SPAN;
        return {
          position: new Vector3(
            Math.cos(angle) * 1.5,
            Math.sin(angle) * 1.5,
            0,
          ),
        };
      }),
    [],
  );

  const strikeLight = useDynamicLight({
    color: palette.light,
    distance: 12,
    decay: 6,
    priority: 1,
  });

  const { reset, tick, anchorY } = useMortalStrikeAnimation({
    contentRef,
    position,
    direction,
  });

  useEffect(() => {
    reset();
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometries, materials, reset]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    const { finished, t } = tick(delta);
    const arcFade =
      t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.12) / 0.3);

    materials.mainFlame.opacity = Math.max(0, arcFade * 0.9);
    materials.innerGlow.opacity = Math.max(0, arcFade * 0.7);
    materials.outerGlow.opacity = Math.max(0, arcFade * 0.5);
    materials.particle.opacity = Math.max(0, arcFade * 0.6);
    materials.arcFill.opacity = Math.max(0, arcFade * 0.55);

    const flashFade = t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.18);
    materials.flash.opacity = Math.max(0, flashFade * 0.7);

    const lightZ = contentRef.current?.position.z ?? 0;
    const flat = flattenDirection(direction);
    strikeLight.current?.setPosition(
      position.x + lightZ * flat.x,
      anchorY,
      position.z + lightZ * flat.z,
    );
    strikeLight.current?.setIntensity(14 * arcFade);

    if (finished) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group
      position={[position.x, anchorY, position.z]}
      rotation={[0, yaw, 0]}
      scale={0.5}
    >
      <group ref={contentRef}>
        {/* Torus arcs (~70% sweep): lay flat in XZ, open toward local +Z */}
        <group rotation={[Math.PI / 2, Math.PI, 0]} position={[0, 0.05, 1.2]}>
          <mesh geometry={geometries.mainArc} material={materials.mainFlame} />
          <mesh geometry={geometries.innerGlow} material={materials.innerGlow} />
          <mesh geometry={geometries.outerGlow} material={materials.outerGlow} />

          {particlePositions.map((props, i) => (
            <mesh
              key={i}
              position={props.position}
              geometry={geometries.particle}
              material={materials.particle}
            />
          ))}
        </group>

        <mesh geometry={geometries.arcSector} material={materials.arcFill} position={[0, 0.04, 1.4]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.9]}>
          <circleGeometry args={[0.65, 16]} />
          <primitive object={materials.flash} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
