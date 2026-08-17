'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import { sanitizeRoomCode } from '@/utils/roomCode';

type RoomListEntry = {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  gameStarted: boolean;
  gameMode: string;
  inThronePrep: boolean;
};

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    if (!taken.has(code)) return code;
  }
  return sanitizeRoomCode(`R${Date.now().toString(36).toUpperCase()}`) || 'ROOM';
}

function roomStatus(room: RoomListEntry): { label: string; className: string } {
  if (room.inThronePrep) {
    return {
      label: 'Preparing',
      className: 'border-amber-400/40 bg-amber-950/40 text-amber-300',
    };
  }
  if (room.gameStarted) {
    return {
      label: 'In session',
      className: 'border-rose-400/40 bg-rose-950/40 text-rose-300',
    };
  }
  return {
    label: 'Open',
    className: 'border-green-400/40 bg-green-950/40 text-green-300',
  };
}

interface SettingsPanelProps {
  currentRoomId: string | null;
  gameStarted?: boolean;
  onClose: () => void;
  onSwitchRoom: (roomId: string, options?: { expectExisting?: boolean }) => Promise<unknown> | unknown;
  onEndGame?: () => void;
}

export default function SettingsPanel({
  currentRoomId,
  gameStarted = false,
  onClose,
  onSwitchRoom,
  onEndGame,
}: SettingsPanelProps) {
  const { socket } = useMultiplayerActions();
  const [rooms, setRooms] = useState<RoomListEntry[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [createNameError, setCreateNameError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [endingGame, setEndingGame] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleList = (data: { rooms?: RoomListEntry[] }) => {
      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
    };

    socket.on('rooms-list', handleList);
    const request = () => {
      socket.emit('list-rooms');
    };
    request();
    const interval = window.setInterval(request, 3000);

    return () => {
      socket.off('rooms-list', handleList);
      window.clearInterval(interval);
    };
  }, [socket]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const switchOrShowError = useCallback(async (
    code: string,
    options?: { expectExisting?: boolean },
  ) => {
    setJoinError(null);
    setSwitching(true);
    try {
      await onSwitchRoom(code, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch rooms';
      setJoinError(message === 'Room not found' ? 'That room is no longer available' : message);
    } finally {
      setSwitching(false);
    }
  }, [onSwitchRoom]);

  const handleCreateRoom = useCallback(() => {
    const name = sanitizeRoomCode(newRoomName);
    if (name && name === currentRoomId) return;

    const taken = new Set(rooms.map((room) => room.roomId));
    if (name) {
      if (taken.has(name)) {
        setCreateNameError('That name is already in use');
        return;
      }
      setCreateNameError(null);
      void switchOrShowError(name);
      return;
    }

    if (currentRoomId) taken.add(currentRoomId);
    setCreateNameError(null);
    void switchOrShowError(generateRoomCode(taken));
  }, [newRoomName, rooms, currentRoomId, switchOrShowError]);

  const handleManualJoin = useCallback(() => {
    const code = sanitizeRoomCode(manualCode);
    if (!code || code === currentRoomId) return;
    void switchOrShowError(code);
  }, [manualCode, currentRoomId, switchOrShowError]);

  const handleEndGame = useCallback(() => {
    if (!onEndGame || endingGame || switching || !gameStarted) return;
    setEndingGame(true);
    onEndGame();
  }, [onEndGame, endingGame, switching, gameStarted]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
      data-block-game-input
      onClick={handleBackdropClick}
    >
      <div
        className="flex max-h-[85vh] w-11/12 max-w-lg flex-col overflow-hidden"
        onClick={stop}
        style={{
          background: HUD_PANEL_BG,
          clipPath: HUD_PANEL_CLIP,
          border: HUD_PANEL_BORDER,
          boxShadow: HUD_PANEL_SHADOW,
        }}
      >
        <div className="shrink-0 border-b border-blue-400/20 px-6 pb-3 pt-5">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-yellow-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/settings.svg"
              alt=""
              className="h-7 w-7 shrink-0 object-contain"
              aria-hidden
            />
            SETTINGS
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Current room:{' '}
            <span className="font-mono text-blue-200">
              {currentRoomId || 'none'}
            </span>
          </p>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5 text-white">
          {joinError && (
            <p className="text-sm text-rose-300">{joinError}</p>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
              Active rooms
            </h3>
            {rooms.length === 0 ? (
              <p className="text-sm text-gray-400">No active rooms yet.</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((room) => {
                  const status = roomStatus(room);
                  const isCurrent = room.roomId === currentRoomId;
                  const isFull = room.playerCount >= room.maxPlayers;
                  const joinDisabled = isCurrent || isFull || switching;
                  return (
                    <li
                      key={room.roomId}
                      className="flex items-center gap-3 rounded-lg border border-blue-400/15 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm text-blue-100">
                          {room.roomId}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <span>
                            {room.playerCount}/{room.maxPlayers} players
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={joinDisabled}
                        onClick={() => void switchOrShowError(room.roomId, { expectExisting: true })}
                        className="shrink-0 rounded border border-blue-500/50 bg-blue-950/50 px-3 py-1 text-xs font-medium text-blue-200 hover:border-blue-300 hover:text-blue-100 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-900/40 disabled:text-gray-500"
                      >
                        {isCurrent ? 'Current' : isFull ? 'Full' : 'Join'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
              Create a new room
            </h3>
            <p className="mb-3 text-sm text-gray-400">
              Start a fresh session if the current room is already in progress.
            </p>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(sanitizeRoomCode(e.target.value));
                if (createNameError) setCreateNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRoom();
              }}
              maxLength={24}
              placeholder="Room name (optional)"
              className="mb-2 w-full rounded border border-blue-400/25 bg-black/40 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-500 focus:border-blue-300 focus:outline-none"
            />
            {createNameError && (
              <p className="mb-2 text-sm text-rose-300">{createNameError}</p>
            )}
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={switching || (!!sanitizeRoomCode(newRoomName) && sanitizeRoomCode(newRoomName) === currentRoomId)}
              className="w-full rounded border border-green-600/60 bg-green-950/50 px-4 py-2 text-sm font-medium text-green-300 hover:border-green-400 hover:text-green-200 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-900/40 disabled:text-gray-500"
            >
              Create New Room
            </button>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
              Join by code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(sanitizeRoomCode(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualJoin();
                }}
                maxLength={24}
                placeholder="Enter room code"
                className="min-w-0 flex-1 rounded border border-blue-400/25 bg-black/40 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-500 focus:border-blue-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleManualJoin}
                disabled={switching || !sanitizeRoomCode(manualCode) || sanitizeRoomCode(manualCode) === currentRoomId}
                className="shrink-0 rounded border border-blue-500/50 bg-blue-950/50 px-4 py-2 text-sm font-medium text-blue-200 hover:border-blue-300 hover:text-blue-100 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-900/40 disabled:text-gray-500"
              >
                Join
              </button>
            </div>
          </section>
        </div>

        <div className="shrink-0 space-y-2 border-t border-blue-400/20 px-6 py-3 text-center">
          {onEndGame && (
            <button
              type="button"
              onClick={handleEndGame}
              disabled={endingGame || switching || !gameStarted}
              className="w-full rounded border border-rose-500/60 bg-rose-950/50 px-4 py-2 text-sm font-medium text-rose-300 hover:border-rose-400 hover:text-rose-200 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-900/40 disabled:text-gray-500"
            >
              {endingGame ? 'Ending…' : 'END GAME'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-green-600/60 bg-green-950/50 px-4 py-1.5 text-sm font-medium text-green-300 hover:border-green-400 hover:text-green-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
