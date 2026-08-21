import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';

export type ExploreTowerAttackEvent = {
  towerId: string;
  kind: 'bolt' | 'arrow';
  origin?: { x: number; y: number; z: number };
  impact?: { x: number; y: number; z: number };
  targetId?: string;
  damage?: number;
};

type Handler = (data: ExploreTowerAttackEvent) => void;

const handlers = new Map<string, Handler>();

export function subscribeExploreTowerAttack(towerId: string, handler: Handler): () => void {
  handlers.set(towerId, handler);
  return () => {
    if (handlers.get(towerId) === handler) handlers.delete(towerId);
  };
}

export function dispatchExploreTowerAttack(data: ExploreTowerAttackEvent): void {
  const handler = handlers.get(data.towerId);
  if (handler) handler(data);
}

export function useRelayDefenseTowerAttacks(socket: Socket | null): void {
  useEffect(() => {
    if (!socket) return;
    const onAttack = (data: ExploreTowerAttackEvent) => {
      dispatchExploreTowerAttack(data);
    };
    socket.on('defense-tower-attack', onAttack);
    return () => {
      socket.off('defense-tower-attack', onAttack);
    };
  }, [socket]);
}
