import type { Socket } from 'socket.io-client';
import { createIdRoutedSocketDispatcher } from '@/utils/enemySocketDispatch';

export type WolfHowlStartPayload = {
  wolfId?: string;
  durationMs?: number;
};

export type WolfAttackTelegraphPayload = {
  wolfId?: string;
  beastId?: string;
  attackVariant?: 1 | 2;
  hitDelayMs?: number;
  swingLockMs?: number;
  attackRange?: number;
  arcDeg?: number;
  facing?: number;
  weightClass?: string;
  timestamp?: number;
};

export type WolfAttackWhiffPayload = {
  wolfId?: string;
  beastId?: string;
};

export type WolfAnimationHandlers = {
  onHowlStart?: (data: WolfHowlStartPayload) => void;
  onAttackTelegraph?: (data: WolfAttackTelegraphPayload) => void;
  onAttackWhiff?: (data: WolfAttackWhiffPayload) => void;
};

const { register, dispatch } = createIdRoutedSocketDispatcher<WolfAnimationHandlers>();

export function registerWolfAnimationHandlers(
  wolfId: string,
  handlers: WolfAnimationHandlers,
): () => void {
  return register(wolfId, handlers);
}

function resolveWolfId(data: { wolfId?: string; beastId?: string }): string | undefined {
  return data.wolfId ?? data.beastId;
}

/** One socket listener per wolf animation event; routes to per-wolf handlers by id. */
export function registerWolfAnimationSocketListeners(socket: Socket): () => void {
  const onHowlStart = (data: WolfHowlStartPayload) => {
    dispatch(data.wolfId, 'onHowlStart', data);
  };
  const onAttackTelegraph = (data: WolfAttackTelegraphPayload) => {
    dispatch(resolveWolfId(data), 'onAttackTelegraph', data);
  };
  const onAttackWhiff = (data: WolfAttackWhiffPayload) => {
    dispatch(resolveWolfId(data), 'onAttackWhiff', data);
  };

  socket.on('wolf-howl-start', onHowlStart);
  socket.on('wolf-attack-telegraph', onAttackTelegraph);
  socket.on('allied-wolf-attack-telegraph', onAttackTelegraph);
  socket.on('wolf-attack-whiff', onAttackWhiff);

  return () => {
    socket.off('wolf-howl-start', onHowlStart);
    socket.off('wolf-attack-telegraph', onAttackTelegraph);
    socket.off('allied-wolf-attack-telegraph', onAttackTelegraph);
    socket.off('wolf-attack-whiff', onAttackWhiff);
  };
}
