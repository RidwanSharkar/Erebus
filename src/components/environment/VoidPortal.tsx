'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { Mesh, MeshBasicMaterial, Points as PointsType, ShaderMaterial as ShaderMaterialType } from 'three';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  createVoidDragSystem,
  createVoidMawMaterial,
  createVoidRimGlowMaterial,
  type VoidEffectPalette,
} from '@/utils/voidMawEffects';

export const VOID_PORTAL_RADIUS = 2.5;
export const VOID_PORTAL_INTERACT_RADIUS = 3.3;
export const VOID_PORTAL_SMALL_RADIUS = 1.75;

/** Interact disk scales with visual radius so smaller portals don't overlap. */
export function voidPortalInteractRadius(visualRadius: number = VOID_PORTAL_RADIUS): number {
  return visualRadius * (VOID_PORTAL_INTERACT_RADIUS / VOID_PORTAL_RADIUS);
}

export type VoidPortalScheme = 'void' | 'boss' | 'sunken' | 'eternity' | 'finale' | 'dungeon' | 'sky_temple';

const VOID_PORTAL_SCHEMES: Record<
  VoidPortalScheme,
  VoidEffectPalette & {
    rim: string;
    light: string;
  }
> = {
  void: {
    energyDim: [0.22, 0.12, 0.32],
    energyBright: [0.694, 0.545, 1.0],
    rim: '#9B6FE8',
    light: '#B18BFF',
    particleDim: [0.22, 0.12, 0.32],
    particleBright: [0.694, 0.545, 1.0],
  },
  boss: {
    energyDim: [0.18, 0.0, 0.02],
    energyBright: [1.0, 0.16, 0.16],
    rim: '#ef4444',
    light: '#dc2626',
    particleDim: [0.15, 0.0, 0.02],
    particleBright: [1.0, 0.1, 0.1],
  },
  sunken: {
    energyDim: [0.0, 0.04, 0.18],
    energyBright: [0.1, 0.55, 1.0],
    rim: '#3b82f6',
    light: '#3b82f6',
    particleDim: [0.0, 0.04, 0.22],
    particleBright: [0.03, 0.75, 1.0],
  },
  dungeon: {
    energyDim: [0.0, 0.12, 0.04],
    energyBright: [0.2, 0.95, 0.35],
    rim: '#22c55e',
    light: '#22c55e',
    particleDim: [0.0, 0.14, 0.05],
    particleBright: [0.18, 1.0, 0.4],
  },
  sky_temple: {
    energyDim: [0.18, 0.06, 0.0],
    energyBright: [1.0, 0.45, 0.08],
    rim: '#f97316',
    light: '#ea580c',
    particleDim: [0.2, 0.05, 0.0],
    particleBright: [1.0, 0.55, 0.12],
  },
  eternity: {
    energyDim: [0.18, 0.06, 0.0],
    energyBright: [1.0, 0.45, 0.08],
    rim: '#f97316',
    light: '#ea580c',
    particleDim: [0.2, 0.05, 0.0],
    particleBright: [1.0, 0.55, 0.12],
  },
  finale: {
    energyDim: [0.18, 0.12, 0.0],
    energyBright: [1.0, 0.85, 0.15],
    rim: '#eab308',
    light: '#eab308',
    particleDim: [0.2, 0.14, 0.0],
    particleBright: [1.0, 0.9, 0.25],
  },
};

interface VoidPortalProps {
  position?: [number, number, number];
  /** 0 = closed/hidden, 1 = fully open */
  open?: number;
  visible?: boolean;
  /** Raises particle spawn band and point light (throne room tile height). */
  effectHeightOffset?: number;
  scheme?: VoidPortalScheme;
  /** Visual maw radius. Default matches the original 2.5 throne void. */
  radius?: number;
  /** Falling-mote count. Defaults to VOID_DRAG_PARTICLE_COUNT (36). */
  particleCount?: number;
  /** Max spawn height of falling motes. Defaults to the original ~3.2 band. */
  particleStartHeightMax?: number;
}

