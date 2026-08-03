import React, { useRef, useMemo, useEffect } from 'react';
import { AdditiveBlending, ConeGeometry, CylinderGeometry } from '@/utils/three-exports';
import { Mesh, Vector3, Color, Group, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import type { CrossentropyVisualTheme } from '@/utils/talents';
import {
  getCrossentropyBlitzAspectPalette,
  type CrossentropyBlitzAspectKey,
} from '@/utils/weaponAspects';
import ScytheHandleTrail from '@/components/weapons/ScytheHandleTrail';
import BlitzFireTrail from './BlitzFireTrail';

const ROCKET_SCALE = 2.1;
const ROCKET_BODY_GEO = new CylinderGeometry(0.08, 0.14, 0.55, 8);
const ROCKET_NOSE_GEO = new ConeGeometry(0.14, 0.28, 8);

export const BLITZ_BOLT_MODEL_PATH = '/models/trinket/blitzBoltProjectile.glb';
/** Tune after in-game look test */
export const BLITZ_BOLT_MODEL_SCALE = 0.24;
const BLITZ_BOLT_SPIN_RAD_PER_SEC = 12;
/** Local X offset for opposite spin-trail anchors on boltSpinRef */
const BLITZ_BOLT_TRAIL_ANCHOR_OFFSET = 0.22;

useGLTF.preload(BLITZ_BOLT_MODEL_PATH);

interface CrossentropyBlitzRocketProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  visualTheme?: CrossentropyVisualTheme;
  aspectKey?: CrossentropyBlitzAspectKey;
  reaperEcsDriven?: boolean;
}

function themeColors(
  theme: CrossentropyVisualTheme,
  reaper: boolean,
  aspectKey: CrossentropyBlitzAspectKey,
) {
  if (reaper) {
    return {
      body: '#6B2FA0',
      emissive: '#B866FF',
      trail: new Color('#9944FF'),
      light: new Color('#AA55FF'),
    };
  }
  if (theme === 'inferno') {
    return {
      body: '#CC2200',
      emissive: '#FF4400',
      trail: new Color('#FF3300'),
      light: new Color('#FF5500'),
    };
  }
  if (theme === 'glacial') {
    return {
      body: '#0a4a8a',
      emissive: '#40a0f0',
      trail: new Color('#1188DD'),
      light: new Color('#66CCFF'),
    };
  }
  if (theme === 'tempest') {
    return {
      body: '#1E6EEB',
      emissive: '#88DDFF',
      trail: new Color('#44AAFF'),
      light: new Color('#66BBFF'),
    };
  }
  if (theme === 'plague') {
    return {
      body: '#1E8B4A',
      emissive: '#66FFAA',
      trail: new Color('#44FF88'),
      light: new Color('#55FF99'),
    };
  }
  const palette = getCrossentropyBlitzAspectPalette(aspectKey);
  return {
    body: palette.body,
    emissive: palette.emissive,
    trail: new Color(palette.trail),
    light: new Color(palette.light),
  };
}

