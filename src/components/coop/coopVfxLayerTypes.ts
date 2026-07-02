import { Vector3 } from '@/utils/three-exports';
import type { LeapShockwaveVariant } from '@/components/enemies/BossLeapShockwave';
import type { Boss3NovaBurst } from '@/components/enemies/Boss3NovaDiscs';
import type { DeathFlashScale } from '@/components/enemies/DeathFlashExplosion';
import type { TitanStompShockwaveBurst } from '@/components/enemies/TitanStompShockwave';
import type { KnightSmiteLightningVariant } from '@/components/enemies/KnightSmiteLightning';

export type { Boss3NovaBurst, DeathFlashScale, TitanStompShockwaveBurst, KnightSmiteLightningVariant };

export interface BossLeapShockwaveState {
  id: string;
  x: number;
  z: number;
  variant: LeapShockwaveVariant;
}

export interface BossSpearState {
  id: string;
  bossId: string;
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
}

export interface MeteorState {
  id: string;
  targetPosition: Vector3;
  timestamp: number;
  damage?: number;
  sourceEnemyId?: string;
  startPosition?: Vector3;
}

export interface DualityBlizzardState {
  id: string;
  position: Vector3;
  durationMs: number;
  tickMs: number;
  radius: number;
}

export interface KnightFrostProjectileState {
  id: string;
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
}

export interface ShadeDaggerState {
  id: string;
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  soulType?: string;
  daggerIndex: number;
}

export interface WarlockProjectileState {
  id: string;
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  warlockId: string;
}

export interface WarlockFlameStrikeState {
  id: string;
  position: Vector3;
}

export interface ViperArrowState {
  id: string;
  shotId?: string;
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
}

export interface WeaverLightningState {
  id: string;
  weaverId: string;
  targetPosition: Vector3;
  strikeAt: number;
  damage: number;
  radius: number;
  theme: 'blue' | 'green';
}

export interface RoomBoomFlameStrikeState {
  id: number;
  position: Vector3;
}

export interface RoomBoomFrostNovaState {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
}

export interface CrossentropyMeteorState {
  id: string;
  targetPosition: Vector3;
  timestamp: number;
  damage?: number;
  startPosition?: Vector3;
}

export interface CloudkillArrowState {
  id: string;
  targetPosition: Vector3;
  timestamp: number;
  delayMs?: number;
  startPosition?: Vector3;
}

export interface KnightDeathGraspProjectileState {
  id: string;
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
  telegraphId?: string;
}

export interface GreedFireballState {
  id: string;
  startPosition: Vector3;
  targetPosition: Vector3;
  greedId: string;
}

export interface BossLeapTelegraphState {
  id: string;
  x: number;
  y: number;
  z: number;
  durationMs: number;
}

export interface MobLeapTelegraphState extends BossLeapTelegraphState {
  theme: 'boss' | 'templar';
}

export interface ViperShotTelegraphState {
  id: string;
  start: Vector3;
  end: Vector3;
  endAt: number;
  startedAt: number;
}

export interface TentacleSpineTelegraphState {
  id: string;
  enemyId: string;
  start: Vector3;
  end: Vector3;
  endAt?: number;
  startedAt?: number;
}

export interface BossTectonicTelegraphState {
  id: string;
  x: number;
  y: number;
  z: number;
  durationMs: number;
}

export interface WeaverImpaleTelegraphState {
  id: string;
  x: number;
  y: number;
  z: number;
  durationMs: number;
  theme: 'blue' | 'green';
}

export interface MartyrDetonationTelegraphState {
  id: string;
  martyrId: string;
  position: Vector3;
  endAt: number;
}

export interface TitanCannonAbilityState {
  id: string;
  soulType: 'green' | 'red' | 'blue' | 'purple';
  origin: Vector3;
  rotation: number;
  range: number;
  halfWidth: number;
  strikeAt: number;
}

export interface BossTectonicSpikeState {
  id: string;
  position: Vector3;
}

export interface TectonicSpikeGroundCrackState {
  id: string;
  x: number;
  y: number;
  z: number;
  seed: string;
  durationMs: number;
}

export interface WeaverImpaleSpikeState {
  id: string;
  position: Vector3;
  theme: 'blue' | 'green';
}



export interface WarlockVoidBoltExplosionState {
  id: string;
  position: Vector3;
}

export interface MartyrDetonationExplosionState {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
}

export interface FissionDetonationState {
  id: string;
  position: Vector3;
}


export interface DeathFlashExplosionState {
  id: string;
  position: { x: number; y: number; z: number };
  scale: DeathFlashScale;
}

export interface TeleportEffectState {
  id: string;
  position: Vector3;
  type: 'start' | 'end';
  timestamp: number;
}

export interface TemplarBlinkSmiteStrikeState {
  id: string;
  position: Vector3;
  timestamp: number;
}

export interface Boss2ArchonLightningState {
  id: string;
  beams: { startPosition: Vector3; targetPosition: Vector3 }[];
  strikeAt: number;
  halfWidth: number;
}

export interface StaggerProcEffectState {
  id: string;
  position: Vector3;
  magmaCurrent?: boolean;
  forceOfNature?: boolean;
}


export interface KnightSmiteLightningState {
  id: string;
  position: Vector3;
  variant?: KnightSmiteLightningVariant;
  widthScale?: number;
}

export interface RoomBoomLightningEffectState {
  id: number;
  from: Vector3;
  to: Vector3;
}

export interface GreedEmberZoneState {
  id: string;
  position: Vector3;
  radius: number;
  durationMs: number;
}

export interface WarlockMeteorEmberZoneState {
  id: string;
  position: Vector3;
  radius: number;
  durationMs: number;
}

export interface MistEffectState {
  id: string;
  position: Vector3;
  startTime: number;
}

export interface KnightDeathVortexState {
  id: string;
  position: { x: number; y: number; z: number };
  soulType?: 'red' | 'purple' | 'green' | 'blue' | null;
}

export interface GhoulSummonRitualState {
  id: string;
  position: Vector3;
}

export interface InfestedZombieSummonVfxState {
  id: string;
  position: Vector3;
}

export interface ExploderStrainVenomVfxState {
  id: string;
  position: Vector3;
}

export interface EnemySummonFlameVfxState {
  id: string;
  position: Vector3;
}

export interface WeaverHealEffectState {
  id: string;
  position: Vector3;
}

export interface GreaterHealBeamState {
  id: string;
  position: Vector3;
  targetKind?: 'player' | 'ally';
  targetId?: string;
}

export interface KnightFrostImpactState {
  id: string;
  position: Vector3;
}

export interface PlayerHitBurstState {
  id: string;
  position: Vector3;
  damageType?: string;
  intensity: number;
}

export interface GoldCollectMoteState {
  id: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
}

export interface MushroomEruptionFxState {
  id: string;
  pos: Vector3;
}

export interface DeathEffectState {
  playerId: string;
  position: Vector3;
  startTime: number;
}

export interface LocalPlayerStatusEffectState {
  id: number;
  startTime: number;
  duration: number;
}

export interface RoomBoomMendingEffectState {
  id: number;
  position: Vector3;
}

export interface EnemyTauntEffectState {
  id: number;
  enemyId: string;
  startTime: number;
  duration: number;
}

export interface TentacleSpineFxState {
  windSeq: number;
  slamSeq: number;
  dir: { x: number; z: number };
}
