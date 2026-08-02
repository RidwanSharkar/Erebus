import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Mesh,
  Group,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  SphereGeometry,
  Quaternion,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { DEATH_GRASP_HIT_RADIUS, DEATH_GRASP_STANDOFF } from '@/utils/weaponAbilities';

const _particleBase = new Vector3();
const _twistOffset = new Vector3();
const _rightScaled = new Vector3();
const _upScaled = new Vector3();
const _yAxis = new Vector3(0, 1, 0);
const _tempStartToReturn = new Vector3();
const _tempMidpoint = new Vector3();
const _tempQuaternion = new Quaternion();

interface AnimatedDeathGraspProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onHit: (targetId: string, position: Vector3) => void;
  onPullStart: () => void;
  onComplete: () => void;
  /** Enemy data for collision detection (NPC enemies only) */
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    type?: string;
    isBoss1EliteKnight?: boolean;
  }>;
  /** True when this enemy should not be pulled (bosses / elites / training dummy). */
  isEnemyPullImmune?: (enemyId: string) => boolean;
  /** Optional live enemy position during return (server-synced pull lerp). */
  getPulledEnemyPosition?: (enemyId: string) => Vector3 | null;
  /** Called each frame during return while pulling an enemy toward the caster. */
  onEnemyPullFrame?: (enemyId: string, position: Vector3) => void;
}

