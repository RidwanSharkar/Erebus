import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Vector3,
  Shape,
  Color,
  DoubleSide,
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  SphereGeometry,
  TorusGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  attachLinearTrailOpacityFalloff,
  enableInstancedMaterialFalloff,
} from '@/utils/instancedMaterialFalloff';

const THROW_SPEAR_SHAFT_GEO = new CylinderGeometry(0.03, 0.04, 2.2, 12);
const THROW_SPEAR_GRIP_TORUS_GEO = new TorusGeometry(0.045, 0.016, 8, 16);
const THROW_SPEAR_RING_TORUS_GEO = new TorusGeometry(0.26, 0.07, 16, 32);
const THROW_SPEAR_ORB_GEOS = [
  new SphereGeometry(0.155, 16, 16),
  new SphereGeometry(0.1, 16, 16),
  new SphereGeometry(0.145, 16, 16),
  new SphereGeometry(0.175, 16, 16),
] as const;
const THROW_SPEAR_TRAIL_SPHERE_GEO = new SphereGeometry(0.15, 8, 8);
const THROW_SPEAR_TRAIL_GLOW_GEO = new SphereGeometry(0.2, 6, 6);
const THROW_SPEAR_GUARD_SPIKE_GEO = new ConeGeometry(0.070, 0.55, 3);
for (const geo of [
  THROW_SPEAR_SHAFT_GEO,
  THROW_SPEAR_GRIP_TORUS_GEO,
  THROW_SPEAR_RING_TORUS_GEO,
  ...THROW_SPEAR_ORB_GEOS,
  THROW_SPEAR_TRAIL_SPHERE_GEO,
  THROW_SPEAR_TRAIL_GLOW_GEO,
  THROW_SPEAR_GUARD_SPIKE_GEO,
]) {
  geo.userData.shared = true;
}

const TRAIL_COUNT = 16;
const _dummy = new Object3D();

attachLinearTrailOpacityFalloff(THROW_SPEAR_TRAIL_SPHERE_GEO, TRAIL_COUNT);
attachLinearTrailOpacityFalloff(THROW_SPEAR_TRAIL_GLOW_GEO, TRAIL_COUNT);

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
  const trailMeshRef = useRef<InstancedMesh>(null);
  const glowMeshRef = useRef<InstancedMesh>(null);
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

  const lightningColor = isReturning ? 0x00FFFF : 0xC0C0C0;
  const cLightning = useMemo(() => new Color(lightningColor), [lightningColor]);

  const trailMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#c0c0c0',
          emissive: '#c0c0c0',
          emissiveIntensity: 1,
          transparent: true,
          opacity: 0.6,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );
  const glowMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#c0c0c0',
          emissive: '#c0c0c0',
          emissiveIntensity: 1,
          transparent: true,
          opacity: 0.3,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );

  useEffect(() => {
    const writeTrail = (mesh: InstancedMesh | null, scaleMul: number) => {
      if (!mesh) return;
      for (let index = 0; index < TRAIL_COUNT; index++) {
        const trailScale = (1.15 - (index / TRAIL_COUNT) * 0.5) * scaleMul;
        _dummy.position.set(-1, 0, -(index + 1) * 0.8 + 1);
        _dummy.scale.setScalar(trailScale);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(index, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    writeTrail(trailMeshRef.current, 1);
    writeTrail(glowMeshRef.current, 1.5);
  }, []);

  useEffect(() => {
    return () => {
      trailMat.dispose();
      glowMat.dispose();
    };
  }, [trailMat, glowMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(position);

    const opacity = projectile.opacity;
    if (opacity !== lastAppliedOpacity.current) {
      lastAppliedOpacity.current = opacity;
      groupRef.current.traverse((child) => {
        const mesh = child as {
          isMesh?: boolean;
          isInstancedMesh?: boolean;
          material?: { userData?: { opacityFactor?: number }; opacity?: number; transparent?: boolean }
            | Array<{ userData?: { opacityFactor?: number }; opacity?: number; transparent?: boolean }>;
        };
        // Instanced trail mats are driven below (falloff + base opacity).
        if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.material) return;
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

    // Base opacity × per-instance (1 - index/N); glow matches prior *(0.6*0.5).
    trailMat.opacity = opacity * 0.6;
    glowMat.opacity = opacity * 0.3;
    trailMat.color.copy(cLightning);
    trailMat.emissive.copy(cLightning);
    glowMat.color.copy(cLightning);
    glowMat.emissive.copy(cLightning);
    const trailEmissive = chargeIntensity * 2 + 1;
    trailMat.emissiveIntensity = trailEmissive;
    glowMat.emissiveIntensity = trailEmissive;
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
  const spearColor = isReturning ? 0x0088FF : 0xC0C0C0; // Blue tint when returning, greyish silver when going out

  // Memoize blade shapes (constant regardless of props) and per-color Color objects.
  const bladeShape = useMemo(() => createBladeShape(), []);
  const innerBladeShape = useMemo(() => createInnerBladeShape(), []);
  const cSpear = useMemo(() => new Color(spearColor), [spearColor]);

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
            <mesh geometry={THROW_SPEAR_SHAFT_GEO}>
              <meshStandardMaterial 
                color="#2a3b4c" 
                roughness={0.7}
                transparent
                opacity={1}
              />
            </mesh>
            
            {/* Spear rings along shaft */}
            {[...Array(12)].map((_, i) => (
              <mesh key={i} position={[0, 1.0 - i * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={THROW_SPEAR_GRIP_TORUS_GEO}>
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
            <mesh geometry={THROW_SPEAR_RING_TORUS_GEO}>
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
                geometry={THROW_SPEAR_GUARD_SPIKE_GEO}
              >
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
            <mesh geometry={THROW_SPEAR_ORB_GEOS[0]}>
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity}
                transparent
                opacity={1}
                ref={bindOpacityFactor(1)}
              />
            </mesh>
            
            <mesh geometry={THROW_SPEAR_ORB_GEOS[1]}>
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={coreEmissiveIntensity}
                transparent
                opacity={1}
                ref={bindOpacityFactor(0.8)}
              />
            </mesh>
            
            <mesh geometry={THROW_SPEAR_ORB_GEOS[2]}>
              <meshStandardMaterial
                color={cSpear}
                emissive={cSpear}
                emissiveIntensity={baseEmissiveIntensity + 1}
                transparent
                opacity={1}
                ref={bindOpacityFactor(0.6)}
              />
            </mesh>
            
            <mesh geometry={THROW_SPEAR_ORB_GEOS[3]}>
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

      {/* Lightning trail — 2 instanced draw calls instead of 16 meshes */}
      <instancedMesh
        ref={trailMeshRef}
        args={[THROW_SPEAR_TRAIL_SPHERE_GEO, trailMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glowMeshRef}
        args={[THROW_SPEAR_TRAIL_GLOW_GEO, glowMat, TRAIL_COUNT]}
        frustumCulled={false}
      />
      
    </group>
  );
}

