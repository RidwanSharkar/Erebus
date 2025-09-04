import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Shape, SphereGeometry, InstancedMesh, Matrix4, Vector3, Euler, Quaternion, DoubleSide, DynamicDrawUsage } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import BonePlate from '../dragon/BonePlate';
import { useRef, useState, useEffect, useMemo } from 'react';
import GruntTrailEffect from '@/components/enemies/GruntTrailEffect';
import DragonSkull from '../dragon/DragonSkull';

// Add at top of file after imports
const tempMatrix = new Matrix4();
const tempPosition = new Vector3();
const tempRotation = new Euler();
const tempScale = new Vector3();
const tempQuaternion = new Quaternion();

function setMatrixAt(
  instancedMesh: InstancedMesh,
  index: number,
  position: Vector3,
  rotation: Euler,
  scale: Vector3
) {
  tempQuaternion.setFromEuler(rotation);
  tempMatrix.compose(position, tempQuaternion, scale);
  instancedMesh.setMatrixAt(index, tempMatrix);
}

// Create shared geometries
const SHARED_GEOMETRIES = {
  sphere: new SphereGeometry(0.02, 8, 8),
  cylinder: new CylinderGeometry(0.04, 0.032, 1, 4),
  cone: new ConeGeometry(0.02, 0.15, 4),
  box: new BoxGeometry(0.2, 0.15, 0.08),
  vertebrae: new CylinderGeometry(0.0225, 0.0225, 0.03, 6),
  eye: new SphereGeometry(0.02, 8, 8),
  eyeGlow: new SphereGeometry(0.035, 8, 8),
  eyeOuterGlow: new SphereGeometry(0.05, 6.5, 2)
};

// Create shared materials - Red theme for grunt
const SHARED_MATERIALS = {
  standardBone: new MeshStandardMaterial({
    color: "#e8e8e8",
    roughness: 0.4,
    metalness: 0.3
  }),
  darkBone: new MeshStandardMaterial({
    color: "#d4d4d4",
    roughness: 0.3,
    metalness: 0.4
  }),
  eyeCore: new MeshStandardMaterial({
    color: "#4169E1",
    emissive: "#4169E1",
    emissiveIntensity: 3
  }),
  eyeGlow: new MeshStandardMaterial({
    color: "#4169E1",
    emissive: "#4169E1",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.75
  }),
  eyeOuterGlow: new MeshStandardMaterial({
    color: "#4169E1",
    emissive: "#4169E1",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.7
  })
};

// Create instanced components
function VertebraeInstances() {
  const instances = useMemo(() => {
    const mesh = new InstancedMesh(SHARED_GEOMETRIES.vertebrae, SHARED_MATERIALS.standardBone, 5);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    return mesh;
  }, []);

  useEffect(() => {
    [0.15, 0.27, 0.39, 0.51, 0.63].forEach((y, i) => {
      tempPosition.set(0, y, 0);
      tempRotation.set(0.1, 0, 0);
      tempScale.set(1, 1, 1);
      setMatrixAt(instances, i, tempPosition, tempRotation, tempScale);
    });
    instances.instanceMatrix.needsUpdate = true;
  }, [instances]);

  return <primitive object={instances} />;
}

