'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMultiplayerActions, useMultiplayerRoom } from '@/contexts/MultiplayerContext';
import {
  EXPLORE_FOG_CELLS,
  exploreFog,
} from '@/utils/exploreFogOfWar';
import { EXPLORE_CHUNK_SIZE, chunkKey, exploreWildernessLevel } from '@/utils/exploreWorldGen';
import { isPlayerExploreBuildingType } from '@/utils/exploreBuildings';

const SIZE = 180;
const WORLD_VIEW = 90;
const HALF_VIEW = WORLD_VIEW * 0.5;
const REVEAL_R = 0x1f;
const REVEAL_G = 0x3d;
const REVEAL_B = 0x1c;
const BUILDING_GREEN = '#22c55e';
const ALLY_YELLOW = '#eab308';
const HOSTILE_RED = '#ef4444';
const PLAYER_WHITE = '#f8fafc';
const FIRE_PIP_MARGIN = 10;

type ChunkBake = { canvas: HTMLCanvasElement; revealed: number };

function countRevealed(grid: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] !== 0) n++;
  return n;
}

function bakeChunk(grid: Uint8Array, dest?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = dest ?? document.createElement('canvas');
  canvas.width = EXPLORE_FOG_CELLS;
  canvas.height = EXPLORE_FOG_CELLS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(EXPLORE_FOG_CELLS, EXPLORE_FOG_CELLS);
  const data = img.data;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    const o = i * 4;
    data[o] = REVEAL_R;
    data[o + 1] = REVEAL_G;
    data[o + 2] = REVEAL_B;
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function worldToMinimap(wx: number, wz: number, viewerX: number, viewerZ: number, scale: number) {
  return {
    px: SIZE * 0.5 + (wx - viewerX) * scale,
    py: SIZE * 0.5 + (wz - viewerZ) * scale,
  };
}

function drawBuildingIcon(ctx: CanvasRenderingContext2D, type: string, px: number, py: number) {
  ctx.fillStyle = BUILDING_GREEN;
  if (type === 'barracks') {
    ctx.fillRect(px - 3.2, py - 3.2, 6.4, 6.4);
    return;
  }
  if (type === 'research-station') {
    ctx.beginPath();
    ctx.moveTo(px, py - 4.2);
    ctx.lineTo(px + 3.4, py);
    ctx.lineTo(px, py + 4.2);
    ctx.lineTo(px - 3.4, py);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === 'shrine') {
    ctx.beginPath();
    ctx.moveTo(px, py - 4.0);
    ctx.lineTo(px + 3.6, py);
    ctx.lineTo(px, py + 4.0);
    ctx.lineTo(px - 3.6, py);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === 'obelisk') {
    ctx.fillRect(px - 1.6, py - 4.4, 3.2, 8.8);
    return;
  }
  if (type === 'shield-battery') {
    ctx.fillRect(px - 1.1, py - 3.0, 2.2, 6.0);
    ctx.fillRect(px - 3.0, py - 1.1, 6.0, 2.2);
    return;
  }
  if (type === 'cathedral') {
    ctx.beginPath();
    ctx.moveTo(px, py - 4.6);
    ctx.lineTo(px + 2.4, py - 1.4);
    ctx.lineTo(px + 2.4, py + 4.0);
    ctx.lineTo(px - 2.4, py + 4.0);
    ctx.lineTo(px - 2.4, py - 1.4);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === 'tower' || type === 'watch-tower' || type === 'siege-tower') {
    ctx.beginPath();
    ctx.moveTo(px, py - 4.2);
    ctx.lineTo(px + 3.4, py + 3.2);
    ctx.lineTo(px - 3.4, py + 3.2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(px, py, 3.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawFirePitEdgePip(ctx: CanvasRenderingContext2D, dx: number, dz: number) {
  const angle = Math.atan2(dz, dx);
  const r = SIZE * 0.5 - FIRE_PIP_MARGIN;
  const edgeX = SIZE * 0.5 + Math.cos(angle) * r;
  const edgeY = SIZE * 0.5 + Math.sin(angle) * r;
  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);
  ctx.fillStyle = BUILDING_GREEN;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, 4.2);
  ctx.lineTo(-4, -4.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default function ExploreMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { enemies, players, currentRoomId } = useMultiplayerRoom();
  const { socket } = useMultiplayerActions();
  const enemiesRef = useRef(enemies);
  enemiesRef.current = enemies;
  const playersRef = useRef(players);
  playersRef.current = players;
  const localIdRef = useRef<string | null>(socket?.id ?? null);
  localIdRef.current = socket?.id ?? null;
  const bakeCacheRef = useRef(new Map<string, ChunkBake>());
  const [wildernessLevel, setWildernessLevel] = useState(1);
  const wildernessLevelRef = useRef(1);
  void currentRoomId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 100) return;
      last = now;

      const viewer = exploreFog.getViewer();
      const nextLevel = exploreWildernessLevel(viewer.x, viewer.z);
      if (nextLevel !== wildernessLevelRef.current) {
        wildernessLevelRef.current = nextLevel;
        setWildernessLevel(nextLevel);
      }
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, SIZE, SIZE);

      const scale = SIZE / WORLD_VIEW;
      const chunkPx = EXPLORE_CHUNK_SIZE * scale;
      const half = WORLD_VIEW * 0.5;
      const minCx = Math.floor((viewer.x - half) / EXPLORE_CHUNK_SIZE);
      const maxCx = Math.floor((viewer.x + half) / EXPLORE_CHUNK_SIZE);
      const minCz = Math.floor((viewer.z - half) / EXPLORE_CHUNK_SIZE);
      const maxCz = Math.floor((viewer.z + half) / EXPLORE_CHUNK_SIZE);
      const bakeCache = bakeCacheRef.current;

      for (let cz = minCz; cz <= maxCz; cz++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const key = chunkKey(cx, cz);
          const grid = exploreFog.getChunkGrid(cx, cz);
          if (!grid) continue;
          const revealed = countRevealed(grid);
          if (revealed === 0) continue;
          let bake = bakeCache.get(key);
          if (!bake) {
            bake = { canvas: bakeChunk(grid), revealed };
            bakeCache.set(key, bake);
          } else if (bake.revealed !== revealed) {
            bakeChunk(grid, bake.canvas);
            bake.revealed = revealed;
          }
          const originX = cx * EXPLORE_CHUNK_SIZE;
          const originZ = cz * EXPLORE_CHUNK_SIZE;
          const px = SIZE * 0.5 + (originX - viewer.x) * scale;
          const py = SIZE * 0.5 + (originZ - viewer.z) * scale;
          ctx.drawImage(bake.canvas, px, py, chunkPx, chunkPx);
        }
      }

      let nearestFireDx = 0;
      let nearestFireDz = 0;
      let nearestFireD2 = Infinity;
      let nearestFireOnMap = false;

      for (const enemy of enemiesRef.current.values()) {
        if (enemy.isDying || (enemy.health ?? 0) <= 0) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        if (enemy.type === 'fire-pit') {
          const fdx = ex - viewer.x;
          const fdz = ez - viewer.z;
          const fd2 = fdx * fdx + fdz * fdz;
          if (fd2 < nearestFireD2) {
            nearestFireD2 = fd2;
            nearestFireDx = fdx;
            nearestFireDz = fdz;
            nearestFireOnMap = Math.abs(fdx) <= HALF_VIEW && Math.abs(fdz) <= HALF_VIEW;
          }
        }
        if (isPlayerExploreBuildingType(enemy.type)) {
          const { px, py } = worldToMinimap(ex, ez, viewer.x, viewer.z, scale);
          drawBuildingIcon(ctx, enemy.type, px, py);
          continue;
        }
        if (enemy.alliedUnit === true && enemy.isStructure !== true) {
          const { px, py } = worldToMinimap(ex, ez, viewer.x, viewer.z, scale);
          ctx.fillStyle = ALLY_YELLOW;
          ctx.beginPath();
          ctx.arc(px, py, 2.6, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (!exploreFog.isEnemyVisible(ex, ez, viewer.x, viewer.z)) continue;
        const { px, py } = worldToMinimap(ex, ez, viewer.x, viewer.z, scale);
        ctx.fillStyle = HOSTILE_RED;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      const localId = localIdRef.current;
      ctx.fillStyle = ALLY_YELLOW;
      for (const pl of playersRef.current.values()) {
        if (localId && pl.id === localId) continue;
        const dx = (pl.position?.x ?? 0) - viewer.x;
        const dz = (pl.position?.z ?? 0) - viewer.z;
        if (dx * dx + dz * dz < 0.16) continue;
        const { px, py } = worldToMinimap(pl.position?.x ?? 0, pl.position?.z ?? 0, viewer.x, viewer.z, scale);
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (nearestFireD2 < Infinity && !nearestFireOnMap) {
        drawFirePitEdgePip(ctx, nearestFireDx, nearestFireDz);
      }

      const p = SIZE * 0.5;
      ctx.beginPath();
      ctx.arc(p, p, 5.1, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p, p, 4.1, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_WHITE;
      ctx.fill();

      ctx.strokeStyle = 'rgba(248,250,252,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      bakeCacheRef.current.clear();
    };
  }, []);

  return (
    <div className="flex flex-col items-start gap-1.5" data-block-game-input>
      <div
        className="pointer-events-none select-none rounded-md border border-emerald-400/40 bg-black/55 px-3 py-1.5 text-center font-semibold tracking-widest text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
        style={{ width: SIZE, fontSize: 11 }}
      >
        WILDERNESS LEVEL {wildernessLevel}
      </div>
      <div
        className="rounded-sm overflow-hidden shadow-lg"
        style={{ width: SIZE, height: SIZE, border: '1px solid rgba(248,250,252,0.2)' }}
      >
        <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      </div>
    </div>
  );
}
