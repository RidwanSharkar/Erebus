import type { Socket } from 'socket.io-client';

export type SkeletonMovePayload = {
  position: { x: number; y: number; z: number };
  rotation: number;
};

export type SkeletonMoveHandler = (data: SkeletonMovePayload) => void;

const registry = new Map<string, SkeletonMoveHandler>();

/**
 * Register a per-skeleton move handler. One central socket listener fans out
 * `enemies-moved` / `enemy-moved` to handlers by id (O(batch) instead of O(N×batch)).
 */
export function registerSkeletonMoveHandler(
  skeletonId: string,
  handler: SkeletonMoveHandler,
): () => void {
  registry.set(skeletonId, handler);
  return () => {
    if (registry.get(skeletonId) === handler) {
      registry.delete(skeletonId);
    }
  };
}

/** One socket listener for all summoned boss skeletons — routes moves by enemyId. */
export function registerSkeletonMoveSocketListeners(socket: Socket): () => void {
  const onBatchedMove = (data: {
    moves?: Array<{ enemyId: string; position: { x: number; y: number; z: number }; rotation: number }>;
  }) => {
    if (!data?.moves || registry.size === 0) return;
    for (const move of data.moves) {
      const handler = registry.get(move.enemyId);
      if (handler) {
        handler({ position: move.position, rotation: move.rotation });
      }
    }
  };

  const onEnemyMove = (data: {
    enemyId?: string;
    position: { x: number; y: number; z: number };
    rotation: number;
  }) => {
    if (!data?.enemyId) return;
    registry.get(data.enemyId)?.({ position: data.position, rotation: data.rotation });
  };

  socket.on('enemies-moved', onBatchedMove);
  socket.on('enemy-moved', onEnemyMove);

  return () => {
    socket.off('enemies-moved', onBatchedMove);
    socket.off('enemy-moved', onEnemyMove);
  };
}
