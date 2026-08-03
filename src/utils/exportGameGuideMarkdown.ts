/**
 * Builds the player-facing Game Guide markdown for README.md.
 * Mirrors RulebookPanel rendering plus aspects, spirit animals, progression, enemies, and items.
 * Keep in sync with src/data/rulebookContent.ts and related display sources.
 */

import { WeaponType } from '@/components/dragon/weapons';
import {
  RULEBOOK_BASICS,
  RULEBOOK_STATS,
  RULEBOOK_STATS_NOTE,
  RULEBOOK_WEAPONS,
  RULEBOOK_WEAPONS_NOTE,
  RULEBOOK_CLASS_TALENTS,
  RULEBOOK_CLASS_TALENTS_NOTE,
  RULEBOOK_PRIMARY_BOONS_INTRO,
  RULEBOOK_PRIMARY_BY_WEAPON,
  RULEBOOK_DASH_BOONS,
  RULEBOOK_SECONDARY_BOONS,
  RULEBOOK_SECONDARY_NOTE,
  RULEBOOK_DUO_PAIRS,
  RULEBOOK_DUO_UNLOCK,
  RULEBOOK_ULTIMATES,
  RULEBOOK_ULTIMATE_UNLOCK,
  RULEBOOK_PORTALS,
  RULEBOOK_PORTALS_FLOW,
  RULEBOOK_WEAPON_LABELS,
  type CoopRulebookWeapon,
  type RulebookTalentEntry,
} from '@/data/rulebookContent';
import { THRONE_ARCHETYPES, ARCHETYPE_DISPLAY } from '@/utils/archetypes';
import { ALLY_CHOICE_CARDS } from '@/utils/coopAllyChoice';
import {
  STARTING_FATE,
  BOON_REROLL_FATE_COST,
  TRIAL_ROOM_PEDESTAL_GOLD,
  STAT_ROOM_PEDESTAL_POINTS,
  INTRO_ROOM_GOLD_REWARDS,
  SUNKEN_ROOM_GOLD_REWARDS,
  ETERNITY_ROOM_GOLD_REWARDS,
  FAE_REALM_ROOM_GOLD_REWARDS,
  DEEP_SANCTUM_STAT_POINTS,
  DEEP_SANCTUM_GOLD_MIN,
} from '@/utils/coopRoomTitles';
import { DREAM_LAYER_ITEM_META } from '@/utils/dreamLayerItems';
import { ENEMY_DISPLAY_NAMES } from '@/utils/enemyDisplayNames';
import {
  ALLIED_BEAST_STATS,
  FAE_BEAST_COMPANION_KINDS,
  FAE_BEAST_KIND_LABELS,
} from '@/utils/faeBeastCompanion';
import {
  MERCHANT_HEAL_COST,
  MERCHANT_OXYGEN_COST,
  MERCHANT_WARPDRIVE_COST,
  MERCHANT_WEAPON_TALENT_MAX,
  MERCHANT_UTILITY_MAX,
  MERCHANT_BACKFILL_COST,
} from '@/utils/merchantShopUtils';
import {
  getPetCompanionUpgradeDefinition,
  PET_COMPANION_UPGRADE_OPTIONS,
} from '@/utils/petCompanionUpgrades';
import { getTalentBoonDefinition, type TalentId } from '@/utils/talents';
import {
  WEAPON_ASPECTS_BY_WEAPON,
  WEAPON_ASPECT_DISPLAY,
} from '@/utils/weaponAspects';
import {
  getDefaultLoadoutForWeapon,
  getUniversalAbilityById,
} from '@/utils/weaponAbilities';
import {
  getThroneWeaponTooltipData,
  getWeaponDisplayName,
} from '@/utils/weaponIcons';

const WEAPON_ORDER: readonly CoopRulebookWeapon[] = [
  WeaponType.RUNEBLADE,
  WeaponType.SABRES,
  WeaponType.BOW,
  WeaponType.SCYTHE,
];

const PRIMARY_WEAPON_ORDER: readonly CoopRulebookWeapon[] = [
  WeaponType.BOW,
  WeaponType.RUNEBLADE,
  WeaponType.SCYTHE,
  WeaponType.SABRES,
];

