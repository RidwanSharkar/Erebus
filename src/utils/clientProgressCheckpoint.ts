import type { WeaponType } from '@/components/dragon/weapons';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentLoadout } from '@/utils/talents';
import type { SkillPointData } from '@/utils/SkillPointSystem';
import type { StatPointData } from '@/utils/StatSystem';
import type { Archetype } from '@/utils/archetypes';
import type { WeaponAspect, WeaponAspectByWeapon } from '@/utils/weaponAspects';

const CHECKPOINT_KEY = 'erebus:clientProgress';
/** Survives reload so END GAME can skip checkpoint restore after session reclaim. */
const FULL_RESET_PENDING_KEY = 'erebus:coopFullReset';

export type ClientProgressCheckpoint = {
  talentLoadout: TalentLoadout;
  abilityLoadout: AbilityLoadout | null;
  skillPointData: SkillPointData;
  statPointData: StatPointData;
  inventory: unknown[];
  selectedWeapons: { primary: WeaponType; secondary: WeaponType };
  selectedArchetype: Archetype;
  selectedWeaponAspect: WeaponAspect;
  weaponAspectByWeapon: WeaponAspectByWeapon;
  merchantPurchaseState: object;
  dreamLayerPurchaseState: object;
  localPurchasedItems: string[];
  classTalentPickedWeapons: string[];
};

function serializeSkillPointData(data: SkillPointData) {
  const unlockedAbilities: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data?.unlockedAbilities || {})) {
    unlockedAbilities[key] = value instanceof Set ? [...value] : Array.isArray(value) ? [...value] : [];
  }
  return { skillPoints: data?.skillPoints ?? 0, unlockedAbilities };
}

function deserializeSkillPointData(raw: unknown): SkillPointData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { skillPoints?: number; unlockedAbilities?: Record<string, unknown> };
  const unlockedAbilities: Record<string, Set<string>> = {};
  for (const [key, value] of Object.entries(data.unlockedAbilities || {})) {
    unlockedAbilities[key] = new Set(Array.isArray(value) ? value.map(String) : []);
  }
  return {
    skillPoints: Number(data.skillPoints) || 0,
    unlockedAbilities,
  };
}

export function saveClientProgressCheckpoint(partial: Partial<ClientProgressCheckpoint>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadClientProgressCheckpoint() || ({} as ClientProgressCheckpoint);
    const next = { ...prev, ...partial };
    const payload = {
      ...next,
      skillPointData: next.skillPointData ? serializeSkillPointData(next.skillPointData) : undefined,
    };
    window.sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function loadClientProgressCheckpoint(): ClientProgressCheckpoint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientProgressCheckpoint & {
      skillPointData?: unknown;
    };
    const skillPointData = deserializeSkillPointData(parsed.skillPointData);
    if (!parsed.talentLoadout || !skillPointData) return parsed.talentLoadout
      ? { ...parsed, skillPointData: skillPointData || { skillPoints: 0, unlockedAbilities: {} } }
      : null;
    return { ...parsed, skillPointData };
  } catch {
    return null;
  }
}

export function clearClientProgressCheckpoint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    // ignore
  }
}

/** Mark that the next join should wipe client progression (END GAME). */
export function markCoopFullResetPending(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FULL_RESET_PENDING_KEY, '1');
  } catch {
    // ignore
  }
}

/** True while END GAME is pending (does not clear the flag). */
export function isCoopFullResetPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(FULL_RESET_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

/** Read and clear the END GAME pending flag. */
export function consumeCoopFullResetPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pending = window.sessionStorage.getItem(FULL_RESET_PENDING_KEY) === '1';
    if (pending) {
      window.sessionStorage.removeItem(FULL_RESET_PENDING_KEY);
    }
    return pending;
  } catch {
    return false;
  }
}
