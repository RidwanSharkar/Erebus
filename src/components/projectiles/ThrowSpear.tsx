import React from 'react';
import ThrowSpearProjectile from './ThrowSpearProjectile';

interface ThrowSpearProjectileData {
  id: number;
  position: import('three').Vector3;
  direction: import('three').Vector3;
  startPosition: import('three').Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
  chargeTime: number;
  damage: number;
}

interface ThrowSpearProps {
  activeProjectiles: ThrowSpearProjectileData[];
}

export default function ThrowSpear({ activeProjectiles }: ThrowSpearProps) {
  // Debug: log when projectiles are being rendered
  if (activeProjectiles.length > 0) {
    console.log('🎯 Rendering', activeProjectiles.length, 'throw spear projectiles');
  }

  return (
    <>
      {activeProjectiles.map(projectile => (
        <ThrowSpearProjectile
          key={projectile.id}
          position={projectile.position}
          direction={projectile.direction}
          opacity={projectile.opacity}
          isReturning={projectile.isReturning}
          chargeTime={projectile.chargeTime}
        />
      ))}
    </>
  );
}

