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
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  attachLinearTrailOpacityFalloff,
  enableInstancedMaterialFalloff,
} from '@/utils/instancedMaterialFalloff';
import {
  VIPER_STING_CORE_GEO,
  VIPER_STING_RING_GEOS,
  VIPER_STING_SHAFT_GEO,
  VIPER_STING_TIP_GEO,
  VIPER_STING_TRAIL_GLOW_GEO,
  VIPER_STING_TRAIL_SPHERE_GEO,
} from './sharedProjectileGeometry';

interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
}

interface ViperStingProps {
  projectilePool: React.MutableRefObject<ViperStingProjectile[]>;
}

const TRAIL_COUNT = 8;
const _dummy = new Object3D();
const _lookDirScratch = new Vector3();

// Shared geos: same relative opacity curve for every projectile instance.
attachLinearTrailOpacityFalloff(VIPER_STING_TRAIL_SPHERE_GEO, TRAIL_COUNT);
attachLinearTrailOpacityFalloff(VIPER_STING_TRAIL_GLOW_GEO, TRAIL_COUNT);

const ViperStingProjectileVisual: React.FC<{ projectile: ViperStingProjectile }> = ({ projectile }) => {
  const groupRef = useRef<Group>(null);
  const trailMeshRef = useRef<InstancedMesh>(null);
  const glowMeshRef = useRef<InstancedMesh>(null);

  // Borrow a pooled light instead of mounting a <pointLight> (avoids lit-shader recompiles).
  const stingLight = useDynamicLight({ color: '#cc0000', distance: 3.2, decay: 2, priority: 2 });

  const trailMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#cc0000',
          emissive: '#cc0000',
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
          color: '#ff6600',
          emissive: '#ff6600',
          emissiveIntensity: 3,
          transparent: true,
          opacity: 0.3,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );

  // Static local-space trail positions — write once on mount.
  useEffect(() => {
    const writeTrail = (mesh: InstancedMesh | null, scaleMul: number) => {
      if (!mesh) return;
      for (let index = 0; index < TRAIL_COUNT; index++) {
        const trailScale = (1 - (index / TRAIL_COUNT) * 0.5) * scaleMul;
        _dummy.position.set(0, 0, -(index + 1) * 0.6);
        _dummy.scale.setScalar(trailScale);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(index, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    writeTrail(trailMeshRef.current, 1);
    writeTrail(glowMeshRef.current, 1.35);
  }, []);

  useEffect(() => {
    return () => {
      trailMat.dispose();
      glowMat.dispose();
    };
  }, [trailMat, glowMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Update position
    groupRef.current.position.copy(projectile.position);

    // Drive the pooled light at the projectile's world position.
    stingLight.current?.setPosition(
      projectile.position.x,
      projectile.position.y,
      projectile.position.z,
    );
    stingLight.current?.setIntensity(1.6 * projectile.opacity);

    // Calculate rotation based on direction (similar to ThrowSpear)
    const lookDirection = _lookDirScratch.copy(projectile.direction).normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z);
    const rotationX = Math.atan2(-lookDirection.y, Math.sqrt(lookDirection.x * lookDirection.x + lookDirection.z * lookDirection.z));

    // Apply rotation
    groupRef.current.rotation.set(rotationX, rotationY, 0);

    // Base opacity × per-instance (1 - index/N) restores original trailOpacity formula.
    trailMat.opacity = projectile.opacity * 0.6;
    glowMat.opacity = projectile.opacity * 0.3;
  });

  if (!projectile.active) return null;

  return (
    <group ref={groupRef}>
      {/* Main projectile body - sleek venomous arrow */}
      <mesh rotation={[Math.PI / 2, 0, 0]} geometry={VIPER_STING_SHAFT_GEO}>
        <meshStandardMaterial
          color="#ff4400" // Reddish-orange PerfectShot color
          emissive="#cc0000"
          emissiveIntensity={1.2}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Arrowhead */}
      <mesh position={[0, 0, 1]} rotation={[Math.PI / 2, 0, 0]} geometry={VIPER_STING_TIP_GEO}>
        <meshStandardMaterial
          color="#cc0000"
          emissive="#ff4400"
          emissiveIntensity={1.5}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Spinning venom energy rings around the projectile - ThrowSpear style */}
      {[...Array(2)].map((_, i) => (
        <group key={`ring-${i}`} position={[0, 0, 0.22 - i * 0.32] as [number, number, number]}>
          <mesh
            rotation={[0, 0, Date.now() * 0.01 + i * Math.PI / 3]}
            geometry={VIPER_STING_RING_GEOS[i]}
          >
            <meshStandardMaterial
              color="#cc0000" // Dark red
              emissive="#cc0000"
              emissiveIntensity={1.5 + 1}
              transparent
              opacity={projectile.opacity * 0.7}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Venom energy core */}
      <mesh geometry={VIPER_STING_CORE_GEO}>
        <meshStandardMaterial
          color="#ff6600"
          emissive="#cc0000"
          emissiveIntensity={3}
          transparent
          opacity={projectile.opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Venom trail — 2 instanced draw calls instead of 16 meshes */}
      <instancedMesh
        ref={trailMeshRef}
        args={[VIPER_STING_TRAIL_SPHERE_GEO, trailMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glowMeshRef}
        args={[VIPER_STING_TRAIL_GLOW_GEO, glowMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
};

export default function ViperSting({ projectilePool }: ViperStingProps) {
  return (
    <>
      {projectilePool.current
        .filter(projectile => projectile.active)
        .map(projectile => (
          <ViperStingProjectileVisual
            key={`viper-sting-${projectile.id}`}
            projectile={projectile}
          />
        ))}
    </>
  );
}
