import type { Socket } from 'socket.io-client';

export type SpectreSpinChargePayload = {
  spectreId: string;
  position?: { x: number; y: number; z: number };
  rotation: number;
  chargeMs?: number;
};

export type SpectreSpinDashPayload = {
  spectreId: string;
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  rotation: number;
  durationMs?: number;
};

export type SpectreSpinLandPayload = {
  spectreId: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  timestamp?: number;
};

export type SpectreAnimationHandlers = {
  onSpinCharge?: (data: SpectreSpinChargePayload) => void;
  onSpinDash?: (data: SpectreSpinDashPayload) => void;
  onSpinLand?: (data: SpectreSpinLandPayload) => void;
};

const registry = new Map<string, SpectreAnimationHandlers>();

export function registerSpectreAnimationHandlers(
  spectreId: string,
  handlers: SpectreAnimationHandlers,
): () => void {
  registry.set(spectreId, handlers);
  return () => {
    if (registry.get(spectreId) === handlers) registry.delete(spectreId);
  };
}

function dispatch<K extends keyof SpectreAnimationHandlers>(
  spectreId: string | undefined,
  key: K,
  data: Parameters<NonNullable<SpectreAnimationHandlers[K]>>[0],
) {
  if (!spectreId) return;
  registry.get(spectreId)?.[key]?.(data as never);
}

export function registerSpectreAnimationSocketListeners(socket: Socket): () => void {
  const onSpinCharge = (data: SpectreSpinChargePayload) => {
    dispatch(data.spectreId, 'onSpinCharge', data);
  };
  const onSpinDash = (data: SpectreSpinDashPayload) => {
    dispatch(data.spectreId, 'onSpinDash', data);
  };
  const onSpinLand = (data: SpectreSpinLandPayload) => {
    dispatch(data.spectreId, 'onSpinLand', data);
  };

  socket.on('spectre-spin-charge', onSpinCharge);
  socket.on('spectre-spin-dash', onSpinDash);
  socket.on('spectre-spin-land', onSpinLand);

  return () => {
    socket.off('spectre-spin-charge', onSpinCharge);
    socket.off('spectre-spin-dash', onSpinDash);
    socket.off('spectre-spin-land', onSpinLand);
  };
}
