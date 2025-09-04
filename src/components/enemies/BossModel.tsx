import React, { useRef } from 'react';
import { Group, MeshStandardMaterial, SphereGeometry, CylinderGeometry, ConeGeometry } from 'three';
import { useFrame } from '@react-three/fiber';
import BoneTail from '../dragon/BoneTail';
import BonePlate from '../dragon/BonePlate';  
import BossBoneWings from './BossBoneWings';  
import BossBoneVortex from './BossBoneVortex';  
import DragonSkull from '../dragon/DragonSkull';  
import BossTrailEffect from './BossTrailEffect';
import { MathUtils, AdditiveBlending } from '@/utils/three-exports';


interface BossModelProps {
  isAttacking: boolean;
  onHit?: (damage: number) => void;
  attackingHand?: 'left' | 'right' | null;
  onLightningStart?: (hand: 'left' | 'right') => void;
  health?: number;
}

// Materials for the arms - more imposing for Boss
const standardBoneMaterial = new MeshStandardMaterial({
  color: "#e0e0e0",
  roughness: 0.3,
  metalness: 0.4
});

const darkBoneMaterial = new MeshStandardMaterial({
  color: "#c8c8c8",
  roughness: 0.2,
  metalness: 0.5
});

// Cache geometries for arm components - scaled larger for Boss
const armJointGeometry = new SphereGeometry(0.08, 8, 8);
const armBoneGeometry = new CylinderGeometry(0.08, 0.064, 1.3, 6);
const clawGeometry = new ConeGeometry(0.04, 0.2, 8);

