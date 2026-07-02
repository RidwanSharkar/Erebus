import React, { useRef, useMemo } from 'react';
import { Vector3, Color, Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const PVP_REANIMATE_LIGHT_COLOR = new Color('#ff8800');

interface PVPReanimateEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const RING_COUNT = 3;
const PARTICLE_COUNT = 12;

const PVPReanimateEffect: React.FC<PVPReanimateEffectProps> = React.memo(({ position, onComplete }) => {
  const timeRef = useRef(0);
  const duration = 1.5;
  const hasCompleted = useRef(false);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const centerMeshRef = useRef<Mesh>(null);
  const centerMatRef = useRef<MeshStandardMaterial>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);
  const particleMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);

  const healLight = useDynamicLight({ color: PVP_REANIMATE_LIGHT_COLOR, distance: 5, decay: 2, priority: 1 });

  useFrame((_, delta) => {
    if (hasCompleted.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const progress = Math.min(t / duration, 1);
    const opacity = Math.sin(progress * Math.PI);
    const scale = 1 + progress * 2;

    healLight.current?.setPosition(position.x, position.y, position.z);
    healLight.current?.setIntensity(2 * opacity);

    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = ringRefs.current[i];
      if (mesh) {
        mesh.position.set(0, progress * 2 + i * 0.5, 0);
        mesh.rotation.set(Math.PI / 2, 0, t * 2);
      }
      const mat = ringMatRefs.current[i];
      if (mat) mat.opacity = opacity * (1 - i * 0.2);
    }

    if (centerMeshRef.current) {
      centerMeshRef.current.scale.setScalar(scale);
    }
    if (centerMatRef.current) {
      centerMatRef.current.opacity = opacity * 0.3;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = particleRefs.current[i];
      if (mesh) {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const radius = 0.75 + progress;
        const yOffset = progress * 2;
        mesh.position.set(
          Math.cos(angle + t * 2) * radius / 1.1,
          yOffset + Math.sin(t * 3 + i) * 0.5,
          Math.sin(angle + t * 2) * radius / 1.1,
        );
      }
      const mat = particleMatRefs.current[i];
      if (mat) mat.opacity = opacity * 0.8;
    }

    if (t >= duration) {
      hasCompleted.current = true;
      onComplete();
    }
  });

  const rings = useMemo(() => [...Array(RING_COUNT)], []);
  const particles = useMemo(() => [...Array(PARTICLE_COUNT)], []);

  return (
    <group position={position.toArray()}>
      {rings.map((_, i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => { ringRefs.current[i] = el; }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            ref={(el) => { ringMatRefs.current[i] = el; }}
            color="#ffaa00"
            emissive="#ff8800"
            emissiveIntensity={1.5}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      <mesh ref={centerMeshRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          ref={centerMatRef}
          color="#ffaa00"
          emissive="#ff8800"
          emissiveIntensity={2}
          transparent
          opacity={0}
        />
      </mesh>

      {particles.map((_, i) => (
        <mesh
          key={`particle-${i}`}
          ref={(el) => { particleRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.095, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => { particleMatRefs.current[i] = el; }}
            color="#ffaa00"
            emissive="#ff8800"
            emissiveIntensity={2.5}
            transparent
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
});

PVPReanimateEffect.displayName = 'PVPReanimateEffect';

export default PVPReanimateEffect;
