'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { Socket } from 'socket.io-client';
import AvalancheEffect from './AvalancheEffect';
import { FROST_QUEEN_ICE_STORM_CHANNEL_MS } from '@/utils/frostQueenCoopAbilitiesConstants';

export type FrostQueenIceStormDebuff = {
  id: string;
  frostQueenId: string;
  targetPlayerId: string;
  expiresAtMs: number;
};

type PlayerPos = { id: string; position: Vector3; health: number };

interface FrostQueenPlayerIceStormManagerProps {
  socket: Socket | null;
  getPlayerPositions: () => PlayerPos[];
}

/**
 * VFX-only: Avalanche particles follow the Ice Storm target player.
 * Damage is server-authoritative via frost-queen-ice-storm-tick → player-damaged.
 */
export default function FrostQueenPlayerIceStormManager({
  socket,
  getPlayerPositions,
}: FrostQueenPlayerIceStormManagerProps) {
  const [debuffs, setDebuffs] = useState<FrostQueenIceStormDebuff[]>([]);
  const debuffsRef = useRef(debuffs);
  debuffsRef.current = debuffs;
  const groupRefs = useRef<Map<string, Group>>(new Map());
  const scratchPos = useRef(new Vector3());
  const getPlayerPositionsRef = useRef(getPlayerPositions);
  getPlayerPositionsRef.current = getPlayerPositions;

  const endStorm = useCallback((frostQueenId: string) => {
    setDebuffs((prev) => prev.filter((d) => d.frostQueenId !== frostQueenId));
    groupRefs.current.delete(frostQueenId);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleStart = (data: {
      frostQueenId: string;
      targetPlayerId: string;
      channelMs?: number;
    }) => {
      const now = Date.now();
      const channelMs = data.channelMs ?? FROST_QUEEN_ICE_STORM_CHANNEL_MS;
      setDebuffs((prev) => {
        const without = prev.filter((d) => d.frostQueenId !== data.frostQueenId);
        return [
          ...without,
          {
            id: `fq-ice-storm-${data.frostQueenId}-${now}`,
            frostQueenId: data.frostQueenId,
            targetPlayerId: data.targetPlayerId,
            expiresAtMs: now + channelMs,
          },
        ];
      });
    };

    const handleEnd = (data: { frostQueenId: string }) => {
      endStorm(data.frostQueenId);
    };

    socket.on('frost-queen-ice-storm-start', handleStart);
    socket.on('frost-queen-ice-storm-end', handleEnd);
    return () => {
      socket.off('frost-queen-ice-storm-start', handleStart);
      socket.off('frost-queen-ice-storm-end', handleEnd);
    };
  }, [socket, endStorm]);

  useFrame(() => {
    const now = Date.now();
    const active = debuffsRef.current;
    if (active.length === 0) return;

    const positions = getPlayerPositionsRef.current();
    let needsPrune = false;

    for (const d of active) {
      if (now >= d.expiresAtMs) {
        needsPrune = true;
        continue;
      }

      const player = positions.find((p) => p.id === d.targetPlayerId);
      if (!player || player.health <= 0) {
        needsPrune = true;
        continue;
      }

      const group = groupRefs.current.get(d.frostQueenId);
      if (group) {
        scratchPos.current.copy(player.position);
        group.position.copy(scratchPos.current);
      }
    }

    if (needsPrune) {
      setDebuffs((prev) =>
        prev.filter((d) => {
          if (now >= d.expiresAtMs) return false;
          const player = positions.find((p) => p.id === d.targetPlayerId);
          return !!(player && player.health > 0);
        }),
      );
    }
  });

  return (
    <>
      {debuffs.map((d) => (
        <group
          key={d.id}
          ref={(el) => {
            if (el) groupRefs.current.set(d.frostQueenId, el);
            else groupRefs.current.delete(d.frostQueenId);
          }}
        >
          <AvalancheEffect />
        </group>
      ))}
    </>
  );
}
