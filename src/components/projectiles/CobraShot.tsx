'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Vector3,
  AdditiveBlending,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from '@/utils/three-exports';
import {
  COBRA_CORE_GEO,
  COBRA_RING_GEOS,
  COBRA_SHAFT_GEO,
  COBRA_TIP_GEO,
  COBRA_TRAIL_GLOW_GEO,
  COBRA_TRAIL_SPHERE_GEO,
} from './sharedProjectileGeometry';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  attachLinearTrailOpacityFalloff,
  enableInstancedMaterialFalloff,
} from '@/utils/instancedMaterialFalloff';

export interface CobraShotProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<number>;
  opacity: number;
  fadeStartTime: number | null;
}

interface CobraShotProps {
  projectilePool: CobraShotProjectile[];
}

const TRAIL_COUNT = 8;
const _dummy = new Object3D();
const _lookDirScratch = new Vector3();

attachLinearTrailOpacityFalloff(COBRA_TRAIL_SPHERE_GEO, TRAIL_COUNT);
attachLinearTrailOpacityFalloff(COBRA_TRAIL_GLOW_GEO, TRAIL_COUNT);

const CobraShotProjectileVisual: React.FC<{ projectile: CobraShotProjectile }> = ({ projectile }) => {
  const groupRef = useRef<Group>(null);
  const trailMeshRef = useRef<InstancedMesh>(null);
  const glowMeshRef = useRef<InstancedMesh>(null);

  // Pooled light follows the projectile (replaces its per-projectile <pointLight>).
  const projectileLight = useDynamicLight({ color: '#00ff40', distance: 4, priority: 2 });

  const trailMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#00aa20',
          emissive: '#00aa20',
          emissiveIntensity: 6,
          transparent: true,
          opacity: 0.6,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );
  const glowMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#00ff60',
          emissive: '#00ff60',
          emissiveIntensity: 3,
          transparent: true,
          opacity: 0.3,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );

  useEffect(() => {
    const writeTrail = (mesh: InstancedMesh | null, scaleMul: number) => {
      if (!mesh) return;
      for (let index = 0; index < TRAIL_COUNT; index++) {
        const trailScale = (1 - (index / TRAIL_COUNT) * 0.5) * scaleMul;
        _dummy.position.set(0, 0, -(index + 1) * 0.8);
        _dummy.scale.setScalar(trailScale);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(index, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    writeTrail(trailMeshRef.current, 1);
    writeTrail(glowMeshRef.current, 1.5);
  }, []);

  useEffect(() => {
    return () => {
      trailMat.dispose();
      glowMat.dispose();
    };
  }, [trailMat, glowMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Update position but keep it at ground level (Y=0)
    groupRef.current.position.set(projectile.position.x, 0, projectile.position.z);

    // Calculate rotation based on direction (only Y rotation to stay parallel to ground)
    const lookDirection = _lookDirScratch.copy(projectile.direction).normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z);

    // Apply rotation - keep X and Z rotation at 0 to stay parallel to ground
    groupRef.current.rotation.set(0, rotationY, 0);

    // Drive the pooled light at the projectile's world position (group sits at Y=0).
    projectileLight.current?.setPosition(projectile.position.x, 0, projectile.position.z);
    projectileLight.current?.setIntensity(2 * projectile.opacity);

    // Base opacity × per-instance (1 - index/N) restores original trailOpacity formula.
    trailMat.opacity = projectile.opacity * 0.6;
    glowMat.opacity = projectile.opacity * 0.3;
  });

  if (!projectile.active) return null;

  return (
    <group ref={groupRef}>
      {/* Main projectile body - sleek cobra arrow */}
      <mesh rotation={[Math.PI / 2, 0, 0]} geometry={COBRA_SHAFT_GEO}>
        <meshStandardMaterial
          color="#00ff40" // Bright green cobra color
          emissive="#00aa20"
          emissiveIntensity={1.2}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Arrowhead */}
      <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]} geometry={COBRA_TIP_GEO}>
        <meshStandardMaterial
          color="#00aa20"
          emissive="#00ff40"
          emissiveIntensity={1.5}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Spinning venom energy rings around the projectile */}
      {[...Array(2)].map((_, i) => (
        <group key={`ring-${i}`} position={[0, 0, 0.3 - i * 0.4] as [number, number, number]}>
          <mesh
            rotation={[0, 0, Date.now() * 0.01 + i * Math.PI / 3]}
            geometry={COBRA_RING_GEOS[i]}
          >
            <meshStandardMaterial
              color="#00aa20" // Medium green
              emissive="#00aa20"
              emissiveIntensity={1.5 + 1}
              transparent
              opacity={projectile.opacity * 0.7}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Cobra energy core */}
      <mesh geometry={COBRA_CORE_GEO}>
        <meshStandardMaterial
          color="#00ff60"
          emissive="#00aa20"
          emissiveIntensity={3}
          transparent
          opacity={projectile.opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Cobra trail — 2 instanced draw calls instead of 16 meshes */}
      <instancedMesh
        ref={trailMeshRef}
        args={[COBRA_TRAIL_SPHERE_GEO, trailMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glowMeshRef}
        args={[COBRA_TRAIL_GLOW_GEO, glowMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
};

export default function CobraShot({ projectilePool }: CobraShotProps) {
  return (
    <>
      {projectilePool
        .filter((projectile) => projectile.active)
        .map((projectile) => (
          <CobraShotProjectileVisual key={projectile.id} projectile={projectile} />
        ))}
    </>
  );
}