function formatTalentBadges(entry: RulebookTalentEntry): string {
  const badges: string[] = [];
  if (entry.passive) badges.push('PASSIVE');
  if (entry.rSpell) badges.push('R SPELL');
  if (entry.stat) badges.push(entry.stat);
  return badges.length > 0 ? ` _(${badges.join(', ')})_` : '';
}

function formatTalentEntry(entry: RulebookTalentEntry): string {
  const def = getTalentBoonDefinition(entry.id);
  const name = def?.name ?? entry.id;
  const description = def?.description ?? '—';
  return `- **${name}**${formatTalentBadges(entry)} — ${description}`;
}

function formatTalentId(id: TalentId): string {
  return formatTalentEntry({ id });
}

function lines(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string').join('\n');
}

function sectionBasics(): string {
  const blocks = [
    RULEBOOK_BASICS.health,
    RULEBOOK_BASICS.shields,
    RULEBOOK_BASICS.dashCharge,
    RULEBOOK_BASICS.energy,
  ] as const;

  return lines(
    '### 1. Basics',
    '',
    ...blocks.flatMap((block) => [`#### ${block.title}`, '', block.body, '']),
    `#### ${RULEBOOK_BASICS.controls.title}`,
    '',
    ...RULEBOOK_BASICS.controls.items.map((item) => `- ${item}`),
    '',
  );
}

function sectionStats(): string {
  return lines(
    '### 2. Stats',
    '',
    ...RULEBOOK_STATS.map((stat) => `- **${stat.label}** — ${stat.effect}`),
    '',
    RULEBOOK_STATS_NOTE,
    '',
  );
}

function sectionWeapons(): string {
  const weaponBlocks = RULEBOOK_WEAPONS.map(({ weapon, lmbSummary }) => {
    const tip = getThroneWeaponTooltipData(weapon);
    const loadout = getDefaultLoadoutForWeapon(weapon);
    const abilityLines = (['Q', 'E', 'R'] as const).map((key) => {
      const id = loadout[key];
      if (!id) {
        return `- **${key}** — (unlocked later / empty by default)`;
      }
      const ability = getUniversalAbilityById(id);
      const desc = ability?.description ? `: ${ability.description}` : '';
      return `- **${key}** — **${ability?.name ?? id}**${desc}`;
    });

    return lines(
      `#### ${getWeaponDisplayName(weapon)}`,
      '',
      tip?.description ? `*${tip.description}*` : null,
      tip?.description ? '' : null,
      `**Left-click** — ${lmbSummary}`,
      '',
      ...abilityLines,
      '',
    );
  });

  return lines('### 3. Weapons', '', RULEBOOK_WEAPONS_NOTE, '', ...weaponBlocks);
}

function sectionArchetypes(): string {
  return lines(
    '### 4. Archetypes',
    '',
    'Choose an archetype from a west-rim pedestal in the throne room (press X). **Shift** activates its power.',
    '',
    ...THRONE_ARCHETYPES.flatMap((id) => {
      const meta = ARCHETYPE_DISPLAY[id];
      return [`- **${meta.label}** — ${meta.description}`, ''];
    }),
  );
}

function sectionAncestors(): string {
  return lines(
    '### 5. Ancestors',
    '',
    'During the intro fountain phase you are offered ancestor candidates. Press X near one to recruit them as your allied companion for the run.',
    '',
    ...ALLY_CHOICE_CARDS.flatMap((card) => [
      `#### ${card.title}`,
      '',
      `*${card.role}* — ${card.stats.join(' · ')}`,
      '',
      card.description,
      '',
    ]),
  );
}

function sectionClassTalents(): string {
  const weaponBlocks = WEAPON_ORDER.map((weapon) =>
    lines(
      `#### ${RULEBOOK_WEAPON_LABELS[weapon]}`,
      '',
      ...RULEBOOK_CLASS_TALENTS[weapon].map((entry) => formatTalentEntry(entry)),
      '',
    ),
  );

  return lines(
    '### 6. Talents (Class Boons)',
    '',
    RULEBOOK_CLASS_TALENTS_NOTE,
    '',
    ...weaponBlocks,
  );
}

