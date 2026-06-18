import React, { useRef, useEffect, useMemo, memo } from 'react';
import {
  Group,
  Vector3,
  Color,
  Matrix4,
  Euler,
  Quaternion,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  InstancedMesh,
  OctahedronGeometry,
  CircleGeometry,
} from '@/utils/three-exports';
import { IcosahedronGeometry } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  createIceShellMaterial,
  createFrostGroundMaterial,
  createIceMoteMaterial,
} from '@/utils/frozenEffectShader';

const FROZEN_LIGHT_COLOR = new Color('#4FC3F7');
const _frozenLightPos = new Vector3();
const _shardPos = new Vector3();
const _shardRot = new Euler();
const _shardQuat = new Quaternion();
const _shardScale = new Vector3(1, 1, 1);
const _shardMatrix = new Matrix4();

const SHARD_COUNT = 8;
const MOTE_COUNT = 20;

interface FrozenEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  onComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
}

function buildMoteGeometry(count: number) {
  const indices = new Float32Array(count);
  const origins = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    indices[i] = i;
    origins[i * 3] = (Math.random() - 0.5) * 1.8;
    origins[i * 3 + 1] = Math.random() * 2.2 - 0.1;
    origins[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
    speeds[i] = 0.35 + Math.random() * 0.55;
    sizes[i] = 2.5 + Math.random() * 3.5;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aIndex', new Float32BufferAttribute(indices, 1));
  geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
  geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  return geometry;
}

const FrozenEffectComponent = memo(function FrozenEffect({
  position,
  duration = 5000,
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
}: FrozenEffectProps) {
  const effectRef = useRef<Group>(null);
  const shardsRef = useRef<InstancedMesh>(null);
  const timeRef = useRef(0);
  const hasCompleted = useRef(false);
  const rotationSpeed = useRef(Math.random() * 0.02 + 0.01);

  const shellGeo = useMemo(() => new IcosahedronGeometry(0.9, 1), []);
  const shellMat = useMemo(() => createIceShellMaterial(), []);
  const groundGeo = useMemo(() => new CircleGeometry(1.1, 32), []);
  const groundMat = useMemo(() => createFrostGroundMaterial(), []);
  const shardGeo = useMemo(() => new OctahedronGeometry(0.22, 0), []);
  const shardMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#B3E5FC',
        emissive: '#29B6F6',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
        metalness: 0.15,
        flatShading: true,
      }),
    [],
  );
  const moteGeo = useMemo(() => buildMoteGeometry(MOTE_COUNT), []);
  const moteMat = useMemo(() => createIceMoteMaterial(), []);

  const frozenLight = useDynamicLight({ color: FROZEN_LIGHT_COLOR, distance: 6, priority: 1 });

  const finish = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    onComplete?.();
  };

  useEffect(() => {
    const timeout = setTimeout(finish, duration);
    return () => clearTimeout(timeout);
  }, [duration, onComplete, enemyId, startTime]);

  useEffect(() => {
    const mesh = shardsRef.current;
    if (!mesh) return;

    for (let i = 0; i < SHARD_COUNT; i++) {
      const angle = (i / SHARD_COUNT) * Math.PI * 2;
      const radius = 0.72;
      _shardPos.set(
        Math.cos(angle) * radius,
        -0.15 + Math.sin(i * 1.1) * 0.28,
        Math.sin(angle) * radius,
      );
      _shardRot.set(Math.PI / 6, angle, Math.PI / 4);
      _shardQuat.setFromEuler(_shardRot);
      _shardMatrix.compose(_shardPos, _shardQuat, _shardScale);
      mesh.setMatrixAt(i, _shardMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      shellGeo.dispose();
      shellMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      shardGeo.dispose();
      shardMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
    };
  }, [shellGeo, shellMat, groundGeo, groundMat, shardGeo, shardMat, moteGeo, moteMat]);

  useFrame((_, delta) => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      finish();
      return;
    }

    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        effectRef.current.position.set(
          target.position.x,
          target.position.y + 0.5,
          target.position.z,
        );
      }
    }

    let frameFadeProgress: number;
    if (progress > 0.9) {
      const fade = (progress - 0.9) / 0.1;
      frameFadeProgress = 1 - fade;
    } else {
      frameFadeProgress = 1;
    }

    const pulseIntensity = 0.8 + 0.2 * Math.sin(elapsed * 0.005);
    const frameIntensity = pulseIntensity * frameFadeProgress;

    timeRef.current += delta;
    const t = timeRef.current;

    shellMat.uniforms.uTime.value = t;
    shellMat.uniforms.uOpacity.value = frameFadeProgress;
    shellMat.uniforms.uIntensity.value = frameIntensity;

    groundMat.uniforms.uTime.value = t;
    groundMat.uniforms.uOpacity.value = frameFadeProgress;
    groundMat.uniforms.uIntensity.value = frameIntensity;

    shardMat.opacity = 0.65 * frameFadeProgress;
    shardMat.emissiveIntensity = 0.4 * frameIntensity;

    moteMat.uniforms.uTime.value = t;
    moteMat.uniforms.uOpacity.value = frameFadeProgress;
    moteMat.uniforms.uIntensity.value = frameIntensity;

    effectRef.current.getWorldPosition(_frozenLightPos);
    frozenLight.current?.setPosition(_frozenLightPos.x, _frozenLightPos.y + 1, _frozenLightPos.z);
    frozenLight.current?.setIntensity(3 * frameIntensity * frameFadeProgress);

    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position}>
      <mesh
        geometry={shellGeo}
        material={shellMat}
        position={[0, 0.35, 0]}
        scale={[1, 1.15, 1]}
      />

      <mesh
        geometry={groundGeo}
        material={groundMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
      />

      <instancedMesh
        ref={shardsRef}
        args={[shardGeo, shardMat, SHARD_COUNT]}
        frustumCulled={false}
      />

      <points geometry={moteGeo} material={moteMat} frustumCulled={false} />
    </group>
  );
}, (prevProps, nextProps) => {
  if (!prevProps.position.equals(nextProps.position)) return false;
  if (prevProps.duration !== nextProps.duration) return false;
  if (prevProps.startTime !== nextProps.startTime) return false;
  if (prevProps.enemyId !== nextProps.enemyId) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;

  if (prevProps.enemyData && nextProps.enemyData) {
    for (let i = 0; i < prevProps.enemyData.length; i++) {
      const prev = prevProps.enemyData[i];
      const next = nextProps.enemyData[i];
      if (!prev || !next) return false;
      if (
        prev.id !== next.id ||
        prev.health !== next.health ||
        !prev.position.equals(next.position) ||
        prev.isDying !== next.isDying ||
        prev.deathStartTime !== next.deathStartTime
      ) {
        return false;
      }
    }
  }

  return true;
});

FrozenEffectComponent.displayName = 'FrozenEffect';

export default FrozenEffectComponent;
