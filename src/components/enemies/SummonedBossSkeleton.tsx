import React, { useRef, useState, useEffect } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import CustomSkeleton from '@/components/environment/CustomSkeleton';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface SummonedBossSkeletonProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  onPositionUpdate?: (id: string, position: Vector3, rotation: number) => void;
}

export default function SummonedBossSkeleton({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  onPositionUpdate
}: SummonedBossSkeletonProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  
  const currentPosition = useRef(position.clone());
  const currentRotation = useRef(rotation);

  // Constants
  const ATTACK_DURATION = 1000; // milliseconds

  // Sync position from server
  useEffect(() => {
    if (position && !currentPosition.current.equals(position)) {
      const distance = currentPosition.current.distanceTo(position);
      
      // Only update if distance is reasonable (prevents teleporting)
      if (distance < 5.0) {
        currentPosition.current.copy(position);
        if (groupRef.current) {
          groupRef.current.position.copy(currentPosition.current);
        }
      }
    }
  }, [position]);

  // Sync rotation from server
  useEffect(() => {
    if (rotation !== undefined && rotation !== currentRotation.current) {
      currentRotation.current = rotation;
      if (groupRef.current) {
        groupRef.current.rotation.y = rotation;
      }
    }
  }, [rotation]);

  // Handle death
  useEffect(() => {
    if (isDying && groupRef.current) {
      // Fade out on death
      groupRef.current.traverse((child: any) => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => {
              if (mat.transparent !== undefined) {
                mat.transparent = true;
                mat.opacity = 0.5;
              }
            });
          } else {
            child.material.transparent = true;
            child.material.opacity = 0.5;
          }
        }
      });
    }
  }, [isDying]);


  // Listen for attack events from server
  useEffect(() => {
    if (!socket) return;

    const handleSkeletonAttack = (data: any) => {
      if (data.skeletonId === id) {
        // Start attack animation immediately
        setIsAttacking(true);
        
        // Reset attack after animation completes
        setTimeout(() => {
          setIsAttacking(false);
        }, ATTACK_DURATION);
      }
    };

    socket.on('boss-skeleton-attack', handleSkeletonAttack);

    return () => {
      socket.off('boss-skeleton-attack', handleSkeletonAttack);
    };
  }, [id, socket, ATTACK_DURATION]);

  // Listen for movement updates
  useEffect(() => {
    if (!socket) return;

    const handleEnemyMove = (data: any) => {
      if (data.enemyId === id) {
        const newPosition = new Vector3(data.position.x, data.position.y, data.position.z);
        const distance = currentPosition.current.distanceTo(newPosition);

        // Update walking state based on movement
        setIsWalking(distance > 0.1);

        // Update position and rotation
        currentPosition.current.copy(newPosition);
        currentRotation.current = data.rotation;

        if (groupRef.current) {
          groupRef.current.position.copy(newPosition);
          groupRef.current.rotation.y = data.rotation;
        }
      }
    };

    socket.on('enemy-moved', handleEnemyMove);

    return () => {
      socket.off('enemy-moved', handleEnemyMove);
    };
  }, [id, socket]);

  return (
    <>
      <group
        ref={groupRef}
        position={currentPosition.current}
        rotation={[0, currentRotation.current, 0]}
        visible={!isDying}
      >
        <CustomSkeleton
          position={[0, 0.735, 0] as [number, number, number]}
          rotation={[0, 0, 0] as [number, number, number]}
          isWalking={isWalking}
          isAttacking={isAttacking}
        />

        {/* Health bar */}
        <Billboard
          position={[0, 3.5, 0]}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
        >
          {health > 0 && (
            <>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[2.0, 0.25]} />
                <meshBasicMaterial color="#333333" opacity={0.8} transparent />
              </mesh>
              <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
                <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
                <meshBasicMaterial color="#ff3333" opacity={0.9} transparent />
              </mesh>
              <Text
                position={[0, 0, 0.002]}
                fontSize={0.2}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {`${Math.ceil(health)}/${maxHealth}`}
              </Text>
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}

