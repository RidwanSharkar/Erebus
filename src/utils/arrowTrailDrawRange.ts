import type { BufferGeometry } from '@/utils/three-exports';
import { clampIndexedDrawRange } from '@/utils/webglDiagnostics';

/** Index count for a polyline with `pointCount` vertices (each segment = 2 indices). */
export function lineSegmentIndexCount(pointCount: number): number {
  return pointCount >= 2 ? (pointCount - 1) * 2 : 0;
}

export function applyArrowTrailDrawRange(geometry: BufferGeometry, pointCount: number): void {
  clampIndexedDrawRange(geometry, lineSegmentIndexCount(pointCount));
}
