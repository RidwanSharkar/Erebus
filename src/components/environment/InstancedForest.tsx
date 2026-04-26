import React, { useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Matrix4,
  Vector3,
} from '@/utils/three-exports';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';
import {
  FOREST_CANOPY_TIERS,
  createForestTrunkGeometry,
  createForestCanopyGeometries,
  createForestShadowDiscGeometry,
  createForestTrunkShaderMaterial,
  createForestCanopyShaderMaterials,
  createForestShadowMaterial,
} from './forestTreeVisual';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TREE_COUNT = 40;
/** Forest ring scales with main map radius (was 12 / 28 and 51 / 28 at R=28). */
const DEFAULT_INNER_R = MAIN_MAP_RADIUS * (18 / 28);
const DEFAULT_OUTER_R = MAIN_MAP_RADIUS * (40 / 28);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface InstancedForestProps {
  count?: number;
  innerRadius?: number;
  outerRadius?: number;
  windStrength?: number;
  trunkDark?: string;
  trunkLight?: string;
  leafDark?: string;
  leafLight?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const InstancedForest: React.FC<InstancedForestProps> = ({
  count = TREE_COUNT,
  innerRadius = DEFAULT_INNER_R,
  outerRadius = DEFAULT_OUTER_R,
  windStrength = 0.65,
  trunkDark = '#3d2b1f',
  trunkLight = '#6b4a34',
  leafDark = '#2a6b14',
  leafLight = '#F991CC',
}) => {
  const trunkRef = useRef<InstancedMesh>(null);
  const canopy0 = useRef<InstancedMesh>(null);
  const canopy1 = useRef<InstancedMesh>(null);
  const canopy2 = useRef<InstancedMesh>(null);
  const shadowRef = useRef<InstancedMesh>(null);
  const canopyRefs = [canopy0, canopy1, canopy2] as const;

  const palette = useMemo(
    () => ({ trunkDark, trunkLight, leafDark, leafLight, windStrength }),
    [trunkDark, trunkLight, leafDark, leafLight, windStrength],
  );

  const trunkGeo = useMemo(() => createForestTrunkGeometry(), []);
  const canopyGeos = useMemo(() => createForestCanopyGeometries(), []);
  const shadowGeo = useMemo(() => createForestShadowDiscGeometry(), []);

  const trunkMat = useMemo(() => createForestTrunkShaderMaterial(palette, true), [palette]);
  const canopyMats = useMemo(() => createForestCanopyShaderMaterials(palette, true), [palette]);
  const shadowMat = useMemo(() => createForestShadowMaterial(true), []);

  const fillForestInstances = useCallback((): boolean => {
    if (!trunkRef.current || !shadowRef.current) return false;
    if (canopyRefs.some((r) => !r.current)) return false;

    const mat = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();
    const rotMat = new Matrix4();
    const rotY = new Matrix4();

    for (let i = 0; i < count; i++) {
      const treeAngle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const t = Math.pow(Math.random(), 0.55);
      const r = innerRadius + t * (outerRadius - innerRadius);
      const x = Math.cos(treeAngle) * r;
      const z = Math.sin(treeAngle) * r;

      const trunkH = 2.5 + Math.random() * 2.5;
      const trunkR = 0.2 + Math.random() * 0.16;
      const canopyR = (0.5 + Math.random() * 0.9) * trunkR * 6.5;

      const rotAngle = Math.random() * Math.PI * 2;
      rotY.makeRotationY(rotAngle);

      scl.set(trunkR, trunkH, trunkR);
      mat.makeScale(scl.x, scl.y, scl.z);
      mat.premultiply(rotY);
      pos.set(x, trunkH * 0.25 + 1.0, z);
      mat.setPosition(pos);
      trunkRef.current.setMatrixAt(i, mat);

      FOREST_CANOPY_TIERS.forEach((tier, ti) => {
        const cR = canopyR * tier.rScale;
        let xOff = 0,
          zOff = 0;
        if (ti === 1) {
          xOff = canopyR * 0.22;
        }
        if (ti === 2) {
          xOff = -canopyR * 0.15;
          zOff = canopyR * 0.1;
        }
        const cos = Math.cos(rotAngle),
          sin = Math.sin(rotAngle);
        const rxOff = xOff * cos - zOff * sin;
        const rzOff = xOff * sin + zOff * cos;

        const sphereY = trunkH + canopyR * (tier.yFrac * 0.8) + cR * 0.15;

        scl.set(cR, cR, cR);
        mat.makeScale(scl.x, scl.y, scl.z);
        rotMat.makeRotationY(rotAngle + ti * 0.9);
        mat.premultiply(rotMat);
        pos.set(x + rxOff, sphereY, z + rzOff);
        mat.setPosition(pos);
        canopyRefs[ti].current!.setMatrixAt(i, mat);
      });

      const shadowR = canopyR * 0.95;
      scl.set(shadowR, 1, shadowR * 0.75);
      mat.makeScale(scl.x, scl.y, scl.z);
      mat.premultiply(rotY);
      const flatRot = new Matrix4().makeRotationX(-Math.PI * 0.5);
      mat.premultiply(flatRot);
      pos.set(x, 0.02, z);
      mat.setPosition(pos);
      shadowRef.current.setMatrixAt(i, mat);
    }

    trunkRef.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    canopyRefs.forEach((r) => {
      r.current!.instanceMatrix.needsUpdate = true;
    });
    return true;
  }, [count, innerRadius, outerRadius]);

  useLayoutEffect(() => {
    if (fillForestInstances()) return;
    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    const maxRafAttempts = 90;
    const tick = () => {
      if (cancelled) return;
      if (fillForestInstances()) return;
      if (++attempts >= maxRafAttempts) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [fillForestInstances]);

  useEffect(
    () => () => {
      trunkGeo.dispose();
    },
    [trunkGeo],
  );
  useEffect(
    () => () => {
      canopyGeos.forEach((g) => g.dispose());
    },
    [canopyGeos],
  );
  useEffect(
    () => () => {
      shadowGeo.dispose();
    },
    [shadowGeo],
  );
  useEffect(
    () => () => {
      trunkMat.dispose();
    },
    [trunkMat],
  );
  useEffect(
    () => () => {
      canopyMats.forEach((m) => m.dispose());
    },
    [canopyMats],
  );
  useEffect(
    () => () => {
      shadowMat.dispose();
    },
    [shadowMat],
  );

  useFrame((_, delta) => {
    trunkMat.uniforms.uTime.value += delta;
    canopyMats.forEach((m) => {
      m.uniforms.uTime.value += delta;
    });
  });

  return (
    <group>
      <instancedMesh
        key={`forest-shadow-${count}`}
        ref={shadowRef}
        args={[shadowGeo, shadowMat, count]}
        frustumCulled={false}
      />

      <instancedMesh
        key={`forest-trunk-${count}`}
        ref={trunkRef}
        args={[trunkGeo, trunkMat, count]}
        frustumCulled={false}
      />

      <instancedMesh
        key={`forest-canopy-0-${count}`}
        ref={canopy0}
        args={[canopyGeos[0], canopyMats[0], count]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`forest-canopy-1-${count}`}
        ref={canopy1}
        args={[canopyGeos[1], canopyMats[1], count]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`forest-canopy-2-${count}`}
        ref={canopy2}
        args={[canopyGeos[2], canopyMats[2], count]}
        frustumCulled={false}
      />
    </group>
  );
};

export default React.memo(InstancedForest);
