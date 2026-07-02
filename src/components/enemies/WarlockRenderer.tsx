'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import WarlockModel from './WarlockModel';
import WarlockTeleportEffect from './WarlockTeleportEffect';
import CubeSoulEffect from './CubeSoulEffect';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';

interface WarlockRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  /** Co-op camp soul colour; drives CubeSoulEffect (purple = meteor warlock, red = default). */
  soulType?: 'red' | 'purple' | 'green' | 'blue' | 'yellow';
  staggerBuildup?: number;
}

// How long the blink animation plays before we snap to the new position
const BLINK_ANIMATION_DURATION = 800;  // ms
// How long the launch animation plays
const LAUNCH_ANIMATION_DURATION = 1400; // ms
const FADE_DURATION = 1.5; // seconds for death fade-out
const WALK_STOP_DELAY = 250; // ms — purple warlock walks on server; debounce idle
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between warlock_impact.glb hit-react plays

// Match Knight/Viper for smooth walk; blink uses a faster slide lerp.
const LERP_SPEED = 12;
const BLINK_LERP_SPEED = 20;

function WarlockRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  soulType,
  staggerBuildup = 0,
}: WarlockRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);

  const [isBlinking,  setIsBlinking]  = useState(false);
  const isBlinkingRef = useRef(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const isLaunchingRef = useRef(false);
  const [isWalking,   setIsWalking]   = useState(false);
  const isWalkingRef = useRef(false);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  type BlinkFx = { id: string; position: Vector3; type: 'start' | 'end' };
  const [blinkFx, setBlinkFx] = useState<BlinkFx[]>([]);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const prevHealthRef  = useRef(health);
  const lastHitImpactAtRef = useRef(0);
  const fadeTimer      = useRef(0);
  const opacity        = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const walkStopTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);

  // Snap to server position before the first frame so the warlock is never rendered at the world origin
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  // Derive walking state from server position deltas (purple warlock only).
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    const isLaunchLocked = isLaunchingRef.current;
    if (!isLaunchLocked && !isBlinkingRef.current) {
      targetPosition.current.copy(position);
    }
    if (dist > 2.0 && groupRef.current && !isLaunchLocked && !isBlinkingRef.current) {
      groupRef.current.position.copy(position);
    }
    if (
      soulType === 'purple' &&
      dist > 0.01 &&
      !isLaunchLocked &&
      !isDying
    ) {
      if (!isWalkingRef.current) {
        isWalkingRef.current = true;
        setIsWalking(true);
      }
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        isWalkingRef.current = false;
        setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, soulType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while not blinking / launching.
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isBlinking &&
      !isLaunching
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isBlinking, isLaunching]);

  useEffect(() => {
    if (isBlinking || isLaunching) {
      setIsImpacting(false);
    }
  }, [isBlinking, isLaunching]);

  // Blink telegraph: plays blink animation then snaps the rendered position to endPosition
  useEffect(() => {
    if (!socket) return;

    const handleWarlockBlink = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.warlockId !== id) return;

      setIsBlinking(true);
      isBlinkingRef.current = true;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const newPos   = new Vector3(data.endPosition.x,   data.endPosition.y,   data.endPosition.z);

      // Immediately chase the new position so the lerp is already pulling there during the animation
      targetPosition.current.copy(newPos);
      targetRotation.current = data.rotation;
      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      // Play blink sound at the departure position
      (window as any).audioSystem?.playEnemyBlinkSound(startPos);

      const fxId = `${id}-${Date.now()}`;

      // Departure effect at the original position
      setBlinkFx(prev => [...prev, { id: `${fxId}-start`, position: startPos, type: 'start' }]);

      // Arrival effect fires roughly halfway through the blink animation
      const arrivalDelay = Math.round(BLINK_ANIMATION_DURATION * 0.45);
      trackTimeout(() => {
        setBlinkFx(prev => [...prev, { id: `${fxId}-end`, position: newPos, type: 'end' }]);
      }, arrivalDelay);

      trackTimeout(() => {
        setIsBlinking(false);
        isBlinkingRef.current = false;
        // Hard snap after animation completes to ensure the position is exact
        if (groupRef.current) {
          groupRef.current.position.copy(newPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_ANIMATION_DURATION);
    };

    socket.on('warlock-blink-telegraph', handleWarlockBlink);
    return () => { socket.off('warlock-blink-telegraph', handleWarlockBlink); };
  }, [id, socket, trackTimeout]);

  // Launch telegraph: drives the launch animation (projectile is spawned by CoopGameScene)
  useEffect(() => {
    if (!socket) return;

    const handleWarlockLaunch = (data: { warlockId: string }) => {
      if (data.warlockId !== id) return;
      setIsLaunching(true);
      isLaunchingRef.current = true;
      trackTimeout(() => {
        setIsLaunching(false);
        isLaunchingRef.current = false;
      }, LAUNCH_ANIMATION_DURATION);
    };

    socket.on('warlock-attack-telegraph', handleWarlockLaunch);
    return () => { socket.off('warlock-attack-telegraph', handleWarlockLaunch); };
  }, [id, socket, trackTimeout]);

  // Archon Shock (post-boss-2): same cast animation as chaos orb launch
  useEffect(() => {
    if (!socket) return;

    const handleArchonShock = (data: { warlockId: string }) => {
      if (data.warlockId !== id) return;
      setIsLaunching(true);
      isLaunchingRef.current = true;
      trackTimeout(() => {
        setIsLaunching(false);
        isLaunchingRef.current = false;
      }, LAUNCH_ANIMATION_DURATION);
    };

    socket.on('warlock-archon-shock', handleArchonShock);
    return () => { socket.off('warlock-archon-shock', handleArchonShock); };
  }, [id, socket, trackTimeout]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    const isLaunchLocked = isLaunchingRef.current;

    if (isBlinkingRef.current) {
      group.position.lerp(targetPosition.current, Math.min(1, delta * BLINK_LERP_SPEED));
      let deltaAngle = targetRotation.current - group.rotation.y;
      while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * BLINK_LERP_SPEED);
    } else {
      const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

      if (dist > 2.0 && !isLaunchLocked) {
        group.position.copy(targetPosition.current);
      }

      if (!isLaunchLocked) {
        group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

        let deltaAngle = targetRotation.current - group.rotation.y;
        while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
        while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
        group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
      }
    }

    // Death fade-out (death clip plays on the model underneath)
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              collected.push(mat);
            });
          }
        });
        cachedDeathMats.current = collected;
        deathCacheBuilt.current = true;
      }

      const op = opacity.current;
      for (let i = 0; i < cachedDeathMats.current.length; i++) {
        cachedDeathMats.current[i].opacity = op;
      }
    }
  });

  return (
    <>
      {/* Blink teleport effects — rendered in world space, outside the moving group */}
      {blinkFx.map(fx => (
        <WarlockTeleportEffect
          key={fx.id}
          position={fx.position}
          type={fx.type}
          onComplete={() => setBlinkFx(prev => prev.filter(f => f.id !== fx.id))}
        />
      ))}

      <GhostTrail
        parentRef={groupRef as React.RefObject<Group>}
        weaponType={WeaponType.NONE}
        fixedTrailColor="#ff5500"
        isTrailMotionRef={isBlinkingRef}
        yOffset={1.0}
      />

    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <WarlockModel
        isWalking={isWalking}
        isBlinking={isBlinking}
        isLaunching={isLaunching}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />
      {!isDying && (
        <CubeSoulEffect
          color={soulType === 'purple' ? 'purple' : 'red'}
          posY={2.75}
        />
      )}

      {/* Billboard health bar */}
      <Billboard position={[0, 4.5, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
            </mesh>

            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color={theme.text}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🔮 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
    </>
  );
}

export default React.memo(WarlockRenderer);
