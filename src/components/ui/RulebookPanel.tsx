'use client';

import { useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import { THRONE_ARCHETYPES, ARCHETYPE_DISPLAY } from '@/utils/archetypes';
import { ALLY_CHOICE_CARDS } from '@/utils/coopAllyChoice';
import {
  getTalentBoonDefinition,
  getTalentIconSrc,
  type TalentId,
} from '@/utils/talents';
import {
  getDefaultLoadoutForWeapon,
  getUniversalAbilityById,
} from '@/utils/weaponAbilities';
import {
  getThroneWeaponTooltipData,
  getWeaponDisplayName,
} from '@/utils/weaponIcons';
import {
  RULEBOOK_TOC,
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
  type StatBadge,
} from '@/data/rulebookContent';

interface RulebookPanelProps {
  onClose: () => void;
}

const STAT_BADGE_CLASS: Record<StatBadge, string> = {
  STR: 'bg-red-900/80 text-red-300 border-red-600/60',
  STA: 'bg-green-900/80 text-green-300 border-green-600/60',
  AGI: 'bg-blue-900/80 text-blue-300 border-blue-600/60',
  INT: 'bg-purple-900/80 text-purple-300 border-purple-600/60',
};

function StatPill({ stat }: { stat: StatBadge }) {
  return (
    <span
      className={`ml-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${STAT_BADGE_CLASS[stat]}`}
    >
      {stat}
    </span>
  );
}

function TalentEntry({ entry }: { entry: RulebookTalentEntry }) {
  const def = getTalentBoonDefinition(entry.id);
  const iconSrc = getTalentIconSrc(entry.id);
  const name = def?.name ?? entry.id;
  const description = def?.description ?? '—';

  return (
    <li className="rounded-lg border border-gray-700/80 bg-gray-950/50 px-3 py-2">
      <div className="mb-1 flex items-start gap-2">
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt=""
            className="mt-0.5 h-5 w-5 shrink-0 object-contain opacity-90"
            aria-hidden
          />
        ) : (
          <span className="mt-0.5 h-5 w-5 shrink-0 rounded bg-gray-800" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold text-yellow-200">{name}</span>
            {entry.passive && (
              <span className="rounded border border-cyan-700/60 bg-cyan-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-cyan-300">
                PASSIVE
              </span>
            )}
            {entry.rSpell && (
              <span className="rounded border border-amber-700/60 bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-300">
                R SPELL
              </span>
            )}
            {entry.stat && <StatPill stat={entry.stat} />}
          </div>
          <p className="mt-0.5 text-sm leading-snug text-gray-300">{description}</p>
        </div>
      </div>
    </li>
  );
}

function TalentIdEntry({ id }: { id: TalentId }) {
  return <TalentEntry entry={{ id }} />;
}

function RulebookSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 border-b border-gray-600 pb-5 last:border-b-0">
      <h3 className="mb-3 text-lg font-semibold text-yellow-400">{title}</h3>
      {children}
    </section>
  );
}

