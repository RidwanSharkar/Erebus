'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WeaverModel from './WeaverModel';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { detachSharedMaterialsForMutation } from '@/utils/sharedEnemyMaterials';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface WeaverRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  /** Co-op: green = support weaver, blue = lightning weaver (aura colour) */
  soulType?: 'green' | 'blue' | 'red' | 'purple' | 'yellow' | 'orange';
  staggerBuildup?: number;
}

const CAST_HEAL_DURATION   = 2000; // ms — matches weaver_castheal clip length
const CAST_SUMMON_DURATION = 3000; // ms — matches weaver_castsummon clip length
const CAST_LIGHTNING_DURATION = 900; // ms — matches backend WEAVER_LIGHTNING_CAST_LOCK_MS
/** Full impale windup lock — matches backend weaverCastLockUntil duration. */
const IMPALE_CAST_LOCK_MS = 2000 + 1000 + 750 + 300;
const FADE_DURATION        = 1.5;  // seconds for death fade-out
const LERP_SPEED           = 12;
const WALK_STOP_DELAY      = 250;  // ms
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between weaver_impact.glb hit-react plays

function WeaverRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  soulType,
  staggerBuildup = 0,
}: WeaverRendererProps) {
  const theme = campHpTheme(campType);
  const isBlue = soulType === 'blue';
  const auraRing = isBlue
    ? { color: '#44aaff', emissive: '#2060c0' }
    : { color: '#00ff55', emissive: '#00cc33' };
  const auraDisc = isBlue
    ? { color: '#3388dd', emissive: '#1a50aa' }
    : { color: '#00cc44', emissive: '#00aa22' };
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isCastingHeal,   setIsCastingHeal]   = useState(false);
  const [isCastingSummon, setIsCastingSummon] = useState(false);
  const [isWalking,       setIsWalking]       = useState(false);
  const isWalkingRef = useRef(false);
  const [isImpacting,     setIsImpacting]     = useState(false);
  const [impactPlayKey,   setImpactPlayKey]   = useState(0);

  const targetPosition   = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation   = useRef(rotation);
  const isCastingRef     = useRef(false);
  const isCastingSummonRef = useRef(false);
  const prevHealthRef    = useRef(health);
  const lastHitImpactAtRef = useRef(0);

  const lastMoveTimeRef = useRef(0);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const auraGroupRef  = useRef<Group | null>(null);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  // Keep spawn snap in sync with React position prop updates.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isCastLocked = isCastingRef.current;
    if (!isCastLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 8.0 && groupRef.current && !isCastLocked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while idle (not walk / cast).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isCastingHeal &&
      !isCastingSummon
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isCastingHeal, isCastingSummon]);

  useEffect(() => {
    if (isWalking || isCastingHeal || isCastingSummon) {
      setIsImpacting(false);
    }
  }, [isWalking, isCastingHeal, isCastingSummon]);

  // Weaver heal cast telegraph
  useEffect(() => {
    if (!socket) return;

    const handleHealTelegraph = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      isCastingRef.current = true;
      setIsCastingHeal(true);
      trackTimeout(() => {
        setIsCastingHeal(false);
        isCastingRef.current = isCastingSummonRef.current;
      }, CAST_HEAL_DURATION);
    };

    socket.on('weaver-heal-telegraph', handleHealTelegraph);
    return () => { socket.off('weaver-heal-telegraph', handleHealTelegraph); };
  }, [id, socket, trackTimeout]);

  // Weaver Impale Spike cast (post-Boss2) — reuses CastHeal animation
  useEffect(() => {
    if (!socket) return;

    const handleImpaleCast = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      isCastingRef.current = true;
      setIsCastingHeal(true);
      trackTimeout(() => setIsCastingHeal(false), CAST_HEAL_DURATION);
      trackTimeout(() => {
        isCastingRef.current = isCastingSummonRef.current;
      }, IMPALE_CAST_LOCK_MS);
    };

    socket.on('weaver-impale-spike-cast', handleImpaleCast);
    return () => { socket.off('weaver-impale-spike-cast', handleImpaleCast); };
  }, [id, socket, trackTimeout]);

  // Weaver summon ghoul telegraph
  useEffect(() => {
    if (!socket) return;

    const handleSummonTelegraph = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      isCastingRef.current = true;
      isCastingSummonRef.current = true;
      setIsCastingSummon(true);
      trackTimeout(() => {
        setIsCastingSummon(false);
        isCastingSummonRef.current = false;
        isCastingRef.current = false;
      }, CAST_SUMMON_DURATION);
    };

    socket.on('weaver-summon-telegraph', handleSummonTelegraph);
    return () => { socket.off('weaver-summon-telegraph', handleSummonTelegraph); };
  }, [id, socket, trackTimeout]);

  // Blue weaver lightning — reuse CastHeal channel pose while locked in place
  useEffect(() => {
    if (!socket) return;

    const handleLightningTelegraph = (data: { weaverId: string; strikeAt?: number; timestamp?: number }) => {
      if (data.weaverId !== id) return;
      const lockMs = data.strikeAt && data.timestamp
        ? Math.max(CAST_LIGHTNING_DURATION, data.strikeAt - data.timestamp)
        : CAST_LIGHTNING_DURATION;
      isCastingRef.current = true;
      setIsCastingHeal(true);
      trackTimeout(() => setIsCastingHeal(false), Math.min(lockMs, CAST_HEAL_DURATION));
      trackTimeout(() => {
        isCastingRef.current = isCastingSummonRef.current;
      }, lockMs);
    };

    socket.on('weaver-lightning-telegraph', handleLightningTelegraph);
    return () => { socket.off('weaver-lightning-telegraph', handleLightningTelegraph); };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const isCastLocked = isCastingRef.current;

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    if (dist > 8.0 && !isCastLocked) {
      group.position.copy(targetPosition.current);
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      isCastLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    if (!isCastLocked) {
      group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

      let deltaAngle = targetRotation.current - group.rotation.y;
      while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
      syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);
    }

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        detachSharedMaterialsForMutation(group);
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

    // Aura is a scene-level sibling group — mirror the weaver's XZ, stay at ground Y
    if (auraGroupRef.current && !isDying && opacity.current > 0) {
      const pos = group.position;
      auraGroupRef.current.position.set(pos.x, 0.2, pos.z);
      auraGroupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <>
      {/* Permanent ground aura — green (support) or blue (lightning) */}
      {!isDying && (
        <group ref={auraGroupRef}>
          {/* Four triangular ring segments, flat on the ground */}
          <group>
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, rot]}>
                <ringGeometry args={[0.85, 1.0, 3]} />
                <meshBasicMaterial
                  color={auraRing.color}
                  transparent
                  opacity={0.6}
                  depthWrite={false}
                  side={2}
                />
              </mesh>
            ))}
          </group>
          {/* Disc beneath the rings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.925, 32]} />
            <meshBasicMaterial
              color={auraDisc.color}
              transparent
              opacity={0.45}
              depthWrite={false}
              side={2}
            />
          </mesh>

          <EnemyDynamicLight color={auraRing.color} intensity={0.5} distance={12} decay={6} position={[0, 2, -0.5]} />
          <EnemyDynamicLight color={auraDisc.color} intensity={3} distance={8} decay={2} position={[0, 1, 0]} />
        </group>
      )}

      <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <WeaverModel
        isWalking={isWalking}
        isCastingHeal={isCastingHeal}
        isCastingSummon={isCastingSummon}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />

      <Billboard position={[0, 3.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />

            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('weaver')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
      </group>
    </>
  );
}

export default React.memo(WeaverRenderer);
