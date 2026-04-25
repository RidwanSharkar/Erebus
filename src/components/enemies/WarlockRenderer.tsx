'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import WarlockModel from './WarlockModel';
import WarlockTeleportEffect from './WarlockTeleportEffect';
import CubeSoulEffect from './CubeSoulEffect';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';

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

// Fast lerp: the warlock only moves via teleport, so we want position corrections to be snappy
const LERP_SPEED = 20;

export default function WarlockRenderer({
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
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isBlinking,  setIsBlinking]  = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isWalking,   setIsWalking]   = useState(false);
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
  const walkStopTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snap to server position before the first frame so the warlock is never rendered at the world origin
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track server position — red: blink teleports; purple: incremental walk updates
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 2.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (
      soulType === 'purple' &&
      dist > 0.01 &&
      dist <= 2.0 &&
      !isBlinking &&
      !isLaunching &&
      !isDying
    ) {
      setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, soulType, isBlinking, isLaunching, isDying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (walkStopTimer.current) clearTimeout(walkStopTimer.current); };
  }, []);

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

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const newPos   = new Vector3(data.endPosition.x,   data.endPosition.y,   data.endPosition.z);

      // Immediately chase the new position so the lerp is already pulling there during the animation
      targetPosition.current.copy(newPos);
      targetRotation.current = data.rotation;

      // Play blink sound at the departure position
      (window as any).audioSystem?.playEnemyBlinkSound(startPos);

      const fxId = `${id}-${Date.now()}`;

      // Departure effect at the original position
      setBlinkFx(prev => [...prev, { id: `${fxId}-start`, position: startPos, type: 'start' }]);

      // Arrival effect fires roughly halfway through the blink animation
      const arrivalDelay = Math.round(BLINK_ANIMATION_DURATION * 0.45);
      setTimeout(() => {
        setBlinkFx(prev => [...prev, { id: `${fxId}-end`, position: newPos, type: 'end' }]);
      }, arrivalDelay);

      setTimeout(() => {
        setIsBlinking(false);
        // Hard snap after animation completes to ensure the position is exact
        if (groupRef.current) {
          groupRef.current.position.copy(newPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_ANIMATION_DURATION);
    };

    socket.on('warlock-blink-telegraph', handleWarlockBlink);
    return () => { socket.off('warlock-blink-telegraph', handleWarlockBlink); };
  }, [id, socket]);

  // Launch telegraph: drives the launch animation (projectile is spawned by CoopGameScene)
  useEffect(() => {
    if (!socket) return;

    const handleWarlockLaunch = (data: { warlockId: string }) => {
      if (data.warlockId !== id) return;
      setIsLaunching(true);
      setTimeout(() => setIsLaunching(false), LAUNCH_ANIMATION_DURATION);
    };

    socket.on('warlock-attack-telegraph', handleWarlockLaunch);
    return () => { socket.off('warlock-attack-telegraph', handleWarlockLaunch); };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Lerp toward server-authoritative position (handles minor corrections and blink approach)
    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Shortest-arc rotation lerp
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    // Death fade-out (death clip plays on the model underneath)
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.transparent = true;
            mat.opacity = opacity.current;
          });
        }
      });
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