export default function AnimatedDeathGrasp({
  startPosition,
  targetPosition,
  onHit,
  onPullStart,
  onComplete,
  enemyData = [],
  isEnemyPullImmune,
  getPulledEnemyPosition,
  onEnemyPullFrame,
}: AnimatedDeathGraspProps) {
  const timeRef = useRef(0);
  const flickerRef = useRef(1);
  const phaseRef = useRef<'forward' | 'impact' | 'return' | 'complete'>('forward');
  const hitTargetRef = useRef<{
    id: string;
    /** Original hit position (fixed for lerp start). */
    startPosition: Vector3;
    /** Mutable chain/enemy anchor during return. */
    position: Vector3;
    pullImmune: boolean;
    pullDestination: Vector3;
  } | null>(null);
  const pullTriggered = useRef(false);
  const hitReported = useRef(false);
  const completedRef = useRef(false);

  const forwardDuration = 0.6;
  const returnDuration = 0.6;
  const impactOnlyDuration = 0.2;

  const currentProjectilePosition = useRef(startPosition.clone());
  const currentReturnPosition = useRef(startPosition.clone());
  const tmpEnemyPos = useRef(new Vector3());

  const impactRef = useRef<Group>(null);
  const returnCoreRef = useRef<Group>(null);
  const chainRef = useRef<Mesh>(null);
  const startCoreRef = useRef<Group>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);

  const { right, up, particles, targetFixed } = useMemo(() => {
    const path = targetPosition.clone().sub(startPosition);
    const pathDistance = Math.max(path.length(), 0.01);
    const normalizedDirection = path.normalize();
    const worldUp = new Vector3(0, 1, 0);
    const side = new Vector3().crossVectors(normalizedDirection, worldUp);
    if (side.lengthSq() < 1e-5) {
      side.set(1, 0, 0);
    } else {
      side.normalize();
    }
    const pathUp = new Vector3().crossVectors(side, normalizedDirection).normalize();
    const segmentCount = Math.min(20, Math.max(12, Math.ceil(pathDistance * 4)));
    const streamCount = 3;
    const particleData: Array<{
      progress: number;
      streamIndex: number;
      phaseOffset: number;
      baseScale: number;
    }> = [];

    for (let streamIndex = 0; streamIndex < streamCount; streamIndex += 1) {
      const phaseOffset = (streamIndex * Math.PI * 2) / streamCount;
      for (let i = 0; i <= segmentCount; i += 1) {
        const progress = i / segmentCount;
        particleData.push({
          progress,
          streamIndex,
          phaseOffset,
          baseScale: Math.max(0.3, 1.2 - progress * 0.8 + Math.sin(progress * Math.PI * 6) * 0.1),
        });
      }
    }

    return {
      right: side,
      up: pathUp,
      particles: particleData,
      targetFixed: targetPosition.clone(),
    };
  }, [startPosition, targetPosition]);

  const geometries = useMemo(
    () => ({
      particle: new SphereGeometry(0.15, 8, 8),
      impact: new SphereGeometry(0.2, 8, 8),
      core: new SphereGeometry(0.18, 8, 8),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      spiral: [
        new MeshBasicMaterial({
          color: new Color('#6A0DAD'),
          transparent: true,
          opacity: 0.95,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
        new MeshBasicMaterial({
          color: new Color('#9370DB'),
          transparent: true,
          opacity: 0.85,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
        new MeshBasicMaterial({
          color: new Color('#8A2BE2'),
          transparent: true,
          opacity: 0.75,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ],
      impact: new MeshBasicMaterial({
        color: new Color('#c4b5fd'),
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      core: new MeshBasicMaterial({
        color: new Color('#e9d5ff'),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      chain: new MeshBasicMaterial({
        color: new Color('#4A0E4E'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  );

  useEffect(() => {
    const g = geometries;
    const m = materials;
    return () => {
      g.particle.dispose();
      g.impact.dispose();
      g.core.dispose();
      m.spiral.forEach((mat) => mat.dispose());
      m.impact.dispose();
      m.core.dispose();
      m.chain.dispose();
    };
  }, [geometries, materials]);

  const graspLight = useDynamicLight({ color: '#6A0DAD', distance: 5, decay: 2, priority: 1 });

  const checkForHits = (currentPos: Vector3) => {
    if (!enemyData || enemyData.length === 0) return;
    for (const enemy of enemyData) {
      if (enemy.health <= 0) continue;
      const distance = currentPos.distanceTo(enemy.position);
      if (distance <= DEATH_GRASP_HIT_RADIUS) {
        const pullImmune = isEnemyPullImmune?.(enemy.id) === true;
        const toEnemy = enemy.position.clone().sub(startPosition);
        toEnemy.y = 0;
        if (toEnemy.lengthSq() < 1e-6) {
          toEnemy.set(0, 0, 1);
        } else {
          toEnemy.normalize();
        }
        const pullDestination = startPosition.clone().add(
          toEnemy.multiplyScalar(DEATH_GRASP_STANDOFF),
        );
        pullDestination.y = enemy.position.y;

        hitTargetRef.current = {
          id: enemy.id,
          startPosition: enemy.position.clone(),
          position: enemy.position.clone(),
          pullImmune,
          pullDestination,
        };
        if (!hitReported.current) {
          hitReported.current = true;
          onHit(enemy.id, enemy.position.clone());
        }
        return;
      }
    }
  };

  useFrame((_, delta) => {
    if (completedRef.current) return;

    timeRef.current += delta;
    flickerRef.current = Math.random() * 0.3 + 0.7;

    if (phaseRef.current === 'forward') {
      const forwardProgress = Math.min(timeRef.current / forwardDuration, 1);
      currentProjectilePosition.current.lerpVectors(startPosition, targetFixed, forwardProgress);

      if (forwardProgress < 0.9 && !hitTargetRef.current) {
        checkForHits(currentProjectilePosition.current);
      }

      const shouldEndForward = forwardProgress >= 1.0 || !!hitTargetRef.current;
      if (shouldEndForward && !pullTriggered.current) {
        pullTriggered.current = true;
        onPullStart();

        if (hitTargetRef.current) {
          currentReturnPosition.current.copy(hitTargetRef.current.position);
        } else {
          currentReturnPosition.current.copy(targetFixed);
        }

        if (hitTargetRef.current?.pullImmune) {
          phaseRef.current = 'impact';
          timeRef.current = 0;
        } else {
          // Hit or miss — play return spiral
          phaseRef.current = 'return';
          timeRef.current = 0;
        }
      }
    } else if (phaseRef.current === 'impact') {
      if (timeRef.current >= impactOnlyDuration) {
        phaseRef.current = 'complete';
        completedRef.current = true;
        graspLight.current?.setIntensity(0);
        onComplete();
        return;
      }
    } else if (phaseRef.current === 'return') {
      const returnProgress = Math.min(timeRef.current / returnDuration, 1);
      const hit = hitTargetRef.current;

      let enemyStart = hit?.position || targetFixed;
      const live = hit ? getPulledEnemyPosition?.(hit.id) : null;
      if (live) {
        enemyStart = live;
      }

      // Chain head travels from enemy toward caster; enemy mesh lerps to standoff
      currentReturnPosition.current.lerpVectors(enemyStart, startPosition, returnProgress);

      if (hit && !hit.pullImmune) {
        const enemyLerpPos = hit.startPosition.clone().lerp(hit.pullDestination, returnProgress);
        tmpEnemyPos.current.copy(enemyLerpPos);
        hit.position.copy(enemyLerpPos);
        onEnemyPullFrame?.(hit.id, tmpEnemyPos.current);
      }

      if (returnProgress >= 1.0) {
        if (hit && !hit.pullImmune) {
          onEnemyPullFrame?.(hit.id, hit.pullDestination.clone());
        }
        phaseRef.current = 'complete';
        completedRef.current = true;
        graspLight.current?.setIntensity(0);
        onComplete();
        return;
      }
    }

    const phase = phaseRef.current;
    const forwardProgress =
      phase === 'forward' ? Math.min(timeRef.current / forwardDuration, 1) : 1;
    const returnProgress =
      phase === 'return' ? Math.min(timeRef.current / returnDuration, 1) : phase === 'complete' ? 1 : 0;
    const flicker = flickerRef.current;

    let baseOpacity = 1.0;
    if (phase === 'forward') {
      baseOpacity = 1.0 - forwardProgress * 0.3;
    } else if (phase === 'return') {
      baseOpacity = 0.7 - returnProgress * 0.4;
    } else if (phase === 'impact') {
      baseOpacity = 0.85;
    }

    materials.spiral.forEach((material, index) => {
      material.opacity = baseOpacity * (0.95 - index * 0.1) * flicker;
    });
    materials.impact.opacity = (baseOpacity * 0.7) * flicker;
    materials.core.opacity = (baseOpacity * 1.1) * flicker;

    const showReturnChain =
      phase === 'return' && !!hitTargetRef.current && !hitTargetRef.current.pullImmune;
    materials.chain.opacity = showReturnChain ? (baseOpacity * 0.6) * flicker : 0;

    // Update spiral particles imperatively
    particles.forEach((particle, index) => {
      const mesh = particleRefs.current[index];
      if (!mesh) return;

      let isVisible = false;
      if (phase === 'forward' || phase === 'impact') {
        isVisible = particle.progress <= forwardProgress + 0.04;
      } else if (phase === 'return') {
        // Reveal reverse path: particles near target first, then toward caster
        isVisible = particle.progress >= 1 - returnProgress - 0.04;
      }

      mesh.visible = isVisible;
      if (!isVisible) return;

      _particleBase.lerpVectors(startPosition, targetFixed, particle.progress);
      const spiralAngle =
        particle.progress * Math.PI * 2 * 4 + particle.phaseOffset + timeRef.current * 2.5;
      const radius =
        0.2 *
        (1 - particle.progress * 0.3) *
        (phase === 'return' ? 1 - returnProgress * 0.2 : 1);
      _rightScaled.copy(right).multiplyScalar(Math.cos(spiralAngle) * radius);
      _upScaled.copy(up).multiplyScalar(Math.sin(spiralAngle) * radius);
      _twistOffset.copy(_rightScaled).add(_upScaled);
      _particleBase.add(_twistOffset);

      if (phase === 'return') {
        const collapse = returnProgress * Math.max(0, 1 - particle.progress) * 0.35;
        _particleBase.lerp(startPosition, collapse);
      }

      mesh.position.copy(_particleBase);
      const pulse =
        0.82 +
        Math.sin(timeRef.current * 8 + particle.progress * 20 + particle.streamIndex) * 0.18;
      mesh.scale.setScalar(
        particle.baseScale * pulse * (phase === 'return' ? 1 - returnProgress * 0.2 : 1),
      );
    });

    // Impact head (forward / impact phases)
    if (impactRef.current) {
      const showImpact = phase === 'forward' || phase === 'impact';
      impactRef.current.visible = showImpact;
      if (showImpact) {
        impactRef.current.position.copy(currentProjectilePosition.current);
        impactRef.current.rotation.y += delta * 6.5;
        impactRef.current.rotation.x += delta * 3.2;
        const impactScale = 1.5 * (1 + Math.sin(timeRef.current * 10) * 0.12);
        impactRef.current.scale.setScalar(impactScale);
      }
    }

    // Return core + chain
    if (returnCoreRef.current) {
      returnCoreRef.current.visible = phase === 'return';
      if (phase === 'return') {
        returnCoreRef.current.position.copy(currentReturnPosition.current);
        returnCoreRef.current.rotation.y -= delta * 9;
        returnCoreRef.current.scale.setScalar(1.3 - returnProgress * 0.35);
      }
    }

    if (chainRef.current) {
      chainRef.current.visible = showReturnChain;
      if (showReturnChain && hitTargetRef.current) {
        const hitPos = hitTargetRef.current.position;
        const returnPos = currentReturnPosition.current;
        const toStart = _tempStartToReturn.copy(returnPos).sub(hitPos);
        const chainLength = Math.max(toStart.length(), 0.01);
        const midpoint = _tempMidpoint.copy(hitPos).add(returnPos).multiplyScalar(0.5);
        chainRef.current.position.copy(midpoint);
        chainRef.current.scale.set(1, chainLength, 1);
        const chainDirection = toStart.normalize();
        chainRef.current.quaternion.copy(
          _tempQuaternion.setFromUnitVectors(_yAxis, chainDirection),
        );
      }
    }

    if (startCoreRef.current) {
      startCoreRef.current.rotation.y += delta * 4.5;
      startCoreRef.current.scale.setScalar(1 + Math.sin(timeRef.current * 8) * 0.12);
    }

    // Pooled light follows projectile / return head
    if (phase === 'forward' || phase === 'impact') {
      const p = currentProjectilePosition.current;
      graspLight.current?.setPosition(p.x, p.y, p.z);
      graspLight.current?.setIntensity(8 * flicker);
    } else if (phase === 'return') {
      const p = currentReturnPosition.current;
      graspLight.current?.setPosition(p.x, p.y, p.z);
      graspLight.current?.setIntensity(6 * flicker);
    } else {
      graspLight.current?.setPosition(startPosition.x, startPosition.y, startPosition.z);
      graspLight.current?.setIntensity(0);
    }
  });

  return (
    <group frustumCulled={false}>
      {particles.map((particle, index) => (
        <mesh
          key={`${particle.streamIndex}-${index}`}
          ref={(mesh) => {
            particleRefs.current[index] = mesh;
          }}
          geometry={geometries.particle}
          material={materials.spiral[particle.streamIndex]}
          visible={false}
          frustumCulled={false}
        />
      ))}

      <group ref={impactRef} position={startPosition.clone()}>
        <mesh geometry={geometries.impact} material={materials.impact} scale={[1.65, 1.65, 1.65]} />
        <mesh geometry={geometries.core} material={materials.core} scale={[0.9, 0.9, 0.9]} />
      </group>

      <group ref={returnCoreRef} position={targetPosition.clone()} visible={false}>
        <mesh geometry={geometries.impact} material={materials.impact} scale={[1.3, 1.3, 1.3]} />
        <mesh geometry={geometries.core} material={materials.core} scale={[0.8, 0.8, 0.8]} />
      </group>

      <mesh ref={chainRef} material={materials.chain} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.035, 0.035, 1, 7]} />
      </mesh>

      <group ref={startCoreRef} position={startPosition.clone()}>
        <mesh geometry={geometries.core} material={materials.core} scale={[1.2, 1.2, 1.2]} />
        <mesh geometry={geometries.impact} material={materials.spiral[0]} scale={[1.7, 1.7, 1.7]} />
      </group>
    </group>
  );
}
