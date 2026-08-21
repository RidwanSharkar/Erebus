'use client';

import React, { Suspense, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { AdditiveBlending, Box3, Color, Group, Mesh as ThreeMesh } from '@/utils/three-exports';
import { applySelfIllumination } from '@/utils/disposeObject3D';
import { prepareNaturePropScene } from './ThroneNatureProps';
import {
  EXPLORE_CAMP_PROP_SELF_ILLUMINATION,
  EXPLORE_CAMP_PROP_URL,
  type ExploreCampKind,
  type ExploreCampPublic,
} from '@/utils/exploreCamps';
import { exploreFog } from '@/utils/exploreFogOfWar';
import { useMultiplayerActions, useMultiplayerRoom } from '@/contexts/MultiplayerContext';

/** Re-evaluate stream radius after this much player XZ travel (matches building cull step). */
const CAMP_PROP_CULL_STEP2 = 8 * 8;
const CAMP_AURA_COLOR: Record<ExploreCampKind, string> = {
  gold: '#eab308',
  stat: '#f97316',
  tempest: '#3b82f6',
  eldritch: '#22c55e',
  infernal: '#ef4444',
  abyssal: '#B18BFF',
  boss: '#8b5cf6',
};

/** Peak aura opacity while the pack is still alive (signifier only). */
const AURA_OPACITY_DIM = 0.28;
/** Peak aura opacity once cleared and claimable. */
const AURA_OPACITY_BRIGHT = 0.55;
/** Target world height after bake (matches rim / Fae numbered pylons). */
const CAMP_PROP_TARGET_HEIGHT = 3.2;

/**
 * Flatten GLB hierarchy into origin-centered meshes with world transforms baked
 * into geometry (same approach as ExploreInstancedTrees). Then normalize to
 * CAMP_PROP_TARGET_HEIGHT so nested node scale cannot blow past the pack.
 */
function bakeCampPropScene(scene: Object3D): { root: Group; groundY: number; scale: number } {
  const cloned = scene.clone(true);
  prepareNaturePropScene(cloned);
  cloned.updateWorldMatrix(true, true);

  const root = new Group();
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const geo = (mesh.geometry as BufferGeometry).clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!raw) return;
    const material = (raw as Material).clone();

    const out = new ThreeMesh(geo, material);
    out.castShadow = false;
    out.receiveShadow = false;
    out.frustumCulled = false;
    root.add(out);
  });

  applySelfIllumination(root, { intensity: EXPLORE_CAMP_PROP_SELF_ILLUMINATION });

  const box = new Box3().setFromObject(root);
  const height = Math.max(0.001, box.max.y - box.min.y);
  const scale = CAMP_PROP_TARGET_HEIGHT / height;
  const groundY = -box.min.y;

  return { root, groundY, scale };
}

function CampPropMesh({ kind }: { kind: ExploreCampKind }) {
  const url = EXPLORE_CAMP_PROP_URL[kind];
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => bakeCampPropScene(scene), [scene]);

  return (
    <primitive
      object={prepared.root}
      scale={prepared.scale}
      position={[0, prepared.groundY * prepared.scale, 0]}
    />
  );
}

/** Always-visible unlit marker so a GLB load failure never leaves an empty camp. */
function CampFallbackBeacon({ color }: { color: string }) {
  const tint = useMemo(() => new Color(color), [color]);
  return (
    <group name="explore-camp-fallback-beacon">
      <mesh position={[0, 1.1, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.18, 0.28, 2.2, 10]} />
        <meshBasicMaterial color={tint} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} frustumCulled={false}>
        <ringGeometry args={[0.45, 0.7, 24]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function CampAura({ color, intensity }: { color: string; intensity: number }) {
  const aura1Ref = useRef<Object3D>(null);
  const aura2Ref = useRef<Object3D>(null);
  const tint = useMemo(() => new Color(color), [color]);
  const peakOpacity = intensity;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (aura1Ref.current) {
      const cycle = (t * 0.6) % 1;
      const s = 0.6 + cycle * 2.8;
      aura1Ref.current.scale.set(s, 1, s);
      const m = (aura1Ref.current as Mesh).material as { opacity?: number } | undefined;
      if (m) m.opacity = (1 - cycle) * peakOpacity;
    }
    if (aura2Ref.current) {
      const cycle = ((t * 0.6) + 0.5) % 1;
      const s = 0.6 + cycle * 2.8;
      aura2Ref.current.scale.set(s, 1, s);
      const m = (aura2Ref.current as Mesh).material as { opacity?: number } | undefined;
      if (m) m.opacity = (1 - cycle) * peakOpacity;
    }
  });

  return (
    <group>
      <mesh ref={aura1Ref as any} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} frustumCulled={false}>
        <ringGeometry args={[0.35, 0.55, 32]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={peakOpacity}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={aura2Ref as any} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} frustumCulled={false}>
        <ringGeometry args={[0.35, 0.55, 32]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={peakOpacity}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function ExploreCampProp({
  camp,
  auraIntensity,
}: {
  camp: ExploreCampPublic;
  auraIntensity: number;
}) {
  const auraColor = CAMP_AURA_COLOR[camp.kind];

  return (
    <group position={[camp.x, 0, camp.z]} name={`explore-camp-${camp.id}`}>
      <Suspense fallback={<CampFallbackBeacon color={auraColor} />}>
        <CampPropMesh kind={camp.kind} />
      </Suspense>
      {auraIntensity > 0 && <CampAura color={auraColor} intensity={auraIntensity} />}
    </group>
  );
}

export function preloadExploreCampPropGlbs(): void {
  for (const url of Object.values(EXPLORE_CAMP_PROP_URL)) {
    useGLTF.preload(url);
  }
}

export default function ExploreCampProps() {
  const { exploreCamps } = useMultiplayerRoom();
  const { socket } = useMultiplayerActions();
  const localId = socket?.id ?? null;
  const lastCullX = useRef(Number.POSITIVE_INFINITY);
  const lastCullZ = useRef(Number.POSITIVE_INFINITY);
  const [cullTick, setCullTick] = useState(0);

  useFrame(() => {
    const viewer = exploreFog.getViewer();
    const dx = viewer.x - lastCullX.current;
    const dz = viewer.z - lastCullZ.current;
    if (dx * dx + dz * dz < CAMP_PROP_CULL_STEP2) return;
    lastCullX.current = viewer.x;
    lastCullZ.current = viewer.z;
    setCullTick((n) => n + 1);
  });

  const visible = useMemo(() => {
    if (!exploreCamps?.length) return [];
    const viewer = exploreFog.getViewer();
    return exploreCamps.filter((c) => {
      if (localId && c.claimedBy.includes(localId)) return false;
      return exploreFog.isExploreEntityInRenderRange(c.x, c.z, viewer.x, viewer.z);
    });
  }, [exploreCamps, localId, cullTick]);

  if (visible.length === 0) return null;

  return (
    <group name="explore-camp-props">
      {visible.map((camp) => {
        const claimedByMe = localId ? camp.claimedBy.includes(localId) : false;
        // Dim kind-colored aura from spawn; bright when cleared and claimable.
        const auraIntensity = claimedByMe
          ? 0
          : camp.cleared
            ? AURA_OPACITY_BRIGHT
            : AURA_OPACITY_DIM;
        return (
          <ExploreCampProp key={camp.id} camp={camp} auraIntensity={auraIntensity} />
        );
      })}
    </group>
  );
}
