import React, { useRef, useMemo, useEffect } from 'react';
import { InstancedBufferAttribute } from 'three';
import {
  InstancedMesh,
  PlaneGeometry,
  Matrix4,
  Vector3,
} from '@/utils/three-exports';
import { createGroundCrackMaterial } from './groundCracksShader';

// ---------------------------------------------------------------------------
// Procedural ground cracks — flat decal planes on stone paths
// Voronoi-cell based crack pattern in fragment shader; no textures needed
// Transparent, renders on top of stone ground (renderOrder 2)
// ---------------------------------------------------------------------------

const CRACK_COUNT = 40;
const CRACK_SEED = 0x4a7f;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const CAMP_CENTERS: [number, number][] = [
  [0, -15],
  [15, 7],
  [-15, 7],
  [0, 0],
];

const GroundCracks: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute(
      'aCrackSeed',
      new InstancedBufferAttribute(new Float32Array(CRACK_COUNT * 2), 2),
    );
    return geometry;
  }, []);

  const mat = useMemo(() => createGroundCrackMaterial(true), []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const seedAttr = geo.getAttribute('aCrackSeed') as InstancedBufferAttribute;
    const m = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < CRACK_COUNT; i++) {
      const baseSeed = CRACK_SEED + i * 17.31;
      const campIdx = Math.floor(seededRandom(baseSeed) * CAMP_CENTERS.length);
      const camp = CAMP_CENTERS[campIdx];
      const a = seededRandom(baseSeed + 1.7) * Math.PI * 2;
      const r = seededRandom(baseSeed + 3.1) * 7.5;
      pos.set(camp[0] + Math.cos(a) * r, 0.03, camp[1] + Math.sin(a) * r);

      const s = 2.5 + seededRandom(baseSeed + 5.3) * 5.0;
      const rotAngle = seededRandom(baseSeed + 7.9) * Math.PI;

      seedAttr.setXY(i, seededRandom(baseSeed + 11.2) * 8.0, seededRandom(baseSeed + 13.4) * 8.0);

      m.makeRotationX(-Math.PI / 2);
      const rotY = new Matrix4().makeRotationZ(rotAngle);
      m.multiply(rotY);
      scl.set(s, s, 1);
      m.scale(scl);
      m.setPosition(pos);
      mesh.setMatrixAt(i, m);
    }

    seedAttr.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
  }, [geo]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, CRACK_COUNT]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
};

export default React.memo(GroundCracks);
