import type { Socket } from 'socket.io-client';

export type ValkyrieLungeChargePayload = {
  valkyrieId: string;
  variant?: 1 | 2;
  position?: { x: number; y: number; z: number };
  rotation: number;
  chargeMs?: number;
};

export type ValkyrieLungeDashPayload = {
  valkyrieId: string;
  variant?: 1 | 2;
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  rotation: number;
  durationMs?: number;
};

export type ValkyrieAnimationHandlers = {
  onLungeCharge?: (data: ValkyrieLungeChargePayload) => void;
  onLungeDash?: (data: ValkyrieLungeDashPayload) => void;
};

const registry = new Map<string, ValkyrieAnimationHandlers>();

export function registerValkyrieAnimationHandlers(
  valkyrieId: string,
  handlers: ValkyrieAnimationHandlers,
): () => void {
  registry.set(valkyrieId, handlers);
  return () => {
    if (registry.get(valkyrieId) === handlers) registry.delete(valkyrieId);
  };
}

function dispatch<K extends keyof ValkyrieAnimationHandlers>(
  valkyrieId: string | undefined,
  key: K,
  data: Parameters<NonNullable<ValkyrieAnimationHandlers[K]>>[0],
) {
  if (!valkyrieId) return;
  registry.get(valkyrieId)?.[key]?.(data as never);
}

export function registerValkyrieAnimationSocketListeners(socket: Socket): () => void {
  const onLungeCharge = (data: ValkyrieLungeChargePayload) => {
    dispatch(data.valkyrieId, 'onLungeCharge', data);
  };
  const onLungeDash = (data: ValkyrieLungeDashPayload) => {
    dispatch(data.valkyrieId, 'onLungeDash', data);
  };

  socket.on('valkyrie-lunge-charge', onLungeCharge);
  socket.on('valkyrie-lunge-dash', onLungeDash);

  return () => {
    socket.off('valkyrie-lunge-charge', onLungeCharge);
    socket.off('valkyrie-lunge-dash', onLungeDash);
  };
}
