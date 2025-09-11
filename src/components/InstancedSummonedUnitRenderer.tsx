'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  Color,
  CylinderGeometry,
  SphereGeometry,
  BoxGeometry,
  PlaneGeometry,
  OctahedronGeometry,
  TorusGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  AdditiveBlending
} from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';

// Shared geometries - created once and reused (tower-like miniature versions)
const sharedGeometries = {
  body: new CylinderGeometry(0.3, 0.36, 0.72, 6), // Keep cylinder for base stability
  head: new OctahedronGeometry(0.24, 0), // Crystal-like head
  arm: new CylinderGeometry(0.06, 0.06, 0.48, 4),
  leg: new CylinderGeometry(0.075, 0.075, 0.24, 4),
  weapon: new BoxGeometry(0.09, 0.36, 0.03),
  healthBarBg: new PlaneGeometry(1.5, 0.15),
  healthBarFill: new PlaneGeometry(1.5, 0.12),
  deathEffect: new SphereGeometry(1, 6, 4),
  targetIndicator: new CylinderGeometry(0.45, 0.45, 0.05, 8),
  // New tower-like geometries
  shoulder: new SphereGeometry(0.15, 8, 8), // Mini shoulder spheres
  shoulderRing: new TorusGeometry(0.18, 0.02, 6, 12), // Mini shoulder rings
  energyTendril: new ConeGeometry(0.04, 0.15, 4), // Mini energy tendrils
  energyAura: new SphereGeometry(0.6, 8, 8) // Mini energy aura
};

// Shared materials - created once and reused (tower-like crystal materials)
const sharedMaterials = {
  body: new MeshStandardMaterial({
    metalness: 0.2,
    roughness: 0.8,
    transparent: true,
    vertexColors: true
  }),
  head: new MeshStandardMaterial({
    metalness: 0.8, // Crystal-like metalness
    roughness: 0.2, // Crystal-like roughness
    transparent: true,
    vertexColors: true
  }),
  arm: new MeshStandardMaterial({
    metalness: 0.6, // Higher metalness for energy arms
    roughness: 0.4,
    transparent: true,
    vertexColors: true
  }),
  leg: new MeshStandardMaterial({
    metalness: 0.1,
    roughness: 1.0,
    transparent: true,
    vertexColors: true
  }),
  weapon: new MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.2,
    transparent: true
  }),
  healthBarBg: new MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.8
  }),
  healthBarFill: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    vertexColors: true
  }),
  deathEffect: new MeshBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.1,
    wireframe: true
  }),
  targetIndicator: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.2,
    vertexColors: true
  }),
  // New tower-like materials
  shoulder: new MeshStandardMaterial({
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    vertexColors: true
  }),
  shoulderRing: new MeshStandardMaterial({
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    vertexColors: true
  }),
  energyTendril: new MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    vertexColors: true
  }),
  energyAura: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.4,
    vertexColors: true,
    depthWrite: false,
    blending: AdditiveBlending
  })
};

interface UnitInstanceData {
  entityId: number;
  position: Vector3;
  color: Color;
  health: number;
  maxHealth: number;
  isDead: boolean;
  ownerId: string;
  lastUpdateTime: number;
}

interface InstancedSummonedUnitRendererProps {
  world: World;
  maxUnits?: number;
}

