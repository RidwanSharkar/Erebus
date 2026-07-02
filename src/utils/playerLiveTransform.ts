import type { MutableRefObject } from 'react';
import type { Player, PlayerMovementDirection } from '@/contexts/MultiplayerContext';

export interface PlayerLiveTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  movementDirection?: PlayerMovementDirection;
}

export type PlayerTransformsRef = MutableRefObject<Map<string, PlayerLiveTransform>>;

/** Apply a single server player move to the ref store (no React setState). */
export function applyPlayerMove(
  transformsRef: PlayerTransformsRef,
  playersRef: MutableRefObject<Map<string, Player>>,
  data: {
    playerId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    movementDirection?: PlayerMovementDirection;
  },
): void {
  const existing = transformsRef.current.get(data.playerId);
  if (existing) {
    existing.position = data.position;
    existing.rotation = data.rotation;
    if (data.movementDirection !== undefined) {
      existing.movementDirection = data.movementDirection;
    }
  } else {
    transformsRef.current.set(data.playerId, {
      position: data.position,
      rotation: data.rotation,
      movementDirection: data.movementDirection,
    });
  }

  const player = playersRef.current.get(data.playerId);
  if (player) {
    player.position = data.position;
    player.rotation = data.rotation;
    if (data.movementDirection !== undefined) {
      player.movementDirection = data.movementDirection;
    }
  }
}

/** Resolve live position for targeting (falls back to stale React state). */
export function getPlayerLivePosition(
  playerId: string,
  transformsRef: PlayerTransformsRef,
  fallback?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const live = transformsRef.current.get(playerId);
  if (live) return live.position;
  return fallback ?? { x: 0, y: 0, z: 0 };
}

/** Resolve live rotation (falls back to stale React state). */
export function getPlayerLiveRotation(
  playerId: string,
  transformsRef: PlayerTransformsRef,
  fallback?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const live = transformsRef.current.get(playerId);
  if (live) return live.rotation;
  return fallback ?? { x: 0, y: 0, z: 0 };
}
