'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { MeshStandardMaterial, InstancedMesh, Matrix4, Vector3, Quaternion, Euler } from '@/utils/three-exports';
import { MountainData, createMountainVariants } from '@/utils/MountainGenerator';

interface InstancedMountainsProps {
  mountains: MountainData[];
}

/**
 * Hyper performance-efficient mountain border.
 *
 * Each mountain is a single sculpted, vertex-colored cone (rock + baked snow).
 * Mountains are bucketed by geometry variant and drawn with one instanced mesh
 * per variant, so the entire surrounding range costs a fixed handful of draw
 * calls regardless of how many mountains encircle the map. Snow is baked into
 * the vertex colors, so there is no separate snow-cap layer and zero per-frame
 * cost.
 */
const InstancedMountains: React.FC<InstancedMountainsProps> = ({ mountains }) => {
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  const geometryVariants = useMemo(() => createMountainVariants(), []);

  // Single material; per-vertex colors carry all the rock/snow detail. Flat
  // shading reinforces the crisp low-poly rock facets.
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.03,
        flatShading: true,
      }),
    [],
  );

  // Bucket mountains by their variant so each instanced mesh only draws its set.
  const variantBuckets = useMemo(() => {
    const buckets: MountainData[][] = geometryVariants.map(() => []);
    mountains.forEach((m, index) => {
      const v = (m.variant ?? index) % geometryVariants.length;
      buckets[v].push(m);
    });
    return buckets;
  }, [mountains, geometryVariants]);

  useEffect(() => {
    return () => {
      material.dispose();
      geometryVariants.forEach((g) => g.dispose());
    };
  }, [material, geometryVariants]);

  useEffect(() => {
    const matrix = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const euler = new Euler();
    const scl = new Vector3();

    variantBuckets.forEach((bucket, variantIndex) => {
      const mesh = meshRefs.current[variantIndex];
      if (!mesh) return;

      bucket.forEach((mountain, instanceIndex) => {
        pos.set(mountain.position.x, mountain.position.y, mountain.position.z);
        euler.set(0, mountain.rotationY ?? 0, 0);
        quat.setFromEuler(euler);
        const h = mountain.heightScale ?? 1;
        scl.set(mountain.scale, mountain.scale * h, mountain.scale);
        matrix.compose(pos, quat, scl);
        mesh.setMatrixAt(instanceIndex, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [variantBuckets]);

  return (
    <group name="instanced-mountains">
      {geometryVariants.map((geometry, variantIndex) => {
        const count = variantBuckets[variantIndex]?.length ?? 0;
        if (count === 0) return null;
        return (
          <instancedMesh
            key={`mtn-${variantIndex}`}
            args={[geometry, material, count]}
            ref={(ref) => {
              meshRefs.current[variantIndex] = ref;
            }}
            frustumCulled={false}
            receiveShadow
            castShadow
          />
        );
      })}
    </group>
  );
};

export default InstancedMountains;