export default function CrossentropyBlitzRocket({
  position,
  direction,
  visualTheme = 'default',
  aspectKey = 'archmage',
  reaperEcsDriven = false,
}: CrossentropyBlitzRocketProps) {
  const outerGroupRef = useRef<Group>(null);
  const rocketGroupRef = useRef<Group>(null);
  const exhaustRef = useRef<Mesh>(null);
  const boltSpinRef = useRef<Group>(null);
  const boltTrailEndARef = useRef<Group>(null);
  const boltTrailEndBRef = useRef<Group>(null);
  const currentPosition = useRef(position.clone());
  const directionRef = useRef(direction.clone());
  const time = useRef(0);

  const _scratchRight = useRef(new Vector3());
  const _scratchUp = useRef(new Vector3());
  const _scratchFwd = useRef(new Vector3());

  const { body, emissive, trail, light } = useMemo(
    () => themeColors(visualTheme, reaperEcsDriven, aspectKey),
    [visualTheme, reaperEcsDriven, aspectKey],
  );

  const bodyColor = useMemo(() => new Color(body), [body]);
  const emissiveColor = useMemo(() => new Color(emissive), [emissive]);

  const rocketLight = useDynamicLight({ color: light, distance: 10, priority: 2 });

  const { scene } = useGLTF(BLITZ_BOLT_MODEL_PATH);

  const { clonedScene, themeMats } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    applyWeaponItemGlow(clone);

    const mats: MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of list) {
        const std = mat as MeshStandardMaterial;
        if (!std?.emissive) continue;
        mats.push(std);
      }
    });
    return { clonedScene: clone, themeMats: mats };
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  useEffect(() => {
    for (const mat of themeMats) {
      if (mat.color) {
        mat.color.copy(bodyColor);
      }
      mat.emissive.copy(emissiveColor);
      mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 3.5);
      mat.needsUpdate = true;
    }
  }, [themeMats, bodyColor, emissiveColor]);

  useFrame((_, delta) => {
    if (!outerGroupRef.current || !rocketGroupRef.current) return;
    time.current += delta;
    currentPosition.current.copy(position);
    directionRef.current.copy(direction);

    const pos = currentPosition.current;
    outerGroupRef.current.position.copy(pos);

    _scratchFwd.current.copy(direction).normalize();
    _scratchUp.current.set(0, 1, 0);
    _scratchRight.current.crossVectors(_scratchUp.current, _scratchFwd.current).normalize();
    _scratchUp.current.crossVectors(_scratchFwd.current, _scratchRight.current).normalize();
    rocketGroupRef.current.lookAt(
      pos.x + _scratchFwd.current.x,
      pos.y + _scratchFwd.current.y,
      pos.z + _scratchFwd.current.z,
    );
    rocketGroupRef.current.rotateX(Math.PI / 2);

    const pulse = 0.85 + Math.sin(time.current * 24) * 0.15;
    if (exhaustRef.current) {
      exhaustRef.current.scale.set(1, 0.6 + pulse * 0.5, 1);
    }

    if (boltSpinRef.current) {
      boltSpinRef.current.rotation.y += delta * BLITZ_BOLT_SPIN_RAD_PER_SEC;
    }

    rocketLight.current?.setPosition(pos.x, pos.y, pos.z);
    rocketLight.current?.setIntensity(4.5);
  });

  return (
    <>
      <BlitzFireTrail
        worldPositionRef={currentPosition}
        directionRef={directionRef}
        visualTheme={visualTheme}
        aspectKey={aspectKey}
        reaperPurple={reaperEcsDriven}
      />
      <group ref={outerGroupRef}>
        <group ref={rocketGroupRef} scale={[ROCKET_SCALE, ROCKET_SCALE, ROCKET_SCALE]}>
        <mesh geometry={ROCKET_BODY_GEO} position={[0, -0.08, 0]}>
          <meshStandardMaterial
            color={body}
            emissive={emissive}
            emissiveIntensity={2.2}
            transparent
            opacity={0.92}
          />
        </mesh>

        <mesh ref={exhaustRef} position={[0, -0.42, 0]}>
          <coneGeometry args={[0.12, 0.42, 6]} />
          <meshStandardMaterial
            color={`#${trail.getHexString()}`}
            emissive={emissive}
            emissiveIntensity={3}
            transparent
            opacity={0.75}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, -0.65, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.072, 0.6, 6]} />
          <meshStandardMaterial
            color={`#${trail.getHexString()}`}
            emissive={emissive}
            emissiveIntensity={2}
            transparent
            opacity={0.55}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <group ref={boltSpinRef} position={[0, -0.38, 0.125]}>
          <group scale={BLITZ_BOLT_MODEL_SCALE * 0.75}>
            <primitive object={clonedScene} />
          </group>
          <group ref={boltTrailEndARef} position={[BLITZ_BOLT_TRAIL_ANCHOR_OFFSET, 0, 0]} />
          <group ref={boltTrailEndBRef} position={[-BLITZ_BOLT_TRAIL_ANCHOR_OFFSET, 0, 0]} />
        </group>
        </group>
        <ScytheHandleTrail
          anchorRef={boltTrailEndARef}
          parentRef={outerGroupRef}
          color={trail}
        />
        <ScytheHandleTrail
          anchorRef={boltTrailEndBRef}
          parentRef={outerGroupRef}
          color={trail}
        />
      </group>
    </>
  );
}
