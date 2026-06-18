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
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface Boss3NovaBurst {
  id: string;
  origin: Vector3;
  directions: ReadonlyArray<{ ux: number; uz: number }>;
  maxRange: number;
  travelMs: number;
  roundIndex?: number;
  burstRounds?: number;
}

const DISC_HEIGHT = 0.72;
const LAUNCH_POP_MS = 120;
const TRAIL_COUNT = 3;

interface SingleDiscProps {
  origin: Vector3;
  dir: { ux: number; uz: number };
  maxRange: number;
  travelMs: number;
  roundIndex?: number;
}

function SingleDisc({ origin, dir, maxRange, travelMs, roundIndex = 0 }: SingleDiscProps) {
  const grp = useRef<Group>(null);
  const trailRefs = useRef<(Group | null)[]>([]);
  const elapsed = useRef(0);
  const y = origin.y > 0.15 ? origin.y + DISC_HEIGHT : DISC_HEIGHT;
  const roundBoost = 1 + roundIndex * 0.08;

  const discLight = useDynamicLight({
    color: new Color('#66ffaa'),
    distance: 5,
    decay: 2,
    priority: 0,
  });

  const { matCore, matMid, matHalo, trailMat } = useMemo(() => {
    const core = new MeshBasicMaterial({
      color: new Color('#aaffcc'),
      transparent: true,
      opacity: 0.92,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mid = new MeshBasicMaterial({
      color: new Color('#44ff99'),
      transparent: true,
      opacity: 0.78,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const halo = new MeshBasicMaterial({
      color: new Color('#00ff66'),
      transparent: true,
      opacity: 0.38,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const trail = new MeshBasicMaterial({
      color: new Color('#55ffaa'),
      transparent: true,
      opacity: 0.28,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { matCore: core, matMid: mid, matHalo: halo, trailMat: trail };
  }, []);

  const geomCore = useMemo(() => new CircleGeometry(0.38, 24), []);
  const geomMid = useMemo(() => new RingGeometry(0.32, 0.62, 28), []);
  const geomHalo = useMemo(() => new RingGeometry(0.58, 1.05, 32), []);
  const geomTrail = useMemo(() => new RingGeometry(0.42, 0.78, 20), []);

  useEffect(() => {
    return () => {
      matCore.dispose();
      matMid.dispose();
      matHalo.dispose();
      trailMat.dispose();
      geomCore.dispose();
      geomMid.dispose();
      geomHalo.dispose();
      geomTrail.dispose();
    };
  }, [matCore, matMid, matHalo, trailMat, geomCore, geomMid, geomHalo, geomTrail]);

  useFrame((_, dt) => {
    if (!grp.current) return;
    elapsed.current += dt * 1000;
    const u = Math.min(1, elapsed.current / Math.max(1, travelMs));
    const travel = maxRange * u;
    const px = origin.x + dir.ux * travel;
    const pz = origin.z + dir.uz * travel;

    grp.current.position.set(px, y, pz);
    grp.current.rotation.x = -Math.PI / 2;
    grp.current.rotation.z = Math.atan2(dir.ux, dir.uz) + elapsed.current * 0.0045;

    const launchT = Math.min(1, elapsed.current / LAUNCH_POP_MS);
    const launchScale = (0.4 + 0.6 * launchT) * roundBoost;
    const pulse = 1 + 0.06 * Math.sin(elapsed.current * 0.018);
    grp.current.scale.setScalar(launchScale * pulse);

    const fade = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1;
    matCore.opacity = 0.92 * fade * roundBoost;
    matMid.opacity = 0.78 * fade * roundBoost;
    matHalo.opacity = 0.38 * fade;
    trailMat.opacity = 0.28 * fade;

    discLight.current?.setPosition(px, y + 0.08, pz);
    discLight.current?.setIntensity(3.5 + 4.5 * Math.sin(u * Math.PI) * roundBoost);

    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      const trail = trailRefs.current[i];
      if (!trail) continue;
      const trailU = Math.max(0, u - (i + 1) * 0.045);
      const trailTravel = maxRange * trailU;
      trail.position.set(
        origin.x + dir.ux * trailTravel,
        y - 0.02 * (i + 1),
        origin.z + dir.uz * trailTravel,
      );
      trail.rotation.x = -Math.PI / 2;
      trail.rotation.z = grp.current.rotation.z;
      trail.scale.setScalar(launchScale * (0.85 - i * 0.12));
      trail.visible = trailU > 0.01;
    }
  });

  return (
    <>
      <group ref={grp}>
        <mesh geometry={geomCore} material={matCore} />
        <mesh geometry={geomMid} material={matMid} />
        <mesh geometry={geomHalo} material={matHalo} />
      </group>
      {Array.from({ length: TRAIL_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
        >
          <mesh geometry={geomTrail} material={trailMat} />
        </group>
      ))}
    </>
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
        <SingleDisc
          key={i}
          origin={burst.origin}
          dir={dir}
          maxRange={burst.maxRange}
          travelMs={burst.travelMs}
          roundIndex={burst.roundIndex ?? 0}
        />
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
      {bursts.map((b) => (
        <NovaBurst key={b.id} burst={b} onCompleteById={onBurstComplete} />
      ))}
    </>
  );
}
