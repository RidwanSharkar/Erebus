'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  MeshBasicMaterial,
  Group,
  Color,
  CircleGeometry,
  RingGeometry,
  Vector3,
} from '@/utils/three-exports';

export interface Boss3NovaBurst {
  id: string;
  origin: Vector3;
  directions: ReadonlyArray<{ ux: number; uz: number }>;
  maxRange: number;
  travelMs: number;
}

interface SingleDiscProps {
  origin: Vector3;
  dir: { ux: number; uz: number };
  maxRange: number;
  travelMs: number;
}

function SingleDisc({ origin, dir, maxRange, travelMs }: SingleDiscProps) {
  const grp = useRef<Group>(null);
  const elapsed = useRef(0);
  const y = origin.y > 0.15 ? origin.y + 0.12 : 0.18;

  const { matA, matB } = useMemo(() => {
    const a = new MeshBasicMaterial({
      color: new Color('#44ff99'),
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const b = new MeshBasicMaterial({
      color: new Color('#00ff66'),
      transparent: true,
      opacity: 0.42,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { matA: a, matB: b };
  }, []);

  const geomDisc = useMemo(() => new CircleGeometry(0.55, 20), []);
  const geomRing = useMemo(() => new RingGeometry(0.5, 0.92, 24), []);

  useFrame((_, dt) => {
    if (!grp.current) return;
    elapsed.current += dt * 1000;
    const u = Math.min(1, elapsed.current / Math.max(1, travelMs));
    const travel = maxRange * u;
    grp.current.position.set(origin.x + dir.ux * travel, y, origin.z + dir.uz * travel);
    grp.current.rotation.x = -Math.PI / 2;
    grp.current.rotation.z = Math.atan2(dir.ux, dir.uz);
    const fade = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1;
    matA.opacity = 0.85 * fade;
    matB.opacity = 0.42 * fade;
  });

  return (
    <group ref={grp}>
      <mesh geometry={geomDisc} material={matA} />
      <mesh geometry={geomRing} material={matB} />
    </group>
  );
}

function NovaBurst({
  burst,
  onCompleteById,
}: {
  burst: Boss3NovaBurst;
  onCompleteById: (id: string) => void;
}) {
  const onRef = React.useRef(onCompleteById);
  onRef.current = onCompleteById;

  useEffect(() => {
    const burstId = burst.id;
    const t = window.setTimeout(() => onRef.current(burstId), Math.max(burst.travelMs + 400, 100));
    return () => clearTimeout(t);
  }, [burst.id, burst.travelMs]);

  return (
    <>
      {burst.directions.map((dir, i) => (
        <SingleDisc key={i} origin={burst.origin} dir={dir} maxRange={burst.maxRange} travelMs={burst.travelMs} />
      ))}
    </>
  );
}

export default function Boss3NovaDiscs({
  bursts,
  onBurstComplete,
}: {
  bursts: Boss3NovaBurst[];
  onBurstComplete: (id: string) => void;
}) {
  return (
    <>
      {bursts.map(b => (
        <NovaBurst
          key={b.id}
          burst={b}
          onCompleteById={onBurstComplete}
        />
      ))}
    </>
  );
}
