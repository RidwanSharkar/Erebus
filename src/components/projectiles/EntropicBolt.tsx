import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  Vector3,
  Group,
  Color,
  Quaternion,
  Mesh,
  MeshStandardMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import EntropicBoltTrail, { ENTROPIC_TRAIL_FADE_OUT_DURATION } from './EntropicBoltTrail';
import { getEntropicColorTheme } from '@/utils/entropicColorThemes';
import {
  computeEntropicChaosOffset,
  entropicChaosSeedFromId,
} from '@/utils/entropicBoltChaos';

export const ENTROPIC_BOLT_MODEL_PATH = '/models/trinket/boltProjectile.glb';
/** ~2× prior bolt height; tune after in-game look test */
export const ENTROPIC_BOLT_MODEL_SCALE = 0.24;

useGLTF.preload(ENTROPIC_BOLT_MODEL_PATH);

interface EntropicBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  isCryoflame?: boolean;
  colorVariant?: string;
  /** Overrides `colorVariant` for custom palettes (defense towers, etc). */
  themeOverride?: { primary: string; secondary: string; light: string };
  /** When true (default), position/direction follow authoritative ECS updates each frame. */
  ecsDriven?: boolean;
  /** R3F clock time when ECS despawn trail fade began; visual-only. */
  trailFadeOutStartElapsed?: number;
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const _dir = new Vector3();
const _quat = new Quaternion();
const _flightDir = new Vector3();
const _basePos = new Vector3();
const _chaosOffset = new Vector3();
const _deltaPos = new Vector3();
const WOBBLE_ROLL = 0.1;

function alignBoltToDirection(group: Group | null, direction: Vector3) {
  if (!group) return;
  _dir.copy(direction).normalize();
  if (Math.abs(_dir.dot(AXIS_Y)) > 0.985) {
    _quat.setFromUnitVectors(FALLBACK_UP, _dir);
  } else {
    _quat.setFromUnitVectors(AXIS_Y, _dir);
  }
  group.quaternion.copy(_quat);
}

function EntropicBolt({
  id,
  position,
  direction,
  isCryoflame = false,
  colorVariant,
  themeOverride,
  ecsDriven = true,
  trailFadeOutStartElapsed,
}: EntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const wobbleRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const lastPosition = useRef(position.clone());
  const flightDirectionRef = useRef(_flightDir.copy(direction));
  const timeRef = useRef(0);
  const chaosSeed = useMemo(() => entropicChaosSeedFromId(id), [id]);

  const theme = themeOverride ?? getEntropicColorTheme(colorVariant, isCryoflame);
  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const trailAccent = useMemo(
    () => new Color(themeOverride ? theme.secondary : theme.primary),
    [theme.primary, theme.secondary, themeOverride],
  );
  const primaryColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const secondaryColor = useMemo(() => new Color(theme.secondary), [theme.secondary]);

  const boltLight = useDynamicLight({ color: theme.light, distance: 7, decay: 2, priority: 2 });

  const { scene } = useGLTF(ENTROPIC_BOLT_MODEL_PATH);

  const { clonedScene, themeMats } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    applyWeaponItemGlow(clone);

    const mats: MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of list) {
        const std = mat as MeshStandardMaterial;
        if (!std?.emissive) continue;
        mats.push(std);
      }
    });
    return { clonedScene: clone, themeMats: mats };
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  useEffect(() => {
    for (const mat of themeMats) {
      if (mat.color) {
        mat.color.copy(secondaryColor);
      }
      mat.emissive.copy(primaryColor);
      mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 3.5);
      mat.needsUpdate = true;
    }
  }, [themeMats, primaryColor, secondaryColor]);

  const isTrailFading = trailFadeOutStartElapsed !== undefined;
  const hideBoltBody = isTrailFading;

  useEffect(() => {
    if (boltRef.current) {
      boltRef.current.position.copy(position);
      lastPosition.current.copy(position);
    }
  }, [position]);

  useFrame((state, delta) => {
    if (!boltRef.current) return;

    if (isTrailFading) {
      const fadeElapsed = state.clock.elapsedTime - trailFadeOutStartElapsed!;
      if (fadeElapsed >= ENTROPIC_TRAIL_FADE_OUT_DURATION) {
        boltLight.current?.setIntensity(0);
        return;
      }
    }

    if (hideBoltBody) {
      boltLight.current?.setIntensity(0);
      return;
    }

    timeRef.current += delta;
    const pulse = 1 + Math.sin(timeRef.current * 14) * 0.06;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(ENTROPIC_BOLT_MODEL_SCALE * pulse);
    }

    if (ecsDriven) {
      _basePos.copy(position);

      flightDirectionRef.current.copy(direction);
      if (direction.lengthSq() > 1e-8) {
        lastPosition.current.copy(position);
      } else {
        const deltaPos = _deltaPos.copy(position).sub(lastPosition.current);
        if (deltaPos.lengthSq() > 1e-8) {
          flightDirectionRef.current.copy(deltaPos.normalize());
        }
        lastPosition.current.copy(position);
      }

      computeEntropicChaosOffset(
        flightDirectionRef.current,
        timeRef.current,
        chaosSeed,
        _chaosOffset,
      );
      boltRef.current.position.copy(_basePos).add(_chaosOffset);

      const visual = boltRef.current.position;
      boltLight.current?.setPosition(visual.x, visual.y + 0.15, visual.z);
      boltLight.current?.setIntensity(5.5);

      if (orientRef.current) {
        alignBoltToDirection(orientRef.current, flightDirectionRef.current);
      }
      if (wobbleRef.current) {
        const t = timeRef.current;
        const s = chaosSeed * 17.3;
        wobbleRef.current.rotation.x = Math.sin(t * 9.1 + s) * WOBBLE_ROLL;
        wobbleRef.current.rotation.z = Math.cos(t * 7.4 + s * 1.4) * WOBBLE_ROLL;
      }
    } else {
      boltRef.current.position.copy(position);
      flightDirectionRef.current.copy(direction);
      if (direction.lengthSq() > 1e-8) {
        lastPosition.current.copy(position);
      }
      const visual = boltRef.current.position;
      boltLight.current?.setPosition(visual.x, visual.y + 0.15, visual.z);
      boltLight.current?.setIntensity(5.5);
      if (orientRef.current) {
        alignBoltToDirection(orientRef.current, flightDirectionRef.current);
      }
      if (wobbleRef.current) {
        const t = timeRef.current;
        const s = chaosSeed * 17.3;
        wobbleRef.current.rotation.x = Math.sin(t * 9.1 + s) * WOBBLE_ROLL;
        wobbleRef.current.rotation.z = Math.cos(t * 7.4 + s * 1.4) * WOBBLE_ROLL;
      }
    }
  });

  return (
    <group>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.07}
        meshRef={boltRef}
        opacity={1}
        isCryoflame={isCryoflame}
        flightDirectionRef={flightDirectionRef}
        trailFadeOutStartElapsed={trailFadeOutStartElapsed ?? null}
        trailFadeOutDuration={ENTROPIC_TRAIL_FADE_OUT_DURATION}
      />

      <group ref={boltRef} position={position.toArray()}>
        {!hideBoltBody ? (
          <group ref={orientRef}>
            <group ref={wobbleRef}>
              <group ref={coreRef} scale={ENTROPIC_BOLT_MODEL_SCALE}>
                <primitive object={clonedScene} />
              </group>
            </group>
          </group>
        ) : null}
      </group>
    </group>
  );
}

export default React.memo(EntropicBolt);
