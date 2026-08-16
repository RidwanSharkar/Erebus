import React, { useRef, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Position3 } from '@/utils/position3';
import type { Player } from '@/contexts/MultiplayerContext';
import { Vector3, Color, Mesh, PlaneGeometry, MeshBasicMaterial, Group } from '@/utils/three-exports';

interface PlayerHealthBarProps {
  playerId: string;
  playerName: string;
  position: Position3;
  health: number;
  maxHealth: number;
  shield?: number;
  maxShield?: number;
  camera: any;
  showDistance?: number;
  playersRef?: MutableRefObject<Map<string, Player>>;
}

export default function PlayerHealthBar({
  playerId,
  position,
  health,
  maxHealth,
  shield = 0,
  maxShield = 25,
  camera,
  showDistance = 35,
  playersRef,
}: PlayerHealthBarProps) {
  const groupRef = useRef<Group>(null);
  const meshRefs = useRef<{
    healthBar: Mesh | null;
    shieldBar: Mesh | null;
    background: Mesh | null;
    shieldBackground: Mesh | null;
  }>({
    healthBar: null,
    shieldBar: null,
    background: null,
    shieldBackground: null
  });
  const [visible, setVisible] = useState(false);

  // Health bar dimensions
  const barWidth = 2.0;
  const barHeight = 0.15;
  const barOffset = new Vector3(0, 3.0, 0); // Position above player
  const shieldOffset = 0.2; // Distance between health and shield bars
  const worldPositionScratch = useRef(new Vector3());

  // Create geometries and materials
  useEffect(() => {
    if (!groupRef.current) return;

    // Background for health bar
    const backgroundGeometry = new PlaneGeometry(barWidth, barHeight);
    const backgroundMaterial = new MeshBasicMaterial({ 
      color: new Color(0x333333),
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.position.set(0, 0, 0.001);
    if (meshRefs.current.background) {
      groupRef.current.remove(meshRefs.current.background);
    }
    meshRefs.current.background = backgroundMesh;
    groupRef.current.add(backgroundMesh);

    // Health bar
    const healthGeometry = new PlaneGeometry(barWidth, barHeight);
    const healthMaterial = new MeshBasicMaterial({ 
      color: new Color(0x00ff00),
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const healthMesh = new Mesh(healthGeometry, healthMaterial);
    healthMesh.position.set(0, 0, 0.002);
    if (meshRefs.current.healthBar) {
      groupRef.current.remove(meshRefs.current.healthBar);
    }
    meshRefs.current.healthBar = healthMesh;
    groupRef.current.add(healthMesh);

    // Shield background
    const shieldBackgroundGeometry = new PlaneGeometry(barWidth, barHeight * 0.7);
    const shieldBackgroundMaterial = new MeshBasicMaterial({ 
      color: new Color(0x1a2332),
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const shieldBackgroundMesh = new Mesh(shieldBackgroundGeometry, shieldBackgroundMaterial);
    shieldBackgroundMesh.position.set(0, shieldOffset, 0.001);
    if (meshRefs.current.shieldBackground) {
      groupRef.current.remove(meshRefs.current.shieldBackground);
    }
    meshRefs.current.shieldBackground = shieldBackgroundMesh;
    groupRef.current.add(shieldBackgroundMesh);

    // Shield bar
    const shieldGeometry = new PlaneGeometry(barWidth, barHeight * 0.7);
    const shieldMaterial = new MeshBasicMaterial({ 
      color: new Color(0x4A90E2),
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const shieldMesh = new Mesh(shieldGeometry, shieldMaterial);
    shieldMesh.position.set(0, shieldOffset, 0.002);
    if (meshRefs.current.shieldBar) {
      groupRef.current.remove(meshRefs.current.shieldBar);
    }
    meshRefs.current.shieldBar = shieldMesh;
    groupRef.current.add(shieldMesh);

    return () => {
      // Cleanup geometries and materials
      backgroundGeometry.dispose();
      backgroundMaterial.dispose();
      healthGeometry.dispose();
      healthMaterial.dispose();
      shieldBackgroundGeometry.dispose();
      shieldBackgroundMaterial.dispose();
      shieldGeometry.dispose();
      shieldMaterial.dispose();
    };
  }, []);

  useFrame(() => {
    if (!groupRef.current || !camera) return;

    // Calculate distance to camera
    const worldPosition = worldPositionScratch.current.set(
      position.x + barOffset.x,
      position.y + barOffset.y,
      position.z + barOffset.z,
    );
    const distance = camera.position.distanceTo(worldPosition);

    const live = playersRef?.current.get(playerId);
    const liveHealth = live?.health ?? health;
    const liveMaxHealth = live?.maxHealth ?? maxHealth;
    const liveShield = live?.shield ?? shield;
    const liveMaxShield = live?.maxShield ?? maxShield;

    // Always show nearby allies so full HP/shield is visible at spawn
    const shouldShow = distance <= showDistance;
    
    if (shouldShow !== visible) {
      setVisible(shouldShow);
    }

    if (!shouldShow) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    // Position the health bar above the player
    groupRef.current.position.copy(worldPosition);

    // Make health bar face the camera
    groupRef.current.lookAt(camera.position);

    // Update health bar scale and color
    if (meshRefs.current.healthBar) {
      const healthPercentage = Math.max(0, Math.min(1, liveHealth / liveMaxHealth));
      meshRefs.current.healthBar.scale.x = healthPercentage;
      
      // Position health bar to align left when scaling
      meshRefs.current.healthBar.position.x = -(barWidth * (1 - healthPercentage)) / 2;

      // Color based on health percentage
      const material = meshRefs.current.healthBar.material as MeshBasicMaterial;
      if (healthPercentage > 0.6) {
        material.color.setHex(0x00ff00); // Green
      } else if (healthPercentage > 0.3) {
        material.color.setHex(0xffff00); // Yellow
      } else {
        material.color.setHex(0xff0000); // Red
      }
    }

    // Update shield bar scale
    if (meshRefs.current.shieldBar && liveMaxShield > 0) {
      const shieldPercentage = Math.max(0, Math.min(1, liveShield / liveMaxShield));
      meshRefs.current.shieldBar.scale.x = shieldPercentage;
      
      // Position shield bar to align left when scaling
      meshRefs.current.shieldBar.position.x = -(barWidth * (1 - shieldPercentage)) / 2;
    }

    // Fade based on distance
    const fadeDistance = showDistance * 0.8;
    const alpha = distance > fadeDistance ? 
      Math.max(0.3, 1 - (distance - fadeDistance) / (showDistance - fadeDistance)) : 1;

    // Apply alpha to all materials
    [
      meshRefs.current.background,
      meshRefs.current.healthBar,
      meshRefs.current.shieldBackground,
      meshRefs.current.shieldBar
    ].forEach(mesh => {
      if (mesh) {
        const material = mesh.material as MeshBasicMaterial;
        material.opacity = material.userData.baseOpacity * alpha;
      }
    });
  });

  // Store base opacities
  useEffect(() => {
    [
      { mesh: meshRefs.current.background, opacity: 0.8 },
      { mesh: meshRefs.current.healthBar, opacity: 0.9 },
      { mesh: meshRefs.current.shieldBackground, opacity: 0.8 },
      { mesh: meshRefs.current.shieldBar, opacity: 0.9 }
    ].forEach(({ mesh, opacity }) => {
      if (mesh) {
        const material = mesh.material as MeshBasicMaterial;
        material.userData.baseOpacity = opacity;
      }
    });
  }, []);

  return <group ref={groupRef} />;
}
