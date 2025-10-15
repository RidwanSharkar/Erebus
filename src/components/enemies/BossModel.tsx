// Combined Boss Model - Ascendant + Abomination features with 6 arms, spell-casting, and complex animations
import React, { useRef, useEffect, useMemo } from 'react';
import { Group, MeshStandardMaterial, SphereGeometry, CylinderGeometry, ConeGeometry, BoxGeometry, Shape, ExtrudeGeometry, InstancedMesh, Matrix4, Vector3, Euler, TorusGeometry, Quaternion } from 'three';
import { useFrame } from '@react-three/fiber';
import BonePlate from '../dragon/BonePlate';
import AscendantBoneWings from '../dragon/AscendantBoneWings';
import BoneTail from '../dragon/BoneTail';
import BoneAura from '../dragon/BoneAura';
import DraconicWingJets from '../dragon/DraconicWingJets';
import { WeaponType } from '../dragon/weapons';
import * as THREE from 'three';
import BossBoneWings from './BossBoneWings';
import ElementalVortex from './ElementalVortex';
import BossDragonSkull from './BossDragonSkull';

interface BossModelProps {
  isAttacking?: boolean;
  onHit?: (damage: number) => void;
  attackingHand?: 'left' | 'right' | null;
  onLightningStart?: (hand: 'left' | 'right') => void;
}

// Materials for the arms
const standardBoneMaterial = new MeshStandardMaterial({
  color: "#e8e8e8",
  roughness: 0.4,
  metalness: 0.3
});

const darkBoneMaterial = new MeshStandardMaterial({
  color: "#d4d4d4",
  roughness: 0.3,
  metalness: 0.4
});

// Cache geometries for arm components - scaled to match Boss proportions
const armJointGeometry = new SphereGeometry(0.06, 6, 6);
armJointGeometry.userData = { shared: true }; // Mark as shared to prevent disposal
const armBoneGeometry = new CylinderGeometry(0.06, 0.048, 1, 4);
armBoneGeometry.userData = { shared: true }; // Mark as shared to prevent disposal
const clawGeometry = new ConeGeometry(0.03, 0.15, 6);
clawGeometry.userData = { shared: true }; // Mark as shared to prevent disposal

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

// Create shared materials
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
    color: "#BA55D3",
    emissive: "#BA55D3",
    emissiveIntensity: 3
  }),
  eyeGlow: new MeshStandardMaterial({
    color: "#BA55D3",
    emissive: "#BA55D3",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.75
  }),
  eyeOuterGlow: new MeshStandardMaterial({
    color: "#BA55D3",
    emissive: "#BA55D3",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.7
  })
};

// Helper functions for instanced meshes
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