function sectionPrimaryBoons(): string {
  const weaponBlocks = PRIMARY_WEAPON_ORDER.map((weapon) => {
    const slots = RULEBOOK_PRIMARY_BY_WEAPON[weapon].map((slot) =>
      lines(
        `##### ${slot.label}`,
        '',
        `*${slot.abilityHint}*`,
        '',
        ...slot.variants.map((id) => formatTalentId(id)),
        '',
      ),
    );
    return lines(`#### ${RULEBOOK_WEAPON_LABELS[weapon]}`, '', ...slots);
  });

  return lines(
    '### 7. Primary Boons',
    '',
    RULEBOOK_PRIMARY_BOONS_INTRO,
    '',
    ...weaponBlocks,
    '#### Dash (shared — one per run)',
    '',
    'Divine Dash, Infernal Dash, Glacial Dash, Mending Dash, and Storm Dash are mutually exclusive.',
    '',
    ...RULEBOOK_DASH_BOONS.map((id) => formatTalentId(id)),
    '',
  );
}

function sectionSecondaryBoons(): string {
  const groups = RULEBOOK_SECONDARY_BOONS.map((group) =>
    lines(
      `#### ${group.title}`,
      '',
      ...group.entries.map((entry) => formatTalentEntry(entry)),
      '',
    ),
  );

  return lines(
    '### 8. Secondary Boons',
    '',
    RULEBOOK_SECONDARY_NOTE,
    '',
    ...groups,
  );
}

function sectionDuoUltimate(): string {
  const duoBlocks = RULEBOOK_DUO_PAIRS.map((pair) =>
    lines(
      `#### ${pair.colorsLabel}`,
      '',
      ...pair.ids.map((id) => formatTalentId(id)),
      '',
    ),
  );

  return lines(
    '### 9. Duo and Ultimate Boons',
    '',
    '#### Duo Boons',
    '',
    RULEBOOK_DUO_UNLOCK,
    '',
    ...duoBlocks,
    '#### Ultimate Boons',
    '',
    RULEBOOK_ULTIMATE_UNLOCK,
    '',
    ...RULEBOOK_ULTIMATES.map((u) => lines(`##### ${u.colorLabel}`, '', formatTalentId(u.id), '')),
  );
}

function sectionPortals(): string {
  return lines(
    '### 10. Portal Colors',
    '',
    RULEBOOK_PORTALS_FLOW,
    '',
    ...RULEBOOK_PORTALS.map(
      (portal) =>
        `- **(${portal.colorLabel}) ${portal.name}** — ${portal.reward}`,
    ),
    '',
  );
}

function sectionAspects(): string {
  const weaponBlocks = WEAPON_ORDER.map((weapon) => {
    const aspects = WEAPON_ASPECTS_BY_WEAPON[weapon] ?? [];
    return lines(
      `#### ${RULEBOOK_WEAPON_LABELS[weapon]}`,
      '',
      'Choose an aspect from the weapon pedestal in the throne room (cycle with the showcase, confirm with X).',
      '',
      ...aspects.flatMap((aspectId) => {
        const meta = WEAPON_ASPECT_DISPLAY[aspectId];
        return [`- **${meta.label}** — ${meta.description}`, ''];
      }),
    );
  });

  return lines(
    '### 11. Aspects',
    '',
    'Each throne weapon has multiple aspects that change visuals and core combat behavior for the run.',
    '',
    ...weaponBlocks,
  );
}

