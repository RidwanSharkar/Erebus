'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { acquireDynamicLight, type DynamicLightHandle } from '@/utils/dynamicLights';
import {
  SIEGE_BEAM_CORE_GEO,
  SIEGE_BEAM_INNER_GEO,
  SIEGE_BEAM_OUTER_GEO,
  SIEGE_BEAM_RING_GEO,
  SIEGE_BEAM_RING_INNER_GEO,
} from '@/components/projectiles/sharedProjectileGeometry';

const RING_COUNT = 4;
const DURATION_MS = 200;
const FADE_MS = 250;
const LIGHT_INTENSITY = 18;

const CORE_COLOR = new Color('#ccff00');
const INNER_COLOR = new Color('#55dd00');
const OUTER_COLOR = new Color('#aaff44');

interface SiegeTowerBeamProps {
  active: boolean;
  position: Vector3;
  direction: Vector3;
  beamLength: number;
  onComplete: () => void;
}

function makeBeamMat(color: Color, opacity: number): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  mat.userData.shared = false;
  return mat;
}

export default function SiegeTowerBeam({
  active,
  position,
  direction,
  beamLength,
  onComplete,
}: SiegeTowerBeamProps) {
  const groupRef = useRef<Group>(null);
  const alignRef = useRef<Group>(null);
  const pitchRef = useRef<Group>(null);
  const ringRefs = useRef<(Group | null)[]>([]);
  const startMs = useRef(0);
  const fading = useRef(false);
  const done = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const lightRef = useRef<DynamicLightHandle | null>(null);

  const mats = useMemo(
    () => ({
      core: makeBeamMat(CORE_COLOR, 0.95),
      inner: makeBeamMat(INNER_COLOR, 0.7),
      outer: makeBeamMat(OUTER_COLOR, 0.5),
      ring: makeBeamMat(OUTER_COLOR, 0.45),
      ringInner: makeBeamMat(CORE_COLOR, 0.35),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      mats.core.dispose();
      mats.inner.dispose();
      mats.outer.dispose();
      mats.ring.dispose();
      mats.ringInner.dispose();
    };
  }, [mats]);

  useEffect(() => {
    if (!active) {
      lightRef.current?.release();
      lightRef.current = null;
      done.current = true;
      fading.current = false;
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    startMs.current = performance.now();
    fading.current = false;
    done.current = false;
    lightRef.current = acquireDynamicLight({
      color: '#55dd00',
      distance: 9,
      decay: 2,
      priority: 2,
    });
    if (groupRef.current) groupRef.current.visible = true;
    return () => {
      lightRef.current?.release();
      lightRef.current = null;
    };
  }, [active]);

  useFrame(() => {
    if (done.current || !active) return;
    const g = groupRef.current;
    const align = alignRef.current;
    const pitch = pitchRef.current;
    if (!g || !align || !pitch) return;

    g.position.copy(position);
    align.rotation.set(0, Math.atan2(direction.x, direction.z), 0);
    pitch.rotation.set(
      Math.atan2(-direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)),
      0,
      0,
    );

    const elapsed = performance.now() - startMs.current;
    if (elapsed >= DURATION_MS && !fading.current) fading.current = true;
    const fadeElapsed = fading.current ? performance.now() - startMs.current - DURATION_MS : 0;
    const fade = fading.current ? Math.max(0, 1 - fadeElapsed / FADE_MS) : 1;

    const halfZ = beamLength * 0.5;
    lightRef.current?.setPosition(
      position.x + direction.x * halfZ,
      position.y + direction.y * halfZ,
      position.z + direction.z * halfZ,
    );
    lightRef.current?.setIntensity(LIGHT_INTENSITY * fade);

    mats.core.opacity = 0.95 * fade;
    mats.inner.opacity = 0.7 * fade;
    mats.outer.opacity = 0.5 * fade;
    mats.ring.opacity = 0.45 * fade;
    mats.ringInner.opacity = 0.35 * fade;

    const t = elapsed * 0.001;
    const lenScale = Math.max(0.25, beamLength / 18);
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = ringRefs.current[i];
      if (!ring) continue;
      ring.position.z = i * 2.8 * lenScale;
      const spin = ring.children[0] as Mesh | undefined;
      const spin2 = ring.children[1] as Mesh | undefined;
      if (spin) spin.rotation.y = t * 2.5 + i;
      if (spin2) spin2.rotation.y = t * -3.5 + i;
    }

    if (fading.current && fadeElapsed >= FADE_MS) {
      done.current = true;
      lightRef.current?.setIntensity(0);
      if (g) g.visible = false;
      onCompleteRef.current();
    }
  });

  const halfZ = beamLength * 0.5;

  return (
    <group ref={groupRef} visible={active}>
      <group ref={alignRef}>
        <group ref={pitchRef}>
          <mesh
            geometry={SIEGE_BEAM_CORE_GEO}
            material={mats.core}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, halfZ]}
            scale={[1, beamLength, 1]}
          />
          <mesh
            geometry={SIEGE_BEAM_INNER_GEO}
            material={mats.inner}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, halfZ]}
            scale={[1, beamLength, 1]}
          />
          <mesh
            geometry={SIEGE_BEAM_OUTER_GEO}
            material={mats.outer}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, halfZ]}
            scale={[1, beamLength, 1]}
          />
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <group
              key={i}
              ref={(el) => {
                ringRefs.current[i] = el;
              }}
            >
              <mesh geometry={SIEGE_BEAM_RING_GEO} material={mats.ring} />
              <mesh
                geometry={SIEGE_BEAM_RING_INNER_GEO}
                material={mats.ringInner}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[0.75, 0.75, 0.75]}
              />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
