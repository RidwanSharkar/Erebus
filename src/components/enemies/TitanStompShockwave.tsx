'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  MeshBasicMaterial,
  Group,
  Color,
  RingGeometry,
  PlaneGeometry,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface TitanStompShockwaveBurst {
  id: string;
  origin: { x: number; y: number; z: number };
  direction: { ux: number; uz: number };
  maxRange: number;
  travelMs: number;
}

interface TitanStompShockwaveProps {
  burst: TitanStompShockwaveBurst;
  onComplete: () => void;
}

const GROUND_Y = 0.12;
const STRIP_LENGTH = 2.4;
const STRIP_WIDTH = 2.0;

function SingleStrip({
  burst,
  onComplete,
}: {
  burst: TitanStompShockwaveBurst;
  onComplete: () => void;
}) {
  const grp = useRef<Group>(null);
  const elapsed = useRef(0);
  const doneRef = useRef(false);
  const { origin, direction, maxRange, travelMs } = burst;

  const stompLight = useDynamicLight({
    color: new Color('#c8b89a'),
    distance: 8,
    decay: 2,
    priority: 0,
  });

  const { matCore, matMid, matHalo } = useMemo(() => {
    const core = new MeshBasicMaterial({
      color: new Color('#e8dcc8'),
      transparent: true,
      opacity: 0.88,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mid = new MeshBasicMaterial({
      color: new Color('#a89878'),
      transparent: true,
      opacity: 0.62,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const halo = new MeshBasicMaterial({
      color: new Color('#8b7355'),
      transparent: true,
      opacity: 0.38,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { matCore: core, matMid: mid, matHalo: halo };
  }, []);

  const geomStrip = useMemo(() => new PlaneGeometry(STRIP_LENGTH, STRIP_WIDTH), []);
  const geomRing = useMemo(() => new RingGeometry(0.35, 0.85, 24), []);

  useEffect(() => {
    return () => {
      matCore.dispose();
      matMid.dispose();
      matHalo.dispose();
      geomStrip.dispose();
      geomRing.dispose();
    };
  }, [matCore, matMid, matHalo, geomStrip, geomRing]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
    }, Math.max(travelMs + 350, 500));
    return () => clearTimeout(t);
  }, [travelMs, onComplete]);

  useFrame((_, dt) => {
    if (!grp.current || doneRef.current) return;
    elapsed.current += dt * 1000;
    const u = Math.min(1, elapsed.current / Math.max(1, travelMs));
    const travel = maxRange * u;
    const px = origin.x + direction.ux * travel;
    const pz = origin.z + direction.uz * travel;
    const y = (origin.y > 0.05 ? origin.y : 0) + GROUND_Y;

    grp.current.position.set(px, y, pz);
    grp.current.rotation.set(-Math.PI / 2, 0, Math.atan2(direction.ux, direction.uz));

    const pulse = 1 + 0.08 * Math.sin(elapsed.current * 0.022);
    grp.current.scale.set(pulse, pulse * 0.85, pulse);

    const fade = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
    matCore.opacity = 0.88 * fade;
    matMid.opacity = 0.62 * fade;
    matHalo.opacity = 0.38 * fade;

    stompLight.current?.setPosition(px, y + 0.1, pz);
    stompLight.current?.setIntensity(4 + 6 * Math.sin(u * Math.PI));

    if (u >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={grp}>
      <mesh geometry={geomStrip} material={matCore} />
      <mesh geometry={geomStrip} material={matMid} position={[0, 0.01, 0]} scale={[1.15, 1.2, 1]} />
      <mesh geometry={geomRing} material={matHalo} position={[STRIP_LENGTH * 0.35, 0.02, 0]} />
    </group>
  );
}

export default function TitanStompShockwave({ burst, onComplete }: TitanStompShockwaveProps) {
  return <SingleStrip burst={burst} onComplete={onComplete} />;
}
