'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Vector3,
  Mesh,
  AdditiveBlending,
  DoubleSide,
  RingGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  Group,
} from '@/utils/three-exports';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { applyWeaponItemGlow, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  VALKYRIE_JUDGMENT_MODEL_POSITION,
  VALKYRIE_JUDGMENT_MODEL_SCALE,
  VALKYRIE_JUDGMENT_SWORD_ROTATION,
} from '@/utils/valkyrieJudgmentConstants';

export const DEATHDEALER_JUDGMENT_MODEL_PATH = '/models/items/deathdealerSWORD.glb';

/** No hover — fall starts immediately. */
export const DEATHDEALER_JUDGMENT_HOVER_MS = 0;
export const DEATHDEALER_JUDGMENT_FALL_MS = 450;
export const DEATHDEALER_JUDGMENT_SKY_HEIGHT = 16;
export const DEATHDEALER_JUDGMENT_IMPACT_BURST_MS = 280;
const DEATHDEALER_JUDGMENT_MODEL_SCALE = VALKYRIE_JUDGMENT_MODEL_SCALE * 1.7;

useGLTF.preload(DEATHDEALER_JUDGMENT_MODEL_PATH);

const IMPACT_PALETTE = {
  ring: '#7f0505',
  core: '#ff2a1a',
  light: '#ff4a2a',
} as const;

export interface DeathdealerJudgmentStrikeProps {
  position: Vector3;
  strikeAt: number;
  hoverMs?: number;
  fallMs?: number;
  skyHeight?: number;
  onComplete: () => void;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export default function DeathdealerJudgmentStrike({
  position,
  strikeAt,
  hoverMs = DEATHDEALER_JUDGMENT_HOVER_MS,
  fallMs = DEATHDEALER_JUDGMENT_FALL_MS,
  skyHeight = DEATHDEALER_JUDGMENT_SKY_HEIGHT,
  onComplete,
}: DeathdealerJudgmentStrikeProps) {
  const swordRef = useRef<Group>(null);
  const shockRingRef = useRef<Mesh>(null);
  const flashDiscRef = useRef<Mesh>(null);
  const doneRef = useRef(false);
  const backstabPlayedRef = useRef(false);

  const { scene: swordScene } = useGLTF(DEATHDEALER_JUDGMENT_MODEL_PATH);

  const clonedSwordScene = useMemo(() => {
    const clone = SkeletonUtils.clone(swordScene) as Group;
    applyWeaponItemGlow(clone);
    return clone;
  }, [swordScene]);

  useDisposeClonedMaterials(clonedSwordScene);

  const fallStart = strikeAt - fallMs;
  const appearAt = fallStart - hoverMs;
  const impactEnd = strikeAt + DEATHDEALER_JUDGMENT_IMPACT_BURST_MS;
  const groundY = position.y;

  const impactLight = useDynamicLight({
    color: IMPACT_PALETTE.light,
    distance: 16,
    decay: 2,
    priority: 1,
  });

  const matShockRing = useMemo(
    () =>
      new MeshBasicMaterial({
        color: IMPACT_PALETTE.ring,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const matFlashDisc = useMemo(
    () =>
      new MeshBasicMaterial({
        color: IMPACT_PALETTE.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );

  const shockRingGeo = useMemo(() => new RingGeometry(0.12, 0.42, 32), []);
  const flashDiscGeo = useMemo(() => new CircleGeometry(0.62, 16), []);

  useEffect(() => {
    return () => {
      matShockRing.dispose();
      matFlashDisc.dispose();
      shockRingGeo.dispose();
      flashDiscGeo.dispose();
    };
  }, [matShockRing, matFlashDisc, shockRingGeo, flashDiscGeo]);

  useFrame(() => {
    const now = Date.now();

    if (now >= impactEnd) {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
      return;
    }

    if (swordRef.current) {
      if (now < appearAt) {
        swordRef.current.visible = false;
      } else if (now < fallStart) {
        swordRef.current.visible = true;
        const hoverT = (now - appearAt) / Math.max(1, hoverMs);
        const bob = Math.sin(hoverT * Math.PI * 4) * 0.15;
        swordRef.current.position.set(position.x, groundY + skyHeight + bob, position.z);
      } else if (now < strikeAt) {
        if (!backstabPlayedRef.current) {
          backstabPlayedRef.current = true;
          (window as any).audioSystem?.playBackstabSound?.(position);
        }
        swordRef.current.visible = true;
        const fallProgress = easeInCubic((now - fallStart) / Math.max(1, fallMs));
        const y = groundY + skyHeight * (1 - fallProgress);
        swordRef.current.position.set(position.x, y, position.z);
      } else {
        swordRef.current.visible = false;
      }
    }

    if (now >= strikeAt) {
      const burstElapsed = now - strikeAt;
      const burstK = Math.min(1, burstElapsed / DEATHDEALER_JUDGMENT_IMPACT_BURST_MS);
      const fade = 1 - burstK;
      const easeOut = 1 - Math.pow(1 - burstK, 2);

      if (shockRingRef.current) {
        const ringScale = 0.35 + easeOut * 2.2;
        shockRingRef.current.scale.set(ringScale, ringScale, 1);
        matShockRing.opacity = 0.88 * fade * Math.min(1, burstK * 2.2);
      }
      if (flashDiscRef.current) {
        const discScale = 0.18 + easeOut * 2.0;
        flashDiscRef.current.scale.set(discScale, discScale, 1);
        matFlashDisc.opacity =
          0.78 *
          fade *
          (burstK < 0.45 ? burstK / 0.45 : Math.max(0, 1 - (burstK - 0.45) / 0.55));
      }

      impactLight.current?.setPosition(position.x, groundY + 0.15, position.z);
      impactLight.current?.setIntensity(34 * fade * Math.min(1, burstK * 1.8));
      impactLight.current?.setDistance(6 + easeOut * 5);
    }
  });

  return (
    <group>
      <group ref={swordRef} visible={false}>
        <group
          position={VALKYRIE_JUDGMENT_MODEL_POSITION}
          rotation={VALKYRIE_JUDGMENT_SWORD_ROTATION}
          scale={DEATHDEALER_JUDGMENT_MODEL_SCALE}
        >
          <primitive object={clonedSwordScene} />
        </group>
      </group>

      <group position={[position.x, groundY + 0.15, position.z]}>
        <mesh
          ref={shockRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={shockRingGeo}
          material={matShockRing}
          renderOrder={1}
        />
        <mesh
          ref={flashDiscRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={flashDiscGeo}
          material={matFlashDisc}
          renderOrder={2}
        />
      </group>
    </group>
  );
}