function EyeSet({ position }: { position: [number, number, number] }) {
  const eyeParts = useMemo(() => ({
    core: new InstancedMesh(SHARED_GEOMETRIES.eye, SHARED_MATERIALS.eyeCore, 1),
    innerGlow: new InstancedMesh(SHARED_GEOMETRIES.eyeGlow, SHARED_MATERIALS.eyeGlow, 1),
    outerGlow: new InstancedMesh(SHARED_GEOMETRIES.eyeOuterGlow, SHARED_MATERIALS.eyeOuterGlow, 1)
  }), []);

  useEffect(() => {
    tempPosition.set(...position);
    tempRotation.set(0, 0, 0);
    
    setMatrixAt(eyeParts.core, 0, tempPosition, tempRotation, tempScale.set(1, 1, 1));
    setMatrixAt(eyeParts.innerGlow, 0, tempPosition, tempRotation, tempScale.set(1.2, 1.2, 1.2));
    setMatrixAt(eyeParts.outerGlow, 0, tempPosition, tempRotation, tempScale.set(1.4, 1.4, 1.4));

    Object.values(eyeParts).forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [eyeParts, position]);

  return (
    <group>
      <primitive object={eyeParts.core} />
      <primitive object={eyeParts.innerGlow} />
      <primitive object={eyeParts.outerGlow} />
      <pointLight color="#4169E1" intensity={0.5} distance={1} decay={2} position={position} />
    </group>
  );
}

interface GruntModelProps {
  isAttacking: boolean;
  isWalking: boolean;
  onHit: (damage: number) => void;
}

function BoneLegModel() {
  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={SHARED_GEOMETRIES.cylinder} material={SHARED_MATERIALS.standardBone} scale={[width/0.04, length, width/0.04]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={SHARED_GEOMETRIES.sphere} material={SHARED_MATERIALS.standardBone} scale={[size/0.06, size/0.06, size/0.06]} />
  );

  return (
    <group>
      {/* Hip joint connection */}
      {createJoint(0.08)}

      {/* Hip segment */}
      <group rotation={[0.3, 0, 0]}>
        {createBoneSegment(0.4, 0.07)}

        {/* Hip-to-leg joint */}
        <group position={[0, -0.2, 0]}>
          {createJoint(0.09)}

          {/* Original leg segments - adjusted positions */}
          <group position={[0, 0, -0.5]}>
            {/* First segment */}
            {createBoneSegment(0.8, 0.06)}
            
            {/* First joint */}
            <group position={[0, -0.4, 0]}>
              {createJoint(0.05)}
              
              {/* Second segment */}
              <group position={[0, 0, 0]}>
                {createBoneSegment(0.9, 0.04)}
                
                {/* Second joint */}
                <group position={[0, -0.45, 0]}>
                  {createJoint(0.04)}
                  
                  {/* Final segment */}
                  <group position={[0, 0, 0]}>
                    {createBoneSegment(0.7, 0.03)}
                    
                    {/* Tip claw */}
                    <group position={[0, -0.35, 0]}>
                      <mesh geometry={SHARED_GEOMETRIES.cone} material={SHARED_MATERIALS.darkBone} />
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function BossClawModel({ isLeftHand = false }: { isLeftHand?: boolean }) {
  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={SHARED_GEOMETRIES.cylinder} material={SHARED_MATERIALS.standardBone} scale={[width/0.04, length, width/0.04]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={SHARED_GEOMETRIES.sphere} material={SHARED_MATERIALS.standardBone} scale={[size/0.06, size/0.06, size/0.06]} />
  );

  const createParallelBones = (length: number, spacing: number) => (
    <group>
      <group position={[spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.06)}
      </group>
      <group position={[-spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.06)}
      </group>
      <group position={[0, length/2, 0]}>
        {createJoint(0.08)}
      </group>
      <group position={[0, -length/2, 0]}>
        {createJoint(0.08)}
      </group>
    </group>
  );

  const BLADE_SHAPE = (() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(
      0.8, 0.22,
      1.33, 0.5,
      1.6, 0.515
    );
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(
      0.5, 0.2,
      0.225, 0.0,
      0.1, 0.7
    );
    shape.lineTo(0, 0);
    return shape;
  })();

  const BLADE_EXTRUDE_SETTINGS = {
    steps: 1,
    depth: 0.00010,
    bevelEnabled: true,
    bevelThickness: 0.030,
    bevelSize: 0.035,
    bevelSegments: 1,
    curveSegments: 16
  };

  return (
    <group>
      <group>
        {createParallelBones(1.3, 0.15)}
        
        <group position={[0.25, -0.85, 0.21]}> 
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial 
              color="#e8e8e8"
              roughness={0.4}
              metalness={0.3}
            />
          </mesh>
          
          <group rotation={[-0.7, -0, Math.PI / 5]}>
            {createParallelBones(0.8, 0.12)}
            
            <group position={[0, -0.5, 0]} rotation={[0, 0, Math.PI / 5.5]}>
              {createJoint(0.09)}
              
              {/* GRUNT BLADES - Red instead of blue */}
              <group position={[0, 0.1, 0]}>
                <group 
                  position={[isLeftHand ? -0 : -0, -0.2, 0.2]} 
                  rotation={[2 + Math.PI/4, -1, Math.PI*2.675 + 0.85]} 
                  scale={[1.4, 0.55, 1.4]}
                >
                  <mesh>
                    <extrudeGeometry args={[BLADE_SHAPE, BLADE_EXTRUDE_SETTINGS]} />
                    <meshStandardMaterial 
                      color="#4169E1"
                      emissive="#4169E1"
                      emissiveIntensity={1.3}
                      metalness={0.8}
                      roughness={0.1}
                      opacity={1}
                      transparent
                      side={DoubleSide}
                    />
                  </mesh>
                  
                  <pointLight
                    color="#4169E1"
                    intensity={1}
                    distance={2}
                    decay={2}
                  />
                </group>

                <mesh>
                  <boxGeometry args={[0.2, 0.15, 0.08]} />
                  <meshStandardMaterial color="#e8e8e8" roughness={0.4} />
                </mesh>
                {[-0.08, -0.04, 0, 0.04, 0.08].map((offset, i) => (
                  <group 
                    key={i} 
                    position={[offset, -0.1, 0]}
                    rotation={[0, 0, (i - 2) * Math.PI / 10]}
                  >
                    {createBoneSegment(0.5, 0.02)}
                    <group position={[0.025, -0.3, 0]} rotation={[0, 0, Math.PI + Math.PI / 16]}>
                      <mesh>
                        <coneGeometry args={[0.03, 0.3, 6]} />
                        <meshStandardMaterial 
                          color="#d4d4d4"
                          roughness={0.3}
                          metalness={0.4}
                        />
                      </mesh>
                    </group>
                  </group>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function ShoulderPlate() {
  const createSpike = (scale = 1) => (
    <group scale={[scale, scale, scale]} position={[0, -0.125, 0]}>
      {/* Base segment */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.115, 4]} />
        <meshStandardMaterial 
          color="#e8e8e8"
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Middle segment with slight curve */}
      <mesh position={[0, 0.1, 0.0275]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.12, 4]} />
        <meshStandardMaterial 
          color="#e8e8e8"
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Sharp tip */}
      <mesh position={[0, 0.2, 0.04]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.04, 0.175, 4]} />
        <meshStandardMaterial 
          color="#d4d4d4"
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Decorative ridges */}
      {[0, Math.PI/2, Math.PI, Math.PI*3/2].map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[0.04, 0.05, 0]}>
            <boxGeometry args={[0.01, 0.12, 0.02]} />
            <meshStandardMaterial 
              color="#d4d4d4"
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  );

  return (
    <group>
      {/* Main shoulder plate */}
      <mesh>
        <cylinderGeometry args={[0.185, 0.2, 0.225, 4, 1]} />
        <meshStandardMaterial 
          color="#e8e8e8"
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      
      {/* Enhanced spikes with different sizes and angles */}
      <group position={[0, 0.25, 0]} rotation={[Math.PI*2, Math.PI/3, 0]}>
        {/* Center spike */}
        <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
          {createSpike(1.5)}
        </group>
        
        {/* Side spikes */}
        <group position={[0, -0.05, 0.15]} rotation={[-0.2, 0, 0]}>
          {createSpike(1.1)}
        </group>
        <group position={[0, -0.05, -0.15]} rotation={[0.2, 0, 0]}>
          {createSpike(1.1)}
        </group>
      </group>
    </group>
  );
}

function CustomHorn({ isLeft = false }: { isLeft?: boolean }) {
  const segments = 10;
  const heightPerSegment = 0.12;
  const baseWidth = 0.15;
  const twistAmount = Math.PI * 1.2;
  const curveAmount = 1.4;
  
  return (
    <group rotation={[-0.25, isLeft ? -0.3 : 0.3, isLeft ? -0.4 : 0.4]}>
      {Array.from({ length: segments }).map((_, i) => {
        const progress = i / (segments - 1);
        const width = baseWidth * (1 - progress * 0.8);
        const twist = Math.pow(progress, 1.2) * twistAmount;
        const curve = Math.pow(progress, 1.3) * curveAmount;
        
        return (
          <group 
            key={i}
            position={[
              curve * (isLeft ? -0.15 : 0.15),
              i * heightPerSegment,
              -curve * 0.6
            ]}
            rotation={[-0.8 * progress, twist, 0]}
          >
            <mesh>
              <cylinderGeometry 
                args={[width, width * 0.92, heightPerSegment, 4]}
              />
              <meshStandardMaterial 
                color={`rgb(${139 - progress * 80}, ${0 + progress * 20}, ${0 + progress * 20})`}
                roughness={0.7}
                metalness={0.4}
              />
            </mesh>
            
            {/* Ridge details - now with 4 faces to match reference */}
            {Array.from({ length: 4 }).map((_, j) => (
              <group 
                key={j} 
                rotation={[0, (j * Math.PI * 2) / 4, 0]}
              >
                <mesh position={[width * 0.95, 0, 0]}>
                  <boxGeometry args={[width * 0.4, heightPerSegment * 1.1, width * 0.2]} />
                  <meshStandardMaterial 
                    color={`rgb(${159 - progress * 100}, ${20 + progress * 20}, ${20 + progress * 20})`}
                    roughness={0.8}
                    metalness={0.3}
                  />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export default function GruntModel({ isAttacking, isWalking }: GruntModelProps) {
  const groupRef = useRef<Group>(null);
  const [walkCycle, setWalkCycle] = useState(0);
  const [attackCycle, setAttackCycle] = useState(0);
  const attackAnimationRef = useRef<NodeJS.Timeout>();

  const walkSpeed = 7;
  const attackSpeed = 3;
  const ARM_DELAY = 300; // 0.15 seconds between arms
  const TELEGRAPH_TIME = 650; // 850ms telegraph before first hit

  const LEG_PAIRS = [
    {
      left: 'LeftFrontLeg',
      right: 'RightFrontLeg',
      baseRotation: { x: 0.2, y: -0.6, z: 0.6 },
      rightBaseRotation: { x: 0.2, y: 0.6, z: -0.6 },
      phase: 0
    },
    {
      left: 'LeftMiddleFrontLeg',
      right: 'RightMiddleFrontLeg',
      baseRotation: { x: 0.25, y: -0.8, z: 0.7 },
      rightBaseRotation: { x: 0.25, y: 0.8, z: -0.7 },
      phase: Math.PI
    },
    {
      left: 'LeftMiddleBackLeg',
      right: 'RightMiddleBackLeg',
      baseRotation: { x: 0.5, y: -1.0, z: 0.7 },
      rightBaseRotation: { x: 0.5, y: 1.0, z: -0.7 },
      phase: 0
    },
    {
      left: 'LeftBackLeg',
      right: 'RightBackLeg',
      baseRotation: { x: 1, y: -1.2, z: 0.6 },
      rightBaseRotation: { x: 1, y: 1.2, z: -0.6 },
      phase: Math.PI
    }
  ];

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Cache frequently accessed objects
    const group = groupRef.current;
    
    if (isWalking) {
      const newWalkCycle = (walkCycle + delta * walkSpeed) % (Math.PI * 2);
      setWalkCycle(newWalkCycle);
      
      // Spider-like walking animation
      [
        'LeftFrontLeg', 'RightFrontLeg',
        'LeftMiddleFrontLeg', 'RightMiddleFrontLeg',
        'LeftMiddleBackLeg', 'RightMiddleBackLeg',
        'LeftBackLeg', 'RightBackLeg'
      ].forEach((part, index) => {
        const limb = group.getObjectByName(part) as Mesh;
        if (limb) {
          const isRight = part.includes('Right');
          // Spider legs move in alternating groups of 4
          const phaseOffset = index % 2 === 0 ? 0 : Math.PI;
          const phase = isRight ? newWalkCycle + phaseOffset : newWalkCycle + phaseOffset;
          
          // Lift-and-step motion
          const liftAmount = Math.max(0, Math.sin(phase)) * 0.3;
          const stepAmount = Math.cos(phase) * 0.2;
          
          // Apply spider-like leg movements
          limb.rotation.x = stepAmount;
          limb.position.y = 0.6 + liftAmount;
          
          // Find joint segments
          const firstJoint = limb.children[0]?.children[1];
          const secondJoint = firstJoint?.children[1]?.children[1];
          
          if (firstJoint && secondJoint) {
            // Inverse kinematics-like motion
            const jointPhase = phase + Math.PI / 4;
            firstJoint.rotation.x = Math.sin(jointPhase) * 0.4 - 0.2;
            secondJoint.rotation.x = -Math.sin(jointPhase) * 0.6 - 0.3;
          }
        }
      });
    }

    if (isAttacking) {
      setAttackCycle((prev) => prev + delta * attackSpeed);
      
      // Define arm pairs with their delays and rotations - ALL ARMS like original
      const armPairs = [
        { 
          left: 'LeftLowerBackArm', 
          right: 'RightLowerBackArm',
          startTime: TELEGRAPH_TIME / 1000,
          rotationRange: Math.PI * 0.5
        },
        { 
          left: 'LeftMiddleBackArm', 
          right: 'RightMiddleBackArm',
          startTime: (TELEGRAPH_TIME + ARM_DELAY) / 1000,
          rotationRange: Math.PI * 0.5
        },
        { 
          left: 'LeftUpperBackArm', 
          right: 'RightUpperBackArm',
          startTime: (TELEGRAPH_TIME + (ARM_DELAY * 2)) / 1000,
          rotationRange: Math.PI * 0.5
        },
        { 
          left: 'LeftFrontArm', 
          right: 'RightFrontArm',
          startTime: (TELEGRAPH_TIME + (ARM_DELAY * 3)) / 1000,
          rotationRange: Math.PI * 0.5
        }
      ];

      armPairs.forEach(({ left, right, startTime, rotationRange }) => {
        const leftArm = group.getObjectByName(left) as Mesh;
        const rightArm = group.getObjectByName(right) as Mesh;
        
        if (leftArm && rightArm) {
          const armProgress = Math.max(0, Math.min(1, (attackCycle - startTime) * 1));
          const rotationY = Math.sin(armProgress * Math.PI) * rotationRange;
          
          // Add forward pivot using sine wave for smooth animation
          const forwardPivot = Math.sin(armProgress * Math.PI) * 0.5;
          
          // Apply rotations
          leftArm.rotation.y = Math.PI * 4 + rotationY;
          rightArm.rotation.y = Math.PI * 4 - rotationY;
          
          // Apply forward pivot
          leftArm.rotation.z = forwardPivot;
          rightArm.rotation.z = forwardPivot;
        }
      });

      // Reset attack cycle after all arms have completed
      if (attackCycle > (TELEGRAPH_TIME + (ARM_DELAY * 6)) / 1000) {
        setAttackCycle(0);
        
        // Reset forward pivot when attack ends
        armPairs.forEach(({ left, right }) => {
          const leftArm = group.getObjectByName(left) as Mesh;
          const rightArm = group.getObjectByName(right) as Mesh;
          if (leftArm && rightArm) {
            leftArm.rotation.z = 0;
            rightArm.rotation.z = 0;
          }
        });
      }
    } else {
      // Reset arm positions when not attacking (adjusted default angles)
      const defaultRotations = [
        { left: 'LeftLowerBackArm', right: 'RightLowerBackArm', y: Math.PI * 4.2 },
        { left: 'LeftMiddleBackArm', right: 'RightMiddleBackArm', y: Math.PI * 4.1 },
        { left: 'LeftUpperBackArm', right: 'RightUpperBackArm', y: Math.PI * 4 },
        { left: 'LeftFrontArm', right: 'RightFrontArm', y: Math.PI * 4.9 }
      ];

      defaultRotations.forEach(({ left, right, y }) => {
        const leftArm = group.getObjectByName(left) as Mesh;
        const rightArm = group.getObjectByName(right) as Mesh;
        
        if (leftArm && rightArm) {
          leftArm.rotation.y = y;
          rightArm.rotation.y = -y;
        }
      });
    }

    if (!isAttacking) {
      // Walking animation
      const walkSpeed = 3;
      const walkAmplitude = 0.15;
      
      LEG_PAIRS.forEach(({ left, right, baseRotation, rightBaseRotation, phase }) => {
        const leftLeg = group.getObjectByName(left) as Mesh;
        const rightLeg = group.getObjectByName(right) as Mesh;
        
        if (leftLeg && rightLeg) {
          const time = state.clock.getElapsedTime() * walkSpeed;
          
          // Calculate leg movements with phase offset
          const leftCycle = Math.sin(time + phase);
          const rightCycle = Math.sin(time + phase + Math.PI); // Opposite phase
          
          // Apply animations relative to base rotations
          leftLeg.rotation.set(
            baseRotation.x + leftCycle * walkAmplitude,
            baseRotation.y + leftCycle * walkAmplitude * 0.3,
            baseRotation.z + leftCycle * walkAmplitude * 0.5
          );
          
          rightLeg.rotation.set(
            rightBaseRotation.x + rightCycle * walkAmplitude,
            rightBaseRotation.y + rightCycle * walkAmplitude * 0.3,
            rightBaseRotation.z + rightCycle * walkAmplitude * 0.5
          );
        }
      });
    }
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    const currentRef = attackAnimationRef.current;
    return () => {
      if (currentRef) {
        clearTimeout(currentRef);
      }
    };
  }, []);

  return (
    <group ref={groupRef} scale={[1.1, 1.3, 1.3]}> 
      <group position={[0, 1.375, -0]}>
        <GruntTrailEffect parentRef={groupRef} />
      </group>

      <group name="Body" position={[0, 1.2, -0.25]} scale={[1.8, 1.4, 1.65]} rotation={[0.25, 0, 0]}>
        <BonePlate />
      </group>

      <group scale={[0.7, 0.7, 0.7]} position={[0, 1.25, -0.1]} rotation={[0.25, 0, 0]}>
        <DragonSkull />
      </group>

      <group scale={[0.7, 0.5, 0.7]} position={[0, 1.3, -0.3]} rotation={[1, 0, -4.25]}>
        <CustomHorn isLeft={true} />
      </group>

      <group scale={[0.7, 0.5, 0.7]} position={[0, 1.3, -0.3]} rotation={[1, 0, 4.25]}>
        <CustomHorn isLeft={false} />
      </group>

      <group scale={[0.7, 0.5, 0.7]} position={[0, 0.7, -0.6]} rotation={[1, 0, -4.25]}>
        <CustomHorn isLeft={true} />
      </group>

      <group scale={[0.7, 0.5, 0.7]} position={[0, 0.7, -0.6]} rotation={[1, 0, 4.25]}>
        <CustomHorn isLeft={false} />
      </group>

      {/* SKULL POSITIONING */}
      <group name="Head" position={[0, 1.925, 0.2]} scale={[ 0.95, 0.8, 0.8]}>
        {/* Main skull shape */}
        <group>
          {/* Back of cranium */}
          <mesh position={[0, 0, -0.05]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
          </mesh>
          
          {/* Front face plate */}
          <mesh position={[0, -0.02, 0.12]}>
            <boxGeometry args={[0.28, 0.28, 0.1]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
          </mesh>

          {/* Cheekbones */}
          <group>
            <mesh position={[0.12, -0.08, 0.1]}>
              <boxGeometry args={[0.08, 0.12, 0.15]} />
              <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[-0.12, -0.08, 0.1]}>
              <boxGeometry args={[0.08, 0.12, 0.15]} />
              <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
            </mesh>
          </group>

          {/* Jaw structure */}
          <group position={[0, -0.15, 0.05]}>
            {/* Lower jaw - more angular and pointed */}
            <mesh position={[0, -0.08, 0.08]} rotation={[0, Math.PI/5, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.2, 5]} />
              <meshStandardMaterial color="#d8d8d8" roughness={0.5} metalness={0.2} />
            </mesh>
          </group>

          {/* Upper teeth row */}
          <group position={[0.025, -0.25, 0.2175]} >
            {[-0.03, -0.06, -0.09, -0, 0.03].map((offset, i) => (
              <group key={i} position={[offset, 0, 0]} rotation={[0.5, 0, 0]}>
                <mesh>
                  <coneGeometry args={[0.03, 0.075, 3]} />
                  <meshStandardMaterial 
                    color="#e8e8e8"
                    roughness={0.3}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Lower teeth row */}
          <group position={[0, -0.18, 0.2]}>
            {[-0.06, -0.02, 0.02, 0.06].map((offset, i) => (
              <group key={i} position={[offset, 0, 0]} rotation={[2.5, 0, 0]}>
                <mesh>
                  <coneGeometry args={[0.01, 0.08, 3]} />
                  <meshStandardMaterial 
                    color="#e8e8e8"
                    roughness={0.3}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            ))}
          </group>
        </group>

        {/* EYES - Red for grunt */}
        <group position={[0, 0.05, 0.14]}>
          {/* Left eye */}
          <EyeSet position={[-0.07, 0, 0]} />

          {/* Right eye */}
          <EyeSet position={[0.07, 0, 0]} />
        </group>
      </group>

      {/* Add shoulder plates just before the arms */}
      <group position={[-0.55, 1.8, 0.05]} rotation={[-0.45, -Math.PI/1.2, -.525]}>
        <ShoulderPlate />
      </group>
      <group position={[0.55, 1.8, 0.05]} rotation={[-0.45, Math.PI/1.2, 0.525 ]}>
        <ShoulderPlate />
      </group>

      {/* Front Arms (Original) */}
      <group name="LeftFrontArm" position={[-0.4, 1.525, 0.1]} scale={[-0.525, 0.425, 0.525]} rotation={[0.2, Math.PI/3, 0]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightFrontArm" position={[0.4, 1.525, 0.1]} scale={[0.525, 0.425, 0.525]} rotation={[0.2, -Math.PI/3, 0]}>
        <BossClawModel isLeftHand={false} />
      </group>

      {/* Back Arms (Larger) - ALL ARMS FROM ORIGINAL */}
      {/* Upper Back Arms */}
      <group name="LeftUpperBackArm" position={[-0.55, 1.6, 0]} scale={[-1.1, 0.7, 0.9]} rotation={[0, Math.PI*2, -0.4]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightUpperBackArm" position={[0.55, 1.6, 0]} scale={[1.1, 0.7, 0.9]} rotation={[0, -Math.PI*2, 0.4]}>
        <BossClawModel isLeftHand={false} />
      </group>

      {/* Middle Back Arms */}
      <group name="LeftMiddleBackArm" position={[-0.45, 1.5, -0.1]} scale={[-0.75, 0.75, 0.75]} rotation={[0.4, Math.PI*2.1, -.4]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightMiddleBackArm" position={[0.45, 1.5, -0.1]} scale={[0.75, 0.75, 0.75]} rotation={[0.4, -Math.PI*2.1, 0.4]}>
        <BossClawModel isLeftHand={false} />
      </group>

      {/* Lower Back Arms - ADDED MISSING ARMS */}
      <group name="LeftLowerBackArm" position={[-0.35, 1.4, -0.2]} scale={[-0.6, 0.6, 0.6]} rotation={[0.6, Math.PI*2.2, -.3]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightLowerBackArm" position={[0.35, 1.4, -0.2]} scale={[0.6, 0.6, 0.6]} rotation={[0.6, -Math.PI*2.2, 0.3]}>
        <BossClawModel isLeftHand={false} />
      </group>

      {/* Multiple Legs with spider-like positioning - ALL LEGS FROM ORIGINAL */}
      {/* Front Legs */}
      <group name="LeftFrontLeg" position={[0.4, 0.75, 0.4]} rotation={[0.2, -0.6, 0.6]}>
        <BoneLegModel />
      </group>
      <group name="RightFrontLeg" position={[-0.4, 0.75, 0.4]} rotation={[0.2, 0.6, -0.6]}>
        <BoneLegModel />
      </group>

      {/* Middle Front Legs */}
      <group name="LeftMiddleFrontLeg" position={[0.6, 0.73, 0]} rotation={[0.25, -0.8, 0.7]}>
        <BoneLegModel />
      </group>
      <group name="RightMiddleFrontLeg" position={[-0.6, 0.73, 0]} rotation={[0.25, 0.8, -0.7]}>
        <BoneLegModel />
      </group>

      {/* Middle Back Legs */}
      <group name="LeftMiddleBackLeg" position={[0.5, 0.71, -0.35]} rotation={[0.5, -1.0, 0.7]}>
        <BoneLegModel />
      </group>
      <group name="RightMiddleBackLeg" position={[-0.5, 0.71, -0.35]} rotation={[0.5, 1.0, -0.7]}>
        <BoneLegModel />
      </group>

      {/* Back Legs */}
      <group name="LeftBackLeg" position={[0.4, 0.7, -0.725]} rotation={[1, -1.2, 0.6]}>
        <BoneLegModel />
      </group>
      <group name="RightBackLeg" position={[-0.4, 0.7, -0.725]} rotation={[1, 1.2, -0.6]}>
        <BoneLegModel />
      </group>

      <group position={[0, 1.925, 0.245]} scale={[0.405, 0.425, 0.275]}>
        {/* Left Horn */}
        <group position={[0.2, 0.2, 0]} rotation={[-0.4, 0.5, -0.2]}>
          <CustomHorn isLeft={true} />    
        </group>
        
        {/* Right Horn */}
        <group position={[-0.2, 0.2, 0]} rotation={[-0.3, -0.5, 0.3]}>
          <CustomHorn isLeft={false} />
        </group>
      </group>

      {/* Pelvis structure */}
      <group position={[0, 0.5, -0.25]} scale={[1.9, 1, 1.75]}>
        {/* Main pelvic bowl */}
        <mesh>
          <cylinderGeometry args={[0.35, 0.34, 0.27, 8]} />
          <meshStandardMaterial color="#d8d8d8" roughness={0.5} metalness={0.2} />
        </mesh>

        {/* Sacral vertebrae */}
        <group position={[0, 0.15, -0.16]} rotation={[0.1, 0, 0]}>
          <VertebraeInstances />
        </group>

        {/* Pelvic joints */}
        {[-1, 1].map((side) => (
          <group key={side} position={[0.15 * side, -0.1, 0]}>
            <mesh>
              <sphereGeometry args={[0.075, 8, 8]} />
              <meshStandardMaterial color="#d8d8d8" roughness={0.5} metalness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}