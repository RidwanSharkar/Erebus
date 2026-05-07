import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { Mesh } from 'three';
import { useFrame, type RootState } from '@react-three/fiber';

interface SpellCastingHalosProps {
  isActive: boolean;
}

const DURATION = 1.5;
const RING_COUNT = 3;

/**
 * Small rising halos — same mesh recipe as Reanimate healing rings, scaled ~50%.
 * Mount as a child of the player weapon/character group (local space) so it follows movement.
 */
export default function SpellCastingHalos({ isActive }: SpellCastingHalosProps) {
  const meshRefs = useRef<(Mesh | null)[]>([]);
  const opacityRef = useRef(0);
  const [shouldRender, setShouldRender] = useState(false);
  const timeRef = useRef(0);

  useEffect(() => {
    if (isActive) setShouldRender(true);
  }, [isActive]);

  const ringMaterial = useMemo(
    () => ({
      color: '#ffaa00' as const,
      emissive: '#ff8800' as const,
      emissiveIntensity: 2,
      transparent: true as const,
      depthWrite: false as const,
    }),
    [],
  );

  const onFrame = useCallback(
    (_: RootState, delta: number) => {
      const target = isActive ? 1 : 0;
      const diff = target - opacityRef.current;
      if (Math.abs(diff) > 0.004) {
        opacityRef.current += diff * 0.08;
      } else {
        opacityRef.current = target;
      }

      if (isActive) {
        timeRef.current += delta;
      }

      const t = timeRef.current;
      const progress = (t % DURATION) / DURATION;
      const waveOpacity = Math.sin(progress * Math.PI);

      for (let i = 0; i < RING_COUNT; i++) {
        const mesh = meshRefs.current[i];
        if (!mesh) continue;
        mesh.position.y = progress * 1 + i * 0.15;
        mesh.rotation.set(Math.PI / 2, 0, t * 2);
        const mat = mesh.material as { opacity: number };
        mat.opacity = waveOpacity * (1 - i * 0.2) * opacityRef.current;
      }

      if (!isActive && opacityRef.current <= 0.004) {
        opacityRef.current = 0;
        if (shouldRender) setShouldRender(false);
      }
    },
    [isActive, shouldRender],
  );

  useFrame(onFrame);

  if (!shouldRender) return null;

  return (
    <group>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh
          key={`cast-ring-${i}`}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          
        >
          <torusGeometry args={[0.3 - i * 0.075, 0.02, 16, 32]} />
          <meshStandardMaterial
            {...ringMaterial}
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
}