export default function InstancedSummonedUnitRenderer({
  world,
  maxUnits = 100
}: InstancedSummonedUnitRendererProps) {
  // Refs for instanced meshes
  const bodyMeshRef = useRef<InstancedMesh>(null);
  const headMeshRef = useRef<InstancedMesh>(null);
  const leftArmMeshRef = useRef<InstancedMesh>(null);
  const rightArmMeshRef = useRef<InstancedMesh>(null);
  const leftLegMeshRef = useRef<InstancedMesh>(null);
  const rightLegMeshRef = useRef<InstancedMesh>(null);
  const weaponMeshRef = useRef<InstancedMesh>(null);
  const healthBarBgMeshRef = useRef<InstancedMesh>(null);
  const healthBarFillMeshRef = useRef<InstancedMesh>(null);
  const deathEffectMeshRef = useRef<InstancedMesh>(null);
  const targetIndicatorMeshRef = useRef<InstancedMesh>(null);
  // New tower-like refs
  const leftShoulderMeshRef = useRef<InstancedMesh>(null);
  const rightShoulderMeshRef = useRef<InstancedMesh>(null);
  const leftShoulderRingMeshRef = useRef<InstancedMesh>(null);
  const rightShoulderRingMeshRef = useRef<InstancedMesh>(null);
  const energyTendrilsMeshRef = useRef<InstancedMesh>(null);
  const energyAuraMeshRef = useRef<InstancedMesh>(null);

  // Unit instance data
  const unitInstances = useRef<Map<number, UnitInstanceData>>(new Map());
  const tempObject = useRef(new Object3D());
  const tempMatrix = useRef(new Matrix4());
  const tempColor = useRef(new Color());

  // Player color cache
  const playerColors = useMemo(() => [
    new Color(0x4A90E2), // Blue
    new Color(0xFF6B35), // Orange
    new Color(0x50C878), // Green
    new Color(0x9B59B6), // Purple
    new Color(0xF39C12)  // Yellow
  ], []);

  // Generate consistent color based on ownerId
  const getPlayerColor = useMemo(() => (ownerId: string): Color => {
    let hash = 0;
    for (let i = 0; i < ownerId.length; i++) {
      hash = ((hash << 5) - hash) + ownerId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % playerColors.length;
    return playerColors[index];
  }, [playerColors]);

  // Update unit instances from world state
  const updateUnitInstances = useMemo(() => {
    return () => {
      const entities = world.queryEntities([Transform, SummonedUnit, Health]);
      const newInstances = new Map<number, UnitInstanceData>();

      for (const entity of entities) {
        const transform = entity.getComponent(Transform);
        const unit = entity.getComponent(SummonedUnit);
        const health = entity.getComponent(Health);

        if (!transform || !unit || !health) continue;

        // Skip units that are inactive or marked for destruction
        if (!unit.isActive && (unit.isDead || health.isDead)) continue;

        const unitData: UnitInstanceData = {
          entityId: entity.id,
          position: transform.position.clone(),
          color: getPlayerColor(unit.ownerId),
          health: health.currentHealth,
          maxHealth: health.maxHealth,
          isDead: health.isDead || unit.isDead,
          ownerId: unit.ownerId,
          lastUpdateTime: Date.now() / 1000
        };

        newInstances.set(entity.id, unitData);
      }

      unitInstances.current = newInstances;
      return newInstances.size;
    };
  }, [world, getPlayerColor]);

  // Calculate damage color and opacity
  const getUnitAppearance = (unit: UnitInstanceData) => {
    const healthPercentage = Math.max(0, unit.health / unit.maxHealth);
    const opacity = unit.isDead ? 0.3 : Math.max(0.5, healthPercentage);
    const damageColor = unit.isDead
      ? new Color(0x666666)
      : unit.color.clone().lerp(new Color(0xFF0000), 1 - healthPercentage);

    return { damageColor, opacity, healthPercentage };
  };

  // Update instanced meshes
  const updateInstancedMeshes = () => {
    const instances = Array.from(unitInstances.current.values());
    const count = Math.min(instances.length, maxUnits);

    if (count === 0) return;

    let bodyCount = 0;
    let headCount = 0;
    let armCount = 0;
    let legCount = 0;
    let weaponCount = 0;
    let healthBarBgCount = 0;
    let healthBarFillCount = 0;
    let deathEffectCount = 0;
    let targetIndicatorCount = 0;
    // New tower-like counters
    let shoulderCount = 0;
    let shoulderRingCount = 0;
    let energyTendrilsCount = 0;
    let energyAuraCount = 0;

    for (let i = 0; i < count; i++) {
      const unit = instances[i];
      const { damageColor, opacity, healthPercentage } = getUnitAppearance(unit);

      tempObject.current.position.copy(unit.position);

      // Body
      if (bodyMeshRef.current) {
        tempObject.current.position.y += 0.72; // unitHeight * 0.4
        tempObject.current.updateMatrix();
        bodyMeshRef.current.setMatrixAt(bodyCount, tempObject.current.matrix);
        bodyMeshRef.current.setColorAt(bodyCount, damageColor);
        bodyCount++;
      }

      // Head (crystal-like octahedron)
      if (headMeshRef.current) {
        tempObject.current.position.y += 0.36; // unitHeight * 0.8 relative to body
        tempObject.current.updateMatrix();
        headMeshRef.current.setMatrixAt(headCount, tempObject.current.matrix);
        headMeshRef.current.setColorAt(headCount, damageColor.clone().multiplyScalar(1.2));
        headCount++;
      }

      // Arms (left and right)
      if (leftArmMeshRef.current && rightArmMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x - 0.36, // -side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.6
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, -0.3); // -side * 0.3
        tempObject.current.updateMatrix();
        leftArmMeshRef.current.setMatrixAt(armCount, tempObject.current.matrix);
        leftArmMeshRef.current.setColorAt(armCount, damageColor.clone().multiplyScalar(0.9));

        tempObject.current.position.set(
          unit.position.x + 0.36, // +side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.6
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0.3); // +side * 0.3
        tempObject.current.updateMatrix();
        rightArmMeshRef.current.setMatrixAt(armCount, tempObject.current.matrix);
        rightArmMeshRef.current.setColorAt(armCount, damageColor.clone().multiplyScalar(0.9));
        armCount++;
      }

      // Shoulders (tower-like)
      if (leftShoulderMeshRef.current && rightShoulderMeshRef.current) {
        // Left shoulder
        tempObject.current.position.set(
          unit.position.x - 0.3, // -side * unitBaseRadius
          unit.position.y + 0.9, // unitHeight * 0.5
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0);
        tempObject.current.updateMatrix();
        leftShoulderMeshRef.current.setMatrixAt(shoulderCount, tempObject.current.matrix);
        leftShoulderMeshRef.current.setColorAt(shoulderCount, damageColor.clone().multiplyScalar(1.1));

        // Right shoulder
        tempObject.current.position.set(
          unit.position.x + 0.3, // +side * unitBaseRadius
          unit.position.y + 0.9, // unitHeight * 0.5
          unit.position.z
        );
        tempObject.current.updateMatrix();
        rightShoulderMeshRef.current.setMatrixAt(shoulderCount, tempObject.current.matrix);
        rightShoulderMeshRef.current.setColorAt(shoulderCount, damageColor.clone().multiplyScalar(1.1));
        shoulderCount++;
      }

      // Shoulder Rings (tower-like)
      if (leftShoulderRingMeshRef.current && rightShoulderRingMeshRef.current) {
        // Left shoulder ring
        tempObject.current.position.set(
          unit.position.x - 0.3, // -side * unitBaseRadius
          unit.position.y + 0.9, // unitHeight * 0.5
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, -Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        leftShoulderRingMeshRef.current.setMatrixAt(shoulderRingCount, tempObject.current.matrix);
        leftShoulderRingMeshRef.current.setColorAt(shoulderRingCount, damageColor.clone().multiplyScalar(1.3));

        // Right shoulder ring
        tempObject.current.position.set(
          unit.position.x + 0.3, // +side * unitBaseRadius
          unit.position.y + 0.9, // unitHeight * 0.5
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        rightShoulderRingMeshRef.current.setMatrixAt(shoulderRingCount, tempObject.current.matrix);
        rightShoulderRingMeshRef.current.setColorAt(shoulderRingCount, damageColor.clone().multiplyScalar(1.3));
        shoulderRingCount++;
      }

      // Energy Aura (tower-like)
      if (energyAuraMeshRef.current) {
        tempObject.current.position.copy(unit.position);
        tempObject.current.position.y += 0.36; // unitHeight * 0.4
        tempObject.current.rotation.set(0, 0, 0);
        tempObject.current.updateMatrix();
        energyAuraMeshRef.current.setMatrixAt(energyAuraCount, tempObject.current.matrix);
        energyAuraMeshRef.current.setColorAt(energyAuraCount, damageColor);
        energyAuraCount++;
      }

      // Legs (left and right)
      if (leftLegMeshRef.current && rightLegMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x - 0.18, // -side * unitBaseRadius * 0.6
          unit.position.y + 0.24, // unitHeight * 0.1
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0);
        tempObject.current.updateMatrix();
        leftLegMeshRef.current.setMatrixAt(legCount, tempObject.current.matrix);
        leftLegMeshRef.current.setColorAt(legCount, damageColor.clone().multiplyScalar(0.8));

        tempObject.current.position.set(
          unit.position.x + 0.18, // +side * unitBaseRadius * 0.6
          unit.position.y + 0.24, // unitHeight * 0.1
          unit.position.z
        );
        tempObject.current.updateMatrix();
        rightLegMeshRef.current.setMatrixAt(legCount, tempObject.current.matrix);
        rightLegMeshRef.current.setColorAt(legCount, damageColor.clone().multiplyScalar(0.8));
        legCount++;
      }

      // Weapon
      if (weaponMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x + 0.45, // unitBaseRadius * 1.5
          unit.position.y + 1.08, // unitHeight * 0.6
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0.2);
        tempObject.current.updateMatrix();
        weaponMeshRef.current.setMatrixAt(weaponCount, tempObject.current.matrix);
        weaponCount++;
      }

      // Energy Tendrils (tower-like orbiting spikes)
      if (energyTendrilsMeshRef.current) {
        const tendrilCount = 6; // Fewer tendrils for mini version
        for (let t = 0; t < tendrilCount; t++) {
          const angle = (t / tendrilCount) * Math.PI * 2;
          const radius = 0.25;
          const height = 1.0;

          tempObject.current.position.set(
            unit.position.x + Math.cos(angle) * radius,
            unit.position.y + height + Math.sin(angle) * radius * 0.5,
            unit.position.z + Math.sin(angle) * radius
          );
          tempObject.current.rotation.set(
            Math.PI / 2,
            angle + Math.PI,
            -Math.PI / 2
          );
          tempObject.current.updateMatrix();
          energyTendrilsMeshRef.current.setMatrixAt(energyTendrilsCount, tempObject.current.matrix);
          energyTendrilsMeshRef.current.setColorAt(energyTendrilsCount, damageColor.clone().multiplyScalar(1.2));
          energyTendrilsCount++;
        }
      }

      // Health Bar (only if not dead)
      if (!unit.isDead && healthBarBgMeshRef.current && healthBarFillMeshRef.current) {
        // Background
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 1.88, // unitHeight + 0.8
          unit.position.z
        );
        tempObject.current.rotation.set(-Math.PI, 0, 0);
        tempObject.current.updateMatrix();
        healthBarBgMeshRef.current.setMatrixAt(healthBarBgCount, tempObject.current.matrix);

        // Fill
        tempObject.current.position.x -= (1.5 * (1 - healthPercentage)) / 2;
        tempObject.current.scale.set(healthPercentage, 1, 1);
        tempObject.current.updateMatrix();
        healthBarFillMeshRef.current.setMatrixAt(healthBarFillCount, tempObject.current.matrix);

        // Health bar color based on percentage
        if (healthPercentage > 0.5) {
          healthBarFillMeshRef.current.setColorAt(healthBarFillCount, new Color(0x00ff00));
        } else if (healthPercentage > 0.25) {
          healthBarFillMeshRef.current.setColorAt(healthBarFillCount, new Color(0xffff00));
        } else {
          healthBarFillMeshRef.current.setColorAt(healthBarFillCount, new Color(0xff0000));
        }

        healthBarBgCount++;
        healthBarFillCount++;
      }

      // Death Effect (only if dead)
      if (unit.isDead && deathEffectMeshRef.current) {
        tempObject.current.position.copy(unit.position);
        tempObject.current.position.y += 0.72; // unitHeight * 0.4
        tempObject.current.updateMatrix();
        deathEffectMeshRef.current.setMatrixAt(deathEffectCount, tempObject.current.matrix);
        deathEffectCount++;
      }

      // Target Indicator (always visible)
      if (targetIndicatorMeshRef.current) {
        tempObject.current.position.copy(unit.position);
        tempObject.current.position.y += 0.72; // unitHeight * 0.4
        tempObject.current.updateMatrix();
        targetIndicatorMeshRef.current.setMatrixAt(targetIndicatorCount, tempObject.current.matrix);
        targetIndicatorMeshRef.current.setColorAt(targetIndicatorCount, unit.color);
        targetIndicatorCount++;
      }
    }

    // Update instance counts
    if (bodyMeshRef.current) bodyMeshRef.current.count = bodyCount;
    if (headMeshRef.current) headMeshRef.current.count = headCount;
    if (leftArmMeshRef.current) leftArmMeshRef.current.count = armCount;
    if (rightArmMeshRef.current) rightArmMeshRef.current.count = armCount;
    if (leftLegMeshRef.current) leftLegMeshRef.current.count = legCount;
    if (rightLegMeshRef.current) rightLegMeshRef.current.count = legCount;
    if (weaponMeshRef.current) weaponMeshRef.current.count = weaponCount;
    if (healthBarBgMeshRef.current) healthBarBgMeshRef.current.count = healthBarBgCount;
    if (healthBarFillMeshRef.current) healthBarFillMeshRef.current.count = healthBarFillCount;
    if (deathEffectMeshRef.current) deathEffectMeshRef.current.count = deathEffectCount;
    if (targetIndicatorMeshRef.current) targetIndicatorMeshRef.current.count = targetIndicatorCount;
    // New tower-like instance counts
    if (leftShoulderMeshRef.current) leftShoulderMeshRef.current.count = shoulderCount;
    if (rightShoulderMeshRef.current) rightShoulderMeshRef.current.count = shoulderCount;
    if (leftShoulderRingMeshRef.current) leftShoulderRingMeshRef.current.count = shoulderRingCount;
    if (rightShoulderRingMeshRef.current) rightShoulderRingMeshRef.current.count = shoulderRingCount;
    if (energyTendrilsMeshRef.current) energyTendrilsMeshRef.current.count = energyTendrilsCount;
    if (energyAuraMeshRef.current) energyAuraMeshRef.current.count = energyAuraCount;

    // Mark instances as needing update
    if (bodyMeshRef.current) bodyMeshRef.current.instanceMatrix.needsUpdate = true;
    if (bodyMeshRef.current?.instanceColor) bodyMeshRef.current.instanceColor.needsUpdate = true;
    if (headMeshRef.current) headMeshRef.current.instanceMatrix.needsUpdate = true;
    if (headMeshRef.current?.instanceColor) headMeshRef.current.instanceColor.needsUpdate = true;
    if (leftArmMeshRef.current) leftArmMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftArmMeshRef.current?.instanceColor) leftArmMeshRef.current.instanceColor.needsUpdate = true;
    if (rightArmMeshRef.current) rightArmMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightArmMeshRef.current?.instanceColor) rightArmMeshRef.current.instanceColor.needsUpdate = true;
    if (leftLegMeshRef.current) leftLegMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftLegMeshRef.current?.instanceColor) leftLegMeshRef.current.instanceColor.needsUpdate = true;
    if (rightLegMeshRef.current) rightLegMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightLegMeshRef.current?.instanceColor) rightLegMeshRef.current.instanceColor.needsUpdate = true;
    if (weaponMeshRef.current) weaponMeshRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarBgMeshRef.current) healthBarBgMeshRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarFillMeshRef.current) healthBarFillMeshRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarFillMeshRef.current?.instanceColor) healthBarFillMeshRef.current.instanceColor.needsUpdate = true;
    if (deathEffectMeshRef.current) deathEffectMeshRef.current.instanceMatrix.needsUpdate = true;
    if (targetIndicatorMeshRef.current) targetIndicatorMeshRef.current.instanceMatrix.needsUpdate = true;
    if (targetIndicatorMeshRef.current?.instanceColor) targetIndicatorMeshRef.current.instanceColor.needsUpdate = true;
    // New tower-like instance updates
    if (leftShoulderMeshRef.current) leftShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftShoulderMeshRef.current?.instanceColor) leftShoulderMeshRef.current.instanceColor.needsUpdate = true;
    if (rightShoulderMeshRef.current) rightShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightShoulderMeshRef.current?.instanceColor) rightShoulderMeshRef.current.instanceColor.needsUpdate = true;
    if (leftShoulderRingMeshRef.current) leftShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftShoulderRingMeshRef.current?.instanceColor) leftShoulderRingMeshRef.current.instanceColor.needsUpdate = true;
    if (rightShoulderRingMeshRef.current) rightShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightShoulderRingMeshRef.current?.instanceColor) rightShoulderRingMeshRef.current.instanceColor.needsUpdate = true;
    if (energyTendrilsMeshRef.current) energyTendrilsMeshRef.current.instanceMatrix.needsUpdate = true;
    if (energyTendrilsMeshRef.current?.instanceColor) energyTendrilsMeshRef.current.instanceColor.needsUpdate = true;
    if (energyAuraMeshRef.current) energyAuraMeshRef.current.instanceMatrix.needsUpdate = true;
    if (energyAuraMeshRef.current?.instanceColor) energyAuraMeshRef.current.instanceColor.needsUpdate = true;
  };

  // Animation and updates
  useFrame((state) => {
    const currentTime = state.clock.elapsedTime;

    // Update unit instances from world state
    updateUnitInstances();

    // Update instanced meshes
    updateInstancedMeshes();

    // Gentle floating animation for alive units (optional - can be removed for more performance)
    const instances = Array.from(unitInstances.current.values());
    for (let i = 0; i < instances.length; i++) {
      const unit = instances[i];
      if (unit.isDead) continue;

      // Only update floating for units that need it (throttled)
      if (i % 3 === Math.floor(currentTime * 10) % 3) { // Update every 3rd unit per frame
        const floatOffset = Math.sin(currentTime * 2 + i) * 0.05;
        // This would require updating the position in the instance data
        // For now, we'll skip this to maintain performance
      }
    }
  });

  // Initialize instanced meshes with proper setup
  useEffect(() => {
    // Materials are already configured with vertexColors: true above
    // This ensures proper instanced rendering
  }, []);

  return (
    <group>
      {/* Body */}
      <instancedMesh
        ref={bodyMeshRef}
        args={[sharedGeometries.body, sharedMaterials.body, maxUnits]}
        castShadow
        receiveShadow
      />

      {/* Head */}
      <instancedMesh
        ref={headMeshRef}
        args={[sharedGeometries.head, sharedMaterials.head, maxUnits]}
        castShadow
      />

      {/* Left Shoulder */}
      <instancedMesh
        ref={leftShoulderMeshRef}
        args={[sharedGeometries.shoulder, sharedMaterials.shoulder, maxUnits]}
        castShadow
      />

      {/* Right Shoulder */}
      <instancedMesh
        ref={rightShoulderMeshRef}
        args={[sharedGeometries.shoulder, sharedMaterials.shoulder, maxUnits]}
        castShadow
      />

      {/* Left Shoulder Ring */}
      <instancedMesh
        ref={leftShoulderRingMeshRef}
        args={[sharedGeometries.shoulderRing, sharedMaterials.shoulderRing, maxUnits]}
      />

      {/* Right Shoulder Ring */}
      <instancedMesh
        ref={rightShoulderRingMeshRef}
        args={[sharedGeometries.shoulderRing, sharedMaterials.shoulderRing, maxUnits]}
      />

      {/* Left Arm */}
      <instancedMesh
        ref={leftArmMeshRef}
        args={[sharedGeometries.arm, sharedMaterials.arm, maxUnits]}
        castShadow
      />

      {/* Right Arm */}
      <instancedMesh
        ref={rightArmMeshRef}
        args={[sharedGeometries.arm, sharedMaterials.arm, maxUnits]}
        castShadow
      />

      {/* Left Leg */}
      <instancedMesh
        ref={leftLegMeshRef}
        args={[sharedGeometries.leg, sharedMaterials.leg, maxUnits]}
        castShadow
      />

      {/* Right Leg */}
      <instancedMesh
        ref={rightLegMeshRef}
        args={[sharedGeometries.leg, sharedMaterials.leg, maxUnits]}
        castShadow
      />

      {/* Weapon */}
      <instancedMesh
        ref={weaponMeshRef}
        args={[sharedGeometries.weapon, sharedMaterials.weapon, maxUnits]}
        castShadow
      />

      {/* Energy Tendrils */}
      <instancedMesh
        ref={energyTendrilsMeshRef}
        args={[sharedGeometries.energyTendril, sharedMaterials.energyTendril, maxUnits * 6]}
        castShadow
      />

      {/* Energy Aura */}
      <instancedMesh
        ref={energyAuraMeshRef}
        args={[sharedGeometries.energyAura, sharedMaterials.energyAura, maxUnits]}
      />

      {/* Health Bar Background */}
      <instancedMesh
        ref={healthBarBgMeshRef}
        args={[sharedGeometries.healthBarBg, sharedMaterials.healthBarBg, maxUnits]}
      />

      {/* Health Bar Fill */}
      <instancedMesh
        ref={healthBarFillMeshRef}
        args={[sharedGeometries.healthBarFill, sharedMaterials.healthBarFill, maxUnits]}
      />

      {/* Death Effect */}
      <instancedMesh
        ref={deathEffectMeshRef}
        args={[sharedGeometries.deathEffect, sharedMaterials.deathEffect, maxUnits]}
      />

      {/* Target Indicator */}
      <instancedMesh
        ref={targetIndicatorMeshRef}
        args={[sharedGeometries.targetIndicator, sharedMaterials.targetIndicator, maxUnits]}
      />
    </group>
  );
}
