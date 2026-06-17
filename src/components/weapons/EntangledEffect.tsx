import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, Material, Mesh, Vector3 } from '@/utils/three-exports';

interface EntangledEffectProps {
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

export default function EntangledEffect({
  position,
  duration = 5000,
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
}: EntangledEffectProps) {
  const rootRef = useRef<Group>(null);
  const [fadeProgress, setFadeProgress] = useState(1);
  const [squeeze, setSqueeze] = useState(1);

  const vines = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * Math.PI * 2,
        radius: 0.42 + (i % 2) * 0.12,
        height: 0.75 + (i % 3) * 0.24,
        tilt: (i % 2 === 0 ? 1 : -1) * (0.35 + (i % 3) * 0.08),
      })),
    [],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, position, startTime]);

  useEffect(() => {
    return () => {
      rootRef.current?.traverse(child => {
        if (child instanceof Mesh) {
          child.geometry?.dispose();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((mat: Material) => mat.dispose());
          } else {
            material?.dispose();
          }
        }
      });
    };
  }, []);

  useFrame(() => {
    const group = rootRef.current;
    if (!group) return;

    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    if (progress >= 1) {
      onComplete?.();
      return;
    }

    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        group.position.copy(target.position);
      }
    }

    const emerge = Math.min(1, progress / 0.22);
    const fade = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;
    setFadeProgress(fade);
    setSqueeze(0.88 + Math.sin(elapsed * 0.009) * 0.08);

    group.scale.set(1, emerge, 1);
    group.rotation.y = elapsed * 0.0015;
  });

  return (
    <group ref={rootRef} position={position}>
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68 * squeeze, 0.035, 8, 32]} />
        <meshStandardMaterial
          color="#2f7a26"
          emissive="#33ff55"
          emissiveIntensity={0.8}
          transparent
          opacity={0.55 * fadeProgress}
          roughness={0.65}
        />
      </mesh>

      {vines.map((vine, i) => {
        const x = Math.cos(vine.angle) * vine.radius * squeeze;
        const z = Math.sin(vine.angle) * vine.radius * squeeze;
        return (
          <group key={i} position={[x, vine.height * 0.5 - 0.05, z]} rotation={[vine.tilt, vine.angle, -vine.tilt * 0.45]}>
            <mesh>
              <cylinderGeometry args={[0.035, 0.055, vine.height, 7]} />
              <meshStandardMaterial
                color="#225c1d"
                emissive="#1aff55"
                emissiveIntensity={0.45}
                transparent
                opacity={0.78 * fadeProgress}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[0, vine.height * 0.35, 0]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial
                color="#4bbf39"
                emissive="#66ff66"
                emissiveIntensity={0.55}
                transparent
                opacity={0.65 * fadeProgress}
              />
            </mesh>
          </group>
        );
      })}

      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.35 + i * 0.34, 0]} rotation={[Math.PI / 2, 0, i * 0.7]}>
          <torusGeometry args={[0.48 * squeeze - i * 0.035, 0.025, 8, 28]} />
          <meshStandardMaterial
            color="#3da435"
            emissive="#55ff66"
            emissiveIntensity={0.65}
            transparent
            opacity={(0.38 - i * 0.06) * fadeProgress}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
