'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMultiplayerRoom } from '@/contexts/MultiplayerContext';
import {
  EXPLORE_FOG_CELLS,
  exploreFog,
} from '@/utils/exploreFogOfWar';
import { EXPLORE_CHUNK_SIZE, chunkKey, exploreWildernessLevel } from '@/utils/exploreWorldGen';

const SIZE = 180;
const WORLD_VIEW = 90;
const REVEAL_R = 0x1f;
const REVEAL_G = 0x3d;
const REVEAL_B = 0x1c;

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

export default function ExploreMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { enemies, players, currentRoomId } = useMultiplayerRoom();
  const enemiesRef = useRef(enemies);
  enemiesRef.current = enemies;
  const playersRef = useRef(players);
  playersRef.current = players;
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

      ctx.fillStyle = '#ef4444';
      for (const enemy of enemiesRef.current.values()) {
        if (enemy.isDying) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        if (!exploreFog.isEnemyVisible(ex, ez, viewer.x, viewer.z)) continue;
        const px = SIZE * 0.5 + (ex - viewer.x) * scale;
        const py = SIZE * 0.5 + (ez - viewer.z) * scale;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      let yaw = viewer.yaw;
      let best = Infinity;
      for (const pl of playersRef.current.values()) {
        const dx = (pl.position?.x ?? 0) - viewer.x;
        const dz = (pl.position?.z ?? 0) - viewer.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) {
          best = d2;
          yaw = pl.rotation?.y ?? yaw;
        }
      }

      const p = SIZE * 0.5;
      ctx.save();
      ctx.translate(p, p);
      ctx.rotate(yaw);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

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
