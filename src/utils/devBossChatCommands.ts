import { COOP_DEV_LOCALHOST_FEATURES } from '@/components/environment/ThroneRoom';

const DEV_ROOM_CHAT_TO_CAMP: Record<string, string> = {
  BOSS1: 'dev_boss',
  BOSS2: 'dev_boss2',
  BOSS3: 'dev_boss3',
  INNERSANCTUMI: 'dev_intro_1',
  INNERSANCTUMII: 'dev_intro_2',
  INNERSANCTUMIII: 'dev_intro_3',
  INNERSANCTUMIV: 'dev_intro_4',
  SUNKENTEMPLEI: 'dev_sunken_1',
  SUNKENTEMPLEII: 'dev_sunken_2',
  SUNKENTEMPLEIII: 'dev_sunken_3',
  SUNKENTEMPLEIV: 'dev_sunken_4',
  ETERNITYSPALACEI: 'dev_eternity_1',
  ETERNITYSPALACEII: 'dev_eternity_2',
  ETERNITYSPALACEIII: 'dev_eternity_3',
  ETERNITYSPALACEIV: 'dev_eternity_4',
  ETERNITYSPALACEV: 'dev_eternity_5',
  EREBUSGATE: 'dev_erebus_gate',
  DELIRIUMGATE: 'dev_delirium_gate',
};

/** Resolve local-dev chat shortcuts (BOSS1/2/3, room teleports) to enter-combat-arena camp types. */
export function resolveDevBossChatCamp(message: string): string | null {
  if (!COOP_DEV_LOCALHOST_FEATURES) return null;
  return DEV_ROOM_CHAT_TO_CAMP[message.trim().toUpperCase()] ?? null;
}