export default function VoidPortal({
  position = [0, 0.25, 0],
  open = 1,
  visible = true,
  effectHeightOffset = 0,
  scheme = 'void',
  radius = VOID_PORTAL_RADIUS,
  particleCount,
  particleStartHeightMax,
}: VoidPortalProps) {
  const matRef = useRef<ShaderMaterialType>(null);
  const rimGlowRef = useRef<ShaderMaterialType>(null);
  const ringRef = useRef<Mesh>(null);
  const dragPointsRef = useRef<PointsType>(null);
  const openSfxPlayedRef = useRef(false);
  const prevOpenRef = useRef(0);

  const palette = VOID_PORTAL_SCHEMES[scheme];

  const mawMaterial = useMemo(
    () => createVoidMawMaterial(palette),
    [palette.energyBright, palette.energyDim],
  );

  const rimGlowMaterial = useMemo(
    () => createVoidRimGlowMaterial(palette),
    [palette.energyBright],
  );

  const portalLight = useDynamicLight({ color: palette.light, distance: 12, decay: 2, priority: 1 });

  const { dragGeo, dragMat } = useMemo(
    () =>
      createVoidDragSystem(radius, palette, {
        open,
        effectHeightOffset,
        count: particleCount,
        startHeightMax: particleStartHeightMax,
      }),
    [palette.particleBright, palette.particleDim, radius, particleCount, particleStartHeightMax],
  );

  useEffect(() => {
    mawMaterial.uniforms.uEnergyDim.value = palette.energyDim;
    mawMaterial.uniforms.uEnergyBright.value = palette.energyBright;
    rimGlowMaterial.uniforms.uEnergyBright.value = palette.energyBright;
    dragMat.uniforms.uParticleDim.value = palette.particleDim;
    dragMat.uniforms.uParticleBright.value = palette.particleBright;
    portalLight.current?.setColor(palette.light);
  }, [palette, mawMaterial, rimGlowMaterial, dragMat, portalLight]);

  useEffect(() => {
    dragMat.uniforms.uEffectHeightOffset.value = effectHeightOffset;
  }, [effectHeightOffset, dragMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.elapsedTime;

    if (open <= 0.01) {
      openSfxPlayedRef.current = false;
    } else if (
      open > 0.05 &&
      prevOpenRef.current <= 0.05 &&
      !openSfxPlayedRef.current
    ) {
      openSfxPlayedRef.current = true;
      (window as Window & { audioSystem?: { playVoidPortalOpenSound?: () => void } }).audioSystem
        ?.playVoidPortalOpenSound?.();
    }
    prevOpenRef.current = open;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uOpen.value = open;
    }
    if (rimGlowRef.current) {
      rimGlowRef.current.uniforms.uTime.value = t;
      rimGlowRef.current.uniforms.uOpen.value = open;
    }
    dragMat.uniforms.uTime.value = t;
    dragMat.uniforms.uOpen.value = open;
    dragMat.uniforms.uPortalRadius.value = radius;
    const light = portalLight.current;
    if (light?.active) {
      light.setPosition(position[0], position[1] + 0.35 + effectHeightOffset, position[2]);
      light.setIntensity(2.2 * open);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.45;
      ringRef.current.scale.setScalar(0.82 + open * 0.18);
      const ringMat = ringRef.current.material as MeshBasicMaterial;
      ringMat.opacity = 0.5 * open;
    }
  });

  useEffect(() => {
    return () => {
      mawMaterial.dispose();
      rimGlowMaterial.dispose();
      dragGeo.dispose();
      dragMat.dispose();
    };
  }, [mawMaterial, rimGlowMaterial, dragGeo, dragMat]);

  if (!visible && open <= 0.01) return null;

  const groupPosition: [number, number, number] = [
    position[0],
    position[1] + 0.35,
    position[2],
  ];

  return (
    <group position={groupPosition}>
      <mesh key={`maw-${radius}`} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[radius, 48]} />
        <primitive ref={matRef} object={mawMaterial} attach="material" />
      </mesh>
      <mesh key={`rim-${radius}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} renderOrder={2}>
        <circleGeometry args={[radius, 48]} />
        <primitive ref={rimGlowRef} object={rimGlowMaterial} attach="material" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} renderOrder={3}>
        <ringGeometry args={[radius * 0.9, radius * 1.1, 48]} />
        <meshBasicMaterial
          color={palette.rim}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <points ref={dragPointsRef} geometry={dragGeo} material={dragMat} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
