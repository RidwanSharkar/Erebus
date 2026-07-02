'use client';

import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';
import { CombatSystem } from '@/systems/CombatSystem';
import { Transform } from '@/ecs/components/Transform';
import SmiteComponent from '@/components/weapons/Smite';
import LightningStorm from '@/components/weapons/LightningStorm';
import FlurryHealingEffect from '@/components/weapons/FlurryHealingEffect';
import WindShearTornadoEffect, { WhirlwindRadialWaveEffect } from '@/components/projectiles/WindShearTornadoEffect';
import DeathGraspProjectile from '@/components/weapons/DeathGraspProjectile';
import HauntedSoulEffect from '@/components/weapons/HauntedSoulEffect';
import DragonBreath from '@/components/weapons/DragonBreath';
import FrozenEffect from '@/components/weapons/FrozenEffect';
import StunnedEffect from '@/components/weapons/StunnedEffect';
import {
  shouldApplyInfestedSmiteTalent,
  shouldApplyInfernalSmiteTalent,
  shouldApplyStaggeringSmiteTalent,
  LIGHTNING_BOLT_ROOM_STAGGER,
  type TalentLoadout,
} from '@/utils/talents';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type {
  LocalPlayerStatusEffectState,
  RoomBoomMendingEffectState,
} from '@/components/coop/coopVfxLayerTypes';
import type { World } from '@/ecs/World';

export type PvpSmiteEffectState = {
  id: number;
  playerId: string;
  position: Vector3;
  startTime: number;
  duration: number;
  onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void;
  sequenceDelaySec?: number;
  infestedSmite?: boolean;
  staggeringSmite?: boolean;
  infernalSmite?: boolean;
  vengeanceSmite?: boolean;
};

export type LightningStormEffectState = {
  id: number;
  playerId: string;
  position: Vector3;
  damage: number;
  startTime: number;
  duration: number;
  onDamageDealt?: (damageDealt: boolean) => void;
};

export type PvpWindShearTornadoEffectState = {
  id: number;
  playerId: string;
  position: Vector3;
  startTime: number;
  duration: number;
};

export type PvpWhirlwindRadialWaveEffectState = {
  id: number;
  playerId: string;
  position: Vector3;
  startTime: number;
  duration: number;
};

export type PvpDeathGraspEffectState = {
  id: number;
  playerId: string;
  startPosition: Vector3;
  direction: Vector3;
  startTime: number;
  duration: number;
  pullTriggered: boolean;
};

export type FlurryHealingEffectState = {
  id: number;
  position: Vector3;
  startTime: number;
};

export type PvpHauntedSoulEffectState = {
  id: number;
  position: Vector3;
  startTime: number;
  playerId?: string;
  duration?: number;
  wrathfulStrike?: boolean;
  infestedStrike?: boolean;
};

export type BreathWeaponEffectState = {
  id: string;
  position: Vector3;
  direction: Vector3;
  startTime: number;
  wrathfulStrike?: boolean;
  infestedStrike?: boolean;
  wraithGuard?: boolean;
  staggeringStrike?: boolean;
};

type PlayerPosition = { x: number; y: number; z: number };

type SmiteDamageNumber = {
  id: number;
  damage: number;
  position: Vector3;
  isCritical: boolean;
  isSmite?: boolean;
};

export type CoopPvpAbilityLayerHandle = {
  clearAll: () => void;
  addSmite: (effect: PvpSmiteEffectState) => void;
  removeSmite: (id: number) => void;
  addLightningStorm: (effect: LightningStormEffectState) => void;
  removeLightningStorm: (id: number) => void;
  addWindShearTornado: (effect: PvpWindShearTornadoEffectState) => void;
  removeWindShearTornado: (id: number) => void;
  addWhirlwindRadialWave: (effect: PvpWhirlwindRadialWaveEffectState) => void;
  removeWhirlwindRadialWave: (id: number) => void;
  addDeathGrasp: (effect: PvpDeathGraspEffectState) => void;
  removeDeathGrasp: (id: number) => void;
  addHauntedSoul: (effect: PvpHauntedSoulEffectState) => void;
  removeHauntedSoul: (id: number) => void;
  addBreathWeapon: (effect: BreathWeaponEffectState) => void;
  removeBreathWeapon: (id: string) => void;
  addRoomBoomMending: (effect: RoomBoomMendingEffectState) => void;
  removeRoomBoomMending: (id: number) => void;
  addFlurryHealing: (effect: FlurryHealingEffectState) => void;
  removeFlurryHealing: (id: number) => void;
  addLocalPlayerFrozen: (effect: LocalPlayerStatusEffectState) => void;
  removeLocalPlayerFrozen: (id: number) => void;
  addLocalPlayerStunned: (effect: LocalPlayerStatusEffectState) => void;
  removeLocalPlayerStunned: (id: number) => void;
};

