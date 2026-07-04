import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
} from 'three';

/** Shared projectile geometries — reuse across arrow/bolt instances. */
export const ARROW_TIP_GEO = new ConeGeometry(0.08, 0.25, 8);
export const ARROW_SHAFT_GEO = new CylinderGeometry(0.02, 0.03, 0.4, 8);
export const ARROW_AURA_GEO = new SphereGeometry(0.225, 16, 16);
export const ARROW_FLETCHING_GEO = new PlaneGeometry(0.08, 0.12);
export const BARRAGE_SHAFT_GEO = new CylinderGeometry(0.025, 0.1, 1.8, 6);
export const BARRAGE_RING_GEOS = [
  new TorusGeometry(0.1, 0.04, 6, 10),
  new TorusGeometry(0.13, 0.04, 6, 10),
] as const;
export const VIPER_STING_SHAFT_GEO = new CylinderGeometry(0.025, 0.09, 1.9, 8);
export const VIPER_STING_TIP_GEO = new ConeGeometry(0.11, 0.45, 6);
export const VIPER_STING_CORE_GEO = new SphereGeometry(0.055, 8, 8);
export const VIPER_STING_RING_GEOS = [
  new TorusGeometry(0.105, 0.014, 6, 12),
  new TorusGeometry(0.14, 0.014, 6, 12),
] as const;
export const VIPER_STING_TRAIL_SPHERE_GEO = new SphereGeometry(0.105, 8, 8);
export const VIPER_STING_TRAIL_GLOW_GEO = new SphereGeometry(0.14, 6, 6);
export const BOLT_CORE_GEO = new SphereGeometry(0.12, 8, 8);
export const SOUL_ORB_GEO = new SphereGeometry(0.15, 8, 8);
export const COBRA_SHAFT_GEO = new CylinderGeometry(0.04, 0.15, 2.5, 8);
export const COBRA_TIP_GEO = new ConeGeometry(0.365, 0.8, 6);
export const COBRA_RING_GEOS = [
  new TorusGeometry(0.15, 0.02, 6, 12),
  new TorusGeometry(0.2, 0.02, 6, 12),
] as const;
export const COBRA_CORE_GEO = new SphereGeometry(0.08, 8, 8);
export const COBRA_TRAIL_SPHERE_GEO = new SphereGeometry(0.15, 8, 8);
export const COBRA_TRAIL_GLOW_GEO = new SphereGeometry(0.2, 6, 6);
export const WIND_SHEAR_TORUS_GEO = new TorusGeometry(0.38, 0.045, 6, 40, Math.PI * 0.75);
export const PROJECTILE_TRAIL_SPHERE_GEO = new SphereGeometry(0.08, 8, 8);
export const TOWER_OCTA_LARGE_GEO = new OctahedronGeometry(0.2, 0);
export const TOWER_OCTA_SMALL_GEO = new OctahedronGeometry(0.12, 0);
export const TOWER_CORE_GEO = new SphereGeometry(0.35, 12, 12);
export const TOWER_SPIKE_GEO = new ConeGeometry(0.03, 0.15, 4);
export const TOWER_TRAIL_SPHERE_GEO = new SphereGeometry(0.02, 6, 6);
export const ENTROPIC_CORE_CONE_GEO = new ConeGeometry(0.042, 0.48, 5, 1, false);
export const ENTROPIC_SHARD_BOX_A_GEO = new BoxGeometry(0.018, 0.14, 0.012);
export const ENTROPIC_SHARD_BOX_B_GEO = new BoxGeometry(0.014, 0.11, 0.01);
export const ENTROPIC_SHARD_CONE_GEO = new ConeGeometry(0.012, 0.1, 4, 1, false);
export const ENTROPIC_SHAFT_CYL_GEO = new CylinderGeometry(0.058, 0.038, 0.44, 6, 1, true);
export const ENTROPIC_SHARD_TETRA_GEO = new TetrahedronGeometry(0.032, 0);
export const ENTROPIC_GLOW_SPHERE_GEO = new SphereGeometry(0.046, 8, 8);

for (const geo of [
  ARROW_TIP_GEO,
  ARROW_SHAFT_GEO,
  ARROW_AURA_GEO,
  ARROW_FLETCHING_GEO,
  BARRAGE_SHAFT_GEO,
  ...BARRAGE_RING_GEOS,
  VIPER_STING_SHAFT_GEO,
  VIPER_STING_TIP_GEO,
  VIPER_STING_CORE_GEO,
  ...VIPER_STING_RING_GEOS,
  VIPER_STING_TRAIL_SPHERE_GEO,
  VIPER_STING_TRAIL_GLOW_GEO,
  BOLT_CORE_GEO,
  SOUL_ORB_GEO,
  COBRA_SHAFT_GEO,
  COBRA_TIP_GEO,
  ...COBRA_RING_GEOS,
  COBRA_CORE_GEO,
  COBRA_TRAIL_SPHERE_GEO,
  COBRA_TRAIL_GLOW_GEO,
  WIND_SHEAR_TORUS_GEO,
  PROJECTILE_TRAIL_SPHERE_GEO,
  TOWER_OCTA_LARGE_GEO,
  TOWER_OCTA_SMALL_GEO,
  TOWER_CORE_GEO,
  TOWER_SPIKE_GEO,
  TOWER_TRAIL_SPHERE_GEO,
  ENTROPIC_CORE_CONE_GEO,
  ENTROPIC_SHARD_BOX_A_GEO,
  ENTROPIC_SHARD_BOX_B_GEO,
  ENTROPIC_SHARD_CONE_GEO,
  ENTROPIC_SHAFT_CYL_GEO,
  ENTROPIC_SHARD_TETRA_GEO,
  ENTROPIC_GLOW_SPHERE_GEO,
]) {
  geo.userData.shared = true;
}
