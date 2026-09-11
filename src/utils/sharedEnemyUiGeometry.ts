import { AdditiveBlending, BoxGeometry, MeshBasicMaterial, PlaneGeometry, RingGeometry, SphereGeometry, TorusGeometry } from 'three';
import {
  ENEMY_HP_BAR_FILL_HEIGHT,
  ENEMY_HP_BAR_HEIGHT,
  ENEMY_HP_BAR_WIDTH,
} from './enemyHealthBar';

/** Shared HP bar planes — scale fill via mesh.scale.x, do not recreate geometry args. */
export const ENEMY_HP_BAR_BG_GEO = new PlaneGeometry(ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_HEIGHT);
export const ENEMY_HP_BAR_FILL_GEO = new PlaneGeometry(ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_FILL_HEIGHT);

export type EnemyHpBarMaterialRole = 'bg' | 'fill';

/** Shared HP bar materials keyed by `color|role` — SharedMesh must not own per-enemy mats. */
const hpBarMaterialCache = new Map<string, MeshBasicMaterial>();

/** Opaque track/fill so they skip the transparent distance sort (fill origin slides left with HP). */
export function getSharedEnemyHpBarMaterial(
  color: string,
  role: EnemyHpBarMaterialRole = 'bg',
): MeshBasicMaterial {
  const key = `${color}|${role}`;
  let mat = hpBarMaterialCache.get(key);
  if (mat) return mat;
  mat = new MeshBasicMaterial({
    color,
    opacity: 1,
    transparent: false,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  if (role === 'fill') {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  }
  mat.userData.shared = true;
  hpBarMaterialCache.set(key, mat);
  return mat;
}

/** Cube soul orbit particles — one box for every CubeSoulEffect instance. */
export const CUBE_SOUL_PARTICLE_GEO = new BoxGeometry(0.11, 0.11, 0.11);

/** Sabre impact VFX — module-level geos reused by every hit (no per-hit JSX alloc). */
export const SABRE_IMPACT_RING_GEO = new TorusGeometry(1, 0.055, 8, 40);
export const SABRE_IMPACT_PINCH_GEO = new PlaneGeometry(0.055, 0.48);
export const SABRE_IMPACT_SPARK_GEO = new PlaneGeometry(1, 1);
export const SABRE_IMPACT_BLADE_GEO = new PlaneGeometry(0.095, 0.74);

/** Soul orb meshes shared across soul effect components. */
export const SOUL_ORB_CORE_GEO = new SphereGeometry(0.14, 14, 14);
export const SOUL_ORB_GLOW_GEO = new SphereGeometry(0.3, 14, 14);
export const SOUL_ORB_PARTICLE_GEO = new SphereGeometry(0.08, 8, 8);
export const SOUL_ORB_RING_GEO = new RingGeometry(0.6, 0.825, 32);

export type SharedSoulType = 'green' | 'red' | 'blue' | 'purple' | 'yellow' | 'orange';

const SOUL_PALETTE: Record<SharedSoulType, { core: string; glow: string }> = {
  green: { core: '#00ff88', glow: '#00cc55' },
  red: { core: '#ff3344', glow: '#cc1122' },
  blue: { core: '#44aaff', glow: '#2266dd' },
  purple: { core: '#cc44ff', glow: '#8811cc' },
  yellow: { core: '#ffe433', glow: '#cc9900' },
  orange: { core: '#ff8833', glow: '#cc5500' },
};

function createSoulTypeMaterials(core: string, glow: string) {
  return {
    core: new MeshBasicMaterial({ color: core, toneMapped: false }),
    glow: new MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
    particle: new MeshBasicMaterial({
      color: core,
      toneMapped: false,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
    ring: new MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      side: 2,
    }),
  };
}

export const SOUL_TYPE_MATERIALS = Object.fromEntries(
  (Object.keys(SOUL_PALETTE) as SharedSoulType[]).map((type) => [
    type,
    createSoulTypeMaterials(SOUL_PALETTE[type].core, SOUL_PALETTE[type].glow),
  ]),
) as Record<
  SharedSoulType,
  ReturnType<typeof createSoulTypeMaterials>
>;

for (const geo of [
  ENEMY_HP_BAR_BG_GEO,
  ENEMY_HP_BAR_FILL_GEO,
  CUBE_SOUL_PARTICLE_GEO,
  SABRE_IMPACT_RING_GEO,
  SABRE_IMPACT_PINCH_GEO,
  SABRE_IMPACT_SPARK_GEO,
  SABRE_IMPACT_BLADE_GEO,
  SOUL_ORB_CORE_GEO,
  SOUL_ORB_GLOW_GEO,
  SOUL_ORB_PARTICLE_GEO,
  SOUL_ORB_RING_GEO,
]) {
  geo.userData.shared = true;
}

for (const mats of Object.values(SOUL_TYPE_MATERIALS)) {
  for (const mat of Object.values(mats)) {
    mat.userData.shared = true;
  }
}
