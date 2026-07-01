import React, { useMemo, useRef } from 'react';
import { Vector3, Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

type BossTeleportTheme = 'purple' | 'red';

const TELEPORT_PALETTES: Record<BossTeleportTheme, {
  primary: string;
  secondary: string;
  core: string;
  dark: string;
  accent: string;
}> = {
  purple: {
    primary: '#8800ff',
    secondary: '#aa00ff',
    core: '#ffffff',
    dark: '#440088',
    accent: '#ff00ff',
  },
  red: {
    primary: '#7f0505',
    secondary: '#ff2a1a',
    core: '#ffffff',
    dark: '#3a0202',
    accent: '#ff5533',
  },
};

interface BossTeleportEffectProps {
  position: Vector3;
  onComplete: () => void;
  type?: 'start' | 'end'; // Different effects for teleport start vs end
  scale?: number;          // Uniform scale applied to the effect geometry (default 1)
  theme?: BossTeleportTheme;
}

const BossTeleportEffect: React.FC<BossTeleportEffectProps> = React.memo(({ position, onComplete, type = 'start', scale: effectScale = 1, theme = 'purple' }) => {
  const duration = 0.8; // Duration of the effect
  const timeRef = useRef(0);
  const hasCompletedRef = React.useRef(false);

  const isStartEffect = type === 'start';

  // Borrow a pooled light for the teleport flash instead of mounting a <pointLight>.
  const teleportLight = useDynamicLight({
    color: TELEPORT_PALETTES[theme].primary,
    distance: 5,
    priority: 1,
  });

  const { primary: primaryColor, secondary: secondaryColor, core: coreColor, dark: darkColor, accent: accentColor } =
    TELEPORT_PALETTES[theme];

  // Mesh/material refs — animation is driven imperatively each frame (no setState),
  // so geometries/materials are created once and never rebuilt.
  const coreMesh = useRef<Mesh>(null);
  const coreMat = useRef<MeshStandardMaterial>(null);
  const outerMesh = useRef<Mesh>(null);
  const outerMat = useRef<MeshStandardMaterial>(null);
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const ringMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const pillarMeshes = useRef<(Mesh | null)[]>([]);
  const pillarMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const particleMeshes = useRef<(Mesh | null)[]>([]);
  const particleMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const groundMesh = useRef<Mesh>(null);
  const groundMat = useRef<MeshStandardMaterial>(null);
  const streamMeshes = useRef<(Mesh | null)[]>([]);
  const streamMats = useRef<(MeshStandardMaterial | null)[]>([]);

  // Generate random particles for swirling effect
  const particles = useMemo(() => {
    const particleCount = 30;
    const particleArray = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      const height = Math.random() * 2 - 1;
      particleArray.push({
        angle,
        radius,
        height,
        speed: 2 + Math.random() * 2,
        size: 0.08 + Math.random() * 0.08
      });
    }
    return particleArray;
  }, []);

  useFrame((_, delta) => {
    const time = timeRef.current + delta;
    timeRef.current = time;

    const progress = time / duration;
    const opacity = isStartEffect
      ? 1 - progress // Fade out for start
      : Math.sin(progress * Math.PI); // Fade in and out for end
    const scale = isStartEffect
      ? 1 + progress * 2 // Expand for start
      : 1 - progress * 0.3 + Math.sin(progress * Math.PI * 2) * 0.2; // Contract with pulse for end

    // Drive the pooled light at the effect's world position (light sat at local
    // [0, 0.5, 0] inside the effectScale group → world y = position.y + 0.5 * scale).
    teleportLight.current?.setPosition(position.x, position.y + 0.5 * effectScale, position.z);
    teleportLight.current?.setIntensity(10 * opacity);

    // Central energy core
    if (coreMesh.current) coreMesh.current.scale.setScalar(scale);
    if (coreMat.current) coreMat.current.opacity = opacity * 0.9;

    // Outer pulsing sphere (radius 0.6 * scale + sin(time*10) * 0.1)
    if (outerMesh.current) outerMesh.current.scale.setScalar(scale + (Math.sin(time * 10) * 0.1) / 0.6);
    if (outerMat.current) outerMat.current.opacity = opacity * 0.4;

    // Spinning rings
    for (let i = 0; i < 3; i++) {
      const m = ringMeshes.current[i];
      if (m) {
        m.scale.setScalar(scale);
        m.rotation.z = time * 5 * (i % 2 === 0 ? 1 : -1);
      }
      const mat = ringMats.current[i];
      if (mat) mat.opacity = opacity * (1 - i * 0.2);
    }

    // Vertical energy pillars (orbit + height pulse)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 0.9 * scale;
      const x = Math.cos(angle + time * 3) * radius;
      const z = Math.sin(angle + time * 3) * radius;
      const m = pillarMeshes.current[i];
      if (m) {
        m.position.set(x, 0, z);
        m.scale.y = (2 + Math.sin(time * 5 + i) * 0.5) / 2; // base height 2
      }
      const mat = pillarMats.current[i];
      if (mat) mat.opacity = opacity * 0.7;
    }

    // Swirling particles
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const currentAngle = particle.angle + time * particle.speed;
      const currentRadius = particle.radius * scale;
      const x = Math.cos(currentAngle) * currentRadius;
      const z = Math.sin(currentAngle) * currentRadius;
      const y = particle.height + Math.sin(time * 4 + i) * 0.3;
      const m = particleMeshes.current[i];
      if (m) m.position.set(x, y, z);
      const mat = particleMats.current[i];
      if (mat) mat.opacity = opacity * 0.8;
    }

    // Ground circle effect
    if (groundMesh.current) {
      groundMesh.current.scale.set(scale, scale, 1);
      groundMesh.current.rotation.z = time * 2;
    }
    if (groundMat.current) groundMat.current.opacity = opacity * 0.5;

    // Ascending/Descending energy streams
    if (isStartEffect) {
      const streamHeight = progress * 3;
      for (let i = 0; i < 8; i++) {
        const m = streamMeshes.current[i];
        if (m) {
          m.position.y = streamHeight;
          m.scale.y = streamHeight * 2; // base height 1 -> length streamHeight*2
        }
        const mat = streamMats.current[i];
        if (mat) mat.opacity = opacity * 0.6;
      }
    } else {
      const streamHeight = (1 - progress) * 3;
      for (let i = 0; i < 8; i++) {
        const m = streamMeshes.current[i];
        if (m) m.position.y = streamHeight + 2;
        const mat = streamMats.current[i];
        if (mat) mat.opacity = opacity * 0.6;
      }
    }

    // Check for completion outside of setState to avoid calling parent setState during render
    if (time >= duration && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  });

  const initOpacity = isStartEffect ? 1 : 0; // opacity at progress 0

  return (
    <group position={position.toArray()}>
      <group scale={[effectScale, effectScale, effectScale]}>
      {/* Central energy core */}
      <mesh ref={coreMesh} position={[0, 0, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          ref={coreMat}
          color={coreColor}
          emissive={primaryColor}
          emissiveIntensity={5}
          transparent
          opacity={initOpacity * 0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Outer energy sphere with pulsing effect */}
      <mesh ref={outerMesh} position={[0, 0, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          ref={outerMat}
          color={secondaryColor}
          emissive={primaryColor}
          emissiveIntensity={3}
          transparent
          opacity={initOpacity * 0.4}
          toneMapped={false}
          wireframe
        />
      </mesh>

      {/* Spinning rings around the teleport */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => { ringMeshes.current[i] = el; }}
          position={[0, (i - 1) * 0.5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.8, 0.05, 8, 24]} />
          <meshStandardMaterial
            ref={(el) => { ringMats.current[i] = el; }}
            color={i === 1 ? accentColor : primaryColor}
            emissive={i === 1 ? secondaryColor : darkColor}
            emissiveIntensity={4}
            transparent
            opacity={initOpacity * (1 - i * 0.2)}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Vertical energy pillars */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.9;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh
            key={`pillar-${i}`}
            ref={(el) => { pillarMeshes.current[i] = el; }}
            position={[x, 0, z]}
            rotation={[0, 0, 0]}
          >
            <cylinderGeometry args={[0.04, 0.04, 2, 8]} />
            <meshStandardMaterial
              ref={(el) => { pillarMats.current[i] = el; }}
              color={primaryColor}
              emissive={accentColor}
              emissiveIntensity={3.5}
              transparent
              opacity={initOpacity * 0.7}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Swirling particles */}
      {particles.map((particle, i) => {
        const x = Math.cos(particle.angle) * particle.radius;
        const z = Math.sin(particle.angle) * particle.radius;
        const y = particle.height;

        return (
          <mesh
            key={`particle-${i}`}
            ref={(el) => { particleMeshes.current[i] = el; }}
            position={[x, y, z]}
          >
            <sphereGeometry args={[particle.size, 8, 8]} />
            <meshStandardMaterial
              ref={(el) => { particleMats.current[i] = el; }}
              color={i % 2 === 0 ? primaryColor : accentColor}
              emissive={i % 2 === 0 ? accentColor : primaryColor}
              emissiveIntensity={4}
              transparent
              opacity={initOpacity * 0.8}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Ground circle effect */}
      <mesh ref={groundMesh} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 1.2, 32]} />
        <meshStandardMaterial
          ref={groundMat}
          color={darkColor}
          emissive={primaryColor}
          emissiveIntensity={2.5}
          transparent
          opacity={initOpacity * 0.5}
          toneMapped={false}
          side={2}
        />
      </mesh>

      {/* Ascending/Descending energy streams for start/end effect */}
      {isStartEffect ? (
        // Ascending streams for teleport start (boss disappearing)
        [...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 0.6;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;

          return (
            <mesh
              key={`stream-up-${i}`}
              ref={(el) => { streamMeshes.current[i] = el; }}
              position={[x, 0, z]}
              scale={[1, 0, 1]}
            >
              <cylinderGeometry args={[0.08, 0.08, 1, 6]} />
              <meshStandardMaterial
                ref={(el) => { streamMats.current[i] = el; }}
                color={primaryColor}
                emissive={accentColor}
                emissiveIntensity={4}
                transparent
                opacity={initOpacity * 0.6}
                toneMapped={false}
              />
            </mesh>
          );
        })
      ) : (
        // Descending streams for teleport end (boss appearing)
        [...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 0.6;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;

          return (
            <mesh
              key={`stream-down-${i}`}
              ref={(el) => { streamMeshes.current[i] = el; }}
              position={[x, 5, z]}
            >
              <cylinderGeometry args={[0.08, 0.08, 2, 6]} />
              <meshStandardMaterial
                ref={(el) => { streamMats.current[i] = el; }}
                color={primaryColor}
                emissive={accentColor}
                emissiveIntensity={4}
                transparent
                opacity={initOpacity * 0.6}
                toneMapped={false}
              />
            </mesh>
          );
        })
      )}

      </group>
    </group>
  );
});

BossTeleportEffect.displayName = 'BossTeleportEffect';

export default BossTeleportEffect;
