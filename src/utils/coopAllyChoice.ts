import type { CoopAllyKind } from '@/utils/coopAllyTargeting';

export interface AllyChoiceCardDef {
  kind: CoopAllyKind;
  title: string;
  role: string;
  stats: readonly string[];
  description: string;
}

export const ALLY_CHOICE_INTERACT_RADIUS = 2.35;

/** Fountain sits at origin; keep candidates outside HEALING_FOUNTAIN_INTERACT_RADIUS (2.6). */
export const ALLY_CHOICE_MEET_POSITIONS: readonly { x: number; z: number }[] = [
  { x: -3, z: 2.8 },
  { x: 3, z: 2.8 },
];

export const ALLY_CHOICE_ENTRY_POSITIONS: readonly { x: number; z: number }[] = [
  { x: -4.5, z: -10.5 },
  { x: 4.5, z: -10.5 },
];

export const ALLY_CHOICE_EXIT_POSITIONS: readonly { x: number; z: number }[] = [
  { x: -4.5, z: -13.5 },
  { x: 4.5, z: -13.5 },
];

export const ALLY_CHOICE_WALK_SPEED = 2.4;

export const ALLY_CHOICE_CARDS: readonly AllyChoiceCardDef[] = [
  {
    kind: 'knight',
    title: 'Knight',
    role: 'Melee Guardian',
    stats: ['500 HP', '50 Melee Damage', '~1.4s Attack Speed', 'Colossus Smite AoE'],
    description:
      'A stalwart frontline ally who draws enemy attention, cleaves nearby foes, and unleashes a devastating AoE smite when charged.',
  },
  {
    kind: 'huntress',
    title: 'Huntress',
    role: 'Ranged Marksman',
    stats: ['450 HP', '65 Piercing Damage', '1.0s Attack Speed', '20 Range'],
    description:
      'An agile archer who actively hunts targets within range and favors shots that pierce through multiple enemies for maximum damage.',
  },
  {
    kind: 'phantom',
    title: 'Phantom',
    role: 'Shadow Assassin',
    stats: ['400 HP', '40 Dagger Damage', '4.0s Blink Combo', '10 Range'],
    description:
      'A spectral ally who follows you until foes draw near, then blinks in and hurls a volley of golden daggers.',
  },
  {
    kind: 'demon',
    title: 'Demon',
    role: 'Aggressive Hunter',
    stats: ['500 HP', '48 Melee Damage', '900ms Attack Speed', 'Leap Stun'],
    description:
      'A relentless melee hunter that actively seeks out enemies, closes with a crushing leap, and tears through the front line.',
  },
  {
    kind: 'enchantress',
    title: 'Enchantress',
    role: 'Nature Caster',
    stats: ['400 HP', '105 Earth Shock', '2.25 Move Speed', 'Grasping Vines Root'],
    description:
      'A verdant spellcaster who stays close to you, hurls earth-shock bolts at nearby foes, and roots enemies with grasping vines.',
  },
];

export const ALLY_ANCESTOR_ICON_SRC: Record<CoopAllyKind, string> = {
  knight: '/icons/ancestors/knight.png',
  huntress: '/icons/ancestors/huntress.png',
  phantom: '/icons/ancestors/phantom.webp',
  demon: '/icons/ancestors/demon.png',
  enchantress: '/icons/ancestors/enchantress.png',
};

export function getAllyAncestorIconSrc(kind: CoopAllyKind): string {
  return ALLY_ANCESTOR_ICON_SRC[kind];
}

export function getAllyChoiceCard(kind: CoopAllyKind): AllyChoiceCardDef | undefined {
  return ALLY_CHOICE_CARDS.find((card) => card.kind === kind);
}

export function getAllyChoiceTooltipDescription(kind: CoopAllyKind): string {
  const card = getAllyChoiceCard(kind);
  if (!card) return '';
  const statsLine = card.stats.join(' · ');
  return `${card.role}. ${statsLine}. ${card.description}`;
}

export function getAllyRecruitHintLabel(kind: CoopAllyKind): string {
  const card = getAllyChoiceCard(kind);
  return card ? `Press 'X' to recruit ${card.title}` : "Press 'X' to recruit ally";
}

export interface AllyChoiceEncounterCandidateSnapshot {
  kind: CoopAllyKind;
  x: number;
  z: number;
  selectable: boolean;
}

export interface IntroAllyChoiceEncounterRef {
  getCandidates: () => readonly AllyChoiceEncounterCandidateSnapshot[];
}

export function findNearestSelectableAllyCandidate(
  px: number,
  pz: number,
  encounterRef: IntroAllyChoiceEncounterRef | null | undefined,
  radius = ALLY_CHOICE_INTERACT_RADIUS,
): CoopAllyKind | null {
  if (!encounterRef) return null;
  const radiusSq = radius * radius;
  let best: { kind: CoopAllyKind; d2: number } | null = null;
  for (const candidate of encounterRef.getCandidates()) {
    if (!candidate.selectable) continue;
    const dx = px - candidate.x;
    const dz = pz - candidate.z;
    const d2 = dx * dx + dz * dz;
    if (d2 <= radiusSq && (!best || d2 < best.d2)) {
      best = { kind: candidate.kind, d2 };
    }
  }
  return best?.kind ?? null;
}