function AscendantArm({ isRaised = false }: { isRaised?: boolean }) {
  const armRef = useRef<Group>(null);

  // Smooth animation for raising/lowering the arm
  useFrame((_, delta) => {
    if (!armRef.current) return;

    const targetRotation = isRaised ? -Math.PI/3 : 0; // More natural arm raise angle
    const currentRotation = armRef.current.rotation.x;
    const lerpFactor = 5 * delta; // Animation speed

    armRef.current.rotation.x = THREE.MathUtils.lerp(currentRotation, targetRotation, lerpFactor);
  });

  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={armBoneGeometry} material={standardBoneMaterial} scale={[width/0.06, length, width/0.06]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={armJointGeometry} material={standardBoneMaterial} scale={[size/0.06, size/0.06, size/0.06]} />
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
        {createJoint(0.075)}
      </group>
      <group position={[0, -length/2, 0]}>
        {createJoint(0.075)}
      </group>
    </group>
  );

  return (
    <group ref={armRef}>
      {/* Upper arm - proportioned like Boss arms */}
      <group>
        {createParallelBones(1.0, 0.15)}

        {/* Elbow joint */}
        <group position={[0, -0.6, 0]}>
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
          </mesh>

          {/* Forearm */}
          <group position={[0, -0.35, 0.275]} rotation={[-0.7, 0, 0]}>
            {createParallelBones(0.8, 0.12)}

            {/* Wrist/Hand */}
            <group position={[0, -0.5, 0]} rotation={[0, 0, 0]}>
              {createJoint(0.09)}

              {/* Hand structure - similar to Boss claw proportions */}
              <group position={[0, -0.1, 0]} scale={[1.2, 1.2, 1.2]}>
                <mesh>
                  <boxGeometry args={[0.2, 0.15, 0.08]} />
                  <meshStandardMaterial color="#e8e8e8" roughness={0.4} />
                </mesh>

                {/* Fingers for spell casting */}
                {[-0.08, -0.04, 0, 0.04, 0.08].map((offset, i) => (
                  <group
                    key={i}
                    position={[offset, -0.1, 0]}
                    rotation={[0, 0, (i - 2) * Math.PI / 10]}
                  >
                    {createBoneSegment(0.5, 0.02)}
                    <group position={[0.025, -0.3, 0]} rotation={[0, 0, Math.PI/8]} scale={[1.2, 1.2, 1.2]}>
                      <mesh geometry={clawGeometry} material={darkBoneMaterial} />
                    </group>
                  </group>
                ))}

                {/* Palm energy glow when raised (for lightning casting) */}
                {isRaised && (
                  <group position={[0, -0.05, 0.1]}>
                    <mesh>
                      <sphereGeometry args={[0.06, 8, 8]} />
                      <meshStandardMaterial
                        color="#FF0000"
                        emissive="#FF0000"
                        emissiveIntensity={2}
                        transparent
                        opacity={0.8}
                      />
                    </mesh>
                    <pointLight
                      color="#FF0000"
                      intensity={1.5}
                      distance={2}
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

// Instanced components
function VertebraeInstances() {
  const instances = useMemo(() => {
    const mesh = new InstancedMesh(SHARED_GEOMETRIES.vertebrae, SHARED_MATERIALS.standardBone, 5);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
      <pointLight color="#BA55D3" intensity={0.5} distance={1} decay={2} position={position} />
    </group>
  );
}


// Boss Claw Model with Ultralisk Blades
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

              {/* ULTRALISK BLADES */}
              <group position={[0, 0.1, 0]}>
                <group
                  position={[isLeftHand ? -0 : -0, 0, 0]}
                  rotation={[2 + Math.PI/4, -0.75, Math.PI*2.675 + 0.85]}
                  scale={[1.1, 0.55, 1.4]}
                >
                  <mesh>
                    <extrudeGeometry args={[BLADE_SHAPE, BLADE_EXTRUDE_SETTINGS]} />
                    <meshStandardMaterial
                      color="#BA55D3"
                      emissive="#BA55D3"
                      emissiveIntensity={1.3}
                      metalness={0.8}
                      roughness={0.1}
                      opacity={1}
                      transparent
                      side={THREE.DoubleSide}
                    />
                  </mesh>

                  <pointLight
                    color="#BA55D3"
                    intensity={1}
                    distance={2}
                    decay={2}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

// Shoulder Plate component
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

// Custom Horn component
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

            {/* Ridge details */}
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

// Boss Trail Effect component - enhanced particle system
function BossTrailEffect({ parentRef }: { parentRef: React.RefObject<Group> }) {
  const particlesCount = 10; // More particles for boss
  const particlesRef = useRef<THREE.Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!particlesRef.current?.parent || !parentRef.current) return;

    timeRef.current += delta;
    const bossPosition = parentRef.current.position;

    // Create a spiral pattern with more particles
    for (let i = 0; i < particlesCount; i++) {
      const angle = (i / particlesCount) * Math.PI * 2 + timeRef.current;
      const radius = 0.12 + Math.sin(timeRef.current * 1.5 + i * 0.3) * 0.08; // Larger radius for boss

      positionsRef.current[i * 3] = bossPosition.x + Math.cos(angle) * radius;
      positionsRef.current[i * 3 + 1] = bossPosition.y + Math.sin(timeRef.current + i * 0.2) * 0.02;
      positionsRef.current[i * 3 + 2] = bossPosition.z + Math.sin(angle) * radius;

      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 1.5) * 0.35; // Higher opacity for boss
      scalesRef.current[i] = 0.5 * Math.pow((1 - i / particlesCount), 0.6); // Larger particles
    }

    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.opacity.needsUpdate = true;
      geometry.attributes.scale.needsUpdate = true;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positionsRef.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={particlesCount}
          array={opacitiesRef.current}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-scale"
          count={particlesCount}
          array={scalesRef.current}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float opacity;
          attribute float scale;
          varying float vOpacity;
          void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float strength = smoothstep(0.5, 0.1, d);
            vec3 glowColor = mix(vec3(0.4, 0.2, 0.5), vec3(0.6, 0.3, 0.7), 0.4); // Light purple glow
            gl_FragColor = vec4(glowColor, vOpacity * strength);
          }
        `}
      />
    </points>
  );
}

export default function BossModel({
  isAttacking = false,
  attackingHand = null,
  onLightningStart
}: BossModelProps) {
  const groupRef = useRef<Group>(null);
  const attackCycleRef = useRef(0);
  const wasAttackingRef = useRef(false);

  // Attack animation constants - synchronized with damage dealing window
  const ARM_DELAY = 60; // 60ms between arms for visible sequence
  const TELEGRAPH_TIME = 80; // 80ms telegraph before first hit
  const ATTACK_DURATION = 0.35; // Match the 0.4s attack detection window


  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Cache frequently accessed objects
    const group = groupRef.current;

    // Detect when attack starts (transition from false to true)
    if (isAttacking && !wasAttackingRef.current) {
      attackCycleRef.current = 0; // Reset animation cycle
      console.log('🎯 Boss attack animation started');
    }
    wasAttackingRef.current = isAttacking;

    if (isAttacking && attackCycleRef.current < ATTACK_DURATION) {
      attackCycleRef.current += delta;

      // Define arm pairs with their delays and rotations
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
        const leftArm = group.getObjectByName(left) as THREE.Mesh;
        const rightArm = group.getObjectByName(right) as THREE.Mesh;

        if (leftArm && rightArm) {
          const armProgress = Math.max(0, Math.min(1, (attackCycleRef.current - startTime) * 2)); // Faster progression
          const rotationY = Math.sin(armProgress * Math.PI) * rotationRange;

          // Add forward pivot using sine wave for smooth animation
          const forwardPivot = Math.sin(armProgress * Math.PI) * 0.5;

          // Apply rotations
          leftArm.rotation.y = Math.PI * 4 + rotationY;
          rightArm.rotation.y = Math.PI * 4 - rotationY;

          // Apply forward pivot
          leftArm.rotation.z = forwardPivot;
          rightArm.rotation.z = forwardPivot;

          // Trigger lightning at specific phase for front arms
          if ((left === 'LeftFrontArm' || right === 'RightFrontArm') &&
              armProgress > 0.3 && armProgress < 0.7 &&
              onLightningStart) {
            if (left === 'LeftFrontArm') onLightningStart('left');
            if (right === 'RightFrontArm') onLightningStart('right');
          }
        }
      });

      // Reset forward pivot when attack ends
      if (attackCycleRef.current >= ATTACK_DURATION) {
        armPairs.forEach(({ left, right }) => {
          const leftArm = group.getObjectByName(left) as THREE.Mesh;
          const rightArm = group.getObjectByName(right) as THREE.Mesh;
          if (leftArm && rightArm) {
            leftArm.rotation.z = 0;
            rightArm.rotation.z = 0;
          }
        });
        console.log('🎯 Boss attack animation completed');
      }
    } else if (!isAttacking) {
      // Reset arm positions when not attacking
      const defaultRotations = [
        { left: 'LeftLowerBackArm', right: 'RightLowerBackArm', y: Math.PI * 4.2 },
        { left: 'LeftMiddleBackArm', right: 'RightMiddleBackArm', y: Math.PI * 4.1 },
        { left: 'LeftUpperBackArm', right: 'RightUpperBackArm', y: Math.PI * 4 },
        { left: 'LeftFrontArm', right: 'RightFrontArm', y: Math.PI * 4.9 }
      ];

      defaultRotations.forEach(({ left, right, y }) => {
        const leftArm = group.getObjectByName(left) as THREE.Mesh;
        const rightArm = group.getObjectByName(right) as THREE.Mesh;

        if (leftArm && rightArm) {
          leftArm.rotation.y = y;
          rightArm.rotation.y = -y;
        }
      });

      // Reset attack cycle when not attacking
      if (attackCycleRef.current > 0) {
        attackCycleRef.current = 0;
      }
    }

  });

  // Cleanup Three.js resources on unmount
  React.useEffect(() => {
    // Capture the current ref value to use in cleanup
    const currentGroupRef = groupRef.current;

    return () => {
      if (currentGroupRef) {
        currentGroupRef.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            // Dispose geometries (but not shared ones)
            if (child.geometry && !child.geometry.userData?.shared) {
              child.geometry.dispose();
            }

            // Dispose materials
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material: THREE.Material) => material.dispose());
              } else {
                (child.material as THREE.Material).dispose();
              }
            }
          }
        });
      }
    };
  }, []);

  return (
    <group ref={groupRef} scale={[1.2,  1.2, 1.2]}> {/* Slightly larger than Reaper */}
      {/* Trail Effects */}
      <group position={[0, 2.15, -0]}>
        <BossTrailEffect parentRef={groupRef} />
      </group>

      {/* Body - Bone Plate */}
      <group position={[0, 2.15, -0.15]} scale={[1.25, 1.1, 1.25]} rotation={[0.0, 0, 0]}>
        <BonePlate />
      </group>

      <group position={[0, 2.5, 0.25]} scale={[0.65, 0.75, 0.75]} rotation={[0.5, 0, 0]}>
        <BossDragonSkull />
      </group>


 

      {/* Wings at height 3 on both sides */}
      <group position={[0, 2.5, -0.05]} rotation={[0, Math.PI / 5, 0]} scale={[1.75, 1.75, 1.15]}>
        <BossBoneWings
          isLeftWing={true}
          parentRef={groupRef}
          isDashing={false}
        />
      </group>
      <group position={[0, 2.5, -0.05]} rotation={[0, -Math.PI / 5, 0]} scale={[1.75, 1.75, 1.15]}>
        <BossBoneWings
          isLeftWing={false}
          parentRef={groupRef}
          isDashing={false}
        />
      </group>


      {/* Shoulder Plates */}
      <group position={[-0.55, 2.8, 0.05]} rotation={[-0.45, -Math.PI/1.2, -.525]}>
        <ShoulderPlate />
      </group>
      <group position={[0.55, 2.8, 0.05]} rotation={[-0.45, Math.PI/1.2, 0.525]}>
        <ShoulderPlate />
      </group>

      {/* Bone Tail */}
      <group scale={[1.5, 1.5, 1.5]} position={[0, 1.75, -0.05]}>
        <BoneTail />
      </group>

      <group position={[0, 0.25, 0]} scale={[0.75, 0.75, 0.75]}>
        <ElementalVortex parentRef={groupRef} />
      </group>



      {/* Back Arms (Blade arms with sequential attacks) */}
      <group name="LeftUpperBackArm" position={[-0.55, 2.6, 0]} scale={[-0.9, 0.7, 0.9]} rotation={[0, Math.PI*2, -0.4]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightUpperBackArm" position={[0.55, 2.6, 0]} scale={[0.9, 0.7, 0.9]} rotation={[0, -Math.PI*2, 0.4]}>
        <BossClawModel isLeftHand={false} />
      </group>

      <group name="LeftMiddleBackArm" position={[-0.45, 2.5, -0.1]} scale={[-0.75, 0.75, 0.75]} rotation={[0.4, Math.PI*2.1, -.4]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightMiddleBackArm" position={[0.45, 2.5, -0.1]} scale={[0.75, 0.75, 0.75]} rotation={[0.4, -Math.PI*2.1, 0.4]}>
        <BossClawModel isLeftHand={false} />
      </group>



    </group>
  );    
}

