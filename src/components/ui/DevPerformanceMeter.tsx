'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import {
  devPerformanceStore,
  type DevPerformanceSnapshot,
} from '@/utils/devPerformanceStore';

function formatTriCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function frameTimeColor(ms: number): string {
  if (ms > 33) return '#f87171';
  if (ms > 20) return '#fbbf24';
  return '#86efac';
}

function drawCallColor(n: number): string {
  if (n > 300) return '#f87171';
  if (n > 150) return '#fbbf24';
  return '#e2e8f0';
}

function heapColor(percent: number | null): string {
  if (percent === null) return '#94a3b8';
  if (percent > 80) return '#f87171';
  if (percent > 60) return '#fbbf24';
  return '#86efac';
}

function deltaColor(delta: number, warn: number, crit: number): string {
  if (delta >= crit) return '#f87171';
  if (delta >= warn) return '#fbbf24';
  return '#94a3b8';
}

function formatDelta(delta: number): string {
  if (delta === 0) return '';
  return delta > 0 ? ` (+${delta})` : ` (${delta})`;
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span style={{ color: color ?? '#e2e8f0' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">{title}</div>
      {children}
    </div>
  );
}

function CompactLine({ s }: { s: DevPerformanceSnapshot }) {
  const frameMs = s.frameTimeMs || (s.fps > 0 ? 1000 / s.fps : 0);
  const heap =
    s.heapUsedMB !== null ? `${s.heapUsedMB}MB` : 'heap n/a';

  return (
    <div className="text-[10px] leading-snug text-white/90 whitespace-nowrap">
      <span style={{ color: frameTimeColor(frameMs) }}>{frameMs.toFixed(1)}ms</span>
      <span className="text-white/30"> | </span>
      <span style={{ color: heapColor(s.heapPercent) }}>{heap}</span>
      <span className="text-white/30"> | </span>
      <span style={{ color: drawCallColor(s.drawCalls) }}>{s.drawCalls} draws</span>
      <span className="text-white/30"> | </span>
      <span>{formatTriCount(s.triangles)} tris</span>
      <span className="text-white/30"> | </span>
      <span>{s.enemyCount} enemies</span>
    </div>
  );
}

function ExpandedPanel({ s }: { s: DevPerformanceSnapshot }) {
  const frameMs = s.frameTimeMs || (s.fps > 0 ? 1000 / s.fps : 0);

  return (
    <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] leading-relaxed">
      <Section title="Render">
        <MetricRow label="Draw calls" value={String(s.drawCalls)} color={drawCallColor(s.drawCalls)} />
        <MetricRow label="Triangles" value={s.triangles.toLocaleString()} />
        <MetricRow label="Points / Lines" value={`${s.points} / ${s.lines}`} />
        <MetricRow
          label="Geometries"
          value={`${s.geometries}${formatDelta(s.deltaGeometries)}`}
          color={deltaColor(s.deltaGeometries, 50, 150)}
        />
        <MetricRow
          label="Textures"
          value={`${s.textures}${formatDelta(s.deltaTextures)}`}
          color={deltaColor(s.deltaTextures, 50, 150)}
        />
        <MetricRow
          label="Programs"
          value={`${s.programs}${formatDelta(s.deltaPrograms)}`}
          color={deltaColor(s.deltaPrograms, 10, 30)}
        />
        <MetricRow label="DPR" value={s.dpr.toFixed(2)} />
        <MetricRow
          label="Zoom LOD"
          value={
            s.exploreZoomRadius != null
              ? `r=${s.exploreZoomRadius.toFixed(1)}${s.exploreZoomClose ? ' close' : ''}${s.exploreZoomVeryClose ? '+vc' : ''}`
              : 'n/a'
          }
        />
      </Section>

      <Section title="Memory">
        <MetricRow
          label="JS heap"
          value={
            s.heapUsedMB !== null
              ? `${s.heapUsedMB} / ${s.heapLimitMB ?? '?'} MB${formatDelta(Math.round(s.deltaHeapMB))}`
              : 'n/a (use Chrome)'
          }
          color={heapColor(s.heapPercent)}
        />
        {s.heapPercent !== null && (
          <MetricRow label="Heap %" value={`${s.heapPercent.toFixed(1)}%`} color={heapColor(s.heapPercent)} />
        )}
      </Section>

      <Section title="Scene">
        <MetricRow label="Objects" value={String(s.sceneObjects)} />
        <MetricRow label="Meshes" value={`${s.meshes} (+${s.instancedMeshes} inst)`} />
        <MetricRow label="Lights" value={`${s.lights} (${s.shadowCasters} shadow)`} />
      </Section>

      <Section title="Engine">
        <MetricRow label="FPS" value={String(s.fps)} color={frameTimeColor(frameMs)} />
        <MetricRow label="Frame" value={`${frameMs.toFixed(1)} ms`} color={frameTimeColor(frameMs)} />
        <MetricRow label="Update / Render" value={`${s.updateTimeMs} / ${s.renderTimeMs} ms`} />
        <MetricRow label="ECS entities" value={String(s.ecsEntities)} />
        <MetricRow label="Enemies / Players" value={`${s.enemyCount} / ${s.playerCount}`} />
        <MetricRow label="Collisions" value={`${s.activeCollisions} active, ${s.collisionChecks} checks`} />
        <MetricRow label="Spatial hash cells" value={String(s.spatialHashCells)} />
      </Section>

      <Section title="React">
        <MetricRow label="Last commit" value={`${s.reactLastCommitMs.toFixed(1)} ms`} />
        <MetricRow label="Base duration" value={`${s.reactBaseDurationMs.toFixed(1)} ms`} />
        <MetricRow label="Commits / sec" value={String(s.reactCommitsPerSec)} />
      </Section>

      <Section title="Pools">
        <MetricRow label="Vector3 pool" value={String(s.vector3PoolSize)} />
        <MetricRow label="Effect pool" value={String(s.effectPoolActive)} />
        <MetricRow label="Calc cache" value={String(s.calcCacheEntries)} />
      </Section>
    </div>
  );
}

export default function DevPerformanceMeter() {
  const snapshot = useSyncExternalStore(
    devPerformanceStore.subscribe.bind(devPerformanceStore),
    devPerformanceStore.getSnapshot.bind(devPerformanceStore),
    devPerformanceStore.getSnapshot.bind(devPerformanceStore),
  );
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  if (snapshot.timestamp === 0) {
    return (
      <div className="mt-1 rounded-md bg-black/45 px-2 py-1 font-mono text-[10px] text-white/40 pointer-events-none">
        perf…
      </div>
    );
  }

  return (
    <div
      className="mt-1 rounded-md bg-black/45 px-2 py-1 font-mono shadow-lg backdrop-blur-sm pointer-events-auto"
      data-block-game-input
    >
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left cursor-pointer hover:opacity-90 transition-opacity"
        title="Toggle performance details"
      >
        <CompactLine s={snapshot} />
        <div className="text-[9px] text-white/35 mt-0.5">
          {expanded ? '▾ hide details' : '▸ show details'}
        </div>
      </button>
      {expanded && <ExpandedPanel s={snapshot} />}
    </div>
  );
}
