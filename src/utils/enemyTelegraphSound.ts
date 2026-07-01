import { Vector3 } from 'three';
import type { Socket } from 'socket.io-client';

type Vec3Like = { x: number; y?: number; z: number };

type TelegraphPayload = {
  position?: Vec3Like;
  startPosition?: Vec3Like;
  targetPosition?: Vec3Like;
  origin?: { x: number; z: number };
  targetPositions?: Vec3Like[];
  knightId?: string;
  alliedKnightId?: string;
  ghoulId?: string;
  titanId?: string;
  bossId?: string;
  warlockId?: string;
  weaverId?: string;
  templarId?: string;
  shadeId?: string;
  martyrId?: string;
  skeletonId?: string;
  enemyId?: string;
  viperId?: string;
  zombieId?: string;
  playerZombieId?: string;
};

const ENEMY_ID_KEYS = [
  'knightId',
  'alliedKnightId',
  'ghoulId',
  'titanId',
  'bossId',
  'warlockId',
  'weaverId',
  'templarId',
  'shadeId',
  'martyrId',
  'skeletonId',
  'enemyId',
  'viperId',
  'zombieId',
  'playerZombieId',
] as const;

function toVector3(v: Vec3Like): Vector3 {
  return new Vector3(v.x, v.y ?? 0, v.z);
}

export function resolveTelegraphPosition(
  data: TelegraphPayload,
  getEnemyPosition?: (enemyId: string) => Vec3Like | undefined,
): Vector3 | null {
  if (data.position) return toVector3(data.position);
  if (data.startPosition) return toVector3(data.startPosition);
  if (data.targetPosition) return toVector3(data.targetPosition);
  if (data.origin) return new Vector3(data.origin.x, 0, data.origin.z);
  if (data.targetPositions && data.targetPositions.length > 0) {
    return toVector3(data.targetPositions[0]);
  }

  if (getEnemyPosition) {
    for (const key of ENEMY_ID_KEYS) {
      const id = data[key];
      if (id) {
        const pos = getEnemyPosition(id);
        if (pos) return toVector3(pos);
      }
    }
  }

  return null;
}

function playFromPayload(
  data: TelegraphPayload,
  getEnemyPosition?: (enemyId: string) => Vec3Like | undefined,
  playSound?: (position: Vector3) => void,
) {
  const pos = resolveTelegraphPosition(data, getEnemyPosition);
  if (!pos) return;
  if (playSound) {
    playSound(pos);
  } else {
    (window as any).audioSystem?.playEnemyAttackTelegraphSound(pos);
  }
}

/** Boss 1 ability windups — use dedicated SFX instead of generic telegraph. */
const BOSS1_TELEGRAPH_EVENTS = [
  'boss-attack-telegraph',
  'boss-throw-start',
  'boss-tectonic-spike-telegraph',
  'boss-tectonic-jump',
] as const;

/** Templar blink smite windup — dedicated telegraph before the teleport. */
const TEMPLAR_BLINK_TELEGRAPH_EVENTS = ['templar-blink-smite-charge'] as const;

/** Martyr self-detonation windup — bomb arming SFX while the ground ring is active. */
const MARTYR_ARMING_TELEGRAPH_EVENTS = ['martyr-detonation-telegraph'] as const;

/** High-impact windups only — Knight spin, Warlock casts, Weaver lightning/impale. */
const TELEGRAPH_EVENTS = [
  'knight-spin-charge',
  'warlock-attack-telegraph',
  'warlock-archon-shock',
  'weaver-lightning-telegraph',
  'weaver-impale-spike-telegraph',
] as const;

export interface RegisterEnemyTelegraphSoundsOptions {
  getEnemyPosition?: (enemyId: string) => Vec3Like | undefined;
}

export function registerEnemyAttackTelegraphSounds(
  socket: Socket,
  options: RegisterEnemyTelegraphSoundsOptions = {},
): () => void {
  const { getEnemyPosition } = options;

  const handler = (data: TelegraphPayload) => {
    playFromPayload(data, getEnemyPosition);
  };

  const boss1Handler = (data: TelegraphPayload) => {
    playFromPayload(data, getEnemyPosition, (pos) => {
      (window as any).audioSystem?.playBoss1AbilitySound(pos);
    });
  };

  const templarBlinkHandler = (data: TelegraphPayload) => {
    playFromPayload(data, getEnemyPosition, (pos) => {
      (window as any).audioSystem?.playTemplarBlinkTelegraphSound(pos);
    });
  };

  const martyrArmingHandler = (data: TelegraphPayload) => {
    playFromPayload(data, getEnemyPosition, (pos) => {
      (window as any).audioSystem?.playMartyrArmingSound(pos);
    });
  };

  for (const event of TELEGRAPH_EVENTS) {
    socket.on(event, handler);
  }

  for (const event of BOSS1_TELEGRAPH_EVENTS) {
    socket.on(event, boss1Handler);
  }

  for (const event of TEMPLAR_BLINK_TELEGRAPH_EVENTS) {
    socket.on(event, templarBlinkHandler);
  }

  for (const event of MARTYR_ARMING_TELEGRAPH_EVENTS) {
    socket.on(event, martyrArmingHandler);
  }

  return () => {
    for (const event of TELEGRAPH_EVENTS) {
      socket.off(event, handler);
    }
    for (const event of BOSS1_TELEGRAPH_EVENTS) {
      socket.off(event, boss1Handler);
    }
    for (const event of TEMPLAR_BLINK_TELEGRAPH_EVENTS) {
      socket.off(event, templarBlinkHandler);
    }
    for (const event of MARTYR_ARMING_TELEGRAPH_EVENTS) {
      socket.off(event, martyrArmingHandler);
    }
  };
}
