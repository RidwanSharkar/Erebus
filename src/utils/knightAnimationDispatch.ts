import type { Socket } from 'socket.io-client';

export type KnightDashPayload = {
  knightId: string;
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  rotation: number;
  durationMs?: number;
};

export type KnightSpinChargePayload = {
  knightId: string;
  position?: { x: number; y: number; z: number };
  rotation: number;
  chargeMs?: number;
};

export type KnightSpinDashPayload = KnightDashPayload;

export type KnightBlockTelegraphPayload = {
  knightId: string;
  durationMs: number;
  startBlockMs?: number;
};

export type KnightAnimationHandlers = {
  onAttackTelegraph?: (data: { knightId: string }) => void;
  onDash?: (data: KnightDashPayload) => void;
  onSpinCharge?: (data: KnightSpinChargePayload) => void;
  onSpinDash?: (data: KnightSpinDashPayload) => void;
  onSmiteTelegraph?: (data: { knightId: string }) => void;
  onHealTelegraph?: (data: { knightId: string }) => void;
  onFrostTelegraph?: (data: { knightId: string }) => void;
  onStormLashTelegraph?: (data: { knightId: string }) => void;
  onStormLashZap?: (data: { knightId: string }) => void;
  onDeathGraspTelegraph?: (data: { knightId: string }) => void;
  onBlockTelegraph?: (data: KnightBlockTelegraphPayload) => void;
};

const registry = new Map<string, KnightAnimationHandlers>();

export function registerKnightAnimationHandlers(
  knightId: string,
  handlers: KnightAnimationHandlers,
): () => void {
  registry.set(knightId, handlers);
  return () => {
    if (registry.get(knightId) === handlers) {
      registry.delete(knightId);
    }
  };
}

function dispatch<K extends keyof KnightAnimationHandlers>(
  knightId: string | undefined,
  key: K,
  data: Parameters<NonNullable<KnightAnimationHandlers[K]>>[0],
) {
  if (!knightId) return;
  registry.get(knightId)?.[key]?.(data as never);
}

/** One socket listener per knight animation event; routes to per-knight handlers by id. */
export function registerKnightAnimationSocketListeners(socket: Socket): () => void {
  const onAttackTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onAttackTelegraph', data);
  };
  const onDash = (data: KnightDashPayload) => {
    dispatch(data.knightId, 'onDash', data);
  };
  const onSpinCharge = (data: KnightSpinChargePayload) => {
    dispatch(data.knightId, 'onSpinCharge', data);
  };
  const onSpinDash = (data: KnightSpinDashPayload) => {
    dispatch(data.knightId, 'onSpinDash', data);
  };
  const onSmiteTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onSmiteTelegraph', data);
  };
  const onHealTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onHealTelegraph', data);
  };
  const onFrostTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onFrostTelegraph', data);
  };
  const onStormLashTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onStormLashTelegraph', data);
  };
  const onStormLashZap = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onStormLashZap', data);
  };
  const onDeathGraspTelegraph = (data: { knightId: string }) => {
    dispatch(data.knightId, 'onDeathGraspTelegraph', data);
  };
  const onBlockTelegraph = (data: KnightBlockTelegraphPayload) => {
    dispatch(data.knightId, 'onBlockTelegraph', data);
  };

  socket.on('knight-attack-telegraph', onAttackTelegraph);
  socket.on('allied-knight-attack-telegraph', onAttackTelegraph);
  socket.on('knight-dash', onDash);
  socket.on('knight-spin-charge', onSpinCharge);
  socket.on('knight-spin-dash', onSpinDash);
  socket.on('knight-smite-telegraph', onSmiteTelegraph);
  socket.on('knight-heal-telegraph', onHealTelegraph);
  socket.on('knight-frost-telegraph', onFrostTelegraph);
  socket.on('knight-stormlash-telegraph', onStormLashTelegraph);
  socket.on('knight-storm-lash-zap', onStormLashZap);
  socket.on('knight-deathgrasp-telegraph', onDeathGraspTelegraph);
  socket.on('knight-block-telegraph', onBlockTelegraph);

  return () => {
    socket.off('knight-attack-telegraph', onAttackTelegraph);
    socket.off('allied-knight-attack-telegraph', onAttackTelegraph);
    socket.off('knight-dash', onDash);
    socket.off('knight-spin-charge', onSpinCharge);
    socket.off('knight-spin-dash', onSpinDash);
    socket.off('knight-smite-telegraph', onSmiteTelegraph);
    socket.off('knight-heal-telegraph', onHealTelegraph);
    socket.off('knight-frost-telegraph', onFrostTelegraph);
    socket.off('knight-stormlash-telegraph', onStormLashTelegraph);
    socket.off('knight-storm-lash-zap', onStormLashZap);
    socket.off('knight-deathgrasp-telegraph', onDeathGraspTelegraph);
    socket.off('knight-block-telegraph', onBlockTelegraph);
  };
}