function sectionSpiritAnimals(): string {
  const beastBlocks = FAE_BEAST_COMPANION_KINDS.map((kind) => {
    const stats = ALLIED_BEAST_STATS[kind];
    const label = FAE_BEAST_KIND_LABELS[kind];
    const upgrades = PET_COMPANION_UPGRADE_OPTIONS[kind].map((id) => {
      const def = getPetCompanionUpgradeDefinition(id);
      return `- **${def.name}** — ${def.description}`;
    });

    return lines(
      `#### ${label}`,
      '',
      `*${stats.maxHp} HP · ${stats.damage} Melee Damage · ${stats.attackCooldownMs}ms Attack Cooldown · ${stats.aggroRadius} Aggro Radius*`,
      '',
      `Regenerates ${stats.hpRegenAmount} HP every ${stats.hpRegenIntervalMs / 1000}s.`,
      '',
      '**Empower upgrades** (choose one after Fae Realm III):',
      '',
      ...upgrades,
      '',
    );
  });

  return lines(
    '### 12. Spirit Animals',
    '',
    'Clearing Fae Realm III grants a spirit animal companion that follows you between rooms. After recruiting, empower it with one upgrade from its pool.',
    '',
    ...beastBlocks,
  );
}

function sectionRunProgression(): string {
  return lines(
    '### 13. Run Progression',
    '',
    'A co-op run flows through fixed sequences and an open throne-room portal loop.',
    '',
    '#### Intro — Inner Sanctum I–IV',
    '',
    'Every run begins with a one-time 4-room intro sequence (Inner Sanctum). Clear each room, then take the void portal. After room IV: drink from the healing fountain, revive an Ancestor, then choose gateways into the main loop.',
    '',
    `Intro gold rewards by room: ${INTRO_ROOM_GOLD_REWARDS.filter((n) => n > 0).join(' / ')} (final intro room grants no combat gold).`,
    '',
    '#### Throne Room Loop',
    '',
    'Between combat rooms you return to the Throne Room. Equip weapons and aspects, pick an archetype, assign Q/E/R abilities at the ability pillar, spend STAT points, then enter a colored or special portal.',
    '',
    `- Starting Fate: **${STARTING_FATE}**`,
    `- Boon reroll cost: **${BOON_REROLL_FATE_COST} Fate** in combat rooms (free in the throne room)`,
    '',
    '#### Mid-run Sequences',
    '',
    '- **Sunken Temple I–IV** — unlocks after Boss 1 (Hate / Twin Emperors). Fixed underwater rooms; ends with free boss-loot picks, fountain, then return to the main loop.',
    `- Sunken gold rewards: ${SUNKEN_ROOM_GOLD_REWARDS.filter((n) => n > 0).join(' / ')}`,
    '- **Eternity\'s Palace I–V** — later mid-run sequence with its own gold curve and loot/fountain checkpoints.',
    `- Eternity gold rewards: ${ETERNITY_ROOM_GOLD_REWARDS.filter((n) => n > 0).join(' / ')}`,
    '- **Fae Realm I–III** — beast-themed rooms; clearing III grants your Spirit Animal, then an empower choice.',
    `- Fae Realm gold rewards: ${FAE_REALM_ROOM_GOLD_REWARDS.join(' / ')}`,
    '',
    '#### Boss Chambers & Deep Sanctum',
    '',
    '- **Chamber of Death** (red void / boss portal) — defeat the boss, then pick a class talent from your weapon pool.',
    `- **Deep Sanctum** — high-value Inner Sanctum visits granting at least **${DEEP_SANCTUM_GOLD_MIN} gold** and **${DEEP_SANCTUM_STAT_POINTS} STAT points**.`,
    '',
    '#### Surprise Gates',
    '',
    'Occasionally portals lead to special destinations:',
    '',
    '- **Eden / Distorted Eden / Eden Finale**',
    '- **Delirium Gate** — defend the structure (or clear ghouls on failure)',
    '- **Erebus Gate**',
    '- **Dream Layer** — legendary item shop and set pieces',
    '',
    '#### Economy Snapshot',
    '',
    `- Trial Room (Crypt of Currency) pedestal: **+${TRIAL_ROOM_PEDESTAL_GOLD} GOLD**`,
    `- Stat Room (Crypt of Skill) pedestal: **+${STAT_ROOM_PEDESTAL_POINTS} STAT points**`,
    '- Leveling grants +20 max HP and +5 STAT points per level (base crit chance 11%, base crit damage 2.0×).',
    '',
  );
}

