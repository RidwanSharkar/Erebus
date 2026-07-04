import { useEffect, useMemo, useRef } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending, SphereGeometry } from 'three';
import { MeshStandardMaterial } from '@/utils/three-exports';

interface ElementalVortexProps {
  parentRef: React.RefObject<Group>;
}

const PIECE_COUNT = 35;
const VORTEX_SPHERE_GEO = new SphereGeometry(0.15, 8, 8);
const VORTEX_MAT = new MeshStandardMaterial({
  color: '#BA55D3',
  emissive: '#BA55D3',
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.7,
  blending: AdditiveBlending,
  depthWrite: false,
});

function ElementalVortex({ parentRef }: ElementalVortexProps) {
  void parentRef;
  const vortexPiecesRef = useRef<(Group | null)[]>([]);
  const pieceCount = PIECE_COUNT;
  const baseRadius = 1.25;
  const groupRef = useRef<Group>(null);

  const pieceIndices = useMemo(() => Array.from({ length: pieceCount }, (_, i) => i), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    vortexPiecesRef.current.forEach((piece, i) => {
      if (!piece) return;

      const time = clock.getElapsedTime();
      const heightOffset = ((i / pieceCount) * 1.5 - 0.1275);
      const radiusMultiplier = 0.8 - heightOffset * 0.375;

      const spiralAngle = (i / pieceCount) * Math.PI * 6 + time * 1.5;
      const floatAngle = time * 2 + i * 0.5;
      const radius = baseRadius * radiusMultiplier + Math.sin(floatAngle) * 0.2;

      const x = Math.cos(spiralAngle) * radius;
      const z = Math.sin(spiralAngle) * radius;
      const y = heightOffset + Math.sin(time * 2 + i) * 0.3 + 0.2;

      piece.position.set(x, y, z);

      piece.rotation.y = spiralAngle + Math.PI / 2;
      piece.rotation.x = Math.sin(time + i) * 0.2;
      piece.rotation.z = Math.cos(time * 0.8 + i) * 0.2;

      const meshChild = piece.children[0] as Mesh;
      if (meshChild?.material) {
        const material = meshChild.material as MeshStandardMaterial;
        const fadeProgress = heightOffset / 1.5;
        material.opacity = Math.max(0.2, 0.8 * (1 - fadeProgress));
        const scale = 1 - fadeProgress * 0.3;
        piece.scale.setScalar(scale);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {pieceIndices.map((i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) vortexPiecesRef.current[i] = el;
          }}
        >
          <mesh geometry={VORTEX_SPHERE_GEO} material={VORTEX_MAT} />
        </group>
      ))}

      <EnemyDynamicLight
        color="#BA55D3"
        intensity={12}
        distance={12}
        decay={1.2}
        position={[0, 0.5, 0]}
      />
    </group>
  );
}

export default ElementalVortex;