type CoopPvpAbilityLayerProps = {
  localSocketId?: string;
  currentRoomId?: string | null;
  talentLoadout: TalentLoadout | null;
  abilityLoadout: AbilityLoadout | null;
  world: World | null;
  playerEntity: { getComponent: (type: typeof Transform) => Transform | null } | null;
  players: Map<string, { id: string; position: PlayerPosition }>;
  realTimePlayerPositionRef: React.MutableRefObject<Vector3>;
  getLiveCoopEnemyData: () => Array<{ id: string; position: Vector3; health: number }>;
  getEnemyType: (enemyId: string) => string | undefined;
  onSmiteHitEnemy: (enemyId: string, damage: number) => void;
  onDeathGraspHitEnemy: (
    enemyId: string,
    hitPosition: Vector3,
    attackerId: string,
  ) => void;
  onLightningStormHitEnemy: (enemyId: string, damage: number) => void;
  onSmiteBeamEnemyHitColossusGuard?: () => void;
  getVengeanceSmiteDamageMultiplier?: () => number;
};

function RoomBoomMendingEffect({
  position,
  onComplete,
}: {
  position: Vector3;
  onComplete: () => void;
}) {
  const duration = 1.5;
  const timeRef = useRef(0);
  const hasCompletedRef = useRef(false);

  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const ringMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const sphereMesh = useRef<Mesh>(null);
  const sphereMat = useRef<MeshStandardMaterial>(null);
  const particleMeshes = useRef<(Mesh | null)[]>([]);
  const particleMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const lightRef = useRef<PointLight>(null);

  const rings = useMemo(() => [...Array(3)], []);
  const particles = useMemo(() => [...Array(12)], []);

  useFrame((_, delta) => {
    const time = timeRef.current + delta;
    timeRef.current = time;

    const progress = Math.min(1, time / duration);
    const opacity = Math.sin(progress * Math.PI);
    const scale = 1 + progress * 2;

    for (let i = 0; i < 3; i++) {
      const m = ringMeshes.current[i];
      if (m) {
        m.position.y = progress * 2 + i * 0.5;
        m.rotation.z = time * 2;
      }
      const mat = ringMats.current[i];
      if (mat) mat.opacity = opacity * (1 - i * 0.2);
    }

    if (sphereMesh.current) sphereMesh.current.scale.setScalar(scale);
    if (sphereMat.current) sphereMat.current.opacity = opacity * 0.3;

    const radius = 0.75 + progress;
    const yOffset = progress * 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const m = particleMeshes.current[i];
      if (m) {
        m.position.set(
          (Math.cos(angle + time * 2) * radius) / 1.1,
          yOffset + Math.sin(time * 3 + i) * 0.5,
          (Math.sin(angle + time * 2) * radius) / 1.1,
        );
      }
      const mat = particleMats.current[i];
      if (mat) mat.opacity = opacity * 0.8;
    }

    if (lightRef.current) lightRef.current.intensity = 4 * opacity;

    if (time >= duration && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={position.toArray()}>
      {rings.map((_, i) => (
        <mesh
          key={`mending-ring-${i}`}
          ref={(el) => { ringMeshes.current[i] = el; }}
          position={[0, i * 0.5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            ref={(el) => { ringMats.current[i] = el; }}
            color="#88ffaa"
            emissive="#22c95e"
            emissiveIntensity={2}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      <mesh ref={sphereMesh}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          ref={sphereMat}
          color="#aaf8c8"
          emissive="#1db954"
          emissiveIntensity={3}
          transparent
          opacity={0}
        />
      </mesh>

      {particles.map((_, i) => (
        <mesh
          key={`mending-particle-${i}`}
          ref={(el) => { particleMeshes.current[i] = el; }}
        >
          <sphereGeometry args={[0.095, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => { particleMats.current[i] = el; }}
            color="#88ffaa"
            emissive="#22c95e"
            emissiveIntensity={2}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      <pointLight ref={lightRef} color="#22c95e" intensity={0} distance={5} decay={2} />
    </group>
  );
}

const CoopPvpAbilityLayer = memo(forwardRef<CoopPvpAbilityLayerHandle, CoopPvpAbilityLayerProps>(
  function CoopPvpAbilityLayer({
    localSocketId,
    talentLoadout,
    abilityLoadout,
    world,
    playerEntity,
    players,
    realTimePlayerPositionRef,
    getLiveCoopEnemyData,
    getEnemyType,
    onSmiteHitEnemy,
    onDeathGraspHitEnemy,
    onLightningStormHitEnemy,
    onSmiteBeamEnemyHitColossusGuard,
    getVengeanceSmiteDamageMultiplier,
  }, ref) {
    const [pvpSmiteEffects, setPvpSmiteEffects] = useState<PvpSmiteEffectState[]>([]);
    const [lightningStormEffects, setLightningStormEffects] = useState<LightningStormEffectState[]>([]);
    const [pvpWindShearTornadoEffects, setPvpWindShearTornadoEffects] = useState<PvpWindShearTornadoEffectState[]>([]);
    const [pvpWhirlwindRadialWaveEffects, setPvpWhirlwindRadialWaveEffects] = useState<PvpWhirlwindRadialWaveEffectState[]>([]);
    const [pvpDeathGraspEffects, setPvpDeathGraspEffects] = useState<PvpDeathGraspEffectState[]>([]);
    const [pvpHauntedSoulEffects, setPvpHauntedSoulEffects] = useState<PvpHauntedSoulEffectState[]>([]);
    const [breathWeaponEffects, setBreathWeaponEffects] = useState<BreathWeaponEffectState[]>([]);
    const [roomBoomMendingEffects, setRoomBoomMendingEffects] = useState<RoomBoomMendingEffectState[]>([]);
    const [flurryHealingEffects, setFlurryHealingEffects] = useState<FlurryHealingEffectState[]>([]);
    const [localPlayerFrozenEffects, setLocalPlayerFrozenEffects] = useState<LocalPlayerStatusEffectState[]>([]);
    const [localPlayerStunnedEffects, setLocalPlayerStunnedEffects] = useState<LocalPlayerStatusEffectState[]>([]);

    const [, setSmiteDamageNumbers] = useState<SmiteDamageNumber[]>([]);
    const nextDamageNumberId = useRef(0);
    const setDamageNumbers = useCallback((callback: (prev: SmiteDamageNumber[]) => SmiteDamageNumber[]) => {
      setSmiteDamageNumbers(callback);
    }, []);

    const clearAll = useCallback(() => {
      setPvpSmiteEffects([]);
      setLightningStormEffects([]);
      setPvpWindShearTornadoEffects([]);
      setPvpWhirlwindRadialWaveEffects([]);
      setPvpDeathGraspEffects([]);
      setPvpHauntedSoulEffects([]);
      setBreathWeaponEffects([]);
      setRoomBoomMendingEffects([]);
      setFlurryHealingEffects([]);
      setLocalPlayerFrozenEffects([]);
      setLocalPlayerStunnedEffects([]);
      setSmiteDamageNumbers([]);
      nextDamageNumberId.current = 0;
    }, []);

    const addSmite = useCallback((effect: PvpSmiteEffectState) => {
      setPvpSmiteEffects((prev) => [...prev, effect]);
    }, []);
    const removeSmite = useCallback((id: number) => {
      setPvpSmiteEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addLightningStorm = useCallback((effect: LightningStormEffectState) => {
      setLightningStormEffects((prev) => [...prev, effect]);
    }, []);
    const removeLightningStorm = useCallback((id: number) => {
      setLightningStormEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addWindShearTornado = useCallback((effect: PvpWindShearTornadoEffectState) => {
      setPvpWindShearTornadoEffects((prev) => [...prev, effect]);
    }, []);
    const removeWindShearTornado = useCallback((id: number) => {
      setPvpWindShearTornadoEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addWhirlwindRadialWave = useCallback((effect: PvpWhirlwindRadialWaveEffectState) => {
      setPvpWhirlwindRadialWaveEffects((prev) => [...prev, effect]);
    }, []);
    const removeWhirlwindRadialWave = useCallback((id: number) => {
      setPvpWhirlwindRadialWaveEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addDeathGrasp = useCallback((effect: PvpDeathGraspEffectState) => {
      setPvpDeathGraspEffects((prev) => [...prev, effect]);
    }, []);
    const removeDeathGrasp = useCallback((id: number) => {
      setPvpDeathGraspEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addHauntedSoul = useCallback((effect: PvpHauntedSoulEffectState) => {
      setPvpHauntedSoulEffects((prev) => [...prev, effect]);
    }, []);
    const removeHauntedSoul = useCallback((id: number) => {
      setPvpHauntedSoulEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addBreathWeapon = useCallback((effect: BreathWeaponEffectState) => {
      setBreathWeaponEffects((prev) => [...prev, effect]);
    }, []);
    const removeBreathWeapon = useCallback((id: string) => {
      setBreathWeaponEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addRoomBoomMending = useCallback((effect: RoomBoomMendingEffectState) => {
      setRoomBoomMendingEffects((prev) => [...prev, effect]);
    }, []);
    const removeRoomBoomMending = useCallback((id: number) => {
      setRoomBoomMendingEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addFlurryHealing = useCallback((effect: FlurryHealingEffectState) => {
      setFlurryHealingEffects((prev) => [...prev, effect]);
    }, []);
    const removeFlurryHealing = useCallback((id: number) => {
      setFlurryHealingEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addLocalPlayerFrozen = useCallback((effect: LocalPlayerStatusEffectState) => {
      setLocalPlayerFrozenEffects((prev) => [...prev, effect]);
    }, []);
    const removeLocalPlayerFrozen = useCallback((id: number) => {
      setLocalPlayerFrozenEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addLocalPlayerStunned = useCallback((effect: LocalPlayerStatusEffectState) => {
      setLocalPlayerStunnedEffects((prev) => [...prev, effect]);
    }, []);
    const removeLocalPlayerStunned = useCallback((id: number) => {
      setLocalPlayerStunnedEffects((prev) => prev.filter((e) => e.id !== id));
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addSmite,
      removeSmite,
      addLightningStorm,
      removeLightningStorm,
      addWindShearTornado,
      removeWindShearTornado,
      addWhirlwindRadialWave,
      removeWhirlwindRadialWave,
      addDeathGrasp,
      removeDeathGrasp,
      addHauntedSoul,
      removeHauntedSoul,
      addBreathWeapon,
      removeBreathWeapon,
      addRoomBoomMending,
      removeRoomBoomMending,
      addFlurryHealing,
      removeFlurryHealing,
      addLocalPlayerFrozen,
      removeLocalPlayerFrozen,
      addLocalPlayerStunned,
      removeLocalPlayerStunned,
    }), [
      clearAll,
      addSmite,
      removeSmite,
      addLightningStorm,
      removeLightningStorm,
      addWindShearTornado,
      removeWindShearTornado,
      addWhirlwindRadialWave,
      removeWhirlwindRadialWave,
      addDeathGrasp,
      removeDeathGrasp,
      addHauntedSoul,
      removeHauntedSoul,
      addBreathWeapon,
      removeBreathWeapon,
      addRoomBoomMending,
      removeRoomBoomMending,
      addFlurryHealing,
      removeFlurryHealing,
      addLocalPlayerFrozen,
      removeLocalPlayerFrozen,
      addLocalPlayerStunned,
      removeLocalPlayerStunned,
    ]);

    const combatSystem = world?.getSystem(CombatSystem) ?? null;

    return (
      <>
        {pvpSmiteEffects.map((effect) => {
          const smiteEnemyData = getLiveCoopEnemyData().filter((enemy) => enemy.health > 0);

          const isLocalPlayerSmite = !!localSocketId && effect.playerId === localSocketId;
          const loadoutForSmite = talentLoadout;
          const abilityForSmite = abilityLoadout ?? null;
          const infestedSmiteVisual = isLocalPlayerSmite
            ? shouldApplyInfestedSmiteTalent(loadoutForSmite, abilityForSmite)
            : !!effect.infestedSmite;
          const staggeringSmiteVisual = isLocalPlayerSmite
            ? shouldApplyStaggeringSmiteTalent(loadoutForSmite, abilityForSmite)
            : !!effect.staggeringSmite;
          const infernalSmiteVisual = isLocalPlayerSmite
            ? shouldApplyInfernalSmiteTalent(loadoutForSmite, abilityForSmite)
            : !!effect.infernalSmite;

          return (
            <SmiteComponent
              key={`smite-${effect.id}-${infernalSmiteVisual ? 'I' : 'i'}${infestedSmiteVisual ? 'N' : 'n'}${staggeringSmiteVisual ? 'S' : 's'}`}
              weaponType={WeaponType.RUNEBLADE}
              position={effect.position}
              sequenceDelaySec={effect.sequenceDelaySec ?? 0}
              onComplete={() => {
                removeSmite(effect.id);
              }}
              onHit={(targetId, damage) => {
                onSmiteHitEnemy(targetId, damage);
              }}
              onDamageDealt={(totalDamage, meta) => {
                effect.onDamageDealt?.(totalDamage, meta);
              }}
              enemyData={smiteEnemyData}
              setDamageNumbers={setDamageNumbers}
              nextDamageNumberId={nextDamageNumberId}
              combatSystem={combatSystem}
              isCorruptedAuraActive={false}
              infestedSmiteVisual={infestedSmiteVisual}
              staggeringSmiteVisual={staggeringSmiteVisual}
              infernalSmiteVisual={infernalSmiteVisual}
              onBeamEnemyHit={isLocalPlayerSmite ? onSmiteBeamEnemyHitColossusGuard : undefined}
              getVengeanceSmiteDamageMultiplier={
                isLocalPlayerSmite ? getVengeanceSmiteDamageMultiplier : undefined
              }
            />
          );
        })}

        {lightningStormEffects.map((effect) => {
          const lightningOrigin = new Vector3(effect.position.x, effect.position.y, effect.position.z);
          const lightningRange = 10;
          const lightningStormEnemyData = getLiveCoopEnemyData()
            .filter((enemy) => {
              if (enemy.health <= 0) return false;
              return enemy.position.distanceTo(lightningOrigin) <= lightningRange;
            })
            .map((enemy) => {
              const enemyType = getEnemyType(enemy.id);
              return {
                id: enemy.id,
                position: enemy.position,
                health: enemy.health,
                isBoss: enemyType === 'boss' || enemyType === 'boss2' || enemyType === 'boss3',
                isSkeletonMinion: enemyType === 'bossSkeleton',
              };
            });

          return (
            <LightningStorm
              key={`lightning-storm-${effect.id}`}
              weaponType={WeaponType.SPEAR}
              position={effect.position}
              damage={effect.damage}
              staggerToAdd={LIGHTNING_BOLT_ROOM_STAGGER}
              onComplete={() => {
                removeLightningStorm(effect.id);
              }}
              onHit={(targetId, damage) => {
                onLightningStormHitEnemy(targetId, damage);
              }}
              onDamageDealt={(damageDealtFlag) => {
                if (effect.onDamageDealt && damageDealtFlag) {
                  effect.onDamageDealt(damageDealtFlag);
                }
              }}
              enemyData={lightningStormEnemyData}
              setDamageNumbers={setDamageNumbers}
              nextDamageNumberId={nextDamageNumberId}
              combatSystem={combatSystem}
            />
          );
        })}

        {flurryHealingEffects.map((effect) => (
          <FlurryHealingEffect
            key={`flurry-heal-${effect.id}`}
            position={effect.position}
            onComplete={() => {
              removeFlurryHealing(effect.id);
            }}
          />
        ))}

        {pvpWindShearTornadoEffects.map((effect) => {
          const getPlayerPosition = () => {
            const isLocalPlayer = effect.playerId === localSocketId || effect.playerId === 'local';

            if (isLocalPlayer && playerEntity) {
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                return transform.position.clone();
              }
            } else {
              const player = players.get(effect.playerId);
              if (player) {
                return new Vector3(player.position.x, player.position.y, player.position.z);
              }
            }

            return effect.position.clone();
          };

          return (
            <WindShearTornadoEffect
              key={`tornado-${effect.id}`}
              getPlayerPosition={getPlayerPosition}
              startTime={effect.startTime}
              duration={effect.duration}
              onComplete={() => {
                removeWindShearTornado(effect.id);
              }}
            />
          );
        })}

        {pvpDeathGraspEffects.map((effect) => {
          const nearbyEnemies = getLiveCoopEnemyData();

          return (
            <DeathGraspProjectile
              key={`death-grasp-${effect.id}`}
              startPosition={effect.startPosition}
              direction={effect.direction}
              casterId={effect.playerId}
              enemyData={nearbyEnemies}
              onHit={(targetId, hitPosition) => {
                onDeathGraspHitEnemy(targetId, hitPosition, effect.playerId);
              }}
              onComplete={() => {
                removeDeathGrasp(effect.id);
              }}
            />
          );
        })}

        {pvpWhirlwindRadialWaveEffects.map((effect) => {
          const getPlayerPosition = () => {
            const isLocalPlayer = effect.playerId === localSocketId || effect.playerId === 'local';

            if (isLocalPlayer && playerEntity) {
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                return transform.position.clone();
              }
            } else {
              const player = players.get(effect.playerId);
              if (player) {
                return new Vector3(player.position.x, player.position.y, player.position.z);
              }
            }

            return effect.position.clone();
          };

          return (
            <WhirlwindRadialWaveEffect
              key={`radial-wave-${effect.id}`}
              getPlayerPosition={getPlayerPosition}
              startTime={effect.startTime}
              duration={effect.duration}
              onComplete={() => {
                removeWhirlwindRadialWave(effect.id);
              }}
            />
          );
        })}

        {pvpHauntedSoulEffects.map((effect) => (
          <HauntedSoulEffect
            key={effect.id}
            position={effect.position}
            wrathfulStrike={effect.wrathfulStrike}
            infestedStrike={effect.infestedStrike}
            onComplete={() => {
              removeHauntedSoul(effect.id);
            }}
          />
        ))}

        {breathWeaponEffects.map((effect) => (
          <DragonBreath
            key={effect.id}
            position={effect.position}
            direction={effect.direction}
            startTime={effect.startTime}
            wrathfulStrike={effect.wrathfulStrike}
            infestedStrike={effect.infestedStrike}
            wraithGuard={effect.wraithGuard}
            staggeringStrike={effect.staggeringStrike}
            onComplete={() => {
              removeBreathWeapon(effect.id);
            }}
          />
        ))}

        {roomBoomMendingEffects.map((effect) => (
          <RoomBoomMendingEffect
            key={`room-boom-mending-${effect.id}`}
            position={effect.position}
            onComplete={() => removeRoomBoomMending(effect.id)}
          />
        ))}

        {localPlayerFrozenEffects.map((effect) => (
          <FrozenEffect
            key={effect.id}
            position={realTimePlayerPositionRef.current}
            positionRef={realTimePlayerPositionRef}
            duration={effect.duration}
            startTime={effect.startTime}
            onComplete={() => removeLocalPlayerFrozen(effect.id)}
          />
        ))}

        {localPlayerStunnedEffects.map((effect) => (
          <StunnedEffect
            key={effect.id}
            position={realTimePlayerPositionRef.current}
            positionRef={realTimePlayerPositionRef}
            duration={effect.duration}
            startTime={effect.startTime}
            onComplete={() => removeLocalPlayerStunned(effect.id)}
          />
        ))}
      </>
    );
  },
));

CoopPvpAbilityLayer.displayName = 'CoopPvpAbilityLayer';

export default CoopPvpAbilityLayer;
