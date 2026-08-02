import type { Socket } from 'socket.io-client';

export type AssassinSpinChargePayload = {
  assassinId: string;
  position?: { x: number; y: number; z: number };
  rotation: number;
  chargeMs?: number;
};

export type AssassinSpinDashPayload = {
  assassinId: string;
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  rotation: number;
  durationMs?: number;
};

export type AssassinEvadePayload = {
  assassinId: string;
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  rotation: number;
  durationMs?: number;
};

export type AssassinAnimationHandlers = {
  onSpinCharge?: (data: AssassinSpinChargePayload) => void;
  onSpinDash?: (data: AssassinSpinDashPayload) => void;
  onEvade?: (data: AssassinEvadePayload) => void;
};

const registry = new Map<string, AssassinAnimationHandlers>();

export function registerAssassinAnimationHandlers(
  assassinId: string,
  handlers: AssassinAnimationHandlers,
): () => void {
  registry.set(assassinId, handlers);
  return () => {
    if (registry.get(assassinId) === handlers) {
      registry.delete(assassinId);
    }
  };
}

function dispatch<K extends keyof AssassinAnimationHandlers>(
  assassinId: string | undefined,
  key: K,
  data: Parameters<NonNullable<AssassinAnimationHandlers[K]>>[0],
) {
  if (!assassinId) return;
  registry.get(assassinId)?.[key]?.(data as never);
}

/** One socket listener per assassin animation event; routes to per-assassin handlers by id. */
export function registerAssassinAnimationSocketListeners(socket: Socket): () => void {
  const onSpinCharge = (data: AssassinSpinChargePayload) => {
    dispatch(data.assassinId, 'onSpinCharge', data);
  };
  const onSpinDash = (data: AssassinSpinDashPayload) => {
    dispatch(data.assassinId, 'onSpinDash', data);
  };
  const onEvade = (data: AssassinEvadePayload) => {
    dispatch(data.assassinId, 'onEvade', data);
  };

  socket.on('assassin-spin-charge', onSpinCharge);
  socket.on('assassin-spin-dash', onSpinDash);
  socket.on('assassin-evade', onEvade);

  return () => {
    socket.off('assassin-spin-charge', onSpinCharge);
    socket.off('assassin-spin-dash', onSpinDash);
    socket.off('assassin-evade', onEvade);
  };
}
