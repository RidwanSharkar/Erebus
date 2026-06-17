'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

/** Enemy Death Grasp travel VFX (server hit/dodge is authoritative). */
interface KnightDeathGraspProjectileProps {
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
  onComplete: () => void;
}

export default function KnightDeathGraspProjectile({
  startPosition,
  endPosition,
  travelMs,
  onComplete,
}: KnightDeathGraspProjectileProps) {
  const impactRef = useRef<Group>(null);
  const returnCoreRef = useRef<Group>(null);
  const chainRef = useRef<Mesh>(null);
  const startCoreRef = useRef<Group>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const endFixedRef = useRef(endPosition.clone());
  const tempStartToReturnRef = useRef(new Vector3());
  const tempMidpointRef = useRef(new Vector3());
  const tempQuaternionRef = useRef(new Quaternion());

  // Two pooled lights at the fixed start/end of the grasp (replaces 2 <pointLight>s).
  const startLight = useDynamicLight({ color: '#6A0DAD', distance: 5, priority: 2 });
  const endLight = useDynamicLight({ color: '#9370DB', distance: 6, priority: 2 });

  const { right, up, particles } = useMemo(() => {
    const path = endPosition.clone().sub(startPosition);
    const pathDistance = Math.max(path.length(), 0.01);
    const normalizedDirection = path.normalize();
    const worldUp = new Vector3(0, 1, 0);
    const side = new Vector3().crossVectors(normalizedDirection, worldUp);
    if (side.lengthSq() < 1e-5) {
      side.set(1, 0, 0);
    } else {
      side.normalize();
    }
    const pathUp = new Vector3().crossVectors(side, normalizedDirection).normalize();
    const segmentCount = Math.max(10, Math.ceil(pathDistance * 5));
    const streamCount = 3;
    const spiralTurns = 3.5;
    const particleData: Array<{
      progress: number;
      streamIndex: number;
      phaseOffset: number;
      baseScale: number;
    }> = [];

    for (let streamIndex = 0; streamIndex < streamCount; streamIndex += 1) {
      const phaseOffset = (streamIndex * Math.PI * 2) / streamCount;
      for (let i = 0; i <= segmentCount; i += 1) {
        const progress = i / segmentCount;
        particleData.push({
          progress,
          streamIndex,
          phaseOffset,
          baseScale: Math.max(0.35, 1.15 - progress * 0.72 + Math.sin(progress * Math.PI * 6) * 0.08),
        });
      }
    }

    return {
      direction: normalizedDirection,
      distance: pathDistance,
      right: side,
      up: pathUp,
      spiralTurns,
      particles: particleData,
    };
  }, [startPosition, endPosition]);

  const geometries = useMemo(
    () => ({
      particle: new SphereGeometry(0.12, 8, 8),
      impact: new SphereGeometry(0.22, 12, 12),
      core: new SphereGeometry(0.18, 10, 10),
    }),
    [],
  );

  const materials = useMemo(
    () =>
      ({
        spiral: [
          new MeshBasicMaterial({
            color: new Color('#6A0DAD'),
            transparent: true,
            opacity: 0.95,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
          new MeshBasicMaterial({
            color: new Color('#9370DB'),
            transparent: true,
            opacity: 0.85,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
          new MeshBasicMaterial({
            color: new Color('#8A2BE2'),
            transparent: true,
            opacity: 0.75,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
        ],
        impact: new MeshBasicMaterial({
          color: new Color('#c4b5fd'),
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
        core: new MeshBasicMaterial({
          color: new Color('#e9d5ff'),
          transparent: true,
          opacity: 0.95,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
        chain: new MeshBasicMaterial({
          color: new Color('#4A0E4E'),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      }),
    [],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    // Drive the pooled lights at the fixed start/end world positions.
    startLight.current?.setPosition(startPosition.x, startPosition.y, startPosition.z);
    startLight.current?.setIntensity(8);
    endLight.current?.setPosition(endFixedRef.current.x, endFixedRef.current.y, endFixedRef.current.z);
    endLight.current?.setIntensity(7);

    if (startTimeRef.current === null) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const progress = Math.min(1, elapsed / Math.max(travelMs, 1));
    const forwardProgress = Math.min(1, progress / 0.82);
    const returnProgress = progress > 0.72 ? Math.min(1, (progress - 0.72) / 0.28) : 0;
    const flicker = 0.82 + Math.sin(elapsed * 0.018) * 0.12 + Math.sin(elapsed * 0.043) * 0.06;
    const streamOpacity = progress < 0.82 ? 1 - progress * 0.18 : Math.max(0, 0.86 * (1 - returnProgress * 0.65));

    materials.spiral.forEach((material, index) => {
      material.opacity = streamOpacity * (0.95 - index * 0.1) * flicker;
    });
    materials.impact.opacity = (0.95 - returnProgress * 0.7) * flicker;
    materials.core.opacity = (0.95 - progress * 0.25) * flicker;
    materials.chain.opacity = returnProgress > 0 ? 0.65 * (1 - returnProgress * 0.35) * flicker : 0;

    particles.forEach((particle, index) => {
      const mesh = particleRefs.current[index];
      if (!mesh) return;

      const revealSlack = 0.04;
      const isVisible = particle.progress <= forwardProgress + revealSlack;
      mesh.visible = isVisible;
      if (!isVisible) return;

      const base = startPosition.clone().lerp(endFixedRef.current, particle.progress);
      const spiralAngle = particle.progress * Math.PI * 2 * 3.5 + particle.phaseOffset + elapsed * 0.014;
      const radius = 0.24 * (1 - particle.progress * 0.35) * (1 - returnProgress * 0.2);
      const collapse = returnProgress * Math.max(0, 1 - particle.progress) * 0.35;
      const twistOffset = right
        .clone()
        .multiplyScalar(Math.cos(spiralAngle) * radius)
        .add(up.clone().multiplyScalar(Math.sin(spiralAngle) * radius));

      base.add(twistOffset).lerp(startPosition, collapse);
      mesh.position.copy(base);

      const pulse = 0.82 + Math.sin(elapsed * 0.018 + particle.progress * 20 + particle.streamIndex) * 0.18;
      const scale = particle.baseScale * pulse * (1 - returnProgress * 0.2);
      mesh.scale.setScalar(scale);
    });

    if (impactRef.current) {
      impactRef.current.visible = progress < 0.98;
      impactRef.current.position.lerpVectors(startPosition, endFixedRef.current, forwardProgress);
      impactRef.current.rotation.y += delta * 6.5;
      impactRef.current.rotation.x += delta * 3.2;
      const impactScale = 1 + Math.sin(elapsed * 0.02) * 0.18;
      impactRef.current.scale.setScalar(impactScale);
    }

    if (returnCoreRef.current) {
      returnCoreRef.current.visible = returnProgress > 0;
      if (returnProgress > 0) {
        returnCoreRef.current.position.lerpVectors(endFixedRef.current, startPosition, returnProgress);
        returnCoreRef.current.rotation.y -= delta * 9;
        returnCoreRef.current.scale.setScalar(1.2 - returnProgress * 0.35);
      }
    }

    if (chainRef.current) {
      chainRef.current.visible = returnProgress > 0;
      if (returnProgress > 0) {
        const returnPos = returnCoreRef.current?.position ?? endFixedRef.current;
        const toStart = tempStartToReturnRef.current.copy(startPosition).sub(returnPos);
        const chainLength = Math.max(toStart.length(), 0.01);
        const midpoint = tempMidpointRef.current.copy(returnPos).add(startPosition).multiplyScalar(0.5);
        chainRef.current.position.copy(midpoint);
        chainRef.current.scale.set(1, chainLength, 1);
        const chainDirection = toStart.normalize();
        chainRef.current.quaternion.copy(
          tempQuaternionRef.current.setFromUnitVectors(new Vector3(0, 1, 0), chainDirection),
        );
      }
    }

    if (startCoreRef.current) {
      startCoreRef.current.rotation.y += delta * 4.5;
      startCoreRef.current.scale.setScalar(1 + Math.sin(elapsed * 0.016) * 0.12);
    }

    if (progress >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group frustumCulled={false}>
      {particles.map((particle, index) => (
        <mesh
          key={`${particle.streamIndex}-${index}`}
          ref={mesh => {
            particleRefs.current[index] = mesh;
          }}
          geometry={geometries.particle}
          material={materials.spiral[particle.streamIndex]}
          visible={false}
          frustumCulled={false}
        />
      ))}

      <group ref={impactRef} position={startPosition.clone()}>
        <mesh material={materials.impact} scale={[1.65, 1.65, 1.65]}>
          <sphereGeometry args={[0.22, 12, 12]} />
        </mesh>
        <mesh material={materials.core} scale={[0.9, 0.9, 0.9]}>
          <sphereGeometry args={[0.2, 10, 10]} />
        </mesh>
      </group>

      <group ref={returnCoreRef} position={endPosition.clone()} visible={false}>
        <mesh geometry={geometries.impact} material={materials.impact} scale={[1.3, 1.3, 1.3]} />
        <mesh geometry={geometries.core} material={materials.core} scale={[0.8, 0.8, 0.8]} />
      </group>

      <mesh ref={chainRef} material={materials.chain} visible={false}>
        <cylinderGeometry args={[0.035, 0.035, 1, 7]} />
      </mesh>

      <group ref={startCoreRef} position={startPosition.clone()}>
        <mesh geometry={geometries.core} material={materials.core} scale={[1.2, 1.2, 1.2]} />
        <mesh geometry={geometries.impact} material={materials.spiral[0]} scale={[1.7, 1.7, 1.7]} />
      </group>

    </group>
  );
}
