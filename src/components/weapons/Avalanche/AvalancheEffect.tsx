'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';

const PARTICLE_COUNT = 40;
const ANCHOR_Y_OFFSET = 2.4;
const GRAVITY = 8;

const sharedIcosahedronGeometry = new IcosahedronGeometry(1, 0);
let avalancheGeometryUsers = 0;

const COLOR_FROST = new Color('#E5F7FF');
const dummy = new Object3D();

type ParticleState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  active: boolean;
};

function initParticle(p: ParticleState): void {
  p.x = (Math.random() - 0.5) * 1.65;
  p.y = 1.5 + Math.random() * 2;
  p.z = (Math.random() - 0.5) * 2;
  p.vx = (Math.random() - 0.5) * 3;
  p.vy = -Math.random() * 5 - 3;
  p.vz = (Math.random() - 0.5) * 3;
  p.scale = Math.random() * 0.1 + 0.02;
  p.rotation = Math.random() * Math.PI;
  p.rotationSpeed = (Math.random() - 0.5) * 5;
  p.life = 0.8 + Math.random() * 0.6;
  p.maxLife = p.life;
  p.active = true;
}

/**
 * Falling frost avalanche VFX — InstancedMesh, ref-driven (no per-frame React state).
 * Rains while mounted; AvalancheEffectManager owns debuff duration / unmount.
 */
export default function AvalancheEffect() {
  const meshRef = useRef<InstancedMesh>(null);
  const particlesRef = useRef<ParticleState[]>([]);
  const spawnAccumRef = useRef(0);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: COLOR_FROST,
        emissive: COLOR_FROST,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    avalancheGeometryUsers += 1;
    return () => {
      avalancheGeometryUsers = Math.max(0, avalancheGeometryUsers - 1);
    };
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const p: ParticleState = {
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0.05,
        rotation: 0,
        rotationSpeed: 0,
        life: 0,
        maxLife: 1,
        active: false,
      };
      initParticle(p);
      return p;
    });
    spawnAccumRef.current = 0;

    if (meshRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const particles = particlesRef.current;
    let activeCount = 0;
    let lifeSum = 0;

    spawnAccumRef.current += delta;
    while (spawnAccumRef.current >= 0.08) {
      spawnAccumRef.current -= 0.08;
      for (let i = 0; i < particles.length; i++) {
        if (!particles[i].active) {
          initParticle(particles[i]);
          break;
        }
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      if (!p.active) {
        dummy.scale.set(0, 0, 0);
        dummy.position.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.vy -= GRAVITY * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.rotation += p.rotationSpeed * delta;
      p.life -= delta;

      if (p.life <= 0 || p.y < -0.5) {
        initParticle(p);
      }

      activeCount += 1;
      lifeSum += p.life / p.maxLife;

      const fade = Math.max(0, p.life / p.maxLife);
      const s = p.scale * (0.7 + fade * 0.3);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotation, p.rotation, p.rotation);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (activeCount > 0) {
      material.opacity = (lifeSum / activeCount) * 0.45;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[sharedIcosahedronGeometry, material, PARTICLE_COUNT]}
      position={[0, ANCHOR_Y_OFFSET, 0]}
      frustumCulled={false}
    />
  );
}
