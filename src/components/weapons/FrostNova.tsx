import React, { useRef, useEffect, useMemo } from 'react';
import { Group, Vector3, Color, Mesh, Material, MeshStandardMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const FROST_NOVA_LIGHT_COLOR = new Color('#4FC3F7');

interface FrostNovaProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  visualScale?: number;
  onComplete?: () => void;
}

export default function FrostNova({ 
  position, 
  duration = 1500, // 2 seconds for the explosion effect
  startTime = Date.now(),
  visualScale = 1,
  onComplete 
}: FrostNovaProps) {
  const effectRef = useRef<Group>(null);
  const rotationSpeed = useRef(Math.random() * 0.05 + 0.02);

  const coreMeshRef = useRef<Mesh>(null);
  const coreMatRef = useRef<MeshStandardMaterial>(null);
  const spikeGroupRefs = useRef<(Group | null)[]>([]);
  const spikeMeshRefs = useRef<(Mesh | null)[]>([]);
  const spikeMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const ringMeshRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const particleMeshRefs = useRef<(Mesh | null)[]>([]);
  const particleMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);

  const particleSeeds = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        angle: (i * Math.PI * 2) / 24,
        radiusFactor: 0.6 + Math.random() * 0.4,
        offsetX: (Math.random() - 0.5) * 2,
        offsetY: Math.random() * 2 + 0.2,
        offsetZ: (Math.random() - 0.5) * 2,
        size: 0.08 + Math.random() * 0.12,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
      })),
    [],
  );

  // Borrow a pooled point light for the explosion glow (replaces two near-coincident
  // <pointLight>s) instead of churning the scene light count.
  const novaLight = useDynamicLight({ color: FROST_NOVA_LIGHT_COLOR, priority: 1 });

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete]);

  // MEMORY FIX: Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      if (effectRef.current) {
        effectRef.current.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: Material) => mat.dispose());
              } else {
                (child.material as Material).dispose();
              }
            }
          }
        });
      }
    };
  }, []);

  useFrame(() => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Safety check: if effect has exceeded its duration, trigger completion
    if (progress >= 1 && onComplete) {
      onComplete();
      return;
    }

    // Expansion phase (first 30% of duration)
    let frameExpansionProgress: number;
    if (progress < 0.3) {
      frameExpansionProgress = progress / 0.3;
    } else {
      frameExpansionProgress = 1;
    }

    // Fade out in the last 40% of duration
    let frameFadeProgress: number;
    if (progress > 0.6) {
      const fadeStart = 0.6;
      const fadePhase = (progress - fadeStart) / (1 - fadeStart);
      frameFadeProgress = 1 - fadePhase;
    } else {
      frameFadeProgress = 1;
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
    const frameIntensity = pulseIntensity * frameFadeProgress;

    const baseScale = 0.1 + frameExpansionProgress * 2.5;
    const ringScale = baseScale * 1.15;

    // Drive the pooled light at the effect center (world space). The original two
    // <pointLight>s sat at y+1 / y+0.5 above `position`; collapse to one near y+0.75.
    novaLight.current?.setPosition(position.x, position.y + 0.75, position.z);
    novaLight.current?.setIntensity(8 * frameIntensity * frameFadeProgress);
    novaLight.current?.setDistance(baseScale * 2);

    if (coreMeshRef.current) {
      coreMeshRef.current.scale.setScalar(baseScale);
    }
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.8 * frameIntensity;
      coreMatRef.current.opacity = 0.3 * frameFadeProgress;
    }

    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const radius = baseScale * 0.8;
      const spikeGroup = spikeGroupRefs.current[i];
      if (spikeGroup) {
        spikeGroup.rotation.set(0, angle, 0);
        spikeGroup.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        );
      }
      const spikeMesh = spikeMeshRefs.current[i];
      if (spikeMesh) {
        spikeMesh.scale.setScalar(baseScale);
      }
      const spikeMat = spikeMatRefs.current[i];
      if (spikeMat) {
        spikeMat.emissiveIntensity = 0.6 * frameIntensity;
        spikeMat.opacity = 0.8 * frameFadeProgress;
      }
    }

    for (let i = 0; i < 4; i++) {
      const ringMesh = ringMeshRefs.current[i];
      if (ringMesh) {
        const s = ringScale * (0.8 + i * 0.2);
        ringMesh.scale.set(s, s, 1);
      }
      const ringMat = ringMatRefs.current[i];
      if (ringMat) {
        ringMat.emissiveIntensity = 0.7 * frameIntensity;
        ringMat.opacity = 0.6 * frameFadeProgress * (1 - i * 0.2);
      }
    }

    for (let i = 0; i < particleSeeds.length; i++) {
      const seed = particleSeeds[i];
      const radius = baseScale * seed.radiusFactor;
      const particleMesh = particleMeshRefs.current[i];
      if (particleMesh) {
        particleMesh.position.set(
          Math.cos(seed.angle) * radius + seed.offsetX,
          seed.offsetY,
          Math.sin(seed.angle) * radius + seed.offsetZ,
        );
        particleMesh.rotation.set(seed.rotX, seed.rotY, seed.rotZ);
        particleMesh.scale.setScalar(seed.size);
      }
      const particleMat = particleMatRefs.current[i];
      if (particleMat) {
        particleMat.emissiveIntensity = 0.9 * frameIntensity;
        particleMat.opacity = 0.5 * frameFadeProgress;
      }
    }

    // Rotate the entire effect
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.002) * 0.1;
  });

  return (
    <group ref={effectRef} position={position} scale={[visualScale, visualScale, visualScale]}>
      {/* Central ice explosion core */}
      <mesh ref={coreMeshRef} position={[0, 0.5, 0]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#B3E5FC"
          emissive="#4FC3F7"
          emissiveIntensity={0.8}
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Ice crystal spikes radiating outward */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const radius = 0.8;
        return (
          <group
            key={i}
            ref={(el) => { spikeGroupRefs.current[i] = el; }}
            rotation={[0, angle, 0]}
            position={[
              Math.cos(angle) * radius,
              0,
              Math.sin(angle) * radius
            ]}
          >
            <mesh ref={(el) => { spikeMeshRefs.current[i] = el; }} rotation={[Math.PI / 6, 0, 0]}>
              <octahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial
                ref={(el) => { spikeMatRefs.current[i] = el; }}
                color="#E1F5FE"
                emissive="#29B6F6"
                emissiveIntensity={0.6}
                transparent
                opacity={0.8}
                roughness={0.05}
                metalness={0.15}
              />
            </mesh>
          </group>
        );
      })}

      {/* Frost rings expanding outward */}
      {[...Array(4)].map((_, i) => (
        <mesh 
          key={`ring-${i}`}
          ref={(el) => { ringMeshRefs.current[i] = el; }}
          position={[0, 0.1 + i * 0.15, 0]}
          rotation={[Math.PI / 2, 0, (i * Math.PI) / 6]}
        >
          <torusGeometry args={[1, 0.08, 8, 32]} />
          <meshStandardMaterial
            ref={(el) => { ringMatRefs.current[i] = el; }}
            color="#B3E5FC"
            emissive="#29B6F6"
            emissiveIntensity={0.7}
            transparent
            opacity={0.6}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Ice particles scattered around */}
      {particleSeeds.map((seed, i) => (
        <mesh
          key={`particle-${i}`}
          ref={(el) => { particleMeshRefs.current[i] = el; }}
          position={[
            Math.cos(seed.angle) * seed.radiusFactor + seed.offsetX,
            seed.offsetY,
            Math.sin(seed.angle) * seed.radiusFactor + seed.offsetZ,
          ]}
          rotation={[seed.rotX, seed.rotY, seed.rotZ]}
          scale={[seed.size, seed.size, seed.size]}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            ref={(el) => { particleMatRefs.current[i] = el; }}
            color="#E1F5FE"
            emissive="#4FC3F7"
            emissiveIntensity={0.9}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}

      {/* Ground frost effect */}


      {/* Central bright light + ambient frost glow now driven via the shared dynamic
          light pool (see useFrame) instead of mounted <pointLight>s. */}
    </group>
  );
}
