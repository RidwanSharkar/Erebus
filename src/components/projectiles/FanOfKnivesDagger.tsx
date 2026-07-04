'use client';

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { AdditiveBlending, BoxGeometry, Euler, Group, MeshBasicMaterial } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { FanOfKnivesDaggerColors } from '@/utils/talents';

export interface FanOfKnivesProjectileView {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  distanceTraveled: number;
  colors: FanOfKnivesDaggerColors;
}

interface FanOfKnivesDaggerProps {
  projectiles: FanOfKnivesProjectileView[];
}

const DAGGER_BOX_GEO = new BoxGeometry(0.07, 0.07, 0.55);
const GLOW_BOX_GEO = new BoxGeometry(0.2, 0.2, 0.7);
const TRAIL_BOX_GEO = new BoxGeometry(0.13, 0.13, 0.9);
const _eulerScratch = new Euler(0, 0, 0, 'YXZ');

function computeFadeOpacity(traveled: number, maxDistance: number): number {
  const fadeStart = Math.max(maxDistance * 0.75, 1e-3);
  const fadeEnd = Math.max(maxDistance, fadeStart + 1e-3);
  const fadeProgress =
    traveled < fadeStart ? 0 : Math.min(1, (traveled - fadeStart) / (fadeEnd - fadeStart));
  return 1 - fadeProgress * fadeProgress;
}

function FanOfKnivesDaggerInstance({ projectile }: { projectile: FanOfKnivesProjectileView }) {
  const projectileRef = useRef(projectile);
  projectileRef.current = projectile;

  const { dagger, glow, trail, light } = projectile.colors;
  const groupRef = useRef<Group>(null);
  const rotGroupRef = useRef<Group>(null);

  const daggerMat = useRef(
    new MeshBasicMaterial({
      color: dagger,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;
  const glowMat = useRef(
    new MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;
  const trailMat = useRef(
    new MeshBasicMaterial({
      color: trail,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;

  daggerMat.color.set(dagger);
  glowMat.color.set(glow);
  trailMat.color.set(trail);

  const daggerLight = useDynamicLight({ color: light, distance: 3.5, decay: 2, priority: 2 });

  useEffect(() => {
    return () => {
      daggerMat.dispose();
      glowMat.dispose();
      trailMat.dispose();
    };
  }, [daggerMat, glowMat, trailMat]);

  useFrame(() => {
    const proj = projectileRef.current;
    const traveled = Math.max(0, proj.startPosition.distanceTo(proj.position));
    const distOpacity = computeFadeOpacity(traveled, proj.maxDistance);

    if (groupRef.current) {
      groupRef.current.position.copy(proj.position);
      groupRef.current.scale.setScalar(1.225);
    }

    const yaw = Math.atan2(proj.direction.x, proj.direction.z);
    const xz = Math.sqrt(proj.direction.x * proj.direction.x + proj.direction.z * proj.direction.z);
    const pitch = Math.atan2(-proj.direction.y, xz || 1e-8);
    _eulerScratch.set(pitch, yaw, 0, 'YXZ');
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.copy(_eulerScratch);
    }

    daggerMat.opacity = 0.95 * distOpacity;
    glowMat.opacity = 0.5 * distOpacity;
    trailMat.opacity = 0.35 * distOpacity;

    daggerLight.current?.setPosition(proj.position.x, proj.position.y, proj.position.z);
    daggerLight.current?.setIntensity(5 * distOpacity);
  });

  return (
    <group ref={groupRef}>
      <group ref={rotGroupRef}>
        <mesh renderOrder={1} geometry={DAGGER_BOX_GEO} material={daggerMat} />
        <mesh renderOrder={2} geometry={GLOW_BOX_GEO} material={glowMat} />
        <mesh renderOrder={1} position={[0, 0, 0.55]} geometry={TRAIL_BOX_GEO} material={trailMat} />
      </group>
    </group>
  );
}

function FanOfKnivesDagger({ projectiles }: FanOfKnivesDaggerProps) {
  return (
    <>
      {projectiles.map((projectile) => (
        <FanOfKnivesDaggerInstance key={projectile.id} projectile={projectile} />
      ))}
    </>
  );
}

export default React.memo(FanOfKnivesDagger);
