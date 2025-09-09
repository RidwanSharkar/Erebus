import { useRef, useMemo } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import * as THREE from 'three';

interface SmiteProps {
  weaponType: WeaponType;
  position: Vector3;
  onComplete: () => void;
  onHit?: (targetId: string, damage: number) => void;
  onDamageDealt?: (damageDealt: boolean) => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  playerPosition?: Vector3;
}

export default function Smite({
  position,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  playerPosition
}: SmiteProps) {
  const lightningRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const animationDuration = 0.9; // Fixed animation duration (in seconds)
  const delayTimer = useRef(0);
  const startDelay = 0.05; // Initial delay
  const damageDealt = useRef(false);
  const damageTriggered = useRef(false);

  // useMemo for static geometries - made more narrow and concentrated
  const cylinderGeometries = useMemo(() => ({
    core: new THREE.CylinderGeometry(0.08, 0.08, 20, 16),    // Narrower core
    inner: new THREE.CylinderGeometry(0.18, 0.18, 20, 16),    // More concentrated
    outer: new THREE.CylinderGeometry(0.32, 0.32, 20, 16),    // Tighter outer beam
    glow1: new THREE.CylinderGeometry(0.45, 0.45, 20, 16),    // Reduced glow
    glow2: new THREE.CylinderGeometry(0.55, 0.45, 20, 16),    // More focused
    outerGlow: new THREE.CylinderGeometry(0.6, 0.65, 20, 16),  // Concentrated outer glow
    torus: new THREE.TorusGeometry(0.85, 0.08, 8, 32),       // Smaller spiral rings
    skyTorus: new THREE.TorusGeometry(0.7, 0.08, 32, 32),     // More compact sky effects
    sphere: new THREE.SphereGeometry(0.12, 8, 8)               // Smaller particles
  }), []);

  // Use useMemo for static materials
  const materials = useMemo(() => ({
    core: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00FF88",
      emissiveIntensity: 50,
      transparent: true,
      opacity: 0.995
    }),
    inner: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00FF88",
      emissiveIntensity: 30,
      transparent: true,
      opacity: 0.675
    }),
    outer: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00FF88",
      emissiveIntensity: 20,
      transparent: true,
      opacity: 0.625
    }),
    glow1: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00FF88",
      emissiveIntensity: 4,
      transparent: true,
      opacity: 0.55
    }),
    glow2: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00AA44",
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.425
    }),
    outerGlow: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00AA44",
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.2
    }),
    spiral: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00AA44",
      emissiveIntensity: 10,
      transparent: true,
      opacity: 0.5
    }),
    skySpiral: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00AA44",
      emissiveIntensity: 10,
      transparent: true,
      opacity: 0.4
    }),
    particle: new THREE.MeshStandardMaterial({
      color: "#00FF88",
      emissive: "#00AA44",
      emissiveIntensity: 10,
      transparent: true,
      opacity: 0.665
    })
  }), []);

  // Pre-calculate spiral positions
  const spiralPositions = useMemo(() => (
    Array(3).fill(0).map((_, i) => ({
      rotation: new THREE.Euler(Math.PI / 4, (i * Math.PI) / 1.5, Math.PI)
    }))
  ), []);

  // Pre-calculate sky spiral positions - more concentrated
  const skySpiralPositions = useMemo(() => (
    Array(16).fill(0).map((_, i) => ({
      rotation: new THREE.Euler(0, (i * Math.PI) / 1.5, 0),
      position: new THREE.Vector3(0, 6.0, 0)  // Reduced from 7.45 to 6.0 for more concentration
    }))
  ), []);

  // Pre-calculate particle positions - more concentrated for narrower beam
  const particlePositions = useMemo(() => (
    Array(8).fill(0).map((_, i) => ({
      position: new THREE.Vector3(
        Math.cos((i * Math.PI) / 4) * 0.6,  // Reduced from 1.0 to 0.6
        (i - 4) * 1.5,                     // Reduced vertical spread from 2 to 1.5
        Math.sin((i * Math.PI) / 4) * 0.6   // Reduced from 1.0 to 0.6
      )
    }))
  ), []);

  // Function to perform damage in a radius around the impact location
  const performSmiteDamage = () => {
    if (damageTriggered.current || !enemyData.length) return;

    damageTriggered.current = true;
    const smiteDamage = 80;
    const damageRadius = 3.0; // Small radius around impact location
    let damageDealtFlag = false;

    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;

      const distance = position.distanceTo(enemy.position);
      if (distance <= damageRadius) {
        // Enemy is within damage radius - deal damage
        if (onHit) {
          onHit(enemy.id, smiteDamage); // Pass target ID and damage amount
        }
        damageDealtFlag = true;
      }
    });

    // Notify parent if any damage was dealt
    if (onDamageDealt) {
      onDamageDealt(damageDealtFlag);
    }
  };

  useFrame((_, delta) => {
    if (!lightningRef.current) return;

    // Handle delay before starting the lightning effect
    if (delayTimer.current < startDelay) {
      delayTimer.current += delta;
      return;
    }

    progressRef.current += delta;
    const progress = Math.min(progressRef.current / animationDuration, 1);

    // Animate the lightning bolt
    if (progress < 1) {
      // Start from high up and strike down to target position
      const startY = position.y + 40;
      const targetY = position.y;
      const currentY = startY + (targetY - startY) * progress;
      lightningRef.current.position.y = currentY;

      // Trigger damage when bolt hits the ground (around 80% progress)
      if (progress >= 0.8 && !damageTriggered.current) {
        performSmiteDamage();
      }

      // Adjust scale effect
      const scale = progress < 0.9 ? 1 : 1 - (progress - 0.9) / 0.1;
      lightningRef.current.scale.set(scale, scale, scale);
    } else {
      onComplete();
    }
  });

  return (
    <group
      ref={lightningRef}
      position={[position.x, position.y + 40, position.z]}
      visible={delayTimer.current >= startDelay}
    >
      {/* Core lightning bolts using shared geometries and materials */}
      <mesh geometry={cylinderGeometries.core} material={materials.core} />
      <mesh geometry={cylinderGeometries.inner} material={materials.inner} />
      <mesh geometry={cylinderGeometries.outer} material={materials.outer} />
      <mesh geometry={cylinderGeometries.glow1} material={materials.glow1} />
      <mesh geometry={cylinderGeometries.glow2} material={materials.glow2} />
      <mesh geometry={cylinderGeometries.outerGlow} material={materials.outerGlow} />

      {/* Spiral effect using pre-calculated positions */}
      {spiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} geometry={cylinderGeometries.torus} material={materials.spiral} />
      ))}

      {/* Sky spiral effect using pre-calculated positions */}
      {skySpiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} position={props.position} geometry={cylinderGeometries.skyTorus} material={materials.skySpiral} />
      ))}

      {/* Floating particles using pre-calculated positions */}
      {particlePositions.map((props, i) => (
        <mesh key={i} position={props.position} geometry={cylinderGeometries.sphere} material={materials.particle} />
      ))}

      {/* Lights */}
      <pointLight position={[0, -10, 0]} color="#00FF88" intensity={35} distance={25} />
      <pointLight position={[0, 0, 0]} color="#00AA44" intensity={10} distance={6} />
    </group>
  );
}
