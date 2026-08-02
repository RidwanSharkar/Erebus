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

export const SHOULDER_LEFT_MODEL_PATH = '/models/trinket/shoulderLeft.glb';
export const SHOULDER_RIGHT_MODEL_PATH = '/models/trinket/shoulderRight.glb';

useGLTF.preload(SHOULDER_LEFT_MODEL_PATH);
useGLTF.preload(SHOULDER_RIGHT_MODEL_PATH);

/** Layout relative to ArchmageCrest anchor (crestPosition). */
type PlateLayout = {
  offset: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
};

/**
 * Both GLBs are WoW bind-pose pauldrons with lateral extent along ±Z.
 * +Y(π/2) maps left mesh (+Z) → +X and right mesh (−Z) → −X.
 * Offsets place the mesh origin so the visual center sits at shoulder height
 * (~±0.38 X, slightly below crest) after scale.
 */
const PLATE_ROTATION = [0, Math.PI / 2, 0] as const;

const HIDE_BODY_LAYOUT = {
  left: {
    offset: [0.17, -0.25, -0.32] as const,
    rotation: PLATE_ROTATION,
    scale: 0.45,
  } satisfies PlateLayout,
  right: {
    offset: [-0.17, -0.25, -0.32] as const,
    rotation: PLATE_ROTATION,
    scale: 0.45,
  } satisfies PlateLayout,
};

const DRAGON_BODY_LAYOUT = {
  left: {
    offset: [0.12, -0.12, 0.02] as const,
    rotation: PLATE_ROTATION,
    scale: 0.5,
  } satisfies PlateLayout,
  right: {
    offset: [-0.12, -0.12, 0.02] as const,
    rotation: PLATE_ROTATION,
    scale: 0.5,
  } satisfies PlateLayout,
};

const HOVER_Y_AMP = 0.03;
const HOVER_TILT_AMP = 0.02;
const HOVER_FREQ = 1.2;
/** Phase offset (radians) so left/right bob out of sync. */
const RIGHT_PHASE = 1.1;

interface ShoulderTrinketPlatesProps {
  /** Shared with ArchmageCrest (`crestPosition`). */
  anchorPosition: [number, number, number];
  /** Coop humanoid uses raised crest; dragon body uses lower offsets. */
  hideBody?: boolean;
}

function useClonedShoulderScene(path: string): Group {
  const { scene } = useGLTF(path);

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
  return clonedScene;
}

function ShoulderPlate({
  path,
  layout,
  hoverPhase,
}: {
  path: string;
  layout: PlateLayout;
  hoverPhase: number;
}) {
  const groupRef = useRef<Group>(null);
  const clonedScene = useClonedShoulderScene(path);
  const baseY = layout.offset[1];
  const baseRotZ = layout.rotation[2];

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.getElapsedTime() * HOVER_FREQ + hoverPhase;
    group.position.y = baseY + Math.sin(t) * HOVER_Y_AMP;
    group.rotation.z = baseRotZ + Math.sin(t * 0.85) * HOVER_TILT_AMP;
  });

  return (
    <group
      ref={groupRef}
      position={[layout.offset[0], layout.offset[1], layout.offset[2]]}
      rotation={[layout.rotation[0], layout.rotation[1], layout.rotation[2]]}
      scale={layout.scale}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

/**
 * Floating left/right pauldron GLBs flanking ArchmageCrest on the player.
 * Visible at player level 3+; bob gently so they read as hovering shoulder armor.
 */
export default function ShoulderTrinketPlates({
  anchorPosition,
  hideBody = false,
}: ShoulderTrinketPlatesProps) {
  const layout = hideBody ? HIDE_BODY_LAYOUT : DRAGON_BODY_LAYOUT;

  return (
    <group position={anchorPosition}>
      <ShoulderPlate
        path={SHOULDER_LEFT_MODEL_PATH}
        layout={layout.left}
        hoverPhase={0}
      />
      <ShoulderPlate
        path={SHOULDER_RIGHT_MODEL_PATH}
        layout={layout.right}
        hoverPhase={RIGHT_PHASE}
      />
    </group>
  );
}
