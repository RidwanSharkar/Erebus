export { evictGltfLoaderCacheEntry } from './gltfCachePolicy';

/**
 * Chrome-only: `performance.memory` is populated when the profiler / heap tools are available.
 * Use with `__ERE_DEBUG_HEAP()` in the console for explicit snapshots; CoopGameScene also logs
 * automatically in development when leaving prep throne (portal → combat).
 */
export function logJsHeapSnapshotDev(label: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const m = (performance as typeof performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (!m) {
    console.info(`[ERE] ${label} — performance.memory unavailable (use Chrome with heap profiling)`);
    return;
  }
  const toMb = (n: number) => (n / 1024 / 1024).toFixed(1);
  console.info(`[ERE] ${label}`, {
    usedJSHeapMB: toMb(m.usedJSHeapSize),
    totalJSHeapMB: toMb(m.totalJSHeapSize),
    limitMB: toMb(m.jsHeapSizeLimit),
    usedVsLimit: (m.usedJSHeapSize / Math.max(1, m.jsHeapSizeLimit)).toFixed(3),
  });
}
