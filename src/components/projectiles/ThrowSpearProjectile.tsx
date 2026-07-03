import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Shape, Color, DoubleSide, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

// Reused scratch vectors — no per-frame alloc.
const _spearLightWorld = new Vector3();
const _lookDirScratch = new Vector3();

interface ThrowSpearProjectileProps {
  projectile: { opacity: number };
  position: Vector3;
  direction: Vector3;
  isReturning: boolean;
  chargeTime: number; // 0-2 seconds, affects visual intensity
}

export default function ThrowSpearProjectile({ 
  projectile,
  position, 
  direction, 
  isReturning,
  chargeTime 
}: ThrowSpearProjectileProps) {
  const groupRef = useRef<Group>(null);
  const lightAnchorRef = useRef<Group>(null);
  const TRAIL_COUNT = 16;
  const lastAppliedOpacity = useRef(-1);

  const bindOpacityFactor = (factor: number) => (mat: { userData: { opacityFactor?: number }; transparent?: boolean; opacity?: number } | null) => {
    if (!mat) return;
    mat.userData.opacityFactor = factor;
    mat.transparent = true;
    mat.opacity = projectile.opacity * factor;
  };

  // Calculate visual intensity based on charge time (0-1)
  const chargeIntensity = Math.min(chargeTime / 2, 1);

  // Pooled point light at the spear's energy core (replaces the nested <pointLight>).
  // Cyan when returning, greyish silver going out — matches the original lightningColor.
  const lightColor = isReturning ? 0x00ffff : 0xc0c0c0;
  const lightColorObj = useMemo(() => new Color(lightColor), [lightColor]);
  const spearLight = useDynamicLight({ color: lightColorObj, distance: 0.5, decay: 2, priority: 2 });

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(position);

    const opacity = projectile.opacity;
    if (opacity !== lastAppliedOpacity.current) {
      lastAppliedOpacity.current = opacity;
      groupRef.current.traverse((child) => {
        const mesh = child as {
          isMesh?: boolean;
          material?: { userData?: { opacityFactor?: number }; opacity?: number; transparent?: boolean }
            | Array<{ userData?: { opacityFactor?: number }; opacity?: number; transparent?: boolean }>;
        };
        if (!mesh.isMesh || !mesh.material) return;
        const applyOpacity = (mat: { userData?: { opacityFactor?: number }; opacity?: number; transparent?: boolean }) => {
          const factor = mat.userData?.opacityFactor ?? 1;
          mat.transparent = true;
          mat.opacity = opacity * factor;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(applyOpacity);
        } else {
          applyOpacity(mesh.material);
        }
      });
    }

    // Calculate rotation based on direction (similar to ViperSting)
    _lookDirScratch.copy(direction).normalize();
    const rotationY = Math.atan2(_lookDirScratch.x, _lookDirScratch.z);
    const rotationX = Math.atan2(-_lookDirScratch.y, Math.sqrt(_lookDirScratch.x * _lookDirScratch.x + _lookDirScratch.z * _lookDirScratch.z));

    groupRef.current.rotation.set(rotationX, rotationY, 0);

    if (lightAnchorRef.current) {
      lightAnchorRef.current.getWorldPosition(_spearLightWorld);
      spearLight.current?.setPosition(_spearLightWorld.x, _spearLightWorld.y, _spearLightWorld.z);
      spearLight.current?.setColor(lightColor);
      spearLight.current?.setIntensity(chargeIntensity * 2 + 2);
    }
  });

  // Create spear blade shape
  const createBladeShape = () => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    
    shape.lineTo(0.15, -0.230);
    shape.bezierCurveTo(
      0.8, 0.22,
      1.13, 0.5,
      1.8, 1.6
    );
    
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(
      0.5, 0.2,
      0.225, 0.0,
      0.1, 0.7
    );
    shape.lineTo(0, 0);
    return shape;
  };

  const createInnerBladeShape = () => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    
    shape.lineTo(0, 0.06);   
    shape.lineTo(0.15, 0.15); 
    shape.quadraticCurveTo(1.2, 0.12, 1.5, 0.15); 
    shape.quadraticCurveTo(2.0, 0.08, 2.15, 0);    
    shape.quadraticCurveTo(2.0, -0.08, 1.5, -0.15); 
    shape.quadraticCurveTo(1.2, -0.12, 0.15, -0.15);
    shape.lineTo(0, -0.05);  
    shape.lineTo(0, 0);
    
    return shape;
  };

  const bladeExtrudeSettings = {
    steps: 2,
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.02,
    bevelOffset: 0.04,
    bevelSegments: 2
  };

  const innerBladeExtrudeSettings = {
    ...bladeExtrudeSettings,
    depth: 0.06,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 6
  };

  // Colors get more intense with higher charge
  const baseEmissiveIntensity = 1.5 + (chargeIntensity * 2); // 1.5 to 3.5
  const coreEmissiveIntensity = 2 + (chargeIntensity * 3); // 2 to 5
  const lightningColor = isReturning ? 0x00FFFF : 0xC0C0C0; // Cyan when returning, greyish silver when going out
  const spearColor = isReturning ? 0x0088FF : 0xC0C0C0; // Blue tint when returning, greyish silver when going out

  // Memoize blade shapes (constant regardless of props) and per-color Color objects.
  const bladeShape = useMemo(() => createBladeShape(), []);
  const innerBladeShape = useMemo(() => createInnerBladeShape(), []);
  const cSpear = useMemo(() => new Color(spearColor), [spearColor]);
  const cLightning = useMemo(() => new Color(lightningColor), [lightningColor]);

  return (
    <group ref={groupRef}>
      {/* Main spear container with proper scaling and positioning to match original */}
      <group 
        position={[0, 0.5, 0.6]}
        rotation={[-0, 0, 0]}
        scale={[0.825, 0.75, 0.75]}
      >
        <group 
          position={[-1.18, 0, -0]}
          rotation={[Math.PI/2, 0, 0]}
          scale={[0.8, 0.8, 0.7]}
        >
          {/* Spear shaft */}
          <group position={[-0.025, -0.55, 0.35]} rotation={[0, 0, -Math.PI]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.04, 2.2, 12]} />
              <meshStandardMaterial 
                color="#2a3b4c" 
                roughness={0.7}
                transparent
                opacity={1}
              />
            </mesh>
            
            {/* Spear rings along shaft */}
            {[...Array(12)].map((_, i) => (
              <mesh key={i} position={[0, 1.0 - i * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.045, 0.016, 8, 16]} />
                <meshStandardMaterial 
                  color="#1a2b3c" 
                  metalness={0.6} 
                  roughness={0.4}
                  transparent
                  opacity={1}
                  ref={bindOpacityFactor(1)}
                />
              </mesh>
            ))}
          </group>
          
          {/* Spear guard/crossguard */}
          <group ref={lightAnchorRef} position={[-0.025, .45, 0.35]} rotation={[Math.PI, 1.5, Math.PI]}>
            <mesh>
              <torusGeometry args={[0.26, 0.07, 16, 32]} />
              <meshStandardMaterial 
                color="#4a5b6c" 
                metalness={0.9}
                roughness={0.1}
                transparent
                opacity={1}
                ref={bindOpacityFactor(1)}
              />
            </mesh>
            
            {/* Spikes on guard */}
            {[...Array(8)].map((_, i) => (
              <mesh 
                key={`spike-${i}`} 
                position={[
                  0.25 * Math.cos(i * Math.PI / 4),
                  0.25 * Math.sin(i * Math.PI / 4),
                  0
                ]}
                rotation={[0, 0, i * Math.PI / 4 - Math.PI / 2]}
              >
                <coneGeometry args={[0.070, 0.55, 3]} />
                <meshStandardMaterial 
                  color="#4a5b6c"
                  metalness={0.9}
                  roughness={0.1}
                  transparent
                  opacity={1}
                  ref={bindOpacityFactor(1)}
                />
              </mesh>
            ))}
            
            {/* Energy core - gets brighter with charge */}
            <mesh>
              <sphereGeometry args={[0.155, 16, 16]} />
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity}
                transparent
                opacity={1}
                ref={bindOpacityFactor(1)}
              />
            </mesh>
            
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={coreEmissiveIntensity}
                transparent
                opacity={1}
                ref={bindOpacityFactor(0.8)}
              />
            </mesh>
            
            <mesh>
              <sphereGeometry args={[0.145, 16, 16]} />
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity + 1}
                transparent
                opacity={1}
                ref={bindOpacityFactor(0.6)}
              />
            </mesh>
            
            <mesh>
              <sphereGeometry args={[.175, 16, 16]} />
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity}
                transparent
                opacity={1}
                ref={bindOpacityFactor(0.4)}
              />
            </mesh>

          </group>
          
          {/* Spear blades - three-pronged design */}
          <group position={[0, 0.75, 0.35]}>
            {/* Main blade */}
            <group rotation={[0, 0, 0]}>
              <group rotation={[0, 0, 0.7]} scale={[0.4, 0.4, -0.4]}>
                <mesh>
                  <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
                  <meshStandardMaterial 
                    color={cSpear}
                    emissive={cSpear}
                    emissiveIntensity={baseEmissiveIntensity}
                    metalness={0.8}
                    roughness={0.1}
                    opacity={1}
                    transparent
                    side={DoubleSide}
                    ref={bindOpacityFactor(0.8)}
                  />
                </mesh>
              </group>
            </group>

            {/* Side blades */}
            <group rotation={[0, (2 * Math.PI) / 3, Math.PI/2]}>
              <group rotation={[0, 0., 5.33]} scale={[0.4, 0.4, -0.4]}>
                <mesh>
                  <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
                  <meshStandardMaterial 
                    color={cSpear}
                    emissive={cSpear}
                    emissiveIntensity={baseEmissiveIntensity}
                    metalness={0.8}
                    roughness={0.1}
                    opacity={1}
                    transparent
                    side={DoubleSide}
                    ref={bindOpacityFactor(0.8)}
                  />
                </mesh>
              </group>
            </group>

            <group rotation={[0, (4 * Math.PI) / 3, Math.PI/2]}>
              <group rotation={[0, 0, 5.33]} scale={[0.4, 0.4, -0.4]}>
                <mesh>
                  <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
                  <meshStandardMaterial 
                    color={cSpear}
                    emissive={cSpear}
                    emissiveIntensity={baseEmissiveIntensity}
                    metalness={0.8}
                    roughness={0.1}
                    opacity={1}
                    transparent
                    side={DoubleSide}
                    ref={bindOpacityFactor(0.8)}
                  />
                </mesh>
              </group>
            </group>
          </group>

          {/* Inner blade component */}
          <group position={[0, 0.65, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]} scale={[0.8, 0.8, 0.5]}>
            <mesh>
              <extrudeGeometry args={[innerBladeShape, bladeExtrudeSettings]} />
              <meshStandardMaterial 
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity}
                metalness={0.3}
                roughness={0.1}
                transparent
                opacity={1}
                ref={bindOpacityFactor(1)}
              />
            </mesh>
            
            <mesh>
              <extrudeGeometry args={[innerBladeShape, innerBladeExtrudeSettings]} />
              <meshStandardMaterial 
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity * 0.7}
                metalness={0.2}
                roughness={0.1}
                opacity={1}
                transparent
                ref={bindOpacityFactor(0.8)}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Lightning trail effects - more intense with higher charge */}
      {[...Array(TRAIL_COUNT)].map((_, index) => {
        const trailScale = 1.15 - (index / TRAIL_COUNT) * 0.5;
        const trailOpacityFactor = (1 - index / TRAIL_COUNT) * 0.6 * 0.5;
        
        // Calculate trail offset in world space (behind the spear along its trajectory)
        // Use the direction vector to position trails behind the spear
        const trailOffset: [number, number, number] = [-1, 0, -(index + 1) * 0.8 + 1]; // Behind the spear along Z axis
                
        return (
          <group
            key={`trail-${index}`}
            position={trailOffset} // Position behind the spear along its movement direction
          >

            
            {/* Outer energy glow */}
            <mesh scale={[trailScale * 1.5, trailScale * 1.5, trailScale * 1.5]}>
              <sphereGeometry args={[0.2, 6, 6]} />
              <meshStandardMaterial
                color={cLightning}
                emissive={cLightning}
                emissiveIntensity={chargeIntensity * 2 + 1}
                transparent
                opacity={1}
                blending={AdditiveBlending}
                depthWrite={false}
                ref={bindOpacityFactor(trailOpacityFactor)}
              />
            </mesh>
          </group>
        );
      })}
      
    </group>
  );
}

