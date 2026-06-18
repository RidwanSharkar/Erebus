import { BufferGeometry, ConeGeometry, Color, Float32BufferAttribute } from '@/utils/three-exports';
import { MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';

/**
 * Lightweight procedural mountain generator.
 *
 * Designed for the instanced perimeter border around the colored combat rooms.
 * Each mountain is a single low-poly cone that is sculpted into a ridged,
 * snow-capped peak and baked with per-vertex colors, so the whole range renders
 * in a fixed handful of draw calls (one instanced mesh per geometry variant)
 * regardless of how many mountains encircle the map. Snow, rock strata and the
 * dark-base→bleached-summit gradient are all stored in the vertex color buffer,
 * meaning there is zero per-frame cost and no separate snow-cap layer.
 */

export interface MountainData {
  position: { x: number; y: number; z: number };
  scale: number;
  /** Variant bucket index (selects which geometry to instance). */
  variant?: number;
  /** Per-instance yaw (radians) so repeated variants don't look cloned. */
  rotationY?: number;
  /** Per-instance vertical stretch — varies peak sharpness/height. */
  heightScale?: number;
}

// ─── Deterministic RNG ────────────────────────────────────────────────────────
// Seeded so the mountain range is stable across renders (no popping / reshuffle).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ─── Shared tuning ────────────────────────────────────────────────────────────
const BASE_RADIUS = 4.6;
const BASE_HEIGHT = 7.75; // taller now that the snow cap is baked into this mesh
const RADIAL_SEGMENTS = 11; // odd → asymmetric, natural silhouette
const HEIGHT_SEGMENTS = 8; // enough rings for ridges & a clean snowline

const VARIANT_COUNT = 4;

// Rock & snow palette. Kept luminous because the combat rooms are dimly lit
// (ambient ~0.1, directional ~0.14); these read as the surface albedo.
const ROCK_BASE = new Color('#564a3d'); // shadowed scree at the foot
const ROCK_MID = new Color('#8b7355'); // sunlit rock body (matches old look)
const ROCK_HIGH = new Color('#a99a82'); // wind-bleached upper rock
const ROCK_STRATA = new Color('#6c5d4a'); // darker sediment banding
const SNOW_LIT = new Color('#eef2f8'); // snow on upward-facing slopes
const SNOW_SHADE = new Color('#c2ccda'); // snow on steeper, shaded faces

/**
 * Sculpt a cone into a ridged mountain in place.
 *
 * Displacement is driven mostly by the vertical angle so ridges and gullies run
 * down the slopes (radiating from the summit) the way real mountains do. A
 * height envelope keeps the apex sharp and the footprint near nominal radius so
 * instances tile cleanly. An asymmetric lean drifts the summit off-center.
 */
function sculptMountain(geometry: BufferGeometry, seed: number, intensity: number): void {
  const rand = mulberry32(seed);
  const pA = rand() * Math.PI * 2;
  const pB = rand() * Math.PI * 2;
  const pC = rand() * Math.PI * 2;
  const freqMajor = 3 + Math.floor(rand() * 3); // 3–5 dominant ridges
  const freqMinor = 7 + Math.floor(rand() * 5); // 7–11 secondary ridges
  const freqMicro = 14 + Math.floor(rand() * 7); // surface roughness
  const leanDir = rand() * Math.PI * 2;
  const leanAmt = (0.12 + rand() * 0.16) * BASE_RADIUS;

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const radial = Math.hypot(x, z);
    if (radial < 1e-4) continue; // apex / axis vertices stay put

    const angle = Math.atan2(z, x);
    const t = clamp01(y / BASE_HEIGHT); // 0 at foot, 1 at summit

    // Ridged primary signal: abs() of a sine carves sharp crests and valleys.
    const major = 1 - Math.abs(Math.sin(angle * freqMajor * 0.5 + pA)); // 0..1
    const minor = Math.sin(angle * freqMinor + pB) * 0.5;
    const micro = Math.sin(angle * freqMicro + y * 0.5 + pC) * 0.22;

    // Envelope: 0 at the footprint (clean base seam), peaks mid-slope, eases off
    // near the apex so the summit reads sharp.
    const env = Math.sin(Math.PI * Math.min(1, t * 1.02));
    const ridge = (major - 0.45) * 2.1 + minor + micro;
    const push = ridge * intensity * (0.35 + 0.65 * env);

    const nx = x / radial;
    const nz = z / radial;

    // Lean the upper portion toward leanDir for an asymmetric profile.
    const lean = leanAmt * t * t;

    pos.setX(i, x + nx * push + Math.cos(leanDir) * lean);
    pos.setZ(i, z + nz * push + Math.sin(leanDir) * lean);
    // Vertical ruggedness on the ridgelines for a jagged silhouette.
    pos.setY(i, y + Math.sin(angle * freqMajor + pB) * intensity * 0.3 * env);
  }

  pos.needsUpdate = true;
}

/**
 * Bake per-vertex rock/snow colors. Must run after normals are computed: snow
 * accumulates on upward-facing slopes (high normal.y) above a wobbly snowline
 * and sheds from steep cliffs, while rock fades from a shadowed base to a
 * bleached summit with subtle sediment banding.
 */
