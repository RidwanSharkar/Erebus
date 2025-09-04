import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Shape, AdditiveBlending } from '@/utils/three-exports';

const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

interface SabresProps {
  isSwinging: boolean;
  onSwingComplete: () => void;
  onLeftSwingStart: () => void;
  onRightSwingStart: () => void;
  isCharging?: boolean;
  subclass?: string;
}

export default function Sabres({ 
  isSwinging, 
  onSwingComplete, 
  onLeftSwingStart, 
  onRightSwingStart,
  isCharging = false,
  subclass = 'FROST'
}: SabresProps) {
  // Refs and states for the left sabre
  const leftSabreRef = useRef<Group>(null);
  const leftSwingProgress = useRef(0);

  // Refs and states for the right sabre
  const rightSabreRef = useRef<Group>(null);
  const rightSwingProgress = useRef(0);

  const leftBasePosition = [-0.8, 0.75, 0.65] as const;
  const rightBasePosition = [0.8, 0.75, 0.65] as const;

  // Ref for tracking right swing delay
  const rightSwingDelay = useRef(0);

  // Ref to track swing completion
  const isSwingComplete = useRef(false);

  // Ref for left swing delay
  const leftSwingDelay = useRef(0);

  useFrame((_, delta) => {
    if (leftSabreRef.current && rightSabreRef.current) {
      if (isCharging) {
        // SHEATHING POSITIONS when charging/channeling
        const leftSheathPosition = [-0.8, -0.2, 0.5];
        const rightSheathPosition = [0.8, -0.2, 0.5];
        
        // Smoothly move to sheathed positions
        leftSabreRef.current.position.x += (leftSheathPosition[0] - leftSabreRef.current.position.x) * 0.3;
        leftSabreRef.current.position.y += (leftSheathPosition[1] - leftSabreRef.current.position.y) * 0.3;
        leftSabreRef.current.position.z += (leftSheathPosition[2] - leftSabreRef.current.position.z) * 0.3;
        
        rightSabreRef.current.position.x += (rightSheathPosition[0] - rightSabreRef.current.position.x) * 0.3;
        rightSabreRef.current.position.y += (rightSheathPosition[1] - rightSabreRef.current.position.y) * 0.3;
        rightSabreRef.current.position.z += (rightSheathPosition[2] - rightSabreRef.current.position.z) * 0.3;
        
        // Full rotation plus a bit more to point downward
        leftSabreRef.current.rotation.x = lerp(leftSabreRef.current.rotation.x * 1.05, Math.PI * 0.37, 0.3);
        leftSabreRef.current.rotation.z = lerp(leftSabreRef.current.rotation.z, Math.PI * 1.65, 0.20);
        
        rightSabreRef.current.rotation.x = lerp(rightSabreRef.current.rotation.x * 1.05, Math.PI * 0.37, 0.3);
        rightSabreRef.current.rotation.z = lerp(rightSabreRef.current.rotation.z, -Math.PI * 1.65, 0.2);

        // Reset swing states when channeling
        leftSwingProgress.current = 0;
        rightSwingProgress.current = 0;
        leftSwingDelay.current = 0;
        rightSwingDelay.current = 0;
        isSwingComplete.current = false;

      } else if (isSwinging) {
        // Reset isSwingComplete when starting a new swing
        if (leftSwingProgress.current === 0 && rightSwingProgress.current === 0) {
          isSwingComplete.current = false;
        }
        
        // Handle left sabre swing with delay
        if (leftSabreRef.current) {
          if (leftSwingDelay.current < 0.115) {  // 0.15 seconds delay
            leftSwingDelay.current += delta;
          } else {
            if (leftSwingProgress.current === 0) {
              onLeftSwingStart();
            }
            leftSwingProgress.current += delta * 12;

            const swingPhase = Math.min(leftSwingProgress.current / Math.PI, 1);

            // Adjusted left sabre movement to swing towards front center
            const pivotX = leftBasePosition[0] + Math.sin(swingPhase * Math.PI) * 1.2 - 0.45;
            const pivotY = leftBasePosition[1] + (Math.sin(swingPhase * Math.PI * 2) * -0.25);
            const pivotZ = leftBasePosition[2] + (Math.sin(swingPhase * Math.PI) * 1.75);

            leftSabreRef.current.position.set(pivotX, pivotY, pivotZ);

            // Left sabre specific rotations
            const leftRotationX = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.65);
            const leftRotationY = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.3);
            const leftRotationZ = Math.sin(swingPhase * Math.PI) * (Math.PI * -0.1);

            leftSabreRef.current.rotation.set(leftRotationX, leftRotationY, leftRotationZ);

            if (leftSwingProgress.current >= Math.PI) {
              leftSwingProgress.current = 0;
              leftSwingDelay.current = 0;
              leftSabreRef.current.rotation.set(0, 0, 0);
              leftSabreRef.current.position.set(...leftBasePosition);
            }
          }
        }
        
        // Handle right sabre swing (starts immediately)
        if (rightSabreRef.current) {
          if (rightSwingProgress.current === 0) {
            onRightSwingStart();
          }
          rightSwingProgress.current += delta * 12;

          const swingPhase = Math.min(rightSwingProgress.current / Math.PI, 1);

          // Adjusted right sabre movement to mirror left sabre
          const pivotX = rightBasePosition[0] - Math.sin(swingPhase * Math.PI) * 1.2 + 0.45;
          const pivotY = rightBasePosition[1] + (Math.sin(swingPhase * Math.PI * 2) * -0.25);
          const pivotZ = rightBasePosition[2] + (Math.sin(swingPhase * Math.PI) * 1.75);

          rightSabreRef.current.position.set(pivotX, pivotY, pivotZ);

          // Right sabre specific rotations
          const rightRotationX = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.5);
          const rightRotationY = -Math.sin(swingPhase * Math.PI) * (Math.PI * 0.3);
          const rightRotationZ = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.2);

          rightSabreRef.current.rotation.set(rightRotationX, rightRotationY, rightRotationZ);

          if (rightSwingProgress.current >= Math.PI) {
            rightSwingProgress.current = 0;
            rightSwingDelay.current = 0;
            rightSabreRef.current.rotation.set(0, 0, 0);
            rightSabreRef.current.position.set(...rightBasePosition);
            isSwingComplete.current = true;
            onSwingComplete();
          }
        }
      } else {
        // Return to original combat positions
        leftSabreRef.current.position.x += (leftBasePosition[0] - leftSabreRef.current.position.x) * 0.20;
        leftSabreRef.current.position.y += (leftBasePosition[1] - leftSabreRef.current.position.y) * 0.20;
        leftSabreRef.current.position.z += (leftBasePosition[2] - leftSabreRef.current.position.z) * 0.20;
        
        rightSabreRef.current.position.x += (rightBasePosition[0] - rightSabreRef.current.position.x) * 0.20;
        rightSabreRef.current.position.y += (rightBasePosition[1] - rightSabreRef.current.position.y) * 0.20;
        rightSabreRef.current.position.z += (rightBasePosition[2] - rightSabreRef.current.position.z) * 0.20;
        
        // Reset all rotations
        leftSabreRef.current.rotation.x *= 0.85;
        leftSabreRef.current.rotation.y *= 0.85;
        leftSabreRef.current.rotation.z *= 0.85;
        
        rightSabreRef.current.rotation.x *= 0.85;
        rightSabreRef.current.rotation.y *= 0.85;
        rightSabreRef.current.rotation.z *= 0.85;

        // Reset swing states when idle
        if (!isSwinging) {
          leftSwingProgress.current = 0;
          rightSwingProgress.current = 0;
          leftSwingDelay.current = 0;
          rightSwingDelay.current = 0;
          isSwingComplete.current = false;
        }
      }
    }
  });

  // Create custom sabre blade shape (scimitar)
  const createBladeShape = () => {
    const shape = new Shape();

    // Start at center
    shape.moveTo(0, 0);

    // Ornate guard shape
    shape.lineTo(-0.15, 0.1);
    shape.lineTo(-0.2, 0);  // Deeper notch
    shape.lineTo(-0.2, -0.05);
    shape.lineTo(0, 0);

    // Mirror for right side of guard
    shape.lineTo(0.15, 0.1);
    shape.lineTo(0.2, 0);   // Deeper notch
    shape.lineTo(0.3, 0.0);
    shape.lineTo(0, 0);

    // Elegant curved blade shape
    shape.lineTo(0, 0.05);
    // Graceful curve up
    shape.quadraticCurveTo(0.3, 0.15, 0.5, 0.2);
    shape.quadraticCurveTo(0.7, 0.25, 0.9, 0.15);
    // Sharp elegant tip
    shape.quadraticCurveTo(1.0, 0.1, 1.1, 0);
    // Sweeping bottom curve with notch
    shape.quadraticCurveTo(1.0, -0.05, 0.8, -0.1);
    // Distinctive notch
    shape.lineTo(0.7, -0.15);
    shape.lineTo(0.65, -0.1);
    // Continue curve to handle
    shape.quadraticCurveTo(0.4, -0.08, 0.2, -0.05);
    shape.quadraticCurveTo(0.1, -0.02, 0, 0);

    return shape;
  };

  // Make inner blade shape match outer blade
  const createInnerBladeShape = () => {
    const shape = new Shape();

    // Start at center
    shape.moveTo(0, 0);

    // Ornate guard shape (slightly smaller)
    shape.lineTo(-0.13, 0.08);
    shape.lineTo(-0.18, 0);
    shape.lineTo(-0.08, -0.04);
    shape.lineTo(0, 0);

    // Mirror for right side
    shape.lineTo(0.13, 0.08);
    shape.lineTo(0.18, 0);
    shape.lineTo(0.08, -0.04);
    shape.lineTo(0, 0);

    // Elegant curved blade shape (slightly smaller)
    shape.lineTo(0, 0.04);
    // Graceful curve up
    shape.quadraticCurveTo(0.28, 0.13, 0.48, 0.18);
    shape.quadraticCurveTo(0.68, 0.23, 0.88, 0.13);
    // Sharp elegant tip
    shape.quadraticCurveTo(0.98, 0.08, 1.08, 0);
    // Sweeping bottom curve with notch
    shape.quadraticCurveTo(0.98, -0.04, 0.78, -0.08);
    // Distinctive notch
    shape.lineTo(0.68, -0.13);
    shape.lineTo(0.63, -0.08);
    // Continue curve to handle
    shape.quadraticCurveTo(0.38, -0.06, 0.18, -0.04);
    shape.quadraticCurveTo(0.08, -0.02, 0, 0);

    return shape;
  };

  // Update blade extrude settings for an even thinner blade
  const bladeExtrudeSettings = {
    steps: 2,
    depth: 0.02, 
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.01,
    bevelSegments: 3,
  };

  const innerBladeExtrudeSettings = {
    ...bladeExtrudeSettings,
    depth: 0.025,
    bevelThickness: 0.003,
    bevelSize: 0.004,
    bevelOffset: 0,
  };

  // Get colors based on subclass
  const getBladeColors = () => {
    switch (subclass) {
      case 'FROST':
        return {
          primary: '#ff0000',
          emissive: '#ff2200',
          secondary: '#cc0000',
          secondaryEmissive: '#ff0000'
        };
      case 'ASSASSIN':
        return {
          primary: '#8b0000',
          emissive: '#ff0000',
          secondary: '#4b0000',
          secondaryEmissive: '#cc0000'
        };
      default:
        return {
          primary: '#ff0000',
          emissive: '#ff2200',
          secondary: '#cc0000',
          secondaryEmissive: '#ff0000'
        };
    }
  };

  const colors = getBladeColors();

  return (
    <group 
      position={[0, -0.6, 0.5]} 
      rotation={[-0.55, 0, 0]}
      scale={[0.775, 0.775, 0.775]}
    >
      {/* Left Sabre */}
      <group 
        ref={leftSabreRef} 
        position={[leftBasePosition[0], leftBasePosition[1], leftBasePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[1, 1, 0.875]}
      >
        {/* Handle */}
        <group position={[0.2, -0.125, 0]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.02, 0.45, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          
          {/* Handle wrappings */}
          {[...Array(4)].map((_, i) => (
            <mesh key={i} position={[0, 0.175 - i * 0.065, 0]}>
              <torusGeometry args={[0.0225, 0.004, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        
        {/* Blade */}
        <group position={[0.2, 0.3, 0.0]} rotation={[0, Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={[createBladeShape(), bladeExtrudeSettings]} />
            <meshStandardMaterial 
              color={colors.primary}
              emissive={colors.emissive}
              emissiveIntensity={3}
              metalness={0.9}
              roughness={0.2}
              opacity={0.9}
              transparent
            />
          </mesh>
          
          {/* Outer ethereal glow */}
          <mesh position={[0, 0, -0.02]}>
            <extrudeGeometry args={[createInnerBladeShape(), {
              ...innerBladeExtrudeSettings,
              depth: 0.06
            }]} />
            <meshStandardMaterial 
              color={colors.secondary}
              emissive={colors.secondaryEmissive}
              emissiveIntensity={8}
              metalness={0.7}
              roughness={0.1}
              opacity={0.4}
              transparent
            />
          </mesh>
          
          {/* Point light for local illumination */}
          <pointLight
            color={colors.emissive}
            intensity={5}
            distance={2}
            decay={2}
          />
        </group>
      </group>

      {/* Right Sabre */}
      <group 
        ref={rightSabreRef} 
        position={[rightBasePosition[0], rightBasePosition[1], rightBasePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[1, 1, 0.875]}
      >
        {/* Handle */}
        <group position={[-0.2, -0.125, 0]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.02, 0.45, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          
          {/* Handle wrappings */}
          {[...Array(4)].map((_, i) => (
            <mesh key={i} position={[0, 0.175 - i * 0.065, 0]}>
              <torusGeometry args={[0.0225, 0.004, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        
        {/* Blade */}
        <group position={[-0.2, 0.3, 0.]} rotation={[0, Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={[createBladeShape(), bladeExtrudeSettings]} />
            <meshStandardMaterial 
              color={colors.primary}
              emissive={colors.emissive}
              emissiveIntensity={2}
              metalness={0.9}
              roughness={0.2}
              opacity={0.9}
              transparent
            />
          </mesh>
          
          {/* Outer ethereal glow */}
          <mesh position={[0, 0, -0.02]}>
            <extrudeGeometry args={[createInnerBladeShape(), {
              ...innerBladeExtrudeSettings,
              depth: 0.06
            }]} />
            <meshStandardMaterial 
              color={colors.secondary}
              emissive={colors.secondaryEmissive}
              emissiveIntensity={3.5}
              metalness={0.7}
              roughness={0.1}
              opacity={0.4}
              transparent
            />
          </mesh>
          
          {/* Point light for local illumination */}
          <pointLight
            color={colors.emissive}
            intensity={1.5}
            distance={2}
            decay={2}
          />
        </group>
      </group>
    </group>
  );
}
