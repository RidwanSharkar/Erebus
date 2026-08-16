'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';
import type { CrossentropyVisualTheme } from '@/utils/talents';
import {
  getCrossentropyBlitzAspectPalette,
  type CrossentropyBlitzAspectKey,
} from '@/utils/weaponAspects';

export const ARCANE_TRAIL_MODEL_PATH = '/models/environ/arcaneEffectTrail.glb';

const MAX_PUFFS = 12;
const MAX_CONCURRENT_TRAILS = 3;
const SPAWN_DISTANCE = 1.1;
const PUFF_LIFE = 0.5;
const PUFF_SCALE = 0.55;
const PUFF_EXPAND = 0.4;
const TRAIL_BACK_OFFSET = 0.4;
const SPIN_MIN = 1.8;
const SPIN_MAX = 4.0;

useGLTF.preload(ARCANE_TRAIL_MODEL_PATH);

type TrailGroup = {
  geometry: BufferGeometry;
  material: MeshBasicMaterial;
};

type Slot = {
  active: boolean;
  age: number;
  lifeSec: number;
  initialScale: number;
  spin: number;
  spinSpeed: number;
  pos: Vector3;
  quat: Quaternion;
};

const groupCache = new WeakMap<Object3D, TrailGroup[]>();
const _dummy = new Object3D();
const _tmpCurrent = new Vector3();
const _tmpBack = new Vector3();
const _tmpLook = new Vector3();
const _color = new Color();
const _hiddenColor = new Color(0, 0, 0);

let activeTrailCount = 0;

function createSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < MAX_PUFFS; i++) {
    slots.push({
      active: false,
      age: 0,
      lifeSec: PUFF_LIFE,
      initialScale: PUFF_SCALE,
      spin: 0,
      spinSpeed: 0,
      pos: new Vector3(),
      quat: new Quaternion(),
    });
  }
  return slots;
}

function trailTint(
  theme: CrossentropyVisualTheme,
  reaper: boolean,
  aspectKey: CrossentropyBlitzAspectKey,
): string {
  if (reaper) return '#9944FF';
  if (theme === 'inferno') return '#FF3300';
  if (theme === 'glacial') return '#1188DD';
  if (theme === 'tempest') return '#44AAFF';
  if (theme === 'plague') return '#44FF88';
  return getCrossentropyBlitzAspectPalette(aspectKey).trail;
}

function getTrailGroups(scene: Object3D): TrailGroup[] {
  const cached = groupCache.get(scene);
  if (cached) return cached;

  scene.updateMatrixWorld(true);
  const groups: TrailGroup[] = [];
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.userData.shared = true;

    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const map = (srcMat as MeshBasicMaterial | undefined)?.map ?? null;
    const material = new MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
    });
    material.userData.shared = true;
    groups.push({ geometry, material });
  });

  groupCache.set(scene, groups);
  return groups;
}

function hideInstance(mesh: InstancedMesh, index: number): void {
  _dummy.position.set(9999, 9999, 9999);
  _dummy.scale.setScalar(0);
  _dummy.quaternion.identity();
  _dummy.updateMatrix();
  mesh.setMatrixAt(index, _dummy.matrix);
  mesh.setColorAt(index, _hiddenColor);
}

export interface BlitzArcaneTrailProps {
  worldPositionRef: React.RefObject<Vector3 | null> | React.MutableRefObject<Vector3>;
  directionRef: React.RefObject<Vector3 | null> | React.MutableRefObject<Vector3>;
  visualTheme?: CrossentropyVisualTheme;
  aspectKey?: CrossentropyBlitzAspectKey;
  reaperPurple?: boolean;
}