function paintMountain(geometry: BufferGeometry, seed: number): void {
  const rand = mulberry32(seed);
  const pSnowA = rand() * Math.PI * 2;
  const pSnowB = rand() * Math.PI * 2;
  const snowBase = 0.52 + rand() * 0.1; // base snowline height (fraction)
  const strataPhase = rand() * Math.PI * 2;
  const strataFreq = 0.9 + rand() * 0.6;

  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = nrm.getY(i); // 1 = faces straight up, 0 = vertical cliff
    const slope = clamp01(ny);
    const angle = Math.atan2(z, x);
    const t = clamp01(y / BASE_HEIGHT);

    // Rock gradient: shadowed base → body → bleached upper rock.
    c.copy(ROCK_BASE)
      .lerp(ROCK_MID, smoothstep(0.0, 0.45, t))
      .lerp(ROCK_HIGH, smoothstep(0.5, 0.95, t));

    // Sediment strata banding.
    const strata = 0.5 + 0.5 * Math.sin(y * strataFreq + strataPhase);
    c.lerp(ROCK_STRATA, strata * 0.16);

    // Snow: wobbly snowline; shallow faces collect it lower, cliffs shed it.
    const wobble = Math.sin(angle * 5 + pSnowA) * 0.05 + Math.sin(angle * 11 + pSnowB) * 0.025;
    const snowStart = snowBase + wobble - slope * 0.28;
    let snow = smoothstep(snowStart, snowStart + 0.13, t) * smoothstep(0.18, 0.55, slope);
    // Wind-blown dusting on the highest rock regardless of slope.
    snow = Math.max(snow, smoothstep(0.9, 0.99, t) * 0.55);

    if (snow > 0) {
      const snowCol = SNOW_SHADE.clone().lerp(SNOW_LIT, smoothstep(0.45, 0.85, slope));
      c.lerp(snowCol, clamp01(snow));
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

/**
 * Pre-generate the sculpted, vertex-colored mountain geometry variants. Bases
 * sit on the ground plane (y = 0). Geometry is converted to non-indexed so each
 * facet keeps its own flat normal for a crisp low-poly rock read.
 */
export function createMountainVariants(): BufferGeometry[] {
  return Array.from({ length: VARIANT_COUNT }, (_, i) => {
    const cone = new ConeGeometry(BASE_RADIUS, BASE_HEIGHT, RADIAL_SEGMENTS, HEIGHT_SEGMENTS);
    cone.translate(0, BASE_HEIGHT / 2, 0);
    sculptMountain(cone, 1013 + i * 9173, 2.7);

    // Flat-shaded facets: duplicate verts per face, then recompute normals.
    const geo: BufferGeometry = cone.toNonIndexed();
    cone.dispose();
    geo.computeVertexNormals();

    paintMountain(geo, 5527 + i * 7411);
    return geo;
  });
}

// ─── Border ring generation ───────────────────────────────────────────────────

interface BorderMountainOptions {
  /** Hex radius of the playable arena the ring should surround. */
  arenaRadius?: number;
  /** Stable seed so a given room always gets the same range. */
  seed?: number;
}

/**
 * Build a natural-looking mountain range that fully encircles the arena.
 * Several staggered rings give depth; outer rings are larger to form a backdrop.
 * Per-instance yaw + height variance keep the silhouette from reading as a
 * repeating wall of identical cones, so we can use fewer, larger peaks.
 */
export function generateBorderMountains({
  arenaRadius = MAIN_ARENA_HEX_RADIUS,
  seed = 1337,
}: BorderMountainOptions = {}): MountainData[] {
  const rand = mulberry32(seed);
  const mountains: MountainData[] = [];

  // [ringRadius, spacing, minScale, maxScale]
  // Spacing is generous so peaks read as individual formations with gaps of sky
  // between them rather than a solid triangular wall. Outer rings are bigger and
  // form the distant backdrop seen behind the inner range.
  const rings: Array<[number, number, number, number]> = [
    [arenaRadius + 1.0, 9.5, 0.7, 1.05],
    [arenaRadius + 6, 12.0, 0.95, 1.45],
    [arenaRadius + 15, 15.0, 1.25, 1.9],
  ];

  let variantCursor = 0;
  for (const [ringRadius, spacing, minScale, maxScale] of rings) {
    const circumference = 2 * Math.PI * ringRadius;
    const count = Math.max(8, Math.round(circumference / spacing));
    const angularStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const jitterAngle = (rand() - 0.5) * angularStep * 0.7;
      const angle = i * angularStep + jitterAngle;
      const radialJitter = (rand() - 0.5) * spacing * 0.9;
      const r = ringRadius + radialJitter;

      // Bias scale distribution toward the smaller end so a few large peaks
      // stand out instead of every mountain being max height.
      const s = rand();
      const scale = minScale + s * s * (maxScale - minScale);

      mountains.push({
        position: {
          x: Math.cos(angle) * r,
          // Sink the base slightly so there is no visible gap at the ground seam.
          y: -0.8 - rand() * 0.6,
          z: Math.sin(angle) * r,
        },
        scale,
        variant: variantCursor % VARIANT_COUNT,
        rotationY: rand() * Math.PI * 2,
        heightScale: 0.82 + rand() * 0.72, // 0.82–1.54 vertical variance
      });
      variantCursor++;
    }
  }

  return mountains;
}