function BossArm({ isRaised = false }: { isRaised?: boolean }) {
  const armRef = useRef<Group>(null);
  
  // Smooth animation for raising/lowering the arm
  useFrame((_, delta) => {
    if (!armRef.current) return;
    
    const targetRotation = isRaised ? -Math.PI/2.5 : 0; // More dramatic arm raise for Boss
    const currentRotation = armRef.current.rotation.x;
    const lerpFactor = 4 * delta; // Slightly slower animation for majesty
    
    armRef.current.rotation.x = MathUtils.lerp(currentRotation, targetRotation, lerpFactor);
  });

  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={armBoneGeometry} material={standardBoneMaterial} scale={[width/0.08, length/1.3, width/0.08]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={armJointGeometry} material={standardBoneMaterial} scale={[size/0.08, size/0.08, size/0.08]} />
  );

  const createParallelBones = (length: number, spacing: number) => (
    <group>
      <group position={[spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.08)}
      </group>
      <group position={[-spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.08)}
      </group>
      <group position={[0, length/2, 0]}>
        {createJoint(0.1)}
      </group>
      <group position={[0, -length/2, 0]}>
        {createJoint(0.1)}
      </group>
    </group>
  );

  return (
    <group ref={armRef}>
      {/* Upper arm - larger proportions for Boss */}
      <group>
        {createParallelBones(1.3, 0.2)}
        
        {/* Elbow joint */}
        <group position={[0, -0.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.4} />
          </mesh>
          
          {/* Forearm */}
          <group position={[0, -0.45, 0.35]} rotation={[-0.8, 0, 0]}>
            {createParallelBones(1.0, 0.16)}
            
            {/* Wrist/Hand */}
            <group position={[0, -0.6, 0]} rotation={[0, 0, 0]}>
              {createJoint(0.12)}
              
              {/* Hand structure - larger and more menacing for Boss */}
              <group position={[0, -0.12, 0]} scale={[1.5, 1.5, 1.5]}>
                <mesh>
                  <boxGeometry args={[0.25, 0.2, 0.1]} />
                  <meshStandardMaterial color="#e0e0e0" roughness={0.3} />
                </mesh>
                
                {/* Fingers for spell casting - more dramatic */}
                {[-0.1, -0.05, 0, 0.05, 0.1].map((offset, i) => (
                  <group 
                    key={i} 
                    position={[offset, -0.12, 0]}  
                    rotation={[0, 0, (i - 2) * Math.PI / 8]}
                  >
                    {createBoneSegment(0.6, 0.025)}
                    <group position={[0.03, -0.35, 0]} rotation={[0, 0, Math.PI/6]} scale={[1.4, 1.4, 1.4]}>
                      <mesh geometry={clawGeometry} material={darkBoneMaterial} />
                    </group>
                  </group>
                ))}

                {/* Palm energy glow when raised (for lightning casting) - more intense for Boss */}
                {isRaised && (
                  <group position={[0, -0.06, 0.12]}>
                    <mesh>
                      <sphereGeometry args={[0.08, 10, 10]} />
                      <meshStandardMaterial
                        color="#AA0000"
                        emissive="#AA0000"
                        emissiveIntensity={3}
                        transparent
                        opacity={0.9}
                      />
                    </mesh>
                    <pointLight 
                      color="#AA0000"
                      intensity={2.5}
                      distance={3}
                      decay={2}
                    />
                  </group>
                )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function BossModel({ 
  isAttacking, 
  attackingHand = null,
  onLightningStart,
  health = 1.0
}: BossModelProps) {
  const groupRef = useRef<Group>(null);
  const attackCycleRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (isAttacking && attackingHand) {
      attackCycleRef.current += delta * 3; // Slightly slower attack animation for Boss majesty
      
      // Trigger lightning at specific phase
      if (attackCycleRef.current > Math.PI/4 && attackCycleRef.current < Math.PI/3 && onLightningStart) {
        onLightningStart(attackingHand);
      }
      
      if (attackCycleRef.current >= Math.PI) {
        attackCycleRef.current = 0;
      }
    } else {
      attackCycleRef.current = 0;
    }
  });

  return (
    <group ref={groupRef} scale={[1.275, 1.275, 1.275]}> {/* Same scale as original Ascendant */}
      {/* Reaper Skull - slightly larger */}
      <group scale={[0.65, 0.65, 0.65]} position={[0, 1.45, 0.2]} rotation={[0.5, 0, 0]}>
        <DragonSkull />
      </group>

      {/* Scaled Bone Plate */}
      <group scale={[1.1, 1.0, 0.9]} position={[0, 1.45, 0]} rotation={[0.3, 0, 0]}>
        <BonePlate />
      </group>

      {/* Scaled Wings - slightly larger */}
      <group scale={[1.175, 1.275, -0.9]} position={[0, 0.775, 0]}>
        {/* Left Wing */}
        <group rotation={[0, Math.PI / 5, 0]}>
          <BossBoneWings 
            collectedBones={15} 
            isLeftWing={true}
            parentRef={groupRef} 
          />
        </group>
        
        {/* Right Wing */}
        <group rotation={[0, -Math.PI / 5, 0]}>
          <BossBoneWings 
            collectedBones={15} 
            isLeftWing={false}
            parentRef={groupRef} 
          />
        </group>
      </group>

      {/* Scaled Tail */}
      <group scale={[1.2, 1.2, 1.2]} position={[0, 1.35, 0]}>
        <BoneTail />
      </group>

      {/* Add Glowing Core Effect */}
      <group position={[0, 1, 0]} scale={[0.25, 0.25, 0.25]}>
        <BossTrailEffect parentRef={groupRef} />
      </group>

      <group position={[0, 1.5, 0.25]} scale={[0.4, 0.4, 0.4]}>
        <BossTrailEffect parentRef={groupRef} />
      </group>

      <group position={[0, 1.8, 0.35]} scale={[0.4, 0.4, 0.4]}>
        <BossTrailEffect parentRef={groupRef} />
      </group>

      {/* Bone Vortex Effects */}
      <group scale={[1.45, 1.9, 1.45]} position={[0, -0.25, 0]}>
        {/* Front and Back Vortexes only */}
        <group position={[0, 0, 0.1]} rotation={[0, 0, 0]}>
          <BossBoneVortex parentRef={groupRef} />
        </group>
        <group position={[0, 0, -0.1]} rotation={[0, Math.PI, 0]}>
          <BossBoneVortex parentRef={groupRef} />
        </group>
      </group>

      {/* Left Arm - positioned and scaled like Boss claws */}
      <group 
        position={[-0.5, 1.4, 0.1]} 
        rotation={[0, Math.PI/6, 0]}
        scale={[0.35, 0.35, 0.35]}
      >
        <BossArm 
          isRaised={isAttacking && attackingHand === 'left'} 
        />
      </group>

      {/* Right Arm - positioned and scaled like Boss claws */}
      <group 
        position={[0.5, 1.4, 0.1]} 
        rotation={[0, -Math.PI/6, 0]}
        scale={[0.45, 0.375, 0.45]}
      >
        <BossArm 
          isRaised={isAttacking && attackingHand === 'right'} 
        />
      </group>

      {/* Left Shoulder Sphere */}
      <mesh position={[-0.5, 1.7,  0.125]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color="#CC0000"
          emissive="#FF0000"
          emissiveIntensity={0.4}
          transparent
          opacity={0.9}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder Ring */}
      <mesh position={[-0.5, 1.7,  0.125]} rotation={[Math.PI / 2, -Math.PI / 4, 0]}>
        <torusGeometry args={[0.25, 0.05, 8, 16]} />
        <meshStandardMaterial
          color="#FF4444"
          emissive="#FF0000"
          emissiveIntensity={0.6}
          transparent
          opacity={0.95}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Right Shoulder Sphere */}
      <mesh position={[0.5, 1.7, 0.125]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color="#CC0000"
          emissive="#FF0000"
          emissiveIntensity={0.4}
          transparent
          opacity={0.9}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Right Shoulder Ring */}
      <mesh position={[0.5, 1.7,  0.125]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <torusGeometry args={[0.25, 0.05, 8, 16]} />
        <meshStandardMaterial
          color="#FF4444"
          emissive="#FF0000"
          emissiveIntensity={0.6}
          transparent
          opacity={0.95}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>



      {/* Enhanced red energy aura for Ascendant */}
      <group position={[0, 1.2, 0]}>
        <mesh>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial
            color="#440000"
            emissive="#660000"
            emissiveIntensity={0.5}
            transparent
            opacity={0.15}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Health-based damage effects */}
      {health < 0.5 && (
        <group position={[0, 1.2, 0]}>
          <mesh>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshStandardMaterial
              color="#FF0000"
              emissive="#FF0000"
              emissiveIntensity={1.2}
              transparent
              opacity={0.25}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
