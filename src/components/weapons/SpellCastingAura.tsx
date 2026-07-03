import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Group, MeshStandardMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface SpellCastingAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
}

const INNER_RUNE_ROTATIONS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as const;
const OUTER_RUNE_ROTATIONS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as const;
const DECORATIVE_RUNE_ROTATIONS = [
  0, Math.PI / 6, Math.PI / 3, Math.PI / 2, (Math.PI * 2) / 3, (Math.PI * 5) / 6,
  Math.PI, (Math.PI * 7) / 6, (Math.PI * 4) / 3, Math.PI * 1.5, (Math.PI * 5) / 3, (Math.PI * 11) / 6,
] as const;
const PARTICLE_ANGLES = [
  0, Math.PI / 3, (Math.PI * 2) / 3, Math.PI, (Math.PI * 4) / 3, (Math.PI * 5) / 3,
] as const;

const SpellCastingAura = forwardRef<{ isActive: boolean }, SpellCastingAuraProps>(({
  parentRef,
  isActive,
}, ref) => {
  const auraRef = useRef<Group>(null);
  const innerRunesRef = useRef<Group>(null);
  const decorativeRunesRef = useRef<Group>(null);
  const outerRunesRef = useRef<Group>(null);
  const particleGroupRefs = useRef<(Group | null)[]>([]);
  const centralDiscOuterMatRef = useRef<MeshStandardMaterial>(null);
  const centralDiscInnerMatRef = useRef<MeshStandardMaterial>(null);
  const opacityRef = useRef(0);
  const timeRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const shouldRenderRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);

  isActiveRef.current = isActive;
  shouldRenderRef.current = shouldRender;

  useImperativeHandle(ref, () => ({
    isActive,
  }));

  // Show the group as soon as activation starts so the fade-in can play
  useEffect(() => {
    if (isActive) setShouldRender(true);
  }, [isActive]);

  useFrame((_, delta) => {
    if (!auraRef.current || !parentRef.current) return;

    const parentPosition = parentRef.current.position;
    auraRef.current.position.set(parentPosition.x, 0.002, parentPosition.z);
    auraRef.current.rotation.y += 0.0012;

    const active = isActiveRef.current;

    // Smooth opacity fade
    const target = active ? 1 : 0;
    const diff = target - opacityRef.current;

    if (Math.abs(diff) > 0.004) {
      opacityRef.current += diff * 0.05;
    } else {
      opacityRef.current = target;
    }

    // Apply opacity to all transparent materials on this group
    auraRef.current.traverse((child: any) => {
      if (child.isMesh && child.material?.transparent) {
        const base: number = child.userData.baseOpacity ?? child.material.opacity;
        if (child.userData.baseOpacity === undefined) {
          child.userData.baseOpacity = child.material.opacity;
        }
        child.material.opacity = base * opacityRef.current;
      }
    });

    if (active) {
      timeRef.current += delta;
    } else {
      timeRef.current = 0;
    }

    const t = timeRef.current * 1000;

    if (innerRunesRef.current) {
      innerRunesRef.current.rotation.y = t * 0.0007;
    }
    if (decorativeRunesRef.current) {
      decorativeRunesRef.current.rotation.y = -t * 0.0004;
    }
    if (outerRunesRef.current) {
      outerRunesRef.current.rotation.y = t * 0.0008;
    }

    if (centralDiscOuterMatRef.current) {
      centralDiscOuterMatRef.current.emissiveIntensity = 2.5 + Math.sin(t * 0.003) * 0.5;
    }
    if (centralDiscInnerMatRef.current) {
      centralDiscInnerMatRef.current.emissiveIntensity = 3.0 + Math.cos(t * 0.004) * 0.3;
    }

    for (let i = 0; i < PARTICLE_ANGLES.length; i++) {
      const group = particleGroupRefs.current[i];
      if (!group || group.children.length < 2) continue;

      const angle = PARTICLE_ANGLES[i];
      const primary = group.children[0];
      const secondary = group.children[1];

      primary.position.set(
        Math.cos(angle + t * 0.001) * 0.9,
        Math.sin(t * 0.0008 + i) * 0.15,
        Math.sin(angle + t * 0.001) * 0.9,
      );
      secondary.position.set(
        Math.cos(angle + Math.PI + t * 0.0012) * 1.1,
        Math.sin(t * 0.001 + i) * 0.1,
        Math.sin(angle + Math.PI + t * 0.0012) * 1.1,
      );
    }

    // Once fully faded out, stop rendering
    if (!active && opacityRef.current <= 0.004) {
      opacityRef.current = 0;
      if (shouldRenderRef.current) setShouldRender(false);
    }
  });

  if (!shouldRender) return null;

  return (
    <group ref={auraRef}>

      {/* Inner rotating rune segments */}
      <group ref={innerRunesRef} position={[0, -0.4, 0]}>
        {INNER_RUNE_ROTATIONS.map((rotation, i) => (
          <mesh key={`inner-${i}`} rotation={[-Math.PI / 2, 0, rotation]}>
            <ringGeometry args={[0.5, 0.6, 8]} />
            <meshStandardMaterial
              color="#FFD700"
              emissive="#FFD700"
              emissiveIntensity={2.2}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Central magic disc with pulsing glow */}
      <group position={[0, -0.35, 0]}>
        <mesh scale={[1, 0.1, 1]}>
          <cylinderGeometry args={[0.4, 0.2, 0.05, 32]} />
          <meshStandardMaterial
            ref={centralDiscOuterMatRef}
            color="#FF6B35"
            emissive="#FF4500"
            emissiveIntensity={2.5}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={[1, 0.08, 1]}>
          <cylinderGeometry args={[0.25, 0.15, 0.03, 24]} />
          <meshStandardMaterial
            ref={centralDiscInnerMatRef}
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={3.0}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Orbiting particles */}
      <group position={[0, -0.3, 0]}>
        {PARTICLE_ANGLES.map((_, i) => (
          <group
            key={`particle-group-${i}`}
            ref={(el) => {
              particleGroupRefs.current[i] = el;
            }}
          >
            <mesh scale={[0.06, 0.06, 0.06]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial
                color="#FFA500"
                emissive="#FFA500"
                emissiveIntensity={3}
                transparent
                opacity={0.9}
                depthWrite={false}
              />
            </mesh>
            <mesh scale={[0.04, 0.04, 0.04]}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshStandardMaterial
                color="#FFD700"
                emissive="#FFD700"
                emissiveIntensity={2.5}
                transparent
                opacity={0.8}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Decorative counter-rotating rune ring */}
      <group ref={decorativeRunesRef} position={[0, -0.38, 0]}>
        {DECORATIVE_RUNE_ROTATIONS.map((rotation, i) => (
          <mesh key={`decorative-${i}`} rotation={[-Math.PI / 2, 0, -rotation]}>
            <ringGeometry args={[0.65, 0.7, 6]} />
            <meshStandardMaterial
              color="#FF6B35"
              emissive="#FF4500"
              emissiveIntensity={1.5}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Outer rotating triangle rings */}
      <group ref={outerRunesRef} position={[0, -0.5, 0]}>
        {OUTER_RUNE_ROTATIONS.map((rotation, i) => (
          <mesh key={`outer-${i}`} rotation={[-Math.PI / 2, 0, rotation]}>
            <ringGeometry args={[0.85, 1.0, 3]} />
            <meshStandardMaterial
              color="#FFA500"
              emissive="#FFA500"
              emissiveIntensity={2}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Ground-level fill disc */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.925, 0.5, -0.1, 32]} />
        <meshStandardMaterial
          color="#FF4500"
          emissive="#FF6600"
          emissiveIntensity={0.4}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

    </group>
  );
});

SpellCastingAura.displayName = 'SpellCastingAura';

export default SpellCastingAura;
