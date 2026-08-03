'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  Euler,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface PoisonDartProjectileView {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  distanceTraveled: number;
}

interface PoisonDartProps {
  projectiles: PoisonDartProjectileView[];
}

const DART_GEO = new BoxGeometry(0.08, 0.08, 0.55);
const GLOW_GEO = new BoxGeometry(0.18, 0.18, 0.7);
const TIP_GEO = new SphereGeometry(0.1, 8, 8);
const TRAIL_PARTICLE_GEO = new SphereGeometry(0.09, 6, 6);

const DART_COLOR = '#6ef56e';
const DART_CORE = '#b8ffb0';
const TRAIL_COLOR = '#44ff88';
const TRAIL_EMISSIVE = '#88ffaa';

const MAX_TRAIL_PARTICLES = 48;
const SPAWN_SKIP_CHANCE = 0.12;
const TRAIL_BACK_OFFSET = 0.28;
const TRAIL_Y_BIAS = -0.05;
const RISE_PER_SEC = 0.15;

const _eulerScratch = new Euler(0, 0, 0, 'YXZ');

type TrailSlot = {
  active: boolean;
  bornMs: number;
  lifeSec: number;
  initialScale: number;
  pos: Vector3;
};

function createTrailSlots(): TrailSlot[] {
  const slots: TrailSlot[] = [];
  for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
    slots.push({
      active: false,
      bornMs: 0,
      lifeSec: 1,
      initialScale: 0.4,
      pos: new Vector3(),
    });
  }
  return slots;
}

function computeFadeOpacity(traveled: number, maxDistance: number): number {
  const fadeStart = Math.max(maxDistance * 0.78, 1e-3);
  const fadeEnd = Math.max(maxDistance, fadeStart + 1e-3);
  const fadeProgress =
    traveled < fadeStart ? 0 : Math.min(1, (traveled - fadeStart) / (fadeEnd - fadeStart));
  return 1 - fadeProgress * fadeProgress;
}

