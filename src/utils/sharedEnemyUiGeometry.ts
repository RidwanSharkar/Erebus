import { AdditiveBlending, MeshBasicMaterial, PlaneGeometry, RingGeometry, SphereGeometry } from 'three';
import {
  ENEMY_HP_BAR_FILL_HEIGHT,
  ENEMY_HP_BAR_HEIGHT,
  ENEMY_HP_BAR_WIDTH,
} from './enemyHealthBar';

/** Shared HP bar planes — scale fill via mesh.scale.x, do not recreate geometry args. */
export const ENEMY_HP_BAR_BG_GEO = new PlaneGeometry(ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_HEIGHT);
export const ENEMY_HP_BAR_FILL_GEO = new PlaneGeometry(ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_FILL_HEIGHT);

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
