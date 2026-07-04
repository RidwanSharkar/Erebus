'use client';

import React, { useRef, memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Mesh, MeshStandardMaterial, AdditiveBlending, Material, SphereGeometry } from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface VenomEffectProps {
  position: Vector3;
  onComplete: () => void;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  // For tracking enemy position updates
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
}

const VENOM_CLOUD_GEO = new SphereGeometry(0.2, 16, 16);
const VENOM_CORE_GEO = new SphereGeometry(0.15, 12, 12);
const VENOM_TENDRIL_GEO = new SphereGeometry(0.18, 8, 8);
const VENOM_PARTICLE_GEO = new SphereGeometry(0.06, 6, 6);

const VenomEffectComponent = memo(function VenomEffect({
  position,
  onComplete,
  duration = 1000, // 1 second per pulse
  startTime = Date.now(),
  enemyId,
  enemyData = []
}: VenomEffectProps) {
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(startTime);

  // Borrow a pooled light instead of mounting a <pointLight> (avoids lit-shader recompiles).
  const venomLight = useDynamicLight({ color: '#00FF44', distance: 3, decay: 2, priority: 1 });

  const tendrilLayout = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radiusX = 0.2 + Math.random() * 0.2;
        const radiusZ = 0.2 + Math.random() * 0.2;
        return {
          position: [
            Math.cos(angle) * radiusX,
            Math.random() * 0.4 - 0.2,
            Math.sin(angle) * radiusZ,
          ] as [number, number, number],
        };
      }),
    [],
  );

  const particleLayout = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.35;
        return {
          position: [Math.cos(angle) * radius, Math.random() * 0.4 - 0.2, Math.sin(angle) * radius] as [
            number,
            number,
            number,
          ],
          color: i % 2 === 0 ? '#00FF44' : '#55FF00',
        };
      }),
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    // Update position to follow enemy if enemyId is provided
    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);

      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        groupRef.current.position.set(target.position.x, target.position.y + 1, target.position.z);
      }
    }

    // Drive the pooled light at the venom cloud's world position (group root, already world-space).
    venomLight.current?.setPosition(
      groupRef.current.position.x,
      groupRef.current.position.y,
      groupRef.current.position.z,
    );
    venomLight.current?.setIntensity(1.5);

    // Scale effect and fade out
    const scale = 1 + progress * 1.5;
    groupRef.current.scale.set(scale, scale, scale);
    
    // Apply opacity with pulsing effect for persistent venom
    const pulseOpacity = enemyId ? 
      0.8 + 0.2 * Math.sin(elapsed * 0.01) : // Persistent pulsing for enemy effects
      1 - progress; // Fade out for one-time effects
    
    groupRef.current.children.forEach(child => {
      if (child instanceof Mesh) {
        const material = child.material as MeshStandardMaterial;
        if (material.opacity !== undefined) {
          material.opacity = pulseOpacity;
        }
      }
    });
    
    // Remove when complete (only for non-persistent effects)
    if (progress >= 1 && !enemyId) {
      onComplete();
    }
  });

  // MEMORY FIX: Dispose per-instance materials on unmount (geometries are module-shared).
  useEffect(() => {
    return () => {
      if (groupRef.current) {
        groupRef.current.traverse((child) => {
          if (child instanceof Mesh) {
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
  
  // Randomize rotation for variety
  const randomRotation = useRef(Math.random() * Math.PI * 2);
  
  return (
    <group 
      ref={groupRef} 
      position={[position.x, position.y + 1, position.z]}
      rotation={[0, randomRotation.current, 0]}
    >
      {/* Main venom cloud */}
      <mesh geometry={VENOM_CLOUD_GEO}>
        <meshStandardMaterial 
          color="#00FF44"
          emissive="#00FF44"
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Inner toxic core */}
      <mesh geometry={VENOM_CORE_GEO}>
        <meshStandardMaterial 
          color="#33FF33"
          emissive="#33FF33"
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Toxic tendrils */}
      {tendrilLayout.map((t, i) => (
          <mesh key={i} position={t.position} geometry={VENOM_TENDRIL_GEO}>
            <meshStandardMaterial 
              color="#00BB33"
              emissive="#00BB33"
              emissiveIntensity={1.5}
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
      ))}
      
      {/* Toxic particles */}
      {particleLayout.map((p, i) => (
          <mesh key={`particle-${i}`} position={p.position} geometry={VENOM_PARTICLE_GEO}>
            <meshStandardMaterial 
              color={p.color}
              emissive={p.color}
              emissiveIntensity={2}
              transparent
              opacity={0.8}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
      ))}
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
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
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position) ||
          prev.isDying !== next.isDying || prev.deathStartTime !== next.deathStartTime) {
        return false;
      }
    }
  }

  return true;
});

export default VenomEffectComponent;