function sectionEnemies(): string {
  const groups: Record<string, string[]> = {
    Grunts: [],
    Beasts: [],
    Elites: [],
    Bosses: [],
    Titans: [],
  };

  const beastKeys = new Set([
    'tiger',
    'boss-tiger',
    'wolf',
    'boss-wolf',
    'bear',
    'boss-bear',
    'serpent',
    'boss-serpent',
    'bone-spider',
    'wyvern',
    'terrorhawk',
  ]);
  const eliteKeys = new Set([
    'knight',
    'warlock',
    'weaver',
    'shade',
    'ghoul',
    'templar',
    'viper',
    'colossus',
    'stone-giant',
    'eternal-oak',
    'spectre',
    'assassin',
    'shaman',
    'frost-queen',
    'medusa',
    'death-knight',
    'skyray',
    'wraith',
    'martyr',
    'greed',
    'player-zombie',
  ]);
  const bossKeys = new Set([
    'boss',
    'boss2',
    'boss3',
    'destiny',
    'nemesis',
    'valkyrie',
    'sentinel',
  ]);
  const titanKeys = new Set([
    'titan',
    'storm-titan',
    'titan-of-mercy',
    'titan-of-wrath',
    'plague-titan',
  ]);

  const seenLabels = new Set<string>();
  for (const [key, label] of Object.entries(ENEMY_DISPLAY_NAMES)) {
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    if (beastKeys.has(key)) groups.Beasts.push(label);
    else if (eliteKeys.has(key)) groups.Elites.push(label);
    else if (bossKeys.has(key)) groups.Bosses.push(label);
    else if (titanKeys.has(key)) groups.Titans.push(label);
    else groups.Grunts.push(label);
  }

  return lines(
    '### 14. Enemies',
    '',
    'Enemy nameplates as they appear in co-op. Combat profiles vary by type; bosses and titans are pull-immune to Death Grasp.',
    '',
    ...Object.entries(groups).flatMap(([title, names]) => {
      if (names.length === 0) return [];
      return [`#### ${title}`, '', ...names.map((n) => `- ${n}`), ''];
    }),
  );
}

function sectionItemsMerchant(): string {
  const items = Object.values(DREAM_LAYER_ITEM_META).map(
    (meta) =>
      `- **${meta.label}** (*${meta.passiveName}*) — ${meta.description}`,
  );

  return lines(
    '### 15. Items, Merchant & Economy',
    '',
    '#### Merchant (Avernus — Pink Portal)',
    '',
    'Spend GOLD on heal, utilities, weapon talents, dash charges, and boss drops.',
    '',
    `- Heal: **${MERCHANT_HEAL_COST} gold**`,
    `- Oxygen (max energy): **${MERCHANT_OXYGEN_COST} gold** (up to ${MERCHANT_UTILITY_MAX} purchases)`,
    `- Warpdrive (dash distance): **${MERCHANT_WARPDRIVE_COST} gold** (up to ${MERCHANT_UTILITY_MAX} purchases)`,
    `- Weapon talent purchases: up to **${MERCHANT_WEAPON_TALENT_MAX}** per run`,
    `- Premium backfill (after base slots sell out): **${MERCHANT_BACKFILL_COST} gold**`,
    '',
    '#### Dream Layer Items',
    '',
    'Legendary armor, rings, and pendants found in the Dream Layer and related loot.',
    '',
    ...items,
    '',
  );
}

/** Full Game Guide body (sections 1–15), without the outer `#` title. */
export function exportGameGuideMarkdown(): string {
  return lines(
    '## Game Guide',
    '',
    'Player-facing reference generated from the same data as the in-game Rulebook. Regenerate with `npm run readme:generate`.',
    '',
    sectionBasics(),
    sectionStats(),
    sectionWeapons(),
    sectionArchetypes(),
    sectionAncestors(),
    sectionClassTalents(),
    sectionPrimaryBoons(),
    sectionSecondaryBoons(),
    sectionDuoUltimate(),
    sectionPortals(),
    sectionAspects(),
    sectionSpiritAnimals(),
    sectionRunProgression(),
    sectionEnemies(),
    sectionItemsMerchant(),
  ).trimEnd() + '\n';
}
