'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface WarlockFlameStrikeProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION     = 1.1;  // seconds — total effect lifetime
const PILLAR_COUNT = 6;    // centre + 6 ring pillars

interface PillarCfg {
  x: number;
  z: number;
  height: number;
  delay: number; // normalised 0–1 stagger offset within the animation
}

export default function WarlockFlameStrike({ position, onComplete }: WarlockFlameStrikeProps) {
  const groupRef   = useRef<Group>(null);
  const pillarRefs = useRef<(Group | null)[]>([]);
  const timeRef    = useRef(0);
  const doneRef    = useRef(false);

  // Stable random pillar layout, generated once per mount.
  const pillars = useMemo<PillarCfg[]>(() => {
    const cfgs: PillarCfg[] = [];
    // Centre eruption — tallest, no delay
    cfgs.push({ x: 0, z: 0, height: 3.8, delay: 0 });
    // Six ring pillars staggered outward
    for (let i = 0; i < PILLAR_COUNT - 1; i++) {
      const angle = (i / (PILLAR_COUNT - 1)) * Math.PI * 2;
      const r     = 1.4 * (0.35 + Math.random() * 0.55);
      cfgs.push({
        x:      Math.cos(angle) * r,
        z:      Math.sin(angle) * r,
        height: 1.6 + Math.random() * 2.0,
        delay:  0.06 + (i / (PILLAR_COUNT - 1)) * 0.22,
      });
    }
    return cfgs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared materials — updated once per frame; disposed on unmount.
  const mats = useMemo(() => ({
    core:   new MeshBasicMaterial({ color: new Color('#fff8c0'), transparent: true, opacity: 1.0, blending: AdditiveBlending, depthWrite: false }),
    flame:  new MeshBasicMaterial({ color: new Color('#ff6600'), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
    ember:  new MeshBasicMaterial({ color: new Color('#cc2200'), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }),
    scorch: new MeshBasicMaterial({ color: new Color('#ff3300'), transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false }),
  }), []);

  // Dispose materials when the component unmounts — only persistent GPU allocations here.
  useEffect(() => {
    return () => { Object.values(mats).forEach(m => m.dispose()); };
  }, [mats]);

  // Stable ref callback for pillar groups so React never re-registers it mid-render.
  const setPillarRef = useCallback((i: number) => (el: Group | null) => {
    pillarRefs.current[i] = el;
  }, []);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const progress = Math.min(timeRef.current / DURATION, 1.0);

    // Global opacity: hold full for first 50% then fade out.
    const fade = progress < 0.5 ? 1.0 : 1.0 - (progress - 0.5) / 0.5;
    mats.core.opacity   = Math.max(0, fade);
    mats.flame.opacity  = Math.max(0, 0.9 * fade);
    mats.ember.opacity  = Math.max(0, 0.7 * fade);
    mats.scorch.opacity = Math.max(0, 0.45 * fade);

    // Per-pillar scale: rocket up quickly (0–40% local), retract slowly (40–100%).
    pillars.forEach((cfg, i) => {
      const ref = pillarRefs.current[i];
      if (!ref) return;
      const local  = Math.max(0, Math.min((progress - cfg.delay) / (1.0 - cfg.delay), 1.0));
      const scaleY = local < 0.4
        ? local / 0.4
        : 1.0 - (local - 0.4) / 0.6;
      ref.scale.set(1, Math.max(0.001, scaleY), 1);
    });

    if (progress >= 1.0) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    // Position set via JSX prop — the strike is static after spawn.
    <group ref={groupRef} position={[position.x, position.y, position.z]}>

      {pillars.map((cfg, i) => (
        <group key={i} ref={setPillarRef(i)} position={[cfg.x, 0, cfg.z]}>
          {/* White-hot core column */}
          <mesh material={mats.core} position={[0, cfg.height / 2, 0]}>
            <cylinderGeometry args={[0.10, 0.18, cfg.height, 6]} />
          </mesh>

          {/* Orange flame body */}
          <mesh material={mats.flame} position={[0, cfg.height / 2, 0]}>
            <cylinderGeometry args={[0.28, 0.46, cfg.height * 0.88, 6]} />
          </mesh>

          {/* Deep-red ember base (lower half only) */}
          <mesh material={mats.ember} position={[0, cfg.height * 0.22, 0]}>
            <cylinderGeometry args={[0.42, 0.58, cfg.height * 0.44, 6]} />
          </mesh>

          {/* Per-pillar ground scorch disc */}
          <mesh material={mats.scorch} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[0.65, 8]} />
          </mesh>

          {/* Heat glow — scales with pillar */}
          <pointLight color="#ff5500" intensity={12} distance={5} decay={2} position={[0, cfg.height * 0.5, 0]} />
        </group>
      ))}

      {/* Outer ground blast ring spanning the full strike radius */}
      <mesh material={mats.scorch} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.3, 1.4, 24]} />
      </mesh>

    </group>
  );
}
