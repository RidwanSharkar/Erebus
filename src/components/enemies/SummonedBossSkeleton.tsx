import React, { useRef, useState, useEffect } from 'react';
import { Group, Vector3 } from 'three';
import { Billboard, Text } from '@react-three/drei';
import CustomSkeleton from '@/components/environment/CustomSkeleton';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';

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
  const { socket } = useMultiplayerActions();
  const groupRef = useRef<Group>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const currentPosition = useRef(position.clone());
  const currentRotation = useRef(rotation);
  const lastServerPosition = useRef(position.clone());

  // Constants
  const ATTACK_DURATION = 1000; // milliseconds
  const MOVEMENT_THRESHOLD = 0.05; // Minimum movement to trigger walking animation
  const WALK_STOP_DELAY = 150;

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

  // Derive walking state from server position deltas (not useFrame sampling).
  useEffect(() => {
    const dist = lastServerPosition.current.distanceTo(position);
    lastServerPosition.current.copy(position);

    if (dist > MOVEMENT_THRESHOLD && !isAttacking && !isDying) {
      if (!isWalkingRef.current) {
        isWalkingRef.current = true;
        setIsWalking(true);
      }
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        isWalkingRef.current = false;
        setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, isAttacking, isDying]);

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
    };
  }, []);

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

  // Listen for telegraph events from server (starts the swing animation; damage comes 1s later)
  useEffect(() => {
    if (!socket) return;

    const handleSkeletonTelegraph = (data: any) => {
      if (data.skeletonId === id) {
        setIsAttacking(true);
        
        setTimeout(() => {
          setIsAttacking(false);
        }, ATTACK_DURATION);
      }
    };

    socket.on('boss-skeleton-attack-telegraph', handleSkeletonTelegraph);

    return () => {
      socket.off('boss-skeleton-attack-telegraph', handleSkeletonTelegraph);
    };
  }, [id, socket, ATTACK_DURATION]);

  // Listen for movement updates (batched and legacy single-enemy events)
  useEffect(() => {
    if (!socket) return;

    const applyMove = (position: { x: number; y: number; z: number }, rotation: number) => {
      const newPosition = new Vector3(position.x, position.y, position.z);
      currentPosition.current.copy(newPosition);
      currentRotation.current = rotation;
      if (groupRef.current) {
        groupRef.current.position.copy(newPosition);
        groupRef.current.rotation.y = rotation;
      }
    };

    const handleBatchedMove = (data: any) => {
      if (!data.moves) return;
      for (const move of data.moves) {
        if (move.enemyId === id) {
          applyMove(move.position, move.rotation);
          break;
        }
      }
    };

    const handleEnemyMove = (data: any) => {
      if (data.enemyId === id) applyMove(data.position, data.rotation);
    };

    socket.on('enemies-moved', handleBatchedMove);
    socket.on('enemy-moved', handleEnemyMove);

    return () => {
      socket.off('enemies-moved', handleBatchedMove);
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
          position={[0, 0, 0] as [number, number, number]}
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

