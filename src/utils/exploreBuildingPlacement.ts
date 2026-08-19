import { isExploreBlocked } from '@/utils/exploreWorldGen';
import type { ExploreBuildingKind } from '@/utils/exploreBuildings';
import {
  EXPLORE_MAX_TOWERS,
  exploreBuildingRequiresFirePit,
  exploreBuildingRequiresSpiritLounge,
  getExploreBuildingDef,
  isExploreTowerType,
  isExploreUniqueReplaceKind,
  isWithinExploreFirePitRange,
} from '@/utils/exploreBuildings';

export interface ExploreObstacleDisc {
  x: number;
  z: number;
  radius: number;
  kind?: string;
}

export interface ExploreBuildingPlacementRules {
  firePits: readonly { x: number; z: number }[];
  liveTowerCount: number;
  hasLiveSpiritLounge: boolean;
}

export function isExploreBuildingPlacementBlocked(
  seed: number,
  x: number,
  z: number,
  kind: ExploreBuildingKind,
  extraDiscs: readonly ExploreObstacleDisc[],
  destroyedTreeHealth: Map<number, number> | null = null,
  destroyedRootHealth: Map<number, number> | null = null,
  rules: ExploreBuildingPlacementRules | null = null,
): boolean {
  const def = getExploreBuildingDef(kind);
  const hull = def.hullRadius;
  if (exploreBuildingRequiresFirePit(kind) && !isWithinExploreFirePitRange(x, z, rules?.firePits ?? [])) {
    return true;
  }
  if (exploreBuildingRequiresSpiritLounge(kind) && !rules?.hasLiveSpiritLounge) {
    return true;
  }
  if (isExploreTowerType(kind) && (rules?.liveTowerCount ?? 0) >= EXPLORE_MAX_TOWERS) {
    return true;
  }
  if (isExploreBlocked(seed, x, z, hull, destroyedTreeHealth, destroyedRootHealth)) return true;
  for (const disc of extraDiscs) {
    if (isExploreUniqueReplaceKind(kind) && disc.kind === kind) continue;
    const dx = disc.x - x;
    const dz = disc.z - z;
    const minDist = hull + disc.radius;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}
