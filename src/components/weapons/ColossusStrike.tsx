import React, { useRef, useMemo, useEffect } from 'react';
import { Vector3, Color, SphereGeometry, MeshStandardMaterial, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface ColossusStrikeProps {
  position: Vector3;
  onComplete: () => void;
  onDamageDealt?: (damageDealt: boolean) => void;
  onHit?: (targetId: string, damage: number) => void;
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  playerPosition?: Vector3;
  rageSpent?: number;
  delayStart?: number; // Delay before lightning appears (in milliseconds)
}

export default function ColossusStrike({
  position,
  onComplete,
  onDamageDealt,
  onHit,
  targetPlayerData = [],
  playerPosition,
  rageSpent = 40,
  delayStart = 0
}: ColossusStrikeProps) {
  const startTimeRef = useRef(Date.now() + delayStart);
  const duration = 0.9; // Match animation duration
  const flickerRef = useRef(1);
  const damageDealtRef = useRef(false);
  const isVisible = useRef(false);
  
  // Calculate the sky position (directly above the hit position)
  const skyPosition = useMemo(() => {
    return new Vector3(position.x, position.y + 20, position.z);
  }, [position]);
  
  // Create more concentrated branching geometry for lightning bolt
  const mainBoltSegments = 128; // Increased for more detail
  const branchCount = 48; // Doubled for more branches
  
  const branches = useMemo(() => {
    const distance = position.clone().sub(skyPosition).length();
    const mainBolt = {
      points: Array(mainBoltSegments).fill(0).map((_, i) => {
        const t = i / (mainBoltSegments - 1);
        // More complex zigzag pattern for main bolt
        const primaryOffset = Math.sin(t * Math.PI * 8) * (1 - t) * 1.2;
        const secondaryOffset = Math.sin(t * Math.PI * 16) * (1 - t) * 0.6;
        const randomOffset = (Math.random() - 0.5) * 0.8 * (1 - t);
        
        return new Vector3(
          skyPosition.x + (position.x - skyPosition.x) * t + primaryOffset + randomOffset,
          skyPosition.y + (position.y - skyPosition.y) * (Math.pow(t, 0.7)),
          skyPosition.z + (position.z - skyPosition.z) * t + secondaryOffset + randomOffset
        );
      }),
      thickness: 0.11,
      isCoreStrike: true
    }; 

    const secondaryBranches = Array(branchCount).fill(0).map(() => {
      const startIdx = Math.floor(Math.random() * mainBolt.points.length * 0.8);
      const startPoint = mainBolt.points[startIdx];
      const branchLength = Math.floor(mainBolt.points.length * 0.3);
      
      return {
        points: Array(branchLength).fill(0).map((_, i) => {
          const t = i / (branchLength - 1);
          const randomDir = new Vector3(
            (Math.random() - 0.5) * 2,
            -0.3 * t,
            (Math.random() - 0.5) * 2
          ).normalize();
          
          return startPoint.clone().add(
            randomDir.multiplyScalar(distance * 0.08 * t)
          );
        }),
        thickness: 0.03 + Math.random() * 0.04,
        isCoreStrike: false
      };
    });

    // Adjust tertiary branches
    const tertiaryBranches = secondaryBranches.flatMap(branch => {
      if (Math.random() > 0.5) return [];
      
      const startIdx = Math.floor(Math.random() * branch.points.length * 0.7);
      const startPoint = branch.points[startIdx];
      const miniBranchLength = Math.floor(branch.points.length * 0.4);
      
      return [{
        points: Array(miniBranchLength).fill(0).map((_, i) => {
          const t = i / (miniBranchLength - 1);
          const randomDir = new Vector3(
            (Math.random() - 0.5),
            -0.25 * t,
            (Math.random() - 0.5)
          ).normalize();
          
          return startPoint.clone().add(
            randomDir.multiplyScalar(distance * 0.04 * t)
          );
        }),
        thickness: 0.02 + Math.random() * 0.03,
        isCoreStrike: false
      }];
    });

    return [mainBolt, ...secondaryBranches, ...tertiaryBranches];
  }, [position, skyPosition]);
  
  // Create geometries and materials
  const geometries = useMemo(() => ({
    bolt: new SphereGeometry(1, 8, 8),
    impact: new SphereGeometry(0.8, 16, 16)
  }), []);
  
  // Updated materials for yellow lightning
  const materials = useMemo(() => ({
    coreBolt: new MeshStandardMaterial({
      color: new Color('#FFFF00'), // Pure yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 4,
      transparent: true
    }),
    secondaryBolt: new MeshStandardMaterial({
      color: new Color('#FFDD00'), // Bright yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 2,
      transparent: true
    }),
    impact: new MeshStandardMaterial({
      color: new Color('#FFFF00'), // Pure yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 1,
      transparent: true
    })
  }), []);

  // Perform damage detection at the right time (when lightning hits)
  // Using Smite's damage model but with smaller radius
  useEffect(() => {
    const damageTimer = setTimeout(() => {
      if (damageDealtRef.current) return; // Prevent multiple damage applications
      damageDealtRef.current = true;

      // Perform area damage like Smite but with smaller radius
      const colossusStrikeDamage = 100 + (rageSpent > 40 ? (rageSpent - 40) * 2 : 0); // Base 100 + extra rage scaling
      const damageRadius = 2.0; // Smaller radius than Smite (3.0)
      let damageDealtFlag = false;

      if (targetPlayerData && targetPlayerData.length > 0) {
        targetPlayerData.forEach(player => {
          if (!player.health || player.health <= 0) return;

          const distance = position.distanceTo(player.position);
          if (distance <= damageRadius) {
            // Player is within damage radius - deal damage
            if (onHit) {
              // Calculate damage: 100 + (2 × missing health %) + (2 × extra rage)
              const missingHealthPercent = Math.max(0, ((player.maxHealth - player.health) / player.maxHealth) * 100);
              const extraRage = Math.max(0, rageSpent - 40);
              const totalDamage = 100 + (missingHealthPercent * 2) + (extraRage * 2);
              
              console.log(`⚡ Colossus Strike: Hitting player ${player.id} for ${totalDamage} damage (distance: ${distance.toFixed(2)})`);
              onHit(player.id, totalDamage);
            }
            damageDealtFlag = true;
          }
        });
      }

      // Notify parent if any damage was dealt
      if (onDamageDealt) {
        onDamageDealt(damageDealtFlag);
      }
    }, delayStart + 450); // Visual effect timing (mid-animation) + delay

    return () => clearTimeout(damageTimer);
  }, [onDamageDealt, onHit, targetPlayerData, position, rageSpent, delayStart]);
  
  useFrame(() => {
    const currentTime = Date.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    
    // Check if we should start showing the effect
    if (currentTime < startTimeRef.current) {
      isVisible.current = false;
      return; // Don't render anything until delay is over
    }
    
    if (!isVisible.current) {
      isVisible.current = true;
    }
    
    flickerRef.current = Math.random() * 0.3 + 0.7;
    
    if (elapsed >= duration) {
      onComplete();
      return;
    }
    
    const progress = elapsed / duration;
    const fadeOut = (1.0 * (1 - progress)) * flickerRef.current;
    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.8;
    materials.impact.opacity = fadeOut * 0.9;
  });
  
  // Don't render anything if not visible yet
  if (!isVisible.current) {
    return null;
  }

  return (
    <group>
      {/* Lightning branches */}
      {branches.map((branch, branchIdx) => (
        <group key={branchIdx}>
          {branch.points.map((point, idx) => (
            <mesh
              key={idx}
              position={point.toArray()}
              geometry={geometries.bolt}
              material={branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt}
              scale={[branch.thickness, branch.thickness, branch.thickness]}
            />
          ))}
        </group>
      ))}
      
      {/* Impact effect */}
      <group position={position.toArray()}>
        <mesh
          geometry={geometries.impact}
          material={materials.impact}
          scale={[1, 1, 1]}
        />
        
        {/* Impact rings */}
        {[1, 1.4, 1.8].map((size, i) => (
          <mesh 
            key={i} 
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          >
            <ringGeometry args={[size, size + 0.2, 32]} />
            <meshBasicMaterial
              color="#FFD700" // Golden yellow
              transparent
              opacity={(0.8 - (i * 0.15)) * (1 - (Date.now() - startTimeRef.current) / (duration * 1000))}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
        
        {/* Enhanced lighting */}
        <pointLight
          color="#FFD700" // Golden yellow
          intensity={25 * (1 - (Date.now() - startTimeRef.current) / (duration * 1000)) * flickerRef.current}
          distance={8}
          decay={2}
        />
      </group>
    </group>
  );
}