const BlitzArcaneTrail = React.memo(
  ({
    worldPositionRef,
    directionRef,
    visualTheme = 'default',
    aspectKey = 'archmage',
    reaperPurple = false,
  }: BlitzArcaneTrailProps) => {
    const { scene } = useGLTF(ARCANE_TRAIL_MODEL_PATH);
    const groups = useMemo(() => getTrailGroups(scene), [scene]);
    const meshRefs = useRef<(InstancedMesh | null)[]>([]);
    const slotsRef = useRef<Slot[]>(createSlots());
    const lastPosRef = useRef(new Vector3());
    const hasLastRef = useRef(false);
    const accDistRef = useRef(0);
    const [enabled, setEnabled] = useState(false);

    const tint = useMemo(
      () => trailTint(visualTheme, reaperPurple, aspectKey),
      [visualTheme, reaperPurple, aspectKey],
    );
    const tintColor = useMemo(() => new Color(tint), [tint]);

    useEffect(() => {
      if (activeTrailCount >= MAX_CONCURRENT_TRAILS) return;
      activeTrailCount += 1;
      setEnabled(true);
      return () => {
        activeTrailCount -= 1;
      };
    }, []);

    useLayoutEffect(() => {
      if (!enabled) return;
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        for (let i = 0; i < MAX_PUFFS; i++) hideInstance(mesh, i);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }, [enabled, groups]);

    useFrame((_, delta) => {
      if (!enabled) return;
      const meshes = meshRefs.current;
      if (meshes.length === 0 || !meshes[0]) return;

      const raw = worldPositionRef.current;
      const dir = directionRef.current;
      if (raw) {
        _tmpBack.set(0, 0, 0);
        if (dir && dir.lengthSq() > 0.0001) {
          _tmpBack.copy(dir).normalize().multiplyScalar(-TRAIL_BACK_OFFSET);
        }
        _tmpCurrent.copy(raw).add(_tmpBack);

        if (hasLastRef.current) {
          const last = lastPosRef.current;
          const dist = last.distanceTo(_tmpCurrent);
          if (dist > 1e-5) {
            accDistRef.current += dist;
            const slots = slotsRef.current;
            while (accDistRef.current >= SPAWN_DISTANCE) {
              accDistRef.current -= SPAWN_DISTANCE;
              let free = -1;
              for (let i = 0; i < MAX_PUFFS; i++) {
                if (!slots[i].active) {
                  free = i;
                  break;
                }
              }
              if (free < 0) {
                accDistRef.current += SPAWN_DISTANCE;
                break;
              }

              const traveled = dist - accDistRef.current;
              const t = Math.min(Math.max(traveled / dist, 0), 1);
              const s = slots[free];
              s.pos.copy(last).lerp(_tmpCurrent, t);
              _tmpLook.copy(s.pos);
              if (dir && dir.lengthSq() > 0.0001) {
                _tmpLook.add(dir);
              } else {
                _tmpLook.z -= 1;
              }
              _dummy.position.copy(s.pos);
              _dummy.scale.setScalar(1);
              _dummy.lookAt(_tmpLook);
              _dummy.rotateZ(Math.random() * Math.PI * 2);
              s.quat.copy(_dummy.quaternion);
              s.age = 0;
              s.lifeSec = PUFF_LIFE;
              s.initialScale = PUFF_SCALE * (0.85 + Math.random() * 0.3);
              s.spin = 0;
              s.spinSpeed = SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN);
              s.active = true;
            }
          }
        }
        lastPosRef.current.copy(_tmpCurrent);
        hasLastRef.current = true;
      } else {
        hasLastRef.current = false;
        accDistRef.current = 0;
      }

      const slots = slotsRef.current;
      for (let i = 0; i < MAX_PUFFS; i++) {
        const s = slots[i];
        if (!s.active) {
          for (const mesh of meshes) {
            if (mesh) hideInstance(mesh, i);
          }
          continue;
        }

        s.age += delta;
        const progress = s.age / s.lifeSec;
        if (progress >= 1) {
          s.active = false;
          for (const mesh of meshes) {
            if (mesh) hideInstance(mesh, i);
          }
          continue;
        }

        s.spin += s.spinSpeed * delta;
        const fade = progress < 0.12 ? progress / 0.12 : 1 - (progress - 0.12) / 0.88;
        const scale = s.initialScale * (1 + progress * PUFF_EXPAND);
        _dummy.position.copy(s.pos);
        _dummy.quaternion.copy(s.quat);
        _dummy.rotateZ(s.spin);
        _dummy.scale.setScalar(scale);
        _dummy.updateMatrix();
        _color.copy(tintColor).multiplyScalar(fade);

        for (const mesh of meshes) {
          if (!mesh) continue;
          mesh.setMatrixAt(i, _dummy.matrix);
          mesh.setColorAt(i, _color);
        }
      }

      for (const mesh of meshes) {
        if (!mesh) continue;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    });

    if (!enabled || groups.length === 0) return null;

    return (
      <>
        {groups.map((group, index) => (
          <instancedMesh
            key={index}
            ref={(el) => {
              meshRefs.current[index] = el;
            }}
            args={[group.geometry, group.material, MAX_PUFFS]}
            frustumCulled={false}
            dispose={null}
          />
        ))}
      </>
    );
  },
);

BlitzArcaneTrail.displayName = 'BlitzArcaneTrail';

export default BlitzArcaneTrail;
