import React, { useRef, useEffect, memo, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, Mesh, Material, MeshStandardMaterial } from '@/utils/three-exports';

interface StunnedEffectProps {
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
  disableCameraRotation?: boolean; // New prop to disable camera rotation during stun
}

const StunnedEffectComponent = memo(function StunnedEffect({
  position,
  positionRef,
  duration = 4000, // 4 seconds stun duration
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
  disableCameraRotation = false
}: StunnedEffectProps) {
  const effectRef = useRef<Group>(null);
  const rotationSpeed = useRef(Math.random() * 0.03 + 0.02);
  const pulseSpeed = useRef(Math.random() * 0.008 + 0.006);

  const ringMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const verticalMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const sparkMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);

  const sparkOpacityMultipliers = useMemo(
    () => Array.from({ length: 8 }, () => Math.random() * 0.8),
    [],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, enemyId, startTime]);

  // Handle camera rotation disable for sabre stuns
  useEffect(() => {
    if (!disableCameraRotation || !enemyId) return;

    // Disable camera rotation during stun
    const cameraSystem = (window as any).cameraSystem;
    if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
      cameraSystem.setCameraRotationDisabled(true, enemyId);

      // Re-enable camera rotation when stun ends
      const timeout = setTimeout(() => {
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      }, duration);

      return () => {
        clearTimeout(timeout);
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      };
    }
  }, [disableCameraRotation, enemyId, duration, startTime]);

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

    // Update position to follow local player ref or enemy
    if (positionRef?.current) {
      effectRef.current.position.copy(positionRef.current);
      effectRef.current.position.y += 0.4;
    } else if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        // Update the group position to follow the enemy
        const targetPosition = target.position.clone();
        targetPosition.y += 0.4; // Adjust Y offset to be at player level
        effectRef.current.position.copy(targetPosition);
      }
      // Note: If target is not found, we keep the original position passed as prop
      // This is important for PVP mode where the position is managed externally
    }

    // Fade out in the last 500ms
    let frameFadeProgress = 1;
    if (progress > 0.875) {
      const fadeStart = 0.875;
      const fadeAmount = (progress - fadeStart) / (1 - fadeStart);
      frameFadeProgress = 1 - fadeAmount;
    }

    // Pulsing intensity effect - more aggressive than freeze
    const pulseIntensity = 0.6 + 0.4 * Math.sin(elapsed * pulseSpeed.current);
    const frameIntensity = pulseIntensity * frameFadeProgress;

    for (const mat of ringMatRefs.current) {
      if (mat) {
        mat.emissiveIntensity = frameIntensity * 6.75;
        mat.opacity = frameFadeProgress * 0.8;
      }
    }
    for (const mat of verticalMatRefs.current) {
      if (mat) {
        mat.emissiveIntensity = frameIntensity * 1;
        mat.opacity = frameFadeProgress * 0.6;
      }
    }
    for (let i = 0; i < sparkMatRefs.current.length; i++) {
      const mat = sparkMatRefs.current[i];
      if (mat) {
        mat.emissiveIntensity = frameIntensity * 6;
        mat.opacity = frameFadeProgress * sparkOpacityMultipliers[i];
      }
    }

    // Rotate the lightning cage
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.004) * 0.15;
    effectRef.current.rotation.z = Math.cos(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position}>



      {/* Lightning bolt rings */}
      {[...Array(3)].map((_, i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3 + Math.PI, 0]} position={[0, -0.125, 0]}>
          <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
            <meshStandardMaterial
              ref={(el) => { ringMatRefs.current[i] = el; }}
              color={new Color("blue")}      // Red-orange
              emissive={new Color("green")}
              emissiveIntensity={6.75}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      ))}

      {/* Vertical lightning bolts */}
      {[...Array(4)].map((_, i) => (
        <mesh key={`vertical-${i}`}
              position={[
                0.4 * Math.cos(i * Math.PI / 2),
                -0.125,
                0.4 * Math.sin(i * Math.PI / 2)
              ]}
              rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.35, 4]} />
          <meshStandardMaterial
            ref={(el) => { verticalMatRefs.current[i] = el; }}
            color={new Color(0xDD4444)}       // Dark red
            emissive={new Color(0xDD4444)}
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}


 

      {/* Electric sparks */}
      {[...Array(8)].map((_, i) => (
        <mesh key={`spark-${i}`}
              position={[
                (0.3 + Math.random() * 0.5) * Math.cos(i * Math.PI / 4),
                Math.random() * 0.4 - 0.2,
                (0.3 + Math.random() * 0.5) * Math.sin(i * Math.PI / 4)
              ]}>
          <sphereGeometry args={[0.03, 4, 4]} />
          <meshStandardMaterial
            ref={(el) => { sparkMatRefs.current[i] = el; }}
            color={new Color(0xFFFFFF)}       // White sparks
            emissive={new Color(0xFFFFFF)}
            emissiveIntensity={6}
            transparent
            opacity={sparkOpacityMultipliers[i]}
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
  if (prevProps.disableCameraRotation !== nextProps.disableCameraRotation) return false;
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

export default StunnedEffectComponent;