function PoisonDartInstance({ projectile }: { projectile: PoisonDartProjectileView }) {
  const projectileRef = useRef(projectile);
  projectileRef.current = projectile;

  const groupRef = useRef<Group>(null);
  const rotGroupRef = useRef<Group>(null);
  const headPosRef = useRef(new Vector3());
  const dirRef = useRef(new Vector3(0, 0, 1));
  const activeRef = useRef(true);

  const dartMat = useRef(
    new MeshBasicMaterial({
      color: DART_CORE,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;
  const glowMat = useRef(
    new MeshBasicMaterial({
      color: DART_COLOR,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;
  const tipMat = useRef(
    new MeshBasicMaterial({
      color: '#d4ffd0',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  ).current;

  const trailMeshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const slotsRef = useRef<TrailSlot[]>(createTrailSlots());
  const lastPosRef = useRef<Vector3 | null>(null);
  const tmpB = useRef(new Vector3());
  const tmpSpawn = useRef(new Vector3());
  const tmpBack = useRef(new Vector3());

  const trailMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: TRAIL_COLOR,
        emissive: TRAIL_EMISSIVE,
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    [],
  );

  const dartLight = useDynamicLight({ color: '#44ff88', distance: 4.5, decay: 2, priority: 2 });

  useEffect(() => {
    return () => {
      dartMat.dispose();
      glowMat.dispose();
      tipMat.dispose();
      trailMaterial.dispose();
    };
  }, [dartMat, glowMat, tipMat, trailMaterial]);

  useEffect(() => {
    const mesh = trailMeshRef.current;
    if (!mesh) return;
    dummy.position.set(9999, 9999, 9999);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    const proj = projectileRef.current;
    const traveled = Math.max(0, proj.startPosition.distanceTo(proj.position));
    const distOpacity = computeFadeOpacity(traveled, proj.maxDistance);
    activeRef.current = distOpacity > 0.02;

    headPosRef.current.copy(proj.position);
    if (proj.direction.lengthSq() > 1e-8) {
      dirRef.current.copy(proj.direction).normalize();
    }

    if (groupRef.current) {
      groupRef.current.position.copy(proj.position);
      groupRef.current.scale.setScalar(1.15);
    }

    const yaw = Math.atan2(proj.direction.x, proj.direction.z);
    const xz = Math.sqrt(proj.direction.x * proj.direction.x + proj.direction.z * proj.direction.z);
    const pitch = Math.atan2(-proj.direction.y, xz || 1e-8);
    _eulerScratch.set(pitch, yaw, 0, 'YXZ');
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.copy(_eulerScratch);
    }

    dartMat.opacity = 0.95 * distOpacity;
    glowMat.opacity = 0.55 * distOpacity;
    tipMat.opacity = 0.9 * distOpacity;
    trailMaterial.opacity = 0.8 * distOpacity;

    dartLight.current?.setPosition(proj.position.x, proj.position.y, proj.position.z);
    dartLight.current?.setIntensity(6.5 * distOpacity);

    // Particle trail
    const mesh = trailMeshRef.current;
    if (!mesh) return;

    const active = activeRef.current;
    const raw = headPosRef.current;
    if (raw && active) {
      const dir = dirRef.current;
      tmpBack.current.set(0, 0, 0);
      if (dir.lengthSq() > 0.0001) {
        tmpBack.current.copy(dir).normalize().multiplyScalar(-TRAIL_BACK_OFFSET);
      }

      const current = tmpB.current.copy(raw);
      current.add(tmpBack.current);
      current.y += TRAIL_Y_BIAS;

      const last = lastPosRef.current;
      if (last && Math.random() > SPAWN_SKIP_CHANCE) {
        let free = -1;
        const slots = slotsRef.current;
        for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
          if (!slots[i].active) {
            free = i;
            break;
          }
        }
        if (free >= 0) {
          const s = slots[free];
          const t = Math.random();
          tmpSpawn.current.copy(last).lerp(current, t);
          tmpSpawn.current.x += (Math.random() - 0.5) * 0.22;
          tmpSpawn.current.y += (Math.random() - 0.5) * 0.18;
          tmpSpawn.current.z += (Math.random() - 0.5) * 0.22;
          s.pos.copy(tmpSpawn.current);
          s.bornMs = performance.now();
          s.lifeSec = 0.28 + Math.random() * 0.45;
          s.initialScale = 0.2 + Math.random() * 0.55;
          s.active = true;
        }
      }
      if (!lastPosRef.current) lastPosRef.current = new Vector3();
      lastPosRef.current.copy(current);
    } else {
      lastPosRef.current = null;
    }

    const now = performance.now();
    const slots = slotsRef.current;
    for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
      const s = slots[i];
      if (!s.active) {
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const elapsedSec = (now - s.bornMs) / 1000;
      const progress = Math.min(elapsedSec / s.lifeSec, 1);
      if (progress >= 1) {
        s.active = false;
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      s.pos.y += RISE_PER_SEC * delta;
      const scale = s.initialScale * (1 - progress) * distOpacity;
      dummy.position.copy(s.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={groupRef}>
        <group ref={rotGroupRef}>
          <mesh renderOrder={2} geometry={DART_GEO} material={dartMat} />
          <mesh renderOrder={1} geometry={GLOW_GEO} material={glowMat} />
          <mesh renderOrder={3} position={[0, 0, -0.28]} geometry={TIP_GEO} material={tipMat} />
        </group>
      </group>
      <instancedMesh
        ref={trailMeshRef}
        args={[TRAIL_PARTICLE_GEO, trailMaterial, MAX_TRAIL_PARTICLES]}
        frustumCulled={false}
      />
    </>
  );
}

function PoisonDart({ projectiles }: PoisonDartProps) {
  return (
    <>
      {projectiles.map((projectile) => (
        <PoisonDartInstance key={projectile.id} projectile={projectile} />
      ))}
    </>
  );
}

export default React.memo(PoisonDart);
