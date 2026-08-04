import { Vector3 } from 'three';
import type { Socket } from 'socket.io-client';

type Vec3Like = { x: number; y?: number; z: number };

type BeastAudioOptions = {
  getEnemyPosition?: (enemyId: string) => Vec3Like | undefined;
};

function toVector3(v: Vec3Like | undefined | null, fallback?: Vec3Like): Vector3 {
  const src = v ?? fallback ?? { x: 0, y: 0, z: 0 };
  return new Vector3(src.x, src.y ?? 0, src.z);
}

function resolveBeastPosition(
  data: { position?: Vec3Like; beastId?: string; wyvernId?: string },
  getEnemyPosition?: (enemyId: string) => Vec3Like | undefined,
): Vector3 {
  if (data.position) return toVector3(data.position);
  const id = data.beastId || data.wyvernId;
  if (id && getEnemyPosition) {
    const pos = getEnemyPosition(id);
    if (pos) return toVector3(pos);
  }
  return new Vector3(0, 0, 0);
}

/**
 * Registers socket listeners for beast combat SFX (aggro, melee hit chance,
 * wolf pack howls, wyvern breath attack/roar). Returns an unregister callback.
 */
export function registerBeastAudioSounds(
  socket: Socket,
  options: BeastAudioOptions = {},
): () => void {
  const { getEnemyPosition } = options;
  /** Deduplicate regular-breath attack SFX if multiple firebolts somehow share a cast. */
  const wyvernBreathAttackPlayed = new Set<string>();

  const handleBeastAggro = (data: {
    beastKind?: 'tiger' | 'serpent' | 'wyvern' | 'bear';
    beastId?: string;
    position?: Vec3Like;
  }) => {
    const kind = data.beastKind;
    if (kind !== 'tiger' && kind !== 'serpent' && kind !== 'wyvern' && kind !== 'bear') return;
    const pos = resolveBeastPosition(data, getEnemyPosition);
    window.audioSystem?.playBeastAggroSound(kind, pos);
  };

  const handleBeastAttackSfx = (data: {
    soundId?: string;
    beastId?: string;
    position?: Vec3Like;
    isAlliedPet?: boolean;
  }) => {
    if (!data.soundId) return;
    const pos = resolveBeastPosition(data, getEnemyPosition);
    // Allied pet melee vocals: −40% vs default beast attack volume (0.85 → 0.51).
    const volume =
      data.isAlliedPet &&
      (data.soundId === 'beast_tiger_attack' ||
        data.soundId === 'beast_wolf_attack1' ||
        data.soundId === 'beast_wolf_attack2' ||
        data.soundId === 'beast_serpent_attack' ||
        data.soundId === 'beast_bear_attack1')
        ? 0.85 * 0.6
        : undefined;
    window.audioSystem?.playBeastAttackSound(
      data.soundId,
      pos,
      volume != null ? { volume } : undefined,
    );
  };

  const handleWolfPackHowls = (data: { position?: Vec3Like }) => {
    const pos = toVector3(data.position);
    window.audioSystem?.playWolfPackHowlsSound(pos);
  };

  const handleWyvernBreathTelegraph = (data: {
    wyvernId?: string;
    breathVariant?: number;
    position?: Vec3Like;
  }) => {
    if (!data.wyvernId) return;
    wyvernBreathAttackPlayed.delete(data.wyvernId);
    if (data.breathVariant !== 2) return;
    const pos = resolveBeastPosition(
      { wyvernId: data.wyvernId, position: data.position },
      getEnemyPosition,
    );
    window.audioSystem?.playBeastWyvernRoarSound(pos);
  };

  const handleWyvernBreathFirebolt = (data: {
    wyvernId?: string;
    breathVariant?: number;
    startPosition?: Vec3Like;
  }) => {
    if (!data.wyvernId) return;
    // Regular firebolt (drake_attack2) — play once per cast. Roar volley uses roar SFX on telegraph.
    if (data.breathVariant === 2) return;
    if (wyvernBreathAttackPlayed.has(data.wyvernId)) return;
    wyvernBreathAttackPlayed.add(data.wyvernId);
    const pos = toVector3(data.startPosition, getEnemyPosition?.(data.wyvernId));
    window.audioSystem?.playBeastWyvernAttackSound(pos);
  };

  const handleWyvernBreathEnd = (data: { wyvernId?: string }) => {
    if (data.wyvernId) wyvernBreathAttackPlayed.delete(data.wyvernId);
  };

  socket.on('beast-aggro', handleBeastAggro);
  socket.on('beast-attack-sfx', handleBeastAttackSfx);
  socket.on('wolf-pack-howls', handleWolfPackHowls);
  socket.on('wyvern-breath-telegraph', handleWyvernBreathTelegraph);
  socket.on('wyvern-breath-firebolt', handleWyvernBreathFirebolt);
  socket.on('wyvern-breath-end', handleWyvernBreathEnd);

  return () => {
    socket.off('beast-aggro', handleBeastAggro);
    socket.off('beast-attack-sfx', handleBeastAttackSfx);
    socket.off('wolf-pack-howls', handleWolfPackHowls);
    socket.off('wyvern-breath-telegraph', handleWyvernBreathTelegraph);
    socket.off('wyvern-breath-firebolt', handleWyvernBreathFirebolt);
    socket.off('wyvern-breath-end', handleWyvernBreathEnd);
  };
}

/** Vengeful Spirit (Abysslick) melee hits use scythe impact SFX (not beast vocals). */
export function playVengefulSpiritHitSound(position: Vector3 | Vec3Like) {
  const pos = toVector3(position);
  window.audioSystem?.playMeleeImpactByWeightClass('beast', pos);
}
