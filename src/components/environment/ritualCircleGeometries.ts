import {
  CircleGeometry,
  RingGeometry,
  CylinderGeometry,
} from '@/utils/three-exports';

/** Local geometry scale (matches reference RuneCircle). */
export const GEOMETRY_SCALE = 0.35;

/** Outer ring outer radius in local units: 22.5 * GEOMETRY_SCALE */
export const OUTER_RING_MAX_R = 22.5 * GEOMETRY_SCALE;

/** Match prior ritual footprint (~1.5 world units outer radius). */
export const RITUAL_WORLD_SCALE = 1.5 / OUTER_RING_MAX_R;

function createDashedRingGeometry(
  innerRadius: number,
  outerRadius: number,
  dashLength: number,
  gapLength: number
): RingGeometry[] {
  const geometries: RingGeometry[] = [];
  const circumference = 2.375 * Math.PI * ((innerRadius + outerRadius) / 2);
  const totalDashGap = dashLength + gapLength;
  const numDashes = Math.floor(circumference / totalDashGap);

  for (let i = 0; i < numDashes; i++) {
    const startAngle = ((i * totalDashGap) / circumference) * 2 * Math.PI;
    const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
    const thetaLength = endAngle - startAngle;
    geometries.push(
      new RingGeometry(innerRadius, outerRadius, 8, 1, startAngle, thetaLength)
    );
  }
  return geometries;
}

/** Module-level shared geometries — created once per session, never disposed. */
export const sharedGeometries = (() => {
  const s = GEOMETRY_SCALE;
  return {
    outerRing: createDashedRingGeometry(20.5 * s, 22.5 * s, 8, 6),
    innerRing: createDashedRingGeometry(11.5 * s, 12.5 * s, 4, 3),
    expandingRing: new RingGeometry(20.5 * s, 22.5 * s, 32),
    centerOrb: new CircleGeometry(1.2 * s, 16),
    marker: new CylinderGeometry(0.05, 0.05, 1.0, 8),
    rune: new CircleGeometry(0.15, 8),
  };
})();