function WeaponDefaultAbilities({ weapon }: { weapon: CoopRulebookWeapon }) {
  const loadout = getDefaultLoadoutForWeapon(weapon);
  const slots: Array<{ key: 'Q' | 'E' | 'R'; id: string | null }> = [
    { key: 'Q', id: loadout.Q },
    { key: 'E', id: loadout.E },
    { key: 'R', id: loadout.R },
  ];

  return (
    <ul className="mt-1 space-y-0.5 text-sm text-gray-300">
      {slots.map(({ key, id }) => {
        if (!id) {
          return (
            <li key={key}>
              <strong className="text-green-400">{key}</strong> — (unlocked later / empty by default)
            </li>
          );
        }
        const ability = getUniversalAbilityById(id);
        return (
          <li key={key}>
            <strong className="text-green-400">{key}</strong> —{' '}
            <span className="text-yellow-200">{ability?.name ?? id}</span>
            {ability?.description ? (
              <span className="text-gray-400">: {ability.description}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function RulebookPanel({ onClose }: RulebookPanelProps) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const scrollTo = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
      data-block-game-input
      onClick={handleBackdropClick}
    >
      <div
        className="flex max-h-[85vh] w-11/12 max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-green-400 bg-gray-900"
        onClick={stop}
      >
        <div className="shrink-0 border-b border-gray-700 px-6 pb-3 pt-5">
          <div className="mb-3 text-center">
            <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-yellow-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/rules.svg"
                alt=""
                className="h-7 w-7 shrink-0 object-contain"
                aria-hidden
              />
              RULEBOOK
            </h2>
          </div>
          <nav
            className="flex flex-wrap justify-center gap-1.5"
            aria-label="Rulebook sections"
          >
            {RULEBOOK_TOC.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-[11px] font-medium text-gray-200 hover:border-green-400 hover:text-green-300"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5 text-white">
          {/* 1) Basics */}
          <RulebookSection id="basics" title="1) Basics">
            <div className="space-y-3">
              {(
                [
                  RULEBOOK_BASICS.health,
                  RULEBOOK_BASICS.shields,
                  RULEBOOK_BASICS.dashCharge,
                  RULEBOOK_BASICS.energy,
                ] as const
              ).map((block) => (
                <div key={block.title}>
                  <h4 className="mb-1 font-semibold text-green-400">{block.title}</h4>
                  <p className="text-sm text-gray-300">{block.body}</p>
                </div>
              ))}
              <div>
                <h4 className="mb-1 font-semibold text-green-400">
                  {RULEBOOK_BASICS.controls.title}
                </h4>
                <ul className="ml-4 list-disc space-y-1 text-sm text-gray-300">
                  {RULEBOOK_BASICS.controls.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </RulebookSection>

          {/* 2) Stats */}
          <RulebookSection id="stats" title="2) Stats">
            <ul className="mb-3 space-y-2">
              {RULEBOOK_STATS.map((stat) => (
                <li
                  key={stat.key}
                  className="rounded-lg border border-gray-700/80 bg-gray-950/50 px-3 py-2"
                >
                  <span className={`font-bold ${stat.color}`}>{stat.label}</span>
                  <span className="text-sm text-gray-300"> — {stat.effect}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-400">{RULEBOOK_STATS_NOTE}</p>
          </RulebookSection>

          {/* 3) Weapons */}
          <RulebookSection id="weapons" title="3) Weapons">
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_WEAPONS_NOTE}</p>
            <div className="space-y-4">
              {RULEBOOK_WEAPONS.map(({ weapon, lmbSummary }) => {
                const tip = getThroneWeaponTooltipData(weapon);
                return (
                  <div
                    key={weapon}
                    className="rounded-lg border border-gray-700/80 bg-gray-950/40 px-3 py-3"
                  >
                    <h4 className="font-semibold text-yellow-200">
                      {getWeaponDisplayName(weapon)}
                    </h4>
                    {tip?.description && (
                      <p className="mt-0.5 text-sm italic text-gray-400">{tip.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-300">
                      <strong className="text-green-400">Left-click</strong> — {lmbSummary}
                    </p>
                    <WeaponDefaultAbilities weapon={weapon} />
                  </div>
                );
              })}
            </div>
          </RulebookSection>

          {/* 4) Archetypes */}
          <RulebookSection id="archetypes" title="4) Archetypes">
            <p className="mb-3 text-sm text-gray-400">
              Choose an archetype from a west-rim pedestal in the throne room (press X).{' '}
              <strong className="text-green-400">Shift</strong> activates its power.
            </p>
            <ul className="space-y-2">
              {THRONE_ARCHETYPES.map((id) => {
                const meta = ARCHETYPE_DISPLAY[id];
                return (
                  <li
                    key={id}
                    className="rounded-lg border border-gray-700/80 bg-gray-950/50 px-3 py-2"
                  >
                    <span className="font-semibold" style={{ color: meta.accentColor }}>
                      {meta.label}
                    </span>
                    <p className="mt-0.5 text-sm text-gray-300">{meta.description}</p>
                  </li>
                );
              })}
            </ul>
          </RulebookSection>

          {/* 5) Ancestors */}
          <RulebookSection id="ancestors" title="5) Ancestors">
            <p className="mb-3 text-sm text-gray-400">
              During the intro fountain phase you are offered two ancestor candidates. Press X
              near one to recruit them as your allied companion for the run.
            </p>
            <ul className="space-y-2">
              {ALLY_CHOICE_CARDS.map((card) => (
                <li
                  key={card.kind}
                  className="rounded-lg border border-gray-700/80 bg-gray-950/50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-yellow-200">{card.title}</span>
                    <span className="text-xs text-gray-500">{card.role}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{card.stats.join(' · ')}</p>
                  <p className="mt-1 text-sm text-gray-300">{card.description}</p>
                </li>
              ))}
            </ul>
          </RulebookSection>

          {/* 6) Talents */}
          <RulebookSection id="talents" title="6) Talents (Class Boons)">
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_CLASS_TALENTS_NOTE}</p>
            {(
              [
                WeaponType.RUNEBLADE,
                WeaponType.SABRES,
                WeaponType.BOW,
                WeaponType.SCYTHE,
              ] as const
            ).map((weapon) => (
              <div key={weapon} className="mb-5 last:mb-0">
                <h4 className="mb-2 font-semibold text-green-400">
                  {RULEBOOK_WEAPON_LABELS[weapon]}
                </h4>
                <ul className="space-y-2">
                  {RULEBOOK_CLASS_TALENTS[weapon].map((entry) => (
                    <TalentEntry key={entry.id} entry={entry} />
                  ))}
                </ul>
              </div>
            ))}
          </RulebookSection>

          {/* 7) Primary Boons */}
          <RulebookSection id="primary-boons" title="7) Primary Boons">
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_PRIMARY_BOONS_INTRO}</p>

            {(
              [
                WeaponType.BOW,
                WeaponType.RUNEBLADE,
                WeaponType.SCYTHE,
                WeaponType.SABRES,
              ] as const
            ).map((weapon) => (
              <div key={weapon} className="mb-5">
                <h4 className="mb-2 font-semibold text-green-400">
                  {RULEBOOK_WEAPON_LABELS[weapon]}
                </h4>
                {RULEBOOK_PRIMARY_BY_WEAPON[weapon].map((slot) => (
                  <div key={slot.key} className="mb-3">
                    <h5 className="mb-1 text-sm font-semibold text-yellow-200">
                      {slot.label}
                      <span className="ml-2 font-normal text-gray-500">{slot.abilityHint}</span>
                    </h5>
                    <ul className="space-y-2">
                      {slot.variants.map((id) => (
                        <TalentIdEntry key={id} id={id} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}

            <div>
              <h4 className="mb-2 font-semibold text-green-400">
                Dash (shared — one per run)
              </h4>
              <p className="mb-2 text-sm text-gray-400">
                Divine Dash, Infernal Dash, Glacial Dash, Mending Dash, and Storm Dash are mutually
                exclusive.
              </p>
              <ul className="space-y-2">
                {RULEBOOK_DASH_BOONS.map((id) => (
                  <TalentIdEntry key={id} id={id} />
                ))}
              </ul>
            </div>
          </RulebookSection>

          {/* 8) Secondary Boons */}
          <RulebookSection id="secondary-boons" title="8) Secondary Boons">
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_SECONDARY_NOTE}</p>
            {RULEBOOK_SECONDARY_BOONS.map((group) => (
              <div key={group.color} className="mb-5 last:mb-0">
                <h4 className={`mb-2 font-semibold ${group.headerClass}`}>{group.title}</h4>
                <ul className="space-y-2">
                  {group.entries.map((entry) => (
                    <TalentEntry key={entry.id} entry={entry} />
                  ))}
                </ul>
              </div>
            ))}
          </RulebookSection>

          {/* 9) Duo & Ultimate */}
          <RulebookSection id="duo-ultimate" title="9) Duo and Ultimate Boons">
            <h4 className="mb-2 font-semibold text-green-400">Duo Boons</h4>
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_DUO_UNLOCK}</p>
            {RULEBOOK_DUO_PAIRS.map((pair) => (
              <div key={pair.colorsLabel} className="mb-4">
                <h5 className="mb-2 text-sm font-semibold text-yellow-200">{pair.colorsLabel}</h5>
                <ul className="space-y-2">
                  {pair.ids.map((id) => (
                    <TalentIdEntry key={id} id={id} />
                  ))}
                </ul>
              </div>
            ))}

            <h4 className="mb-2 mt-4 font-semibold text-green-400">Ultimate Boons</h4>
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_ULTIMATE_UNLOCK}</p>
            <ul className="space-y-2">
              {RULEBOOK_ULTIMATES.map((u) => (
                <li key={u.id}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {u.colorLabel}
                  </div>
                  <TalentIdEntry id={u.id} />
                </li>
              ))}
            </ul>
          </RulebookSection>

          {/* 10) Portals */}
          <RulebookSection id="portals" title="10) Portal Colors">
            <p className="mb-3 text-sm text-gray-400">{RULEBOOK_PORTALS_FLOW}</p>
            <ul className="space-y-2">
              {RULEBOOK_PORTALS.map((portal) => (
                <li
                  key={portal.name}
                  className="flex gap-3 rounded-lg border border-gray-700/80 bg-gray-950/50 px-3 py-2"
                >
                  <span
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full ${portal.swatchClass}`}
                    aria-hidden
                  />
                  <div>
                    <div className="font-semibold text-yellow-200">
                      ({portal.colorLabel}) {portal.name}
                    </div>
                    <p className="text-sm text-gray-300">{portal.reward}</p>
                  </div>
                </li>
              ))}
            </ul>
          </RulebookSection>
        </div>

        <div className="shrink-0 border-t border-gray-700 px-6 py-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-green-600/60 bg-green-950/50 px-4 py-1.5 text-sm font-medium text-green-300 hover:border-green-400 hover:text-green-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
