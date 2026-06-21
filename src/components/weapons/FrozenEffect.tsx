import React, { useRef, useEffect, useMemo, memo } from 'react';
import {
  Group,
  Vector3,
  Matrix4,
  Euler,
  Quaternion,
  InstancedMesh,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import {
  sharedFrozenGeometries,
  cloneFrozenShellMaterial,
  cloneFrozenGroundMaterial,
  cloneFrozenSpikeMaterial,
} from '@/utils/frozenEffectShader';

const _spikePos = new Vector3();
const _spikeRot = new Euler();
const _spikeQuat = new Quaternion();
const _spikeScale = new Vector3(1, 1, 1);
const _spikeMatrix = new Matrix4();

const CORNER_OFFSETS: [number, number, number][] = [
  [0.52, 0.35, 0.52],
  [-0.52, 0.15, 0.52],
  [0.52, -0.05, -0.52],
  [-0.52, 0.25, -0.52],
  [0, 0.58, 0],
  [0, 0.28, 0.52],
  [0, 0.12, -0.52],
];
const SPIKE_COUNT = CORNER_OFFSETS.length;

interface FrozenEffectProps {
  position: Vector3;
  positionRef?: React.MutableRefObject<Vector3>;
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

const FrozenEffectComponent = memo(function FrozenEffect({
  position,
  positionRef,
  duration = 5000,
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
}: FrozenEffectProps) {
  const effectRef = useRef<Group>(null);
  const spikesRef = useRef<InstancedMesh>(null);
  const hasCompleted = useRef(false);
  const rotationSpeed = useRef(Math.random() * 0.02 + 0.01);

  const shellMat = useMemo(() => cloneFrozenShellMaterial(), []);
  const groundMat = useMemo(() => cloneFrozenGroundMaterial(), []);
  const spikeMat = useMemo(() => cloneFrozenSpikeMaterial(), []);

  const blockScale = useMemo(
    (): [number, number, number] => [
      0.92 + Math.random() * 0.14,
      0.95 + Math.random() * 0.12,
      0.92 + Math.random() * 0.14,
    ],
    [],
  );

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
    const mesh = spikesRef.current;
    if (!mesh) return;

    for (let i = 0; i < SPIKE_COUNT; i++) {
      const [cx, cy, cz] = CORNER_OFFSETS[i];
      _spikePos.set(cx, cy, cz);
      const outward = Math.atan2(cx, cz);
      _spikeRot.set(Math.PI / 5, outward + Math.PI / 4, Math.PI / 6);
      _spikeQuat.setFromEuler(_spikeRot);
      _spikeMatrix.compose(_spikePos, _spikeQuat, _spikeScale);
      mesh.setMatrixAt(i, _spikeMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      shellMat.dispose();
      groundMat.dispose();
      spikeMat.dispose();
    };
  }, [shellMat, groundMat, spikeMat]);

  useFrame(() => {
    if (!effectRef.current) return;

    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      finish();
      return;
    }

    if (positionRef?.current) {
      effectRef.current.position.copy(positionRef.current);
      effectRef.current.position.y -= 0.5;
    } else if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        effectRef.current.position.set(
          target.position.x,
          target.position.y + 0.5,
          target.position.z,
        );
      }
    }

    const frameFadeProgress = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;
    const pulseIntensity = 0.8 + 0.2 * Math.sin(elapsed * 0.005);
    const frameIntensity = pulseIntensity * frameFadeProgress;

    shellMat.opacity = 0.42 * frameFadeProgress;
    shellMat.emissiveIntensity = 0.35 * frameIntensity;

    groundMat.opacity = 0.45 * frameFadeProgress * frameIntensity;

    spikeMat.opacity = 0.7 * frameFadeProgress;
    spikeMat.emissiveIntensity = 0.55 * frameIntensity;

    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position} position-y={-0.5}>
      <mesh
        geometry={sharedFrozenGeometries.jaggedBlock}
        material={shellMat}
        position={[0, 0.35, 0]}
        scale={blockScale}
      />

      <mesh
        geometry={sharedFrozenGeometries.ground}
        material={groundMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
      />

      <instancedMesh
        ref={spikesRef}
        args={[sharedFrozenGeometries.spike, spikeMat, SPIKE_COUNT]}
      />
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
