import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, Material, Mesh, MeshStandardMaterial, Vector3 } from '@/utils/three-exports';

interface EntangledEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  followTargetId?: string;
  onComplete?: () => void;
  /** 'default' = green vines; 'spider' = grey/white web. */
  theme?: 'default' | 'spider';
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
  followTargetData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
}

const THEME_COLORS = {
  default: {
    ground: '#2f7a26',
    groundEmissive: '#33ff55',
    vine: '#225c1d',
    vineEmissive: '#1aff55',
    orb: '#4bbf39',
    orbEmissive: '#66ff66',
    ring: '#33ff55',
  },
  spider: {
    ground: '#9ca3af',
    groundEmissive: '#e5e7eb',
    vine: '#6b7280',
    vineEmissive: '#f3f4f6',
    orb: '#d1d5db',
    orbEmissive: '#ffffff',
    ring: '#e5e7eb',
  },
} as const;

export default function EntangledEffect({
  position,
  duration = 5000,
  startTime = Date.now(),
  enemyId,
  followTargetId,
  enemyData = [],
  followTargetData = [],
  onComplete,
  theme = 'default',
}: EntangledEffectProps) {
  const colors = THEME_COLORS[theme] ?? THEME_COLORS.default;
  const rootRef = useRef<Group>(null);
  const groundMatRef = useRef<MeshStandardMaterial>(null);
  const groundMeshRef = useRef<Mesh>(null);
  const vineGroupRefs = useRef<(Group | null)[]>([]);
  const vineMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const vineOrbMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const ringMeshRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);

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
    } else if (followTargetId && followTargetData.length > 0) {
      const target = followTargetData.find(entry => entry.id === followTargetId);
      if (target && target.health > 0) {
        group.position.copy(target.position);
      }
    }

    const emerge = Math.min(1, progress / 0.22);
    const fade = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;
    const squeeze = 0.88 + Math.sin(elapsed * 0.009) * 0.08;

    group.scale.set(1, emerge, 1);
    group.rotation.y = elapsed * 0.0015;

    if (groundMeshRef.current) {
      groundMeshRef.current.scale.set(squeeze, squeeze, 1);
    }
    if (groundMatRef.current) {
      groundMatRef.current.opacity = 0.55 * fade;
    }

    for (let i = 0; i < vines.length; i++) {
      const vine = vines[i];
      const vineGroup = vineGroupRefs.current[i];
      if (vineGroup) {
        vineGroup.position.set(
          Math.cos(vine.angle) * vine.radius * squeeze,
          vine.height * 0.5 - 0.05,
          Math.sin(vine.angle) * vine.radius * squeeze,
        );
      }
      const vineMat = vineMatRefs.current[i];
      if (vineMat) vineMat.opacity = 0.78 * fade;
      const orbMat = vineOrbMatRefs.current[i];
      if (orbMat) orbMat.opacity = 0.65 * fade;
    }

    for (let i = 0; i < 3; i++) {
      const ringMesh = ringMeshRefs.current[i];
      if (ringMesh) {
        const ringScale = (0.48 * squeeze - i * 0.035);
        ringMesh.scale.set(ringScale, ringScale, 1);
      }
      const ringMat = ringMatRefs.current[i];
      if (ringMat) ringMat.opacity = (0.38 - i * 0.06) * fade;
    }
  });

  return (
    <group ref={rootRef} position={position}>
      <mesh ref={groundMeshRef} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.035, 8, 32]} />
        <meshStandardMaterial
          ref={groundMatRef}
          color={colors.ground}
          emissive={colors.groundEmissive}
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
          roughness={0.65}
        />
      </mesh>

      {vines.map((vine, i) => (
        <group
          key={i}
          ref={(el) => { vineGroupRefs.current[i] = el; }}
          position={[Math.cos(vine.angle) * vine.radius, vine.height * 0.5 - 0.05, Math.sin(vine.angle) * vine.radius]}
          rotation={[vine.tilt, vine.angle, -vine.tilt * 0.45]}
        >
          <mesh>
            <cylinderGeometry args={[0.035, 0.055, vine.height, 7]} />
            <meshStandardMaterial
              ref={(el) => { vineMatRefs.current[i] = el; }}
              color={colors.vine}
              emissive={colors.vineEmissive}
              emissiveIntensity={0.45}
              transparent
              opacity={0.78}
              roughness={0.9}
            />
          </mesh>
          <mesh position={[0, vine.height * 0.35, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial
              ref={(el) => { vineOrbMatRefs.current[i] = el; }}
              color={colors.orb}
              emissive={colors.orbEmissive}
              emissiveIntensity={0.55}
              transparent
              opacity={0.65}
            />
          </mesh>
        </group>
      ))}

      {[0, 1, 2].map(i => (
        <mesh
          key={i}
          ref={(el) => { ringMeshRefs.current[i] = el; }}
          position={[0, 0.35 + i * 0.34, 0]}
          rotation={[Math.PI / 2, 0, i * 0.7]}
        >
          <torusGeometry args={[1, 0.025, 8, 28]} />
          <meshStandardMaterial
            ref={(el) => { ringMatRefs.current[i] = el; }}
            color={colors.ring}
            emissive={colors.ring}
            emissiveIntensity={0.65}
            transparent
            opacity={0.38 - i * 0.06}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
