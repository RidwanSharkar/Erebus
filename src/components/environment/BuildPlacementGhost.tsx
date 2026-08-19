'use client';

import React, { useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, Mesh, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { ExploreBuildingKind } from '@/utils/exploreBuildings';
import { getExploreBuildingDef } from '@/utils/exploreBuildings';
import {
  isExploreBuildingPlacementBlocked,
  type ExploreBuildingPlacementRules,
  type ExploreObstacleDisc,
} from '@/utils/exploreBuildingPlacement';

export interface BuildPlacementGhostProps {
  active: boolean;
  kind: ExploreBuildingKind;
  seed: number;
  extraDiscsRef: MutableRefObject<readonly ExploreObstacleDisc[]>;
  rulesRef: MutableRefObject<ExploreBuildingPlacementRules>;
  destroyedTreeHealth: Map<number, number> | null;
  destroyedRootHealth?: Map<number, number> | null;
  onPositionChange?: (x: number, z: number, valid: boolean) => void;
}

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hitPoint = new Vector3();

function BuildPlacementGhost({
  active,
  kind,
  seed,
  extraDiscsRef,
  rulesRef,
  destroyedTreeHealth,
  destroyedRootHealth = null,
  onPositionChange,
}: BuildPlacementGhostProps) {
  const { camera } = useThree();
  const meshRef = useRef<Mesh>(null);
  const positionRef = useRef({ x: 0, z: 0, valid: false });
  const def = getExploreBuildingDef(kind);
  const radius = def.hullRadius;

  useFrame(() => {
    if (!active || !meshRef.current) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    ndc.x = 0;
    ndc.y = 0;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint);
    if (!hit) {
      meshRef.current.visible = false;
      return;
    }

    const x = hitPoint.x;
    const z = hitPoint.z;
    const blocked = isExploreBuildingPlacementBlocked(
      seed,
      x,
      z,
      kind,
      extraDiscsRef.current,
      destroyedTreeHealth,
      destroyedRootHealth,
      rulesRef.current,
    );
    meshRef.current.visible = true;
    meshRef.current.position.set(x, 0.03, z);
    const mat = meshRef.current.material as import('three').MeshBasicMaterial;
    mat.color.set(blocked ? '#ff4444' : '#44ff88');
    mat.opacity = blocked ? 0.45 : 0.55;

    const prev = positionRef.current;
    if (prev.x !== x || prev.z !== z || prev.valid !== !blocked) {
      positionRef.current = { x, z, valid: !blocked };
      onPositionChange?.(x, z, !blocked);
    }
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
      <ringGeometry args={[radius * 0.88, radius, 48]} />
      <meshBasicMaterial
        color="#44ff88"
        transparent
        opacity={0.55}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

export default React.memo(BuildPlacementGhost);
