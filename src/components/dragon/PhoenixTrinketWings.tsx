'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  PLAYER_SELF_ILLUMINATION_INTENSITY,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';

export const PHOENIX_WINGS_MODEL_PATH = '/models/trinket/phoenix.glb';

useGLTF.preload(PHOENIX_WINGS_MODEL_PATH);

/** Layout relative to ArchmageCrest anchor (crestPosition). */
type WingLayout = {
  offset: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
};

/**
 * WoW golden phoenix cape — wide span along ±Z in bind pose.
 * +Y(π/2) maps that span onto ±X (left/right). Offsets recenter the visual
 * mid-point (~[-0.28, 0.30, 0] raw) slightly below/behind the crest after scale.
 */
const WING_ROTATION_HIDE = [0.15, Math.PI / 2, 0] as const;
const WING_ROTATION_DRAGON = [0.10, Math.PI / 2, 0] as const;

const HIDE_BODY_LAYOUT = {
  offset: [0, -0.36, -0.55] as const,
  rotation: WING_ROTATION_HIDE,
  scale: 0.38,
} satisfies WingLayout;

const DRAGON_BODY_LAYOUT = {
  offset: [0, -0.27, -0.47] as const,
  rotation: WING_ROTATION_DRAGON,
  scale: 0.42,
} satisfies WingLayout;

const HOVER_Y_AMP = 0.03;
const HOVER_TILT_AMP = 0.02;
const HOVER_FREQ = 1.2;

interface PhoenixTrinketWingsProps {
  /** Shared with ArchmageCrest (`crestPosition`). */
  anchorPosition: [number, number, number];
  /** Coop humanoid uses raised crest; dragon body uses lower offsets. */
  hideBody?: boolean;
}

/**
 * Floating phoenix cape/wings GLB behind ArchmageCrest on the player.
 * Visible at player level 4+; bob gently so they read as hovering back wings.
 */
export default function PhoenixTrinketWings({
  anchorPosition,
  hideBody = false,
}: PhoenixTrinketWingsProps) {
  const groupRef = useRef<Group>(null);
  const layout = hideBody ? HIDE_BODY_LAYOUT : DRAGON_BODY_LAYOUT;
  const { scene } = useGLTF(PHOENIX_WINGS_MODEL_PATH);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    applySelfIllumination(clone, { intensity: PLAYER_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const baseY = layout.offset[1];
  const baseRotZ = layout.rotation[2];

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.getElapsedTime() * HOVER_FREQ;
    group.position.y = baseY + Math.sin(t) * HOVER_Y_AMP;
    group.rotation.z = baseRotZ + Math.sin(t * 0.85) * HOVER_TILT_AMP;
  });

  return (
    <group position={anchorPosition}>
      <group
        ref={groupRef}
        position={[layout.offset[0], layout.offset[1], layout.offset[2]]}
        rotation={[layout.rotation[0], layout.rotation[1], layout.rotation[2]]}
        scale={layout.scale}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
