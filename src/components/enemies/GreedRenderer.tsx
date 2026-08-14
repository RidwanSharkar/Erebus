'use client';
import type { Position3 } from '@/utils/position3';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
import { detachSharedMaterialsForMutation } from '@/utils/sharedEnemyMaterials';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getUnitNameplateName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import GreedModel, { GreedAbilityClip } from './GreedModel';
import KnightSoulEffect from './KnightSoulEffect';
import SpellChargeFlare from './SpellChargeFlare';
import { KNIGHT_CAST_PROJECTILE_DELAY_MS } from '@/utils/knightCoopAbilitiesConstants';

export type GreedSoulType = 'green' | 'red' | 'blue' | 'purple' | 'yellow';

interface GreedRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  soulType?: GreedSoulType;
  campType?: string;
}

interface AbilityTelegraphEvent {
  greedId: string;
  ability: 'cast' | 'healcast' | 'launch';
  durationMs: number;
}

const LERP_SPEED = 12;
const FADE_DURATION = 1.5;

const ABILITY_TO_CLIP: Record<AbilityTelegraphEvent['ability'], GreedAbilityClip> = {
  cast: 'Cast',
  healcast: 'HealCast',
  launch: 'Launch',
};

interface ChargeVfxConfig {
  playKey: number;
  color: string;
  accentColor: string;
  chargeMs: number;
}

/** null => ability has no projectile, so no muzzle VFX */
function resolveChargeVfx(
  soulType: GreedSoulType,
  ability: AbilityTelegraphEvent['ability'],
  durationMs: number,
): Omit<ChargeVfxConfig, 'playKey'> | null {
  if (soulType === 'yellow' && ability === 'cast') {
    return { color: '#22c55e', accentColor: '#86efac', chargeMs: durationMs };
  }
  if (soulType === 'purple' && ability === 'healcast') {
    return { color: '#0ea5e9', accentColor: '#cffafe', chargeMs: KNIGHT_CAST_PROJECTILE_DELAY_MS };
  }
  if (soulType === 'red' && ability === 'launch') {
    return { color: '#ff5500', accentColor: '#ffcc55', chargeMs: 220 };
  }
  return null;
}

function GreedRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  soulType = 'green',
  campType,
}: GreedRendererProps) {
  const theme = campHpTheme(campType ?? soulType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const abilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const [abilityClip, setAbilityClip] = useState<GreedAbilityClip | null>(null);
  const [chargeVfx, setChargeVfx] = useState<ChargeVfxConfig | null>(null);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    targetPosition.current.set(position.x, position.y, position.z);
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (abilityTimer.current) clearTimeout(abilityTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAbilityTelegraph = (data: AbilityTelegraphEvent) => {
      if (data.greedId !== id) return;
      const clip = ABILITY_TO_CLIP[data.ability];
      if (!clip) return;

      if (abilityTimer.current) clearTimeout(abilityTimer.current);
      setAbilityClip(clip);
      const vfx = resolveChargeVfx(soulType, data.ability, data.durationMs || 0);
      if (vfx) {
        setChargeVfx((prev) => ({ ...vfx, playKey: (prev?.playKey ?? 0) + 1 }));
      }
      abilityTimer.current = setTimeout(() => {
        setAbilityClip(null);
      }, Math.max(0, data.durationMs || 0));
    };

    socket.on('greed-ability-telegraph', handleAbilityTelegraph);
    return () => {
      socket.off('greed-ability-telegraph', handleAbilityTelegraph);
    };
  }, [id, socket, soulType]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

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
  });

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <GreedModel isDying={!!isDying} abilityClip={abilityClip} />
      {chargeVfx && (
        <SpellChargeFlare
          playKey={chargeVfx.playKey}
          color={chargeVfx.color}
          accentColor={chargeVfx.accentColor}
          chargeMs={chargeVfx.chargeMs}
          offset={[0, 1.4, 0.5]}
          scale={0.7}
        />
      )}

      {!isDying && <KnightSoulEffect soulType={soulType} compact />}

      <Billboard position={[0, 2.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />

            <EnemyHealthBarTextLabel
              name={getUnitNameplateName('greed', campType)}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(GreedRenderer);
